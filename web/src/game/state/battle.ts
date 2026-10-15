import { HERO_START, inRange, movementPaths, tileKey, type Tile } from './tactics';
export type Attack = 'rifle' | 'rush';
export type Phase = 'TITLE' | 'MAP' | 'CHOICE_ATTACK' | 'ATTACK' | 'RESULT';
export interface Resources { heroHP: number; heroEN: number; rivalHP: number; aim: number }
export interface Action {
  id: string;
  kind: Attack;
  before: Resources;
  after: Resources;
  damage: number;
  recoil: number;
}
export interface BattleState extends Resources {
  session: number; phase: Phase; paused: boolean;
  action: Action | null; appliedActionIds: string[]; history: Attack[];
  position: Tile; moved: boolean; mapComplete: boolean;
}
export type BattleEvent =
  | { type: 'START' }
  | { type: 'MOVE'; to: Tile }
  | { type: 'UNDO_MOVE' }
  | { type: 'OPEN_ATTACK' }
  | { type: 'CANCEL_ATTACK' }
  | { type: 'RETURN_MAP' }
  | { type: 'COMMIT'; kind: Attack }
  | { type: 'FINISH'; session: number; actionId: string }
  | { type: 'PAUSE'; paused: boolean }
  | { type: 'RESTART' };
export const MAX_HP = 6000;
export const MAX_EN = 100;
export const RIVAL_HP = 9000;
export const WEAPONS = {
  rifle: { title: '빔 라이플', english: 'BEAM RIFLE', en: 20, damage: 1200, recoil: 0, aim: 1, description: '거리를 유지한다. EN 20 소모 · 조준 +1' },
  rush: { title: '블레이드 러시', english: 'BLADE RUSH', en: 0, damage: 1600, recoil: 400, aim: 0, description: '거리를 좁힌다. EN 소모 없음 · 반격 피해 400' },
} as const;
export const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
export function initialState(session = 1): BattleState {
  return { session, phase: 'TITLE', paused: false, heroHP: MAX_HP, heroEN: MAX_EN, rivalHP: RIVAL_HP, aim: 0, action: null, appliedActionIds: [], history: [], position: {...HERO_START}, moved: false, mapComplete: false };
}
export function resources(state: Resources): Resources {
  return { heroHP: state.heroHP, heroEN: state.heroEN, rivalHP: state.rivalHP, aim: state.aim };
}
/** The only place that spends resources or applies damage is COMMIT.
 * Playback, skip and completion merely present this already-committed result. */
export function battleReducer(state: BattleState, event: BattleEvent): BattleState {
  switch (event.type) {
    case 'START': return state.phase === 'TITLE' ? { ...state, phase: 'MAP' } : state;
    case 'MOVE': return state.phase === 'MAP' && !state.moved && !state.mapComplete && movementPaths(state.position).has(tileKey(event.to))
      ? {...state,position:{...event.to},moved:true}:state;
    case 'UNDO_MOVE': return state.phase === 'MAP' && state.moved && !state.mapComplete ? {...state,position:{...HERO_START},moved:false}:state;
    case 'OPEN_ATTACK': return state.phase === 'MAP' && !state.mapComplete && (inRange('rifle',state.position)||inRange('rush',state.position)) ? {...state,phase:'CHOICE_ATTACK'}:state;
    case 'CANCEL_ATTACK': return state.phase === 'CHOICE_ATTACK' ? {...state,phase:'MAP'}:state;
    case 'RETURN_MAP': return state.phase === 'RESULT' ? {...state,phase:'MAP',mapComplete:true}:state;
    case 'COMMIT': {
      if (state.phase !== 'CHOICE_ATTACK' || state.paused || !(event.kind in WEAPONS)) return state;
      const weapon = WEAPONS[event.kind];
      if (state.heroEN < weapon.en || state.heroHP <= 0 || state.rivalHP <= 0 || !inRange(event.kind,state.position)) return state;
      const id = `${state.session}:${state.history.length + 1}`;
      if (state.appliedActionIds.includes(id)) return state;
      const after = {
        heroHP: clamp(state.heroHP - weapon.recoil, MAX_HP),
        heroEN: clamp(state.heroEN - weapon.en, MAX_EN),
        rivalHP: clamp(state.rivalHP - weapon.damage, RIVAL_HP),
        aim: state.aim + weapon.aim,
      };
      return { ...state, ...after, phase: 'ATTACK', paused: false,
        action: { id, kind: event.kind, before: resources(state), after, damage: weapon.damage, recoil: weapon.recoil },
        appliedActionIds: [...state.appliedActionIds, id], history: [...state.history, event.kind] };
    }
    case 'FINISH':
      return state.phase === 'ATTACK' && state.session === event.session && state.action?.id === event.actionId
        ? { ...state, phase: 'RESULT', paused: false } : state;
    case 'PAUSE': return state.phase === 'ATTACK' ? { ...state, paused: event.paused } : state;
    case 'RESTART': return { ...initialState(state.session + 1), phase: 'MAP' };
  }
}
