import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../AppDataContext';
import { useAccount } from '../AccountContext';
import { MarkdownEditor } from '../components/ui/MarkdownEditor';
import { IcLock, IcPlus, IcStar, IcTrash } from '../components/icons';
import { useNotesUnlock } from '../lib/NotesUnlockContext';
import {
  createNotesLock,
  decryptBodyWithMaster,
  encryptBodyWithMaster,
  unlockMaster,
  unwrapPassphraseFromRecovery,
  wrapPassphraseForRecovery,
} from '../lib/notesCrypto';
import type { Note, NotesLock } from '../model';

const PLACEHOLDER_TITLE = 'New note';

type PendingIntent = 'lock' | 'unlock-selected' | 'disable-locking' | 'view';

const FORCE_RESET_PHRASE = 'DELETE LOCKED NOTES';

/**
 * macOS-Notes-style two-pane view. Left rail lists every note (title +
 * preview); right pane is a Markdown editor for the selected note.
 *
 * Lock model: a workspace passphrase derives a non-extractable AES-256-GCM
 * `CryptoKey` (PBKDF2-SHA-256, 200k iters) once per session. Locked notes
 * encrypt with that cached key + a fresh IV per save — sub-millisecond, so
 * re-encryption per keystroke is fine.
 *
 * Implementation notes worth keeping in your head when editing this file:
 *
 *   - The plaintext body of the selected note lives in the `decrypted`
 *     state object (keyed by note id). The editor always reads from there;
 *     the on-disk `selected.body` is only consulted for unlocked notes
 *     and as the initial seed when we first decrypt.
 *
 *   - We never depend on the master key being readable via the
 *     `NotesUnlockProvider` ref immediately after `remember()` — React
 *     hasn't re-rendered yet, so `ref.current` is still stale. Instead, the
 *     setup / unlock submit handlers pass the freshly-derived `CryptoKey`
 *     directly into `performAction(intent, masterKey)`, which is the
 *     single source of truth for what "lock", "unlock", "disable locking"
 *     and "view" mean. This is what fixes the historical bug where
 *     setting a passphrase and immediately locking a note would derive a
 *     SECOND key, encrypt the body with the first key but persist the
 *     second verifier, and then refuse to unlock with the correct
 *     passphrase.
 */
export function NotesPage() {
  const { data, addNote, patchNote, replaceNote, removeNote, setNotesLock, update } = useAppData();
  const unlock = useNotesUnlock();
  const account = useAccount();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmDisableLock, setConfirmDisableLock] = useState(false);

  const [setupPw1, setSetupPw1] = useState('');
  const [setupPw2, setSetupPw2] = useState('');
  /** Optional recovery wrap during setup: encrypt the Notes passphrase with
   *  the account password so the user can recover from a forgotten passphrase. */
  const [setupEnableRecovery, setSetupEnableRecovery] = useState(true);
  const [setupAccountPw, setSetupAccountPw] = useState('');
  const [unlockPw, setUnlockPw] = useState('');
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const [unlockErr, setUnlockErr] = useState<string | null>(null);
  const [disableErr, setDisableErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Force-reset escape hatch: shown inside the unlock dialog when the user
   *  has tried-and-failed at least once. They have to type the literal
   *  FORCE_RESET_PHRASE to confirm — there's no recovery for the locked
   *  notes after this, but it prevents an unrecoverable workspace. */
  const [forceResetOpen, setForceResetOpen] = useState(false);
  const [forceResetInput, setForceResetInput] = useState('');
  /** Account-password recovery flow ("Forgot passphrase?"): user enters
   *  their account password, we unwrap the Notes passphrase and unlock. */
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverPw, setRecoverPw] = useState('');
  const [recoverErr, setRecoverErr] = useState<string | null>(null);
  /** Add-recovery-to-existing-lock flow: user enters current Notes
   *  passphrase AND account password to attach a recovery envelope to a
   *  workspace lock that doesn't have one yet. */
  const [addRecoveryOpen, setAddRecoveryOpen] = useState(false);
  const [addRecoveryNotesPw, setAddRecoveryNotesPw] = useState('');
  const [addRecoveryAccountPw, setAddRecoveryAccountPw] = useState('');
  const [addRecoveryErr, setAddRecoveryErr] = useState<string | null>(null);

  /** Plaintext for the currently-displayed note (keyed by id to survive our
   *  own re-encryption re-renders). */
  const [decrypted, setDecrypted] = useState<{ noteId: string; body: string } | null>(null);
  /** Monotonic counter that lets a slow encrypt completion drop out if a
   *  newer keystroke already started a more recent encrypt. */
  const encryptGen = useRef(0);

  // ----- DERIVED ---------------------------------------------------------

  const notes = useMemo<Note[]>(() => {
    return [...data.notes].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [data.notes]);

  useEffect(() => {
    if (selectedId && notes.some((n) => n.id === selectedId)) return;
    setSelectedId(notes[0]?.id ?? null);
  }, [notes, selectedId]);

  const selected = useMemo(
    () => (selectedId ? notes.find((n) => n.id === selectedId) ?? null : null),
    [notes, selectedId],
  );

  /** True when the editor has plaintext for the selected note. */
  const editorReady =
    !!selected && (!selected.locked || decrypted?.noteId === selected.id);

  const editorBody = !selected
    ? ''
    : selected.locked
      ? decrypted?.noteId === selected.id
        ? decrypted.body
        : ''
      : selected.body;

  // ----- DECRYPT WHEN SELECTION CHANGES ---------------------------------

  // Only decrypts when we don't already hold plaintext for the selected id.
  // This short-circuits the re-render caused by our own keystroke saves.
  useEffect(() => {
    if (!selected) {
      setDecrypted(null);
      return;
    }
    if (!selected.locked) return;
    if (decrypted?.noteId === selected.id) return;
    if (!selected.cipher) return;
    const key = unlock.read();
    if (!key) return;
    let cancelled = false;
    void (async () => {
      const body = await decryptBodyWithMaster(key, selected.cipher!);
      if (cancelled) return;
      if (body !== null) setDecrypted({ noteId: selected.id, body });
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, unlock.masterKey, decrypted?.noteId]);

  // ----- CORE: perform a pending action with an EXPLICIT key -------------

  /**
   * Executes one of the four intents with the supplied master key. Callers
   * MUST pass the key directly (don't rely on the `NotesUnlockProvider`
   * ref) when they've just derived it in the same call stack — React state
   * is still in-flight at that point.
   */
  const performAction = useCallback(
    async (intent: PendingIntent, key: CryptoKey, targetNote: Note | null) => {
      switch (intent) {
        case 'view': {
          // Nothing to do; the decrypt useEffect picks it up on next render.
          if (targetNote?.locked && targetNote.cipher) {
            const body = await decryptBodyWithMaster(key, targetNote.cipher);
            if (body !== null) setDecrypted({ noteId: targetNote.id, body });
          }
          return;
        }
        case 'lock': {
          if (!targetNote) return;
          setBusy(true);
          try {
            const bodyToLock = targetNote.locked
              ? decrypted?.noteId === targetNote.id
                ? decrypted.body
                : targetNote.body
              : targetNote.body;
            const cipher = await encryptBodyWithMaster(key, bodyToLock);
            replaceNote({ ...targetNote, body: '', locked: true, cipher });
          } finally {
            setBusy(false);
          }
          return;
        }
        case 'unlock-selected': {
          if (!targetNote || !targetNote.cipher) return;
          setBusy(true);
          try {
            const body = await decryptBodyWithMaster(key, targetNote.cipher);
            if (body === null) {
              setUnlockErr('That passphrase does not unlock this note.');
              setUnlockOpen(true);
              setPendingIntent('unlock-selected');
              return;
            }
            replaceNote({ ...targetNote, body, locked: false, cipher: undefined });
            setDecrypted({ noteId: targetNote.id, body });
          } finally {
            setBusy(false);
          }
          return;
        }
        case 'disable-locking': {
          setBusy(true);
          setDisableErr(null);
          try {
            const lockedNotes = data.notes.filter((n) => n.locked && n.cipher);
            const decryptedPairs: { id: string; body: string }[] = [];
            for (const n of lockedNotes) {
              const body = await decryptBodyWithMaster(key, n.cipher!);
              if (body === null) {
                setDisableErr(
                  `Could not decrypt "${n.title || PLACEHOLDER_TITLE}" with the current passphrase. ` +
                    `If this is a leftover from an earlier broken attempt, delete that note (the Delete button works even when locked) ` +
                    `and try "Remove lock" again.`,
                );
                return;
              }
              decryptedPairs.push({ id: n.id, body });
            }
            update((d) => {
              const lookup = new Map(decryptedPairs.map((p) => [p.id, p.body]));
              const now = new Date().toISOString();
              const nextNotes = d.notes.map((n) =>
                lookup.has(n.id)
                  ? { ...n, body: lookup.get(n.id)!, locked: false, cipher: undefined, updatedAt: now }
                  : n,
              );
              const { notesLock: _drop, ...rest } = d;
              return { ...(rest as typeof d), notes: nextNotes };
            });
            setNotesLock(undefined);
            unlock.clear();
            setConfirmDisableLock(false);
          } finally {
            setBusy(false);
          }
        }
      }
    },
    [data.notes, decrypted, replaceNote, setNotesLock, unlock, update],
  );

  // ----- BUTTON HANDLERS ------------------------------------------------

  /** Open the right passphrase dialog for the given intent, or call
   *  performAction immediately when we already have the key. */
  const requestAction = useCallback(
    (intent: PendingIntent) => {
      const key = unlock.read();
      if (key) {
        void performAction(intent, key, selected);
        return;
      }
      if (!data.notesLock) {
        setSetupErr(null);
        setSetupPw1('');
        setSetupPw2('');
        setPendingIntent(intent);
        setSetupOpen(true);
        return;
      }
      setUnlockErr(null);
      setUnlockPw('');
      setPendingIntent(intent);
      setUnlockOpen(true);
    },
    [unlock, performAction, selected, data.notesLock],
  );

  const onCreate = () => {
    const id = addNote();
    setSelectedId(id);
    setDecrypted(null);
  };

  const onChangeTitle = (next: string) => {
    if (!selected) return;
    patchNote(selected.id, { title: next });
  };

  const onChangeBody = (next: string) => {
    if (!selected) return;
    if (!selected.locked) {
      setDecrypted({ noteId: selected.id, body: next });
      patchNote(selected.id, { body: next });
      return;
    }
    setDecrypted({ noteId: selected.id, body: next });
    const key = unlock.read();
    if (!key) return;
    const myGen = ++encryptGen.current;
    void (async () => {
      const cipher = await encryptBodyWithMaster(key, next);
      if (myGen !== encryptGen.current) return;
      replaceNote({ ...selected, body: '', locked: true, cipher });
    })();
  };

  const onTogglePinned = () => {
    if (!selected) return;
    patchNote(selected.id, { pinned: !selected.pinned });
  };

  const confirmDelete = () => {
    if (!confirmRemoveId) return;
    removeNote(confirmRemoveId);
    setConfirmRemoveId(null);
  };

  // ----- AUTO-OPEN UNLOCK DIALOG WHEN A LOCKED NOTE IS SELECTED ----------

  // When the selection changes to a locked note and we don't have plaintext
  // or a master key, open the unlock dialog so the user doesn't have to
  // click a second button to get to it.
  useEffect(() => {
    if (!selected) return;
    if (!selected.locked) return;
    if (decrypted?.noteId === selected.id) return;
    if (unlock.read()) return;
    if (unlockOpen || setupOpen) return;
    setUnlockPw('');
    setUnlockErr(null);
    setPendingIntent('view');
    setUnlockOpen(true);
    // intentional: only re-run on selectedId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ----- DIALOG SUBMIT HANDLERS -----------------------------------------

  const submitSetup = async () => {
    setSetupErr(null);
    const a = setupPw1;
    const b = setupPw2;
    if (a.length < 6) {
      setSetupErr('Choose a passphrase of at least 6 characters.');
      return;
    }
    if (a !== b) {
      setSetupErr('Passphrases do not match.');
      return;
    }
    const wantsRecovery = setupEnableRecovery;
    const accountPw = setupAccountPw;
    if (wantsRecovery && !accountPw) {
      setSetupErr('Enter your account password (or untick "Enable recovery").');
      return;
    }
    setBusy(true);
    try {
      // Verify the account password BEFORE we wrap with it — otherwise a
      // typo here would silently produce an unwrappable recovery envelope
      // that the user would only discover when they actually need it.
      let recovery: NotesLock['recovery'] | undefined;
      if (wantsRecovery) {
        const v = await account.verifyPassword(accountPw);
        if (!v.ok) {
          setSetupErr(v.error ?? 'Could not verify account password.');
          return;
        }
        recovery = await wrapPassphraseForRecovery(a, accountPw);
      }
      const { lock, masterKey } = await createNotesLock(a);
      const fullLock: NotesLock = recovery ? { ...lock, recovery } : lock;
      setNotesLock(fullLock);
      unlock.remember(masterKey);
      setSetupOpen(false);
      setSetupPw1('');
      setSetupPw2('');
      setSetupAccountPw('');
      const intent = pendingIntent;
      setPendingIntent(null);
      // CRITICAL: pass the freshly-derived key directly. Reading it back via
      // `unlock.read()` right now would return null because React hasn't
      // re-rendered the provider yet.
      if (intent) await performAction(intent, masterKey, selected);
    } catch (e) {
      setSetupErr(e instanceof Error ? e.message : 'Could not set passphrase.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * "Forgot passphrase?" recovery path. The user enters their account
   * password; we use it to unwrap the Notes passphrase stored in
   * `notesLock.recovery`, then derive the master key from that passphrase
   * normally. Same trust boundary as the original passphrase — no notes are
   * decrypted by the account password directly.
   */
  const submitRecover = async () => {
    setRecoverErr(null);
    if (!data.notesLock?.recovery) {
      setRecoverErr('There is no recovery envelope on this workspace.');
      return;
    }
    const accountPw = recoverPw;
    if (!accountPw) return;
    setBusy(true);
    try {
      const passphrase = await unwrapPassphraseFromRecovery(data.notesLock.recovery, accountPw);
      if (!passphrase) {
        setRecoverErr('That account password is not correct (or the recovery envelope is corrupt).');
        return;
      }
      const key = await unlockMaster(passphrase, data.notesLock);
      if (!key) {
        // Shouldn't happen unless somebody tampered with the file — the
        // recovery envelope decrypted but the resulting passphrase doesn't
        // match the master key verifier.
        setRecoverErr('Recovery envelope decrypted but the passphrase did not unlock the notes.');
        return;
      }
      unlock.remember(key);
      setRecoverOpen(false);
      setRecoverPw('');
      setUnlockOpen(false);
      setUnlockPw('');
      const intent = pendingIntent;
      setPendingIntent(null);
      if (intent === 'disable-locking') {
        setConfirmDisableLock(true);
        return;
      }
      if (intent) await performAction(intent, key, selected);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Attach a recovery envelope to a workspace lock that doesn't have one
   * yet. We need both the current Notes passphrase (to confirm the user
   * really knows it — otherwise anyone with brief physical access could
   * register an attacker-controlled recovery) and the account password
   * (so the wrap actually works).
   */
  const submitAddRecovery = async () => {
    setAddRecoveryErr(null);
    if (!data.notesLock) {
      setAddRecoveryErr('There is no Notes passphrase to recover.');
      return;
    }
    const notesPw = addRecoveryNotesPw;
    const accountPw = addRecoveryAccountPw;
    if (!notesPw || !accountPw) return;
    setBusy(true);
    try {
      const key = await unlockMaster(notesPw, data.notesLock);
      if (!key) {
        setAddRecoveryErr('That is not the current Notes passphrase.');
        return;
      }
      const v = await account.verifyPassword(accountPw);
      if (!v.ok) {
        setAddRecoveryErr(v.error ?? 'Incorrect account password.');
        return;
      }
      const recovery = await wrapPassphraseForRecovery(notesPw, accountPw);
      setNotesLock({ ...data.notesLock, recovery });
      // Remember the verified master key while we're at it — they just
      // proved they know the passphrase, no reason to ask again this session.
      unlock.remember(key);
      setAddRecoveryOpen(false);
      setAddRecoveryNotesPw('');
      setAddRecoveryAccountPw('');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Nuclear option: drop the workspace lock AND delete every note that's
   * still locked, without ever decrypting them. Used when the user has
   * permanently lost their passphrase. We gate it behind typing a literal
   * confirmation phrase so it can't be triggered by an accidental click.
   */
  const forceReset = useCallback(() => {
    update((d) => {
      const nextNotes = d.notes.filter((n) => !n.locked);
      const { notesLock: _drop, ...rest } = d;
      return { ...(rest as typeof d), notes: nextNotes };
    });
    setNotesLock(undefined);
    unlock.clear();
    setForceResetOpen(false);
    setForceResetInput('');
    setUnlockOpen(false);
    setConfirmDisableLock(false);
    setPendingIntent(null);
    setUnlockErr(null);
    setUnlockPw('');
  }, [update, setNotesLock, unlock]);

  const submitUnlock = async () => {
    setUnlockErr(null);
    const pw = unlockPw;
    if (!pw) return;
    if (!data.notesLock) return;
    setBusy(true);
    try {
      const key = await unlockMaster(pw, data.notesLock);
      if (!key) {
        setUnlockErr('That passphrase is not correct.');
        return;
      }
      unlock.remember(key);
      setUnlockOpen(false);
      setUnlockPw('');
      const intent = pendingIntent;
      setPendingIntent(null);
      // For destructive intents (remove the workspace lock entirely) we
      // show the confirm dialog AFTER unlocking — the user has now proven
      // they know the passphrase, and we can run the irreversible
      // operation only when they explicitly approve it.
      if (intent === 'disable-locking') {
        setConfirmDisableLock(true);
        return;
      }
      // Same reason as in submitSetup: hand the freshly-derived key through.
      if (intent) await performAction(intent, key, selected);
    } finally {
      setBusy(false);
    }
  };

  // ----- RENDER ----------------------------------------------------------

  const hasLock = !!data.notesLock;
  const hasRecovery = !!data.notesLock?.recovery;

  return (
    <div className="notes-page">
      <aside className="notes-page__sidebar">
        <header className="notes-page__sidebar-header">
          <h2>Notes</h2>
          <div className="notes-page__sidebar-actions">
            {hasLock && !hasRecovery ? (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  setAddRecoveryErr(null);
                  setAddRecoveryNotesPw('');
                  setAddRecoveryAccountPw('');
                  setAddRecoveryOpen(true);
                }}
                title="Allow recovery using your account password"
              >
                Add recovery
              </button>
            ) : null}
            {hasLock ? (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  // Force-unlock the session first if we don't have the key —
                  // showing the destructive confirm dialog ON TOP of the
                  // passphrase prompt would stack two backdrops and the user
                  // could never get to the input. Once we have the key (either
                  // already remembered or freshly derived by submitUnlock),
                  // the confirm dialog opens cleanly.
                  setDisableErr(null);
                  const key = unlock.read();
                  if (!key) {
                    setUnlockErr(null);
                    setUnlockPw('');
                    setPendingIntent('disable-locking');
                    setUnlockOpen(true);
                    return;
                  }
                  setConfirmDisableLock(true);
                }}
                title="Remove the Notes passphrase from this workspace"
              >
                Remove lock
              </button>
            ) : null}
            <button type="button" className="btn btn--sm btn--primary" onClick={onCreate} title="New note">
              <IcPlus size={14} /> New
            </button>
          </div>
        </header>
        {notes.length === 0 ? (
          <div className="notes-page__empty">
            <p>No notes yet.</p>
            <button type="button" className="btn btn--primary" onClick={onCreate}>
              Create your first note
            </button>
          </div>
        ) : (
          <ul className="notes-page__list">
            {notes.map((n) => {
              const preview = n.locked
                ? '🔒 Locked note'
                : (n.body || '').replace(/\s+/g, ' ').slice(0, 80);
              const title = (n.title || PLACEHOLDER_TITLE).trim() || PLACEHOLDER_TITLE;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notes-page__list-item${selectedId === n.id ? ' notes-page__list-item--active' : ''}`}
                    onClick={() => setSelectedId(n.id)}
                  >
                    <div className="notes-page__list-title">
                      {n.pinned ? <span className="notes-page__pin" aria-hidden>★</span> : null}
                      <span>{title}</span>
                      {n.locked ? <IcLock size={12} /> : null}
                    </div>
                    <div className="notes-page__list-preview">{preview || '—'}</div>
                    <time className="notes-page__list-time" dateTime={n.updatedAt}>
                      {new Date(n.updatedAt).toLocaleString()}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="notes-page__main">
        {!selected ? (
          <div className="notes-page__placeholder">Select a note on the left, or create a new one.</div>
        ) : (
          <>
            <header className="notes-page__main-header">
              <input
                className="notes-page__title-input"
                value={selected.title}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder={PLACEHOLDER_TITLE}
                disabled={selected.locked && !editorReady}
              />
              <div className="notes-page__main-actions">
                <button
                  type="button"
                  className={`btn btn--sm${selected.pinned ? ' btn--primary' : ''}`}
                  onClick={onTogglePinned}
                  title={selected.pinned ? 'Unpin' : 'Pin to top'}
                >
                  <IcStar size={14} />
                </button>
                {selected.locked ? (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => requestAction('unlock-selected')}
                    disabled={busy}
                    title="Unlock note"
                  >
                    <IcLock size={14} /> Unlock
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => requestAction('lock')}
                    disabled={busy}
                    title="Lock note"
                  >
                    <IcLock size={14} /> Lock
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => setConfirmRemoveId(selected.id)}
                  title="Delete note"
                >
                  <IcTrash size={14} />
                </button>
              </div>
            </header>

            {selected.locked && !editorReady ? (
              <div className="notes-page__locked">
                <IcLock size={20} />
                <h3>This note is locked.</h3>
                {busy ? (
                  <p>Decrypting…</p>
                ) : (
                  <>
                    <p>Unlock it to read or edit. The body is encrypted at rest with your Notes passphrase.</p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => requestAction('unlock-selected')}
                    >
                      Unlock note
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="notes-page__editor">
                <MarkdownEditor
                  value={editorBody}
                  onChange={onChangeBody}
                  placeholder="Type your note in Markdown…"
                  rows={18}
                />
              </div>
            )}
          </>
        )}
      </section>

      {setupOpen ? (
        <NotesDialog
          title="Set a Notes passphrase"
          icon={<IcLock size={18} />}
          onClose={() => {
            setSetupOpen(false);
            setPendingIntent(null);
            setSetupPw1('');
            setSetupPw2('');
            setSetupAccountPw('');
            setSetupErr(null);
          }}
          footer={
            <button type="button" className="btn btn--primary" onClick={submitSetup} disabled={busy}>
              {busy ? 'Saving…' : 'Save passphrase'}
            </button>
          }
        >
          <p>
            This passphrase is required to lock and unlock notes. It's <strong>different from your account
            password</strong> and is <strong>never stored on disk</strong> — only a verifier blob is saved, used to
            check whether the passphrase you type later is correct.
          </p>
          <label className="field">
            <span>Passphrase</span>
            <input
              type="password"
              className="input"
              value={setupPw1}
              onChange={(e) => setSetupPw1(e.target.value)}
              autoFocus
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span>Confirm passphrase</span>
            <input
              type="password"
              className="input"
              value={setupPw2}
              onChange={(e) => setSetupPw2(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !setupEnableRecovery) void submitSetup();
              }}
            />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={setupEnableRecovery}
              onChange={(e) => setSetupEnableRecovery(e.target.checked)}
            />
            <span>Enable recovery using my account password (recommended)</span>
          </label>
          {setupEnableRecovery ? (
            <>
              <p style={{ fontSize: 12, opacity: 0.8 }}>
                We'll wrap this passphrase with a key derived from your account password and store the encrypted
                blob alongside the verifier. If you forget the Notes passphrase, you can recover by entering your
                account password. The strongest of the two passwords is what protects your notes at rest.
              </p>
              <label className="field">
                <span>Account password</span>
                <input
                  type="password"
                  className="input"
                  value={setupAccountPw}
                  onChange={(e) => setSetupAccountPw(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitSetup();
                  }}
                />
              </label>
            </>
          ) : (
            <p className="text-warn">
              Without recovery: if you forget this passphrase, locked notes <strong>cannot be recovered</strong>.
            </p>
          )}
          {setupErr ? <p className="text-error">{setupErr}</p> : null}
        </NotesDialog>
      ) : null}

      {unlockOpen ? (
        <NotesDialog
          title={unlockDialogTitle(pendingIntent)}
          icon={<IcLock size={18} />}
          onClose={() => {
            setUnlockOpen(false);
            setPendingIntent(null);
            setUnlockPw('');
            setUnlockErr(null);
          }}
          footer={
            <button type="button" className="btn btn--primary" onClick={submitUnlock} disabled={busy}>
              {busy ? 'Checking…' : unlockDialogButton(pendingIntent)}
            </button>
          }
        >
          <p>{unlockDialogBody(pendingIntent)}</p>
          <label className="field">
            <span>Passphrase</span>
            <input
              type="password"
              className="input"
              value={unlockPw}
              onChange={(e) => setUnlockPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitUnlock();
              }}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {unlockErr ? <p className="text-error">{unlockErr}</p> : null}
          {/* "Forgot?" routes to whichever recovery path is available:
              if a recovery envelope was set up, the account-password
              recovery dialog; otherwise the destructive force-reset. */}
          <p style={{ marginTop: 12, fontSize: 12 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                if (data.notesLock?.recovery) {
                  setRecoverErr(null);
                  setRecoverPw('');
                  setRecoverOpen(true);
                } else {
                  setForceResetOpen(true);
                }
              }}
            >
              Forgot passphrase?
            </button>
          </p>
        </NotesDialog>
      ) : null}

      {recoverOpen ? (
        <NotesDialog
          title="Recover with your account password"
          icon={<IcLock size={18} />}
          onClose={() => {
            setRecoverOpen(false);
            setRecoverPw('');
            setRecoverErr(null);
          }}
          footer={
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitRecover}
              disabled={busy || !recoverPw}
            >
              {busy ? 'Recovering…' : 'Recover & unlock'}
            </button>
          }
        >
          <p>
            Enter your <strong>account password</strong> (the one you log in with). We'll use it to decrypt the
            Notes passphrase that was stored at setup time, then unlock the workspace.
          </p>
          <label className="field">
            <span>Account password</span>
            <input
              type="password"
              className="input"
              value={recoverPw}
              onChange={(e) => setRecoverPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRecover();
              }}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          {recoverErr ? <p className="text-error">{recoverErr}</p> : null}
          <p style={{ marginTop: 12, fontSize: 12 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setRecoverOpen(false);
                setRecoverPw('');
                setRecoverErr(null);
                setForceResetOpen(true);
              }}
            >
              Account password also lost? Delete locked notes &amp; reset
            </button>
          </p>
        </NotesDialog>
      ) : null}

      {addRecoveryOpen ? (
        <NotesDialog
          title="Add account-password recovery"
          icon={<IcLock size={18} />}
          onClose={() => {
            setAddRecoveryOpen(false);
            setAddRecoveryNotesPw('');
            setAddRecoveryAccountPw('');
            setAddRecoveryErr(null);
          }}
          footer={
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitAddRecovery}
              disabled={busy || !addRecoveryNotesPw || !addRecoveryAccountPw}
            >
              {busy ? 'Saving…' : 'Enable recovery'}
            </button>
          }
        >
          <p>
            Add a recovery path so a forgotten Notes passphrase can be recovered using your account password.
            We need both the current Notes passphrase (to confirm it's you) and your account password (so the
            wrap actually works).
          </p>
          <label className="field">
            <span>Current Notes passphrase</span>
            <input
              type="password"
              className="input"
              value={addRecoveryNotesPw}
              onChange={(e) => setAddRecoveryNotesPw(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            <span>Account password</span>
            <input
              type="password"
              className="input"
              value={addRecoveryAccountPw}
              onChange={(e) => setAddRecoveryAccountPw(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitAddRecovery();
              }}
            />
          </label>
          {addRecoveryErr ? <p className="text-error">{addRecoveryErr}</p> : null}
        </NotesDialog>
      ) : null}

      {forceResetOpen ? (
        <NotesDialog
          title="Forgot the Notes passphrase?"
          icon={<IcLock size={18} />}
          onClose={() => {
            setForceResetOpen(false);
            setForceResetInput('');
          }}
          footer={
            <button
              type="button"
              className="btn btn--danger"
              onClick={forceReset}
              disabled={forceResetInput !== FORCE_RESET_PHRASE}
            >
              Delete locked notes &amp; reset
            </button>
          }
        >
          <p>
            There is no recovery path for the Notes passphrase — that's the whole point of at-rest encryption.
            If you proceed, we will:
          </p>
          <ul>
            <li>Permanently delete every note that's currently locked (ciphertext gone, unrecoverable).</li>
            <li>Remove the workspace passphrase so you can start fresh.</li>
            <li>Leave every plaintext note untouched.</li>
          </ul>
          <p className="text-warn">
            This cannot be undone. Type <code>{FORCE_RESET_PHRASE}</code> below to confirm.
          </p>
          <label className="field">
            <span>Confirmation</span>
            <input
              type="text"
              className="input"
              value={forceResetInput}
              onChange={(e) => setForceResetInput(e.target.value)}
              placeholder={FORCE_RESET_PHRASE}
              autoFocus
            />
          </label>
        </NotesDialog>
      ) : null}

      {confirmRemoveId ? (
        <NotesDialog
          title="Delete note?"
          onClose={() => setConfirmRemoveId(null)}
          footer={
            <button type="button" className="btn btn--danger" onClick={confirmDelete}>
              Delete
            </button>
          }
        >
          <p>
            {(() => {
              const n = notes.find((x) => x.id === confirmRemoveId);
              if (!n) return 'This note will be removed permanently.';
              if (n.locked) {
                return 'This note is locked. Deleting it removes the ciphertext — once it is gone you can\'t recover it even if you remember the passphrase.';
              }
              return 'This note will be removed permanently. There is no undo.';
            })()}
          </p>
        </NotesDialog>
      ) : null}

      {confirmDisableLock ? (
        <NotesDialog
          title="Remove the Notes passphrase?"
          icon={<IcLock size={18} />}
          onClose={() => {
            setConfirmDisableLock(false);
            setDisableErr(null);
          }}
          footer={
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                // By construction the confirm dialog is only ever shown
                // AFTER the workspace has been unlocked, so the master key
                // is always available here — call performAction directly
                // and skip the requestAction dispatch logic.
                const key = unlock.read();
                if (!key) {
                  // Edge case: lock cleared in another window between
                  // unlock and confirm. Fall back to the prompt.
                  setUnlockErr(null);
                  setUnlockPw('');
                  setPendingIntent('disable-locking');
                  setConfirmDisableLock(false);
                  setUnlockOpen(true);
                  return;
                }
                void performAction('disable-locking', key, null);
              }}
              disabled={busy}
            >
              {busy ? 'Decrypting…' : 'Remove passphrase'}
            </button>
          }
        >
          <p>
            This will decrypt every locked note back to plain text on disk and remove the workspace passphrase.
            After that, anyone who can open this file can read your notes.
          </p>
          <p className="text-warn">
            We will refuse to proceed if even one locked note fails to decrypt — your data will be left unchanged.
          </p>
          {disableErr ? (
            <>
              <p className="text-error">{disableErr}</p>
              {/* If decryption fails here, the user is stuck — their
                  notesLock no longer matches the per-note ciphertext.
                  Offer the same nuclear escape hatch as the unlock dialog
                  so the workspace can be recovered. */}
              <p style={{ marginTop: 12, fontSize: 12 }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setForceResetOpen(true)}
                >
                  Can't recover? Delete locked notes &amp; reset
                </button>
              </p>
            </>
          ) : null}
        </NotesDialog>
      ) : null}
    </div>
  );
}

/**
 * Intent-aware copy for the passphrase prompt. When the workspace already
 * has a passphrase set, the user needs to enter it ONCE per session before
 * any encryption / decryption can happen — including locking a brand-new
 * note. The button they tap to get here ("Lock", "Unlock", "Remove lock",
 * or simply selecting a locked note) tells us what they're trying to do,
 * and the dialog should mirror that so they aren't shown "to view locked
 * notes" copy while they're really just trying to lock the current note.
 */
function unlockDialogTitle(intent: PendingIntent | null): string {
  switch (intent) {
    case 'lock':
      return 'Enter Notes passphrase to lock';
    case 'unlock-selected':
      return 'Enter Notes passphrase to unlock';
    case 'disable-locking':
      return 'Enter Notes passphrase to remove lock';
    case 'view':
    default:
      return 'Unlock notes';
  }
}

function unlockDialogBody(intent: PendingIntent | null): string {
  switch (intent) {
    case 'lock':
      return 'This workspace already has a Notes passphrase. Enter it once to encrypt this note (and any other locked notes) for the rest of this session.';
    case 'unlock-selected':
      return 'Enter your Notes passphrase to decrypt this note for the rest of this session.';
    case 'disable-locking':
      return 'Enter your Notes passphrase. We need to decrypt every locked note before removing the workspace passphrase.';
    case 'view':
    default:
      return 'Enter your Notes passphrase to view locked notes in this session.';
  }
}

function unlockDialogButton(intent: PendingIntent | null): string {
  switch (intent) {
    case 'lock':
      return 'Unlock & lock';
    case 'unlock-selected':
      return 'Unlock';
    case 'disable-locking':
      return 'Unlock & continue';
    case 'view':
    default:
      return 'Unlock';
  }
}

/**
 * Local dialog wrapper that uses the SAME centred-modal markup as
 * `AIAssistantDialog` (the `.ai-backdrop` overlay + the `.ai-dialog` panel
 * defined in `app.css`). Previously the Notes screen rolled its own
 * `.ai-dialog__panel` class which doesn't exist, so the popups rendered
 * full-bleed with no backdrop.
 */
function NotesDialog({
  title,
  icon,
  onClose,
  footer,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ai-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ai-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="ai-dialog__header">
          {icon ? <span className="ai-dialog__icon">{icon}</span> : null}
          <div className="ai-dialog__titlewrap">
            <h2 className="ai-dialog__title">{title}</h2>
          </div>
          <button type="button" className="ai-dialog__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="ai-dialog__scroll">{children}</div>
        <div className="notes-dialog__footer">{footer}</div>
      </div>
    </div>
  );
}
