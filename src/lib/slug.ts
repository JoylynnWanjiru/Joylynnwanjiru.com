// The one slug helper for tags, series and any URL built from a label (brief section 7).
// Lowercase ASCII words joined by hyphens; accents are dropped, symbols removed.
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
