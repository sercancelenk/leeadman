import { NavLink, useMatch } from 'react-router-dom';
import { IcFolder, IcHome, IcLayoutGrid, IcListTodo, IcSettings, IcTarget, IcUser, IcUsers } from './icons';
import { useAppData } from '../AppDataContext';
import { PATH_HOME, PATH_TEAMS } from '../lib/routes';
import { teamLeader, teamMe, teamPeople as teamPeopleRoute, teamBase } from '../lib/teamPaths';

const linkCls = ({ isActive }: { isActive: boolean }) => `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`;

type Props = { collapsed: boolean };

export function AppSidebar({ collapsed }: Props) {
  const m = useMatch({ path: '/teams/:teamId/*', end: false });
  const teamId = m?.params.teamId;
  const { data } = useAppData();
  const team = teamId ? data.teams.find((t) => t.id === teamId) : undefined;

  return (
    <aside className="app-sidebar" aria-label="Ana menü">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__logo" aria-hidden />
        {!collapsed ? (
          <div className="app-sidebar__brand-text">
            <span className="app-sidebar__title">Leeadman</span>
            <span className="app-sidebar__subtitle">Liderlik çalışma alanı</span>
          </div>
        ) : null}
      </div>

      <nav className="app-sidebar__nav">
        <div className="app-sidebar__section">
          {!collapsed ? <div className="app-sidebar__section-label">Uygulama</div> : null}
          <NavLink to={PATH_HOME} end className={linkCls} title="Ana sayfa">
            <span className="app-sidebar__ic">
              <IcHome size={18} />
            </span>
            {!collapsed ? <span>Ana sayfa</span> : null}
          </NavLink>
          <NavLink to={PATH_TEAMS} end className={linkCls} title="Ekipler">
            <span className="app-sidebar__ic">
              <IcFolder size={18} />
            </span>
            {!collapsed ? <span>Ekipler</span> : null}
          </NavLink>
          <NavLink to="/todos" className={linkCls} title="Yapılacaklar">
            <span className="app-sidebar__ic">
              <IcListTodo size={18} />
            </span>
            {!collapsed ? <span>Yapılacaklar</span> : null}
          </NavLink>
        </div>

        <div className="app-sidebar__section">
          {!collapsed ? <div className="app-sidebar__section-label">Hesap</div> : null}
          <NavLink to="/profile" className={linkCls} title="Profil">
            <span className="app-sidebar__ic">
              <IcUser size={18} />
            </span>
            {!collapsed ? <span>Profil</span> : null}
          </NavLink>
          <NavLink to="/settings" className={linkCls} title="Ayarlar">
            <span className="app-sidebar__ic">
              <IcSettings size={18} />
            </span>
            {!collapsed ? <span>Ayarlar</span> : null}
          </NavLink>
        </div>

        {teamId && team ? (
          <div className="app-sidebar__section app-sidebar__section--team">
            {!collapsed ? (
              <div className="app-sidebar__section-label">
                Ekip <span className="app-sidebar__team-name">{team.name}</span>
              </div>
            ) : null}
            <NavLink to={teamBase(teamId)} end className={linkCls} title="Özet">
              <span className="app-sidebar__ic">
                <IcLayoutGrid size={18} />
              </span>
              {!collapsed ? <span>Özet</span> : null}
            </NavLink>
            <NavLink to={teamMe(teamId)} className={linkCls} title="Kendim">
              <span className="app-sidebar__ic">
                <IcUser size={18} />
              </span>
              {!collapsed ? <span>Kendim</span> : null}
            </NavLink>
            <NavLink to={teamLeader(teamId)} className={linkCls} title="Liderim">
              <span className="app-sidebar__ic">
                <IcTarget size={18} />
              </span>
              {!collapsed ? <span>Liderim</span> : null}
            </NavLink>
            <NavLink to={teamPeopleRoute(teamId)} className={linkCls} title="Ekip üyeleri">
              <span className="app-sidebar__ic">
                <IcUsers size={18} />
              </span>
              {!collapsed ? <span>Ekip üyeleri</span> : null}
            </NavLink>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
