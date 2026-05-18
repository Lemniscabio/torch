'use client';

// Theme context with a circular-reveal animation built on the View
// Transitions API. The toggle button passes its click coordinates so the
// new theme's snapshot expands as a circle from the cursor outward, with
// the radius sized to reach the farthest viewport corner. Falls back to
// an instant swap when startViewTransition isn't supported (Safari < 17).

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: (origin?: { x: number; y: number }) => void;
}>({ theme: 'dark', toggleTheme: () => {} });

function applyTheme(next: Theme) {
  if (next === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('torch-theme', next);
}

function viewportFarthestRadius(x: number, y: number): number {
  const dx = Math.max(x, window.innerWidth - x);
  const dy = Math.max(y, window.innerHeight - y);
  return Math.hypot(dx, dy);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('torch-theme') as Theme | null;
    if (stored === 'light') {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  function toggleTheme(origin?: { x: number; y: number }) {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);

    if (!('startViewTransition' in document)) {
      applyTheme(next);
      return;
    }

    // Default origin: viewport centre — used when the toggle fires from
    // a keyboard shortcut or anywhere without click coordinates.
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const radius = viewportFarthestRadius(x, y);

    const transition = document.startViewTransition(() => applyTheme(next));

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          pseudoElement: '::view-transition-new(root)',
          duration: 1100,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
        },
      );
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
