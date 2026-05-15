import { FormEvent, useState } from 'react';
import { IcSave } from '../components/icons';
import { Button } from '../components/ui/Button';
import { useAccount } from '../AccountContext';
import { useAppData } from '../AppDataContext';

export function ProfilePage() {
  const { user } = useAccount();
  const { data, updateUserProfile } = useAppData();
  const profile = data.profile ?? { displayName: 'Ben', favoriteTeamIds: [] };

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? '');
  const [department, setDepartment] = useState(profile.department ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saved, setSaved] = useState(false);

  const apply = () => {
    updateUserProfile({
      displayName,
      jobTitle,
      department,
      phone,
      bio,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Profil</h1>
        <p className="muted">Hesap ve kişisel bilgilerin. Ekip verilerinden ayrı tutulur.</p>
      </header>

      <section className="card">
        <h2 className="card__title">Hesap</h2>
        <div className="field">
          <span>E-posta</span>
          <input className="input" readOnly value={user?.email ?? ''} title="Hesap e-postası değiştirilemez" />
        </div>
        <p className="muted small">E-posta kayıt sırasında belirlenir; şu an uygulama içinden değiştirilemez.</p>
      </section>

      <section className="card">
        <h2 className="card__title">Kişisel bilgiler</h2>
        <form
          className="profile-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            apply();
          }}
        >
          <label className="field">
            <span>Görünen ad</span>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label className="field">
            <span>İş ünvanı</span>
            <input className="input" placeholder="Örn. Engineering Manager" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Departman / ekip</span>
            <input className="input" placeholder="Örn. Platform" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
          <label className="field">
            <span>Telefon</span>
            <input className="input" type="tel" placeholder="+90 …" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="field">
            <span>Hakkında</span>
            <textarea
              className="textarea"
              rows={5}
              placeholder="Kısa tanıtım, odak alanların, notların…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <Button type="submit" variant="primary" icon={<IcSave size={18} />}>
              Kaydet
            </Button>
            {saved ? <span className="muted small">Kaydedildi.</span> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
