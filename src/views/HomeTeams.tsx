import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IcArrowRight, IcPencil, IcPlus, IcSave, IcStar, IcTrash } from '../components/icons';
import { Button } from '../components/ui/Button';
import { useAppData } from '../AppDataContext';
import { sortedTeams } from '../lib/teamSort';
import { TEAM_STATUS_OPTIONS, teamStatusLabel } from '../lib/teamStatus';
import { teamBase } from '../lib/teamPaths';
import type { TeamStatus } from '../model';
import { teamPeople } from '../model';

export function HomeTeams() {
  const { data, addTeam, removeTeam, updateTeam, toggleFavoriteTeam } = useAppData();
  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const profile = data.profile ?? { displayName: 'Ben', favoriteTeamIds: [] };
  const favSet = useMemo(() => new Set(profile.favoriteTeamIds), [profile.favoriteTeamIds]);

  const cards = useMemo(() => {
    const order = sortedTeams(data).map((t) => t.id);
    const byId = new Map(data.teams.map((t) => [t.id, t]));
    return order
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((team) => {
        const members = teamPeople(data, team.id);
        const openTasks = data.items.filter(
          (it) =>
            !it.done &&
            it.kind === 'task' &&
            data.people.some((p) => p.id === it.personId && p.teamId === team.id),
        ).length;
        return { team, members, openTasks };
      });
  }, [data]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Ekipler</h1>
        <p className="muted">Her ekipte bir &quot;Kendim&quot; alanın ve ekip üyelerinin kişi sayfaları vardır. Ek ekip ekleyerek farklı takımları ayırabilirsin.</p>
      </header>

      <section className="card">
        <h2 className="card__title">Yeni ekip</h2>
        <form
          className="row"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!name.trim()) return;
            addTeam(name.trim());
            setName('');
          }}
        >
          <input className="input input--grow" placeholder="Ekip adı" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="primary" icon={<IcPlus size={18} />}>
            Ekip oluştur
          </Button>
        </form>
      </section>

      <section className="card">
        <h2 className="card__title">Tüm ekipler</h2>
        {cards.length === 0 ? (
          <p className="muted">Ekip yok.</p>
        ) : (
          <ul className="list">
            {cards.map(({ team, members, openTasks }) => (
              <li key={team.id} className="list__row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renameId === team.id ? (
                    <form
                      className="row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        updateTeam(team.id, { name: renameVal });
                        setRenameId(null);
                      }}
                    >
                      <input className="input input--grow" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
                      <Button type="submit" variant="primary" size="sm" icon={<IcSave size={16} />}>
                        Kaydet
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setRenameId(null)}>
                        Vazgeç
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className={`team-dot team-dot--${team.status ?? 'active'}`} aria-hidden />
                        <div className="list__title" style={{ margin: 0 }}>
                          {team.name}
                        </div>
                        <span className="pill">{teamStatusLabel(team.status)}</span>
                      </div>
                      <div className="muted small">
                        {members.length} üye · {openTasks} açık görev
                      </div>
                    </>
                  )}
                </div>
                {renameId === team.id ? null : (
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <select
                      className="select select--compact"
                      value={team.status ?? 'active'}
                      onChange={(e) => updateTeam(team.id, { status: e.target.value as TeamStatus })}
                      aria-label={`${team.name} durumu`}
                    >
                      {TEAM_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={`fav-star${favSet.has(team.id) ? ' fav-star--on' : ''}`}
                      title={favSet.has(team.id) ? 'Favoriden çıkar' : 'Favoriye ekle'}
                      onClick={() => toggleFavoriteTeam(team.id)}
                    >
                      <IcStar size={18} />
                    </button>
                    <Link
                      className="btn btn--primary btn--icon"
                      to={teamBase(team.id)}
                      title="Ekip özetine git"
                      aria-label="Ekip özetine git"
                    >
                      <span className="btn__icon">
                        <IcArrowRight size={17} />
                      </span>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<IcPencil size={16} />}
                      onClick={() => {
                        setRenameId(team.id);
                        setRenameVal(team.name);
                      }}
                    >
                      Adlandır
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      icon={<IcTrash size={16} />}
                      disabled={data.teams.length <= 1}
                      title={data.teams.length <= 1 ? 'Son ekip silinemez' : undefined}
                      onClick={() => {
                        if (data.teams.length <= 1) return;
                        if (window.confirm(`"${team.name}" ekibini ve içindeki tüm kişi/kayıtları silmek istediğine emin misin?`)) {
                          removeTeam(team.id);
                        }
                      }}
                    >
                      Sil
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.lastTeamId && data.teams.some((t) => t.id === data.lastTeamId) ? (
        <p className="muted small">
          Son ekip:{' '}
          <Link to={teamBase(data.lastTeamId!)}>{data.teams.find((t) => t.id === data.lastTeamId)?.name}</Link>
        </p>
      ) : null}
    </div>
  );
}
