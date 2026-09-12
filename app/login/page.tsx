"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell"><div className="auth-card"><div className="brand auth-brand"><span>✦</span> master<span className="brand-accent">lld</span></div><p className="overline">THE PRACTICE ROOM</p><h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1><p className="auth-copy">Sign in to save practice progress, return to unfinished steps, and keep multiple attempts for every problem.</p>{isSupabaseConfigured() ? <form className="auth-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="auth-submit" disabled={loading}>{loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</button>{message && <p className="auth-message">{message}</p>}</form> : <div className="auth-setup"><strong>Supabase is not connected yet.</strong><p>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the dev server.</p><p>The setup SQL is ready in <code>supabase/schema.sql</code>.</p></div>}<button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></div></main>;
}
