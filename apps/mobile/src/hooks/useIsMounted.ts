import { useEffect, useRef } from 'react';

/** Returns whether the component is still mounted (for async UI updates). */
export function useIsMounted() {
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return () => mounted.current;
}
