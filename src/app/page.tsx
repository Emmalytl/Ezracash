"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import GivingSelector from "../components/GivingSelector";
import { Heart, ArrowUpRight, Sprout, Church, ChevronDown, CreditCard } from "lucide-react";
import type { Campaign } from "../lib/data";

const PayPalSandboxCheckout = dynamic(() => import("../components/PayPalSandboxCheckout"), { ssr: false });
const StripePaymentForm = dynamic(() => import("../components/StripePaymentForm"), { ssr: false });




const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);


const progress = (c: Campaign) => c.goal > 0 ? Math.min(100, Math.max(0, Math.round(c.amount / c.goal * 100))) : 0;
type Modal = "give" | "campaign" | "payment" | null;

export default function Home() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [campaignsData, setCampaignsData] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign>({id:'0',title:'General Offering',category:'GIVING',amount:0,goal:0,image:'',description:'Support the work of House of Ezra.',status:'active'});
  const [amount, setAmount] = useState(100);
  const [customAmount, setCustomAmount] = useState("");
  const [recurringConsent, setRecurringConsent] = useState(false);
  const [frequency, setFrequency] = useState("One-time");
  useEffect(() => { setRecurringConsent(false); }, [amount, selected.id]);
  const [providerConfig, setProviderConfig] = useState<any>(null);
  useEffect(() => { fetch('/api/payments/config', {cache:'no-store'}).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setProviderConfig).catch(() => setProviderConfig(null)); }, []);
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const [methodLocked, setMethodLocked] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const checkoutBusyRef = useRef(false);
  const onCheckoutBusy = (busy: boolean) => { checkoutBusyRef.current = busy; setCheckoutBusy(busy); };
  const [paymentError, setPaymentError] = useState("");
  const [receiptToken, setReceiptToken] = useState("");
  const [confirmedGift, setConfirmedGift] = useState<any>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [campaignError, setCampaignError] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns", {cache:"no-store"});
        if (!response.ok) throw new Error("Fundraising information is temporarily unavailable. You can still give a general offering.");
        const rows: Campaign[] = await response.json();
        if (!Array.isArray(rows)) throw new Error("Could not load fundraising information.");
        setCampaignError(""); setCampaignsData(rows);
        setSelected(prev => rows.find(c => c.id === prev.id) || (['tithe','0','offering','campaign-gift'].includes(prev.id) ? prev : {id:'0',title:'General Offering',category:'GIVING',amount:0,goal:0,image:'',description:'Support the work of House of Ezra.',status:'active'}));
      } catch (error) { setCampaignError(error instanceof Error ? error.message : "Could not load fundraising information."); }
    };
    loadCampaigns();
    const timer = window.setInterval(loadCampaigns, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const scrollHome = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToFundraising = () => document.getElementById("fundraising")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const openCampaign = (campaign: Campaign) => { setSelected(campaign); setModal("campaign"); };
  const openGive = (campaign?: Campaign) => { setMethodLocked(false); setCopyMessage(""); setPaymentMethod("Card"); if (campaign) setSelected(campaign); setClientSecret(""); setPaymentError(""); setPaymentComplete(false); setConfirmedGift(null); setReceiptToken(""); setRecurringConsent(false); setModal("give"); };

  const givingType = selected.id === "tithe" ? "tithe" : selected.id === "0" ? "general" : selected.id === "offering" ? "offering" : "campaign";
  const givingCampaignId = givingType === "campaign" && selected.id !== "campaign-gift" ? selected.id : "";

  const validateGift = () => {
    if (!Number.isFinite(amount) || amount < 0.5 || amount > 999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) return "Enter an amount from $0.50 to $999,999.99 with no more than two decimal places.";
    if (givingType === "campaign" && !givingCampaignId) return "Choose a campaign before continuing.";
    if (frequency === "Monthly" && !donorEmail.trim()) return "An email is required to manage your monthly giving.";
    if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) return "Enter a valid email address or leave it blank.";
    return "";
  };
  const continueToPayment = () => {
    const error = validateGift(); setPaymentError(error); if (error) return;
    if (frequency === "Monthly") { if (!recurringConsent) { setPaymentError("Please agree to the monthly giving terms."); return; } void startMonthlyGiving(); return; }
    setModal("payment"); if (paymentMethod === "Card") void startStripePayment();
  };

  async function startMonthlyGiving() {
    setPaymentLoading(true); setPaymentError('');
    try {
      const response=await fetch('/api/payments/stripe/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,donation_type:givingType,campaign_id:givingCampaignId||null,donor_name:donorName||'Anonymous',donor_email:donorEmail,recurring_consent:recurringConsent})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||'Could not start monthly giving.');
      if(typeof data.url!=='string'||!data.url.startsWith('https://checkout.stripe.com/')) throw new Error('Invalid checkout destination.');
      window.location.assign(data.url);
    } catch(error) { setPaymentError(error instanceof Error?error.message:'Could not start monthly giving.'); setPaymentLoading(false); }
  }

  const startStripePayment = async (method = paymentMethod) => {
    setClientSecret(""); setPaymentComplete(false); setConfirmedGift(null); setReceiptToken(""); setConfirmationError("");
    setPaymentError("");
    const validationError = validateGift(); if (validationError) { setPaymentError(validationError); return; }
    if (givingType === "campaign" && !givingCampaignId) { setPaymentError("Choose a campaign for a Campaign Gift."); return; }
    setPaymentLoading(true);
    try {
      const r = await fetch("/api/payments/stripe/create-intent", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ amount, donation_type:givingType, campaign_id:givingCampaignId || null, donor_name:donorName || "Anonymous", donor_email:donorEmail, payment_method:method }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not start payment.");
      setReceiptToken(data.receiptToken || "");
      setClientSecret(data.clientSecret || "");
    } catch (e:any) { setPaymentError(e.message || "Could not start payment."); } finally { setPaymentLoading(false); }
  };

  async function checkConfirmation() {
    try {
      const response = await fetch('/api/payments/stripe/status', {headers:{Authorization:`Bearer ${receiptToken}`},cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not verify your gift.');
      setConfirmedGift(data); setConfirmationError('');
    } catch (error) { setConfirmationError(error instanceof Error ? error.message : 'Could not verify your gift.'); }
  }
  useEffect(() => {
    if (!paymentComplete || !receiptToken) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>, attempts = 0;
    const poll = async () => {
      try {
        const response = await fetch('/api/payments/stripe/status', {headers:{Authorization:`Bearer ${receiptToken}`},cache:'no-store'});
        const data = await response.json(); if (stopped) return;
        if (!response.ok) throw new Error(data.error || 'Could not verify your gift.');
        setConfirmedGift(data); setConfirmationError('');
        if (['completed','refunded','failed'].includes(data.status)) return;
      } catch (error) { if (!stopped) setConfirmationError(error instanceof Error ? error.message : 'Could not verify your gift.'); }
      if (!stopped && ++attempts < 20) timer = setTimeout(poll, 3000);
    };
    void poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [paymentComplete,receiptToken]);
  function downloadReceipt() {
    if (confirmedGift?.status !== 'completed') return;
    const content = ['HOUSE OF EZRA GIVING','Donation receipt',`Reference: ${confirmedGift.id}`,`Confirmed: ${new Date(confirmedGift.completed_at || confirmedGift.created_at).toLocaleString()}`,`Amount: ${money(Number(confirmedGift.amount))} USD`,`Giving type: ${confirmedGift.donation_type}`,`Payment method: ${confirmedGift.payment_method}`,`Transaction: ${confirmedGift.transaction_id}`,'Status: Confirmed','Thank you for supporting the ministry.'].join('\n');
    const url = URL.createObjectURL(new Blob([content], {type:'text/plain'}));
    const anchor = document.createElement('a'); anchor.href=url; anchor.download=`Ezracash-Receipt-${confirmedGift.id}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }

  // Keep keyboard focus inside the dialog and restore it when the dialog closes.
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!checkoutBusyRef.current) setModal(null); return; }
      if (event.key !== "Tab") return;
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href], iframe, [tabindex="0"]') || []).filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [modal]);

  // Feature missions separately; the grid keeps each remaining campaign once.
  const featuredCampaign = campaignsData.find(c => c.status === "active" && c.category.toUpperCase() === "MISSIONS")
    || campaignsData.find(c => c.status === "active" && c.category.toUpperCase() !== "BUILDING" && c.image && !c.image.includes("church-auditorium"));
  const gridCampaigns = campaignsData.filter(c => c.id !== featuredCampaign?.id);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.shell} ${styles.headerInner}`}>
          <button className={styles.logoButton} onClick={scrollHome} aria-label="Go to home">
            <Image src="/branding/house-of-ezra-logo-transparent.png" alt="House of Ezra Worldwide Ministries — Jehovah Adonai Assembly" width={596} height={445} className={styles.logoImage} priority sizes="(max-width: 640px) 132px, 190px" />
          </button>
          <nav className={styles.nav} aria-label="Main navigation">
            <button className={styles.navActive} onClick={scrollHome}>Home</button>
            <button onClick={scrollToFundraising}>Our Fundraising</button>
            <button className={styles.giveLink} onClick={() => openGive()}>Give Now</button>
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroPhoto} />
        <div className={styles.heroOverlay} />
        <div className={`${styles.shell} ${styles.heroContent}`}>
          <div className={styles.heroCopy}>
<h2 className={styles.heroBrandTitle}>HOUSE OF EZRA GIVING</h2>
<div className={styles.heroMarquee}>
  <div className={styles.heroMarqueeTrack}>
    <span>HOUSE OF EZRA GIVING</span><b>✦</b><span>GIVE WITH PURPOSE</span><b>✦</b><span>SUPPORT THE WORK OF GOD</span><b>✦</b>
    <span>HOUSE OF EZRA GIVING</span><b>✦</b><span>GIVE WITH PURPOSE</span><b>✦</b><span>SUPPORT THE WORK OF GOD</span><b>✦</b>
  </div>
</div>
<h1>A generous heart.<br /><span>A lasting impact.</span></h1>
<p>Give with purpose. Help us share the Gospel, care for our neighbours, and build a welcoming home for the next generation.</p>
            <div className={styles.heroActions}>
              <button className={styles.goldButton} onClick={() => openGive()}>Give Now <span>→</span></button>
              <button className={styles.outlineButton} onClick={scrollToFundraising}>Explore Our Fundraising</button>
            </div>
          </div>
          <div className={styles.heroVisuals}>
            <aside className={styles.heroInvitation}>
              <span className={styles.invitationIcon}><Heart size={25} strokeWidth={1.5}/></span>
              <div className={styles.eyebrow}>FAITH IN ACTION</div>
              <h2>Small acts of generosity.<br />Meaningful change.</h2>
              <p>Choose a cause close to your heart, or support the ministry with a tithe or offering.</p>
              <button onClick={() => openGive()}>Find your way to give <ArrowUpRight size={18}/></button>
              <small>One-time gifts · Monthly giving</small>
            </aside>
          <div className={styles.purposeOrb} aria-hidden="true">
            <div className={styles.orbitRing}>
              <svg className={styles.circularMarquee} viewBox="0 0 350 350" focusable="false">
                <defs><path id="giving-orbit" d="M 175 9 A 166 166 0 1 1 174.99 9" /></defs>
                <text textLength="1030" lengthAdjust="spacing"><textPath href="#giving-orbit">GIVE • SERVE • BUILD • REACH • GROW • GIVE • SERVE • BUILD • REACH • GROW • </textPath></text>
              </svg>
            </div>
            <div className={styles.orbCore}><small>HOUSE OF EZRA</small><strong>GIVE<br />WITH<br /><em>PURPOSE</em></strong><span>✦</span></div>
          </div>
          </div>

</div>
</section>

<section className={styles.purposeStrip} aria-label="Your giving makes a difference"><div className={`${styles.shell} ${styles.purposeGrid}`}>
  <div><Church size={24}/><span><strong>Build a home for ministry</strong><small>A welcoming place to worship and grow.</small></span></div>
  <div><Heart size={24}/><span><strong>Care for our community</strong><small>Compassion that reaches beyond our walls.</small></span></div>
  <div><Sprout size={24}/><span><strong>Invest in the next generation</strong><small>Help young people grow in faith.</small></span></div>
</div></section>
      {featuredCampaign && <section className={styles.featuredWrap} aria-label="Featured campaign">
        <div className={styles.shell}>
          <article className={styles.featured}>
            <div className={styles.featuredImage} style={{backgroundImage:`url(${featuredCampaign.image})`}}>
              <span className={styles.featuredTag}>FEATURED CAMPAIGN</span>
            </div>
            <div className={styles.featuredContent}>
              <div className={styles.smallLabel}>{featuredCampaign.category}</div>
              <h2>{featuredCampaign.title}</h2>
              <p>{featuredCampaign.description}</p>
              <div className={styles.featureProgress}>
                <div className={styles.featureNumbers}><strong>{money(featuredCampaign.amount)} <small>raised of {money(featuredCampaign.goal)}</small></strong><span>{progress(featuredCampaign)}%</span></div>
                <div className={styles.progressLine}><span style={{width:`${progress(featuredCampaign)}%`}}/></div>
              </div>
              <button className={styles.goldButton} onClick={()=>openCampaign(featuredCampaign)}>View Campaign <span>→</span></button>
            </div>
          </article>
        </div>
      </section>}

      <section className={styles.campaigns} id="fundraising">
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <div><div className={styles.sectionLabel}>OUR FUNDRAISING</div><h2>Make a Difference</h2></div>
            <span className={styles.sectionHint}>Choose a campaign to see details and give.</span>
          </div>
          {campaignsData.length === 0 && <p>{campaignError || "There are no campaigns to display right now. You can still give a general offering."}</p>}
          <div className={`${styles.campaignGrid} ${gridCampaigns.length === 4 ? styles.fourCampaigns : ""}`}>
            {gridCampaigns.map((campaign) => {
const percent = progress(campaign);
return (
  <button className={styles.campaignCard} key={campaign.id} onClick={() => openCampaign(campaign)}>
    <div className={styles.cardImage} style={{ backgroundImage: `url(${campaign.image || "/branding/church-auditorium-banner.webp"})` }} />
    <div className={styles.cardBody}>
      <div className={styles.cardLabel}>{campaign.category}</div>
      <h3>{campaign.title}</h3><p className={styles.cardDescription}>{campaign.description}</p>
                    <div className={styles.cardMoney}><strong>{money(campaign.amount)}</strong> of {money(campaign.goal)}</div>
                    <div className={styles.cardProgress}><span style={{ width: `${percent}%` }} /></div>
                    <div className={styles.cardBottom}><span>View Details</span><b>→</b></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.trust}>
        <div className={`${styles.shell} ${styles.trustGrid}`}>
          <div className={styles.trustItem}><span className={styles.trustIcon}>✓</span><div><strong>Secure Giving</strong><small>Your information is protected.</small></div></div>
          <div className={styles.trustItem}><span className={styles.trustIcon}>↻</span><div><strong>Give with Purpose</strong><small>Support the ministry with a one-time or monthly gift.</small></div></div>
          <div className={styles.trustItem}><span className={styles.trustIcon}>▤</span><div><strong>Digital Receipts</strong><small>Keep a record of your giving.</small></div></div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerInner}`}>
          <Image src="/branding/house-of-ezra-logo-transparent.png" alt="House of Ezra" width={596} height={445} className={styles.footerLogo} sizes="180px" />
          <div className={styles.footerContact}><strong>6030 Highway 85, Suite 206</strong><span>Riverdale, GA 30274</span></div>
          <div className={styles.footerContact}><strong>850-712-8760</strong><span>850-417-3107</span></div>
          <div className={styles.footerTagline}><h3>House of Ezra</h3><span>The place where Jesus lives</span></div>
        </div>
      </footer>

      <nav className={styles.mobileAppNav} aria-label="Mobile navigation">
        <button type="button" onClick={scrollHome}><span>⌂</span>Home</button>
        <button type="button" onClick={scrollToFundraising}><span>▤</span>Fundraising</button>
        <button type="button" onClick={() => openGive()}><span>＋</span>Give</button>
      </nav>

      {process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL?.startsWith('https://billing.stripe.com/') && <div className={styles.manageGiving}><a href={process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL}>Manage or cancel monthly giving →</a></div>}
      {modal && (
        <div className={styles.modalBackdrop} onMouseDown={(e) => { if (e.target === e.currentTarget && !checkoutBusyRef.current) setModal(null); }}>
          <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-label={modal === "give" ? "Give now" : modal === "payment" ? "Payment" : selected.title}>
            <button className={styles.closeButton} disabled={checkoutBusy} onClick={() => setModal(null)} aria-label="Close">×</button>
            {modal === "campaign" ? (
              <>
                <div className={styles.modalImage} style={{ backgroundImage: `url(${selected.image})` }} />
                <div className={styles.modalContent}>
                  <div className={styles.cardLabel}>{selected.category}</div>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
<div className={styles.modalStats}><div><strong>{money(selected.amount)}</strong><span>raised</span></div><div><strong>{money(selected.goal)}</strong><span>goal</span></div><div><strong>{progress(selected)}%</strong><span>complete</span></div></div>
<div className={styles.progressLine}><span style={{ width: `${progress(selected)}%` }} /></div>
                  <button className={styles.fullGoldButton} onClick={() => openGive(selected)}>Give to This Campaign <span>→</span></button>
                </div>
              </>
            ) : modal === "give" ? (
              <div className={styles.modalContent}>
                <div className={styles.modalKicker}>HOUSE OF EZRA GIVING</div>
<h2>Give with purpose.</h2>
<p className={styles.modalIntro}>{selected?.title ? `Your generosity makes a difference. Choose where it goes below.` : "Choose where you would like your gift to make an impact."}</p>
<GivingSelector campaigns={campaignsData} selected={selected} onChange={setSelected}/>
<div className={styles.formGroup}><label htmlFor="donor-name">Donor name</label><input id="donor-name" autoComplete="name" value={donorName} onChange={e=>setDonorName(e.target.value)} placeholder="Your name (optional)" /></div>
<div className={styles.formGroup}><label htmlFor="donor-email">{frequency === "Monthly" ? "Email for receipt (required for monthly giving)" : "Email for receipt (optional)"}</label><input id="donor-email" autoComplete="email" required={frequency === "Monthly"} type="email" value={donorEmail} onChange={e=>setDonorEmail(e.target.value)} placeholder="you@example.com" /></div>
<div className={styles.formGroup}><label>Frequency</label><div className={styles.segmented}>{["One-time", "Monthly"].map(f => <button type="button" key={f} aria-pressed={frequency === f} className={frequency === f ? styles.segmentActive : ""} onClick={() => {setFrequency(f);setRecurringConsent(false);setPaymentError("");}}>{f}</button>)}</div></div>
<div className={styles.formGroup}><label>Amount</label><div className={styles.amountGrid}>{[50,100,250,500].map(v => <button type="button" key={v} aria-pressed={amount === v && !customAmount} className={amount === v && !customAmount ? styles.amountActive : ""} onClick={() => { setAmount(v); setCustomAmount(""); }}>{money(v)}</button>)}</div><div className={styles.customAmount}><span>$</span><input aria-label="Other gift amount in US dollars" inputMode="decimal" placeholder="Other amount" value={customAmount} onChange={(e) => { setCustomAmount(e.target.value); setAmount(Number(e.target.value) || 0); }} /></div></div>
{frequency === "Monthly" && <label className={styles.recurringConsent}><input type="checkbox" checked={recurringConsent} onChange={event=>setRecurringConsent(event.target.checked)}/><span>I authorise <b>{money(amount)} USD now and every month</b> until I cancel. I can manage or cancel through the secure subscription portal.</span></label>}
{paymentError && <div className="payment-error" role="alert">{paymentError}</div>}
<button className={styles.fullGoldButton} disabled={paymentLoading} onClick={continueToPayment}>{paymentLoading ? "Preparing checkout…" : frequency === "Monthly" ? "Continue to Monthly Checkout" : "Continue to Payment"} <span>→</span></button>
<small className={styles.formNote}>Your gift is in USD. Review your details before payment.</small>
              </div>
            ) : (
              <div className={`${styles.modalContent} ${styles.paymentContent}`}>
                <div className={styles.paymentTop}>
                  <button className={styles.backButton} disabled={paymentComplete || paymentLoading || checkoutBusy || methodLocked} type="button" onClick={() => setModal("give")}>← Back</button>
                  <div className={styles.modalKicker}>HOUSE OF EZRA GIVING</div>
                </div>
                <h2>Payment method</h2>
                <div className={styles.checkoutSummary}><span><b>{selected?.title || "House of Ezra"}</b><small>{frequency} gift · USD</small></span><strong>{money(amount || 0)}</strong></div>
                <div className={styles.paymentMethodField}>
                  <label htmlFor="payment-method">How would you like to give?</label>
                  <div className={styles.paymentSelectWrap}>
                    <CreditCard size={20} aria-hidden="true" />
                    <select id="payment-method" value={paymentMethod} disabled={paymentLoading || paymentComplete || checkoutBusy || methodLocked} onChange={event => {
                      const method = event.target.value;
                      setPaymentMethod(method); setPaymentError(""); setCopyMessage("");
                      if (method === "Card" && !clientSecret) void startStripePayment("Card");
                    }}>
                      <option value="Card">Card · Apple Pay / Google Pay</option>
                      <option value="PayPal">PayPal</option>
                      <option value="Venmo">Venmo</option>
                      <option value="Zelle">Zelle · Bank transfer</option>
                    </select>
                    <ChevronDown size={18} aria-hidden="true" />
                  </div>
                </div>
                {paymentMethod === "Card" && providerConfig?.stripe?.mode === "test" && <div className={styles.paymentNotice}>Test mode · No real donation is collected.</div>}
                {paymentMethod === "Card" ? (
                  paymentComplete ? <section className={styles.confirmationPanel} aria-live="polite"><div className={styles.confirmationMark}>{confirmedGift?.status === 'completed' ? '✓' : '…'}</div><h3>{confirmedGift?.status === 'completed' ? 'Your gift is confirmed' : confirmedGift?.status === 'failed' ? 'Payment not confirmed' : 'Confirming your gift'}</h3><p>{confirmedGift?.status === 'completed' ? 'Thank you for supporting the ministry. Your donation has been recorded.' : confirmedGift?.status === 'failed' ? 'The ministry record reports that this payment failed. Contact the ministry if your bank shows a charge.' : 'Your payment has been submitted. We are waiting for the payment confirmation. Please do not pay again.'}</p><strong>{money(amount)} USD</strong>{confirmationError && <p role="alert">{confirmationError}</p>}{confirmedGift?.status === 'completed' ? <button type="button" className={styles.fullGoldButton} onClick={downloadReceipt}>Download receipt ↓</button> : <button type="button" className={styles.backButton} onClick={checkConfirmation}>Check confirmation</button>}</section> : clientSecret ? <StripePaymentForm clientSecret={clientSecret} donationId="" amount={money(amount || 0)} onBusyChange={onCheckoutBusy} onSuccess={()=>setPaymentComplete(true)} /> : <div className={styles.paymentPanel}>
                    <p className={styles.modalIntro}>Use your card, or donate with Apple Pay or Google Pay on a supported device.</p>
                    <button className={styles.fullGoldButton} type="button" disabled={paymentLoading} onClick={() => void startStripePayment("Card")}>{paymentLoading ? "Preparing secure checkout…" : "Try card checkout again"} <span>→</span></button>
                    {paymentError&&<div className="payment-error" role="alert">{paymentError}</div>}
                  </div>
                ) : paymentMethod === "PayPal" || paymentMethod === "Venmo" ? (
                  providerConfig?.[paymentMethod.toLowerCase()]?.configured && providerConfig?.paypal?.clientId ?
                    <PayPalSandboxCheckout key={paymentMethod} clientId={providerConfig.paypal.clientId} method={paymentMethod as "PayPal" | "Venmo"} gift={{amount,donation_type:givingType,campaign_id:givingCampaignId||null,donor_name:donorName||"Anonymous",donor_email:donorEmail,frequency}} onBusyChange={onCheckoutBusy} onSubmitted={()=>setMethodLocked(true)} /> :
                    <section className={styles.zellePanel} aria-live="polite"><span className={styles.paymentStatus}>Setup required</span><h3>{paymentMethod} donations</h3><p>{paymentMethod === "Venmo" ? "Venmo uses PayPal and requires an eligible US merchant and donor. Sandbox setup hasn’t been completed yet." : "PayPal sandbox hasn’t been connected yet. Please choose Card to complete a test gift."}</p><button type="button" className={styles.backButton} onClick={()=>{setPaymentMethod("Card");if(!clientSecret)void startStripePayment("Card");}}>Use Card instead →</button></section>
                ) : (
                  <section className={styles.zellePanel} aria-live="polite">
                    <span className={styles.paymentStatus}>{!providerConfig?.zelle?.configured ? "Setup required" : providerConfig.zelle.mode === "test" ? "Test preview · No transfer" : "Bank transfer · Manual verification"}</span>
                    <h3>Give with Zelle</h3>
                    {!providerConfig?.zelle?.configured ? <p>The ministry’s Zelle recipient details haven’t been configured yet. Choose another payment method.</p> : providerConfig.zelle.mode === "test" ? <p>This is a preview of the Zelle instructions. No recipient is displayed and no money should be sent. Test previews are excluded from donation totals.</p> : <>
                      <p>Open Zelle in your banking app. Verify the recipient name before sending <strong>{money(amount)} USD</strong>.</p>
                      <dl className={styles.zelleDetails}><div><dt>Recipient</dt><dd>{providerConfig.zelle.recipientName}</dd></div><div><dt>{providerConfig.zelle.recipientType === "phone" ? "Phone number" : "Email address"}</dt><dd>{providerConfig.zelle.recipient}</dd></div><div><dt>Gift memo</dt><dd>{selected.title} · {donorName || "Anonymous"}</dd></div></dl>
                      <button type="button" className={styles.backButton} onClick={async()=>{try{await navigator.clipboard.writeText(providerConfig.zelle.recipient);setCopyMessage("Recipient copied.");}catch{setCopyMessage("Select and copy the recipient shown above.");}}}>Copy recipient</button>
                      {copyMessage && <p role="status">{copyMessage}</p>}
                      <p className={styles.zelleFootnote}>Keep your bank confirmation. The ministry records your gift after checking that it has arrived in its bank account. This page does not send money or confirm a transfer.</p>
                    </>}
                  </section>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
