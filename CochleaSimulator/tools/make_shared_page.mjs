// Turns the Vite build in dist/ into a single page for a Claude artifact:
// CSS and JS inlined, 3D assets left as files published next to it.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = 'shared';
mkdirSync(join(out, 'assets'), { recursive: true });

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"/)[1];
const jsSrc = html.match(/<script type="module"[^>]*src="\.\/([^"]+)"/)[1];
const css = readFileSync(join(dist, cssHref), 'utf8');
const js = readFileSync(join(dist, jsSrc), 'utf8').replace(/<\/script/gi, '<\\/script');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script type="module"[^>]*><\/script>/, '');

// Artifacts only serve text/media types, so the binary assets travel base64-packed in one JSON file
// and a tiny fetch shim hands them back to the app as if they were the original files.
const pack = {};
for (const f of ['cochlea.glb', 'membrane.bin']) pack[f] = readFileSync(join(dist, 'assets', f)).toString('base64');
writeFileSync(join(out, 'assets', 'binpack.json'), JSON.stringify(pack));

const shim = `<script>
(() => {
  const realFetch = window.fetch.bind(window);
  let pack;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const m = /assets\\/(cochlea\\.glb|membrane\\.bin)$/.exec(url);
    if (!m) return realFetch(input, init);
    pack = pack || realFetch('assets/binpack.json').then((r) => r.json());
    const b64 = (await pack)[m[1]];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } });
  };
})();
</script>`;

const fontLinks = [...html.matchAll(/<link [^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g)].map((m) => m[0]).join('\n');

const page = `<title>Cochlea Simulator</title>
${fontLinks}
<style>
:root { color-scheme: dark; }
${css}
</style>
${body.trim()}
${shim}
<script type="module">
${js}
</script>
`;
writeFileSync(join(out, 'index.html'), page);
copyFileSync(join(dist, 'assets', 'cells.json'), join(out, 'assets', 'cells.json'));
console.log(`shared/index.html ${(page.length / 1024).toFixed(0)} kB`);
