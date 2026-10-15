const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let count = 0;
function check(name, fn) { return Promise.resolve().then(fn).then(() => { count++; console.log(`✓ ${name}`); }); }
const env = { PAYPAL_ENV:'sandbox', PAYPAL_CLIENT_ID:'test-client', PAYPAL_CLIENT_SECRET:'test-secret', ADMIN_SESSION_SECRET:'test-session', PAYPAL_VENMO_ENABLED:'true' };
const writes = [];
let storedGift, order, captureCalls=0, providerCalls=0, authorized=true;
const id = '12345678-1234-1234-1234-123456789abc';
const orderId = 'TESTORDER123456789';
function reset() {
  storedGift = { id, amount:'10.00',transaction_id:orderId,status:'pending',payment_provider:'paypal-sandbox' };
  order = { id:orderId,intent:'CAPTURE',status:'APPROVED',purchase_units:[{custom_id:id,amount:{currency_code:'USD',value:'10.00'}}] };
  writes.length=0; captureCalls=0; providerCalls=0; authorized=true;
}
const sql = async (strings,...values) => {
  const query=strings.join('?');
  if (/SELECT.*FROM sandbox_donations/.test(query)) return storedGift ? [{...storedGift}] : [];
  if (/SELECT id FROM campaigns/.test(query)) return [];
  writes.push({query,values});
  if (/SET status='completed'/.test(query) && storedGift?.status==='pending') storedGift.status='completed';
  return [];
};
const fakeFetch = async (url, options={}) => {
  providerCalls++;
  if (url.endsWith('/v1/oauth2/token')) return {ok:true,json:async()=>({access_token:'test-access'})};
  if (url.endsWith('/capture')) {
    captureCalls++;
    order = {...order,status:'COMPLETED',purchase_units:[{...order.purchase_units[0],payments:{captures:[{id:'CAPTURE123',status:'COMPLETED',amount:{currency_code:'USD',value:'10.00'}}]}}]};
  }
  return {ok:true,json:async()=>order};
};
const cache={};
function load(file, overrides={}) {
  if(cache[file] && !Object.keys(overrides).length) return cache[file];
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports={};
  const req = name => {
    if(name in overrides) return overrides[name];
    if(name==='@/lib/db') return {sqlClient:()=>sql};
    if(name==='@/lib/auth') return {requireRole:async()=>{if(!authorized)throw Error('UNAUTHORIZED');}};
    if(name==='@/lib/payments/receipt-token') return {verifyReceiptToken:t=>t==='valid-token'?id:null,createReceiptToken:()=> 'valid-token'};
    if(name==='next/server') return {NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}};
    if(name==='./providers') return load('src/lib/payments/providers.ts');
    if(name.startsWith('@/lib/')) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  vm.runInNewContext(source,{exports,require:req,process:{env},Buffer,fetch:fakeFetch,AbortSignal,URLSearchParams});
  if(!Object.keys(overrides).length)cache[file]=exports;
  return exports;
}
const providers=load('src/lib/payments/providers.ts');
const paypal=load('src/lib/payments/paypal.ts');
const capture=load('src/app/api/payments/paypal/capture/route.ts');
const status=load('src/app/api/payments/paypal/status/route.ts');
const create=load('src/app/api/payments/paypal/create-order/route.ts');
const admin=load('src/app/api/admin/payments/route.ts');
const request=(token='valid-token',oid=orderId)=>new Request('https://example.test/api',{method:'POST',headers:{authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({orderId:oid})});
(async()=>{
 reset();
 await check('Sandbox configured; secret is never exposed',()=>{const c=providers.paymentConfiguration();assert.equal(c.paypal.configured,true);assert(!JSON.stringify(c).includes('test-secret'));});
 await check('Missing credentials disables checkout',()=>{delete env.PAYPAL_CLIENT_SECRET;assert.equal(providers.paymentConfiguration().paypal.configured,false);env.PAYPAL_CLIENT_SECRET='test-secret';});
 await check('Live mode cannot activate PayPal',()=>{env.PAYPAL_ENV='live';assert.throws(paypal.requireSandbox);env.PAYPAL_ENV='sandbox';});
 await check('Venmo requires an explicit enable setting',()=>{env.PAYPAL_VENMO_ENABLED='false';assert.throws(()=>paypal.validatePayPalGift({amount:10,payment_method:'Venmo'}));env.PAYPAL_VENMO_ENABLED='true';});
 await check('Invalid amounts are rejected',()=>{for(const amount of [0,-1,0.49,NaN,Infinity,1.001,1000000])assert.throws(()=>paypal.validatePayPalGift({amount}));assert.equal(paypal.validatePayPalGift({amount:0.5}).amount,0.5);});
 await check('Monthly sandbox and invalid campaigns are rejected',()=>{assert.throws(()=>paypal.validatePayPalGift({amount:10,frequency:'Monthly'}));assert.throws(()=>paypal.validatePayPalGift({amount:10,donation_type:'campaign',campaign_id:'invalid'}));});
 await check('Invalid receipt blocks capture before provider calls',async()=>{const r=await capture.POST(request('bad'));assert.equal(r.status,401);assert.equal(providerCalls,0);});
 await check('Another order cannot use this receipt',async()=>{const r=await capture.POST(request('valid-token','ANOTHERORDER123'));assert.equal(r.status,404);assert.equal(providerCalls,0);});
 await check('Wrong amount or currency cannot be credited',()=>{const wrong=structuredClone(order);wrong.purchase_units[0].amount.value='0.01';assert.throws(()=>paypal.verifiedCapture(wrong,storedGift));wrong.purchase_units[0].amount.value='10.00';wrong.purchase_units[0].amount.currency_code='EUR';assert.throws(()=>paypal.verifiedCapture(wrong,storedGift));});
 await check('Wrong custom reference cannot be credited',()=>{const wrong=structuredClone(order);wrong.purchase_units[0].custom_id='another-id';assert.throws(()=>paypal.verifiedCapture(wrong,storedGift));});
 await check('Approval alone does not confirm payment',()=>assert.equal(paypal.verifiedCapture(order,storedGift),null));
 await check('Verified server capture confirms sandbox gift only',async()=>{const r=await capture.POST(request());assert.equal(r.status,200);assert.equal(r.body.status,'completed');assert.equal(storedGift.status,'completed');assert(writes.every(w=>!/(UPDATE|INSERT INTO) donations\b/.test(w.query)));});
 await check('Repeated capture reuses confirmed order without charging again',async()=>{await capture.POST(request());assert.equal(captureCalls,1);});
 await check('Capture amount mismatch fails verification',()=>{const wrong=structuredClone(order);wrong.purchase_units[0].payments.captures[0].amount.value='9.00';assert.throws(()=>paypal.verifiedCapture(wrong,storedGift));});
 await check('Multiple captures require review',()=>{const wrong=structuredClone(order);wrong.purchase_units[0].payments.captures.push(wrong.purchase_units[0].payments.captures[0]);assert.throws(()=>paypal.verifiedCapture(wrong,storedGift));});
 await check('Interrupted capture can be reconciled by signed status',async()=>{storedGift.status='pending';const r=await status.GET(request());assert.equal(r.status,200);assert.equal(r.body.status,'completed');});
 await check('Unapproved order remains pending',async()=>{reset();order.status='CREATED';const r=await capture.POST(request());assert.equal(r.body.status,'pending');assert.equal(captureCalls,0);assert.equal(writes.length,0);});
 await check('Unauthorized user cannot check admin credentials',async()=>{const before=providerCalls;authorized=false;const r=await admin.POST();assert.equal(r.status,401);assert.equal(providerCalls,before);authorized=true;});
 await check('Configuration check moves no money',async()=>{reset();const r=await admin.POST();assert.equal(r.status,200);assert.equal(captureCalls,0);assert.equal(writes.length,0);});
 await check('Bad sandbox credentials never expose provider errors',async()=>{const bad=load('src/app/api/admin/payments/route.ts',{'@/lib/payments/paypal':{paypalAccessToken:async()=>{throw Error('SECRET RESPONSE');}}});const r=await bad.POST();assert.equal(r.status,503);assert(!JSON.stringify(r.body).includes('SECRET RESPONSE'));});
 await check('Create rejects an inactive campaign before order creation',async()=>{reset();const r=await create.POST(new Request('https://example.test',{method:'POST',body:JSON.stringify({amount:10,donation_type:'campaign',campaign_id:id})}));assert.equal(r.status,400);assert.equal(providerCalls,0);});
 console.log(`Passed ${count} PayPal/Venmo sandbox security and configuration checks (mocked provider/database).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
