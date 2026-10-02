"use client";

import { useEffect, useState } from "react";
import styles from "./pwa.module.css";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}

export default function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (isStandalone) return;
    const dismissed = window.localStorage.getItem("ezra-pwa-install-dismissed");
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setIos(isIOS);
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
      if (!dismissed) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (isIOS && !dismissed) setShow(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    setShow(false);
  }

  if (!show) return null;
  return (
    <aside className={styles.installCard} aria-label="Install House of Ezra Giving">
      <div className={styles.installIcon}>✦</div>
      <div className={styles.installCopy}>
        <strong>Add House of Ezra Giving</strong>
        <span>{ios ? "Tap Share, then Add to Home Screen to use Ezracash like an app." : "Install it on your phone for quick, app-like access to giving."}</span>
      </div>
      {!ios && installEvent && <button onClick={install}>Install</button>}
      <button className={styles.dismiss} onClick={() => { window.localStorage.setItem("ezra-pwa-install-dismissed", "1"); setShow(false); }} aria-label="Dismiss">×</button>
    </aside>
  );
}
