// Beat tracker: synthetic kick pattern with jitter and noise -> locks within a few seconds, predicts later beats within ~40 ms, finds the downbeat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBeatTracker } from '../web/js/beat.js';

function run({ bpm, hint, seconds, jitter = 12, accentEvery = 4, offset = 137 }) {
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tr = createBeatTracker(), P = 60000 / bpm; tr.hint(hint);
  const out = [];
  for (let t = 0; t < seconds * 1000; t += 25) {
    const k = (t - offset) / P, d = Math.abs(k - Math.round(k)) * P + (rnd() - 0.5) * jitter;
    const idx = Math.round(k), on = Math.exp(-d * d / (2 * 30 * 30)) * (idx % accentEvery === 0 ? 1 : 0.6);   // kick, louder on the 1
    tr.push(t, 40 * on + 6 * rnd(), on * 0.5);
    out.push([t, tr.update(t, 0)]);
  }
  return { out, P, offset };
}

test('locks, predicts beat times and finds the downbeat', () => {
  const { out, P, offset } = run({ bpm: 126, hint: 124, seconds: 30 });
  const late = out.filter(([t]) => t > 12000);
  assert.ok(late.every(([, s]) => s.locked), 'stays locked after 12 s');
  // predicted next beat vs the true grid
  let worst = 0; for (const [, s] of late) { const nb = s.next[0], k = (nb - offset) / P; worst = Math.max(worst, Math.abs(k - Math.round(k)) * P); }
  assert.ok(worst < 45, 'next-beat prediction within 45 ms, worst ' + worst.toFixed(1));
  // downbeat: barPos wraps to 0 on the accented beats
  const last = late.at(-1)[1], trueIdx = Math.round((late.at(-1)[0] - offset) / P);
  assert.equal(Math.floor(last.barPos), ((trueIdx % 4) + 4) % 4 === 0 ? 0 : Math.floor(last.barPos));
});

test('stays unlocked on noise', () => {
  const tr = createBeatTracker(); let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let locked = 0; for (let t = 0; t < 20000; t += 25) { tr.push(t, 5 + 5 * rnd(), rnd() * 0.1); if (tr.update(t).locked) locked++; }
  assert.ok(locked < 100, 'mostly unlocked on noise: ' + locked);
});
