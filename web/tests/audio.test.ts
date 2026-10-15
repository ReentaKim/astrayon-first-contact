import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleAudio } from '../src/game/audio/BattleAudio';

class FakeAudioContext {
  static latest: FakeAudioContext;
  state: AudioContextState = 'suspended';
  destination = {};
  currentTime = 0;
  failResume = false;
  suspendPending: (() => void) | null = null;
  constructor() { FakeAudioContext.latest = this; }
  createGain() {
    return { gain: { value: 0, setTargetAtTime() {} }, connect() {}, disconnect() {} };
  }
  async resume() {
    await Promise.resolve();
    if (this.failResume) throw new Error('Unavailable audio device');
    if (this.state !== 'closed') this.state = 'running';
  }
  async suspend() {
    await new Promise<void>(resolve => { this.suspendPending = resolve; });
    if (this.state !== 'closed') this.state = 'suspended';
  }
  async close() { this.state = 'closed'; this.suspendPending?.(); }
}

async function withAudio(run: (audio: BattleAudio, context: FakeAudioContext) => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
  const audio = new BattleAudio();
  try {
    assert.equal(await audio.unlock(), true);
    await run(audio, FakeAudioContext.latest);
  } finally {
    audio.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
}

test('resume waits for an in-flight suspend, then restores the audio clock', async () => {
  await withAudio(async (audio, context) => {
    const paused = audio.pause();
    await Promise.resolve();
    assert.ok(context.suspendPending);
    // AudioContext.state remains running until the suspend promise settles.
    assert.equal(context.state, 'running');
    const resumed = audio.resume();
    context.suspendPending();
    await paused;
    assert.equal(await resumed, true);
    assert.equal(context.state, 'running');
  });
});

test('rapid repeated toggles settle on the latest requested state', async () => {
  await withAudio(async (audio, context) => {
    const first = audio.pause();
    await Promise.resolve();
    const resumed = audio.resume();
    const last = audio.pause();
    context.suspendPending?.();
    await Promise.all([first, resumed, last]);
    assert.equal(context.state, 'suspended');
    assert.equal(await audio.resume(), true);
    assert.equal(context.state, 'running');
  });
});

test('dispose invalidates pending context transitions without reopening audio', async () => {
  await withAudio(async (audio, context) => {
    const paused = audio.pause();
    await Promise.resolve();
    const resumed = audio.resume();
    audio.dispose();
    assert.deepEqual(await Promise.all([paused, resumed]), [false, false]);
    assert.equal(context.state, 'closed');
    assert.equal(await audio.resume(), false);
  });
});

test('failed audio resume settles safely and can recover on a later gesture', async () => {
  await withAudio(async (audio, context) => {
    const paused = audio.pause();
    await Promise.resolve();
    context.suspendPending?.();
    await paused;
    context.failResume = true;
    assert.equal(await audio.resume(), false);
    context.failResume = false;
    assert.equal(await audio.resume(), true);
  });
});
