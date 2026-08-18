import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../shop/components/Button";
import { Field, INPUT } from "../shop/components/Field";
import { ErrorText } from "../shop/components/ErrorText";
import { ApiError } from "../lib/api/http";
import { CONFIG } from "../config";
import { useAuth } from "./useAuth";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Where they were headed before being bounced here, so a deep link to an
     order survives the detour through login. */
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // Deliberately the same message for a bad email and a bad password —
      // saying which is wrong tells an attacker which accounts exist.
      setError(err instanceof ApiError && err.status === 422
        ? "That email and password don't match."
        : err instanceof ApiError && err.status === 401
          ? "That email and password don't match."
          : "Couldn't sign in just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-[400px] content-center px-5 py-10">
      <p className="mb-1.5 text-[.8125rem] font-semibold uppercase tracking-[.14em] text-fg-brand">
        {CONFIG.shopName}
      </p>
      <h1 className="mb-6 font-display text-2xl font-semibold leading-[1.3]">Shop admin</h1>

      <form onSubmit={onSubmit} noValidate>
        <Field label="Email" htmlFor="a-email">
          <input
            type="email" id="a-email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Password" htmlFor="a-password">
          <input
            type="password" id="a-password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </Field>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" className="mt-2 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
