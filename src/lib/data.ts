import { campaignImage, campaignDescription } from "./campaignImages";
import { sqlClient } from './db';


let campaignSchemaReady = false;

export async function ensureCampaignSchema() {
  if (campaignSchemaReady) return;
  const sql = sqlClient();
  // Existing deployments may have a campaigns table created before the
  // optional image field was introduced. Add it safely without resetting data.
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT ''`;
  campaignSchemaReady = true;
}

export type Campaign = { id:string; title:string; category:string; amount:number; goal:number; image:string; description:string; status:string };

export const fallbackCampaigns: Campaign[] = [
  { id:'building', title:'Church Building Extension', category:'BUILDING', amount:0, goal:25000, image:'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=85', description:'Help us build a modern worship and ministry space for our growing church family. Every gift helps move the project closer to completion.', status:'active' },
  { id:'missions', title:'The Church Mission Outreach', category:'MISSIONS', amount:0, goal:15000, image:'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=85', description:'Support outreach, evangelism and practical ministry work through the church and its mission efforts.', status:'active' },
  { id:'community', title:'Community Support Fund', category:'BENEVOLENCE', amount:0, goal:10000, image:'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=85', description:'Help provide practical support to individuals and families in need through the church community.', status:'active' },
  { id:'youth', title:'Youth Ministry Program', category:'OUTREACH', amount:0, goal:8000, image:'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1200&q=85', description:'Help us equip and encourage the next generation through youth ministry, discipleship and activities.', status:'active' },
];

export async function listCampaigns(includeInactive=false) {
  await ensureCampaignSchema();
  const sql = sqlClient();
  const rows = includeInactive ? await sql`
    SELECT c.id, c.title, c.category, c.description, c.goal, c.image, c.status,
      COALESCE(SUM(CASE WHEN d.status='completed' THEN d.amount ELSE 0 END),0) AS amount
    FROM campaigns c LEFT JOIN donations d ON d.campaign_id=c.id
    GROUP BY c.id ORDER BY c.created_at ASC` : await sql`
    SELECT c.id, c.title, c.category, c.description, c.goal, c.image, c.status,
      COALESCE(SUM(CASE WHEN d.status='completed' THEN d.amount ELSE 0 END),0) AS amount
    FROM campaigns c LEFT JOIN donations d ON d.campaign_id=c.id
    WHERE c.status='active' GROUP BY c.id ORDER BY c.created_at ASC`;
  return rows.map((r:any)=>({id:String(r.id),title:r.title,category:r.category,description:campaignDescription(r.image,r.description),goal:Number(r.goal),amount:Number(r.amount),image:campaignImage(r.image),status:r.status}));
}
