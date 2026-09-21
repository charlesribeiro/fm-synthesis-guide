import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../dist/pages/browser/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
if (!html.includes('<base href="/fm-synthesis-guide/">')) {
  throw new Error('Pages build must use /fm-synthesis-guide/ base href');
}
// Pages serves this shell for direct SPA links, retaining the requested URL and 404 status.
await writeFile(new URL('404.html', root), html);
await writeFile(new URL('.nojekyll', root), '');
await mkdir(new URL('docs/', root), { recursive: true });
for (const name of ['ARCHITECTURE.md', 'RELEASE.md']) {
  await copyFile(new URL(`../docs/${name}`, import.meta.url), new URL(`docs/${name}`, root));
}
console.log('Pages artifact prepared: dist/pages/browser');
