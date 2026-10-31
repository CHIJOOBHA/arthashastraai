import { useEffect, useState } from 'react';

const ROUTE_EVENT = 'arthashastra:navigate';

/** Client-side navigation without a router library. */
export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (opts.replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/** Current pathname; updates on back/forward and on navigate(). */
export function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener(ROUTE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(ROUTE_EVENT, update);
    };
  }, []);
  return pathname;
}
