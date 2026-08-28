import { useCallback, useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  clearToken,
  fetchMe,
  getToken,
  type PublicRegistration,
  type PublicUser,
} from "@/lib/api/client";

export function useAuth() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [registration, setRegistration] = useState<PublicRegistration | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setRegistration(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe();
      setUser(data.user);
      setRegistration(data.registration);
    } catch {
      clearToken();
      setUser(null);
      setRegistration(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
  }, [refresh]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setRegistration(null);
  }, []);

  return { user, registration, loading, refresh, logout };
}
