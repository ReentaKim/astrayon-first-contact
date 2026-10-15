'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleEvent, BattleState } from '@/game/state/battle';
import { COLS, ROWS, OBSTACLES, RIVAL_POSITION, movementPaths, sampleMovement, sameTile, tileKey, distance, inRange, type Tile } from '@/game/state/tactics';

// Original 32px map sprites. The intentionally pixel-drawn tactical figures are
// independent from the detailed cinematic art; no reference poster is used here.
export function PixelUnit({rival=false}:{rival?:boolean}) {
 const rows=[
 '......g........g......','.......g......g.......','.......g.WWWW.g.......','........WWccWW........','.......WWcRRcWW.......','.......WWeeeeWW.......','........WWrrWW........','..WWW....WddW....WWW..',
 '.WWWWWW.WbbbbbW.WWWWWW.','WWWWWWWbbggbggbbWWWWWWW','WccccWWbbbbbbbbWWccccW','WccccWWbbbccbbbWWccccW','..cccW.WbbccbbW.Wccc..','..WWW..WbbbbbbW..WWW..','..WWWW..WdrrdW..WWWW..','..WWWW.WWrrrrWW.WWWW..',
 '..cccW.WWWddWWW.Wccc..','..cccW.WWddddWW.Wccc..','...dd..WWWddWWW..dd...','...dd..WWWWWWWW..dd...','.......WWW..WWW.......','.......WWW..WWW.......','......WWWW..WWWW......','......WccW..WccW......',
 '......WccW..WccW......','......WWWW..WWWW......','......WWWW..WWWW......','......WWWW..WWWW......','.....WWccW..WccWW.....','.....bbbbb..bbbbb.....','....bbbbbb..bbbbbb....','....dddddd..dddddd....'];
 const palette:Record<string,string>=rival?{g:'#e06265',W:'#404659',c:'#222a3a',d:'#111723',b:'#272936',R:'#f35b68',r:'#a83d52',e:'#ffb9c0'}:{g:'#eec989',W:'#e5ebef',c:'#8da8b5',d:'#253a4a',b:'#4c739d',R:'#f07e72',r:'#c26062',e:'#74fff0'};
 return <svg viewBox="-5 -4 33 42" shapeRendering="crispEdges" aria-hidden="true">{rival&&<path d="M-3 3 2 8 1 29-3 23ZM26 3 21 8 22 29 26 23Z" fill="#383f50"/>}{rows.flatMap((row,y)=>[...row].map((pixel,x)=>palette[pixel]?<rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill={palette[pixel]}/>:null))}{!rival&&<path d="M0 14h3v16H1v3h-2V17h1Z" fill="#1e303c"/>}{rival&&<path d="M24 15h2v18h-2Z" fill="#eb536c"/>}</svg>;
}
export function TacticalMap({battle,dispatch,onRestart,onCue,reduced}:{battle:BattleState;dispatch:(event:BattleEvent)=>void;onRestart:()=>void;onCue:()=>void;reduced:boolean}) {
 const [selected,setSelected]=useState(false),[hover,setHover]=useState<Tile|null>(null),[moving,setMoving]=useState(false),[visual,setVisual]=useState(battle.position);
 const animation=useRef<number|null>(null);
 const paths=useMemo(()=>movementPaths(battle.position),[battle.position]);
 const available=selected&&!battle.moved&&!battle.mapComplete;
 const canAttack=inRange('rifle',battle.position)||inRange('rush',battle.position);
 const dist=distance(battle.position,RIVAL_POSITION);
 useEffect(()=>()=>{if(animation.current)cancelAnimationFrame(animation.current);},[]);
 useEffect(()=>{setVisual(battle.position);setSelected(false);setMoving(false);},[battle.session]);
 const move=(to:Tile)=>{
  if(moving||!available)return;
  const path=paths.get(tileKey(to));if(!path?.length)return;
  onCue();setMoving(true);setHover(null);
  if(reduced){setVisual(to);dispatch({type:'MOVE',to});setMoving(false);return;}
  const start=performance.now(),origin=battle.position;
  const tick=(now:number)=>{const frame=sampleMovement(origin,path,now-start);
   setVisual(frame.position);
   if(frame.done){dispatch({type:'MOVE',to});setMoving(false);animation.current=null;return;}
   animation.current=requestAnimationFrame(tick);
  };animation.current=requestAnimationFrame(tick);
 };
 const trail=hover&&available?paths.get(tileKey(hover))??[]:[];
 return <div className="tactical-view">
  <div className="map-topline"><span><i/> PLAYER PHASE <b>01</b></span><span>SECTOR 07 / 軌道廃墟</span></div>
  <div className="map-board" role="group" aria-label="10열 7행 전술 격자">
   <div className="map-grid" style={{gridTemplateColumns:`repeat(${COLS},1fr)`}}>
    {Array.from({length:COLS*ROWS},(_,i)=>{const p={x:i%COLS,y:Math.floor(i/COLS)},isHero=sameTile(p,battle.position),isRival=sameTile(p,RIVAL_POSITION),obstacle=OBSTACLES.some(o=>sameTile(o,p)),reachable=available&&paths.has(tileKey(p)),onPath=trail.some(t=>sameTile(t,p));
     return <button key={i} className={'map-tile'+(obstacle?' obstacle':'')+(reachable?' reachable':'')+(onPath?' on-path':'')+(isHero?' hero-tile':'')+(isRival?' rival-tile':'')} aria-label={`${p.x+1}열 ${p.y+1}행${isHero?' 아스트레이온':isRival?' 옵시디언':obstacle?' 잔해 통과 불가':reachable?' 이동 가능':''}`} aria-disabled={moving||obstacle} onMouseEnter={()=>setHover(p)} onFocus={()=>setHover(p)} onClick={()=>{if(moving||battle.mapComplete)return;if(isHero){setSelected(!selected);onCue();}else if(isRival&&canAttack){onCue();dispatch({type:'OPEN_ATTACK'});}else if(reachable)move(p);}}
      onKeyDown={e=>{const delta:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowDown:COLS,ArrowUp:-COLS};if(e.key in delta){e.preventDefault();if((e.key==='ArrowLeft'&&p.x===0)||(e.key==='ArrowRight'&&p.x===COLS-1))return;const next=i+delta[e.key];if(next>=0&&next<COLS*ROWS)(e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();}}}>
      {obstacle?<span className="wreck"><i/><i/><i/></span>:<span className="tile-coordinate">{String(p.x+1).padStart(2,'0')}.{p.y+1}</span>}{onPath&&<span className="path-dot"/>}{isHero&&selected&&<span className="selection-corners"/>}{isRival&&canAttack&&selected&&<span className="target-corners"/>}
     </button>;
    })}
   </div>
   <div className={'map-unit ally'+(moving?' moving':'')} style={{left:`${(visual.x+.5)/COLS*100}%`,top:`${(visual.y+.5)/ROWS*100}%`}}><span className="unit-shadow"/><PixelUnit/><span className="map-health"><i style={{width:battle.heroHP/6000*100+'%'}}/></span><span className="map-unit-name">ASTRAYON</span></div>
   <div className="map-unit enemy" style={{left:`${(RIVAL_POSITION.x+.5)/COLS*100}%`,top:`${(RIVAL_POSITION.y+.5)/ROWS*100}%`}}><span className="unit-shadow"/><PixelUnit rival/><span className="map-health"><i style={{width:battle.rivalHP/9000*100+'%'}}/></span><span className="map-unit-name">OBSIDIAN</span></div>
   <div className="map-axis">A <span>B</span> C <span>D</span> E <span>F</span> G <span>H</span> I <span>J</span></div>
  </div>
  <aside className="map-command">
   <div className="mission-tag">MISSION 01 <span>FIRST CONTACT</span></div><h2>{battle.mapComplete?'첫 교전 완료':'붕괴 궤도'}</h2><p className="map-objective">{battle.mapComplete?'첫 교전이 끝났습니다. 다른 위치와 무기로 다시 플레이할 수 있습니다.':'아스트레이온을 이동시켜 적을 사거리에 넣고, 공격을 개시하세요.'}</p>
   <div className="map-unit-card"><PixelUnit/><div><small>ALLY UNIT / 01</small><h3>아스트레이온</h3><span>HP <b>{battle.heroHP.toLocaleString()}</b> / 6,000</span><span>EN <b>{battle.heroEN}</b> / 100</span></div></div>
   <div className="map-info"><span>이동력 <b>5</b></span><span>적과 거리 <b>{dist}</b></span><span>지형 <b>우주</b></span><span>이동 상태 <b>{moving?'이동 중':battle.moved?'완료':'가능'}</b></span></div>
   {battle.mapComplete?<><p className="map-complete">적 피해 −{battle.action?.damage.toLocaleString()}<br/>옵시디언 HP {battle.rivalHP.toLocaleString()} / 9,000</p><button className="primary" onClick={onRestart}>작전 다시 시작 <span>↻</span></button></>:<div className="map-actions">
    <button className={'map-action'+(selected&&!battle.moved?' chosen':'')} disabled={moving||battle.moved} onClick={()=>{setSelected(!selected);onCue();}}><span>01</span> 이동 <small>{battle.moved?'이동 완료':'가능한 칸 표시'}</small></button>
    <button className="map-action attack-command" disabled={!canAttack||moving} onClick={()=>{onCue();dispatch({type:'OPEN_ATTACK'});}}><span>02</span> 공격 <small>{canAttack?'무기 선택':'사거리 밖'}</small></button>
    {battle.moved&&<button className="undo-move" disabled={moving} onClick={()=>{dispatch({type:'UNDO_MOVE'});setVisual({x:2,y:4});setSelected(true);}}>이동 취소</button>}
   </div>}
   <div className="range-key"><span><i/> 이동 가능</span><span><i/> 공격 대상</span></div>
   <p className="map-hint" role="status">{battle.mapComplete?'첫 전투 데모 완료':moving?'이동 중…':available?'푸른 칸을 누르면 이동합니다.':canAttack?'공격 버튼 또는 적 기체를 선택하세요.':'아군 기체 또는 이동 버튼을 선택하세요.'}</p>
  </aside>
  <div className="map-bottomline"><span>빔 라이플 <b>2–5칸</b> <i>/</i> 블레이드 러시 <b>1칸</b></span><span>방향키 · Tab · Enter 지원</span></div>
 </div>;
}
