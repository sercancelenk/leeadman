import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { IcDownload, IcLock, IcMoon, IcRefresh, IcSparkles, IcSun, IcTrash, IcUpload, IcWifi } from '../components/icons';
import { Button } from '../components/ui/Button';
import { useAppData } from '../AppDataContext';
import { useSession } from '../AuthContext';
import { askAI, AIError, defaultModel } from '../lib/ai';
import type { AIProvider, AppData } from '../model';
import { AI_PROVIDER_OPTIONS } from '../model';
import { useTheme } from '../ThemeContext';
import type { CacheBreakdownEntry, CacheStats, DataFileInfo, DataSources, SaveError } from '../vite-env';
import { CollapsibleCard } from '../components/ui/CollapsibleCard';

export function Settings() {
  const { data, replaceAll } = useAppData();
  const { theme, setTheme } = useTheme();
  const { pinEnabled, refresh: refreshSession, lockSession } = useSession();
  const [path, setPath] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [clearPin, setClearPin] = useState('');
  const [updaterOpen, setUpdaterOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const p = await window.leeadman?.userDataPath?.();
      if (p) setPath(p);
      const v = await window.leeadman?.getAppVersion?.();
      if (v) setAppVersion(v);
      await refreshSession();
    })();
  }, [refreshSession]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leeadman-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">Your data lives on this computer. Export a backup to keep it elsewhere.</p>
      </header>

      <CollapsibleCard id="appearance" title="Appearance">
        <p className="muted small">You can also toggle the theme from the top bar.</p>
        <div className="row">
          <Button
            type="button"
            variant={theme === 'dark' ? 'primary' : 'secondary'}
            icon={<IcMoon size={17} />}
            onClick={() => setTheme('dark')}
          >
            Dark
          </Button>
          <Button
            type="button"
            variant={theme === 'light' ? 'primary' : 'secondary'}
            icon={<IcSun size={17} />}
            onClick={() => setTheme('light')}
          >
            Light
          </Button>
        </div>
      </CollapsibleCard>

      <CollapsibleCard id="pin" title="PIN protection" badge={pinEnabled ? 'Enabled' : 'Disabled'}>
        <p className="muted">
          Adds a quick lock screen when Leeadman starts and when you choose <em>Lock now</em>. Useful when you step away from your desk so a passer-by can't open the app and read 1:1 notes.
        </p>
        <p className="muted small">
          The PIN is independent of your account password. Your data file is already encrypted at rest with a key derived from the account password — the PIN is purely a UI barrier in front of the unlocked workspace.
        </p>
        <p className="muted small">Status: {pinEnabled ? 'Enabled' : 'Disabled'}</p>
        {pinEnabled ? (
          <div className="row" style={{ marginTop: 8 }}>
            <Button type="button" variant="secondary" icon={<IcLock size={17} />} onClick={() => lockSession()}>
              Lock now
            </Button>
            <span className="muted small">Returns you to the PIN screen without quitting the app.</span>
          </div>
        ) : null}
        {!pinEnabled ? (
          <form
            className="row"
            style={{ marginTop: 10, flexDirection: 'column', alignItems: 'stretch' }}
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const a = newPin.trim();
              const b = newPin2.trim();
              if (a.length < 4 || a !== b) {
                window.alert('PIN must be at least 4 characters and both fields must match.');
                return;
              }
              // setPin runs a round-trip self-verify in the main process and
              // rolls back if the stored hash cannot reproduce the same PIN.
              // So a successful response here guarantees the lock screen will
              // accept the same characters the user just typed.
              const r = await window.leeadman?.authSetPin?.({ pin: a });
              if (r?.ok) {
                setNewPin('');
                setNewPin2('');
                // refreshSession() only updates the pinEnabled flag (the
                // current session stays unlocked). The next launch — or an
                // explicit "Lock now" click — is when the PIN screen appears.
                await refreshSession();
                window.alert(
                  'PIN saved. You will stay signed in for this session; the PIN screen appears the next time you launch the app (or if you click "Lock now"). If you ever lose it, you can reset it from the lock screen with your account password.',
                );
              } else {
                window.alert(r?.error ?? 'Could not save PIN.');
              }
            }}
          >
            <input className="input" type="password" placeholder="New PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            <input className="input" type="password" placeholder="Confirm PIN" value={newPin2} onChange={(e) => setNewPin2(e.target.value)} />
            <Button type="submit" variant="primary" icon={<IcLock size={17} />}>
              Create PIN
            </Button>
          </form>
        ) : (
          <form
            className="row"
            style={{ marginTop: 10, flexDirection: 'column', alignItems: 'stretch' }}
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const r = await window.leeadman?.authClear?.({ pin: clearPin.trim() });
              if (r?.ok) {
                setClearPin('');
                await refreshSession();
                window.alert('PIN removed.');
              } else {
                window.alert(r?.error ?? 'Incorrect PIN.');
              }
            }}
          >
            <input
              className="input"
              type="password"
              placeholder="Current PIN (to remove)"
              value={clearPin}
              onChange={(e) => setClearPin(e.target.value)}
            />
            <Button type="submit" variant="danger" icon={<IcTrash size={17} />}>
              Remove PIN protection
            </Button>
          </form>
        )}
      </CollapsibleCard>

      <CollapsibleCard id="version" title="Application version" defaultOpen={false} badge={appVersion || '—'}>
        <p>
          Installed version: <strong>{appVersion || '—'}</strong> · Data schema: v{data.version}
        </p>
      </CollapsibleCard>

      <CollapsibleCard id="updates" title="Auto updates (GitHub Releases)" defaultOpen={false}>
        <p className="muted">
          When the packaged app launches, it checks GitHub Releases for a newer version. You can also check on demand below — a dialog will guide you through download and restart.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <Button
            type="button"
            variant="secondary"
            icon={<IcRefresh size={17} />}
            onClick={() => setUpdaterOpen(true)}
          >
            Check for updates
          </Button>
        </div>
      </CollapsibleCard>

      <UpdaterDialog open={updaterOpen} onClose={() => setUpdaterOpen(false)} />

      <CollapsibleCard id="data-location" title="Data location (Electron)" defaultOpen={false}>
        {path ? <pre className="pre">{path}</pre> : <p className="muted">No Electron data path available; in the browser preview, data lives in localStorage.</p>}
        <p className="muted small">File name pattern: leeadman-data-&lt;userId&gt;.json</p>
      </CollapsibleCard>

      <CollapsibleCard id="backup" title="Backup">
        <div className="row">
          <Button type="button" variant="primary" icon={<IcDownload size={17} />} onClick={exportJson}>
            Export JSON
          </Button>
          <Button type="button" variant="secondary" icon={<IcUpload size={17} />} onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const text = await f.text();
                const parsed = JSON.parse(text) as AppData;
                replaceAll(parsed);
              } catch {
                window.alert('Could not read the file or the JSON is invalid.');
              }
            }}
          />
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          Importing replaces your existing data. Always export a backup first.
        </p>
      </CollapsibleCard>

      <BackupsRecoverySection />

      <StorageCacheSection />

      <SyncSection />

      <AISettingsSection />

      <CollapsibleCard id="reminders" title="Reminders" defaultOpen={false}>
        <p className="muted">
          The OS will request notification permission. Fill in the &quot;Reminder&quot; field on a task or note; a desktop notification will fire at the scheduled time
          (the same reminder will not repeat — adjusting the time can re-trigger it).
        </p>
      </CollapsibleCard>
    </div>
  );
}

type SyncStatus = {
  enabled: boolean;
  running: boolean;
  port: number | null;
  token: string | null;
  ips: string[];
};

function SyncSection() {
  const { data, replaceAll } = useAppData();
  const isElectronHost = typeof window !== 'undefined' && !!window.leeadman?.syncStatus;

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = async () => {
    if (!isElectronHost) return;
    const s = await window.leeadman!.syncStatus();
    setStatus(s);
  };

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await window.leeadman!.syncEnable();
      if (!r?.ok) window.alert(r?.error ?? 'Could not start sync server.');
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await window.leeadman!.syncDisable();
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      const r = await window.leeadman!.syncRotateToken();
      if (!r?.ok) window.alert('Could not rotate token.');
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  // Client-side pair form for the *current* device (mobile/PWA or another desktop).
  const [pairUrl, setPairUrl] = useState('');
  const [pairToken, setPairToken] = useState('');
  const [pairBusy, setPairBusy] = useState(false);
  const [pairMsg, setPairMsg] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null);

  // Normalise whatever the user typed into a canonical base URL.
  // Accepts: "192.168.1.5", "192.168.1.5:9787", "http://192.168.1.5",
  //          "http://192.168.1.5:9787/", "leeadman.local:9787".
  const sanitizedHost = useMemo(() => normalizeHostUrl(pairUrl), [pairUrl]);

  // Detect the dreaded mixed-content scenario: the renderer is loaded over
  // HTTPS (PWA on github.io) and the user is pointing it at an http:// host.
  // The browser will silently block the request — we make the failure
  // diagnosable up front instead.
  const isMixedContentBlocked = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol !== 'https:') return false;
    return !!sanitizedHost && sanitizedHost.startsWith('http://');
  }, [sanitizedHost]);

  // 12-second timeout for all LAN calls. The user feels the pain when their
  // phone is on another Wi-Fi network and fetch hangs for 30s.
  const fetchWithTimeout = (input: string, init: RequestInit, ms = 12_000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
  };

  const describeError = (
    label: 'Pull' | 'Push' | 'Test',
    err: unknown,
    resp?: Response,
  ): { kind: 'error'; text: string } => {
    if (resp && !resp.ok) {
      switch (resp.status) {
        case 401:
          return { kind: 'error', text: `${label} failed: token is incorrect or has been rotated on the host.` };
        case 503:
          return { kind: 'error', text: `${label} failed: no signed-in user on the host (open Leeadman there and log in first).` };
        case 404:
          return { kind: 'error', text: `${label} failed: host responded but doesn't speak Leeadman sync (404). Double-check the URL/port.` };
        default:
          return { kind: 'error', text: `${label} failed (HTTP ${resp.status}).` };
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    if ((err as DOMException)?.name === 'AbortError') {
      return {
        kind: 'error',
        text: `${label} timed out. Check that both devices are on the same Wi-Fi and the host server is running.`,
      };
    }
    if (isMixedContentBlocked) {
      return {
        kind: 'error',
        text: `${label} blocked: this page is served over HTTPS but the host is http://. Open the LAN URL the host shows (\"For mobile/PWA on this network\") in your browser and try again.`,
      };
    }
    return { kind: 'error', text: `${label} failed: ${msg}` };
  };

  const testReach = async () => {
    setPairMsg(null);
    if (!sanitizedHost) {
      setPairMsg({ kind: 'error', text: 'Enter a host URL first (e.g. http://192.168.1.5:9787).' });
      return;
    }
    if (isMixedContentBlocked) {
      setPairMsg({
        kind: 'error',
        text:
          'This page is served over HTTPS. Modern browsers block fetches to plain http:// hosts. Open the LAN URL shown on the host (e.g. http://192.168.1.5:9787/) in your mobile browser — that loads the PWA over HTTP and unlocks pairing.',
      });
      return;
    }
    setPairBusy(true);
    try {
      const resp = await fetchWithTimeout(`${sanitizedHost}/v1/ping`, { method: 'GET' }, 8_000);
      if (!resp.ok) {
        setPairMsg(describeError('Test', null, resp));
        return;
      }
      const j = await resp.json();
      if (j?.name !== 'leeadman-sync') {
        setPairMsg({
          kind: 'error',
          text: 'Reachable, but the responder is not a Leeadman sync server. Double-check the URL.',
        });
        return;
      }
      setPairMsg({
        kind: 'ok',
        text: 'Reachable. Try Pull from host — you\'ll get a 503 if no user is signed in on the host yet, or 401 if the token is wrong.',
      });
    } catch (err) {
      setPairMsg(describeError('Test', err));
    } finally {
      setPairBusy(false);
    }
  };

  const pull = async () => {
    setPairMsg(null);
    if (!sanitizedHost || !pairToken.trim()) {
      setPairMsg({ kind: 'error', text: 'Host URL and token are required.' });
      return;
    }
    if (isMixedContentBlocked) {
      setPairMsg({
        kind: 'error',
        text:
          'This page is HTTPS. Open the LAN URL the host displays (e.g. http://192.168.1.5:9787/) in your mobile browser and pair from there.',
      });
      return;
    }
    setPairBusy(true);
    try {
      const resp = await fetchWithTimeout(`${sanitizedHost}/v1/snapshot`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${pairToken.trim()}` },
      });
      if (!resp.ok) {
        setPairMsg(describeError('Pull', null, resp));
        return;
      }
      const json = await resp.json();
      const remote = json?.data;
      if (!remote || typeof remote !== 'object') {
        setPairMsg({ kind: 'error', text: 'Host returned no data.' });
        return;
      }
      replaceAll(remote);
      setPairMsg({ kind: 'ok', text: 'Pulled snapshot from host. Local data was replaced.' });
    } catch (err) {
      setPairMsg(describeError('Pull', err));
    } finally {
      setPairBusy(false);
    }
  };

  const push = async () => {
    setPairMsg(null);
    if (!sanitizedHost || !pairToken.trim()) {
      setPairMsg({ kind: 'error', text: 'Host URL and token are required.' });
      return;
    }
    if (isMixedContentBlocked) {
      setPairMsg({
        kind: 'error',
        text:
          'This page is HTTPS. Open the LAN URL the host displays (e.g. http://192.168.1.5:9787/) in your mobile browser and pair from there.',
      });
      return;
    }
    if (!window.confirm("This will overwrite the host's data with the data from this device. Continue?")) {
      return;
    }
    setPairBusy(true);
    try {
      const resp = await fetchWithTimeout(`${sanitizedHost}/v1/snapshot`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pairToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });
      if (!resp.ok) {
        setPairMsg(describeError('Push', null, resp));
        return;
      }
      setPairMsg({ kind: 'ok', text: 'Pushed local data to the host.' });
    } catch (err) {
      setPairMsg(describeError('Push', err));
    } finally {
      setPairBusy(false);
    }
  };

  const hostUrls = status?.ips?.length && status?.port
    ? status.ips.map((ip) => `http://${ip}:${status.port}`)
    : [];

  return (
    <CollapsibleCard
      id="sync"
      title="Multi-device sync (no cloud)"
      defaultOpen={false}
      badge={status?.running ? 'Running' : status?.enabled ? 'Stopped' : undefined}
    >
      <p className="muted">
        Keep two devices on the same Wi-Fi in sync without any cloud server. The desktop app
        runs a tiny HTTP server protected by a one-time token; another device (a second
        desktop, or the PWA when running over HTTP) pulls or pushes a snapshot directly.
        Nothing leaves your network.
      </p>

      {isElectronHost ? (
        <div className="card sync-host">
          <h3 style={{ margin: '0 0 8px' }}>This device as host</h3>
          {status ? (
            <>
              <p className="muted small">
                Status:{' '}
                <strong style={{ color: status.running ? 'var(--ok)' : 'var(--muted)' }}>
                  {status.running ? 'Running' : 'Stopped'}
                </strong>
                {status.port ? ` · port ${status.port}` : ''}
              </p>
              <div className="row" style={{ marginTop: 8 }}>
                {!status.enabled || !status.running ? (
                  <Button type="button" variant="primary" icon={<IcWifi size={17} />} onClick={enable} disabled={busy}>
                    Start sync server
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={disable} disabled={busy}>
                    Stop sync server
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={rotate} disabled={busy || !status.enabled}>
                  Rotate token
                </Button>
              </div>
              {status.token ? (
                <div className="sync-host__details">
                  <div className="field">
                    <span>Pairing token</span>
                    <input className="input" readOnly value={status.token} onFocus={(e) => e.currentTarget.select()} />
                  </div>
                  {hostUrls.length > 0 ? (
                    <>
                      <div className="field">
                        <span>For mobile or PWA on this network — open this URL in the browser</span>
                        {hostUrls.map((u) => (
                          <div className="row" key={`pwa-${u}`} style={{ alignItems: 'stretch', gap: 6 }}>
                            <input
                              className="input"
                              readOnly
                              value={`${u}/`}
                              onFocus={(e) => e.currentTarget.select()}
                              style={{ flex: 1 }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                  void navigator.clipboard.writeText(`${u}/`);
                                }
                              }}
                              title="Copy"
                            >
                              Copy
                            </Button>
                          </div>
                        ))}
                        <p className="muted small" style={{ marginTop: 6 }}>
                          The PWA is also bundled on this port — opening these from the mobile browser loads it over
                          HTTP from this device, sidestepping the HTTPS-blocks-HTTP mixed-content rule that breaks
                          github.io ↔ LAN pairing.
                        </p>
                      </div>
                      <div className="field">
                        <span>API base (for another desktop Leeadman)</span>
                        {hostUrls.map((u) => (
                          <input
                            key={`api-${u}`}
                            className="input"
                            readOnly
                            value={u}
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">Loading status…</p>
          )}
        </div>
      ) : null}

      <div className="card sync-client">
        <h3 style={{ margin: '0 0 8px' }}>Pair with another device</h3>
        <p className="muted small" style={{ marginTop: 0 }}>
          Open Settings on the host device, copy the reachable URL and token, then paste them here.
        </p>

        {isMixedContentBlocked ? (
          <div className="sync-warning" role="alert">
            <strong>Mixed-content block detected.</strong> This page is served over <code>https://</code> but the host
            is <code>http://</code>. Browsers refuse to fetch across that boundary — that's exactly the &quot;Pull
            failed&quot; you'd see otherwise.
            <p style={{ margin: '8px 0 0' }}>
              <strong>Fix:</strong> on the host (the desktop running Leeadman), copy the LAN URL it shows under{' '}
              <em>This device as host → For mobile or PWA on this network</em> (e.g. <code>http://192.168.1.5:9787/</code>)
              and open <strong>that</strong> URL in your mobile browser. It loads the same Leeadman PWA over plain
              HTTP from the host, so pairing then just works.
            </p>
          </div>
        ) : null}

        <form
          className="profile-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void pull();
          }}
        >
          <label className="field">
            <span>Host URL (e.g. http://192.168.1.5:9787)</span>
            <input
              className="input"
              type="url"
              placeholder="http://192.168.1.5:9787"
              value={pairUrl}
              onChange={(e) => setPairUrl(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {pairUrl && sanitizedHost && sanitizedHost !== pairUrl.trim().replace(/\/+$/, '') ? (
              <span className="muted small" style={{ marginTop: 4 }}>
                Will use: <code>{sanitizedHost}</code>
              </span>
            ) : null}
          </label>
          <label className="field">
            <span>Token</span>
            <input
              className="input"
              type="password"
              placeholder="Paste pairing token"
              value={pairToken}
              onChange={(e) => setPairToken(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <Button type="button" variant="ghost" onClick={() => void testReach()} disabled={pairBusy}>
              Test reachability
            </Button>
            <Button type="button" variant="secondary" onClick={push} disabled={pairBusy}>
              Push to host
            </Button>
            <Button type="submit" variant="primary" disabled={pairBusy}>
              {pairBusy ? 'Working…' : 'Pull from host'}
            </Button>
          </div>
          {pairMsg ? (
            <p
              className={`form-msg small ${pairMsg.kind === 'ok' ? 'form-msg--ok' : pairMsg.kind === 'error' ? 'form-msg--err' : ''}`}
            >
              {pairMsg.text}
            </p>
          ) : null}
        </form>
      </div>

      <details className="muted" style={{ marginTop: 8 }}>
        <summary>Why no cloud / drive?</summary>
        <p style={{ marginTop: 8 }}>
          A real "no-cloud" cross-device sync needs a side channel. The options without a server are:
        </p>
        <ol>
          <li>
            <strong>Same-network HTTP</strong> (this section): the host runs a local server on
            your Wi-Fi and the second device fetches from it. No cloud, no drive — but both
            devices must be online together at sync time.
          </li>
          <li>
            <strong>Encrypted file export / import</strong>: ship the JSON via AirDrop / email
            attachment / USB. Manual but offline.
          </li>
          <li>
            <strong>WebRTC peer-to-peer</strong>: requires a tiny signalling rendezvous service,
            so it isn't truly server-free.
          </li>
        </ol>
        <p>
          Browsers block plain-HTTP requests from HTTPS pages, so for the PWA you'll either need
          to open it over <code>http://</code> on the local network or run the desktop app on
          both endpoints.
        </p>
      </details>
    </CollapsibleCard>
  );
}

type UpdaterPhase =
  | { kind: 'checking' }
  | { kind: 'available'; version?: string }
  | { kind: 'downloading'; percent: number; transferred: number; total: number }
  | { kind: 'downloaded'; version?: string }
  | { kind: 'not-available'; version?: string }
  | { kind: 'dev' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message?: string };

function UpdaterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<UpdaterPhase>({ kind: 'checking' });
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!open) return;
    const api = window.leeadman;
    if (!api?.onUpdaterEvent || !api?.checkForUpdates) {
      setPhase({ kind: 'unsupported' });
      return;
    }
    setPhase({ kind: 'checking' });
    setInstalling(false);

    const off = api.onUpdaterEvent((e) => {
      switch (e.status) {
        case 'checking':
          setPhase({ kind: 'checking' });
          break;
        case 'available':
          setPhase({ kind: 'available', version: e.version });
          break;
        case 'downloading':
          setPhase({
            kind: 'downloading',
            percent: e.percent,
            transferred: e.transferred,
            total: e.total,
          });
          break;
        case 'downloaded':
          setPhase({ kind: 'downloaded', version: e.version });
          break;
        case 'not-available':
          setPhase({ kind: 'not-available', version: e.version });
          break;
        case 'error':
          setPhase({ kind: 'error', message: e.message });
          break;
      }
    });

    void (async () => {
      const r = await api.checkForUpdates?.();
      if (r && !r.ok) {
        if (r.reason === 'dev') setPhase({ kind: 'dev' });
        else setPhase({ kind: 'error', message: r.error || 'Update check failed.' });
      }
    })();

    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      off?.();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const installNow = async () => {
    setInstalling(true);
    const r = await window.leeadman?.installUpdate?.();
    if (!r?.ok) {
      setInstalling(false);
      window.alert(r?.error ?? 'Could not install the update.');
    }
  };

  return (
    <div className="updater-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="updater-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="updater-dialog__title">App update</h3>

        {phase.kind === 'checking' && (
          <p className="muted">Checking GitHub Releases for a newer version…</p>
        )}

        {phase.kind === 'available' && (
          <>
            <p>
              A newer version
              {phase.version ? <> (<strong>v{phase.version}</strong>)</> : ''} is available.
              Downloading now…
            </p>
            <div className="progress" style={{ width: '100%' }}>
              <div className="progress__bar" style={{ width: '6%' }} />
            </div>
          </>
        )}

        {phase.kind === 'downloading' && (
          <>
            <p>Downloading the update…</p>
            <div className="progress" style={{ width: '100%' }}>
              <div className="progress__bar" style={{ width: `${Math.max(2, Math.round(phase.percent))}%` }} />
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              {Math.round(phase.percent)}%
              {phase.total > 0
                ? ` · ${(phase.transferred / 1024 / 1024).toFixed(1)} / ${(phase.total / 1024 / 1024).toFixed(1)} MB`
                : ''}
            </p>
          </>
        )}

        {phase.kind === 'downloaded' && (
          <>
            <p>
              Update{phase.version ? <> <strong>v{phase.version}</strong></> : ''} is ready to install.
            </p>
            <p className="muted small">
              The app will quit, swap in the new version, and relaunch automatically.
            </p>
            <div className="updater-dialog__actions">
              <Button type="button" variant="secondary" onClick={onClose} disabled={installing}>Later</Button>
              <Button type="button" variant="primary" onClick={installNow} disabled={installing}>
                {installing ? 'Installing…' : 'Install & restart'}
              </Button>
            </div>
          </>
        )}

        {phase.kind === 'not-available' && (
          <>
            <p>
              You're on the latest version
              {phase.version ? <> (<strong>v{phase.version}</strong>)</> : ''}.
            </p>
            <div className="updater-dialog__actions">
              <Button type="button" variant="primary" onClick={onClose}>OK</Button>
            </div>
          </>
        )}

        {phase.kind === 'dev' && (
          <>
            <p>Update checks are disabled in development mode.</p>
            <p className="muted small">
              Run a packaged build to receive auto-updates from GitHub Releases.
            </p>
            <div className="updater-dialog__actions">
              <Button type="button" variant="primary" onClick={onClose}>OK</Button>
            </div>
          </>
        )}

        {phase.kind === 'unsupported' && (
          <>
            <p>Auto-updates are only available in the packaged desktop app.</p>
            <div className="updater-dialog__actions">
              <Button type="button" variant="primary" onClick={onClose}>OK</Button>
            </div>
          </>
        )}

        {phase.kind === 'error' && (
          <>
            <p>Something went wrong while checking for updates.</p>
            {phase.message ? (
              <pre className="pre" style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{phase.message}</pre>
            ) : null}
            <div className="updater-dialog__actions">
              <Button type="button" variant="primary" onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Bring-your-own-key AI settings. The key lives in AppData (encrypted at rest
 * in Electron, plaintext in PWA localStorage — we say so explicitly). All API
 * calls run from the renderer; we never proxy through any of our own servers.
 */
function AISettingsSection() {
  const { data, updateAISettings } = useAppData();
  const ai = data.aiSettings;
  const [provider, setProvider] = useState<AIProvider | ''>(ai?.provider ?? '');
  const [apiKey, setApiKey] = useState(ai?.apiKey ?? '');
  const [model, setModel] = useState(ai?.model ?? '');
  const [showKey, setShowKey] = useState(false);
  const [savedAt, setSavedAt] = useState<string>('');
  const [testStatus, setTestStatus] = useState<{ kind: 'idle' | 'running' | 'ok' | 'error'; message?: string }>({
    kind: 'idle',
  });

  // Re-sync local state when the underlying AppData changes (e.g. after replaceAll on import).
  useEffect(() => {
    setProvider(ai?.provider ?? '');
    setApiKey(ai?.apiKey ?? '');
    setModel(ai?.model ?? '');
  }, [ai?.provider, ai?.apiKey, ai?.model]);

  const placeholderModel = useMemo(() => (provider ? defaultModel(provider) : ''), [provider]);
  const modelExamples = useMemo(
    () => (provider ? AI_PROVIDER_OPTIONS.find((p) => p.value === provider)?.modelExamples ?? [] : []),
    [provider],
  );
  // Gemini 1.x was retired from v1beta in late 2025; surface a one-click fix
  // for users who still have the old name saved.
  const modelIsRetiredGemini = provider === 'gemini' && /^gemini-1\.[05]/i.test(model.trim());
  const dirty =
    (ai?.provider ?? '') !== provider ||
    (ai?.apiKey ?? '') !== apiKey.trim() ||
    (ai?.model ?? '') !== model.trim();
  const canSave = !!provider && apiKey.trim().length >= 8;

  const save = () => {
    updateAISettings({
      provider: (provider || undefined) as AIProvider | undefined,
      apiKey: apiKey.trim(),
      model: model.trim(),
    });
    setSavedAt(new Date().toLocaleTimeString());
    setTestStatus({ kind: 'idle' });
  };

  const remove = () => {
    if (!window.confirm('Remove the stored API key from this device?')) return;
    updateAISettings({ provider: undefined, apiKey: '', model: '', systemPrompt: '' });
    setProvider('');
    setApiKey('');
    setModel('');
    setSavedAt('');
    setTestStatus({ kind: 'idle' });
  };

  const test = async () => {
    if (!provider || apiKey.trim().length < 8) return;
    setTestStatus({ kind: 'running' });
    try {
      const reply = await askAI({
        settings: {
          provider: provider as AIProvider,
          apiKey: apiKey.trim(),
          model: model.trim(),
        },
        messages: [
          {
            role: 'user',
            content: 'Reply with the single word "ok" so I can confirm the connection works.',
          },
        ],
        maxOutputTokens: 32,
      });
      setTestStatus({
        kind: 'ok',
        message: `Connection works. Provider answered: "${reply.replace(/\s+/g, ' ').slice(0, 80)}"`,
      });
    } catch (err) {
      const message = err instanceof AIError ? err.message : (err as Error)?.message ?? String(err);
      setTestStatus({ kind: 'error', message });
    }
  };

  const isDesktop = typeof window !== 'undefined' && !!window.leeadman;

  return (
    <CollapsibleCard
      id="ai"
      title={
        <>
          <IcSparkles size={17} /> AI Assistant
        </>
      }
      defaultOpen={false}
      badge={ai?.apiKey ? `Configured · ${ai?.provider ?? ''}` : 'Not configured'}
    >
      <p className="muted">
        Each task gets an "Ask AI" button when you connect a provider here. The assistant uses your API key to suggest
        next steps for whatever you're working on. We never proxy these requests — they go straight from this device
        to the provider you choose.
      </p>
      <p className="muted small">
        {isDesktop
          ? 'Desktop build: your API key is stored inside the encrypted data file (AES-256-GCM, derived from your account password).'
          : 'Web build: your API key is stored in this browser only (localStorage, not encrypted). Use a low-budget key with usage limits.'}
      </p>

      <label className="field">
        <span>Provider</span>
        <select
          className="input"
          value={provider}
          onChange={(e) => setProvider(e.target.value as AIProvider | '')}
        >
          <option value="">— Disabled —</option>
          {AI_PROVIDER_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>API key</span>
        <div className="row" style={{ gap: 6 }}>
          <input
            className="input"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="sk-…   /   AIza…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="button" variant="ghost" onClick={() => setShowKey((v) => !v)}>
            {showKey ? 'Hide' : 'Show'}
          </Button>
        </div>
      </label>

      <label className="field">
        <span>Model {placeholderModel ? <em className="muted">(default: {placeholderModel})</em> : null}</span>
        <input
          className="input"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholderModel || 'Choose a provider first'}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        {modelExamples.length > 0 ? (
          <span className="muted small" style={{ marginTop: 4, display: 'block' }}>
            Suggested: {modelExamples.map((m, i) => (
              <span key={m}>
                <button
                  type="button"
                  className="auth-link auth-link--inline"
                  onClick={() => setModel(m)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  {m}
                </button>
                {i < modelExamples.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        ) : null}
        {modelIsRetiredGemini ? (
          <span
            className="small"
            style={{
              marginTop: 6,
              display: 'block',
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid var(--danger)',
              color: 'var(--text)',
            }}
          >
            Heads up: Gemini 1.x models were retired by Google in late 2025 and will return HTTP 404. Click{' '}
            <button
              type="button"
              className="auth-link auth-link--inline"
              onClick={() => setModel('gemini-2.0-flash')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
            >
              gemini-2.0-flash
            </button>{' '}
            to switch to the current GA model.
          </span>
        ) : null}
      </label>

      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Button type="button" variant="primary" disabled={!canSave || !dirty} onClick={save}>
          Save
        </Button>
        <Button
          type="button"
          variant="secondary"
          icon={<IcRefresh size={16} />}
          disabled={!canSave || testStatus.kind === 'running'}
          onClick={test}
        >
          {testStatus.kind === 'running' ? 'Testing…' : 'Test connection'}
        </Button>
        {ai?.apiKey ? (
          <Button type="button" variant="ghost" icon={<IcTrash size={16} />} onClick={remove}>
            Remove key
          </Button>
        ) : null}
        {savedAt ? <span className="muted small">Saved at {savedAt}</span> : null}
      </div>

      {testStatus.kind === 'ok' && testStatus.message ? (
        <p className="muted small" style={{ marginTop: 8, color: 'var(--ok, #6cf38d)' }}>
          {testStatus.message}
        </p>
      ) : null}
      {testStatus.kind === 'error' && testStatus.message ? (
        <pre
          className="pre"
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 8,
            background: 'rgba(255,99,99,0.12)',
            color: '#ff8d8d',
            whiteSpace: 'pre-wrap',
            maxHeight: 160,
            overflow: 'auto',
          }}
        >
          {testStatus.message}
        </pre>
      ) : null}
    </CollapsibleCard>
  );
}

// ---------- Backups & Recovery -----------------------------------------------
//
// Lists every place on disk where the user's data might still be (live file,
// rolling backups, legacy single-user file, orphaned per-user files from a
// previous account UUID). Lets the user preview a candidate and restore it
// into the live file. Every restore takes a "pre-restore" snapshot of the
// current state so the operation is itself undoable.

function BackupsRecoverySection() {
  const { reload } = useAppData();
  const isElectron = typeof window !== 'undefined' && !!window.leeadman?.dataListSources;
  const [sources, setSources] = useState<DataSources | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saveError, setSaveError] = useState<SaveError | null>(null);

  const refresh = async () => {
    if (!isElectron) return;
    setBusy(true);
    try {
      const r = await window.leeadman!.dataListSources!();
      setSources(r);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    if (!window.leeadman?.onSaveError) return;
    const off = window.leeadman.onSaveError((e) => setSaveError(e));
    return off;
  }, []);

  if (!isElectron) {
    return (
      <CollapsibleCard id="backups" title="Backups & recovery" defaultOpen={false}>
        <p className="muted">
          This panel is only available in the desktop app. In the browser preview, your data lives in the browser&apos;s
          local storage and is automatically cleared if you switch browsers or use private mode.
        </p>
      </CollapsibleCard>
    );
  }

  const restore = async (filePath: string, label: string) => {
    if (!window.confirm(`Restore data from "${label}"?\n\nYour current data will be snapshotted first so you can undo this.`)) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await window.leeadman!.dataRestoreFromSource!({ filePath });
      if (r.ok) {
        setMsg({ kind: 'ok', text: `Restored from ${r.restoredFrom ?? label}. Reloading…` });
        await reload();
        await refresh();
      } else {
        setMsg({ kind: 'error', text: r.error || 'Restore failed.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const openFolder = async () => {
    await window.leeadman?.openUserDataFolder?.();
  };

  const totalSnapshots = sources?.backups.length ?? 0;

  return (
    <CollapsibleCard
      id="backups"
      title="Backups & recovery"
      defaultOpen={false}
      badge={sources ? `${totalSnapshots} snapshot${totalSnapshots === 1 ? '' : 's'}` : undefined}
    >
      <p className="muted small" style={{ marginBottom: 12 }}>
        Leeadman snapshots your data file every time it saves, after every sign-in, and at app launch. If something looks
        wrong (e.g. your data appeared empty after an update), you can restore from any snapshot below — your <em>current</em>
        state is always backed up first, so this is reversible.
      </p>

      {saveError ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid var(--danger)',
            background: 'rgba(220, 38, 38, 0.08)',
            borderRadius: 8,
            color: 'var(--text)',
          }}
        >
          <strong>Heads up:</strong> Leeadman refused to overwrite your data file because it cannot be decrypted with the
          current session key. Your data is still on disk — pick a recent backup below and restore it.
          <div className="muted small" style={{ marginTop: 4 }}>
            Reason: {saveError.reason ?? 'unknown'}
            {saveError.error ? ` — ${saveError.error}` : ''}
          </div>
        </div>
      ) : null}

      <div className="row" style={{ marginBottom: 12 }}>
        <Button type="button" variant="secondary" icon={<IcRefresh size={16} />} onClick={refresh} disabled={busy}>
          Refresh
        </Button>
        <Button type="button" variant="ghost" onClick={openFolder}>
          Open data folder
        </Button>
      </div>

      {msg ? (
        <p
          className="small"
          style={{
            marginBottom: 12,
            color: msg.kind === 'ok' ? 'var(--ok)' : 'var(--danger)',
          }}
        >
          {msg.text}
        </p>
      ) : null}

      {sources ? (
        <>
          <DataSourceRow
            label="Current data file"
            sub="The live file the app reads from."
            info={sources.live}
            onRestore={null}
          />
          <DataSourceRow
            label="Legacy single-user file (leeadman-data.json)"
            sub="From the pre-accounts version of Leeadman. Restoring imports it into your current account."
            info={sources.legacy}
            onRestore={(f) => restore(f, 'legacy data file')}
          />

          {sources.backups.length > 0 ? (
            <>
              <h3 style={{ fontSize: 14, marginTop: 18, marginBottom: 8 }}>Automatic snapshots</h3>
              {sources.backups.map((b) => (
                <DataSourceRow
                  key={b.path}
                  info={b}
                  label={b.name}
                  sub={`${formatBytes(b.bytes)} · ${formatRelativeTime(b.mtime)}`}
                  onRestore={(f) => restore(f, b.name)}
                />
              ))}
            </>
          ) : (
            <p className="muted small" style={{ marginTop: 12 }}>
              No automatic snapshots yet. The next save will create one.
            </p>
          )}

          {sources.otherUsers.length > 0 ? (
            <>
              <h3 style={{ fontSize: 14, marginTop: 18, marginBottom: 8 }}>Other accounts on this machine</h3>
              <p className="muted small" style={{ marginBottom: 8 }}>
                Data files that belong to a different user ID on this computer. Useful if you registered twice by mistake.
              </p>
              {sources.otherUsers.map((o) => (
                <DataSourceRow
                  key={o.path}
                  info={o}
                  label={o.name}
                  sub={`${formatBytes(o.bytes)} · ${formatRelativeTime(o.mtime)}`}
                  onRestore={(f) => restore(f, o.name)}
                />
              ))}
            </>
          ) : null}
        </>
      ) : (
        <p className="muted small">Loading…</p>
      )}
    </CollapsibleCard>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Storage & cache
// ────────────────────────────────────────────────────────────────────────
// Honest, read-only picture of what Leeadman occupies on disk plus a
// **safe** cache-wipe button. The wipe ONLY touches Chromium-managed
// caches (HTTP cache, V8 code cache, GPU/shader caches) — never your
// tasks, notes, AI keys, backups or account list.

function StorageCacheSection() {
  const isElectron =
    typeof window !== 'undefined' && !!window.leeadman?.cacheStats && !!window.leeadman?.clearChromiumCache;
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [swStatus, setSwStatus] = useState<'idle' | 'reloading'>('idle');

  const refresh = async () => {
    if (!isElectron) return;
    setBusy(true);
    try {
      const r = await window.leeadman!.cacheStats!();
      setStats(r);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const clearCache = async () => {
    if (!isElectron) return;
    if (
      !window.confirm(
        'Clear browser-engine caches?\n\n• HTTP cache, code cache, GPU/shader caches\n• Tasks, notes, AI keys, backups and account list are NOT affected.\n\nYou may need to wait a few seconds the next time the app fetches a page or recompiles JS.',
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await window.leeadman!.clearChromiumCache!();
      if (r.ok) {
        setMsg({
          kind: 'ok',
          text: `Cleared. Chromium caches now use ${formatBytes(r.chromiumBytes)}.`,
        });
        await refresh();
      } else {
        setMsg({ kind: 'error', text: r.error || 'Clear failed.' });
      }
    } catch (err) {
      setMsg({ kind: 'error', text: String(err) });
    } finally {
      setBusy(false);
    }
  };

  const reloadPwaCache = async () => {
    setSwStatus('reloading');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // A clean reload picks up the next-version service worker on its first
      // navigation. We bypass the HTTP cache to be safe.
      window.location.reload();
    } catch {
      setSwStatus('idle');
    }
  };

  return (
    <CollapsibleCard
      id="storage"
      title="Storage & cache"
      defaultOpen={false}
      badge={stats && stats.ok ? formatBytes(stats.totalBytes) : undefined}
    >
      <p className="muted small" style={{ marginBottom: 12 }}>
        How much disk Leeadman uses on this device, and a safe way to reclaim space. Your tasks, notes, AI keys and
        backups are <strong>never</strong> touched by the cache buttons below.
      </p>

      {!isElectron ? (
        <>
          <p className="muted small">
            Disk diagnostics are only available in the desktop app. The PWA stores everything in this browser&apos;s
            local storage (tiny — a few KB at most).
          </p>
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="secondary"
              icon={<IcRefresh size={16} />}
              onClick={() => void reloadPwaCache()}
              disabled={swStatus === 'reloading'}
            >
              {swStatus === 'reloading' ? 'Reloading…' : 'Reload web assets'}
            </Button>
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            Use this if the app feels &quot;stuck&quot; on an old version. It re-registers the service worker and
            refreshes the page; your saved data and AI key are kept.
          </p>
        </>
      ) : stats && stats.ok ? (
        <>
          <ul className="cache-stats">
            <CacheRow label="Encrypted data file" bytes={stats.dataFileBytes} hint="Your tasks, notes, AI key. Never touched by cache buttons." />
            {stats.legacyBytes > 0 ? (
              <CacheRow label="Legacy data file" bytes={stats.legacyBytes} hint="Pre-accounts era single-user file. Kept until you delete it manually." />
            ) : null}
            <CacheRow
              label={`Backups · ${stats.backupsSelfCount} snapshot${stats.backupsSelfCount === 1 ? '' : 's'}`}
              bytes={stats.backupsSelfBytes}
              hint="Rolling 50-snapshot safety net. Auto-pruned."
            />
            {stats.backupsAllBytes !== stats.backupsSelfBytes ? (
              <CacheRow
                label="Backups (other accounts)"
                bytes={stats.backupsAllBytes - stats.backupsSelfBytes}
                hint="Backups for other accounts that exist on this machine."
              />
            ) : null}
            <CacheRow
              label="Browser-engine caches (Chromium)"
              bytes={stats.chromiumBytes}
              hint="HTTP / code / GPU / shader caches. Safe to clear; will repopulate as needed."
              breakdown={stats.chromiumBreakdown}
            />
            <CacheRow label="Total userData folder" bytes={stats.totalBytes} emphasis hint={stats.userDataPath} />
          </ul>

          {msg ? (
            <div
              className="cache-msg"
              role={msg.kind === 'error' ? 'alert' : 'status'}
              data-kind={msg.kind}
            >
              {msg.text}
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <Button type="button" variant="secondary" icon={<IcRefresh size={16} />} onClick={refresh} disabled={busy}>
              Refresh sizes
            </Button>
            <Button
              type="button"
              variant="danger"
              icon={<IcTrash size={16} />}
              onClick={() => void clearCache()}
              disabled={busy || stats.chromiumBytes === 0}
              title={stats.chromiumBytes === 0 ? 'Nothing to clear' : undefined}
            >
              Clear browser caches
            </Button>
          </div>

          <p className="muted small" style={{ marginTop: 10 }}>
            Want to see the folder yourself? Use <strong>Backups &amp; recovery → Open data folder</strong> above.
          </p>
        </>
      ) : stats && !stats.ok ? (
        <p className="muted small" style={{ color: 'var(--danger)' }}>Couldn&apos;t read sizes: {stats.error}</p>
      ) : (
        <p className="muted small">Calculating sizes…</p>
      )}
    </CollapsibleCard>
  );
}

function CacheRow({
  label,
  bytes,
  hint,
  emphasis,
  breakdown,
}: {
  label: string;
  bytes: number;
  hint?: string;
  emphasis?: boolean;
  breakdown?: CacheBreakdownEntry[];
}) {
  const meaningfulBreakdown = (breakdown ?? []).filter((b) => b.bytes > 0);
  return (
    <li className={`cache-row${emphasis ? ' cache-row--emphasis' : ''}`}>
      <div className="cache-row__main">
        <span className="cache-row__label">{label}</span>
        <span className="cache-row__bytes">{formatBytes(bytes)}</span>
      </div>
      {hint ? <div className="cache-row__hint muted small">{hint}</div> : null}
      {meaningfulBreakdown.length > 0 ? (
        <details className="cache-row__details">
          <summary className="muted small">Breakdown</summary>
          <ul>
            {meaningfulBreakdown.map((b) => (
              <li key={b.label}>
                <span>{b.label}</span>
                <span className="muted small">{formatBytes(b.bytes)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function DataSourceRow({
  info,
  label,
  sub,
  onRestore,
}: {
  info: DataFileInfo | null;
  label: string;
  sub?: string;
  onRestore: ((filePath: string) => void) | null;
}) {
  if (!info) {
    return (
      <div className="list__row" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div className="muted small">Not present on this machine.</div>
        </div>
      </div>
    );
  }
  const c = info.counts;
  const dataSummary = c
    ? [
        c.teams ? `${c.teams} team${c.teams === 1 ? '' : 's'}` : null,
        c.people ? `${c.people} people` : null,
        c.items ? `${c.items} items` : null,
        c.todoGroups ? `${c.todoGroups} lists` : null,
        c.todoItems ? `${c.todoItems} tasks` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'empty'
    : info.encrypted && !info.decryptable
    ? 'encrypted (cannot decrypt with current password)'
    : info.error
    ? `error: ${info.error}`
    : 'unreadable';

  return (
    <div className="list__row" style={{ marginBottom: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{label}</div>
        {sub ? <div className="muted small">{sub}</div> : null}
        <div className="muted small" style={{ marginTop: 4 }}>
          {dataSummary}
          {info.encrypted ? ' · encrypted' : ''}
          {info.bytes != null ? ` · ${formatBytes(info.bytes)}` : ''}
        </div>
      </div>
      {onRestore ? (
        <Button
          type="button"
          variant="secondary"
          icon={<IcUpload size={16} />}
          onClick={() => onRestore(info.path)}
          disabled={info.encrypted && !info.decryptable}
        >
          Restore
        </Button>
      ) : (
        <span className="muted small">live</span>
      )}
    </div>
  );
}

function normalizeHostUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  // Strip protocol-relative `//`
  if (s.startsWith('//')) s = s.slice(2);
  // Default to http:// for LAN hosts.
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  try {
    const u = new URL(s);
    // Default the LAN sync port if missing.
    if (!u.port && (u.protocol === 'http:' || u.protocol === 'https:')) {
      u.port = '9787';
    }
    // Drop trailing slash so we can append `/v1/...` cleanly.
    let out = u.toString();
    if (out.endsWith('/')) out = out.slice(0, -1);
    return out;
  } catch {
    return '';
  }
}

function formatBytes(bytes: number | undefined) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRelativeTime(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleString();
}
