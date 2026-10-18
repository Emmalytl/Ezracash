// Verify middleware and response headers on the actual built localhost server.
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const port=3201,base=`http://127.0.0.1:${port}`;
const environment={...process.env,PAYPAL_CLIENT_SECRET:'',PAYPAL_WEBHOOK_ID:''};
for(const key of ['DATABASE_URL','POSTGRES_URL_NO_SSL','POSTGRES_URL','POSTGRES_PRISMA_URL','POSTGRES_URL_NON_POOLING','DATABASE_URL_UNPOOLED','NEON_DATABASE_URL'])environment[key]='';
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe'],env:environment});
let log='';for(const s of [server.stdout,server.stderr])s.on('data',d=>log=(log+d).slice(-3000));
(async()=>{try{
 let ready=false;for(let n=0;n<60;n++){try{await fetch(base+'/admin',{signal:AbortSignal.timeout(500)});ready=true;break;}catch{await delay(200);}}assert(ready,log);
 const login=await fetch(base+'/admin');assert.equal(login.status,200);assert.equal(login.headers.get('x-frame-options'),'DENY');assert.equal(login.headers.get('x-content-type-options'),'nosniff');assert.match(login.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(login.headers.get('referrer-policy'),'strict-origin-when-cross-origin');assert.equal(login.headers.get('x-powered-by'),null);
 let response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 response=await fetch(base+'/api/donations',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'text/plain'},body:'{}'});assert.equal(response.status,415);
 response=await fetch(base+'/api/payments/paypal/webhook',{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'});assert.equal(response.status,503); // Passed origin middleware; provider configuration/signature remains mandatory.
 response=await fetch(base+'/api/health');assert.deepEqual(await response.json(),{ok:true});assert.match(response.headers.get('cache-control'),/no-store/);
 console.log('Passed 6 built-server security scenarios: headers, cross-origin login and donation rejection, login content type, signed-webhook boundary, minimal noncached health. No database or provider calls.');
}catch(e){console.error(e);process.exitCode=1;}finally{server.kill('SIGTERM');}})();
