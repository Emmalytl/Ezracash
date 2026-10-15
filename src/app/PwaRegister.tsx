"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, Share, Smartphone, X } from "lucide-react";
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
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const installEvent = useRef<BeforeInstallPromptEvent | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const installButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => setInstalled(standalone.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    // iPadOS can identify itself as a Mac when requesting desktop websites.
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
    checkInstalled();
    setReady(true);
    const onPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      installEvent.current = event;
    };
    const onInstalled = () => { installEvent.current = null; setInstalled(true); setInstructions(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    standalone.addEventListener("change", checkInstalled);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", checkInstalled);
    };
  }, []);

  // Keep the control on the public landing page. Never open instructions on arrival.
  useEffect(() => { setInstructions(false); }, [pathname]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (instructions && pathname === "/" && !installed) {
      if (!element.open) element.showModal();
    } else if (element.open) element.close();
  }, [instructions, pathname, installed]);

  async function install() {
    if (ios) { setInstructions(true); return; }
    const event = installEvent.current;
    if (!event) { setInstructions(true); return; }
    // Native prompts must run directly from this click, and each event is single-use.
    installEvent.current = null;
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch { setInstructions(true); }
    finally { setBusy(false); }
  }

  function closeInstructions() {
    setInstructions(false);
    installButton.current?.focus();
  }

  if (!ready || installed || pathname !== "/") return null;
  return <>
    <button ref={installButton} type="button" className={styles.installButton} onClick={() => void install()} disabled={busy} aria-haspopup="dialog" aria-label="Install House of Ezra Giving app">
      <span className={styles.buttonIcon}><ArrowDownToLine size={19} aria-hidden="true" /></span>
      <span>{busy ? "Opening installer…" : "Install app"}</span>
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="install-title" aria-describedby="install-description" onCancel={closeInstructions} onClose={closeInstructions} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeInstructions(); } }}>
      <button type="button" className={styles.close} onClick={closeInstructions} aria-label="Close installation instructions"><X size={20} /></button>
      <div className={styles.appIcon}><img src="/icon-192.png" alt="" width={62} height={62} /></div>
      <span className={styles.eyebrow}>HOUSE OF EZRA GIVING</span>
      <h2 id="install-title">{ios ? "Install on your iPhone or iPad" : "Keep giving one tap away"}</h2>
      <p id="install-description" className={styles.intro}>{ios ? "Add the app to your Home Screen using Safari. Follow these steps:" : "Your browser may offer installation through its menu. Follow these steps:"}</p>
      {ios ? <ol className={styles.steps}>
        <li><span>1</span><div><strong>Open this website in Safari</strong><p>If you are using another browser or an in-app browser, open the same website address in Safari.</p></div></li>
        <li><span>2</span><div><strong>Tap Share <Share size={15} aria-hidden="true" /></strong><p>Look for the square with an upward arrow. Depending on your Safari layout, it may be inside the More (…) menu.</p></div></li>
        <li><span>3</span><div><strong>Choose Add to Home Screen</strong><p>Scroll through the Share menu. If the option is missing, look under Edit Actions.</p></div></li>
        <li><span>4</span><div><strong>Tap Add</strong><p>Keep Open as Web App enabled if that option appears. Launch House of Ezra Giving from its new Home Screen icon.</p></div></li>
      </ol> : <ol className={styles.steps}>
        <li><span>1</span><div><strong>Open your browser menu</strong><p>In Chrome or Edge, look for Install app or Add to Home screen. You may also see an install icon in the address bar.</p></div></li>
        <li><span>2</span><div><strong>Confirm installation</strong><p>Follow your browser’s prompts, then open House of Ezra Giving using its app icon.</p></div></li>
      </ol>}
      <div className={styles.note}><Smartphone size={18} aria-hidden="true" /><span>{ios ? "No App Store download is needed." : "If installation is not offered, try an up-to-date Chrome or Edge browser. Installation availability depends on your browser."}</span></div>
      <button type="button" className={styles.done} onClick={closeInstructions}>Got it</button>
    </dialog>
  </>;
}
