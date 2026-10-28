"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result: { error?: string } = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Unable to verify access.");
        return;
      }

      router.replace("/");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="access-page">
      <form className="access-card" onSubmit={submit}>
        <div className="brand-mark"><span /></div>
        <div className="access-icon"><LockKeyhole size={19} /></div>
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1>Welcome back.</h1>
        <p className="muted">Enter your owner password to continue.</p>
        <label className="field-label" htmlFor="owner-password">Owner password</label>
        <input
          autoComplete="current-password"
          id="owner-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button wide-button" disabled={pending} type="submit">
          {pending ? "Checking…" : "Unlock workspace"}
        </button>
      </form>
    </main>
  );
}
