import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    getSupabase().then((client) => {
      const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      });
      unsub = () => data.subscription.unsubscribe();

      client.auth.getSession().then(({ data: sess }) => {
        setSession(sess.session);
        setUser(sess.session?.user ?? null);
        setLoading(false);
      });
    });

    return () => { unsub?.(); };
  }, []);

  return { session, user, loading };
}

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let active = true;
    getSupabase().then((client) => {
      client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => {
          if (active) setIsAdmin(Boolean(data));
        });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return isAdmin;
}
