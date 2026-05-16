import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

const MOBILE_BREAKPOINT = 700;

function detectIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

export function Layout() {
  const [isMobile, setIsMobile] = useState<boolean>(detectIsMobile);
  // On phones we want the user to see content first; the sidebar opens as a
  // slide-in drawer when the hamburger is tapped. On desktop the sidebar is
  // visible by default and the toggle just switches between full / collapsed.
  const [navCollapsed, setNavCollapsed] = useState<boolean>(detectIsMobile);
  const location = useLocation();

  // Track viewport changes (rotate / resize). When transitioning from desktop
  // to mobile we collapse, and vice-versa we expand for the desktop default.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setNavCollapsed(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // On mobile, dismiss the drawer whenever the route changes so taps on a
  // sidebar link don't leave the overlay covering the page.
  useEffect(() => {
    if (isMobile) setNavCollapsed(true);
  }, [location.pathname, isMobile]);

  // Lock the body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!isMobile) return;
    const open = !navCollapsed;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, navCollapsed]);

  const drawerOpen = isMobile && !navCollapsed;

  return (
    <div
      className={[
        'app-shell',
        navCollapsed ? 'app-shell--nav-collapsed' : '',
        isMobile ? 'app-shell--mobile' : '',
        drawerOpen ? 'app-shell--drawer-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TopBar
        navCollapsed={navCollapsed}
        onToggleNav={() => setNavCollapsed((c) => !c)}
      />
      <div className="app-shell__body">
        <AppSidebar collapsed={navCollapsed && !isMobile} />
        {drawerOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="app-shell__backdrop"
            onClick={() => setNavCollapsed(true)}
          />
        ) : null}
        <main className="main main--scroll main--canvas">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
