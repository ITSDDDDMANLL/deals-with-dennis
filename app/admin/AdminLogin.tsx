"use client";

import { FormEvent, useState } from "react";

export function AdminLogin() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    const response = await fetch("/api/admin/session", {
      body: JSON.stringify({ password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setError("Password was not accepted.");
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <form className="admin-login" onSubmit={handleSubmit}>
      <p className="eyebrow">Admin access</p>
      <h1>Sign in to manage inventory.</h1>
      <label>
        <span>Password</span>
        <input name="password" required type="password" />
      </label>
      <button className="button primary" disabled={loading}>
        {loading ? "Checking..." : "Enter Admin"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
      <p className="form-note">
        Set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in Vercel before sharing
        the preview link.
      </p>
    </form>
  );
}
