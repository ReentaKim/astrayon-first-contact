import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battleReducer as reduce, initialState, clamp, type BattleState, type Attack } from '../src/game/state/battle';
import { SHOTS, shotAt, captionAt, DURATION } from '../src/game/data/shots';
const choose = (kind: Attack, state = initialState()) => reduce({...state, phase:'CHOICE_ATTACK', position:kind==='rifle'?{x:4,y:3}:{x:6,y:3}}, {type:'COMMIT',kind});
const finish = (s: BattleState) => reduce(s, { type: 'FINISH', session: s.session, actionId: s.action!.id });
test('title cannot accept attacks; start is idempotent', () => {
  const title = initialState();
  assert.equal(reduce(title, { type: 'COMMIT', kind: 'rifle' }), title);
  const started = reduce(title, { type: 'START' });
  assert.equal(reduce(started, { type: 'START' }), started);
});
test('rifle spends 20 EN, inflicts 1200, preserves HP and gains aim', () => {
  const s = choose('rifle');
  assert.deepEqual([s.heroHP, s.heroEN, s.rivalHP, s.aim], [6000, 80, 7800, 1]);
  assert.equal(s.action?.before.rivalHP, 9000);
  assert.equal(s.phase, 'ATTACK');
});
test('rush trades 400 HP for 1600 damage and preserves energy', () => {
  const s = choose('rush');
  assert.deepEqual([s.heroHP, s.heroEN, s.rivalHP, s.aim], [5600, 100, 7400, 0]);
});
test('100 simultaneous duplicate commands cannot spend or damage again', () => {
  const s = choose('rifle');
  let current = s;
  for (let i = 0; i < 100; i++) current = reduce(current, { type: 'COMMIT', kind: i % 2 ? 'rifle' : 'rush' });
  assert.equal(current, s);
  assert.equal(s.appliedActionIds.length, 1);
});
test('skip and natural completion share one outcome; duplicate completion is a no-op', () => {
  for (const kind of ['rifle', 'rush'] as const) {
    const s = choose(kind);
    const natural = finish(s);
    const skipped = finish(reduce(s, { type: 'PAUSE', paused: true }));
    assert.deepEqual(skipped, natural);
    assert.equal(finish(natural), natural);
    assert.equal(natural.phase, 'RESULT');
    assert.equal(natural.heroHP, s.heroHP);
    assert.equal(natural.rivalHP, s.rivalHP);
  }
});
test('pause preserves resources and blocks attack input', () => {
  const s = choose('rush');
  const paused = reduce(s, { type: 'PAUSE', paused: true });
  assert.equal(paused.paused, true);
  assert.equal(reduce(paused, { type: 'COMMIT', kind: 'rifle' }), paused);
  assert.deepEqual(reduce(paused, { type: 'PAUSE', paused: false }), s);
});
test('restart rotates session and rejects callbacks from three old sessions', () => {
  let current = choose('rush');
  const old: BattleState[] = [];
  for (let i = 0; i < 3; i++) {
    old.push(current);
    current = reduce(current, { type: 'RESTART' });
    assert.deepEqual([current.heroHP, current.heroEN, current.rivalHP], [6000, 100, 9000]);
    assert.deepEqual(current.appliedActionIds, []);
    current = choose('rifle',current);
  }
  for (const stale of old) {
    assert.equal(reduce(current, { type: 'FINISH', session: stale.session, actionId: stale.action!.id }), current);
  }
  assert.equal(current.phase, 'ATTACK');
  assert.equal(current.session, 4);
});
test('illegal resource use rejected; damage and meters clamp', () => {
  const weak = { ...initialState(), phase: 'CHOICE_ATTACK' as const, heroEN: 19 };
  assert.equal(reduce(weak, { type: 'COMMIT', kind: 'rifle' }), weak);
  const depleted = reduce({ ...weak, position:{x:6,y:3}, heroHP: 20, rivalHP: 100 }, { type: 'COMMIT', kind: 'rush' });
  assert.equal(depleted.heroHP, 0);
  assert.equal(depleted.rivalHP, 0);
  assert.equal(clamp(110, 100), 100);
  assert.equal(clamp(-20, 100), 0);
});
test('wrong action id is ignored in current session', () => {
  const s = choose('rifle');
  assert.equal(reduce(s, { type: 'FINISH', session: s.session, actionId: 'wrong' }), s);
});
test('pure reducer leaves original state and nested arrays untouched', () => {
  const initial = initialState(); const before = structuredClone(initial);
  choose('rush', initial);
  assert.deepEqual(initial, before);
});
test('nine shots cover the 20 second slice without gaps; branch captions differ', () => {
  assert.equal(SHOTS.length, 9);
  for (let i = 1; i < SHOTS.length; i++) assert.equal(SHOTS[i - 1].end, SHOTS[i].start);
  assert.equal(shotAt(1.2).id, 'K02');
  assert.equal(shotAt(13.5).id, 'K07');
  assert.equal(shotAt(DURATION).id, 'K09');
  assert.notEqual(captionAt(4, 'rifle')?.line, captionAt(4, 'rush')?.line);
});
