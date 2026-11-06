// Run: node tests/browser.cjs (requires Playwright and Chromium).
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { chromium } = require('playwright');
const seedStrengthFixture = require('./strength-fixture.cjs');

const root = resolve(__dirname, '..');
const prefix = '/mi-gimnasio-daniel/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
let navigationFailure = false;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (navigationFailure && path === prefix) { res.writeHead(503); res.end('Temporarily unavailable'); return; }
  if (!path.startsWith(prefix) || path.includes('..')) { res.writeHead(404); res.end(); return; }
  const file = resolve(root, path.slice(prefix.length) || 'index.html');
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'text/plain', 'Cache-Control': 'no-cache' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'] });
  let failed = 0, passed = 0;
  async function test(name, fn, options = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    try { await page.goto(base); await fn(page, context); assert.deepEqual(errors, []); passed++; console.log(`PASS ${name}`); }
    catch (e) { failed++; console.log(`FAIL ${name}: ${e.stack}`); }
    finally { navigationFailure = false; await context.close(); }
  }

  await test('Todos los esquemas, días, semanas y Full Body cargan', async p => {
    const schemes = await p.locator('#schemeSelect option').evaluateAll(nodes => nodes.map(n => n.value));
    assert.equal(schemes.length, 7);
    async function checkDay(day) {
      const expected = await p.evaluate(id => planDays().find(d => d.id === id), day);
      const button = p.locator(`[data-day="${day}"]`);
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await button.locator('small').textContent(), expected.label.replace(/^Día\s+\d+\s*[·—-]\s*/u, ''));
      assert.match(await button.locator('.day-title').textContent(), /^Día \d$/);
      assert.deepEqual(await p.locator('[data-card]').evaluateAll(nodes => nodes.map(n => n.dataset.card)), expected.exercises.map(e => e.id));
      assert.equal(await p.locator('#heroTitle').textContent(), expected.label);
      assert.equal(await button.evaluate(n => getComputedStyle(n).color), 'rgb(34, 230, 193)');
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    let days = 0;
    for (const scheme of schemes) {
      await p.selectOption('#schemeSelect', scheme);
      const ids = await p.locator('#daySelect option').evaluateAll(nodes => nodes.map(n => n.value));
      for (const day of ids) {
        await checkDay(day); days++;
      }
    }
    for (let week = 1; week <= 12; week++) await p.selectOption('#weekSelect', String(week));
    await p.selectOption('#modeSelect', 'full');
    for (const day of ['fa', 'fb']) await checkDay(day);
    assert.equal(await p.locator('#schemeBox').isHidden(), true);
    console.log(`  ${days} días semanales, 12 semanas, Full Body A/B`);
  });

  await test('Progreso semanal: entrada, finalización, selección, semana, esquema y reapertura', async p => {
    const first = p.locator('[data-day="w1"]');
    assert.equal(await first.getAttribute('data-progress'), 'not-started');
    assert.equal(await first.locator('.day-status').count(), 0);
    await p.evaluate(() => { document.querySelector('[data-card="w1-press"]').open = true; });
    const row = p.locator('[data-row="w1-press-0"]');
    await row.locator('[data-done]').click();
    assert.equal(await first.getAttribute('data-progress'), 'not-started');
    await row.locator('[data-field="kg"]').fill('20');
    assert.equal(await first.getAttribute('data-progress'), 'in-progress');
    assert.match(await first.getAttribute('aria-label'), /En curso$/);
    await row.locator('[data-field="kg"]').fill('');
    assert.equal(await first.getAttribute('data-progress'), 'not-started');
    await row.locator('[data-field="kg"]').fill('20');
    await row.locator('[data-field="reps"]').fill('10');
    await row.locator('[data-done]').click();
    assert.equal(await first.getAttribute('data-progress'), 'in-progress');
    await p.locator('#finishBtn').click();
    assert.equal(await first.getAttribute('data-progress'), 'completed');
    assert.equal(await first.locator('.day-status').textContent(), '✓');
    assert.equal(await first.getAttribute('aria-pressed'), 'true');
    await p.locator('[data-day="w2"]').click();
    assert.equal(await first.getAttribute('data-progress'), 'completed');
    assert.equal(await first.getAttribute('aria-pressed'), 'false');
    await p.selectOption('#weekSelect', '2');
    assert.equal(await first.getAttribute('data-progress'), 'not-started');
    await p.selectOption('#weekSelect', '1');
    assert.equal(await first.getAttribute('data-progress'), 'completed');
    await p.selectOption('#schemeSelect', 'h23i');
    assert.equal(await p.locator('[data-progress="completed"]').count(), 0);
    await p.selectOption('#schemeSelect', 'base');
    await p.locator('#dateSelect').fill('2026-11-05');
    assert.equal(await first.getAttribute('data-progress'), 'completed');
    await p.reload();
    assert.equal(await first.getAttribute('data-progress'), 'completed');
    await p.locator('#historyTab').click();
    await p.locator('#historyList [data-open]').click();
    await p.locator('#reopenBtn').click();
    assert.equal(await first.getAttribute('data-progress'), 'in-progress');
  });

  await test('Progreso: sesiones de varias fechas, prioridad y aislamiento por modalidad/esquema', async p => {
    const result = await p.evaluate(() => {
      const make = (extra={}) => ({ mode: 'weekly', scheme: 'base', week: 1, dayId: 'w1', exercises: {}, ...extra });
      state.sessions = { empty: make(), selectedOnly: make({ selected: { 'w1-press': false }, counts: { 'w1-press': 1 } }) };
      const empty = weeklyDayProgress().get('w1');
      state.sessions = {
        otherScheme: make({ scheme: 'h23i', finished: true }),
        otherMode: make({ mode: 'full', finished: true }),
        otherWeek: make({ week: 2, finished: true }),
        archived: make({ legacy: true, finished: true })
      };
      const isolated = weeklyDayProgress().get('w1');
      const partial = make({ date: '2026-11-01', exercises: { 'w1-press': { sets: [{ kg: 0, reps: null, rir: '', done: false }] } } });
      const finished = make({ date: '2026-11-02', finished: true });
      state.sessions = { partial, finished };
      const complete = weeklyDayProgress().get('w1');
      state.sessions = { finished, partial };
      const reverse = weeklyDayProgress().get('w1');
      const before = JSON.stringify(state.sessions); renderDayNavigation();
      const untouched = JSON.stringify(state.sessions) === before;
      mode = 'full'; scheme = 'h23i'; day = 'fa';
      state.sessions = { full: make({ mode: 'full', dayId: 'fa', finished: true }), wrong: make({ mode: 'weekly', dayId: 'fb', finished: true }) };
      renderRoutine();
      return { empty, isolated, complete, reverse, untouched, full: weeklyDayProgress().get('fa'), other: weeklyDayProgress().get('fb') };
    });
    assert.deepEqual(result, { empty: 'not-started', isolated: 'not-started', complete: 'completed', reverse: 'completed', untouched: true, full: 'completed', other: 'not-started' });
  });

  await test('Progreso compatible con sesiones y JSON anteriores, sin nuevos campos', async p => {
    for (const version of [4, 5, 6, 61]) {
      const original = await p.evaluate(version => {
        const data = { ...fresh(), version };
        data.sessions.saved = { mode: 'weekly', dayId: 'w1', week: '1', date: '2026-10-01', finished: true, exercises: {}, snapshot: [] };
        data.sessions.draft = { mode: 'weekly', dayId: 'w2', week: 1, date: '2026-10-02', exercises: { 'w2-jalon': { sets: [{ kg: null, reps: 8, done: false }] } } };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return JSON.stringify(data.sessions);
      }, version);
      await p.reload();
      assert.equal(await p.locator('[data-day="w1"]').getAttribute('data-progress'), 'completed');
      assert.equal(await p.locator('[data-day="w2"]').getAttribute('data-progress'), 'in-progress');
      const result = await p.evaluate(() => {
        state = parseBackup(JSON.parse(localStorage.getItem(STORAGE_KEY))); renderRoutine();
        return { sessions: JSON.stringify(state.sessions), completed: weeklyDayProgress().get('w1'), draft: weeklyDayProgress().get('w2') };
      });
      assert.deepEqual(result, { sessions: original, completed: 'completed', draft: 'in-progress' });
    }
  });

  await test('Series reales, bloqueo, selección, historial, gráficos y recarga', async p => {
    await p.evaluate(() => { document.querySelector('[data-card="w1-press"]').open = true; });
    const row = p.locator('[data-row="w1-press-0"]');
    await row.locator('[data-done]').click();
    assert.equal(await p.evaluate(() => actual('w1-press', 0).done), false);
    await row.locator('[data-field="kg"]').fill('20');
    await row.locator('[data-field="reps"]').fill('10');
    await row.locator('[data-done]').click();
    assert.equal(await row.locator('[data-field="kg"]').isDisabled(), true);
    assert.equal(await p.evaluate(() => calculate(session()).volume), 200);
    await p.locator('#finishBtn').click();
    await p.reload();
    assert.equal(await p.evaluate(() => session().finished), true);
    await p.locator('#historyTab').click();
    assert.equal(await p.locator('#kpiSessions').textContent(), '1');
    await p.selectOption('#chartExercise', await p.evaluate(() => strengthProgressRows().find(r=>r.name==='Press plano con barra').key));
    assert.equal(await p.locator('#chart circle').count(), 1);
    assert.equal(await p.evaluate(() => chartData()[0].y), 20);
    await p.selectOption('#chartMetric', 'volume');
    assert.equal(await p.evaluate(() => chartData()[0].y), 200);
    await p.locator('#historyList [data-open]').click();
    await p.locator('#reopenBtn').click();
    await p.evaluate(() => { document.querySelector('[data-card="w1-press"]').open = true; });
    await p.locator('[data-row="w1-press-0"] [data-done]').click();
    assert.equal(await p.locator('[data-row="w1-press-0"] [data-field="kg"]').isDisabled(), false);
    await p.locator('[data-row="w1-press-0"] [data-done]').click();
    await p.locator('[data-selectex="w1-press"]').uncheck();
    assert.equal(await p.evaluate(() => calculate(session()).volume), 0);
    await p.locator('[data-selectex="w1-press"]').check();
    assert.equal(await p.evaluate(() => calculate(session()).volume), 200);
  });

  await test('Series ocultas no se suman en gráficos ni informes de fuerza', async p => {
    const result = await p.evaluate(() => {
      modifySet('w1-press', 0, 'kg', '20'); modifySet('w1-press', 0, 'reps', '10'); toggleSet('w1-press', 0);
      modifySet('w1-press', 1, 'kg', '80'); modifySet('w1-press', 1, 'reps', '10'); toggleSet('w1-press', 1);
      session().counts['w1-press'] = 1; finalize(); setTab('history');
      $('chartExercise').value = strengthProgressRows().find(r=>r.name==='Press plano con barra').key; $('chartMetric').value = 'volume';
      return { volume: statsFor(session()).volume, chart: chartData()[0].y, strength: strengthRows().find(x => x.name === 'Press plano con barra').last.kg };
    });
    assert.deepEqual(result, { volume: 200, chart: 200, strength: 20 });
  });

  await test('Snapshot importado conserva su número de series visible', async p => {
    await p.evaluate(() => {
      const s = session(true), ex = findEx('w1-press');
      s.finished = true; s.snapshot = [{ ...ex, target: 1 }]; delete s.counts;
      s.exercises = { 'w1-press': { variant: 'base', sets: [{ kg: 20, reps: 10, done: true }] } };
      renderRoutine();
    });
    assert.equal(await p.locator('[data-card="w1-press"] .setrow').count(), 1);
  });

  await test('Respaldo antiguo sin counts permite ajustar series', async p => {
    const count = await p.evaluate(() => { const s = session(true); delete s.counts; adjustCount('w1-press', -1); return session().counts['w1-press']; });
    assert.equal(count, 3);
  });

  await test('Isometrías con series adicionales no generan volumen de fuerza', async p => {
    const result = await p.evaluate(() => {
      const ex = { id: 'test-timed', name: 'Plancha de prueba', day, custom: true, kind: 'main', sets: S(30, null, 1, 'seg') };
      state.customExercises.push(ex);
      const s = session(true); s.counts[ex.id] = 2;
      s.exercises[ex.id] = { variant: 'base', sets: [{ kg: 20, reps: 30, done: true }, { kg: 20, reps: 30, done: true }] };
      finalize(); setTab('history');
      return { volume: statsFor(s).volume, charts: $('chartExercise').options[0].value, lifts: strengthRows().length };
    });
    assert.deepEqual(result, { volume: 0, charts: '', lifts: 0 });
  });

  await test('Medidas corporales, InBody, visor, informes y respaldo JSON', async p => {
    await p.locator('#progressTab').click();
    await p.locator('#measureWeight').fill('100'); await p.locator('#measureWaist').fill('105');
    await p.locator('#measurementForm button[type="submit"]').click();
    assert.equal(await p.locator('#bodyWeightChart svg').count(), 1);
    assert.equal(await p.locator('#bodyWaistChart svg').count(), 1);
    await p.locator('#inbodyFile').setInputFiles(resolve(root, 'icons/icon-192.png'));
    await p.locator('#ibWeight').fill('100'); await p.locator('#ibFatPct').fill('25');
    await p.locator('#ibNotes').fill('Prueba InBody <segura>'); await p.locator('#saveInbody').click();
    await p.waitForFunction(() => document.querySelector('#inbodyList [data-view-inbody]'));
    await p.locator('[data-view-inbody]').click();
    assert.equal(await p.locator('#inbodyViewer').evaluate(n => n.open), true);
    assert.ok(await p.locator('#inbodyViewerImage').evaluate(n => n.naturalWidth > 0));
    await p.locator('#closeInbodyViewer').click();
    assert.equal(await p.evaluate(() => buildPrintableWithInbody().includes('data:image/jpeg;base64,')), true);
    assert.equal(await p.evaluate(() => buildReportMarkdown().includes('Prueba InBody')), true);
    assert.equal(await p.evaluate(() => buildReportMarkdown().includes('data:image')), false);
    await p.locator('#settingsBtn').click();
    const downloadPromise = p.waitForEvent('download'); await p.locator('#exportBtn').click();
    const download = await downloadPromise; const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(backup.inbody.length, 1); assert.equal(backup.bodyMetrics.length, 1);
    await p.locator('#importFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await p.waitForFunction(() => !document.querySelector('#settingsDialog').open);
    assert.equal(await p.evaluate(() => state.inbody[0].data === parseBackup(JSON.parse(localStorage.getItem(STORAGE_KEY))).inbody[0].data), true);
    await p.reload(); assert.equal(await p.evaluate(() => state.inbody.length), 1);
  });

  await test('JSON v1–v6.1 y localStorage v4–v6.1 conservan los registros', async p => {
    for (const version of [1, 2, 3, 4, 5, 6, 61]) {
      assert.equal(await p.evaluate(version => {
        const src = { version, sessions: { old: { finished: true, date: '2026-10-01', exercises: { example: { sets: [{ kg: 30, reps: 10, done: true }] } } } } };
        const out = parseBackup(src); return Object.values(out.sessions)[0].exercises.example.sets[0].kg;
      }, version), 30);
    }
    for (const version of [4, 5, 6, 61]) {
      const sessions = await p.evaluate(version => {
        state = fresh(); const s = session(true); s.finished = true; s.snapshot = [{ ...findEx('w1-press'), target: 1 }];
        s.exercises['w1-press'] = { variant: 'base', sets: [{ kg: 30, reps: 10, rir: '3', done: true }] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version, bodyMetrics: [{ date: '2026-10-01', weight: 100 }] }));
        return JSON.stringify(state.sessions);
      }, version);
      await p.reload(); assert.equal(await p.evaluate(() => state.bodyMetrics[0].weight), 100);
      assert.equal(await p.evaluate(() => JSON.stringify(state.sessions)), sessions);
      await p.locator('#historyTab').click(); assert.equal(await p.locator('#kpiVolume').textContent(), '300');
    }
    for (const key of ['daniel_gym_pwa_v3', 'daniel_gym_pwa_v1']) {
      await p.evaluate(key => { localStorage.clear(); localStorage.setItem(key, JSON.stringify({ version: 1, sessions: { old: { finished: true, day: 1, date: '2026-10-01', exercises: { example: { sets: [{ kg: 30, reps: 10, done: true }] } } } } })); }, key);
      await p.reload(); assert.equal(await p.evaluate(() => Object.values(state.sessions)[0].exercises.example.sets[0].kg), 30);
    }
  });

  await test('Importación sin espacio conserva memoria y localStorage previos', async p => {
    assert.equal(await p.evaluate(async () => {
      save(); const before = JSON.stringify(state), persisted = localStorage.getItem(STORAGE_KEY);
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
      try { await importFile(new File([JSON.stringify({ ...fresh(), bodyMetrics: [{ date: '2026-10-01', weight: 90 }] })], 'backup.json')); }
      finally { Storage.prototype.setItem = original; }
      return JSON.stringify(state) === before && localStorage.getItem(STORAGE_KEY) === persisted && !$('toast').textContent.includes('correctamente');
    }), true);
  });

  await test('Resumen de fuerza: dos últimas sesiones, carga, reps y Epley sin usar planes', async p => {
    await p.locator('#historyTab').click();
    assert.equal(await p.locator('.strength-row').count(), 0);
    await p.evaluate(seedStrengthFixture);
    const data = await p.evaluate(() => {
      const before = JSON.stringify(state), persisted = localStorage.getItem(STORAGE_KEY);
      const rows = strengthProgressRows(); renderReports();
      return { rows, unchanged: before === JSON.stringify(state) && persisted === localStorage.getItem(STORAGE_KEY) };
    });
    assert.equal(data.unchanged, true);
    const press = data.rows.find(r => r.id === 'test-press' && r.variant === 'base');
    assert.equal(press.count, 3);
    assert.equal(press.previous.date, '2026-11-02'); assert.equal(press.latest.date, '2026-11-03');
    assert.equal(press.previous.kg, 50); assert.equal(press.latest.kg, 55);
    assert.equal(press.delta, 5); assert.equal(press.percent, 10); assert.equal(press.repsDelta, -2);
    assert.ok(Math.abs(press.previous.estimate.value - 63.3333333333) < 1e-8);
    assert.equal(press.latest.estimate.value, 66);
    assert.ok(Math.abs(press.estimateDelta - 2.6666666667) < 1e-8);
    const same = data.rows.find(r => r.id === 'test-row');
    assert.equal(same.delta, 0); assert.equal(same.percent, 0); assert.equal(same.repsDelta, -4);
    assert.ok(same.estimateDelta < 0);
    const one = data.rows.find(r => r.id === 'test-leg');
    assert.equal(one.count, 1); assert.equal(one.previous, null); assert.equal(one.delta, null);
    assert.equal(one.percent, null); assert.equal(one.estimateDelta, null);
    const oneCard = p.locator('.strength-row').filter({ has: p.locator('[data-strength-key]', { hasText: 'Prensa de piernas' }) });
    assert.match(await oneCard.textContent(), /Faltan datos para comparar/);
    const zero = data.rows.find(r => r.id === 'test-zero');
    assert.equal(zero.percent, null); assert.equal(zero.previous.estimate, null);
    const squat = data.rows.find(r => r.id === 'test-squat');
    assert.equal(squat.latest.kg, 65); assert.equal(squat.latest.reps, 12);
    assert.equal(squat.latest.estimate.kg, 60); assert.equal(squat.latest.estimate.reps, 8);
    assert.equal(squat.latest.estimate.value, 76); assert.equal(squat.estimateDelta, -4);
    for (const id of ['test-high-reps', 'test-assisted']) assert.equal(data.rows.find(r => r.id === id).latest.estimate, null);
    for (const id of ['test-warmup', 'test-cardio', 'test-timed', 'test-minutes', 'test-hidden', 'test-invalid']) assert.ok(!data.rows.some(r => r.id === id));
    assert.equal(data.rows.find(r => r.id === 'test-target').latest.kg, 20);
    assert.ok(Math.abs(data.rows.find(r => r.id === 'test-one-rep').latest.estimate.value - 155) < 1e-8);
    assert.equal(data.rows.find(r => r.id === 'test-curl').latest.reps, 10);
  });

  await test('Resumen: variantes y máquinas separadas, filtros, orden y gráfico vinculado', async p => {
    await p.evaluate(seedStrengthFixture);
    const machines = await p.evaluate(() => strengthProgressRows().filter(r => r.id === 'test-press'));
    assert.equal(machines.length, 3);
    assert.equal(machines.find(r => r.variant === 'base').count, 3);
    assert.equal(machines.find(r => r.name === 'Press en máquina A').count, 2);
    assert.equal(machines.find(r => r.name === 'Press en máquina B').count, 1);
    const another = await p.evaluate(() => strengthProgressRows().find(r => r.id === 'test-press-other'));
    assert.equal(another.count, 1); assert.equal(another.latest.kg, 300);
    await p.selectOption('#strengthGroup', 'Pectorales');
    assert.equal(await p.locator('.strength-row').count(), 4);
    await p.selectOption('#strengthGroup', '');
    await p.selectOption('#strengthSort', 'load-up');
    assert.match(await p.locator('.strength-link').first().textContent(), /Elevación con carga/);
    await p.selectOption('#strengthSort', 'load-down');
    assert.match(await p.locator('.strength-link').first().textContent(), /Curl con barra/);
    await p.selectOption('#strengthSort', 'name');
    assert.match(await p.locator('.strength-link').first().textContent(), /Curl con barra/);
    await p.selectOption('#strengthSort', 'estimate-up');
    assert.match(await p.locator('.strength-link').first().textContent(), /Press con barra/);
    await p.getByRole('button', { name: 'Ver evolución de Press en máquina A · Alternativa', exact: true }).click();
    assert.equal(await p.locator('#chartVariant').inputValue(), 'alt');
    assert.deepEqual(await p.evaluate(() => chartData().map(p => p.y)), [60, 65]);
    assert.equal(await p.locator('#chart circle').count(), 2);
    await p.waitForFunction(() => Math.abs(document.querySelector('#loadChartPanel').getBoundingClientRect().top) < 4);
    assert.equal(await p.locator('#chartExercise').evaluate(n => n === document.activeElement), true);
    await p.selectOption('#chartVariant', 'base');
    assert.deepEqual(await p.evaluate(() => chartData().map(p => p.y)), [40, 50, 55]);
    await p.selectOption('#chartMetric', 'volume');
    assert.deepEqual(await p.evaluate(() => chartData().map(p => p.y)), [400, 400, 330]);
    for (const width of [390, 320]) {
      await p.setViewportSize({ width, height: 844 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.strength-row')].every(n => n.scrollWidth <= n.clientWidth)), true);
    }
  });

  await test('PWA: manifiesto, iconos, alcance, actualización y arranque offline', async (p, c) => {
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.reload();
    const manifest = await p.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
    assert.equal(new URL(manifest.start_url, base).pathname, prefix);
    assert.equal(new URL(manifest.scope, base).pathname, prefix);
    assert.equal(new URL(manifest.id, base).pathname, prefix);
    const icons = await p.evaluate(async () => Promise.all(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map(async file => {
      const img = new Image(); img.src = './icons/' + file; await img.decode(); return [img.naturalWidth, img.naturalHeight];
    })));
    assert.deepEqual(icons, [[192, 192], [512, 512], [180, 180]]);
    await p.evaluate(async () => { await caches.open('unrelated-cache'); await caches.open('mi-gimnasio-daniel-pwa-shell-old'); const r = await navigator.serviceWorker.ready; await r.unregister(); });
    await p.reload(); await p.evaluate(() => navigator.serviceWorker.ready); await p.reload();
    const keys = await p.evaluate(() => caches.keys());
    assert.ok(keys.includes('unrelated-cache')); assert.ok(!keys.includes('mi-gimnasio-daniel-pwa-shell-old'));
    await c.setOffline(true); await p.reload(); assert.equal(await p.locator('[data-card]').count(), 8);
    await p.locator('#historyTab').click(); await p.locator('#progressTab').click();
    await c.setOffline(false);
  });

  await test('PWA conserva pantalla disponible ante HTTP 503 de navegación', async p => {
    await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); navigationFailure = true;
    await p.reload(); assert.equal(await p.locator('[data-card]').count(), 8);
  });

  await browser.close(); await new Promise(r => server.close(r));
  console.log(`${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); server.close(); process.exit(1); });
