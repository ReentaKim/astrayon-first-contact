'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BattleStage } from '@/game/scenes/BattleStage';
import type { Attack } from '@/game/state/battle';
import { DURATION } from '@/game/data/shots';

const frames = [
  ['대기', 0], ['무장 준비', 4.3], ['하체 축적', 5.5], ['추진', 6.24],
  ['첫 접촉 · 패링', 6.62], ['패링 반동', 6.93], ['허리 회전', 12.85],
  ['본 접촉', 13.5], ['피격', 13.88], ['반격 접촉', 14.55], ['무릎 붕괴', 15.5], ['복귀', 18],
] as const;
const fieldStyle: CSSProperties = { border: '1px solid #4c6270', background: '#112330', color: '#e7eff3', borderRadius: 0, padding: '9px 10px', fontSize: 13 };
const selectedStyle: CSSProperties = { borderColor: '#aedbd0', background: '#263f49', color: '#e5fff0' };
const clampTime = (value: number) => Math.max(0, Math.min(DURATION, value));

export default function Review() {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<BattleStage | null>(null);
  const frame = useRef<number | null>(null);
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [attack, setAttack] = useState<Attack>('rush');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<.5 | 1>(1);
  const [reduced, setReduced] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [draftTime, setDraftTime] = useState('0.00');

  const pause = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setPlaying(false);
  }, []);
  const seek = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    pause();
    clock.current = clampTime(value);
    setTime(clock.current);
  }, [pause]);

  useEffect(() => {
    let cancelled = false;
    let renderer: BattleStage | null = null;
    void import('@/game/scenes/BattleStage').then(async ({ BattleStage }) => {
      if (cancelled || !host.current) return;
      renderer = new BattleStage(host.current);
      stage.current = renderer;
      const ok = await renderer.init(
        message => { if (!cancelled) setError(message); },
        () => { if (!cancelled) { pause(); setReady(false); setError('그래픽 연결이 끊겼습니다. 페이지를 새로 불러와 주세요.'); } },
      );
      if (!cancelled && ok) setReady(true);
    }).catch(() => { renderer?.dispose(); if (!cancelled) setError('전투 무대를 불러오지 못했습니다.'); });
    return () => {
      cancelled = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      renderer?.dispose();
      if (stage.current === renderer) stage.current = null;
    };
  }, [pause]);

  useEffect(() => {
    if (!ready) return;
    stage.current?.setReduced(reduced);
    stage.current?.render(time, time === 0 ? null : attack);
  }, [time, attack, reduced, ready]);

  useEffect(() => {
    if (!playing || !ready) return;
    let cancelled = false;
    let previous: number | null = null;
    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = previous === null ? 0 : Math.max(0, now - previous);
      previous = now;
      clock.current = clampTime(clock.current + elapsed / 1000 * speed);
      setTime(clock.current);
      if (clock.current >= DURATION) {
        frame.current = null;
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [playing, ready, speed]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  const togglePlayback = () => {
    if (playing) { pause(); return; }
    if (!ready) return;
    if (clock.current >= DURATION) { clock.current = 0; setTime(0); }
    setPlaying(true);
  };
  const commitTimeInput = () => {
    if (draftTime.trim()) seek(Number(draftTime));
    setEditingTime(false);
  };

  return <main style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }} data-review-time={time.toFixed(3)} data-playing={playing}>
    <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div><span style={{ fontSize: 11, color: '#92cbbf', letterSpacing: 3 }}>ASTRAYON / MOTION REVIEW</span><h1 style={{ fontSize: 22, fontWeight: 400 }}>전신 동작과 접촉 검수</h1></div>
      <a href="/" style={{ color: '#b9dbd0', fontSize: 12 }}>플레이 화면으로 →</a>
    </header>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
      {(['rush', 'rifle'] as const).map(kind => <button key={kind} className="secondary" aria-pressed={attack === kind} style={attack === kind ? selectedStyle : undefined} onClick={() => { pause(); setAttack(kind); }}>{kind === 'rush' ? '블레이드 러시' : '빔 라이플'}</button>)}
      <button className="secondary" aria-pressed={reduced} style={reduced ? selectedStyle : undefined} onClick={() => setReduced(value => !value)}>효과 {reduced ? '줄임' : '표준'}</button>
      <span style={{ marginLeft: 'auto', color: '#8ea2af', fontSize: 12 }}>{ready ? playing ? '재생 중' : '일시정지' : '전투 무대 로딩 중'} · <time style={{ fontVariantNumeric: 'tabular-nums' }}>{time.toFixed(2)} / {DURATION.toFixed(2)}초</time></span>
    </div>
    <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', border: '1px solid #334752' }}><div className="canvas-host" ref={host}/></div>
    <section aria-label="모션 재생 및 시간 조절" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 18 }}>
      <button className="secondary" disabled={!ready} onClick={togglePlayback} style={{ ...selectedStyle, minWidth: 110 }}>{playing ? '일시정지 Ⅱ' : time >= DURATION ? '처음부터 재생 ▷' : '재생 ▷'}</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a7bcc8' }}>속도
        <select value={speed} aria-label="재생 속도" onChange={event => setSpeed(Number(event.target.value) as .5 | 1)} style={fieldStyle}><option value="0.5">0.5×</option><option value="1">1×</option></select>
      </label>
      <button className="secondary" disabled={!ready} onClick={() => seek(clock.current - 1 / 60)} aria-label="이전 프레임으로 이동">−1 프레임</button>
      <button className="secondary" disabled={!ready} onClick={() => seek(clock.current + 1 / 60)} aria-label="다음 프레임으로 이동">+1 프레임</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', fontSize: 12, color: '#a7bcc8' }}>정확한 시간
        <input type="number" aria-label="정확한 장면 시간" min="0" max={DURATION} step="0.01" disabled={!ready} value={editingTime ? draftTime : time.toFixed(2)} onFocus={() => { pause(); setDraftTime(clock.current.toFixed(2)); setEditingTime(true); }} onChange={event => setDraftTime(event.target.value)} onBlur={commitTimeInput} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} style={{ ...fieldStyle, width: 90, fontVariantNumeric: 'tabular-nums' }}/><span>초</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', fontSize: 12, color: '#99b3c0', marginTop: 8 }}>장면 시간
        <input type="range" aria-label="장면 시간" min="0" max={DURATION} step="0.01" disabled={!ready} value={time} onChange={event => seek(Number(event.target.value))} style={{ flex: 1, minWidth: 120, accentColor: '#aedbd0' }}/>
      </label>
    </section>
    <nav aria-label="주요 동작 시점" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>{frames.map(([name, at]) => <button className="secondary" key={name} disabled={!ready} onClick={() => seek(at)} aria-pressed={Math.abs(time - at) < .005} style={{ ...(Math.abs(time - at) < .005 ? selectedStyle : {}), fontSize: 12, padding: '10px 14px' }}>{name} <small style={{ display: 'block', marginTop: 5, fontSize: 10, color: '#8ba6b3', fontVariantNumeric: 'tabular-nums' }}>{at.toFixed(2)}s</small></button>)}</nav>
    {error && <p role="alert" style={{ color: '#e8b7aa', fontSize: 12, lineHeight: 1.7 }}>{error}</p>}
    <p style={{ fontSize: 11, color: '#768e9b', marginTop: 24, lineHeight: 1.8 }}>실제 게임과 같은 Pixi 렌더러를 하나의 장면 시간으로 재생합니다. 시간 입력은 Enter 또는 포커스를 옮기면 적용되며, 시점 이동은 재생을 멈춥니다.<br/>프리셋은 블레이드 러시 기준입니다. 효과 줄임은 접촉 정지·카메라 효과를 줄입니다. 파일럿·HUD·음향·플레이 상태는 메인 게임에서 별도 검수합니다.</p>
  </main>;
}
