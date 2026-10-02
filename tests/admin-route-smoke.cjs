// Exercise the built server, not source text. Stop deployments that replace
// the login page with a protected dashboard and create a redirect loop.
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const port=Number(process.env.EZRA_ROUTE_TEST_PORT||3197);
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe']});
let log='';let launchError;
server.on('error',e=>{launchError=e;});
for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log=(log+d).slice(-4000);});
(async()=>{
 try{
  let ready=false;
  for(let n=0;n<75;n++){
   if(launchError)throw launchError;
   if(server.exitCode!==null)throw new Error(`Preview server exited: ${log}`);
   try{await fetch(`${base}/admin`,{redirect:'manual',signal:AbortSignal.timeout(1000)});ready=true;break;}catch{await delay(200);}
  }
  assert(ready,`Preview server did not start: ${log}`);
  for(const path of ['/admin','/admin?reason=expired']){
   const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(5000)});
   assert.equal(r.status,200,`${path} must show sign-in, not redirect. Check src/app/admin/page.tsx.`);
   assert.equal(r.headers.get('location'),null,`${path} must not redirect.`);
   const html=await r.text();
   assert.match(html,/type="password"/,'The login form must contain a password field.');
   assert.match(html,/type="email"/,'The login form must contain an email field.');
  }
  for(const path of ['/admin/administrator','/admin/developer','/admin/staff','/admin/staff/dashboard','/admin/security']){
   const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(5000)});
   assert.equal(r.status,307,`${path} must protect signed-out access.`);
   assert.equal(new URL(r.headers.get('location'),base).pathname,'/admin',`${path} must redirect to sign-in.`);
  }
  console.log('Passed 7 admin-route checks: login forms and all privileged signed-out redirects.');
 }catch(e){console.error('Admin route regression check failed:',e.message);process.exitCode=1;}
 finally{server.kill('SIGTERM');}
})();
