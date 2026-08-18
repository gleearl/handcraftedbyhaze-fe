/* ==========================================================================
   Who's signed in.

   The session is an httpOnly cookie, so this context never holds a credential
   — only the user the server says the cookie belongs to. "Signed out" is
   therefore always the server's opinion, established by GET /api/admin/me.
   ========================================================================== */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import * as api from "../lib/api/admin";
import { setUnauthorizedHandler } from "../lib/api/http";
import type { AdminUser } from "../lib/api/types";

interface AuthContext {
  user: AdminUser | null;
  /** True until the first /me has answered — don't redirect before then. */
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;   // StrictMode double-invokes effects in dev
    checked.current = true;
    api.me().then(setUser).finally(() => setChecking(false));
  }, []);

  /* Any 401 from anywhere means the cookie died mid-session. Drop the user so
     RequireAuth takes over, rather than leaving a screen half-rendered against
     data it can no longer fetch. */
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password));
  }, []);

  const signOut = useCallback(async () => {
    /* Swallowed on purpose, not merely tolerated: signing out locally is the
       whole job here. Leaving someone apparently signed in because the server
       round-trip failed is the worse outcome, and rethrowing would surface as
       an unhandled rejection at every call site. */
    try {
      await api.logout();
    } catch (err) {
      console.warn("[auth] Logout request failed; ending the session locally.", err);
    }
    setUser(null);
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const value = useMemo(() => ({ user, checking, signIn, signOut }),
    [user, checking, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
