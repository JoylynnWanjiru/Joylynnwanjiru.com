// pnpm check:launch: lists every TODO(joylynn) placeholder and fails if any
// launch blocker remains (brief rule 2 and section 10).
//   --report-only   print everything but always exit 0 (CI uses this until Phase 4)
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { launchReport } from '../build/launch.mjs';

const reportOnly = process.argv.includes('--report-only');

const entries = await readdir('src', { recursive: true, withFileTypes: true });
const files = await Promise.all(
  entries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative('.', full).split(sep).join('/'), text: await readFile(full, 'utf8') };
    }),
);

const { blockers, others } = launchReport(files);

if (others.length > 0) {
  console.log(`Placeholders to fill (not launch blockers): ${others.length}\n- ${others.join('\n- ')}\n`);
}

if (blockers.length === 0) {
  console.log('No launch blockers left.');
} else {
  const log = reportOnly ? console.log : console.error;
  log(`Launch blockers: ${blockers.length}\n- ${blockers.join('\n- ')}`);
  if (reportOnly) console.log('\n(report only: not failing)');
  else process.exit(1);
}
