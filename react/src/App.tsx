import { Suspense, lazy, type MouseEvent as ReactMouseEvent } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, BarChart3, KanbanSquare, FileText, LayoutDashboard, Sun, Moon } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { ThemeProvider, useTheme } from './lib/ThemeProvider';
import { ClaimDataProvider } from './lib/data';
import { LoadingState } from './components/LoadingState';
import { getPublicBasePath } from './basePath';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClaimsListPage = lazy(() => import('./pages/ClaimsListPage').then(m => ({ default: m.ClaimsListPage })));
const ClaimsBoardPage = lazy(() => import('./pages/ClaimsBoardPage').then(m => ({ default: m.ClaimsBoardPage })));
const ClaimDetailPage = lazy(() => import('./pages/ClaimDetailPage').then(m => ({ default: m.ClaimDetailPage })));

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: `dashboard`, icon: BarChart3 },
  { id: 'claims', label: 'Claims List', href: `claims`, icon: FileText },
  { id: 'board', label: 'Claims Board', href: `board`, icon: KanbanSquare },
  // Detail uses a real claim id from the data set; resolve the first one at render time.
  { id: 'detail', label: 'Claim Detail', href: `claims/CLM-001`, icon: ShieldAlert }
];

const ROUTE_ID_BY_PREFIX: { prefix: string; id: string; label: string }[] = [
  { prefix: `/dashboard`, id: 'dashboard', label: 'Dashboard' },
  { prefix: `/board`, id: 'board', label: 'Claims Board' },
  // The detail page is /claims/:id; this prefix must match a child path (anything past /claims/)
  // without also matching the bare /claims list.
  { prefix: `/claims/`, id: 'detail', label: 'Claim Detail' },
  { prefix: `/claims`, id: 'claims', label: 'Claims List' }
];

function currentRouteId(pathname: string): { id: string; label: string } {
  // Longest prefix wins so /claims/:id picks 'detail' instead of the bare 'claims' list.
  const ordered = [...ROUTE_ID_BY_PREFIX].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const entry of ordered) {
    const exact = pathname === entry.prefix;
    const child = entry.prefix.endsWith('/')
      ? pathname.startsWith(entry.prefix)
      : pathname.startsWith(entry.prefix + '/');
    if (exact || child) return { id: entry.id, label: entry.label };
  }
  return { id: 'dashboard', label: 'Dashboard' };
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className="app-shell-icon-button"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}

function AppRoutes() {
  const { ready } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  if (!ready) {
    return null; // #app-boot is visible until theme loads
  }

  const { id: currentId, label: currentLabel } = currentRouteId(location.pathname);

  // AppShell calls this for plain left clicks; route in-page so the browser does not full-reload.
  // Modified clicks (cmd/ctrl/shift/alt, non-primary button) keep the browser default (new tab, etc.).
  const handleNavigate = (id: string, event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = NAV_ITEMS.find(item => item.id === id);
    if (target) navigate(target.href);
  };

  return (
    <AppShell
      appName="Insurance Claims"
      appSubtitle="Claims Management Portal"
      logo={<LayoutDashboard size={20} aria-hidden="true" />}
      items={NAV_ITEMS}
      currentId={currentId}
      onNavigate={handleNavigate}
      storageKey="insurance-claims-portal-nav-collapsed"
      headerEnd={<ThemeToggle />}
    >
      <Suspense key={currentId} fallback={<LoadingState label={`Loading ${currentLabel}…`} />}>
        <Routes>
          <Route path={`/dashboard`} element={<DashboardPage />} />
          <Route path={`/claims/:id`} element={<ClaimDetailPage />} />
          <Route path={`/claims`} element={<ClaimsListPage />} />
          <Route path={`/board`} element={<ClaimsBoardPage />} />
          <Route path="*" element={<Navigate to={`/dashboard`} replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ClaimDataProvider>
          <BrowserRouter basename={getPublicBasePath()}>
          <AppRoutes />
        </BrowserRouter>
      </ClaimDataProvider>
    </ThemeProvider>
  );
}