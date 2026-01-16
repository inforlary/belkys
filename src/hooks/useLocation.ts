import { useState, useEffect, useMemo } from 'react';

export const useLocation = () => {
  const getPathWithoutQuery = (hash: string) => {
    const withoutHash = hash.slice(1) || 'dashboard';
    const path = withoutHash.split('?')[0];
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    console.log('[useLocation] hash:', hash, '-> path:', cleanPath);
    return cleanPath;
  };

  const [currentPath, setCurrentPath] = useState(
    getPathWithoutQuery(window.location.hash)
  );

  const [queryString, setQueryString] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('?') ? hash.split('?')[1] : '';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const newPath = getPathWithoutQuery(window.location.hash);
      const hash = window.location.hash;
      const newQueryString = hash.includes('?') ? hash.split('?')[1] : '';
      console.log('[useLocation] hashchange -> newPath:', newPath);
      console.log('[useLocation] hashchange -> queryString:', newQueryString);
      setCurrentPath(newPath);
      setQueryString(newQueryString);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    console.log('[useLocation] navigate called with:', path);
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    window.location.hash = cleanPath;
  };

  const searchParams = useMemo(() => {
    console.log('[useLocation] Creating searchParams from queryString:', queryString);
    return new URLSearchParams(queryString);
  }, [queryString]);

  const getParams = () => {
    return Object.fromEntries(searchParams.entries());
  };

  return { currentPath, navigate, searchParams, getParams };
};
