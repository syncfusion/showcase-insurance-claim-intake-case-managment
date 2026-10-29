import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppTheme } from '../domain/palette';
import { getTheme, saveTheme } from '../lib/data';

interface ThemeContextValue {
  theme: AppTheme;
  toggle: () => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {}, ready: false });

declare global {
  interface Window {
    __sfThemeReady?: Promise<boolean>;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(getTheme);
  const [ready, setReady] = useState(false);

  // Remove the static boot frame once the Syncfusion theme stylesheet has loaded.
  // index.html inserts #syncfusion-theme before the React entry script, registers a load/error
  // listener immediately (window.__sfThemeReady), and the React app awaits that promise here.
  // Without it, #app-boot would stay on top of the page and intercept every click.
  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      setReady(true);
      const boot = document.getElementById('app-boot');
      if (boot) boot.remove();
    };
    const ready = window.__sfThemeReady;
    if (ready) {
      ready.then(finish);
    } else {
      // Fallback (no link in index.html, e.g. tests): mark ready and remove any leftover boot.
      finish();
    }
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: AppTheme = prev === 'light' ? 'dark' : 'light';
      saveTheme(next);

      // Load the new theme stylesheet off-screen, then swap so controls never render unstyled.
      const newHref = next === 'dark'
        ? 'https://cdn.syncfusion.com/ej2/28.1.33/tailwind3-dark.css'
        : 'https://cdn.syncfusion.com/ej2/28.1.33/tailwind3.css';

      const currentLink = document.getElementById('syncfusion-theme') as HTMLLinkElement | null;
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = newHref;
      newLink.setAttribute('data-theme', next);
      newLink.id = 'syncfusion-theme';
      newLink.setAttribute('data-theme-swap', 'pending');
      newLink.onload = () => {
        if (currentLink && currentLink.parentNode) currentLink.remove();
        newLink.removeAttribute('data-theme-swap');
      };
      newLink.onerror = () => { newLink.removeAttribute('data-theme-swap'); };
      document.head.appendChild(newLink);

      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggle, ready }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);