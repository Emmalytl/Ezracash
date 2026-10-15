// Request-level checks with mocked auth/Neon; these do not write production data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let denied=false,transactions=[],failWrite=false,lastPicture=null,missing=false,checks=0;
const sql=(strings,...values)=>{
 const query=strings.join('?');
 return {query,values,then(resolve,reject){return Promise.resolve(query.includes('SELECT i.mime_type')?(lastPicture?[lastPicture]:[]):[]).then(resolve,reject);}};
};
sql.transaction=async queries=>{
 transactions.push(queries);
 if(failWrite)throw new Error('Mock picture storage failure');
 if(missing)return queries.map(()=>[]);
 const campaign=queries[0];
 const imageWrite=queries.find(q=>q.query.includes('INSERT INTO campaign_images'));
 if(imageWrite)lastPicture={mime_type:imageWrite.values[2],file_data:'\\x'+imageWrite.values[4].toString('hex')};
 return [[{id:'11111111-1111-4111-8111-111111111111',image:campaign.values.find(v=>typeof v==='string'&&v.startsWith('/api/campaign-images/'))||''}],...queries.slice(1).map(()=>[])];
};
const mocks={'@/lib/db':{sqlClient:()=>sql},'./db':{sqlClient:()=>sql},'@/lib/auth':{requireRole:async roles=>{assert.deepEqual(Array.from(roles),['developer','administrator','staff']);if(denied)throw new Error('UNAUTHORIZED');return {id:'actor',sessionId:'session'};}},'@/lib/data':{ensureCampaignSchema:async()=>{},listCampaigns:async()=>[]},'@/lib/campaignImages':{campaignImage:x=>x,campaignDescription:(_,d)=>d}};
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>mocks[name]||require(name),Buffer,File,URL,Uint8Array,ArrayBuffer,console});return exports;}
const rules=load('src/lib/campaign-upload.ts');mocks['./campaign-upload']=rules;
const media=load('src/lib/campaign-media.ts');mocks['@/lib/campaign-media']=media;
mocks['@/lib/receipts']=load('src/lib/receipts.ts');
const campaignRoute=load('src/app/api/campaigns/route.ts');
const imageRoute=load('src/app/api/campaign-images/[id]/route.ts');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=','base64');
function request(photo,extra={}){const fd=new FormData();for(const [k,v] of Object.entries({title:'Campaign with a photo',goal:'5000',status:'active',...extra}))fd.set(k,v);if(photo)fd.set('photo',photo);return new Request('http://test/api/campaigns',{method:'POST',body:fd});}
function json(extra={}){return new Request('http://test/api/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'No picture needed',goal:5000,status:'active',...extra})});}
async function status(req,expected){const r=await campaignRoute.POST(req);assert.equal(r.status,expected,JSON.stringify(await r.clone().json()));checks++;return r;}
(async()=>{
 await status(json(),201);assert.equal(transactions.at(-1).length,2);checks++;
 await status(json({image:'https://example.com/photo.jpg'}),201);
 const upload=await status(request(new File([png],'photo.png',{type:'image/png'})),201);
 const saved=await upload.json();assert.match(saved.image,/^\/api\/campaign-images\/[0-9a-f-]+$/);checks++;
 const queries=transactions.at(-1);assert.equal(queries.length,3);assert(queries[1].query.includes('INSERT INTO campaign_images'));assert(Buffer.isBuffer(queries[1].values[4]));checks++;
 const downloaded=await imageRoute.GET(new Request('http://test'+saved.image),{params:Promise.resolve({id:saved.image.split('/').at(-1)})});
 assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),png);checks++;
 await status(request(new File([png],'photo.png',{type:'image/png'}),{action:'update',id:'11111111-1111-4111-8111-111111111111'}),200);
 await status(json({action:'update',id:'11111111-1111-4111-8111-111111111111',image:saved.image}),200);
 await status(json({action:'update',id:'11111111-1111-4111-8111-111111111111',image:''}),200);
 const before=transactions.length;
 await status(request(new File(['<svg/>'],'photo.svg',{type:'image/svg+xml'})),400);
 await status(request(new File(['not a PNG'],'renamed.png',{type:'image/png'})),400);
 await status(request(new File([Buffer.alloc(rules.MAX_CAMPAIGN_PHOTO_BYTES+1)],'large.png',{type:'image/png'})),400);
 await status(request(new File([],'empty.png',{type:'image/png'})),400);
 await status(json({image:'javascript:alert(1)'}),400);
 assert.equal(transactions.length,before);checks++;
 denied=true;await status(request(new File([png],'photo.png',{type:'image/png'})),401);denied=false;
 assert.equal(transactions.length,before);checks++;
 missing=true;await status(json({action:'update',id:'11111111-1111-4111-8111-111111111111'}),404);missing=false;
 failWrite=true;await status(request(new File([png],'photo.png',{type:'image/png'})),500);failWrite=false;
 const notFound=await imageRoute.GET(new Request('http://test/image'),{params:Promise.resolve({id:'bad-id'})});assert.equal(notFound.status,404);checks++;
 console.log(`Passed ${checks} campaign-picture checks with mocked auth/database: optional URLs, multipart creation/edit, public byte round trip, invalid files, auth, missing campaigns and storage errors.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
