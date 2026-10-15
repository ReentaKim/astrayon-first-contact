export type Cue = 'confirm' | 'radio' | 'charge' | 'boost' | 'beam' | 'parry' | 'clash' | 'hit' | 'tail';
/** All cues are called by the scene clock. No setTimeout or free-running audio loop.
 * Suspending the context freezes its sample clock together with the GSAP timeline. */
export class BattleAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<'sfx' | 'music' | 'voice', GainNode>> = {};
  private nodes = new Set<OscillatorNode | AudioBufferSourceNode>();
  private muted = false;
  private disposed = false;
  private desiredPaused = false;
  private contextTransition: Promise<boolean> = Promise.resolve(false);
  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.28;
        this.master.connect(this.context.destination);
        for (const name of ['sfx', 'music', 'voice'] as const) {
          const bus = this.context.createGain();
          bus.gain.value = name === 'music' ? .32 : 1;
          bus.connect(this.master);
          this.buses[name] = bus;
        }
      }
      return await this.resume();
    } catch { return false; }
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : .28, this.context.currentTime, .025);
  }
  /** A resume must wait for an in-flight suspend, even if state still says
   * "running". Reconcile the latest request after each asynchronous transition. */
  private setPaused(paused: boolean): Promise<boolean> {
    this.desiredPaused = paused;
    this.contextTransition = this.contextTransition.then(async () => {
      const ctx = this.context;
      if (!ctx || this.disposed || ctx.state === 'closed') return false;
      try {
        if (this.desiredPaused && ctx.state === 'running') await ctx.suspend();
        else if (!this.desiredPaused && ctx.state === 'suspended') await ctx.resume();
        return !this.disposed && ctx.state === (this.desiredPaused ? 'suspended' : 'running');
      } catch { return false; }
    });
    return this.contextTransition;
  }
  pause() { return this.setPaused(true); }
  resume() { return this.setPaused(false); }
  /** Original procedural underscore, scheduled on the audio clock and stopped
   * with this action. Context suspension also freezes all pending notes. */
  startScore() {
    const ctx=this.context,bus=this.buses.music;if(!ctx||!bus)return;
    const now=ctx.currentTime;
    const tone=(frequency:number,at:number,length:number,volume:number,type:OscillatorType='triangle')=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
      osc.type=type;osc.frequency.value=frequency;filter.type='lowpass';filter.frequency.value=900;
      gain.gain.setValueAtTime(.0001,now+at);gain.gain.linearRampToValueAtTime(volume,now+at+.12);gain.gain.exponentialRampToValueAtTime(.0001,now+at+length);
      osc.connect(filter);filter.connect(gain);gain.connect(bus);this.nodes.add(osc);
      osc.onended=()=>{this.nodes.delete(osc);osc.disconnect();filter.disconnect();gain.disconnect();};osc.start(now+at);osc.stop(now+at+length+.03);
    };
    // D minor → B-flat → G minor → A tension, then an open D/A resolution.
    for(const [at,chord] of [[0,[73.42,110,146.83]],[3.2,[58.27,87.31,116.54]],[6,[49,73.42,98]],[9,[55,82.41,110]],[10.5,[73.42,110,146.83]],[15,[73.42,110,220]]] as [number,number[]][])
      chord.forEach((note,i)=>tone(note,at,at===15?4.8:3.1,.14/(i+1),'sine'));
    for(let i=0;i<24;i++){const at=3.2+i*.42;if(at>=13.3)break;tone([146.83,220,293.66,261.63][i%4],at,.31,.12);tone(36.71,at,.22,.2,'sine');}
    tone(587.33,18,1.7,.08,'sine');tone(440,18.3,1.5,.06,'sine');
  }
  cue(cue: Cue) {
    const ctx = this.context;
    const bus = this.buses.sfx;
    if (!ctx || !bus || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const config: Record<Cue, [number, number, number, OscillatorType]> = {
      confirm: [520, 740, .09, 'sine'], radio: [1200, 800, .06, 'sine'],
      charge: [95, 480, 1.5, 'triangle'], boost: [110, 40, .9, 'sawtooth'],
      beam: [880, 90, .65, 'sawtooth'], clash: [170, 30, .8, 'triangle'],
      parry: [640, 110, .24, 'triangle'], hit: [90, 28, .3, 'triangle'],
      tail: [180, 70, 1.2, 'sine'],
    };
    const [from, to, length, type] = config[cue];
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + length);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(cue === 'clash' ? .6 : .18, now + .025);
    gain.gain.exponentialRampToValueAtTime(.001, now + length);
    oscillator.connect(gain); gain.connect(bus);
    this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now); oscillator.stop(now + length + .03);
    if (cue === 'clash' || cue === 'parry' || cue === 'hit' || cue === 'boost' || cue === 'beam' || cue === 'charge') {
      const duration=cue==='charge'?1.6:cue==='clash'?1.1:cue==='parry'?.28:cue==='hit'?.4:.7;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (cue==='charge'?(i/data.length)**2:(1 - i / data.length) ** 3);
      const noise = ctx.createBufferSource();
      const volume = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = cue==='beam'?'bandpass':'lowpass'; filter.frequency.setValueAtTime(cue==='clash'?3000:cue==='parry'?4200:cue==='hit'?1600:cue==='beam'?2200:600,now);
      filter.frequency.exponentialRampToValueAtTime(cue==='charge'?3800:160,now+duration);
      volume.gain.value = cue==='charge'?.11:cue==='parry'?.24:cue==='hit'?.3:.36; noise.buffer = buffer;
      noise.connect(filter); filter.connect(volume); volume.connect(bus);
      this.nodes.add(noise);
      noise.onended = () => { this.nodes.delete(noise); noise.disconnect(); filter.disconnect(); volume.disconnect(); };
      noise.start(now);
    }
  }
  stop() {
    for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch { /* already ended */ } }
    this.nodes.clear();
  }
  dispose() {
    this.disposed = true; this.stop();
    for (const bus of Object.values(this.buses)) bus.disconnect();
    this.master?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
