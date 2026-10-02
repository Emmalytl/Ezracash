"use client";
import { useRef, useState } from 'react';
import { Elements, CardElement, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey, {developerTools:{assistant:{enabled:false}}}) : null;
type Props = {clientSecret:string;donationId:string;amount:string;onSuccess:()=>void};
type Shared = Props & {busy:boolean; acquire:()=>boolean; release:()=>void; fail:(message:string)=>void};

function Wallet({clientSecret,onSuccess,acquire,release,fail}:Shared) {
  const stripe=useStripe(); const elements=useElements(); const [available,setAvailable]=useState<boolean|null>(null);
  async function confirm(event:StripeExpressCheckoutElementConfirmEvent){
    if(!stripe||!elements||!acquire()){event.paymentFailed({message:'Please wait for the current payment to finish.'});return;}
    try {
      const submitted=await elements.submit();
      if(submitted.error)throw new Error(submitted.error.message||'Please check your wallet payment details.');
      const result=await stripe.confirmPayment({elements,clientSecret,confirmParams:{return_url:window.location.origin+'/?payment=complete'},redirect:'if_required'});
      if(result.error)throw new Error(result.error.message||'Wallet payment could not be completed.');
      if(result.paymentIntent?.status==='succeeded'||result.paymentIntent?.status==='processing')onSuccess();
      else throw new Error('Payment is not complete. Please try again.');
    } catch(error){const message=error instanceof Error?error.message:'Wallet payment could not be completed.';fail(message);event.paymentFailed({message});}
    finally{release();}
  }
  return <div style={{marginBottom:20}}><label className="card-entry-label">Apple Pay or Google Pay</label><ExpressCheckoutElement options={{buttonHeight:50,buttonType:{applePay:'donate',googlePay:'donate'},paymentMethods:{applePay:'always',googlePay:'always',link:'never',paypal:'never',amazonPay:'never',klarna:'never'}}} onReady={event=>setAvailable(Boolean(event.availablePaymentMethods?.applePay||event.availablePaymentMethods?.googlePay))} onConfirm={confirm}/><small className="formNote" aria-live="polite">{available===null ? "Checking wallet availability…" : available ? "Or enter your card details below." : "Apple Pay and Google Pay are unavailable in this browser right now. You can use your card below."}</small></div>;
}
function Card({clientSecret,amount,onSuccess,busy,acquire,release,fail}:Shared){
  const stripe=useStripe(); const elements=useElements(); const [complete,setComplete]=useState(false);
  async function submit(){
    if(!stripe||!elements||!acquire())return;
    try{
      const card=elements.getElement(CardElement);
      if(!card)throw new Error('The card form is still loading. Please try again.');
      const result=await stripe.confirmCardPayment(clientSecret,{payment_method:{card}});
      if(result.error)throw new Error(result.error.message||'Payment could not be completed.');
      if(result.paymentIntent?.status==='succeeded'||result.paymentIntent?.status==='processing')onSuccess();
      else throw new Error('Payment is not complete. Please try again.');
    }catch(error){fail(error instanceof Error?error.message:'Payment could not be completed.');}
    finally{release();}
  }
  return <><label className="card-entry-label">Card details</label><CardElement onChange={event=>{setComplete(event.complete);fail(event.error?.message||'');}} options={{disableLink:true,hidePostalCode:false,style:{base:{fontSize:'16px',color:'#183e59',fontFamily:'Arial, sans-serif','::placeholder':{color:'#899ca9'}},invalid:{color:'#a53737'}}}}/><button className="fullGoldButton" type="button" disabled={!stripe||!complete||busy} onClick={submit}>{busy?'Processing…':`Send payment · ${amount}`} <span>→</span></button></>;
}
export default function StripePaymentForm(props:Props){
  const lock=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const shared={...props,busy,acquire:()=>{if(lock.current)return false;lock.current=true;setBusy(true);setError('');return true;},release:()=>{lock.current=false;setBusy(false);},fail:setError};
  const options={clientSecret:props.clientSecret};
  // Separate Element groups let wallets submit without validating an empty card field.
  return <div className="stripe-checkout"><Elements stripe={stripePromise} options={options}><Wallet {...shared}/></Elements><Elements stripe={stripePromise} options={options}><Card {...shared}/></Elements>{error&&<div className="payment-error" role="alert">{error}</div>}<small className="formNote">Your payment is encrypted. House of Ezra does not store your card number or security code.</small></div>;
}
