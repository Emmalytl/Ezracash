'use client';
import { useEffect, useId, useRef, useState } from 'react';

type Gift={amount:number;donation_type:string;campaign_id:string|null;donor_name:string;donor_email:string;frequency:string};
type Props={clientId:string;mode:string;applePay:boolean;googlePay:boolean;method:'Card'|'PayPal';gift:Gift;onBusyChange:(busy:boolean)=>void;onSubmitted:()=>void;onResult:(result:any,token:string)=>void;onFailure:(message:string)=>void};
const scripts=new Map<string,Promise<any>>();
function script(src:string,namespace?:string){
 if(scripts.has(src))return scripts.get(src)!;
 const promise=new Promise<any>((resolve,reject)=>{const el=document.createElement('script');el.src=src;if(namespace)el.setAttribute('data-namespace',namespace);el.onload=()=>resolve(namespace?(window as any)[namespace]:true);el.onerror=()=>{scripts.delete(src);el.remove();reject(new Error('Secure payment tools could not load. Please check your connection.'));};document.head.appendChild(el);});scripts.set(src,promise);return promise;
}
export default function PayPalCheckout(props:Props){
 const latest=useRef(props);latest.current=props;
 const prefix='paypal'+useId().replace(/[^a-z0-9]/gi,'');
 const root=useRef<HTMLDivElement>(null), receipt=useRef(''),order=useRef(''),creating=useRef<Promise<string>|null>(null),fields=useRef<any>(null);
 const [message,setMessage]=useState('Preparing secure checkout…'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[cardReady,setCardReady]=useState(false);
 const [appleReady,setAppleReady]=useState(false);const appleAction=useRef<()=>void>(()=>{});
 function working(value:boolean){setBusy(value);latest.current.onBusyChange(value);}
 async function create(method:string){
  if(order.current)return order.current;
  if(creating.current)return creating.current;
  working(true);latest.current.onSubmitted();setError('');
  creating.current=(async()=>{const response=await fetch('/api/payments/paypal/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...latest.current.gift,payment_method:method})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not prepare your gift.');receipt.current=data.receiptToken;order.current=data.orderId;sessionStorage.setItem('ezra-paypal-receipt',receipt.current);return data.orderId;})();
  try{return await creating.current;}finally{creating.current=null;}
 }
 async function capture(orderId:string){
  working(true);
  try{const response=await fetch('/api/payments/paypal/capture',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${receipt.current}`},body:JSON.stringify({orderId})});const data=await response.json();if(!response.ok)throw new Error(data.error);const check=await fetch('/api/payments/paypal/status',{headers:{Authorization:`Bearer ${receipt.current}`},cache:'no-store'});const gift=await check.json();if(!check.ok)throw new Error(gift.error);latest.current.onResult(gift,receipt.current);return gift.status;}
  catch{latest.current.onResult({status:'pending',amount:latest.current.gift.amount,mode:latest.current.mode},receipt.current);return 'pending';}
  finally{working(false);}
 }
 function failure(reason?:string){working(false);if(receipt.current){latest.current.onResult({status:'pending',amount:latest.current.gift.amount,mode:latest.current.mode},receipt.current);}else{const text=reason||'Payment could not be started. Please try again.';setError(text);latest.current.onFailure(text);}}
 useEffect(()=>{
  let stopped=false;const cleanup:any[]=[];
  const p=new URLSearchParams({'client-id':props.clientId,currency:'USD',intent:'capture',components:['buttons','card-fields',...(props.applePay?['applepay']:[]),...(props.googlePay?['googlepay']:[])].join(','),'disable-funding':'credit,paylater,venmo'});
  if(props.mode==='sandbox')p.set('buyer-country','US');
  void script('https://www.paypal.com/sdk/js?'+p,'ezraPayPal').then(async sdk=>{
   if(stopped||!root.current)return;
   const handlers={createOrder:()=>create(props.method),onApprove:(d:any)=>capture(d.orderID),onCancel:()=>{working(false);if(receipt.current)latest.current.onResult({status:'pending',amount:latest.current.gift.amount,mode:latest.current.mode},receipt.current);else setMessage('Checkout cancelled. No donation has been confirmed.');},onError:()=>failure()};
   if(props.method==='PayPal'){
    const buttons=sdk.Buttons({...handlers,fundingSource:sdk.FUNDING.PAYPAL,style:{layout:'vertical',shape:'pill',height:48}});cleanup.push(buttons);if(buttons.isEligible())await buttons.render('#'+prefix+'-buttons');else setError('PayPal is unavailable in this browser.');
   }else{
    const card=sdk.CardFields({...handlers,style:{input:{'font-size':'16px',color:'#193b55'}}});fields.current=card;cleanup.push(card);
    if(card.isEligible()){
     await Promise.all([card.NameField().render('#'+prefix+'-name'),card.NumberField().render('#'+prefix+'-number'),card.ExpiryField().render('#'+prefix+'-expiry'),card.CVVField().render('#'+prefix+'-cvv')]);if(!stopped)setCardReady(true);
    }else setMessage('Direct card entry is unavailable for this account or browser. Choose PayPal to see available checkout options.');
    // Wallets are shown only when both merchant and device eligibility pass.
    if(props.googlePay)void(async()=>{
     const gp=sdk.Googlepay(),config=await gp.config();if(config.isEligible===false||!config.allowedPaymentMethods?.length||stopped)return;
     await script('https://pay.google.com/gp/p/js/pay.js');if(stopped)return;
     const client=new (window as any).google.payments.api.PaymentsClient({environment:props.mode==='live'?'PRODUCTION':'TEST',paymentDataCallbacks:{onPaymentAuthorized:async(data:any)=>{
      try{const id=await create('Google Pay');const confirmation=await gp.confirmOrder({orderId:id,paymentMethodData:data.paymentMethodData});if(!['APPROVED','PAYER_ACTION_REQUIRED'].includes(confirmation.status))throw new Error('Wallet authorization was not completed.');if(confirmation.status==='PAYER_ACTION_REQUIRED'){const auth=await gp.initiatePayerAction({orderId:id});if(auth.liabilityShift!=='POSSIBLE')throw new Error('Authentication was not completed.');}const status=await capture(id);return status==='completed'?{transactionState:'SUCCESS'}:{transactionState:'ERROR',error:{intent:'PAYMENT_AUTHORIZATION',message:'Check payment confirmation before retrying.',reason:'OTHER_ERROR'}};}catch{failure();return {transactionState:'ERROR',error:{intent:'PAYMENT_AUTHORIZATION',message:'Payment was not confirmed. Check confirmation before retrying.',reason:'PAYMENT_DATA_INVALID'}};}
     }}});
     const ready=await client.isReadyToPay({apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:config.allowedPaymentMethods});if(!ready.result||stopped)return;
     const button=client.createButton({buttonType:'donate',onClick:()=>{working(true);void client.loadPaymentData({apiVersion:2,apiVersionMinor:0,allowedPaymentMethods:config.allowedPaymentMethods,merchantInfo:config.merchantInfo,callbackIntents:['PAYMENT_AUTHORIZATION'],transactionInfo:{totalPriceStatus:'FINAL',totalPrice:latest.current.gift.amount.toFixed(2),currencyCode:'USD',countryCode:'US'}}).catch((e:any)=>{if(e.statusCode==='CANCELED')working(false);else failure();});}});
     document.getElementById(prefix+'-google')?.appendChild(button);
    })().catch(()=>{});
    if(props.applePay)void(async()=>{
     await script('https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js');const Session=(window as any).ApplePaySession;if(!Session||!Session.canMakePayments()||stopped)return;
     const ap=sdk.Applepay(),config=await ap.config();if(!config.isEligible||stopped)return;
     appleAction.current=()=>{
      const session=new Session(4,{countryCode:config.countryCode,currencyCode:'USD',supportedNetworks:config.supportedNetworks,merchantCapabilities:config.merchantCapabilities,total:{label:'House of Ezra Giving',amount:latest.current.gift.amount.toFixed(2)}});working(true);
      session.onvalidatemerchant=async(event:any)=>{try{const result=await ap.validateMerchant({validationUrl:event.validationURL,displayName:'House of Ezra Giving'});session.completeMerchantValidation(result.merchantSession);}catch{session.abort();failure('Apple Pay could not validate this merchant.');}};
      session.onpaymentauthorized=async(event:any)=>{try{const id=await create('Apple Pay');await ap.confirmOrder({orderId:id,token:event.payment.token,billingContact:event.payment.billingContact});session.completePayment(Session.STATUS_SUCCESS);await capture(id);}catch{session.completePayment(Session.STATUS_FAILURE);failure();}};
      session.oncancel=()=>working(false);session.begin();
     };setAppleReady(true);
    })().catch(()=>{});
   }
   if(!stopped)setMessage('Your payment details are handled securely by PayPal. Wallet buttons appear on eligible devices.');
  }).catch(e=>{if(!stopped)setError(e.message);});
  return()=>{stopped=true;latest.current.onBusyChange(false);for(const item of cleanup){try{void Promise.resolve(item.close?.()).catch(()=>{});}catch{}}document.getElementById(prefix+'-google')?.replaceChildren();};
 },[props.clientId,props.mode,props.method,props.applePay,props.googlePay,prefix]);
 return <section className="stripe-checkout" aria-label="Secure PayPal checkout" ref={root}>
  {props.mode==='sandbox'&&<p role="status">TEST MODE · No real money</p>}
  <p aria-live="polite">{message}</p>
  {props.method==='Card'&&<>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}><div id={prefix+'-google'}/>{appleReady&&<button type="button" disabled={busy} aria-label="Donate with Apple Pay" onClick={()=>appleAction.current()} style={{WebkitAppearance:'-apple-pay-button' as any,background:'black',color:'white',border:0,borderRadius:8,width:160,height:44}}>Apple Pay</button>}</div>
   <div hidden={!cardReady}><label>Cardholder name<div id={prefix+'-name'} style={{height:50}}/></label><label>Card number<div id={prefix+'-number'} style={{height:50}}/></label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>Expiry<div id={prefix+'-expiry'} style={{height:50}}/></label><label>Security code<div id={prefix+'-cvv'} style={{height:50}}/></label></div><button type="button" className="primary-button" disabled={busy} onClick={()=>{working(true);void fields.current.submit().catch(()=>failure('Please check your card details and try again.'));}}>{busy?'Processing…':`Donate $${props.gift.amount.toFixed(2)}`}</button></div>
  </>}
  <div id={prefix+'-buttons'}/>
  {error&&<p role="alert" className="payment-error">{error}</p>}
  <button type="button" className="secondary-button" disabled={busy} onClick={async()=>{const token=receipt.current||sessionStorage.getItem('ezra-paypal-receipt');if(!token){setMessage('Complete checkout first to check confirmation.');return;}working(true);try{const r=await fetch('/api/payments/paypal/status',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error);latest.current.onResult(data,token);}catch(e){setError(e instanceof Error?e.message:'Could not check confirmation.');}finally{working(false);}}}>Check previous payment</button>
 </section>;
}
