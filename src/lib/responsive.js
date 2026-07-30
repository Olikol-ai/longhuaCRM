import { useEffect, useState } from 'react';

/** Canonical Longhua CRM breakpoints (px). Keep in sync with tailwind.config.js screens. */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * Subscribe to a min-width media query.
 * @param {keyof typeof BREAKPOINTS | number} breakpoint
 * @returns {boolean} true when viewport width >= breakpoint
 */
export function useMinWidth(breakpoint) {
  const px = typeof breakpoint === 'number' ? breakpoint : BREAKPOINTS[breakpoint];
  const query = `(min-width: ${px}px)`;

  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tablet landscape / desktop dialog threshold. */
export function useIsMdUp() {
  return useMinWidth('md');
}

/** Desktop shell (≥1024). */
export function useIsLgUp() {
  return useMinWidth('lg');
}
