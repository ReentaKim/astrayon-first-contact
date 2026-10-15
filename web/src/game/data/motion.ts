import type { Attack } from '../state/battle';

/** Angles are radians. The neutral upper/lower limbs point down; the muzzle points right. */
export interface JointPose {
  body: number; head: number; hip: number;
  frontArm: number; frontElbow: number; rearArm: number; rearElbow: number;
  frontLeg: number; frontKnee: number; rearLeg: number; rearKnee: number;
  weapon: number; binder: number;
}
export interface UnitMotion { x: number; y: number; pose: JointPose; grounding: number }
export interface BattleMotion { hero: UnitMotion; rival: UnitMotion; clock: number; zoom: number; focusX: number; focusY: number }
export const MOTION_CUES: Record<Attack, readonly { type: 'charge' | 'beam' | 'boost' | 'parry' | 'hit' | 'clash'; at: number }[]> = {
  rifle: [{ type: 'charge', at: 4.6 }, { type: 'beam', at: 6.1 }, { type: 'parry', at: 6.4 }, { type: 'charge', at: 11.5 }, { type: 'beam', at: 13.46 }, { type: 'clash', at: 13.5 }],
  rush: [{ type: 'charge', at: 4.2 }, { type: 'boost', at: 6 }, { type: 'parry', at: 6.62 }, { type: 'boost', at: 12.1 }, { type: 'clash', at: 13.5 }, { type: 'hit', at: 14.55 }],
};
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smooth = (n: number) => { const p = clamp01(n); return p * p * (3 - 2 * p); };
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export const IDLE: JointPose = {
  body: -.025, head: .025, hip: 0,
  frontArm: -.18, frontElbow: -.32, rearArm: .18, rearElbow: -.2,
  frontLeg: -.13, frontKnee: .1, rearLeg: .15, rearKnee: -.08,
  weapon: .38, binder: .03,
};
const pose = (changes: Partial<JointPose>): JointPose => ({ ...IDLE, ...changes });
const AIM = pose({ body: .045, head: -.045, frontArm: -1.08, frontElbow: -.56, rearArm: -.72, rearElbow: -.9, frontLeg: -.23, frontKnee: .24, rearLeg: .29, rearKnee: -.12, weapon: -.045 });
const RECOIL = pose({ ...AIM, body: -.09, head: .035, frontArm: -1.23, frontElbow: -.7, frontLeg: -.32, frontKnee: .39, weapon: -.09 });
const DRAW = pose({ hip: -.12, body: 0, head: .08, frontArm: -2.38, frontElbow: -1.07, rearArm: -.35, rearElbow: -1.1, frontLeg: -.28, frontKnee: .62, rearLeg: .67, rearKnee: -.32, weapon: -.7, binder: -.25 });
const CROUCH = pose({ ...DRAW, hip: .08, body: .12, head: -.18, frontArm: -.1, frontElbow: -1.1, rearArm: .85, rearElbow: -.75, frontLeg: -.86, frontKnee: 1.22, rearLeg: .76, rearKnee: -.45, weapon: -1.1, binder: -.45 });
const FLIGHT = pose({ ...CROUCH, hip: .18, body: .11, frontLeg: -.96, frontKnee: 1.34, rearLeg: .86, rearKnee: -.33, frontArm: -.5, frontElbow: -1.1, weapon: -.9, binder: -.55 });
const WINDUP = pose({ ...DRAW, hip: -.22, body: 0, head: .12, frontArm: -2.6, frontElbow: -.7, rearArm: -.48, rearElbow: -.8, frontLeg: -.24, frontKnee: .72, rearLeg: .78, rearKnee: -.25, weapon: -.95, binder: -.3 });
const LOADED = pose({ ...WINDUP, hip: -.29, body: .025, frontLeg: -.52, frontKnee: 1.06, rearLeg: .88, rearKnee: -.48, head: .16, binder: -.38 });
// At contact the hip + chest sum stays .18, preserving the verified blade/armor geometry.
const CONTACT = pose({ hip: .20, body: -.02, head: -.16, frontArm: -1.42, frontElbow: -.2, rearArm: .5, rearElbow: -.8, frontLeg: -.9, frontKnee: .8, rearLeg: .55, rearKnee: -.25, weapon: 1.64, binder: -.4 });
const COUNTER = pose({ ...CONTACT, hip: .14, body: .04, weapon: 1.38 });
const FOLLOW = pose({ ...CONTACT, hip: .33, body: -.05, head: -.2, frontArm: -.3, frontElbow: -.2, weapon: 1.85, rearArm: .8, frontLeg: -.98, frontKnee: 1.1, rearLeg: .45, rearKnee: -.18 });
const GUARD = pose({ body: -.045, head: .04, frontArm: -.9, frontElbow: -1.45, rearArm: -.78, rearElbow: -.75, frontLeg: -.34, frontKnee: .38, rearLeg: .37, rearKnee: -.16, weapon: -.5, binder: -.2 });
const HIT = pose({ body: -.34, head: .23, hip: -.24, frontArm: .72, frontElbow: .14, rearArm: -.94, rearElbow: .46, frontLeg: -.66, frontKnee: 1.18, rearLeg: .78, rearKnee: -.12, weapon: .92, binder: .5 });
const KNEEL = pose({ hip: .26, body: .32, head: -.08, frontArm: -.35, frontElbow: -.24, rearArm: -.8, rearElbow: -.4, frontLeg: -1.52, frontKnee: 2.02, rearLeg: -1.1, rearKnee: 1.65, weapon: .95, binder: .28 });
const STAGGER = pose({ body: .17, head: .09, hip: .06, frontArm: -.08, frontElbow: -.6, rearArm: -.3, rearElbow: -.65, frontLeg: -.38, frontKnee: .62, rearLeg: .3, rearKnee: -.1, weapon: .7, binder: .13 });

type Transition = 'smooth' | 'drive' | 'impact' | 'settle' | 'follow';
type Key = { t: number; x: number; y: number; pose: JointPose; transition: Transition; grounding: number };
const key = (t: number, x: number, y: number, p: JointPose, transition: Transition = 'smooth', grounding = 1): Key => ({ t, x, y, pose: p, transition, grounding });
const H = 619, R = 609;
const rifleHero: Key[] = [
  key(0, 420, H, IDLE), key(3.2, 420, H, IDLE), key(3.75, 424, H + 9, pose({ ...AIM, frontArm: -.55, frontElbow: -.45, weapon: .2 })),
  key(4.6, 430, H + 3, AIM), key(6.1, 430, H + 3, AIM), key(6.22, 407, H + 6, RECOIL), key(6.65, 425, H + 3, AIM),
  key(7.1, 429, H + 3, AIM), key(9, 429, H + 3, AIM), key(10.5, 429, H + 3, AIM),
  key(11.3, 420, H + 10, pose({ ...AIM, body: -.035, frontLeg: -.32, frontKnee: .38 })), key(12.5, 430, H + 3, AIM),
  key(13.46, 430, H + 3, AIM), key(13.56, 402, H + 7, RECOIL), key(14.05, 426, H + 3, AIM),
  key(15.1, 426, H + 3, AIM), key(16.5, 420, H, IDLE), key(20, 420, H, IDLE),
];
const rifleRival: Key[] = [
  key(0, 1180, R, IDLE), key(5.8, 1180, R, IDLE), key(6.33, 1174, R + 8, GUARD), key(6.4, 1174, R + 8, GUARD), key(6.65, 1205, R + 6, pose({ ...GUARD, body: -.17, frontArm: -.64 })),
  key(7.2, 1184, R + 4, GUARD), key(10.5, 1184, R + 4, GUARD), key(11.6, 1158, R + 5, WINDUP),
  key(13.45, 1120, R - 4, GUARD), key(13.5, 1120, R - 4, GUARD), key(13.87, 1240, R - 48, HIT, 'impact', 0),
  key(14.35, 1280, R + 8, pose({ ...HIT, body: -.12, hip: -.18, frontLeg: -.92, frontKnee: 1.48 }), 'follow', .45),
  key(15.2, 1290, R + 54, KNEEL, 'impact'), key(15.85, 1278, R + 50, pose({ ...KNEEL, body: .38, head: -.14 }), 'follow'),
  key(16.7, 1236, R + 20, pose({ ...STAGGER, hip: .12, frontKnee: .92, rearKnee: .34 }), 'settle'), key(18.2, 1190, R + 6, STAGGER, 'settle'), key(20, 1190, R + 6, STAGGER),
];
const rushHero: Key[] = [
  key(0, 420, H, IDLE), key(3.2, 420, H, IDLE), key(4.2, 425, H + 3, DRAW), key(5.5, 408, H + 22, CROUCH),
  key(6, 400, H + 27, CROUCH), key(6.24, 462, H - 35, FLIGHT, 'drive', 0), key(6.48, 600, H - 40, WINDUP, 'follow', 0), key(6.62, 700, H - 30, CONTACT, 'drive', 0),
  key(6.95, 650, H - 29, pose({ ...GUARD, hip: -.18, body: .06, weapon: .8, frontKnee: 1.15 }), 'impact', 0), key(7.45, 584, H + 18, CROUCH, 'follow'), key(8.2, 550, H + 7, DRAW, 'settle'),
  key(10.5, 550, H + 7, DRAW), key(11.3, 528, H + 20, WINDUP), key(12.1, 548, H + 12, WINDUP),
  key(12.85, 536, H + 24, LOADED), key(13.5, 728, H - 25, CONTACT, 'drive', 0), key(13.86, 808, H - 5, FOLLOW, 'follow', .2),
  key(14.35, 784, H + 10, FOLLOW, 'settle'), key(14.55, 784, H + 10, FOLLOW), key(14.86, 710, H - 36, HIT, 'impact', 0),
  key(15.42, 654, H + 48, pose({ ...KNEEL, body: .27, frontKnee: 1.48, rearKnee: .72 }), 'follow'),
  key(16.2, 560, H + 20, pose({ ...STAGGER, hip: .14, weapon: 1.25 }), 'settle'), key(18, 420, H, IDLE, 'settle'), key(20, 420, H, IDLE),
];
const rushRival: Key[] = [
  key(0, 1180, R, IDLE), key(5.6, 1180, R, IDLE), key(6.4, 1102, R + 8, GUARD), key(6.62, 1065, R + 8, GUARD),
  key(6.96, 1118, R + 12, pose({ ...GUARD, hip: -.17, body: -.13, frontKnee: .85, rearKnee: .12 }), 'impact'), key(7.6, 1110, R + 5, DRAW, 'settle'), key(10.5, 1110, R + 5, DRAW),
  key(11.5, 1120, R + 15, WINDUP), key(12.7, 1060, R - 14, WINDUP, 'smooth', .5), key(13.5, 1045, R - 10, COUNTER, 'drive', 0),
  key(13.92, 1200, R - 52, HIT, 'impact', 0), key(14.25, 1160, R + 20, pose({ ...GUARD, hip: .08, body: .1, weapon: -.8, frontKnee: 1.05, rearKnee: .45 }), 'follow'),
  key(14.55, 1080, R - 4, COUNTER, 'drive'), key(14.92, 1192, R + 10, FOLLOW, 'follow'),
  key(15.5, 1260, R + 52, KNEEL, 'impact'), key(16.1, 1250, R + 52, pose({ ...KNEEL, body: .39, head: -.16 }), 'follow'),
  key(17, 1215, R + 20, pose({ ...STAGGER, hip: .1, frontKnee: .85, rearKnee: .3 }), 'settle'), key(18.2, 1190, R + 6, STAGGER, 'settle'), key(20, 1190, R + 6, STAGGER),
];

function jointProgress(progress: number, transition: Transition, joint: keyof JointPose) {
  if (transition === 'drive') {
    const delay = joint === 'hip' || joint.endsWith('Leg') || joint.endsWith('Knee') ? 0 : joint === 'body' ? .18 : joint === 'frontArm' ? .34 : joint === 'frontElbow' ? .46 : joint === 'weapon' ? .58 : .22;
    const span = delay === 0 ? .7 : 1 - delay;
    return smooth((progress - delay) / span);
  }
  if (transition === 'impact') {
    const delay = joint === 'body' || joint === 'head' ? 0 : joint === 'hip' ? .06 : joint.endsWith('Knee') ? .32 : .18;
    return smooth((progress - delay) / (1 - delay));
  }
  if (transition === 'settle' || transition === 'follow') {
    const delay = joint === 'hip' || joint.endsWith('Leg') || joint.endsWith('Knee') ? 0 : joint === 'body' ? .12 : joint === 'head' ? .28 : joint === 'binder' ? .36 : .2;
    return smooth((progress - delay) / (1 - delay));
  }
  return smooth(progress);
}

function sample(keys: Key[], t: number): UnitMotion {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[i + 1], progress = clamp01((t - a.t) / (b.t - a.t));
  const p = b.transition === 'drive' ? progress * progress : b.transition === 'impact' || b.transition === 'follow' ? 1 - (1 - progress) ** 3 : smooth(progress);
  const result = {} as JointPose;
  for (const name of Object.keys(a.pose) as (keyof JointPose)[]) result[name] = mix(a.pose[name], b.pose[name], jointProgress(progress, b.transition, name));
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), pose: result, grounding: mix(a.grounding, b.grounding, smooth(progress)) };
}

/** Freeze at contact for 90ms, then repay the delay smoothly. There is no second clock or timer. */
export function contactClock(time: number, attack: Attack | null, reduced = false) {
  const t = Math.min(20, Math.max(0, time));
  if (reduced || !attack) return t;
  const contacts = attack === 'rush' ? [6.62, 13.5, 14.55] : [6.4, 13.5];
  for (const contact of contacts) {
    const q = t - contact;
    if (q >= 0 && q <= .09) return contact;
    if (q > .09 && q < .39) return t - .09 * (1 - smooth((q - .09) / .3));
  }
  return t;
}

/** Pure and seekable; jumping ahead, pausing, restarting, and reverse review cannot accumulate transforms. */
export function battleMotion(time: number, attack: Attack | null, reduced = false): BattleMotion {
  const t = contactClock(time, attack, reduced);
  const hero = attack ? sample(attack === 'rush' ? rushHero : rifleHero, t) : { x: 420, y: H, pose: { ...IDLE }, grounding: 1 };
  const rival = attack ? sample(attack === 'rush' ? rushRival : rifleRival, t) : { x: 1180, y: R, pose: { ...IDLE }, grounding: 1 };
  // Subtle opposing idle weight shifts animate joints rather than translating the whole illustration.
  const breathe = reduced ? 0 : Math.sin(t * 2.3) * .012;
  hero.pose.rearArm += breathe; hero.pose.head -= breathe * .5;
  rival.pose.rearArm -= breathe; rival.pose.head += breathe * .4;
  const prepare = attack ? smooth((t - 3.2) / .9) * (1 - smooth((t - 5.7) / .55)) : 0;
  const clash = attack ? smooth((t - 11.4) / 1.4) * (1 - smooth((t - 15) / 1.5)) : 0;
  const impactPunch = attack ? smooth((t - 13.38) / .12) * (1 - smooth((t - 13.5) / .4)) : 0;
  return { hero, rival, clock: t, zoom: reduced ? 1 : 1 + prepare * .115 + clash * .07 + impactPunch * .09, focusX: 800 - prepare * 160, focusY: 450 + prepare * 25 };
}
