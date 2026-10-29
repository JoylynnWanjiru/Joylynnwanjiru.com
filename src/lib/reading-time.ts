// Reading time from body text only: frontmatter, code blocks, inline code,
// HTML/JSX tags and Markdown link targets are not counted (brief section 7).
export const WORDS_PER_MINUTE = 225;

export function countWords(markdown: string): number {
  const text = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') // frontmatter
    .replace(/^(```|~~~)[\s\S]*?^\1/gm, '') // fenced code blocks
    .replace(/`[^`\n]*`/g, '') // inline code
    .replace(/^\s*(import|export)\s.*$/gm, '') // MDX imports/exports
    .replace(/<[^>]+>/g, ' ') // HTML and JSX tags
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // keep link and image text, drop URLs
    .replace(/[#>*_~]/g, ' '); // Markdown emphasis and heading marks
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Whole minutes, at least 1. */
export function readingTime(markdown: string): number {
  return Math.max(1, Math.round(countWords(markdown) / WORDS_PER_MINUTE));
}
