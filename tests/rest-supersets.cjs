module.exports = async function restAndSupersetTests({ test, assert }) {
  async function instrument(page) {
    await page.evaluate(() => {
      window.restEvents = { tones: 0, vibrations: [] };
      const create = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        const osc = create.call(this), start = osc.start.bind(osc);
        osc.start = (...args) => { restEvents.tones++; return start(...args); };
        return osc;
      };
      const vibrate = navigator.vibrate?.bind(navigator);
      Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { restEvents.vibrations.push(pattern); return vibrate?.(pattern) || false; } });
    });
  }

  await test('Descanso: Web Audio real y vibración una sola vez, sin inicio por series', async p => {
    await instrument(p); await p.clock.install();
    assert.equal(await p.evaluate(() => restAudio), null);
    await p.evaluate(() => { modifySet('w1-press', 0, 'kg', 20); modifySet('w1-press', 0, 'reps', 10); toggleSet('w1-press', 0); });
    assert.equal(await p.evaluate(() => restDeadline), 0);
    assert.deepEqual(await p.locator('#restDuration option').evaluateAll(ns => ns.map(n => n.value)), ['60', '75', '90', '120', '180']);
    await p.selectOption('#restDuration', '60'); await p.locator('#restStart').click();
    assert.equal(await p.evaluate(() => restPrepareAudio()), true);
    await p.clock.fastForward(60000);
    assert.equal(await p.locator('#restClock').textContent(), '00:00');
    await p.evaluate(() => { restRender(); restRender(); }); await p.clock.fastForward(3000);
    assert.deepEqual(await p.evaluate(() => restEvents), { tones: 2, vibrations: [[150, 70, 150]] });
    assert.equal(await p.evaluate(() => restDeadline === 0 && restTimerInterval === null && restSeconds === 0), true);
    await p.locator('#restStart').click(); await p.clock.fastForward(60000);
    assert.deepEqual(await p.evaluate(() => restEvents), { tones: 4, vibrations: [[150, 70, 150], [150, 70, 150]] });
  });

  await test('Descanso: pausa, reinicio, silencio, prueba y recuperación tras ocultarse', async p => {
    await instrument(p); await p.clock.install();
    await p.selectOption('#restDuration', '75'); await p.locator('#restStart').click();
    await p.evaluate(() => restPrepareAudio()); await p.clock.fastForward(20000);
    await p.locator('#restStop').click(); await p.clock.fastForward(100000);
    assert.equal(await p.locator('#restClock').textContent(), '01:15');
    assert.equal(await p.evaluate(() => restEvents.tones), 0);
    await p.locator('#restStart').click(); await p.clock.fastForward(10000); await p.locator('#restStart').click();
    assert.equal(await p.locator('#restClock').textContent(), '01:05');
    await p.clock.fastForward(100000); assert.equal(await p.evaluate(() => restEvents.vibrations.length), 0);
    await p.locator('#restStart').click(); await p.clock.fastForward(65000);
    assert.equal(await p.evaluate(() => restEvents.tones), 2);
    await p.locator('#restSound').click(); assert.equal(await p.locator('#restSound').getAttribute('aria-pressed'), 'false');
    assert.equal(await p.evaluate(() => restSoundNodes.size), 0);
    await p.locator('#restStart').click(); await p.clock.fastForward(75000);
    assert.equal(await p.evaluate(() => restEvents.tones), 2);
    assert.equal(await p.evaluate(() => restEvents.vibrations.length), 2);
    await p.locator('#restTestSound').click();
    assert.equal(await p.evaluate(() => restEvents.tones), 4);
    assert.equal(await p.locator('#restSound').getAttribute('aria-pressed'), 'false');
    await p.locator('#restSound').click(); await p.locator('#restStart').click();
    // Simula la reanudación del JS después de que transcurriera la fecha límite.
    await p.evaluate(() => { restDeadline = Date.now() - 5000; window.dispatchEvent(new Event('pageshow')); window.dispatchEvent(new Event('pageshow')); });
    assert.equal(await p.locator('#restClock').textContent(), '00:00');
    assert.equal(await p.evaluate(() => restEvents.tones), 6);
    assert.equal(await p.evaluate(() => restEvents.vibrations.length), 3);
  });

  await test('Descanso: permisos sólo por clic explícito, denegación y desactivación', async p => {
    await p.addInitScript(() => {
      window.permissionCalls = []; window.fakePermission = 'default'; window.notificationsShown = [];
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => fakePermission });
      Notification.requestPermission = async () => { permissionCalls.push(navigator.userActivation.isActive); fakePermission = 'granted'; return 'granted'; };
      ServiceWorkerRegistration.prototype.showNotification = async (title, options) => { notificationsShown.push({ title, options }); };
    });
    await p.reload(); await p.evaluate(() => navigator.serviceWorker.ready);
    assert.deepEqual(await p.evaluate(() => permissionCalls), []);
    await p.locator('#restStart').click();
    assert.deepEqual(await p.evaluate(() => permissionCalls), []);
    await p.locator('#restNotifications').click();
    await p.waitForFunction(() => restNotificationsOn());
    assert.deepEqual(await p.evaluate(() => permissionCalls), [true]);
    await p.evaluate(() => { restDeadline = Date.now() - 1; restRender(); restRender(); });
    await p.waitForFunction(() => notificationsShown.length === 1);
    assert.equal(await p.evaluate(() => notificationsShown[0].options.silent), true);
    await p.locator('#restNotifications').click();
    await p.evaluate(() => { restAction(); restDeadline = Date.now() - 1; restRender(); });
    assert.equal(await p.evaluate(() => notificationsShown.length), 1);
    await p.evaluate(() => { fakePermission = 'denied'; }); await p.locator('#restNotifications').click();
    assert.equal(await p.evaluate(() => restNotificationsOn()), false);
    assert.match(await p.locator('#restStatus').textContent(), /Permiso denegado/);
    assert.deepEqual(await p.evaluate(() => permissionCalls), [true]);
  });

  await test('Descanso: notificación real mediante service worker y cancelación de aviso pendiente', async p => {
    await p.evaluate(() => navigator.serviceWorker.ready);
    await p.evaluate(() => {
      window.notificationCalls = 0; window.realRestNotification = null;
      const show = ServiceWorkerRegistration.prototype.showNotification;
      ServiceWorkerRegistration.prototype.showNotification = async function (...args) { notificationCalls++; const result = await show.apply(this, args); window.realRestNotification = { silent: args[1].silent }; return result; };
    });
    await p.locator('#restNotifications').click(); await p.waitForFunction(() => restNotificationsOn());
    await p.locator('#restSound').click(); await p.locator('#restStart').click();
    await p.evaluate(() => { restDeadline = Date.now() - 1; restRender(); restRender(); });
    await p.waitForFunction(() => window.realRestNotification !== null);
    assert.equal(await p.evaluate(() => notificationCalls), 1);
    const result = await p.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const silent = window.realRestNotification.silent;
      (await registration.getNotifications({ tag: 'mi-gimnasio-rest' })).forEach(n => n.close());
      Object.defineProperty(navigator.serviceWorker, 'getRegistration', { configurable: true, value: () => new Promise(resolve => { window.resolveRestRegistration = () => resolve(registration); }) });
      restAction(); restDeadline = Date.now() - 1; restRender(); restReset();
      resolveRestRegistration(); await Promise.resolve(); await Promise.resolve();
      return { silent, calls: notificationCalls, remaining: restSeconds };
    });
    assert.deepEqual(result, { silent: true, calls: 1, remaining: 90 });
  }, { permissions: ['notifications'] });

  await test('Descanso: fallback sin APIs y preferencias persistentes', async p => {
    await p.locator('#restSound').click(); await p.reload();
    assert.equal(await p.locator('#restSound').getAttribute('aria-pressed'), 'false');
    assert.equal(await p.evaluate(() => parseBackup(JSON.parse(localStorage.getItem(STORAGE_KEY))).restPreferences.sound), false);
    await p.evaluate(() => { const data = fresh(); data.restPreferences = { sound: true }; state = parseBackup(data); renderRoutine(); });
    assert.equal(await p.locator('#restSound').getAttribute('aria-pressed'), 'true');
    await p.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true }); Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true }); Object.defineProperty(window, 'Notification', { value: undefined, configurable: true }); });
    await p.reload();
    assert.equal(await p.locator('#restSound').isDisabled(), true);
    assert.equal(await p.locator('#restTestSound').isDisabled(), true);
    assert.equal(await p.locator('#restNotifications').isDisabled(), true);
    await p.evaluate(() => { state.restPreferences = { sound: true }; restControlsRender(); });
    await p.locator('#restStart').click();
    await p.evaluate(() => { restDeadline = Date.now() - 1; restRender(); });
    assert.equal(await p.locator('#restClock').textContent(), '00:00');
    const context = p.context(), url = p.url(); await p.close();
    const reopened = await context.newPage(); await reopened.goto(url);
    assert.equal(await reopened.locator('#restSound').getAttribute('aria-pressed'), 'false');
    assert.equal(await reopened.evaluate(() => restDeadline), 0);
  });

  await test('Superserie: acordeón común, series 4/2 y registros independientes persistentes', async p => {
    await p.selectOption('#schemeSelect', 'h23i');
    const block = p.locator('[data-superset="1"]');
    const a = 'h23i-1-1', b = 'h23i-1-2';
    assert.equal(await block.locator('[data-card]').count(), 2);
    assert.equal(await block.locator(`[data-card="${a}"] .setrow`).count(), 4);
    assert.equal(await block.locator(`[data-card="${b}"] .setrow`).count(), 2);
    await block.locator(':scope > summary').click();
    assert.equal(await block.locator(`[data-row="${a}-0"]`).isVisible(), false);
    await block.locator(':scope > summary').click();
    assert.equal(await block.locator(`[data-row="${a}-0"]`).isVisible(), true);
    assert.equal(await block.locator(`[data-row="${b}-0"]`).isVisible(), true);
    await p.locator(`[data-row="${a}-0"] [data-field="kg"]`).fill('20');
    await p.locator(`[data-row="${a}-0"] [data-field="reps"]`).fill('15');
    await p.locator(`[data-row="${a}-0"] [data-field="rir"]`).selectOption('3');
    assert.equal(await p.evaluate(b => session().exercises[b], b), undefined);
    await p.locator(`[data-row="${b}-0"] [data-field="kg"]`).fill('15');
    await p.locator(`[data-row="${b}-0"] [data-field="reps"]`).fill('12');
    await p.locator(`[data-row="${b}-0"] [data-field="rir"]`).selectOption('2');
    await p.locator(`[data-row="${a}-0"] [data-done]`).click();
    await p.locator(`[data-row="${b}-0"] [data-done]`).click();
    assert.equal(await p.evaluate(() => restDeadline), 0);
    await p.locator(`[data-row="${a}-1"] [data-weight-step="2.5"]`).click();
    assert.deepEqual(await p.evaluate(a => record(a).sets.map(z => z.kg), a), [20, 22.5, 22.5, 22.5]);
    assert.deepEqual(await p.evaluate(b => record(b).sets.map(z => z.kg), b), [15, 15]);
    await p.locator(`[data-selectex="${a}"]`).uncheck();
    assert.match(await block.locator('.superset-note').textContent(), /individualmente/);
    assert.equal(await block.locator(`[data-card="${a}"] .setrow`).count(), 0);
    assert.equal(await block.locator(`[data-card="${b}"] .setrow`).count(), 2);
    await p.locator(`[data-selectex="${a}"]`).check(); await p.locator(`[data-selectex="${b}"]`).uncheck();
    assert.equal(await block.locator(`[data-card="${a}"] .setrow`).count(), 4);
    await p.reload();
    assert.equal(await p.locator(`[data-selectex="${b}"]`).isChecked(), false);
    assert.equal(await p.locator(`[data-row="${a}-0"] [data-field="kg"]`).isDisabled(), true);
    assert.deepEqual(await p.evaluate(b => record(b).sets.map(z => z.kg), b), [15, 15]);
    await p.locator(`[data-selectex="${b}"]`).check();
    const unchanged = await p.evaluate(() => { const before = JSON.stringify(state.sessions); renderRoutine(); return before === JSON.stringify(state.sessions); });
    assert.equal(unchanged, true);
    await block.locator('[data-rest-focus]').click();
    assert.equal(await p.evaluate(() => restDeadline), 0);
    assert.equal(await p.locator('#restStart').evaluate(n => n === document.activeElement), true);
    for (const width of [390, 320]) {
      await p.setViewportSize({ width, height: 844 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await p.selectOption('#modeSelect', 'full');
    assert.equal(await p.locator('[data-superset]').count(), 0);
    assert.ok(await p.locator('details[data-card]').count());
    const saved = await p.evaluate(() => JSON.stringify(state.sessions));
    const context = p.context(), url = p.url(); await p.close();
    const reopened = await context.newPage(); await reopened.goto(url);
    assert.equal(await reopened.evaluate(() => JSON.stringify(state.sessions)), saved);
    await reopened.selectOption('#modeSelect', 'weekly'); await reopened.selectOption('#schemeSelect', 'h23i');
    assert.deepEqual(await reopened.evaluate(a => record(a).sets.map(z => z.kg), a), [20, 22.5, 22.5, 22.5]);
    assert.deepEqual(await reopened.evaluate(b => record(b).sets.map(z => z.kg), b), [15, 15]);
    assert.equal(await reopened.evaluate(() => restDeadline), 0);
  });

  await test('Superserie: snapshot con un integrante y pareja ambigua permanecen individuales', async p => {
    await p.selectOption('#schemeSelect', 'h23i');
    const result = await p.evaluate(() => {
      const a = allExercises().find(e => e.pair === 'A1');
      const s = session(true); s.snapshot = [{ ...a, target: 1 }]; s.finished = true;
      s.exercises = { [a.id]: { sets: [{ kg: 20, reps: 10, done: true }] } };
      const before = JSON.stringify(s); renderRoutine();
      const ambiguous = exerciseBlocks([{ id: 'a', pair: 'A1' }, { id: 'b', pair: 'A1' }, { id: 'c', pair: 'B1' }]);
      return { unchanged: before === JSON.stringify(s), blocks: ambiguous.map(b => b.id) };
    });
    assert.deepEqual(result, { unchanged: true, blocks: [null, null, null] });
    assert.equal(await p.locator('[data-superset]').count(), 0);
    assert.equal(await p.locator('details[data-card]').count(), 1);
    assert.equal(await p.locator('[data-weight-step]:enabled').count(), 0);
  });
};
