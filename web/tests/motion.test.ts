import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { Container, Texture, TextureSource } from 'pixi.js';
import { battleMotion, contactClock, MOTION_CUES } from '../src/game/data/motion';
import { SDMechaRig, SD_PARTS, type PartTextures } from '../src/game/scenes/SDMechaRig';

test('both branches can be sought in either direction without accumulated animation state', () => {
  for (const attack of ['rifle', 'rush'] as const) {
    const expected = battleMotion(13.5, attack);
    for (let t = 20; t >= 0; t -= .25) battleMotion(t, attack);
    assert.deepEqual(battleMotion(13.5, attack), expected);
    for (let t = 0; t <= 20; t += .01) {
      const current = battleMotion(t, attack), next = battleMotion(t + .01, attack);
      for (const unit of ['hero', 'rival'] as const) {
        assert.ok(Number.isFinite(current[unit].x) && Number.isFinite(current[unit].y));
        assert.ok(Math.hypot(next[unit].x - current[unit].x, next[unit].y - current[unit].y) < 20, `${attack} ${unit} teleport at ${t}`);
        for (const angle of Object.values(current[unit].pose)) assert.ok(Number.isFinite(angle));
      }
    }
  }
});

test('impact freezes for 90ms, is monotonic, catches up, and reduced motion removes freeze', () => {
  assert.equal(contactClock(13.5, 'rush'), 13.5);
  assert.equal(contactClock(13.585, 'rush'), 13.5);
  assert.equal(contactClock(14, 'rush'), 14);
  assert.equal(contactClock(13.55, 'rush', true), 13.55);
  for (let t = 0; t < 20; t += .001) assert.ok(contactClock(t + .001, 'rush') >= contactClock(t, 'rush'));
});

test('each branch has ordered causal sound markers and rush counter precedes hero flinch', () => {
  for (const attack of ['rifle', 'rush'] as const) {
    const cues = MOTION_CUES[attack];
    assert.ok(cues.every((cue, i) => i === 0 || cue.at >= cues[i - 1].at));
    assert.equal(cues.find(cue => cue.type === 'clash')?.at, 13.5);
  }
  const contact = MOTION_CUES.rush.find(cue => cue.type === 'hit')!.at;
  assert.equal(battleMotion(contact - .001, 'rush').hero.x, battleMotion(contact, 'rush').hero.x);
  assert.ok(battleMotion(contact + .3, 'rush').hero.x < battleMotion(contact, 'rush').hero.x);
});

test('the main swing releases weight through hip, chest, arm, then wrist instead of moving as one pose', () => {
  const loaded = battleMotion(12.85, 'rush', true).hero.pose;
  const hipLead = battleMotion(13, 'rush', true).hero.pose;
  const armRelease = battleMotion(13.25, 'rush', true).hero.pose;
  const contact = battleMotion(13.5, 'rush', true).hero.pose;
  assert.ok(hipLead.hip - loaded.hip > .1, 'the pelvis leads the strike');
  assert.equal(hipLead.frontArm, loaded.frontArm, 'shoulder still holds the loaded weapon');
  assert.equal(hipLead.weapon, loaded.weapon, 'wrist waits for the body');
  assert.ok(armRelease.frontArm - loaded.frontArm > .4, 'shoulder accelerates after weight transfer');
  assert.ok(armRelease.weapon - loaded.weapon < .1, 'blade is still trailing the shoulder');
  assert.ok(contact.weapon - armRelease.weapon > 2, 'blade releases into contact');
  assert.ok(Math.abs(contact.frontKnee - contact.rearKnee) > 1, 'legs counterbalance asymmetrically');
});

test('contact precedes recoil, feet leave the deck on impact, then knees take the landing weight', () => {
  for (const attack of ['rifle', 'rush'] as const) {
    const contact = battleMotion(13.5, attack), frozen = battleMotion(13.58, attack), thrown = battleMotion(13.92, attack);
    assert.deepEqual(frozen.rival, contact.rival, 'hitstop holds the exact contacted pose');
    assert.ok(thrown.rival.x - contact.rival.x >= 120, 'impact pushes the defender backward');
    assert.ok(thrown.rival.pose.body < -.25 && thrown.rival.pose.hip < -.2, 'chest and pelvis lose balance');
    assert.ok(thrown.rival.grounding < .02, 'impact briefly lifts the supporting foot');
    const buckled = battleMotion(15.5, attack).rival, recovered = battleMotion(18.2, attack).rival;
    assert.ok(buckled.pose.frontKnee > 1.9 && buckled.pose.rearKnee > 1.5, 'landing is absorbed by folded knees');
    assert.ok(recovered.pose.frontKnee < .7 && recovered.grounding === 1, 'the defender regains a supported stance');
  }
  const counter = battleMotion(14.55, 'rush').hero, hit = battleMotion(14.86, 'rush').hero;
  assert.ok(counter.x - hit.x > 70, 'the return hit visibly displaces the attacker');
  assert.ok(hit.pose.hip < -.2 && hit.grounding < .02, 'attacker also loses its stance after the counter');
});

async function makeRig(side: 'hero' | 'rival') {
  const parts = {} as PartTextures;
  for (const part of SD_PARTS) {
    const metadata = await sharp(`public/game/sd/${side}/${part}.webp`).metadata();
    assert.ok(metadata.hasAlpha && metadata.width && metadata.height, `${side}/${part} has transparent valid pixels`);
    parts[part] = new Texture({ source: new TextureSource({ width: metadata.width, height: metadata.height }) });
  }
  return new SDMechaRig(parts, side);
}
const distanceToSegment = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x, dy = b.y - a.y, ratio = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + ratio * dx), p.y - (a.y + ratio * dy));
};

test('actual-part blade sockets meet target armor, and camera transforms cannot displace contact', async () => {
  const scene = new Container(), world = new Container();
  const hero = await makeRig('hero'), rival = await makeRig('rival');
  rival.setScale(1.02);
  world.addChild(scene); scene.addChild(hero.root, rival.root);
  for (const [time, attacker, defender, target] of [[6.62, hero, rival, 'shield'], [13.5, hero, rival, 'chest'], [14.55, rival, hero, 'chest']] as const) {
    const motion = battleMotion(time, 'rush'); hero.apply(motion.hero, 'rush'); rival.apply(motion.rival, 'rush');
    const base = attacker.socket('bladeBase', scene), tip = attacker.socket('bladeTip', scene), chest = defender.socket(target, scene);
    assert.ok(distanceToSegment(chest, base, tip) < 30, `blade must meet ${target} armor at ${time}`);
    world.scale.set(.43); scene.scale.set(1.14); scene.pivot.set(640, 475); scene.position.set(800, 450);
    const transformedTip = attacker.socket('bladeTip', scene);
    assert.ok(Math.hypot(transformedTip.x - tip.x, transformedTip.y - tip.y) < .001, 'effect socket remains in scene space');
  }
  for (const [time, targetName] of [[6.1, 'shield'], [13.46, 'chest']] as const) {
    const rifle = battleMotion(time, 'rifle'); hero.apply(rifle.hero, 'rifle'); rival.apply(rifle.rival, 'rifle');
    const target = rival.socket(targetName, scene); hero.aimRifleAt(target, scene);
    const muzzle = hero.socket('muzzle', scene), direction = hero.barrelDirection(scene);
    const dx = target.x - muzzle.x, dy = target.y - muzzle.y, distance = Math.hypot(dx, dy);
    assert.ok(Math.abs((dx * direction.y - dy * direction.x) / distance) < .000001, `barrel and beam agree at ${time}`);
    assert.ok(dx * direction.x + dy * direction.y > 0, 'muzzle points toward target');
  }
  world.destroy({ children: true });
});

test('painted joint landmarks stay coincident through both branches including hip rotations and aiming', async () => {
  const scene = new Container(), hero = await makeRig('hero'), rival = await makeRig('rival');
  scene.addChild(hero.root, rival.root); rival.setScale(1.02);
  for (const attack of ['rifle', 'rush'] as const) {
    for (let time = 0; time <= 20; time += .05) {
      const motion = battleMotion(time, attack); hero.apply(motion.hero, attack); rival.apply(motion.rival, attack);
      if (attack === 'rifle') hero.aimRifleAt(rival.socket(time < 8 ? 'shield' : 'chest', scene), scene);
      for (const rig of [hero, rival]) {
        for (const joint of rig.jointPairs(scene)) {
          assert.ok(Math.hypot(joint.parent.x - joint.child.x, joint.parent.y - joint.child.y) < .000001, `${rig.side} ${joint.name} detaches at ${time}`);
        }
      }
    }
  }
  scene.destroy({ children: true });
});

test('actual soles never penetrate the deck and the buckled defender lowers its center of mass', async () => {
  const scene = new Container(), hero = await makeRig('hero'), rival = await makeRig('rival');
  scene.addChild(hero.root, rival.root); rival.setScale(1.02);
  for (const attack of ['rifle', 'rush'] as const) {
    for (const reduced of [false, true]) for (let time = 0; time <= 20; time += .01) {
      const motion = battleMotion(time, attack, reduced);
      for (const [rig, floor] of [[hero, 750], [rival, 740]] as const) {
        rig.apply(motion[rig.side], attack);
        const supportingSole = Math.max(rig.socket('frontSole', scene).y, rig.socket('rearSole', scene).y);
        assert.ok(supportingSole <= floor + .000001, `${attack} ${rig.side} foot penetrates at ${time}`);
        if (motion[rig.side].grounding === 1) assert.ok(Math.abs(supportingSole - floor) < .000001, 'a planted stance has an actual supporting sole');
      }
    }
    rival.apply(battleMotion(15.5, attack).rival, attack);
    const collapsedPelvis = rival.socket('pelvis', scene).y;
    rival.apply(battleMotion(18.2, attack).rival, attack);
    assert.ok(collapsedPelvis - rival.socket('pelvis', scene).y > 25, 'knees lower the actual body while a foot stays planted');
  }
  hero.apply(battleMotion(13.5, 'rush').hero, 'rush');
  assert.ok(Math.max(hero.socket('frontSole', scene).y, hero.socket('rearSole', scene).y) < 725, 'attack flight retains visible clearance');
  scene.destroy({ children: true });
});
