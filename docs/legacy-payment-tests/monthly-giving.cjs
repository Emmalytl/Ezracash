const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const id='12345678-1234-1234-1234-123456789abc';
let writes=[];let invoice={id:'in_test',subscription:'sub_test',customer:'cus_test',currency:'usd',status:'paid',amount_paid:1000};
const record={id,amount:10,provider_subscription_id:'sub_test',campaign_id:null,donation_type:'general',donor_name:'Anonymous',donor_email:'test@example.com'};
const sql=async(strings,...values)=>{const query=strings.join('?');writes.push(query);if(query.includes('SELECT * FROM giving_subscriptions'))return [record];return [];};
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>mocks[name]||require(name)});return exports;}
const helpers=load('src/lib/payments/subscriptions.ts',{'@/lib/db':{sqlClient:()=>sql}});
assert.equal(helpers.invoiceSubscriptionId({subscription:'sub_old'}),'sub_old');
assert.equal(helpers.invoiceSubscriptionId({parent:{subscription_details:{subscription:'sub_new'}}}),'sub_new');
assert.equal(helpers.invoiceSubscriptionId({}),null);
const {handleSubscriptionEvent}=load('src/lib/payments/subscription-webhook.ts',{'@/lib/db':{sqlClient:()=>sql},'./subscriptions':{...helpers,ensureSubscriptionSchema:async()=>{}},'./stripe':{stripeRetrieve:async path=>path.startsWith('subscriptions/')?{id:'sub_test',customer:'cus_test',status:'active',metadata:{giving_subscription_id:id}}:invoice}});
(async()=>{
 await handleSubscriptionEvent({id:'evt_paid',type:'invoice.paid',data:{object:invoice}});
 assert.equal(writes.filter(q=>q.includes('INSERT INTO donations')).length,1);
 writes=[];await handleSubscriptionEvent({id:'evt_checkout',type:'checkout.session.completed',data:{object:{subscription:'sub_test'}}});
 assert.equal(writes.filter(q=>q.includes('INSERT INTO donations')).length,0);
 writes=[];await handleSubscriptionEvent({id:'evt_failed',type:'invoice.payment_failed',data:{object:invoice}});
 assert.equal(writes.filter(q=>q.includes('INSERT INTO donations')).length,0);
 writes=[];invoice={...invoice,amount_paid:999};await assert.rejects(()=>handleSubscriptionEvent({id:'evt_wrong',type:'invoice.paid',data:{object:invoice}}),/does not match/);
 assert.equal(writes.filter(q=>q.includes('INSERT INTO donations')).length,0);
 invoice={...invoice,amount_paid:1000,customer:'cus_wrong'};await assert.rejects(()=>handleSubscriptionEvent({id:'evt_customer',type:'invoice.paid',data:{object:invoice}}),/does not match/);
 assert.equal(writes.filter(q=>q.includes('INSERT INTO donations')).length,0);
 console.log('Passed 10 monthly-giving checks with mocked provider/database: invoice formats, paid-only ledger writes, amount and customer mismatches.');
})().catch(error=>{console.error(error);process.exitCode=1;});
