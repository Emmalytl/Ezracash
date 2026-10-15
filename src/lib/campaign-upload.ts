// Keep browser and server limits consistent, with room for multipart form data.
export const MAX_CAMPAIGN_PHOTO_BYTES = 3 * 1024 * 1024;
export const CAMPAIGN_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function campaignPhotoError(file: Pick<File, 'size' | 'type'>): string {
  if (!file.size) return 'Choose a picture that is not empty.';
  if (file.size > MAX_CAMPAIGN_PHOTO_BYTES) return 'Choose a picture smaller than 3 MB.';
  if (!CAMPAIGN_PHOTO_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP picture.';
  return '';
}
