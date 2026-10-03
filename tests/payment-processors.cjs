// Financial and configuration boundaries: providers are mocked; no funds move.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let count = 0;
const env = { ZELLE_ENABLED: 'true', ZELLE_MODE: 'live', ZELLE_RECIPIENT_NAME: 'Test Ministry', ZELLE_RECIPIENT_TYPE: 'email', ZELLE_RECIPIENT: 'test@example.test', ADMIN_SESSION_SECRET: 'test-secret' };
let campaignActive = true, authenticated = true, failAudit = false, statements = [], ledger = new Map();
const admin = { id: '00000000-0000-4000-8000-000000000001', sessionId: '00000000-0000-4000-8000-000000000002', role: 'administrator' };
const sql = async (strings, ...values) => {
  const query = strings.join('?'); statements.push({query, values});
  if (/SELECT id FROM campaigns/.test(query)) return campaignActive ? [{id: values[0]}] : [];
  if (/WITH received AS/.test(query)) {
    if (failAudit) throw Error('Audit unavailable');
    const reference = values[5];
    if (ledger.has(reference)) return [];
    const row = { id: `gift-${ledger.size}`, amount: values[4], transaction_id: reference, payment_method: 'Zelle', payment_provider: 'zelle-manual', status: 'completed' };
    ledger.set(reference, row); return [row];
  }
  return [];
};
function load(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source, { exports, process: {env}, require: name => {
    if (name === '@/lib/db') return {sqlClient: () => sql};
    if (name === './providers') return providers;
    if (name === '@/lib/payments/zelle') return zelle;
    if (name === '@/lib/auth') return {requireRole: async () => {if (!authenticated) throw Error('UNAUTHORIZED'); return admin;}};
    if (name === 'next/server') return {NextResponse: {json: (body, options = {}) => ({body, status: options.status || 200})}};
    return require(name);
  }});
  return exports;
}
const providers = load('src/lib/payments/providers.ts');
const zelle = load('src/lib/payments/zelle.ts');
const route = load('src/app/api/donations/route.ts');
const gift = () => ({amount: 25.50, payment_method: 'Zelle', donation_type: 'general', transaction_id: 'BANK-12345', bank_verified: true});
async function check(name, fn) { await fn(); count++; console.log(`✓ ${name}`); }
(async () => {
  await check('Zelle requires explicit enablement', () => {env.ZELLE_ENABLED='false';assert.equal(providers.paymentConfiguration().zelle.configured,false);assert.throws(()=>zelle.validateZelleRecord(gift(),admin));env.ZELLE_ENABLED='true';});
  await check('Invalid bank email is not published', () => {env.ZELLE_RECIPIENT='not-an-email';const c=providers.paymentConfiguration().zelle;assert.equal(c.configured,false);assert.equal(c.recipient,null);env.ZELLE_RECIPIENT='test@example.test';});
  await check('US phone format is validated', () => {env.ZELLE_RECIPIENT_TYPE='phone';env.ZELLE_RECIPIENT='123';assert.equal(providers.paymentConfiguration().zelle.configured,false);env.ZELLE_RECIPIENT='+12025550123';assert.equal(providers.paymentConfiguration().zelle.configured,true);env.ZELLE_RECIPIENT_TYPE='email';env.ZELLE_RECIPIENT='test@example.test';});
  await check('Test mode masks real recipient and blocks ledger writes', async () => {env.ZELLE_MODE='test';assert.equal(providers.paymentConfiguration().zelle.recipient,null);const before=statements.length;await assert.rejects(()=>zelle.recordZelleDonation(gift(),admin));assert.equal(statements.length,before);env.ZELLE_MODE='live';});
  await check('Unknown mode defaults to test', () => {env.ZELLE_MODE='LIVE';assert.equal(providers.paymentConfiguration().zelle.mode,'test');env.ZELLE_MODE='live';});
  await check('Staff cannot verify bank receipts', async () => {const before=statements.length;await assert.rejects(()=>zelle.recordZelleDonation(gift(),{...admin,role:'staff'}),e=>e.status===403);assert.equal(statements.length,before);});
  await check('Client verification must be a real boolean', () => {for(const bank_verified of [false,undefined,'true',1])assert.throws(()=>zelle.validateZelleRecord({...gift(),bank_verified},admin));});
  await check('Pending and refunded cannot become received Zelle gifts', () => {for(const status of ['pending','refunded','failed'])assert.throws(()=>zelle.validateZelleRecord({...gift(),status},admin));});
  await check('Exact amount and allowed limits are enforced', () => {for(const amount of [0,-1,Infinity,NaN,1.001,1000000])assert.throws(()=>zelle.validateZelleRecord({...gift(),amount},admin));assert.equal(zelle.validateZelleRecord({...gift(),amount:0.01},admin).amount,0.01);});
  await check('Bank reference is required and bounded', () => {for(const transaction_id of ['', 'a', 'x'.repeat(101), "<script>"])assert.throws(()=>zelle.validateZelleRecord({...gift(),transaction_id},admin));});
  await check('Reference normalization prevents case/space duplicates', () => assert.equal(zelle.validateZelleRecord({...gift(),transaction_id:' bank-12345 '},admin).reference,'BANK-12345'));
  await check('Invalid giving type, campaign and email are rejected', () => {for(const change of [{donation_type:'other'},{donation_type:'campaign',campaign_id:'bad'},{donor_email:'bad'}])assert.throws(()=>zelle.validateZelleRecord({...gift(),...change},admin));});
  await check('Inactive campaign cannot be credited', async () => {campaignActive=false;await assert.rejects(()=>zelle.recordZelleDonation({...gift(),donation_type:'campaign',campaign_id:'00000000-0000-4000-8000-000000000003'},admin));assert.equal(ledger.size,0);campaignActive=true;});
  await check('Bank-verified Zelle enters ledger with audit in one statement', async () => {const r=await zelle.recordZelleDonation(gift(),admin);assert.equal(r.status,'completed');assert.equal(r.payment_provider,'zelle-manual');const q=statements.at(-1);assert(q.query.includes('zelle_bank_receipt_verified'));assert(q.query.includes('ON CONFLICT'));assert(q.values.includes(admin.id));assert(q.values.includes(admin.sessionId));assert.equal(ledger.size,1);});
  await check('Duplicate reference cannot credit twice', async () => {await assert.rejects(()=>zelle.recordZelleDonation({...gift(),transaction_id:' bank-12345 '},admin),e=>e.status===409);assert.equal(ledger.size,1);});
  await check('Audit error propagates instead of reporting a received gift', async () => {failAudit=true;await assert.rejects(()=>zelle.recordZelleDonation({...gift(),transaction_id:'BANK-NEW'},admin));assert.equal(ledger.size,1);failAudit=false;});
  await check('Public caller cannot record a donation', async () => {authenticated=false;const before=statements.length;const r=await route.POST(new Request('https://example.test/api/donations',{method:'POST',body:JSON.stringify(gift())}));assert.equal(r.status,401);assert.equal(statements.length,before);authenticated=true;});
  await check('API applies Zelle checks to case/space variants', async () => {const r=await route.POST(new Request('https://example.test/api/donations',{method:'POST',body:JSON.stringify({...gift(),payment_method:' zElLe ',bank_verified:false})}));assert.equal(r.status,400);assert.equal(ledger.size,1);});
  await check('Cash App Pay cannot be enabled by environment toggles', () => {env.CASH_APP_ENABLED='true';env.STRIPE_CASH_APP_ENABLED='true';assert.equal(providers.paymentConfiguration().cashApp.configured,false);assert.equal(providers.paymentConfiguration().cashApp.mode,'unsupported');});
  await check('Mismatched Stripe key modes are marked unconfigured', () => {env.STRIPE_SECRET_KEY='sk_test_secret';env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY='pk_live_public';env.STRIPE_WEBHOOK_SECRET='whsec_secret';assert.equal(providers.paymentConfiguration().stripe.configured,false);});
  await check('Public configuration never exposes secrets', () => assert(!JSON.stringify(providers.paymentConfiguration()).includes('test-secret')));
  console.log(`Passed ${count} payment processor and Zelle integrity checks (mocked auth/database).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
