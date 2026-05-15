import { FormEvent, useEffect, useRef, useState } from 'react';
import { IcDownload, IcLock, IcMoon, IcRefresh, IcSun, IcTrash, IcUpload } from '../components/icons';
import { Button } from '../components/ui/Button';
import { useAppData } from '../AppDataContext';
import { useSession } from '../AuthContext';
import type { AppData } from '../model';
import { useTheme } from '../ThemeContext';

export function Settings() {
  const { data, replaceAll } = useAppData();
  const { theme, setTheme } = useTheme();
  const { pinEnabled, refresh: refreshSession } = useSession();
  const [path, setPath] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [clearPin, setClearPin] = useState('');
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
    a.download = `leeadman-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Ayarlar</h1>
        <p className="muted">Veri bu bilgisayarda kalır; yedek için dışa aktar.</p>
      </header>

      <section className="card">
        <h2 className="card__title">Görünüm</h2>
        <p className="muted small">Üst çubuktaki tema düğmesiyle de değiştirebilirsin.</p>
        <div className="row">
          <Button
            type="button"
            variant={theme === 'dark' ? 'primary' : 'secondary'}
            icon={<IcMoon size={17} />}
            onClick={() => setTheme('dark')}
          >
            Koyu
          </Button>
          <Button
            type="button"
            variant={theme === 'light' ? 'primary' : 'secondary'}
            icon={<IcSun size={17} />}
            onClick={() => setTheme('light')}
          >
            Açık
          </Button>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">PIN ile koruma</h2>
        <p className="muted">
          Veri dosyası diskte düz metin kalır; PIN yalnızca uygulama açılışında yanlış ellere karşı basit bir engeldir. Güçlü gizlilik için disk şifreleme (FileVault vb.) düşün.
        </p>
        <p className="muted small">Durum: {pinEnabled ? 'Açık' : 'Kapalı'}</p>
        {!pinEnabled ? (
          <form
            className="row"
            style={{ marginTop: 10, flexDirection: 'column', alignItems: 'stretch' }}
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              if (newPin.length < 4 || newPin !== newPin2) {
                window.alert('PIN en az 4 karakter ve iki alan aynı olmalı.');
                return;
              }
              const r = await window.leeadman?.authSetPin?.({ pin: newPin });
              if (r?.ok) {
                setNewPin('');
                setNewPin2('');
                await refreshSession();
                window.alert('PIN kaydedildi. Uygulamayı yeniden açınca sorulacak.');
              } else {
                window.alert(r?.error ?? 'Kaydedilemedi');
              }
            }}
          >
            <input className="input" type="password" placeholder="Yeni PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            <input className="input" type="password" placeholder="PIN tekrar" value={newPin2} onChange={(e) => setNewPin2(e.target.value)} />
            <Button type="submit" variant="primary" icon={<IcLock size={17} />}>
              PIN oluştur
            </Button>
          </form>
        ) : (
          <form
            className="row"
            style={{ marginTop: 10, flexDirection: 'column', alignItems: 'stretch' }}
            onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              const r = await window.leeadman?.authClear?.({ pin: clearPin });
              if (r?.ok) {
                setClearPin('');
                await refreshSession();
                window.alert('PIN kaldırıldı.');
              } else {
                window.alert(r?.error ?? 'PIN hatalı');
              }
            }}
          >
            <input
              className="input"
              type="password"
              placeholder="Mevcut PIN (kaldırmak için)"
              value={clearPin}
              onChange={(e) => setClearPin(e.target.value)}
            />
            <Button type="submit" variant="danger" icon={<IcTrash size={17} />}>
              PIN korumasını kaldır
            </Button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Uygulama sürümü</h2>
        <p>
          Kurulu sürüm: <strong>{appVersion || '—'}</strong> · Veri şeması: v{data.version}
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">Otomatik güncelleme (GitHub Releases)</h2>
        <p className="muted">
          Paketlenmiş uygulama açıldığında GitHub&apos;taki yayınlardan yeni sürüm kontrol edilir. Çalışması için{' '}
          <code>package.json</code> içindeki <code>repository</code> ve <code>build.publish</code> alanlarında{' '}
          <code>YOUR_GITHUB_USERNAME</code> yerine kendi GitHub kullanıcı veya organizasyon adını yaz; sürümleri{' '}
          <code>npm run build</code> ile üretip GitHub Release olarak yüklemen gerekir (ör. <code>electron-builder</code> çıktıları).
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <Button
            type="button"
            variant="secondary"
            icon={<IcRefresh size={17} />}
            onClick={async () => {
              const r = await window.leeadman?.checkForUpdates?.();
              if (!r?.ok && r?.reason === 'dev') {
                window.alert('Geliştirme modunda paket güncellemesi yok; üretim .app/.exe kullan.');
              } else if (r?.ok) {
                window.alert('Güncelleme kontrolü başlatıldı. Varsa bildirim gösterilir.');
              } else {
                window.alert(`Kontrol başarısız: ${r?.error ?? 'bilinmiyor'}`);
              }
            }}
          >
            Şimdi güncelleme kontrol et
          </Button>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Veri konumu (Electron)</h2>
        {path ? <pre className="pre">{path}</pre> : <p className="muted">Tarayıcı önizlemesinde Electron klasörü yok; veri localStorage&apos;da.</p>}
        <p className="muted small">Dosya adı: leeadman-data.json</p>
      </section>

      <section className="card">
        <h2 className="card__title">Yedek</h2>
        <div className="row">
          <Button type="button" variant="primary" icon={<IcDownload size={17} />} onClick={exportJson}>
            JSON dışa aktar
          </Button>
          <Button type="button" variant="secondary" icon={<IcUpload size={17} />} onClick={() => fileRef.current?.click()}>
            JSON içe aktar
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
                window.alert('Dosya okunamadı veya geçersiz JSON.');
              }
            }}
          />
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          İçe aktarma mevcut verinin üzerine yazar. Önce dışa aktararak yedek al.
        </p>
      </section>

      <section className="card">
        <h2 className="card__title">Hatırlatıcılar</h2>
        <p className="muted">
          macOS bildirim izni istenir. Görev veya not satırında &quot;Hatırlatıcı&quot; alanını doldur; zaman gelince masaüstü bildirimi gösterilir (aynı hatırlatıcı
          tekrar etmez; saati değiştirirsen yeniden tetiklenebilir).
        </p>
      </section>
    </div>
  );
}
