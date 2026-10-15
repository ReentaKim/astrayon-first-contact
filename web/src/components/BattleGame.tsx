'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BattleAudio } from '@/game/audio/BattleAudio';
import { AttackDirector } from '@/game/timeline/AttackDirector';
import type { BattleStage } from '@/game/scenes/BattleStage';
import { battleReducer, initialState, MAX_HP, MAX_EN, RIVAL_HP, WEAPONS, type Attack, type BattleEvent } from '@/game/state/battle';
import { TacticalMap } from './TacticalMap';
import { inRange } from '@/game/state/tactics';
import { captionAt, DURATION, SHOTS, shotAt } from '@/game/data/shots';
const number = (value: number) => value.toLocaleString('en-US');
const pilotImage = (pilot: 'hero' | 'rival') => `/game/sd/pilot-${pilot}.webp`;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function cutinStyle(time: number, pilot: 'hero' | 'rival', reduced: boolean): CSSProperties {
  const elapsed = time - (pilot === 'hero' ? 1.2 : 9);
  const duration = pilot === 'hero' ? 2 : 1.5;
  const entrance = 1 - Math.pow(1 - clamp(elapsed / .2), 3);
  const exit = clamp((elapsed - duration + .16) / .16);
  const direction = pilot === 'hero' ? 1 : -1;
  // Every moving layer derives from the managed battle clock, so pausing freezes the cut-in.
  return {
    opacity: reduced ? 1 : Math.min(entrance * 2, 1) * (1 - exit),
    transform: `translateX(${reduced ? 0 : ((1 - entrance) * -18 + exit * 12) * direction}%)`,
    '--pilot-scale': reduced ? 1 : 1.04 - clamp(elapsed / duration) * .04,
    '--pilot-pan': `${reduced ? 0 : (1 - entrance) * -3 * direction}%`,
    '--cutin-line-shift': `${reduced ? 0 : elapsed * 12 * direction}%`,
  } as CSSProperties;
}
function Mark({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 44 44" fill="none" className={className} aria-hidden="true"><path d="M4 8 18 22 22 3 26 22 40 8 28 31 22 41 16 31Z" stroke="currentColor" strokeWidth="1.5"/><path d="m14 26 8 7 8-7M22 3v38" stroke="currentColor"/></svg>;
}
function WeaponIcon({ kind }: { kind: Attack }) {
  return <svg viewBox="0 0 76 48" fill="none" aria-hidden="true">{kind === 'rifle'
    ? <><path d="M7 22h16l4-6h24v5h19v5H49l-6 8H28l-4-8H7Z" stroke="currentColor" strokeWidth="1.5"/><path d="m31 34-4 8h7l7-8M33 16v-4h12v4M12 26v5h10v-5M49 22H28" stroke="currentColor" strokeWidth="1.5"/></>
    : <><path d="m16 38 8-8 8 8-8 8ZM23 25l14 14M30 30 61 5 43 32l-8 4Z" stroke="currentColor" strokeWidth="1.5"/><path d="M33 30 58 8" stroke="currentColor"/><path d="M7 17h17M9 22h11M42 43h20" stroke="currentColor" opacity=".35"/></>}</svg>;
}
function Meter({ label, value, max, rival = false }: { label: string; value: number; max: number; rival?: boolean }) {
  return <div className={'meter ' + (rival ? 'enemy' : '')}><div className="meter-label"><span>{label}</span><strong>{number(value)} <small>/ {number(max)}</small></strong></div><div className="meter-track" role="meter" aria-label={label + (rival ? ' 옵시디언' : ' 아스트레이온')} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: value / max * 100 + '%' }}/></div></div>;
}
export default function BattleGame() {
  const [battle, setBattle] = useState(initialState);
  const stateRef = useRef(battle);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [retry, setRetry] = useState(0);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [pilotFailed, setPilotFailed] = useState({ hero: false, rival: false });
  const host = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLElement>(null);
  const stage = useRef<BattleStage | null>(null);
  const audio = useRef<BattleAudio | null>(null);
  const director = useRef<AttackDirector | null>(null);
  const focusCommand = useRef<HTMLButtonElement>(null);
  const focusResume = useRef<HTMLButtonElement>(null);
  const focusReplay = useRef<HTMLButtonElement>(null);
  const pauseDialog = useRef<HTMLDivElement>(null);
  const dispatch = useCallback((event: BattleEvent) => {
    const next = battleReducer(stateRef.current, event);
    stateRef.current = next;
    setBattle(next);
  }, []);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    const engine = new BattleAudio(); audio.current = engine;
    return () => { query.removeEventListener('change', change); engine.dispose(); audio.current = null; };
  }, []);
  useEffect(() => {
    const portraits = (['hero', 'rival'] as const).map(pilot => {
      const image = new Image();
      image.src = pilotImage(pilot);
      return image;
    });
    return () => portraits.forEach(image => { image.src = ''; });
  }, []);
  useEffect(() => {
    let cancelled = false;
    let renderer: BattleStage | null = null;
    setReady(false); setError(''); setWarning('');
    void import('@/game/scenes/BattleStage').then(async ({ BattleStage }) => {
      if (cancelled || !host.current) return;
      renderer = new BattleStage(host.current);
      stage.current = renderer;
      const success = await renderer.init(
        message => { if (!cancelled) setWarning(message); },
        () => { if (!cancelled) { dispatch({ type: 'PAUSE', paused: true }); setError('그래픽 연결이 끊겼습니다. 전투를 다시 불러와 주세요.'); } },
      );
      if (!cancelled && success) setReady(true);
    }).catch(() => { renderer?.dispose(); if (!cancelled) setError('전투 무대를 불러오지 못했습니다. WebGL 지원과 파일 연결을 확인해 주세요.'); });
    return () => { cancelled = true; renderer?.dispose(); if (stage.current === renderer) stage.current = null; };
  }, [retry, dispatch]);
  useEffect(() => { audio.current?.setMuted(muted); }, [muted]);
  useEffect(() => {
    stage.current?.setReduced(reduced);
    if (ready) stage.current?.render(time, battle.phase === 'TITLE' || battle.phase === 'MAP' || battle.phase === 'CHOICE_ATTACK' ? null : battle.action?.kind ?? null);
  }, [reduced, ready, time, battle.phase, battle.action]);
  useEffect(() => {
    if (battle.phase !== 'ATTACK' || !battle.action || !ready || !audio.current) return;
    const session = battle.session, action = battle.action;
    const control = new AttackDirector(action, audio.current, setTime, () => {
      setTime(DURATION);
      dispatch({ type: 'FINISH', session, actionId: action.id });
    });
    director.current = control;
    control.pause(stateRef.current.paused);
    return () => { control.dispose(); if (director.current === control) director.current = null; };
  }, [battle.phase, battle.session, battle.action, ready, dispatch]);
  useEffect(() => { director.current?.pause(battle.paused); }, [battle.paused]);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) dispatch({ type: 'PAUSE', paused: true }); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [dispatch]);
  useEffect(() => {
    if (battle.paused) focusResume.current?.focus();
    else if (battle.phase === 'CHOICE_ATTACK') focusCommand.current?.focus();
    else if (battle.phase === 'RESULT') focusReplay.current?.focus();
  }, [battle.phase, battle.paused]);
  useEffect(() => {
    if (!battle.paused || error) return;
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dispatch({ type: 'PAUSE', paused: false }); return; }
      if (event.key !== 'Tab') return;
      const buttons = pauseDialog.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [battle.paused, error, dispatch]);
  const start = useCallback(() => {
    if (!ready || error) return;
    void audio.current?.unlock().then(ok => setAudioUnavailable(!ok));
    dispatch({ type: 'START' });
  }, [dispatch, ready, error]);
  const commit = useCallback((kind: Attack) => {
    if (!ready || error) return;
    audio.current?.resume();
    dispatch({ type: 'COMMIT', kind });
  }, [dispatch, ready, error]);
  const restart = useCallback(() => {
    director.current?.dispose(); director.current = null;
    audio.current?.stop(); audio.current?.resume();
    setTime(0); dispatch({ type: 'RESTART' });
  }, [dispatch]);
  const skip = useCallback(() => { director.current?.skip(); }, []);
  const pause = useCallback(() => { dispatch({ type: 'PAUSE', paused: !stateRef.current.paused }); }, [dispatch]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (stateRef.current.paused) return; // The pause dialog owns Escape/Tab/native buttons.
      if ((event.target as HTMLElement).closest('input, select, textarea, a')) return;
      if ((event.target as HTMLElement).closest('button') && (key === ' ' || key === 'enter')) return;
      if (key === 'm') { event.preventDefault(); setMuted(v => !v); }
      if (stateRef.current.phase === 'TITLE' && (key === 'enter' || key === ' ')) { event.preventDefault(); start(); }
      if (stateRef.current.phase === 'CHOICE_ATTACK' && (key === '1' || key === '2')) { event.preventDefault(); commit(key === '1' ? 'rifle' : 'rush'); }
      if (stateRef.current.phase === 'ATTACK') {
        if (key === ' ' || key === 'p' || key === 'escape') { event.preventDefault(); pause(); }
        if (key === 's') { event.preventDefault(); skip(); }
      }
      if (stateRef.current.phase === 'RESULT' && key === 'r') { event.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [start, commit, restart, skip, pause]);
  const attack = battle.action?.kind ?? 'rifle';
  const active = battle.phase === 'ATTACK';
  const result = battle.phase === 'RESULT';
  const shot = shotAt(time);
  const caption = active ? captionAt(time, attack) : null;
  const speaker = caption?.speaker === '가면의 파일럿' ? 'rival' : 'hero';
  const pilot = active && time >= 1.2 && time < 3.2 ? 'hero' : active && time >= 9 && time < 10.5 ? 'rival' : null;
  const displayed = active && time < 18 && battle.action ? { ...battle.action.before, heroEN: battle.heroEN } : battle;
  const reload = () => { restart(); setRetry(v => v + 1); };
  return <main className={'game-shell' + (reduced ? ' reduced-motion' : '')} ref={shell} data-phase={battle.phase} data-shot={active ? shot.id : ''} data-session={battle.session} data-time={time.toFixed(2)} data-paused={battle.paused}>
    <header className="topbar">
      <div className="wordmark"><Mark/><span>ASTRAYON<small>ふたつの空 <i>/</i> 두 개의 하늘</small></span></div>
      <div className="chapter"><span className="status-dot"/><span>FIRST CONTACT</span><b>01</b></div>
      <nav className="settings" aria-label="재생 설정">
        <button aria-label={muted ? '소리 꺼짐' : '소리 켜짐'} aria-pressed={muted} onClick={() => setMuted(!muted)} title="소리 켜기 / 끄기"><span aria-hidden="true">{muted ? '♪̸' : '♪'}</span><span>{muted ? '소리 꺼짐' : '소리 켜짐'}</span></button>
        <button aria-label={'자막 ' + (captions ? '켜짐' : '꺼짐')} aria-pressed={captions} onClick={() => setCaptions(!captions)}><span className="cc">CC</span><span>자막 {captions ? '켜짐' : '꺼짐'}</span></button>
        <button aria-label={'효과 ' + (reduced ? '줄임' : '표준')} aria-pressed={reduced} onClick={() => setReduced(!reduced)}><span aria-hidden="true">◒</span><span>효과 {reduced ? '줄임' : '표준'}</span></button>
        <button className="fullscreen" aria-label="전체 화면" onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => setWarning('전체 화면 종료를 지원하지 않는 환경입니다.'));
          else void shell.current?.requestFullscreen?.().catch(() => setWarning('전체 화면을 지원하지 않는 환경입니다.'));
        }}>⛶</button>
      </nav>
    </header>
    <div className="portrait-notice">가로 화면으로 돌리면 전투 장면을 더 넓게 볼 수 있습니다.</div>
    <section className={'battle-screen ' + (active ? 'is-playing' : '') + (battle.phase === 'MAP' ? ' is-map' : '')} aria-label="궤도도시 전투 무대">
      <div className="canvas-host" ref={host}/>
      <div className="vignette"/>
      <div className="screen-corners" aria-hidden="true"/>
      {battle.phase !== 'TITLE' && battle.phase !== 'MAP' && <div className="hud">
        <div className="unit-status hero-status"><div className="unit-heading"><span className="unit-glyph">◇</span><div><small>PLAYER / 주인공</small><h2>ASTRAYON</h2></div><span className="unit-state">{active ? 'ENGAGED' : result ? 'STANDBY' : 'READY'}</span></div><Meter label="HP" value={displayed.heroHP} max={MAX_HP}/><Meter label="EN" value={displayed.heroEN} max={MAX_EN}/></div>
        <div className="field-id"><span>ORBITAL RUINS</span><i/><small>崩壊軌道 · 붕괴 궤도</small></div>
        <div className="unit-status rival-status"><div className="unit-heading"><span className="unit-glyph">⟐</span><div><small>RIVAL / 가면의 파일럿</small><h2>OBSIDIAN</h2></div><span className="unit-state">HOSTILE</span></div><Meter label="HP" value={displayed.rivalHP} max={RIVAL_HP} rival/><div className="rival-readout"><span>경계 태세</span><span>시야 내 포착 <i>●</i></span></div></div>
      </div>}
      {battle.phase === 'MAP' && <TacticalMap battle={battle} dispatch={dispatch} onRestart={restart} onCue={() => audio.current?.cue('confirm')} reduced={reduced}/>}
      <div className="scene-coordinate" aria-hidden="true">SECTOR 07 <span>—</span> EXTERIOR ORBIT</div>
      {battle.phase === 'TITLE' && <div className="title-screen">
        <div className="title-rule"/><p className="eyebrow">TACTICAL MECHA / FIRST CONTACT</p><h1>두 개의 하늘</h1><p className="title-english">ASTRAYON <span>/</span> OBSIDIAN</p>
        <div className="title-dialogue"><span>“저 배에는 아직 사람이 있어.”</span><p>무너진 궤도 위, 두 기체가 마주한다.<br/>기체를 움직여 사선을 만들고, 전투를 개시하라.</p></div>
        <button className="primary start-button" onClick={start} disabled={!ready || !!error}>{ready ? '작전 개시' : '전투 무대 준비 중'} <span aria-hidden="true">↗</span></button>
        <p className="title-note">격자 이동 → 공격 선택 → 시네마틱 전투 <span>·</span> 시작 후 음향 활성화</p>
      </div>}
      {battle.phase === 'CHOICE_ATTACK' && <div className="command-deck">
        <div className="transmission"><div className="portrait-thumbnail">{!pilotFailed.hero && <img src={pilotImage('hero')} alt="" onError={() => setPilotFailed(v => ({ ...v, hero: true }))}/>}</div><div><span>주인공 <i>COMMS / OPEN</i></span><p>저 배에는 아직 사람이 있어. 내가 길을 열겠어.</p></div></div>
        <div className="command-heading"><div><span className="eyebrow">YOUR TURN</span><h2>공격 방식을 선택하세요</h2></div><p>현재 위치에서 사용할 무기를 선택하세요.</p></div>
        <div className="weapon-options">{(['rifle', 'rush'] as const).map((kind, i) => <button key={kind} ref={i === 0 ? focusCommand : undefined} className={'weapon-button ' + kind} onClick={() => commit(kind)} disabled={!ready || !!error || !inRange(kind, battle.position) || battle.heroEN < WEAPONS[kind].en} aria-label={WEAPONS[kind].title + ' 선택'}>
          <span className="weapon-number">0{i + 1}</span><WeaponIcon kind={kind}/><div className="weapon-copy"><span>{WEAPONS[kind].english}</span><h3>{WEAPONS[kind].title}</h3><p>{inRange(kind, battle.position) ? WEAPONS[kind].description : kind === 'rifle' ? '사거리 밖 · 2~5칸에서 사용 가능' : '사거리 밖 · 적에게 인접해야 사용 가능'}</p></div><div className="weapon-damage"><small>예상 피해</small><strong>{number(WEAPONS[kind].damage)}</strong><span aria-hidden="true">↗</span></div>
        </button>)}</div><button className="back-to-map" onClick={() => dispatch({type: 'CANCEL_ATTACK'})}>← 전술 맵으로 돌아가기</button>
      </div>}
      {pilot && <div className={'pilot-cutin ' + pilot} style={cutinStyle(time, pilot, reduced)} data-testid="pilot-cutin" data-pilot={pilot}>
        <div className="pilot-image">{!pilotFailed[pilot] ? <img src={pilotImage(pilot)} alt={pilot === 'hero' ? '조종간을 움켜쥐고 외치는 흰색·청색 헬멧의 주인공' : '조종석에서 맞서는 밝은 갈색 머리와 비대칭 반쪽 가면의 라이벌'} onError={() => { setPilotFailed(v => ({ ...v, [pilot]: true })); setWarning('파일럿 컷인을 읽지 못해 무전 자막으로 진행합니다.'); }}/> : <div className="pilot-fallback">COMMS<br/>AUDIO ONLY</div>}</div>
        <div className="cutin-stripes" aria-hidden="true"/>
        <div className="cutin-link"><i/><span>COCKPIT LINK</span><b>{pilot === 'hero' ? '01' : '02'}</b></div>
        <div className="cutin-label"><small>{pilot === 'hero' ? 'ASTRAYON / PILOT 01' : 'OBSIDIAN / MASKED PILOT'}</small>{captions && <strong>{pilot === 'hero' ? '내가 길을 열겠어!' : '보내줄 수 없다!'}</strong>}</div>
      </div>}
      {active && <div className="action-label"><span>{WEAPONS[attack].english}</span><strong>{WEAPONS[attack].title}</strong></div>}
      {active && time >= 15 && time < 18 && <div className="damage-popup"><span>DIRECT HIT</span><strong>−{number(WEAPONS[attack].damage)}</strong>{attack === 'rush' && <small>아스트레이온 반격 피해 −400</small>}</div>}
      <div className={'caption ' + speaker + (caption && captions ? ' visible' : '')} aria-live="polite" aria-atomic="true">{caption && captions && <>
        {!pilotFailed[speaker] && <div className="caption-portrait" aria-hidden="true"><img src={pilotImage(speaker)} alt="" onError={() => setPilotFailed(v => ({ ...v, [speaker]: true }))}/></div>}
        <div className="caption-copy"><span>{caption.speaker}</span><p>{caption.line}</p></div>
      </>}</div>
      {active && <div className="playback"><div className="shot-track" aria-label="전투 진행"><div className="shot-meta"><span>{shot.id} <i>/</i> {shot.name}</span><time>{time.toFixed(1).padStart(4, '0')} <span>/ 20.0</span></time></div><div className="timeline-track">{SHOTS.map(s => <div key={s.id} style={{ flex: s.end - s.start }} className={time >= s.start ? 'played' : ''}/>)}</div></div><button onClick={pause}>{battle.paused ? '재개' : '일시정지'} <span aria-hidden="true">{battle.paused ? '▷' : 'Ⅱ'}</span></button><button onClick={skip}>연출 건너뛰기 <span aria-hidden="true">››</span></button></div>}
      {result && <div className="result-panel"><span className="eyebrow">FIRST CONTACT / COMPLETE</span><h2>{attack === 'rifle' ? '사선 확보.' : '돌파 성공.'}</h2><p>{attack === 'rifle' ? '거리를 유지하며 다음 공격의 조준을 확보했다.' : '근접 교환으로 더 큰 피해를 주었다. 기체에도 손상이 남았다.'}</p><div className="result-stats"><div><small>적에게 준 피해</small><strong>{number(WEAPONS[attack].damage)}</strong></div><div><small>남은 EN</small><strong>{battle.heroEN}<em> / 100</em></strong></div><div><small>{attack === 'rifle' ? '조준 보너스' : '받은 피해'}</small><strong>{attack === 'rifle' ? '+1' : '400'}</strong></div></div><div className="result-buttons"><button className="primary" ref={focusReplay} onClick={() => dispatch({type:'RETURN_MAP'})}>전술 맵에서 결과 확인 <span aria-hidden="true">↗</span></button><button className="secondary" onClick={restart}>다시 플레이</button></div><small className="result-note">첫 교전 종료 · 다음 반격 장면은 후속 제작 범위입니다.</small></div>}
      {battle.paused && !error && <div className="pause-layer" ref={pauseDialog} role="dialog" aria-modal="true" aria-label="전투 일시정지"><span className="eyebrow">TRANSMISSION ON HOLD</span><h2>잠시 멈춘 궤도</h2><p>화면과 음향이 함께 멈췄습니다.</p><div><button className="primary" ref={focusResume} onClick={pause}>전투 재개 <span>▷</span></button><button className="secondary" onClick={restart}>처음부터</button></div></div>}
      {error && <div className="error-layer" role="alert"><h2>무대 연결을 확인해 주세요</h2><p>{error}</p><button className="primary" onClick={reload}>새로 불러오기 ↻</button></div>}
      {warning && !error && <div className="asset-warning" role="status">{warning}<button onClick={reload}>새로 불러오기</button><button aria-label="안내 닫기" onClick={() => setWarning('')}>×</button></div>}
    </section>
    <footer className="bottom-bar"><span><i className="animatic-dot"/> TACTICAL DEMO <b>SD 관절 스프라이트 · 신규 파일럿 컷인 · 합성 음향</b></span><span>{audioUnavailable ? '오디오를 사용할 수 없어 무음으로 진행합니다.' : '클릭 또는 Tab + Enter'}<i>/</i> {active ? '연출 중 명령 잠금' : result ? '다시 보기 가능' : '첫 교전 · 20초'}</span></footer>
  </main>;
}
