import { sqlClient } from './db';
import { campaignPhotoError } from './campaign-upload';

export class CampaignPhotoError extends Error {}
let schemaReady = false;
export async function ensureCampaignMediaSchema() {
  if (schemaReady) return;
  const sql = sqlClient();
  // Store small campaign photos durably alongside the existing campaign data.
  await sql`CREATE TABLE IF NOT EXISTS campaign_images (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK(file_size > 0 AND file_size <= 3145728),
    file_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS campaign_images_campaign_idx ON campaign_images(campaign_id)`;
  schemaReady = true;
}

export async function campaignPhotoBytes(file: File): Promise<Buffer> {
  const error = campaignPhotoError(file);
  if (error) throw new CampaignPhotoError(error);
  const bytes = Buffer.from(await file.arrayBuffer());
  // Check the actual file signature; do not trust a renamed file or browser MIME.
  const png = bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16) === 'IHDR';
  const jpg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 20 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!((file.type === 'image/png' && png) || (file.type === 'image/jpeg' && jpg) || (file.type === 'image/webp' && webp))) {
    throw new CampaignPhotoError('The file is not a valid JPG, PNG or WebP picture.');
  }
  return bytes;
}

export function validCampaignImageUrl(value: unknown): string {
  const image = String(value || '').trim();
  if (!image) return '';
  if (image.length > 2048) throw new CampaignPhotoError('The image URL is too long.');
  if (/^\/(?!\/)[^\s\\]*$/.test(image)) return image;
  try { const url = new URL(image); if (['https:', 'http:'].includes(url.protocol)) return url.href; } catch {}
  throw new CampaignPhotoError('Enter a valid image URL, upload a picture, or leave it empty.');
}
