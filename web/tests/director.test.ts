import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { gsap } from 'gsap';
import { AttackDirector } from '../src/game/timeline/AttackDirector';
import type { BattleAudio } from '../src/game/audio/BattleAudio';
import { battleReducer, initialState } from '../src/game/state/battle';

function harness(t: TestContext) {
  const counts = { resumes: 0, pauses: 0, kills: 0, scores: 0, stops: 0, finishes: 0 };
  const timeline = {
    to() { return this; }, call() { return this; },
    pause() { counts.pauses++; return this; },
    resume() { counts.resumes++; return this; },
    kill() { counts.kills++; return this; },
  };
  t.mock.method(gsap, 'timeline', (() => timeline) as unknown as typeof gsap.timeline);
  const pending: ((ready: boolean) => void)[] = [];
  const audio = {
    resume: () => new Promise<boolean>(resolve => pending.push(resolve)),
    pause: () => Promise.resolve(true),
    startScore: () => { counts.scores++; }, stop: () => { counts.stops++; }, cue() {},
  } as unknown as BattleAudio;
  const state = battleReducer({ ...initialState(), phase: 'CHOICE_ATTACK', position: { x: 6, y: 3 } }, { type: 'COMMIT', kind: 'rush' });
  const director = new AttackDirector(state.action!, audio, () => {}, () => { counts.finishes++; });
  t.after(() => director.dispose());
  return { director, counts, pending };
}

test('director waits for audio and ignores a resume superseded by pause', async t => {
  const { director, counts, pending } = harness(t);
  assert.equal(counts.resumes, 0);
  director.pause(true);
  pending[0](true);
  await Promise.resolve();
  assert.equal(counts.resumes, 0);
  director.pause(false);
  pending[1](true);
  await Promise.resolve();
  assert.equal(counts.resumes, 1);
  assert.equal(counts.scores, 1);
});

test('late audio cannot revive a skipped action or complete it twice', async t => {
  const { director, counts, pending } = harness(t);
  director.skip();
  director.skip();
  pending[0](true);
  await Promise.resolve();
  assert.equal(counts.finishes, 1);
  assert.equal(counts.resumes, 0);
  assert.equal(counts.scores, 0);
});

test('a never-settling audio device falls back to silent playback', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { counts, pending } = harness(t);
  t.mock.timers.tick(399);
  assert.equal(counts.resumes, 0);
  t.mock.timers.tick(1);
  assert.equal(counts.resumes, 1);
  assert.equal(counts.scores, 0);
  assert.equal(counts.stops, 1);
  pending[0](true);
  await Promise.resolve();
  assert.equal(counts.resumes, 1);
  assert.equal(counts.scores, 0);
});

test('dispose cancels the audio watchdog and all delayed playback', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { director, counts, pending } = harness(t);
  director.dispose();
  t.mock.timers.tick(1000);
  pending[0](true);
  await Promise.resolve();
  assert.equal(counts.resumes, 0);
  assert.equal(counts.finishes, 0);
});
