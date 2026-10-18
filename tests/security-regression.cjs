// Owner-authorized local audit. Provider, auth cookies, environment and database are isolated doubles.
// Regression assertions require the hardened behavior. No production data or payments.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),crypto=require('node:crypto');
let results=[];
const env={NODE_ENV:'production',ADMIN_SESSION_SECRET:'local-audit-only-secret-not-a-production-value'};
function load(path,mocks={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>mocks[n]||require(n),process:{env},Error,TypeError,Buffer,URL,File,Request,Response,TextDecoder,FormData,Uint8Array,ArrayBuffer,console:{error:()=>{},log:()=>{}},...extra});return exports;}
let actor={id:'11111111-1111-4111-8111-111111111111',sessionId:'22222222-2222-4222-8222-222222222222',role:'staff',email:'staff@example.test'};
let statements=[],mode='',count=0;const counters=new Map();
const sql=async(strings,...values)=>{const q=strings.join('?');statements.push({q,values});if(mode==='database-error')throw Error('AUDIT_INTERNAL_DATABASE_DIAGNOSTIC');if(q.includes('INSERT INTO login_rate_limits')){const key=values[0],hits=(counters.get(key)||0)+1;counters.set(key,hits);return [{hits,retry_after:900}];}if(q.includes('SELECT id,email,password_hash,role')){count++;return values[0]==='known@example.test'?[{id:actor.id,email:'known@example.test',password_hash:'dummy',role:'administrator'}]:[];}if(q.includes('INSERT INTO expenses'))return [{id:'expense-test'}];if(q.includes('INSERT INTO donations'))return [{id:'gift-test'}];if(q.includes('SELECT COUNT'))return [{count:0}];return [];};
const auth={requireUser:async()=>{if(!actor)throw Error('UNAUTHORIZED');return actor;},requireRole:async roles=>{if(!actor)throw Error('UNAUTHORIZED');if(!roles.includes(actor.role))throw Error('FORBIDDEN');return actor;},configured:()=>true,normalizeRole:x=>x,createSession:async()=> 'local-audit-token',sessionCookieName:()=> 'hoez_admin_session',sessionMaxAge:()=>900};
const originSecurity=load('src/lib/request-security.ts');
const loginBudget=load('src/lib/login-security.ts',{'./db':{sqlClient:()=>sql}});
const common={'@/lib/request-security':originSecurity,'@/lib/login-security':loginBudget,'@/lib/auth':auth,'@/lib/db':{sqlClient:()=>sql,getDatabaseEnvStatus:()=>({DATABASE_URL:true})},'@/lib/security':{ensureSecuritySchema:async()=>{},roleLabel:x=>x},'bcryptjs':{compare:async password=>password==='correct-test-password',hash:async()=> 'dummy-hash'}};
function request(body,headers={}){return new Request('https://local-audit.test/api',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});}
async function test(name,kind,fn){counters.clear();await fn();results.push({name,result:kind});console.log(kind+': '+name);}
(async()=>{
const login=load('src/app/api/auth/login/route.ts',common);
await test('Unknown email and wrong password share one generic response','PASS',async()=>{const a=await login.POST(request({email:'missing@example.test',password:'wrong'})),b=await login.POST(request({email:'known@example.test',password:'wrong'}));assert.equal(a.status,401);assert.equal(b.status,401);assert.deepEqual(await a.json(),await b.json());});
await test('10 attempts allowed, then 429 with Retry-After before credential lookup','PASS',async()=>{count=0;for(let i=0;i<10;i++)assert.equal((await login.POST(request({email:'known@example.test',password:'wrong'}))).status,401);const limited=await login.POST(request({email:'known@example.test',password:'wrong'}));assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');assert.equal(count,10);});
await test('Login cookie uses HttpOnly, Secure, SameSite=Lax and 900-second lifetime','PASS',async()=>{const r=await login.POST(request({email:'known@example.test',password:'correct-test-password'}));const c=r.headers.get('set-cookie');for(const pattern of [/HttpOnly/i,/Secure/i,/SameSite=lax/i,/Max-Age=900/i])assert.match(c,pattern);});
await test('Cross-origin login is rejected before credentials are checked','PASS',async()=>{const r=await login.POST(request({email:'known@example.test',password:'correct-test-password'},{origin:'https://untrusted.example','content-type':'text/plain'}));assert.equal(r.status,403);});
await test('Internal login exception is not returned to client','PASS',async()=>{mode='database-error';const r=await login.POST(request({email:'known@example.test',password:'wrong'}));assert.equal(r.status,503);assert.doesNotMatch((await r.json()).error,/AUDIT_INTERNAL_DATABASE_DIAGNOSTIC/);mode='';});
const staff=load('src/app/api/admin/staff/route.ts',common),security=load('src/app/api/admin/security/route.ts',common),payments=load('src/app/api/admin/payments/route.ts',{...common,'@/lib/payments/providers':{paymentConfiguration:()=>({})},'@/lib/payments/paypal':{paypalAccessToken:async()=> 'test'}});
await test('Staff cannot read user directory or developer security data','PASS',async()=>{assert.equal((await staff.GET()).status,403);assert.equal((await security.GET()).status,403);});
await test('Staff cannot promote itself to administrator','PASS',async()=>{assert.equal((await staff.PATCH(new Request('https://local-audit.test',{method:'PATCH',body:JSON.stringify({id:actor.id,role:'administrator'})}))).status,403);});
await test('Administrator cannot create another administrator','PASS',async()=>{actor.role='administrator';assert.equal((await staff.POST(request({email:'new@example.test',password:'temporary-test-password',role:'administrator'}))).status,403);actor.role='staff';});
await test('Signed-out user cannot read staff or payment configuration','PASS',async()=>{const saved=actor;actor=null;assert.equal((await staff.GET()).status,401);assert.equal((await payments.GET()).status,401);actor=saved;});
await test('Signed-out security endpoint returns 401','PASS',async()=>{const saved=actor;actor=null;assert.equal((await security.GET()).status,401);actor=saved;});
const expenses=load('src/app/api/admin/expenses/route.ts',{...common,'@/lib/receipts':load('src/lib/receipts.ts')});
await test('Expense endpoint rejects non-PNG bytes labeled image/png','PASS',async()=>{statements=[];const f=new FormData();f.set('description','Local audit only');f.set('amount','1');f.set('receipt',new File(['not an image; inert local audit text'],'fake.png',{type:'image/png'}));const r=await expenses.POST(new Request('https://local-audit.test',{method:'POST',body:f}));assert.equal(r.status,400);assert(!statements.some(x=>x.q.includes('INSERT INTO expenses')));});
await test('Staff expense is forced pending with no claimed approval','PASS',async()=>{statements=[];await expenses.POST(request({description:'Local audit only',amount:1,status:'recorded',approved_by:'untrusted'}));const s=statements.find(x=>x.q.includes('INSERT INTO expenses'));assert(s.values.includes('pending'));assert(!s.values.includes('untrusted'));});
await test('Oversized expense receipt is rejected','PASS',async()=>{const f=new FormData();f.set('description','Audit');f.set('amount','1');f.set('receipt',new File([Buffer.alloc(4*1024*1024+1)],'big.png',{type:'image/png'}));assert.equal((await expenses.POST(new Request('https://local-audit.test',{method:'POST',body:f}))).status,400);});
const donations=load('src/app/api/donations/route.ts',{...common,'@/lib/payments/zelle':{ZelleError:class extends Error{},recordZelleDonation:async()=>{},recordManualDonation:async()=>{}}});
await test('Staff cannot create a completed PayPal-labeled gift manually','PASS',async()=>{statements=[];const r=await donations.POST(request({amount:1,donation_type:'general',payment_method:'PayPal',status:'completed'}));assert.equal(r.status,400);assert(!statements.some(x=>x.q.includes('INSERT INTO donations')));});
const audit=load('src/app/api/admin/audit/route.ts',common);
await test('Client audit events are explicitly prefixed and cannot imitate server actions','PASS',async()=>{statements=[];assert.equal((await audit.POST(request({action:'role_changed',details:'inert local audit text'}))).status,200);assert(statements.some(x=>x.values.includes('client_role_changed')));assert(!statements.some(x=>x.values.includes('role_changed')));});
const receipt=load('src/lib/payments/receipt-token.ts');
await test('Receipt capability rejects tampering, extra segments and expired tokens','PASS',async()=>{const id=actor.id,token=receipt.createReceiptToken(id);assert.equal(receipt.verifyReceiptToken(token),id);assert.equal(receipt.verifyReceiptToken(token+'.extra'),null);assert.equal(receipt.verifyReceiptToken(token.replace(id,'33333333-3333-4333-8333-333333333333')),null);const payload=id+'.1';const sig=crypto.createHmac('sha256',env.ADMIN_SESSION_SECRET).update('donation-receipt:'+payload).digest('hex');assert.equal(receipt.verifyReceiptToken(payload+'.'+sig),null);});
let cookie='',lookups=0;
const sessionSql=async(strings,...values)=>{lookups++;const q=strings.join('?');assert(q.includes('s.revoked_at IS NULL'));assert(q.includes('s.expires_at>NOW()'));return [];};
const sessions=load('src/lib/auth.ts',{'next/headers':{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})},'./db':{getDatabaseUrl:()=> 'test-only-not-connected',sqlClient:()=>sessionSql}});
await test('Malformed or forged admin session is rejected before database access','PASS',async()=>{cookie='bad';assert.equal(await sessions.getAdminUser(),null);cookie=actor.sessionId+'|staff@example.test|'+'0'.repeat(64);assert.equal(await sessions.getAdminUser(),null);assert.equal(lookups,0);});
await test('Correctly signed session with no active database row is denied','PASS',async()=>{const p=actor.sessionId+'|staff@example.test';cookie=p+'|'+crypto.createHmac('sha256',env.ADMIN_SESSION_SECRET).update(p).digest('hex');assert.equal(await sessions.getAdminUser(),null);assert.equal(lookups,1);});
await test('Same-origin JSON login allowed; text/plain rejected; oversized body rejected','PASS',async()=>{
 assert.equal((await login.POST(request({email:'known@example.test',password:'wrong'},{origin:'https://local-audit.test'}))).status,401);
 assert.equal((await login.POST(request({email:'known@example.test',password:'wrong'},{'content-type':'text/plain'}))).status,415);
 assert.equal((await login.POST(request({padding:'x'.repeat(9000)}))).status,413);
});
await test('Valid PNG receipt bytes remain accepted; invalid PDF rejected','PASS',async()=>{
 const receiptRules=load('src/lib/receipts.ts');const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64');
 assert.deepEqual(await receiptRules.validatedReceiptBytes(new File([png],'photo.png',{type:'image/png'})),png);
 await assert.rejects(()=>receiptRules.validatedReceiptBytes(new File(['inert text'],'bad.pdf',{type:'application/pdf'})));
});
await test('Legitimate offline staff entry remains available and uses one donation/audit statement','PASS',async()=>{
 statements=[];const r=await donations.POST(request({amount:1,donation_type:'general',payment_method:'Cash',status:'completed'}));assert.equal(r.status,200);
 const writes=statements.filter(x=>x.q.includes('INSERT INTO donations'));assert.equal(writes.length,1);assert(writes[0].q.includes('INSERT INTO security_audit'));assert(writes[0].q.includes('CROSS JOIN audited'));
});
await test('Vercel IP budget blocks rotating account names and survives module reload','PASS',async()=>{
 env.VERCEL='1';const req=request({}, {'x-forwarded-for':'198.51.100.4'});
 try{
  for(let i=0;i<60;i++)assert.equal((await loginBudget.consumeLoginBudget(req,`attempt${i}@example.test`)).allowed,true);
  const coldModule=load('src/lib/login-security.ts',{'./db':{sqlClient:()=>sql}});
  assert.equal((await coldModule.consumeLoginBudget(req,'different@example.test')).allowed,false);
 }finally{delete env.VERCEL;}
});
await test('Origin validation uses destination Host when Next normalizes internal hostname','PASS',async()=>{
 assert.equal(originSecurity.mutationOriginAllowed(new Request('http://localhost:3201/api',{headers:{host:'127.0.0.1:3201',origin:'http://127.0.0.1:3201'}})),true);
 assert.equal(originSecurity.mutationOriginAllowed(new Request('https://ezracash.vercel.app/api',{headers:{host:'ezracash.vercel.app',origin:'https://untrusted.example'}})),false);
});
fs.mkdirSync('docs/security-evidence',{recursive:true});fs.writeFileSync('docs/security-evidence/fixed-security-results.json',JSON.stringify({revision:'086062e plus security hardening candidate',scope:'local doubles only; no production records touched',results},null,2));
console.log('Security regression cases: '+results.length+'; findings reproduced: '+results.filter(x=>x.result==='FINDING').length);
})().catch(e=>{console.error(e);process.exitCode=1;});
