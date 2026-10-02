/** Replace the retired youth stock photo while preserving future admin image choices. */
export function campaignImage(image: string): string {
  if (typeof image === "string" && image.startsWith("https://images.unsplash.com/photo-1770843093640-c44ae557928b")) {
    return "/campaigns/youth-ministry.png";
  }
  return image;
}

/** Keep the illustration disclosure accurate for the replacement image. */
export function campaignDescription(image: string, description: string): string {
  if (campaignImage(image) === "/campaigns/youth-ministry.png") {
    return description.replace(
      "Illustrative stock photo; pictured children are not ministry participants.",
      "Illustrative generated image; pictured young people are not ministry participants."
    );
  }
  return description;
}
