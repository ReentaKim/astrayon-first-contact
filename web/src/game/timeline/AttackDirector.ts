import { gsap } from 'gsap';
import { DURATION } from '../data/shots';
import { MOTION_CUES } from '../data/motion';
import type { Action } from '../state/battle';
import type { BattleAudio, Cue } from '../audio/BattleAudio';
export class AttackDirector {
  private timeline: gsap.core.Timeline;
  private cursor = { time: 0 };
  private finished = false;
  private started = false;
  private playbackRevision = 0;
  private resumeTimeout: ReturnType<typeof setTimeout> | null = null;
  constructor(action: Action, private audio: BattleAudio, onFrame: (time: number) => void, private onComplete: () => void) {
    this.timeline = gsap.timeline({ paused: true, onUpdate: () => onFrame(this.cursor.time), onComplete: () => this.complete() });
    this.timeline.to(this.cursor, { time: DURATION, duration: DURATION, ease: 'none' }, 0);
    const cues: [number, Cue][] = [[0, 'confirm'], [1.2, 'radio'], [9, 'radio'], [15, 'tail']];
    for (const cue of MOTION_CUES[action.kind]) cues.push([cue.at, cue.type]);
    for (const [at, cue] of cues) this.timeline.call(() => this.audio.cue(cue), [], at);
    onFrame(0);
    this.pause(false);
  }
  private complete() {
    if (this.finished) return;
    this.finished = true; this.clearResumeTimeout(); this.audio.stop(); this.onComplete();
  }
  private clearResumeTimeout() {
    if (this.resumeTimeout !== null) clearTimeout(this.resumeTimeout);
    this.resumeTimeout = null;
  }
  pause(paused: boolean) {
    if (this.finished) return;
    const revision = ++this.playbackRevision;
    this.clearResumeTimeout();
    this.timeline.pause();
    if (paused) { void this.audio.pause(); return; }
    // Browser audio transitions are asynchronous. Keep the scene frozen until
    // the latest resume resolves; obsolete requests cannot revive a skipped run.
    let settled = false;
    const continuePlayback = (audioReady: boolean) => {
      if (settled) return;
      settled = true;
      if (this.finished || revision !== this.playbackRevision) return;
      this.clearResumeTimeout();
      if (!audioReady) this.audio.stop();
      else if (!this.started) this.audio.startScore();
      this.started = true;
      this.timeline.resume();
    };
    // A blocked audio device must not block the game. This is a cancellable
    // resume watchdog, never a scene/event clock. Late audio cannot restart it.
    this.resumeTimeout = setTimeout(() => continuePlayback(false), 400);
    void this.audio.resume().then(continuePlayback, () => continuePlayback(false));
  }
  skip() { this.timeline.kill(); this.complete(); }
  dispose() { this.finished = true; this.clearResumeTimeout(); this.timeline.kill(); this.audio.stop(); }
}
