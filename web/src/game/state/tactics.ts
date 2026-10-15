export interface Tile { x: number; y: number }
export const COLS = 10, ROWS = 7, MOVE = 5;
export const HERO_START: Tile = { x: 2, y: 4 };
export const RIVAL_POSITION: Tile = { x: 6, y: 2 };
export const OBSTACLES: Tile[] = [{x:4,y:1},{x:4,y:2},{x:7,y:4},{x:3,y:5},{x:8,y:1},{x:1,y:1}];
export const tileKey = (p: Tile) => `${p.x},${p.y}`;
export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
export const distance = (a: Tile, b: Tile) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const inBounds = (p: Tile) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x>=0 && p.x<COLS && p.y>=0 && p.y<ROWS;
export const blocked = (p: Tile) => OBSTACLES.some(o=>sameTile(o,p)) || sameTile(RIVAL_POSITION,p);
export const MOVE_STEP_MS = 145;
export function sampleMovement(origin: Tile, path: readonly Tile[], elapsedMs: number): { position: Tile; done: boolean } {
  // A same-frame rAF timestamp can precede the event's performance.now().
  // Keep that first frame at the origin instead of indexing path[-1].
  const total = Math.max(0, elapsedMs) / MOVE_STEP_MS;
  const index = Math.floor(total);
  if (index >= path.length) return { position: path.at(-1) ?? origin, done: true };
  const from = index === 0 ? origin : path[index - 1];
  const to = path[index], fraction = total - index;
  return { position: { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction }, done: false };
}
export function movementPaths(origin: Tile): Map<string, Tile[]> {
  const paths = new Map<string,Tile[]>([[tileKey(origin),[]]]);
  const queue = [origin];
  for(let i=0;i<queue.length;i++) {
    const p=queue[i], path=paths.get(tileKey(p))!;
    if(path.length>=MOVE) continue;
    for(const next of [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}]) {
      if(!inBounds(next)||blocked(next)||paths.has(tileKey(next))) continue;
      paths.set(tileKey(next),[...path,next]); queue.push(next);
    }
  }
  return paths;
}
export function inRange(kind:'rifle'|'rush', position:Tile) {
  const d=distance(position,RIVAL_POSITION);
  return kind==='rifle' ? d>=2 && d<=5 : d===1;
}
