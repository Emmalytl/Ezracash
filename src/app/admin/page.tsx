"use client";

import { FormEvent, useState } from "react";
import styles from "./signin-card.module.css";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

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
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.card} aria-labelledby="sign-in-title">
          <div className={styles.brand}>
            <img src="/branding/house-of-ezra-logo-transparent.png" alt="House of Ezra logo"/>
            <div><span>HOUSE OF EZRA</span><small>GIVING WORKSPACE</small></div>
          </div>
          <header className={styles.intro}>
            <h1 id="sign-in-title">Admin Sign In</h1>
            <p>Welcome back. Sign in to your account to continue to your ministry workspace.</p>
          </header>

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label htmlFor="admin-email">Email address</label>
              <div className={styles.inputWrap}><Mail size={18} aria-hidden="true"/><input id="admin-email" name="email" required type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username" placeholder="you@example.com" disabled={loading} aria-describedby={error?"sign-in-error":undefined}/></div>
            </div>
            <div className={styles.field}>
              <label htmlFor="admin-password">Password</label>
              <div className={styles.inputWrap}><LockKeyhole size={18} aria-hidden="true"/><input id="admin-password" name="password" required minLength={8} type={showPassword?"text":"password"} value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" disabled={loading} aria-describedby={error?"sign-in-error":undefined}/><button className={styles.passwordToggle} type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
            </div>
            {error&&<div className={styles.error} id="sign-in-error" role="alert">{error}</div>}
            <button className={styles.submit} disabled={loading} type="submit">{loading?<><span className={styles.spinner}/>Signing in…</>:<>Sign in <ArrowRight size={18} aria-hidden="true"/></>}</button>
          </form>

          <div className={styles.secureNote}><span className={styles.secureIcon}><ShieldCheck size={18}/></span><div><strong>One secure login</strong><p>Administrator, Staff and Developer accounts sign in here. Your account opens the right workspace.</p></div></div>
        </section>
        <a className={styles.backLink} href="/"><ArrowLeft size={14}/>Back to House of Ezra Giving</a>
      </div>
    </main>
  );
}
