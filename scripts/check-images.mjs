// Warns about source images over 5 MB so the repo stays small (brief 12.4).
// The build resizes them anyway, so this never fails; in GitHub Actions the
// warnings show on the run summary.
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const LIMIT = 5 * 1024 * 1024;
const IMAGE = /\.(avif|gif|heic|jpe?g|png|svg|tiff?|webp)$/i;

const entries = await readdir('src/assets', { recursive: true, withFileTypes: true }).catch(() => []);
let large = 0;
for (const entry of entries.filter((item) => item.isFile() && IMAGE.test(item.name))) {
  const path = join(entry.parentPath, entry.name);
  const { size } = await stat(path);
  if (size <= LIMIT) continue;
  large += 1;
  const message = `${path} is ${(size / 1024 / 1024).toFixed(1)} MB (over 5 MB). Resize it before committing.`;
  console.log(process.env.GITHUB_ACTIONS ? `::warning file=${path}::${message}` : `Warning: ${message}`);
}
if (large === 0) console.log('No source images over 5 MB.');
