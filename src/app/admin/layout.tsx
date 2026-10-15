"use client";
import "./dashboard-theme.css";
import studio from "./professional.module.css";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
function SessionActivity() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/admin' || pathname === '/admin/setup') return;
    let lastActivity = Date.now();
    let lastSent = 0;
    let idleTimer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const expire = async () => {
      stopped = true;
      try { await fetch('/api/auth/logout', {method:'POST'}); }
      finally { window.location.replace('/admin?reason=inactive'); }
    };
    const activity = () => {
      lastActivity = Date.now();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(expire, 15*60*1000);
    };
    const events = ['pointerdown','pointermove','keydown','touchstart','scroll'];
    events.forEach(event => window.addEventListener(event,activity,{passive:true}));
    activity();
    const timer = setInterval(async () => {
      if (stopped || document.hidden || lastActivity <= lastSent) return;
      lastSent = lastActivity;
      try {
        const response = await fetch('/api/auth/heartbeat', {method:'POST',headers:{'x-session-activity':'1'}});
        if (response.status === 401) { stopped=true; window.location.replace('/admin?reason=expired'); }
      } catch { /* A temporary network failure is retried after the next activity. */ lastSent=0; }
    }, 60*1000);
    return () => { stopped=true; clearTimeout(idleTimer); clearInterval(timer); events.forEach(event=>window.removeEventListener(event,activity)); };
  }, [pathname]);
  return null;
}

// Keep activity tracking here so the admin layout needs no companion import.
export const dynamic = 'force-dynamic';
export default function AdminLayout({children}:{children:React.ReactNode}) {
  return <div className={studio.studio}><SessionActivity />{children}</div>;
}
