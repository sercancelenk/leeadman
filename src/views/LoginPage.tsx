import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { IcLogIn } from '../components/icons';
import { Button } from '../components/ui/Button';
import { useAccount } from '../AccountContext';

export function LoginPage() {
  const { user, loading, login } = useAccount();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  if (!loading && user) {
    return <Navigate to={from === '/login' ? '/' : from} replace />;
  }

  if (loading) {
    return (
      <div className="boot">
        <div className="boot__card">Yükleniyor…</div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card auth-card--wide">
        <h1 className="auth-card__title">Giriş yap</h1>
        <p className="muted">Verilerin bu cihazda, hesabına bağlı dosyada saklanır.</p>
        <form
          className="auth-form"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault();
            setErr('');
            const r = await login(email, password);
            if (r.ok) navigate(from, { replace: true });
            else setErr(r.error ?? 'Giriş başarısız.');
          }}
        >
          <label className="field">
            <span>E-posta</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Parola</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {err ? <p className="auth-err">{err}</p> : null}
          <Button type="submit" variant="primary" className="auth-form__submit" icon={<IcLogIn size={18} />}>
            Giriş
          </Button>
        </form>
        <p className="muted small" style={{ marginTop: 16 }}>
          Hesabın yok mu? <Link to="/register">Kayıt ol</Link>
        </p>
      </div>
    </div>
  );
}
