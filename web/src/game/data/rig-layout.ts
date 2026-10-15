/** Landmarks are normalized against each actual alpha-trimmed WebP, not atlas cells.
 * Visible balls/discs are measured individually. Waist/hip mounts are inferred behind armor.
 * The generated hero front shoulder has a visible side disc; its rear and both rival
 * shoulders instead expose an upper-right ball. Those are intentionally different. */
export type UV = readonly [number, number];
export interface PartLayout { height: number; anchor: UV; joints?: Record<string, UV> }
export type RigLayout = Record<string, PartLayout>;
export const RIG_LAYOUT: Record<'hero' | 'rival', RigLayout> = {
  hero: {
    head: { height: 176, anchor: [.45, .95] },
    torso: { height: 130, anchor: [.56, .83], joints: { neck: [.44, .09], frontShoulder: [.15, .4], rearShoulder: [.86, .32], chest: [.62, .53], backpack: [.22, .38] } },
    pelvis: { height: 80, anchor: [.54, .11], joints: { frontHip: [.24, .72], rearHip: [.72, .63] } },
    'front-upper-arm': { height: 91, anchor: [.26, .30], joints: { elbow: [.33, .80] } },
    'rear-upper-arm': { height: 81, anchor: [.82, .15], joints: { elbow: [.29, .76] } },
    'front-forearm': { height: 101, anchor: [.23, .12], joints: { grip: [.61, .83], shield: [.55, .48] } },
    'rear-forearm': { height: 94, anchor: [.51, .12], joints: { grip: [.64, .85], shield: [.55, .48] } },
    'front-thigh': { height: 67, anchor: [.42, .14], joints: { knee: [.38, .89] } },
    'rear-thigh': { height: 65, anchor: [.67, .13], joints: { knee: [.33, .87] } },
    'front-shin': { height: 94, anchor: [.24, .11], joints: { sole: [.55, .96] } },
    'rear-shin': { height: 91, anchor: [.19, .11], joints: { sole: [.52, .96] } },
    rifle: { height: 79, anchor: [.12, .65], joints: { muzzle: [.96, .31] } },
    saber: { height: 64, anchor: [.49, .75], joints: { emitter: [.46, .04] } },
    shield: { height: 145, anchor: [.44, .42], joints: { contact: [.50, .44] } },
    backpack: { height: 104, anchor: [.64, .43], joints: { booster: [.45, .77], binder: [.23, .2] } },
    binder: { height: 179, anchor: [.50, .18] },
  },
  rival: {
    head: { height: 176, anchor: [.50, .94] },
    torso: { height: 130, anchor: [.57, .84], joints: { neck: [.52, .10], frontShoulder: [.15, .4], rearShoulder: [.85, .32], chest: [.62, .53], backpack: [.23, .37] } },
    pelvis: { height: 80, anchor: [.54, .11], joints: { frontHip: [.25, .62], rearHip: [.72, .58] } },
    'front-upper-arm': { height: 91, anchor: [.80, .18], joints: { elbow: [.34, .78] } },
    'rear-upper-arm': { height: 81, anchor: [.80, .20], joints: { elbow: [.27, .78] } },
    'front-forearm': { height: 101, anchor: [.22, .12], joints: { grip: [.55, .84], shield: [.55, .48] } },
    'rear-forearm': { height: 94, anchor: [.38, .12], joints: { grip: [.65, .84], shield: [.55, .48] } },
    'front-thigh': { height: 67, anchor: [.47, .14], joints: { knee: [.38, .89] } },
    'rear-thigh': { height: 65, anchor: [.49, .13], joints: { knee: [.36, .87] } },
    'front-shin': { height: 94, anchor: [.23, .11], joints: { sole: [.53, .96] } },
    'rear-shin': { height: 91, anchor: [.23, .12], joints: { sole: [.53, .96] } },
    rifle: { height: 79, anchor: [.18, .74], joints: { muzzle: [.97, .35] } },
    saber: { height: 64, anchor: [.49, .76], joints: { emitter: [.44, .07] } },
    shield: { height: 145, anchor: [.44, .42], joints: { contact: [.50, .44] } },
    backpack: { height: 104, anchor: [.64, .43], joints: { booster: [.45, .77], binder: [.23, .2] } },
    binder: { height: 179, anchor: [.50, .18] },
  },
};
