import { randomUUID } from "node:crypto";
import { CampaignPhotoError, campaignPhotoBytes, ensureCampaignMediaSchema, validCampaignImageUrl } from "@/lib/campaign-media";
import { campaignImage, campaignDescription } from "@/lib/campaignImages";
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { sqlClient } from '@/lib/db';
import { listCampaigns, ensureCampaignSchema } from '@/lib/data';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminView = url.searchParams.get('admin') === '1';
  try {
    if (!adminView) {
      try {
        const rows = await listCampaigns(false);
        return NextResponse.json(rows);
      } catch {
        return NextResponse.json({error:'Fundraising information is temporarily unavailable.'},{status:503});
      }
    }
    await requireRole(['developer','administrator','staff']);
    await ensureCampaignSchema();
    const sql = sqlClient();
    const rows = await sql`
      SELECT c.id,c.title,c.category,c.description,c.goal,c.image,c.status,c.created_at,c.updated_at,
        COALESCE(SUM(CASE WHEN d.status='completed' THEN d.amount ELSE 0 END),0) AS amount
      FROM campaigns c LEFT JOIN donations d ON d.campaign_id=c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    return NextResponse.json(rows.map((r:any)=>({...r,id:String(r.id),image:campaignImage(r.image),description:campaignDescription(r.image,r.description),goal:Number(r.goal),amount:Number(r.amount)})));
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message === 'UNAUTHORIZED' ? 'Unauthorized' : e.message || 'Could not load campaigns.' },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const actor = await requireRole(['developer','administrator','staff']);
    let b: Record<string, any> = {};
    let photo: File | null = null;
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await request.formData();
      for (const [key,value] of form.entries()) if (typeof value === 'string') b[key] = value;
      const chosen = form.get('photo');
      if (chosen instanceof File) photo = chosen;
    } else b = await request.json();

    if (b.action && !['archive','update'].includes(b.action)) return NextResponse.json({error:'Invalid campaign action.'},{status:400});
    if (b.action && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(b.id||''))) return NextResponse.json({error:'Campaign id is required.'},{status:400});
    await ensureCampaignSchema();
    const sql = sqlClient();
    if (b.action === 'archive') {
      const rows = await sql`UPDATE campaigns SET status='archived',updated_at=NOW() WHERE id=${b.id} RETURNING id,title,status`;
      if (!rows[0]) return NextResponse.json({error:'Campaign not found.'},{status:404});
      await sql`INSERT INTO security_audit(action,admin_id,session_id,details) VALUES('campaign_archived',${actor.id},${actor.sessionId},${b.id+' · '+rows[0].title})`;
      return NextResponse.json(rows[0]);
    }
    const title = String(b.title || '').trim();
    const goal = Number(b.goal);
    const status = b.status || 'active';
    if (!title || !Number.isFinite(goal) || goal<=0 || !['active','paused','closed','archived'].includes(status)) return NextResponse.json({error:'Title and goal are required.'},{status:400});
    const bytes = photo ? await campaignPhotoBytes(photo) : null;
    const pictureId = photo ? randomUUID() : null;
    const image = pictureId ? `/api/campaign-images/${pictureId}` : validCampaignImageUrl(b.image);
    const id = b.action === 'update' ? String(b.id) : randomUUID();
    if (photo) await ensureCampaignMediaSchema();

    // Save the campaign, its picture and audit record in one transaction.
    // A failed picture write cannot leave a campaign pointing at a missing asset.
    const campaignQuery = b.action === 'update'
      ? sql`UPDATE campaigns SET title=${title},category=${b.category||'GENERAL'},description=${b.description||''},goal=${goal},image=${image},status=${status},updated_at=NOW() WHERE id=${id} RETURNING id,title,category,description,goal,image,status,created_at,updated_at`
      : sql`INSERT INTO campaigns(id,title,category,description,goal,image,status,created_at,updated_at) VALUES(${id},${title},${b.category||'GENERAL'},${b.description||''},${goal},${image},${status},NOW(),NOW()) RETURNING id,title,category,description,goal,image,status,created_at,updated_at`;
    const queries = [campaignQuery];
    if (photo && bytes && pictureId) queries.push(sql`INSERT INTO campaign_images(id,campaign_id,filename,mime_type,file_size,file_data) SELECT ${pictureId},c.id,${photo.name.slice(0,255)},${photo.type},${photo.size},${bytes} FROM campaigns c WHERE c.id=${id}`);
    queries.push(sql`INSERT INTO security_audit(action,admin_id,session_id,details) SELECT ${b.action==='update'?'campaign_updated':'campaign_created'},${actor.id},${actor.sessionId},${id+' · '+title+(photo?' · picture uploaded':'')} FROM campaigns c WHERE c.id=${id}`);
    const results = await sql.transaction(queries);
    const rows = results[0];
    if (!rows[0]) return NextResponse.json({error:'Campaign not found.'},{status:404});
    return NextResponse.json(rows[0],{status:b.action==='update'?200:201});
  } catch (e: any) {
    return NextResponse.json({error:e.message==='UNAUTHORIZED'?'Unauthorized':e.message||'Could not save campaign.'},{status:e.message==='UNAUTHORIZED'?401:e instanceof CampaignPhotoError?400:500});
  }
}
