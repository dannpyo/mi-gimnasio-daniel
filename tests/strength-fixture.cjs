// Synthetic records only. Executed inside the browser with page.evaluate.
module.exports = function seedStrengthFixture() {
  state = fresh();
  const press = { id: 'test-press', name: 'Press con barra', alt: 'Press en máquina A', group: 'Pectorales' };
  const row = { id: 'test-row', name: 'Remo en polea A', group: 'Espalda' };
  function add(key, date, items, extra = {}) {
    const s = { key, date, mode: 'weekly', scheme: 'base', week: 1, dayId: 'w1', finished: true, title: key, snapshot: [], exercises: {}, ...extra };
    for (const item of items) {
      const ex = { kind: 'main', sets: [{ unit: 'reps' }], ...item.ex };
      s.snapshot.push({ ...ex, target: item.target || item.sets.length });
      s.exercises[ex.id] = { variant: item.variant || 'base', sets: item.sets.map(z => ({ done: true, ...z })) };
    }
    state.sessions[key] = s;
  }
  add('press-new', '2026-11-03', [{ ex: press, sets: [{ kg: 55, reps: 6 }, { kg: 999, reps: 1, done: false }, { kg: null, reps: 8 }, { kg: 900, reps: 0 }, { kg: 800, reps: 2.5 }] }]);
  add('press-old', '2026-11-01', [{ ex: press, sets: [{ kg: 40, reps: 10 }] }]);
  add('press-middle', '2026-11-02', [{ ex: press, sets: [{ kg: 50, reps: 8 }] }]);
  add('row-old', '2026-11-01', [{ ex: row, sets: [{ kg: 40, reps: 10 }] }]);
  add('row-new', '2026-11-02', [{ ex: row, sets: [{ kg: 40, reps: 6 }] }]);
  add('machine-a-old', '2026-11-01', [{ ex: press, variant: 'alt', sets: [{ kg: 60, reps: 8 }] }]);
  add('machine-a-new', '2026-11-02', [{ ex: press, variant: 'alt', sets: [{ kg: 65, reps: 6 }] }]);
  add('machine-b', '2026-11-04', [{ ex: { ...press, alt: 'Press en máquina B' }, variant: 'alt', sets: [{ kg: 90, reps: 8 }] }]);
  add('same-name-another-record', '2026-11-04', [{ ex: { ...press, id: 'test-press-other' }, sets: [{ kg: 300, reps: 5 }] }], { scheme: 'h23i' });
  add('one-session', '2026-11-02', [{ ex: { id: 'test-leg', name: 'Prensa de piernas', group: 'Piernas' }, sets: [{ kg: 120, reps: 10 }] }]);
  add('not-finished', '2026-11-05', [{ ex: press, sets: [{ kg: 999, reps: 5 }] }], { finished: false });
  const curl = { id: 'test-curl', name: 'Curl con barra', group: 'Bíceps' };
  add('curl-old', '2026-11-01', [{ ex: curl, sets: [{ kg: 20, reps: 10 }] }]);
  add('curl-new', '2026-11-02', [{ ex: curl, sets: [{ kg: 17.5, reps: 8 }, { kg: 17.5, reps: 10 }] }]);
  const zero = { id: 'test-zero', name: 'Elevación con carga', group: 'Hombros' };
  add('zero-old', '2026-11-01', [{ ex: zero, sets: [{ kg: 0, reps: 10 }] }]);
  add('zero-new', '2026-11-02', [{ ex: zero, sets: [{ kg: 10, reps: 10 }] }]);
  const squat = { id: 'test-squat', name: 'Sentadilla con barra', group: 'Piernas' };
  add('squat-old', '2026-11-01', [{ ex: squat, sets: [{ kg: 60, reps: 10 }] }]);
  add('squat-new', '2026-11-02', [{ ex: squat, sets: [{ kg: 65, reps: 12 }, { kg: 60, reps: 8 }] }]);
  const excluded = [
    { id: 'test-warmup', name: 'Calentamiento', kind: 'warmup' },
    { id: 'test-cardio', name: 'Cardio', kind: 'cardio' },
    { id: 'test-timed', name: 'Isometría', sets: [{ unit: 'seg' }] },
    { id: 'test-minutes', name: 'Duración', sets: [{ unit: 'min' }] },
    { id: 'test-hidden', name: 'Omitido' }
  ];
  add('exclusions', '2026-11-02', excluded.map(ex => ({ ex, sets: [{ kg: 50, reps: 10 }] })), { selected: { 'test-hidden': false } });
  add('missing-data', '2026-11-02', [{ ex: { id: 'test-invalid', name: 'Sin datos' }, sets: [{ kg: null, reps: 10 }, { kg: 30, reps: null }, { kg: -5, reps: 8 }] }]);
  add('more-than-ten', '2026-11-02', [{ ex: { id: 'test-high-reps', name: 'Extensión en polea', group: 'Tríceps' }, sets: [{ kg: 30, reps: 12 }] }]);
  add('bodyweight', '2026-11-02', [{ ex: { id: 'test-assisted', name: 'Dominadas asistidas', group: 'Espalda' }, sets: [{ kg: 40, reps: 8 }] }]);
  add('hidden-set', '2026-11-02', [{ ex: { id: 'test-target', name: 'Remo con barra', group: 'Espalda' }, target: 1, sets: [{ kg: 20, reps: 10 }, { kg: 999, reps: 1 }] }]);
  add('one-rep', '2026-11-02', [{ ex: { id: 'test-one-rep', name: 'Peso muerto con barra', group: 'Espalda' }, sets: [{ kg: 150, reps: 1 }] }]);
  setTab('history');
};
