/** Resolve material open URL (external link or signed file URL from API). */
export function getMaterialUrl(material) {
  const external = String(material?.external_link ?? '').trim();
  if (external) {
    return external;
  }
  const fileUrl = String(material?.file_url ?? '').trim();
  return fileUrl || '#';
}
