import {test} from 'node:test';
import assert from 'node:assert/strict';
import {movementPaths,sampleMovement,MOVE_STEP_MS,HERO_START,RIVAL_POSITION,OBSTACLES,inRange,tileKey,sameTile,distance,MOVE} from '../src/game/state/tactics';
import {battleReducer as reduce,initialState} from '../src/game/state/battle';
test('a first rAF timestamp before the click timestamp holds the origin without locking movement',()=>{
 const origin={x:2,y:4},path=[{x:3,y:4},{x:3,y:3}];
 const clickTimestamp=1000,firstFrameTimestamp=999.8;
 assert.deepEqual(sampleMovement(origin,path,firstFrameTimestamp-clickTimestamp),{position:origin,done:false});
 assert.deepEqual(sampleMovement(origin,path,0),{position:origin,done:false});
 assert.deepEqual(sampleMovement(origin,path,MOVE_STEP_MS/2),{position:{x:2.5,y:4},done:false});
});
test('movement follows each segment and completes exactly at the final tile',()=>{
 const origin={x:2,y:4},path=[{x:3,y:4},{x:3,y:3}];
 assert.deepEqual(sampleMovement(origin,path,MOVE_STEP_MS),{position:path[0],done:false});
 assert.deepEqual(sampleMovement(origin,path,MOVE_STEP_MS*1.5),{position:{x:3,y:3.5},done:false});
 for(const elapsed of [MOVE_STEP_MS*2,MOVE_STEP_MS*20])assert.deepEqual(sampleMovement(origin,path,elapsed),{position:path[1],done:true});
 assert.deepEqual(sampleMovement(origin,[],0),{position:origin,done:true});
});
test('reachable cells respect 5-step route, obstacles, enemy occupancy and adjacency',()=>{
 const paths=movementPaths(HERO_START);
 for(const [key,path] of paths){assert.ok(path.length<=MOVE);let prev=HERO_START;for(const p of path){assert.equal(distance(prev,p),1);assert.ok(!OBSTACLES.some(o=>sameTile(o,p)));assert.ok(!sameTile(RIVAL_POSITION,p));prev=p;}assert.equal(tileKey(prev),key);}
 assert.ok(paths.has('6,3'));assert.ok(!paths.has('6,2'));assert.ok(!paths.has('4,2'));
});
test('full grid → move → attack → result → map flow carries resources once',()=>{
 let s=reduce(initialState(),{type:'START'});assert.equal(s.phase,'MAP');
 assert.equal(reduce(s,{type:'OPEN_ATTACK'}),s);
 s=reduce(s,{type:'MOVE',to:{x:6,y:3}});assert.equal(s.moved,true);
 assert.equal(reduce(s,{type:'MOVE',to:{x:0,y:0}}),s);
 s=reduce(s,{type:'OPEN_ATTACK'});assert.equal(s.phase,'CHOICE_ATTACK');
 assert.equal(reduce(s,{type:'COMMIT',kind:'rifle'}),s);
 s=reduce(s,{type:'COMMIT',kind:'rush'});assert.equal(s.phase,'ATTACK');
 s=reduce(s,{type:'FINISH',session:s.session,actionId:s.action!.id});
 s=reduce(s,{type:'RETURN_MAP'});assert.equal(s.phase,'MAP');assert.equal(s.mapComplete,true);assert.equal(s.rivalHP,7400);assert.equal(s.heroHP,5600);
 assert.equal(reduce(s,{type:'OPEN_ATTACK'}),s);assert.equal(reduce(s,{type:'UNDO_MOVE'}),s);
});
test('cancel targeting and undo movement consume no resources',()=>{
 let s=reduce(initialState(),{type:'START'});s=reduce(s,{type:'MOVE',to:{x:4,y:3}});
 s=reduce(s,{type:'OPEN_ATTACK'});assert.equal(s.phase,'CHOICE_ATTACK');s=reduce(s,{type:'CANCEL_ATTACK'});s=reduce(s,{type:'UNDO_MOVE'});
 assert.deepEqual(s.position,HERO_START);assert.equal(s.moved,false);assert.equal(s.heroEN,100);assert.equal(s.rivalHP,9000);
});
test('rifle has minimum range, rush is adjacent, forged invalid moves fail',()=>{
 assert.equal(inRange('rifle',{x:6,y:3}),false);assert.equal(inRange('rush',{x:6,y:3}),true);assert.equal(inRange('rifle',{x:4,y:3}),true);
 const s=reduce(initialState(),{type:'START'});for(const to of [{x:-1,y:4},{x:NaN,y:4},{x:3.5,y:4},{x:4,y:2},{x:9,y:0}])assert.equal(reduce(s,{type:'MOVE',to}),s);
});
