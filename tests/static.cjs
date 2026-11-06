const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { Script, runInNewContext } = require('node:vm');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
for (const script of scripts) new Script(script);
new Script(readFileSync(resolve(root, 'sw.js'), 'utf8'));
const plans = runInNewContext(scripts[0].split('const fresh=')[0] + '\nJSON.stringify({PLANS,SCHEMES})');
// Baseline: upstream 4b31acc102234fd3b1747cf02de4db1bef8e0316.
// Covers exercise names, order, sets, kg, reps, alternatives, pairs and notes.
const hash = createHash('sha256').update(plans).digest('hex');
assert.equal(hash, readFileSync(resolve(__dirname, 'plans.sha256'), 'utf8').trim(), 'Las rutinas o cargas programadas cambiaron');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.id, './');
for (const icon of [...manifest.icons, { src: './icons/apple-touch-icon.png', sizes: '180x180' }]) {
  const bytes = readFileSync(resolve(root, icon.src));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
}
assert.ok(html.includes('const STORAGE_KEY="mi_gimnasio_daniel_v4"'));
console.log('PASS sintaxis, manifiesto, iconos, clave de almacenamiento y huella de rutinas/cargas originales');
