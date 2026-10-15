// Check the actual production server with payments deliberately unconfigured.
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const port=3199,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:{...process.env,PAYPAL_CLIENT_SECRET:'',CASH_APP_ENABLED:'false',ZELLE_ENABLED:'false',PAYPAL_WEBHOOK_ID:''}});
let logs='';for(const s of [server.stdout,server.stderr])s.on('data',d=>logs=(logs+d).slice(-3000));
(async()=>{try{
 let ready=false;for(let n=0;n<60;n++){try{await fetch(base+'/api/payments/config',{signal:AbortSignal.timeout(500)});ready=true;break;}catch{await delay(200);}}assert(ready,logs);
 let response=await fetch(base+'/api/payments/config');assert.equal(response.status,200);const c=await response.json();assert.equal(c.paypal.configured,false);assert.equal(c.cashApp.recipient,null);assert.equal(c.zelle.recipient,null);assert(!('stripe'in c));
 response=await fetch(base+'/api/payments/stripe/create-intent',{method:'POST',body:'{}'});assert.equal(response.status,404);
 response=await fetch(base+'/api/payments/paypal/create-order',{method:'POST',body:'{}'});assert.equal(response.status,503);
 response=await fetch(base+'/api/payments/paypal/webhook',{method:'POST',body:'{}'});assert.equal(response.status,503);
 response=await fetch(base+'/api/admin/payments',{method:'POST'});assert.equal(response.status,401);
 response=await fetch(base+'/api/payments/paypal/subscription',{method:'POST',body:'{}'});assert.equal(response.status,503);
 console.log('Passed 6 built-server payment route checks (unconfigured environment; no database/payment calls).');
}catch(e){console.error(e);process.exitCode=1;}finally{server.kill('SIGTERM');}})();
