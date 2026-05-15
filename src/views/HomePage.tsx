import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { IcArrowRight, IcFolder, IcLayoutGrid, IcListTodo, IcSettings, IcUser } from '../components/icons';
import { useAccount } from '../AccountContext';
import { useAppData } from '../AppDataContext';
import { PATH_TEAMS } from '../lib/routes';
import { sortedTeams } from '../lib/teamSort';
import { teamBase } from '../lib/teamPaths';

export function HomePage() {
  const { user } = useAccount();
  const { data } = useAppData();
  const profile = data.profile ?? { displayName: 'Ben' };
  const teamsSorted = useMemo(() => sortedTeams(data), [data]);
  const lastTeam = data.lastTeamId ? data.teams.find((t) => t.id === data.lastTeamId) : undefined;
  const openTasksAll = useMemo(
    () =>
      data.items.filter((it) => !it.done && it.kind === 'task' && data.people.some((p) => p.id === it.personId)).length,
    [data.items, data.people],
  );
  const openTodos = useMemo(() => data.todoItems.filter((t) => !t.done).length, [data.todoItems]);
  const peopleCount = data.people.filter((p) => !p.id.startsWith('__')).length;

  return (
    <div className="page home-page">
      <header className="home-page__hero">
        <div className="home-page__brand">
          <span className="home-page__logo" aria-hidden />
          <div>
            <h1 className="home-page__title">Leeadman</h1>
            <p className="home-page__tagline">Liderlik çalışma alanı — ekipler, kişisel yapılacaklar ve 1:1 takip.</p>
          </div>
        </div>
        <p className="home-page__welcome muted">
          Merhaba, <strong className="home-page__name">{profile.displayName}</strong>
          {user?.email ? (
            <>
              {' '}
              · <span className="home-page__email">{user.email}</span>
            </>
          ) : null}
        </p>
      </header>

      <div className="home-page__stats">
        <div className="home-page__stat">
          <span className="home-page__stat-value">{data.teams.length}</span>
          <span className="home-page__stat-label">Ekip</span>
        </div>
        <div className="home-page__stat">
          <span className="home-page__stat-value">{openTasksAll}</span>
          <span className="home-page__stat-label">Açık görev</span>
        </div>
        <div className="home-page__stat">
          <span className="home-page__stat-value">{openTodos}</span>
          <span className="home-page__stat-label">Yapılacak</span>
        </div>
        <div className="home-page__stat">
          <span className="home-page__stat-value">{peopleCount}</span>
          <span className="home-page__stat-label">Kişi kaydı</span>
        </div>
      </div>

      <h2 className="home-page__section-title">Hızlı giriş</h2>
      <div className="home-page__tiles">
        <Link className="home-tile" to={PATH_TEAMS}>
          <span className="home-tile__ic">
            <IcFolder size={22} />
          </span>
          <span className="home-tile__title">Ekipler</span>
          <span className="home-tile__desc">Takımlarını yönet, üyeler ve görevler.</span>
          <span className="home-tile__arrow" aria-hidden>
            <IcArrowRight size={18} />
          </span>
        </Link>

        <Link className="home-tile" to="/todos">
          <span className="home-tile__ic">
            <IcListTodo size={22} />
          </span>
          <span className="home-tile__title">Yapılacaklar</span>
          <span className="home-tile__desc">Kişisel listeler; ekipten bağımsız.</span>
          <span className="home-tile__arrow" aria-hidden>
            <IcArrowRight size={18} />
          </span>
        </Link>

        {lastTeam ? (
          <Link className="home-tile home-tile--accent" to={teamBase(lastTeam.id)}>
            <span className="home-tile__ic">
              <IcLayoutGrid size={22} />
            </span>
            <span className="home-tile__title">Son ekip</span>
            <span className="home-tile__desc">{lastTeam.name} · özete git</span>
            <span className="home-tile__arrow" aria-hidden>
              <IcArrowRight size={18} />
            </span>
          </Link>
        ) : teamsSorted[0] ? (
          <Link className="home-tile home-tile--accent" to={teamBase(teamsSorted[0].id)}>
            <span className="home-tile__ic">
              <IcLayoutGrid size={22} />
            </span>
            <span className="home-tile__title">İlk ekibin</span>
            <span className="home-tile__desc">{teamsSorted[0].name} · özete git</span>
            <span className="home-tile__arrow" aria-hidden>
              <IcArrowRight size={18} />
            </span>
          </Link>
        ) : null}

        <Link className="home-tile" to="/profile">
          <span className="home-tile__ic">
            <IcUser size={22} />
          </span>
          <span className="home-tile__title">Profil</span>
          <span className="home-tile__desc">Görünen ad ve tercihler.</span>
          <span className="home-tile__arrow" aria-hidden>
            <IcArrowRight size={18} />
          </span>
        </Link>

        <Link className="home-tile" to="/settings">
          <span className="home-tile__ic">
            <IcSettings size={22} />
          </span>
          <span className="home-tile__title">Ayarlar</span>
          <span className="home-tile__desc">Tema, PIN, yedek ve sürüm.</span>
          <span className="home-tile__arrow" aria-hidden>
            <IcArrowRight size={18} />
          </span>
        </Link>
      </div>

      {teamsSorted.length > 0 ? (
        <>
          <h2 className="home-page__section-title">Ekiplerin</h2>
          <ul className="home-page__team-chips">
            {teamsSorted.slice(0, 6).map((t) => {
              const n = data.people.filter((p) => p.teamId === t.id).length;
              return (
                <li key={t.id}>
                  <Link className="home-team-chip" to={teamBase(t.id)}>
                    <span className={`team-dot team-dot--${t.status ?? 'active'}`} aria-hidden />
                    <span className="home-team-chip__name">{t.name}</span>
                    <span className="home-team-chip__meta muted small">{n} üye</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {teamsSorted.length > 6 ? (
            <p className="muted small home-page__more">
              +{teamsSorted.length - 6} ekip daha — <Link to={PATH_TEAMS}>tümünü gör</Link>
            </p>
          ) : null}
        </>
      ) : (
        <p className="muted home-page__hint">
          Henüz ekip yok. <Link to={PATH_TEAMS}>Ekipler</Link> sayfasından ilk ekibini oluşturabilirsin.
        </p>
      )}
    </div>
  );
}
