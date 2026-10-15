// Exercise actual checkout initialization with provider SDK doubles; never makes payments.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/components/PayPalCheckout.tsx', 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
async function check(method, options = {}) {
 const calls = [], messages = [], effects = [], nodes = new Map();
 const node = id => {if(!nodes.has(id))nodes.set(id,{appendChild:()=>calls.push('google-button'),replaceChildren:()=>{}});return nodes.get(id);};
 const sdk = {
  FUNDING:{PAYPAL:'paypal'},
  Buttons:()=>{calls.push('paypal');return {isEligible:()=>true,render:async()=>{},close:()=>{}};},
  CardFields:()=>{calls.push('card');return {isEligible:()=>true,...Object.fromEntries(['NameField','NumberField','ExpiryField','CVVField'].map(k=>[k,()=>({render:async()=>calls.push(k)})])),close:()=>{}};},
  Googlepay:()=>{calls.push('google');return {config:async()=>({isEligible:options.eligible!==false,allowedPaymentMethods:[{}],merchantInfo:{}})};},
  Applepay:()=>{calls.push('apple');return {config:async()=>({isEligible:options.eligible!==false})};}
 };
 const win = {ezraPayPal:sdk,ApplePaySession:{canMakePayments:()=>options.device!==false},google:{payments:{api:{PaymentsClient:function(){return {isReadyToPay:async()=>({result:options.device!==false}),createButton:()=>({})};}}}}};
 const context = {exports:{},URLSearchParams,Map,Promise,window:win,document:{getElementById:node,createElement:()=>({setAttribute:()=>{}}),head:{appendChild:el=>queueMicrotask(()=>el.onload())}},require:name=>{
  if(name==='react')return {useRef:initial=>({current:initial===null?{}:initial}),useId:()=>':r1:',useState:initial=>[initial,value=>messages.push(value)],useEffect:fn=>effects.push(fn)};
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='lucide-react')return new Proxy({}, {get:()=>()=>null});
  if(name.endsWith('.css'))return {default:new Proxy({}, {get:(_,k)=>k})};
  throw Error(name);
 }};
 vm.runInNewContext(code,context);
 context.exports.default({clientId:'test',mode:'sandbox',applePay:options.enabled!==false,googlePay:options.enabled!==false,method,gift:{amount:5},onBusyChange:()=>{},onSubmitted:()=>{throw Error('Initialization must not create an order');},onResult:()=>{throw Error('Initialization must not confirm a payment');},onFailure:()=>{}});
 const dispose=effects[0]();
 for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve));
 dispose();
 return {calls,messages};
}
(async()=>{
 let r=await check('Card');assert(r.calls.includes('card'));assert.equal(r.calls.some(x=>['paypal','google','apple'].includes(x)),false);
 r=await check('PayPal');assert.deepEqual(r.calls,['paypal']);
 r=await check('Google Pay');assert.deepEqual(r.calls,['google','google-button']);
 r=await check('Apple Pay');assert.deepEqual(r.calls,['apple']);assert(r.messages.includes(true));
 for(const method of ['Google Pay','Apple Pay']) {
  r=await check(method,{enabled:false});assert.deepEqual(r.calls,[]);assert(r.messages.some(x=>typeof x==='string'&&x.includes('not enabled')));
  r=await check(method,{eligible:false});assert(!r.calls.includes('card'));assert(!r.calls.includes('google-button'));assert(r.messages.some(x=>typeof x==='string'&&x.includes('unavailable for this merchant')));
  r=await check(method,{device:false});assert(!r.calls.includes('card'));assert(!r.calls.includes('google-button'));assert(r.messages.some(x=>typeof x==='string'&&x.includes('unavailable on this device')));
 }
 console.log('10 checkout panel cases passed: isolated payment methods, disabled wallets, merchant and device eligibility; no payment created.');
})().catch(e=>{console.error(e);process.exit(1);});
