import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

export function Layout() {
  const [navCollapsed, setNavCollapsed] = useState(false);

  return (
    <div className={`app-shell${navCollapsed ? ' app-shell--nav-collapsed' : ''}`}>
      <TopBar navCollapsed={navCollapsed} onToggleNav={() => setNavCollapsed((c) => !c)} />
      <div className="app-shell__body">
        <AppSidebar collapsed={navCollapsed} />
        <main className="main main--scroll main--canvas">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
