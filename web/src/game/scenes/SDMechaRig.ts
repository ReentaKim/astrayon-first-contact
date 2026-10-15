import { Container, Point, Sprite, type PointData, type Texture } from 'pixi.js';
import type { Attack } from '../state/battle';
import { IDLE, type UnitMotion } from '../data/motion';
import { RIG_LAYOUT, type UV, type RigLayout } from '../data/rig-layout';

export const SD_PARTS = ['head', 'torso', 'pelvis', 'backpack', 'rear-upper-arm', 'rear-forearm', 'front-upper-arm', 'front-forearm', 'rear-thigh', 'rear-shin', 'front-thigh', 'front-shin', 'rifle', 'shield', 'saber', 'binder'] as const;
export type SDPart = typeof SD_PARTS[number];
export type PartTextures = Record<SDPart, Texture>;
export type Socket = 'muzzle' | 'bladeTip' | 'bladeBase' | 'chest' | 'booster' | 'shield' | 'frontSole' | 'rearSole' | 'pelvis';
interface Limb { pivot: Container; bend: Container; end: Container; upper: Sprite; lower: Sprite }
interface Connection { name: string; parent: Sprite; at: UV; child: Sprite }

/** Art landmarks define the skeleton: a child's painted input joint coincides with its
 * parent's painted output joint. Pose rotations never alter this attachment invariant. */
export class SDMechaRig {
  readonly root = new Container();
  private assembly = new Container();
  private hip = new Container();
  private body = new Container();
  private head = new Container();
  private hand = new Container();
  private binder = new Container();
  private rearArm: Limb;
  private frontArm: Limb;
  private rearLeg: Limb;
  private frontLeg: Limb;
  private gun: Sprite;
  private saber: Sprite;
  private sockets: Record<Socket, Container>;
  private art = new Map<SDPart, Sprite>();
  private connections: Connection[] = [];
  private layout: RigLayout;
  private unitScale = 1;

  constructor(private textures: PartTextures, readonly side: 'hero' | 'rival') {
    this.layout = RIG_LAYOUT[side];
    this.root.label = `${side}-articulated-mecha`;
    this.root.addChild(this.assembly); this.assembly.addChild(this.hip);
    const pelvis = this.part('pelvis');
    const torso = this.part('torso');
    // The torso's waist socket and pelvis's waist ball share the same transform origin.
    // Put the torso in front so its existing belt armor covers the pelvis's duplicate top ball.
    this.rearLeg = this.limb('rear-thigh', 'rear-shin', 'knee', 'sole');
    this.frontLeg = this.limb('front-thigh', 'front-shin', 'knee', 'sole');
    this.attach(this.hip, this.rearLeg.pivot, pelvis, 'rearHip', this.rearLeg.upper, 'rear hip');
    this.attach(this.hip, this.frontLeg.pivot, pelvis, 'frontHip', this.frontLeg.upper, 'front hip');
    this.hip.addChild(pelvis, this.body);
    this.connections.push({ name: 'waist', parent: pelvis, at: this.layout.pelvis.anchor, child: torso });
    const backpack = this.part('backpack');
    this.body.addChild(backpack);
    const backMount = this.point(torso, this.joint('torso', 'backpack'));
    backpack.position.copyFrom(backMount);
    this.body.addChild(this.binder);
    this.binder.position.copyFrom(this.point(backpack, this.joint('backpack', 'binder')));
    const binder = this.part('binder'); binder.rotation = .45; this.binder.addChild(binder);
    this.rearArm = this.limb('rear-upper-arm', 'rear-forearm', 'elbow', 'grip');
    this.frontArm = this.limb('front-upper-arm', 'front-forearm', 'elbow', 'grip');
    this.attach(this.body, this.rearArm.pivot, torso, 'rearShoulder', this.rearArm.upper, 'rear shoulder');
    this.body.addChild(torso);
    const head = this.part('head'); this.head.addChild(head);
    this.attach(this.body, this.head, torso, 'neck', head, 'neck');
    this.attach(this.body, this.frontArm.pivot, torso, 'frontShoulder', this.frontArm.upper, 'front shoulder');
    this.frontArm.end.addChild(this.hand);
    this.gun = this.part('rifle'); this.saber = this.part('saber'); this.hand.addChild(this.gun, this.saber);
    this.connections.push({ name: 'rifle grip', parent: this.frontArm.lower, at: this.joint('front-forearm', 'grip'), child: this.gun });
    this.connections.push({ name: 'saber grip', parent: this.frontArm.lower, at: this.joint('front-forearm', 'grip'), child: this.saber });
    const shield = this.part('shield');
    shield.position.copyFrom(this.point(this.rearArm.lower, this.joint('rear-forearm', 'shield')));
    this.rearArm.bend.addChild(shield);
    const socket = (parent: Container, p: Point) => { const c = new Container(); c.position.copyFrom(p); parent.addChild(c); return c; };
    const emitter = this.point(this.saber, this.joint('saber', 'emitter'));
    this.sockets = {
      muzzle: socket(this.hand, this.point(this.gun, this.joint('rifle', 'muzzle'))),
      bladeBase: socket(this.hand, emitter), bladeTip: socket(this.hand, new Point(emitter.x, emitter.y - 200)),
      chest: socket(this.body, this.point(torso, this.joint('torso', 'chest'))),
      booster: socket(this.body, this.point(backpack, this.joint('backpack', 'booster'))),
      shield: socket(this.rearArm.bend, this.point(shield, this.joint('shield', 'contact'))),
      frontSole: this.frontLeg.end, rearSole: this.rearLeg.end, pelvis: this.hip,
    };
    this.apply({ x: 0, y: 0, pose: IDLE, grounding: 0 }, null);
    // Keep the established ground line while changing the assembly, never stretch individual art.
    const soleY = (this.root.toLocal({ x: 0, y: 0 }, this.frontLeg.end).y + this.root.toLocal({ x: 0, y: 0 }, this.rearLeg.end).y) / 2;
    this.assembly.y = 131 - soleY;
  }

  private part(name: SDPart) {
    const layout = this.layout[name], sprite = new Sprite(this.textures[name]);
    sprite.label = `${this.side}-${name}`; sprite.anchor.set(...layout.anchor);
    sprite.scale.set(layout.height / sprite.texture.height);
    this.art.set(name, sprite); return sprite;
  }
  private joint(name: SDPart, joint: string): UV {
    const p = this.layout[name].joints?.[joint];
    if (!p) throw new Error(`Missing ${this.side}/${name}/${joint} landmark`);
    return p;
  }
  /** Painted landmark in the sprite's parent space, with the actual uniform art scale. */
  private point(sprite: Sprite, at: UV): Point {
    return new Point(sprite.x + (at[0] - sprite.anchor.x) * sprite.width, sprite.y + (at[1] - sprite.anchor.y) * sprite.height);
  }
  private attach(parent: Container, child: Container, parentArt: Sprite, joint: string, childArt: Sprite, name: string) {
    const partName = parentArt.label.slice(this.side.length + 1) as SDPart, at = this.joint(partName, joint);
    child.position.copyFrom(this.point(parentArt, at)); parent.addChild(child);
    this.connections.push({ name, parent: parentArt, at, child: childArt });
  }
  private limb(upperName: SDPart, lowerName: SDPart, bendJoint: string, endJoint: string): Limb {
    const pivot = new Container(), bend = new Container(), end = new Container();
    const upper = this.part(upperName), lower = this.part(lowerName);
    this.attach(pivot, bend, upper, bendJoint, lower, `${upperName} to ${lowerName}`);
    bend.addChild(lower, end); end.position.copyFrom(this.point(lower, this.joint(lowerName, endJoint)));
    // The upper disc covers the matching incoming lower ball; there is no invented joint disk.
    pivot.addChild(upper);
    return { pivot, bend, end, upper, lower };
  }

  apply(motion: UnitMotion, attack: Attack | null) {
    const p = motion.pose;
    this.root.position.set(motion.x, motion.y);
    this.root.scale.set(this.side === 'hero' ? this.unitScale : -this.unitScale, this.unitScale);
    this.hip.rotation = p.hip; this.body.rotation = p.body; this.head.rotation = p.head;
    this.rearArm.pivot.rotation = p.rearArm; this.rearArm.bend.rotation = p.rearElbow;
    this.frontArm.pivot.rotation = p.frontArm; this.frontArm.bend.rotation = p.frontElbow;
    this.rearLeg.pivot.rotation = p.rearLeg; this.rearLeg.bend.rotation = p.rearKnee;
    this.frontLeg.pivot.rotation = p.frontLeg; this.frontLeg.bend.rotation = p.frontKnee;
    this.hand.rotation = p.weapon - p.frontArm - p.frontElbow;
    this.binder.rotation = p.binder;
    this.gun.visible = this.side === 'hero' && attack !== 'rush'; this.saber.visible = !this.gun.visible;
    const floor = this.side === 'hero' ? 750 : 740;
    const frontSole = this.root.toLocal({ x: 0, y: 0 }, this.frontLeg.end), rearSole = this.root.toLocal({ x: 0, y: 0 }, this.rearLeg.end);
    const lowerFoot = this.root.y + Math.max(frontSole.y, rearSole.y) * this.unitScale;
    // Collision is applied here, not in the effects stage, so tests and rendered weapon
    // contacts share the same pose. Grounded weight plants the supporting foot; airborne
    // poses retain their keyed height, while no pose can drive a sole through the deck.
    this.root.y += (floor - lowerFoot) * (lowerFoot > floor ? 1 : Math.max(0, Math.min(1, motion.grounding)));
  }
  socket(name: Socket, scene: Container): Point { return scene.toLocal({ x: 0, y: 0 }, this.sockets[name]); }
  /** Solve wrist aim from the actual grip and off-axis muzzle. The rifle's grip stays
   * coincident with the painted fist while its barrel aligns with a moving target. */
  aimRifleAt(target: PointData, scene: Container, weight = 1) {
    const local = this.frontArm.end.toLocal(target, scene), distance = Math.hypot(local.x, local.y);
    if (distance < 1 || weight <= 0) return;
    const muzzleOffsetY = this.sockets.muzzle.y;
    const desired = Math.atan2(local.y, local.x) - Math.asin(Math.max(-1, Math.min(1, muzzleOffsetY / distance)));
    const delta = Math.atan2(Math.sin(desired - this.hand.rotation), Math.cos(desired - this.hand.rotation));
    this.hand.rotation += delta * Math.max(0, Math.min(1, weight));
  }
  barrelDirection(scene: Container): Point {
    const a = scene.toLocal({ x: 0, y: 0 }, this.hand), b = scene.toLocal({ x: 1, y: 0 }, this.hand);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return new Point((b.x - a.x) / length, (b.y - a.y) / length);
  }
  /** Debug/test evidence uses points on the actual textures, not duplicate skeleton origins. */
  jointPairs(scene: Container) {
    return this.connections.map(connection => ({
      name: connection.name,
      parent: scene.toLocal({ x: (connection.at[0] - connection.parent.anchor.x) * connection.parent.texture.width, y: (connection.at[1] - connection.parent.anchor.y) * connection.parent.texture.height }, connection.parent),
      child: scene.toLocal({ x: 0, y: 0 }, connection.child),
    }));
  }
  damage(amount: number) {
    const color = amount > .01 ? (this.side === 'hero' ? 0xb6e9ff : 0xffd1cf) : 0xffffff;
    for (const sprite of this.art.values()) sprite.tint = color;
  }
  setScale(scale: number) { this.unitScale = scale; }
}
