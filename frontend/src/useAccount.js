import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSession, signOut } from './accountApi.js';

const signedOut = { user: null, googleSignInEnabled: false, csrfToken: null };

export default function useAccount() {
  const [session, setSession] = useState({ ...signedOut, status: 'loading', error: null });
  const version = useRef(0);
  const activeRequest = useRef(null);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSession({ ...signedOut, status: 'loading', error: null });
    try {
      const next = await fetchSession(controller.signal);
      if (!controller.signal.aborted && current === version.current) setSession({ ...next, status: 'ready', error: null });
    } catch (error) {
      if (!controller.signal.aborted && current === version.current) setSession({ ...signedOut, status: 'error', error: error.message });
    }
  }, []);
  useEffect(() => {
    refresh();
    const checkSession = () => refresh();
    window.addEventListener('focus', checkSession);
    return () => {
      version.current++;
      activeRequest.current?.abort();
      window.removeEventListener('focus', checkSession);
    };
  }, [refresh]);
  async function logout() {
    await signOut(session.csrfToken);
    // Remove private UI immediately; fetch a fresh anonymous CSRF/session state.
    setSession({ ...signedOut, status: 'loading', error: null });
    await refresh();
  }
  return { ...session, refresh, logout };
}
