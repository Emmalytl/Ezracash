'use client';
import { Check, X, LoaderCircle, RotateCcw, Download, ArrowRight } from 'lucide-react';
import styles from './DonationResult.module.css';
type Props = {status:'success'|'failed'|'pending'|'refunded';amount:string;testMode?:boolean;error?:string;onClose:()=>void;onCheck?:()=>void;onReceipt?:()=>void;onRetry?:()=>void};
// Display success only after a verified completed record; never infer it from submission.
export default function DonationResult({status,amount,testMode,error,onClose,onCheck,onReceipt,onRetry}:Props){
 const success=status==='success',pending=status==='pending';
 const title=success?'Donation successful':pending?'Checking your payment':status==='refunded'?'Donation refunded':'Payment unsuccessful';
 return <section className={`${styles.result} ${success?styles.success:pending?styles.pending:styles.failure}`} aria-live={pending?'polite':'assertive'} aria-atomic="true">
  <span className={styles.eyebrow}>HOUSE OF EZRA GIVING</span>
  <div className={styles.icon} aria-hidden="true">{success?<Check size={38}/>:pending?<LoaderCircle className={styles.spin} size={34}/>:status==='refunded'?<RotateCcw size={32}/>:<X size={36}/>}</div>
  <h2>{title}</h2>
  <p>{success?'Thank you for your generosity. Your gift has been confirmed and recorded.':pending?'Your payment was submitted. We’re checking its confirmation automatically. Please don’t pay again.':status==='refunded'?'This gift is marked refunded. Contact the ministry if you need help.':'We couldn’t complete this payment attempt. Review the details below.'}</p>
  <div className={styles.amount}>{amount}<span>USD</span></div>
  {testMode&&<span className={styles.test}>TEST MODE · No real money</span>}
  {error&&<p className={styles.error}>{error}</p>}
  {!pending&&!success&&<p className={styles.note}>If your bank shows a charge, check its confirmation before trying again.</p>}
  <div className={styles.actions}>
   {success?<><button className={styles.primary} type="button" onClick={onClose}>Done <ArrowRight size={17}/></button>{onReceipt&&<button className={styles.secondary} type="button" onClick={onReceipt}><Download size={16}/> Download receipt</button>}</>:<>
    {(pending||status==='failed')&&onCheck&&<button className={styles.primary} type="button" onClick={onCheck}>Check payment status</button>}
    {onRetry&&<button className={styles.primary} type="button" onClick={onRetry}>Return to card details</button>}
    <button className={styles.secondary} type="button" onClick={onClose}>{pending?'Close for now':'Close'}</button>
   </>}
  </div>
 </section>;
}
