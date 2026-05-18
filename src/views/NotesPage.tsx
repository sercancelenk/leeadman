import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../AppDataContext';
import { MarkdownEditor } from '../components/ui/MarkdownEditor';
import { IcLock, IcPlus, IcStar, IcTrash } from '../components/icons';
import { useNotesUnlock } from '../lib/NotesUnlockContext';
import {
  createNotesLock,
  decryptBodyWithMaster,
  encryptBodyWithMaster,
  unlockMaster,
} from '../lib/notesCrypto';
import type { Note } from '../model';

const PLACEHOLDER_TITLE = 'New note';

type PendingAction = 'lock' | 'unlock-selected' | 'disable-locking' | 'view' | null;

/**
 * macOS-Notes-style two-pane view. The left rail lists every note (title +
 * one-line preview). The right pane is a Markdown editor for the selected
 * note. Per-note "Lock" stores the body as AES-GCM ciphertext under the
 * workspace master key derived from a passphrase the user types once per
 * session.
 *
 * Implementation notes:
 *   - The unlocked plaintext for the selected note is held in a single
 *     `decrypted` state object keyed by note id; that's what drives the
 *     editor and prevents flicker when our own re-encryption triggers a
 *     re-render of `selected`.
 *   - Keystroke encryption uses the cached workspace CryptoKey (sub-ms,
 *     no PBKDF2). A monotonic `encryptGen` counter discards out-of-order
 *     completions so a slow encrypt doesn't clobber newer text.
 *   - The unlock dialog can be opened in three different "intents"
 *     (lock the selected note, unlock the selected note, disable workspace
 *     locking, or just view it). On a successful passphrase we resume the
 *     original intent automatically.
 */
export function NotesPage() {
  const { data, addNote, patchNote, replaceNote, removeNote, setNotesLock, update } = useAppData();
  const unlock = useNotesUnlock();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmDisableLock, setConfirmDisableLock] = useState(false);
  // Local passphrase inputs. Stored in component state only, never written
  // to disk or to the unlock context (the unlock context holds the derived
  // CryptoKey, never the string).
  const [setupPw1, setSetupPw1] = useState('');
  const [setupPw2, setSetupPw2] = useState('');
  const [unlockPw, setUnlockPw] = useState('');
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const [unlockErr, setUnlockErr] = useState<string | null>(null);
  const [disableErr, setDisableErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Plaintext body of the currently-shown note, keyed by note id so a re-render
   *  caused by our own debounced save doesn't flicker the editor blank. */
  const [decrypted, setDecrypted] = useState<{ noteId: string; body: string } | null>(null);
  const encryptGen = useRef(0);

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

  // Decrypt the selected note ONLY when:
  //   - the selection changed to a different id, OR
  //   - the master key just became available.
  // We deliberately don't re-run when `selected` changes due to our own
  // re-encryption (same id, new cipher) — the editor already holds the
  // user-typed plaintext in `decrypted`.
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

  /** True when the editor has plaintext for the selected note (either it's not
   *  locked, or it is locked but we hold the decrypted body). */
  const editorReady =
    !!selected && (!selected.locked || decrypted?.noteId === selected.id);

  const editorBody = !selected
    ? ''
    : selected.locked
      ? decrypted?.noteId === selected.id
        ? decrypted.body
        : ''
      : selected.body;

  // ----- CRUD ------------------------------------------------------------

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
    // Locked note: keep the latest text in local state immediately, then
    // re-encrypt with the cached master key. PBKDF2 doesn't run here — just
    // a single AES-GCM block — so this is sub-millisecond.
    setDecrypted({ noteId: selected.id, body: next });
    const key = unlock.read();
    if (!key) return;
    const myGen = ++encryptGen.current;
    void (async () => {
      const cipher = await encryptBodyWithMaster(key, next);
      // Drop completion if a newer keystroke superseded us.
      if (myGen !== encryptGen.current) return;
      replaceNote({ ...selected, body: '', locked: true, cipher });
    })();
  };

  const onTogglePinned = () => {
    if (!selected) return;
    patchNote(selected.id, { pinned: !selected.pinned });
  };

  const onDelete = () => {
    if (!selected) return;
    setConfirmRemoveId(selected.id);
  };

  const confirmDelete = () => {
    if (!confirmRemoveId) return;
    removeNote(confirmRemoveId);
    setConfirmRemoveId(null);
  };

  // ----- LOCK / UNLOCK ACTIONS ------------------------------------------

  const ensureMasterAvailable = useCallback(
    (intent: Exclude<PendingAction, null | 'view'>): CryptoKey | null => {
      const key = unlock.read();
      if (key) return key;
      if (!data.notesLock) {
        setSetupOpen(true);
        setPendingAction(intent);
        return null;
      }
      setUnlockPw('');
      setUnlockErr(null);
      setPendingAction(intent);
      setUnlockOpen(true);
      return null;
    },
    [unlock, data.notesLock],
  );

  const lockSelected = useCallback(async () => {
    if (!selected) return;
    const key = ensureMasterAvailable('lock');
    if (!key) return;
    setBusy(true);
    try {
      // Encrypt whatever the user is currently looking at (plaintext body for
      // an unlocked note, our local plaintext for a locked-and-decrypted note).
      const bodyToLock = selected.locked
        ? decrypted?.noteId === selected.id
          ? decrypted.body
          : selected.body
        : selected.body;
      const cipher = await encryptBodyWithMaster(key, bodyToLock);
      replaceNote({ ...selected, body: '', locked: true, cipher });
    } finally {
      setBusy(false);
    }
  }, [selected, decrypted, ensureMasterAvailable, replaceNote]);

  const unlockSelected = useCallback(async () => {
    if (!selected || !selected.cipher) return;
    const key = ensureMasterAvailable('unlock-selected');
    if (!key) return;
    setBusy(true);
    try {
      const body = await decryptBodyWithMaster(key, selected.cipher);
      if (body === null) {
        // The current master key doesn't match this ciphertext (would happen
        // if the user changed/regenerated their lock since this note was
        // last encrypted — shouldn't normally occur with our schema).
        setUnlockErr('That passphrase does not unlock this note.');
        setUnlockOpen(true);
        setPendingAction('unlock-selected');
        return;
      }
      replaceNote({ ...selected, body, locked: false, cipher: undefined });
      setDecrypted({ noteId: selected.id, body });
    } finally {
      setBusy(false);
    }
  }, [selected, ensureMasterAvailable, replaceNote]);

  const disableLocking = useCallback(async () => {
    if (!data.notesLock) return;
    const key = ensureMasterAvailable('disable-locking');
    if (!key) return;
    setBusy(true);
    setDisableErr(null);
    try {
      // Decrypt every locked note up-front so we don't partially clear the
      // lock state if one fails. If any decrypt returns null, abort the whole
      // operation and tell the user — that note would otherwise be lost.
      const lockedNotes = data.notes.filter((n) => n.locked && n.cipher);
      const decryptedPairs: { id: string; body: string }[] = [];
      for (const n of lockedNotes) {
        const body = await decryptBodyWithMaster(key, n.cipher!);
        if (body === null) {
          setDisableErr(
            `Could not decrypt the locked note "${n.title || PLACEHOLDER_TITLE}". Aborting — your data is unchanged.`,
          );
          return;
        }
        decryptedPairs.push({ id: n.id, body });
      }
      // One atomic write that drops the lock AND converts every locked note
      // back to plaintext. We bypass the per-note dispatchers here because
      // we need them to land in the same React state update.
      update((d) => {
        const lookup = new Map(decryptedPairs.map((p) => [p.id, p.body]));
        const nextNotes = d.notes.map((n) =>
          lookup.has(n.id)
            ? { ...n, body: lookup.get(n.id)!, locked: false, cipher: undefined, updatedAt: new Date().toISOString() }
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
  }, [data.notes, data.notesLock, ensureMasterAvailable, update, setNotesLock, unlock]);

  // ----- PASSPHRASE DIALOGS ---------------------------------------------

  const resumePending = useCallback(
    (intent: Exclude<PendingAction, null>) => {
      switch (intent) {
        case 'lock':
          void lockSelected();
          break;
        case 'unlock-selected':
          void unlockSelected();
          break;
        case 'disable-locking':
          setConfirmDisableLock(true);
          break;
        case 'view':
          // No further action — `useEffect` will decrypt the selected note
          // now that the master key is set.
          break;
      }
    },
    [lockSelected, unlockSelected],
  );

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
    setBusy(true);
    try {
      const { lock, masterKey } = await createNotesLock(a);
      setNotesLock(lock);
      unlock.remember(masterKey);
      setSetupOpen(false);
      setSetupPw1('');
      setSetupPw2('');
      const intent = pendingAction;
      setPendingAction(null);
      if (intent) resumePending(intent);
    } catch (e) {
      setSetupErr(e instanceof Error ? e.message : 'Could not set passphrase.');
    } finally {
      setBusy(false);
    }
  };

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
      const intent = pendingAction;
      setPendingAction(null);
      if (intent) resumePending(intent);
    } finally {
      setBusy(false);
    }
  };

  // Tap on a locked note in the sidebar → open the unlock dialog so we can
  // read it. Without this the user has to click "Unlock" inside the main
  // pane, which is a redundant extra step.
  useEffect(() => {
    if (!selected) return;
    if (!selected.locked) return;
    if (decrypted?.noteId === selected.id) return;
    if (unlock.read()) return;
    if (unlockOpen || setupOpen) return;
    // Don't auto-open the dialog if the user explicitly closed it; we re-arm
    // only when the selection changes. We track this implicitly via the
    // dependency list: when `selectedId` changes, we get exactly one chance
    // to open the dialog.
    setUnlockPw('');
    setUnlockErr(null);
    setPendingAction('view');
    setUnlockOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ----- RENDER ----------------------------------------------------------

  const hasLock = !!data.notesLock;

  return (
    <div className="notes-page">
      <aside className="notes-page__sidebar">
        <header className="notes-page__sidebar-header">
          <h2>Notes</h2>
          <div className="notes-page__sidebar-actions">
            {hasLock ? (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  setDisableErr(null);
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
                  <button type="button" className="btn btn--sm" onClick={unlockSelected} disabled={busy} title="Unlock note">
                    <IcLock size={14} /> Unlock
                  </button>
                ) : (
                  <button type="button" className="btn btn--sm" onClick={lockSelected} disabled={busy} title="Lock note">
                    <IcLock size={14} /> Lock
                  </button>
                )}
                <button type="button" className="btn btn--sm btn--danger" onClick={onDelete} title="Delete note">
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
                    <button type="button" className="btn btn--primary" onClick={unlockSelected}>
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
        <div className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-setup-title">
          <div className="ai-dialog__panel">
            <header className="ai-dialog__header">
              <h2 id="notes-setup-title">
                <IcLock size={18} /> Set a Notes passphrase
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setSetupOpen(false);
                  setPendingAction(null);
                  setSetupPw1('');
                  setSetupPw2('');
                  setSetupErr(null);
                }}
              >
                Cancel
              </button>
            </header>
            <div className="ai-dialog__body">
              <p>
                This passphrase is required to lock and unlock notes. It's <strong>different from your account
                password</strong> and is <strong>never stored on disk</strong> — only a verifier blob is saved, used to
                check whether the passphrase you type later is correct.
              </p>
              <p className="text-warn">
                If you forget this passphrase, locked notes <strong>cannot be recovered</strong>. There is no reset
                path on purpose — that's the whole point of at-rest encryption.
              </p>
              <label className="field">
                <span>Passphrase</span>
                <input
                  type="password"
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
                  value={setupPw2}
                  onChange={(e) => setSetupPw2(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitSetup();
                  }}
                />
              </label>
              {setupErr ? <p className="text-error">{setupErr}</p> : null}
            </div>
            <footer className="ai-dialog__footer">
              <button type="button" className="btn btn--primary" onClick={submitSetup} disabled={busy}>
                {busy ? 'Saving…' : 'Save passphrase'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {unlockOpen ? (
        <div className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-unlock-title">
          <div className="ai-dialog__panel">
            <header className="ai-dialog__header">
              <h2 id="notes-unlock-title">
                <IcLock size={18} /> Unlock notes
              </h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setUnlockOpen(false);
                  setPendingAction(null);
                  setUnlockPw('');
                  setUnlockErr(null);
                }}
              >
                Cancel
              </button>
            </header>
            <div className="ai-dialog__body">
              <p>Enter your Notes passphrase to view locked notes in this session.</p>
              <label className="field">
                <span>Passphrase</span>
                <input
                  type="password"
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
            </div>
            <footer className="ai-dialog__footer">
              <button type="button" className="btn btn--primary" onClick={submitUnlock} disabled={busy}>
                {busy ? 'Checking…' : 'Unlock'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {confirmRemoveId ? (
        <div className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-del-title">
          <div className="ai-dialog__panel">
            <header className="ai-dialog__header">
              <h2 id="notes-del-title">Delete note?</h2>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmRemoveId(null)}>
                Cancel
              </button>
            </header>
            <div className="ai-dialog__body">
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
            </div>
            <footer className="ai-dialog__footer">
              <button type="button" className="btn btn--danger" onClick={confirmDelete}>
                Delete
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {confirmDisableLock ? (
        <div className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-disable-title">
          <div className="ai-dialog__panel">
            <header className="ai-dialog__header">
              <h2 id="notes-disable-title">Remove the Notes passphrase?</h2>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setConfirmDisableLock(false);
                  setDisableErr(null);
                }}
              >
                Cancel
              </button>
            </header>
            <div className="ai-dialog__body">
              <p>
                This will decrypt every locked note back to plain text on disk and remove the workspace
                passphrase. After that, anyone who can open this file can read your notes.
              </p>
              <p className="text-warn">
                We will refuse to proceed if even one locked note fails to decrypt — your data will be left
                unchanged.
              </p>
              {disableErr ? <p className="text-error">{disableErr}</p> : null}
            </div>
            <footer className="ai-dialog__footer">
              <button type="button" className="btn btn--danger" onClick={disableLocking} disabled={busy}>
                {busy ? 'Decrypting…' : 'Remove passphrase'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
