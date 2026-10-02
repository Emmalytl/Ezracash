"use client";

import { FormEvent, useState } from "react";
import styles from "./admin.module.css";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to sign in. Please try again.");
        return;
      }

      const role = String(result.role || "").toLowerCase();

      if (role === "developer") {
        window.location.replace("/admin/developer");
      } else if (role === "staff") {
        window.location.replace("/admin/staff/dashboard");
      } else {
        window.location.replace("/admin/administrator");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${styles.authPage} workspace-login`}>
      <aside className="login-story">
        <a href="/" className="login-wordmark">
          <img
            src="/branding/house-of-ezra-logo-transparent.png"
            alt=""
          />
          HOUSE OF EZRA <span>GIVING</span>
        </a>

        <div>
          <span className="login-kicker">THE MINISTRY WORKSPACE</span>
          <h2>
            A shared purpose.
            <br />
            A place to make
            <br />
            <em>an impact.</em>
          </h2>
          <p>
            People, generosity and stewardship — brought together in
            one thoughtful workspace.
          </p>
          <div className="login-roles">
            <span>Administrator</span>
            <span>Staff</span>
            <span>Developer</span>
          </div>
        </div>

        <a className="login-public" href="/">
          ← Return to the giving site
        </a>
      </aside>

      <section className={`${styles.authCard} workspace-login-card`}>
        <div className={styles.authBrand}>HOUSE OF EZRA GIVING</div>
        <h1>Welcome back.</h1>
        <p>
          Sign in with your individual account. Your role determines
          which ministry workspace opens.
        </p>

        <form className={styles.form} onSubmit={submit}>
          <label>
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <div style={{ position: "relative", marginTop: 6 }}>
              <input
                required
                minLength={8}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                style={{ marginTop: 0, paddingRight: 78 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: 0,
                  background: "transparent",
                  color: "#0c3a63",
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </label>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <button
            className={styles.primary}
            disabled={loading}
            type="submit"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
