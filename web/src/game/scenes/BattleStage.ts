import { Application, Assets, Container, Graphics, Sprite, Texture, type PointData } from 'pixi.js';
import { battleMotion, clamp01, mix, smooth } from '../data/motion';
import type { Attack } from '../state/battle';
import { SDMechaRig, SD_PARTS, type PartTextures, type Socket } from './SDMechaRig';

const W = 1600, H = 900;
/** A single seekable clock drives articulated parts, camera, weapon sockets and effects. */
export class BattleStage {
  private app = new Application();
  private world = new Container();
  private scenery = new Container();
  private backdrop!: Sprite;
  private hero!: SDMechaRig;
  private rival!: SDMechaRig;
  private samples!: Record<'hero' | 'rival', SDMechaRig>;
  private impactOrigins = new Map<string, PointData>();
  private trails = new Graphics();
  private fx = new Graphics();
  private atmosphere = new Graphics();
  private shadows = new Graphics();
  private veil = new Graphics();
  private textures: Record<string, Texture> = {};
  private disposed = false;
  private initialized = false;
  private destroyed = false;
  private reduced = false;
  private observer: ResizeObserver | null = null;
  private glLostHandler: ((event: Event) => void) | null = null;
  constructor(private host: HTMLElement) {}

  async init(onWarning: (message: string) => void, onFatal: () => void) {
    await this.app.init({ width: W, height: H, backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 1.5), autoDensity: true, autoStart: false, preference: 'webgl' });
    this.initialized = true;
    if (this.disposed) { this.destroyRenderer(); return false; }
    const requests = (['hero', 'rival'] as const).flatMap(unit => SD_PARTS.map(part => ({ key: `${unit}-${part}`, url: `/game/sd/${unit}/${part}.webp` })));
    requests.push({ key: 'battlefield', url: '/game/sd/battlefield.webp' });
    const entries = await Promise.allSettled(requests.map(async ({ key, url }) => ({ key, texture: await Assets.load<Texture>(url) })));
    if (this.disposed) { this.destroyRenderer(); return false; }
    for (const entry of entries) if (entry.status === 'fulfilled') this.textures[entry.value.key] = entry.value.texture;
    for (const unit of ['hero', 'rival'] as const) {
      for (const part of SD_PARTS) if (!this.textures[`${unit}-${part}`]) throw new Error(`${unit} 관절 스프라이트 누락: ${part}`);
    }
    if (!this.textures.battlefield) {
      this.textures.battlefield = await Assets.load<Texture>('/game/art/orbit.webp');
      onWarning('전장 배경을 읽지 못해 예비 배경으로 표시합니다. 새로 불러오기로 재시도할 수 있습니다.');
    }
    if (this.disposed) { this.destroyRenderer(); return false; }
    this.host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.glLostHandler = event => { event.preventDefault(); onFatal(); };
    this.app.canvas.addEventListener('webglcontextlost', this.glLostHandler);
    this.backdrop = new Sprite(this.textures.battlefield);
    this.backdrop.anchor.set(.5); this.backdrop.position.set(800, 450);
    this.backdrop.width = 1712; this.backdrop.height = 963;
    const parts = (unit: 'hero' | 'rival') => Object.fromEntries(SD_PARTS.map(part => [part, this.textures[`${unit}-${part}`]])) as PartTextures;
    this.hero = new SDMechaRig(parts('hero'), 'hero');
    this.rival = new SDMechaRig(parts('rival'), 'rival');
    this.rival.setScale(1.02);
    // Hidden rigs sample past weapon positions on the same timeline. They share textures
    // and never render; seeking backward cannot leave a trail from a previous playback.
    this.samples = { hero: new SDMechaRig(parts('hero'), 'hero'), rival: new SDMechaRig(parts('rival'), 'rival') };
    this.samples.rival.setScale(1.02);
    this.samples.hero.root.visible = this.samples.rival.root.visible = false;
    this.app.stage.addChild(this.world);
    this.world.addChild(this.scenery);
    this.scenery.addChild(this.backdrop, this.atmosphere, this.shadows, this.trails, this.rival.root, this.hero.root, this.fx, this.veil);
    this.scenery.addChild(this.samples.hero.root, this.samples.rival.root);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host); this.resize(); this.render(0, null);
    return true;
  }
  private resize() {
    if (this.disposed || !this.initialized) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    if (!width || !height) return;
    this.app.renderer.resize(width, height);
    this.world.scale.set(width / W, height / H);
    this.app.render();
  }
  setReduced(value: boolean) { this.reduced = value; }

  render(time: number, attack: Attack | null) {
    if (this.disposed || !this.hero) return;
    const motion = battleMotion(time, attack, this.reduced), t = motion.clock;
    this.fx.clear(); this.trails.clear(); this.atmosphere.clear(); this.shadows.clear(); this.veil.clear();
    this.hero.apply(motion.hero, attack); this.rival.apply(motion.rival, attack);
    this.hero.damage(0); this.rival.damage(0);
    this.scenery.pivot.set(motion.focusX, motion.focusY);
    this.scenery.position.set(800, 450);
    this.scenery.scale.set(motion.zoom);
    this.backdrop.alpha = 1;
    if (attack === 'rifle') {
      const guard = this.rival.socket('shield', this.scenery), chest = this.rival.socket('chest', this.scenery);
      const retarget = smooth((t - 8) / 3);
      const target = { x: mix(guard.x, chest.x, retarget), y: mix(guard.y, chest.y, retarget) };
      this.hero.aimRifleAt(target, this.scenery, smooth((t - 3.75) / .85) * (1 - smooth((t - 15.1) / 1.4)));
    }
    const heroGround = 750, rivalGround = 740;
    for (const [unit, ground] of [[this.hero, heroGround], [this.rival, rivalGround]] as const) {
      const feet = [unit.socket('frontSole', this.scenery), unit.socket('rearSole', this.scenery)];
      const air = clamp01((ground - Math.max(...feet.map(foot => foot.y))) / 130);
      const center = (feet[0].x + feet[1].x) / 2;
      this.shadows.ellipse(center, ground, 87 - air * 25, 14 - air * 6).fill({ color: 0x071322, alpha: .27 - air * .12 });
      for (const foot of feet) {
        const planted = 1 - clamp01(Math.abs(ground - foot.y) / 35);
        this.shadows.ellipse(foot.x, ground, 25, 4).fill({ color: 0x030a12, alpha: planted * .32 });
      }
      if (attack === 'rush' || unit === this.rival) this.blade(unit, unit === this.hero ? 0x6ffff0 : 0xff5677, attack ? smooth((t - 3.5) / .5) : .6);
    }
    this.dust(t);
    if (attack) {
      if (attack === 'rifle') this.rifleEffects(t);
      else this.rushEffects(t);
      this.groundEffects(t, attack);
      // Cut-ins dim the stage, but both machines continue their own staged preparation underneath.
      const cutin = smooth((t - 1.2) / .18) * (1 - smooth((t - 2.95) / .25));
      const rivalCutin = smooth((t - 9) / .14) * (1 - smooth((t - 10.3) / .2));
      if (cutin || rivalCutin) this.veil.rect(-200, -150, 2000, 1200).fill({ color: 0x06111d, alpha: Math.max(cutin, rivalCutin) * .35 });
    }
    this.app.render();
  }

  private rifleEffects(t: number) {
    const muzzle = this.hero.socket('muzzle', this.scenery), target = this.rival.socket('chest', this.scenery);
    const guard = this.rival.socket('shield', this.scenery);
    this.charge(muzzle, t, 4.6, 6.1, 0x74fff3);
    this.charge(muzzle, t, 11.5, 13.46, 0x74fff3);
    this.projectile(muzzle, guard, t, 6.1, 6.4, .4);
    this.projectile(muzzle, target, t, 13.46, 13.5, .32);
    if (t >= 6.4 && t < 7.2) {
      const age = t - 6.4;
      const contact = this.impactOrigin('rifle', 6.4, 'rival', 'shield');
      this.sparks(contact, age, .65);
      this.fx.ellipse(contact.x, contact.y, 22 + age * 30, 76 + age * 35).stroke({ width: 3, color: 0xff849c, alpha: clamp01(1 - age * 1.5) * .65 });
      this.glow(contact, 40, 0xffb1b7, .6 * clamp01(1 - age * 2));
    }
    if (t >= 13.5 && t < 15.3) {
      const contact = this.impactOrigin('rifle', 13.5, 'rival', 'chest');
      this.sparks(contact, t - 13.5, 1);
      this.glow(contact, 62, 0xffcfa2, .8 * clamp01(1 - (t - 13.5) / .6));
      this.rival.damage(t < 13.7 ? .5 : 0);
      this.smoke(target, t - 13.5);
    }
    if (t >= 15 && t < 19) this.smoke(target, (t - 15) * .22 + .2);
  }

  private rushEffects(t: number) {
    const rivalChest = this.rival.socket('chest', this.scenery);
    if (t >= 5.65 && t < 6.65) this.boost(this.hero, t, smooth((t - 5.65) / .35));
    if (t >= 11.65 && t < 13.65) this.boost(this.hero, t, smooth((t - 11.65) / .5));
    if (t >= 12.1 && t < 13.55) this.boost(this.rival, t, .65);
    if ((t >= 6.1 && t < 6.65) || (t >= 12.1 && t < 13.55)) this.speedLines(t, .32);
    for (const [start, end, unit, color] of [[6.48, 6.84, this.hero, 0x77fff0], [13.18, 13.95, this.hero, 0x77fff0], [14.25, 14.85, this.rival, 0xff617d]] as const) {
      if (t >= start && t < end) this.swordSweep(unit, t, start, end, color);
    }
    if (t >= 6.62 && t < 7.25) {
      const contact = this.impactOrigin('rush', 6.62, 'rival', 'shield');
      this.sparks(contact, t - 6.62, .7);
      this.glow(contact, 42, 0xe1fff0, .6 * clamp01(1 - (t - 6.62) * 2));
    }
    if (t >= 13.5 && t < 15) {
      const contact = this.impactOrigin('rush', 13.5, 'rival', 'chest');
      this.sparks(contact, t - 13.5, 1);
      this.glow(contact, 58, 0xe6fff7, .6 * clamp01(1 - (t - 13.5) * 2));
      this.rival.damage(t < 13.7 ? .6 : 0);
    }
    if (t >= 14.55 && t < 15.2) {
      this.sparks(this.impactOrigin('rush', 14.55, 'hero', 'chest'), t - 14.55, .65);
      this.hero.damage(t < 14.72 ? .5 : 0);
    }
    if (t >= 15 && t < 19) {
      this.smoke(rivalChest, (t - 15) * .24 + .1);
    }
  }
  private blade(rig: SDMechaRig, color: number, charge: number) {
    const base = rig.socket('bladeBase', this.scenery), tip = rig.socket('bladeTip', this.scenery);
    const end = { x: mix(base.x, tip.x, charge), y: mix(base.y, tip.y, charge) };
    if (charge < .01) return;
    this.fx.moveTo(base.x, base.y).lineTo(end.x, end.y).stroke({ width: 16, color, alpha: .13 });
    this.fx.moveTo(base.x, base.y).lineTo(end.x, end.y).stroke({ width: 7, color, alpha: .75 });
    this.fx.moveTo(base.x, base.y).lineTo(end.x, end.y).stroke({ width: 2.5, color: 0xf2fff8, alpha: .95 });
  }
  private swordSweep(rig: SDMechaRig, t: number, start: number, end: number, color: number) {
    if (this.reduced) return;
    let base = rig.socket('bladeBase', this.scenery), tip = rig.socket('bladeTip', this.scenery);
    const sample = this.samples[rig.side], fade = 1 - smooth((t - end + .12) / .12);
    for (let i = 1; i <= 5; i++) {
      const before = Math.max(start, t - i * .018);
      // t is already the visual clock. Sampling without hitstop avoids remapping it twice.
      sample.apply(battleMotion(before, 'rush', true)[rig.side], 'rush');
      const previousBase = sample.socket('bladeBase', this.scenery), previousTip = sample.socket('bladeTip', this.scenery);
      const speed = clamp01(Math.hypot(tip.x - previousTip.x, tip.y - previousTip.y) / 18);
      this.trails.poly([mix(base.x, tip.x, .25), mix(base.y, tip.y, .25), tip.x, tip.y,
        previousTip.x, previousTip.y, mix(previousBase.x, previousTip.x, .25), mix(previousBase.y, previousTip.y, .25)])
        .fill({ color, alpha: (1 - i / 6) * .25 * fade * speed });
      this.trails.moveTo(tip.x, tip.y).lineTo(previousTip.x, previousTip.y).stroke({ color: 0xe3fff8, width: 1.4, alpha: (1 - i / 6) * .55 * fade * speed });
      base = previousBase; tip = previousTip;
    }
  }
  private impactOrigin(attack: Attack, at: number, side: 'hero' | 'rival', socket: Socket): PointData {
    const key = `${attack}/${at}/${side}/${socket}/${this.reduced}`;
    const cached = this.impactOrigins.get(key);
    if (cached) return cached;
    const rig = this.samples[side];
    rig.apply(battleMotion(at, attack, this.reduced)[side], attack);
    const point = rig.socket(socket, this.scenery);
    this.impactOrigins.set(key, point); return point;
  }

  private groundEffects(t: number, attack: Attack) {
    if (this.reduced) return;
    // Short emissions at takeoff, landing, and the braking skid. Their origins are
    // sampled at emission time, so dust stays on the deck after the foot moves away.
    const events: readonly [number, number, 'hero' | 'rival', number][] = attack === 'rush'
      ? [[5.96, 6.18, 'hero', -1], [7.2, 7.6, 'hero', 1], [12.75, 13.03, 'hero', -1],
        [13.85, 14.2, 'rival', -1], [14.92, 16.15, 'hero', 1], [14.96, 16.05, 'rival', -1]]
      : [[13.96, 15.5, 'rival', -1]];
    for (const [start, end, side, direction] of events) {
      if (t < start || t > end + .75) continue;
      const ground = side === 'hero' ? 750 : 740, sampler = this.samples[side];
      for (let i = 0; i < 10; i++) {
        const emitted = start + (end - start) * i / 10, age = t - emitted;
        if (age < 0 || age > .75) continue;
        sampler.apply(battleMotion(emitted, attack, true)[side], attack);
        const sole = sampler.socket(i % 2 ? 'frontSole' : 'rearSole', this.scenery);
        const nearGround = 1 - clamp01(Math.abs(sole.y - ground) / 38);
        if (nearGround <= 0) continue;
        const fade = (1 - age / .75) * nearGround;
        const x = sole.x + direction * age * (55 + i % 3 * 20), y = ground - 3 - age * (13 + i % 3 * 5);
        this.trails.ellipse(x, y, 6 + age * 29, 3 + age * 9).fill({ color: 0xa9b8c1, alpha: fade * .11 });
        this.trails.moveTo(sole.x, ground - 1).lineTo(sole.x + direction * (13 + age * 35), ground - 1)
          .stroke({ color: 0xbad5df, width: 1, alpha: fade * .18 });
      }
    }
  }
  private charge(point: PointData, t: number, start: number, release: number, color: number) {
    if (t < start || t >= release) return;
    const p = clamp01((t - start) / (release - start));
    this.glow(point, 12 + p * 15, color, .3 + p * .4);
    if (this.reduced) return;
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399 + t, r = 70 * (1 - ((p + i * .14) % 1));
      this.fx.rect(point.x + Math.cos(a) * r, point.y + Math.sin(a) * r, 2, 2).fill({ color, alpha: p * .75 });
    }
  }
  private projectile(from: PointData, to: PointData, t: number, launch: number, arrival: number, linger: number) {
    if (t < launch || t > arrival + linger) return;
    const p = clamp01((t - launch) / (arrival - launch));
    const alpha = 1 - clamp01((t - arrival) / linger);
    const end = { x: mix(from.x, to.x, p), y: mix(from.y, to.y, p) };
    const back = p < 1 ? Math.max(0, p - .4) : 0;
    const tail = { x: mix(from.x, to.x, back), y: mix(from.y, to.y, back) };
    for (const [width, color, opacity] of [[35, 0x56e6e6, .13], [13, 0x6cfff0, .55], [4, 0xeafff8, 1]]) this.fx.moveTo(tail.x, tail.y).lineTo(end.x, end.y).stroke({ width, color, alpha: alpha * opacity });
    this.glow(from, 29, 0x9ffff5, .65 * alpha);
  }
  private boost(rig: SDMechaRig, t: number, strength: number) {
    const p = rig.socket('booster', this.scenery), side = rig.side === 'hero' ? 1 : -1;
    const len = (105 + Math.sin(t * 37) * 14) * strength;
    this.trails.poly([p.x + side * 8, p.y - 9, p.x - side * len, p.y + 45, p.x - side * len * .6, p.y + 7, p.x, p.y + 12]).fill({ color: rig.side === 'hero' ? 0x57e6ff : 0xff667d, alpha: .3 });
    this.trails.moveTo(p.x, p.y).lineTo(p.x - side * len * .7, p.y + 20).stroke({ width: 9, color: 0xd9fff8, alpha: .75 * strength });
    this.glow(p, 21, rig.side === 'hero' ? 0x64edff : 0xff7b95, .5 * strength);
  }
  private glow(p: PointData, radius: number, color: number, alpha: number) {
    for (let i = 4; i > 0; i--) this.fx.circle(p.x, p.y, radius * i / 2).fill({ color, alpha: alpha * .035 * (5 - i) });
  }
  private sparks(p: PointData, age: number, strength: number) {
    this.contactBurst(p, age, strength);
    const count = this.reduced ? 8 : 28;
    for (let i = 0; i < count; i++) {
      const a = i * 2.399, speed = 95 + (i % 8) * 27, d = 10 + age * speed;
      const alpha = clamp01(1 - age * .95) * strength;
      const x = Math.cos(a) * d, y = Math.sin(a) * d + age * age * 75;
      this.fx.moveTo(p.x + x * .74, p.y + y * .74).lineTo(p.x + x, p.y + y).stroke({ width: i % 5 === 0 ? 3 : 1.3, color: i % 3 ? 0xffcf8e : 0xf0fff3, alpha });
    }
    if (age < .4) this.fx.circle(p.x, p.y, 12 + age * 170).stroke({ width: 2, color: 0xffe2b5, alpha: clamp01(1 - age / .4) * .55 });
  }
  private contactBurst(p: PointData, age: number, strength: number) {
    if (age < 0 || age >= .16) return;
    const fade = 1 - age / .16;
    if (this.reduced) {
      this.fx.circle(p.x, p.y, 12 + 7 * (1 - fade)).stroke({ width: 2, color: 0xffe2ac, alpha: fade * strength });
      return;
    }
    // Eight compact angular spokes read on the first contact frame, even during hitstop.
    const points: number[] = [], radius = (43 + 12 * fade) * strength;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8 + .16;
      const length = i % 2 ? radius * .18 : radius * (i % 4 === 0 ? 1 : .7);
      points.push(p.x + Math.cos(angle) * length, p.y + Math.sin(angle) * length);
    }
    this.fx.poly(points).fill({ color: 0xffd276, alpha: fade * .92 });
    this.fx.circle(p.x, p.y, 7 * strength).fill({ color: 0xfffcdf, alpha: fade });
  }
  private smoke(p: PointData, age: number) {
    for (let i = 0; i < (this.reduced ? 3 : 7); i++) {
      const phase = age + i * .13, drift = Math.sin(i * 2.2) * 28;
      this.fx.circle(p.x + drift + phase * 9, p.y - phase * 90, 9 + phase * 17).fill({ color: i % 2 ? 0x2c3440 : 0x5b646a, alpha: clamp01(1 - phase / 2) * .16 });
    }
  }
  private speedLines(t: number, strength: number) {
    if (this.reduced) return;
    for (let i = 0; i < 24; i++) {
      const x = ((i * 171 - t * 1150) % 1900 + 1900) % 1900, y = (i * 83 + 70) % 900;
      this.trails.moveTo(x, y).lineTo(x + 90 + i % 4 * 40, y).stroke({ width: i % 5 === 0 ? 2 : 1, color: 0xb6dbe9, alpha: strength * (.2 + i % 3 * .1) });
    }
  }
  private dust(t: number) {
    if (this.reduced) return;
    for (let i = 0; i < 18; i++) {
      const x = ((i * 179 + t * 7) % 1700) - 50, y = (i * 71 + 40) % 900;
      this.atmosphere.rect(x, y, 1 + i % 3, 1).fill({ color: 0xc6e4e5, alpha: .12 + i % 3 * .04 });
    }
  }
  dispose() {
    this.disposed = true; this.observer?.disconnect();
    if (this.initialized && this.app.canvas) {
      if (this.glLostHandler) this.app.canvas.removeEventListener('webglcontextlost', this.glLostHandler);
      this.destroyRenderer();
    }
  }
  private destroyRenderer() {
    if (!this.initialized || this.destroyed) return;
    this.destroyed = true;
    this.app.destroy(true, { children: true, texture: false });
  }
}
