const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

/** Eski tek dosya (sürüm öncesi); isteğe bağlı taşıma için */
const LEGACY_DATA_FILENAME = 'leeadman-data.json';
const ACCOUNTS_FILENAME = 'leeadman-accounts.json';
const SESSION_FILENAME = 'leeadman-session.json';

function legacyDataPath() {
  return path.join(app.getPath('userData'), LEGACY_DATA_FILENAME);
}

function dataPathForUser(userId) {
  return path.join(app.getPath('userData'), `leeadman-data-${userId}.json`);
}

function accountsPath() {
  return path.join(app.getPath('userData'), ACCOUNTS_FILENAME);
}

function sessionPath() {
  return path.join(app.getPath('userData'), SESSION_FILENAME);
}

function authPath() {
  return path.join(app.getPath('userData'), 'auth-lock.json');
}

function hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(String(pin), salt, 64);
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(String(password), salt, 64);
}

function readAuth() {
  try {
    const p = authPath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readSessionUserId() {
  try {
    const p = sessionPath();
    if (!fs.existsSync(p)) return null;
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof o.userId === 'string' && o.userId ? o.userId : null;
  } catch {
    return null;
  }
}

function writeSession(userId) {
  const p = sessionPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ userId }, null, 2), 'utf8');
}

function clearSession() {
  try {
    const p = sessionPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function readAccounts() {
  try {
    const p = accountsPath();
    if (!fs.existsSync(p)) return { users: [] };
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { users: Array.isArray(o.users) ? o.users : [] };
  } catch {
    return { users: [] };
  }
}

function writeAccounts(data) {
  const p = accountsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    title: 'Leeadman',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.error('[leeadman] auto-updater yüklenemedi', e);
  }
}

ipcMain.handle('data:load', () => {
  const uid = readSessionUserId();
  if (!uid) return null;
  const p = dataPathForUser(uid);
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch {
    /* ignore */
  }
  return null;
});

ipcMain.handle('data:save', (_evt, payload) => {
  const uid = readSessionUserId();
  if (!uid) return false;
  const p = dataPathForUser(uid);
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('app:showNotification', (_evt, { title, body }) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title: title || 'Leeadman', body: body || '' });
  n.show();
  return true;
});

ipcMain.handle('app:userDataPath', () => app.getPath('userData'));

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('app:checkUpdates', () => {
  if (!app.isPackaged) return { ok: false, reason: 'dev' };
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('auth:status', () => {
  return { enabled: fs.existsSync(authPath()) };
});

ipcMain.handle('auth:setPin', (_evt, { pin }) => {
  if (typeof pin !== 'string' || pin.length < 4) return { ok: false, error: 'PIN en az 4 karakter olmalı.' };
  const salt = crypto.randomBytes(16).toString('hex');
  const hashBuf = hashPin(pin, salt);
  const hash = hashBuf.toString('hex');
  fs.mkdirSync(path.dirname(authPath()), { recursive: true });
  fs.writeFileSync(authPath(), JSON.stringify({ salt, hash }, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('auth:verify', (_evt, { pin }) => {
  const d = readAuth();
  if (!d || typeof d.salt !== 'string' || typeof d.hash !== 'string') return { ok: true };
  if (typeof pin !== 'string') return { ok: false };
  try {
    const got = hashPin(pin, d.salt);
    const exp = Buffer.from(d.hash, 'hex');
    if (got.length !== exp.length) return { ok: false };
    return { ok: crypto.timingSafeEqual(got, exp) };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle('auth:clear', (_evt, { pin }) => {
  const d = readAuth();
  if (!d) return { ok: true };
  if (typeof pin !== 'string') return { ok: false, error: 'PIN gerekli.' };
  try {
    const got = hashPin(pin, d.salt);
    const exp = Buffer.from(d.hash, 'hex');
    if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) {
      return { ok: false, error: 'PIN hatalı.' };
    }
    fs.unlinkSync(authPath());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

/** Oturum: giriş yapmış kullanıcı kimliği */
ipcMain.handle('account:session', () => {
  const uid = readSessionUserId();
  if (!uid) return { user: null };
  const { users } = readAccounts();
  const u = users.find((x) => x.id === uid);
  if (!u || typeof u.email !== 'string') {
    clearSession();
    return { user: null };
  }
  return {
    user: {
      id: u.id,
      email: u.email,
      displayName: typeof u.displayName === 'string' ? u.displayName : undefined,
    },
  };
});

ipcMain.handle('account:register', (_evt, { email, password, migrateLegacy, displayName }) => {
  const em = normalizeEmail(email);
  if (!em || !em.includes('@')) return { ok: false, error: 'Geçerli bir e-posta gir.' };
  if (typeof password !== 'string' || password.length < 8) return { ok: false, error: 'Parola en az 8 karakter olmalı.' };

  const accounts = readAccounts();
  if (accounts.users.some((u) => u.email === em)) return { ok: false, error: 'Bu e-posta ile zaten kayıt var.' };

  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt).toString('hex');
  accounts.users.push({
    id,
    email: em,
    salt,
    hash,
    createdAt: new Date().toISOString(),
    displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : undefined,
  });
  writeAccounts(accounts);
  writeSession(id);

  const userPath = dataPathForUser(id);
  if (migrateLegacy === true) {
    try {
      const leg = legacyDataPath();
      if (fs.existsSync(leg) && !fs.existsSync(userPath)) {
        fs.copyFileSync(leg, userPath);
      }
    } catch (e) {
      return { ok: true, user: { id, email: em, displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : undefined }, warn: String(e) };
    }
  }

  return { ok: true, user: { id, email: em, displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : undefined } };
});

ipcMain.handle('account:login', (_evt, { email, password }) => {
  const em = normalizeEmail(email);
  if (!em || typeof password !== 'string') return { ok: false, error: 'E-posta ve parola gerekli.' };
  const accounts = readAccounts();
  const u = accounts.users.find((x) => x.email === em);
  if (!u || typeof u.salt !== 'string' || typeof u.hash !== 'string') {
    return { ok: false, error: 'E-posta veya parola hatalı.' };
  }
  try {
    const got = hashPassword(password, u.salt);
    const exp = Buffer.from(u.hash, 'hex');
    if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) {
      return { ok: false, error: 'E-posta veya parola hatalı.' };
    }
    writeSession(u.id);
    return { ok: true, user: { id: u.id, email: u.email, displayName: typeof u.displayName === 'string' ? u.displayName : undefined } };
  } catch {
    return { ok: false, error: 'E-posta veya parola hatalı.' };
  }
});

ipcMain.handle('account:logout', () => {
  clearSession();
  return { ok: true };
});

ipcMain.handle('account:hasLegacyData', () => {
  try {
    return { has: fs.existsSync(legacyDataPath()) };
  } catch {
    return { has: false };
  }
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
