// Bundles the sandboxed Vite build into one self-contained HTML page for sharing.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-share';
const index = readFileSync(join(dir, 'index.html'), 'utf8');
const js = index.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = index.match(/href="\.\/(assets\/[^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error('Could not find bundled assets in dist-share/index.html');

const script = readFileSync(join(dir, js), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(join(dir, css), 'utf8').replace(/<\/style/gi, '<\\/style');

const page = `<title>Photon Lab</title>
<meta name="theme-color" content="#304169">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync(join(dir, 'photon-lab.html'), page);
console.log(`dist-share/photon-lab.html written (${(page.length / 1024).toFixed(0)} KB)`);
