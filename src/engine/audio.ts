import type { AmbientProfile } from './types'

/** Procedurally generated, looping ambient bed — no audio files, just oscillators,
 * a slow filter sweep, and a sparse generative note sequence per theme "mood". */
class AmbientEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private timer: number | null = null
  private droneOsc: OscillatorNode[] = []
  private playing = false

  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.filter = this.ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 800
      this.filter.connect(this.master)
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  start(profile: AmbientProfile) {
    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') ctx.resume()
    if (this.playing) this.stopInternal()
    this.playing = true

    const now = ctx.currentTime
    this.master!.gain.cancelScheduledValues(now)
    this.master!.gain.setValueAtTime(this.master!.gain.value, now)
    this.master!.gain.linearRampToValueAtTime(0.16, now + 1.5)

    this.filter!.frequency.setValueAtTime(profile.filterFreq, now)
    this.filter!.frequency.linearRampToValueAtTime(profile.filterFreq * 1.4, now + 8)

    // two detuned drones for a slowly beating pad
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator()
      osc.type = profile.waveform
      osc.frequency.value = profile.baseFreq
      osc.detune.value = detune
      const g = ctx.createGain()
      g.gain.value = 0.5
      osc.connect(g)
      g.connect(this.filter!)
      osc.start()
      this.droneOsc.push(osc)
    }

    const playNote = () => {
      if (!this.ctx || !this.playing) return
      const degree = profile.scale[Math.floor(Math.random() * profile.scale.length)]
      const freq = profile.baseFreq * Math.pow(2, degree / 12) * (Math.random() < 0.3 ? 2 : 1)
      const osc = this.ctx.createOscillator()
      osc.type = profile.mood === 'mechanical' ? 'square' : profile.waveform
      osc.frequency.value = freq
      const g = this.ctx.createGain()
      const t = this.ctx.currentTime
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.06, t + 0.4)
      g.gain.linearRampToValueAtTime(0, t + 2.2)
      osc.connect(g)
      g.connect(this.filter!)
      osc.start(t)
      osc.stop(t + 2.3)
      this.timer = window.setTimeout(playNote, profile.tempoMs * (0.7 + Math.random() * 0.8))
    }
    playNote()
  }

  private stopInternal() {
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null
    for (const osc of this.droneOsc) {
      try {
        osc.stop()
      } catch {
        /* already stopped */
      }
    }
    this.droneOsc = []
  }

  stop() {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0, now + 0.8)
    this.playing = false
    window.setTimeout(() => this.stopInternal(), 900)
  }
}

export const ambientEngine = new AmbientEngine()

/** Short one-shot UI stingers (correct / wrong / hint) reusing the same context. */
export function playChime(kind: 'correct' | 'wrong' | 'hint' | 'draw') {
  const ctx = new AudioContext()
  const g = ctx.createGain()
  g.connect(ctx.destination)
  const t = ctx.currentTime
  const notes: Record<string, number[]> = {
    correct: [523.25, 659.25, 783.99],
    wrong: [220, 196],
    hint: [440, 523.25],
    draw: [349.23],
  }
  const freqs = notes[kind]
  g.gain.setValueAtTime(0.001, t)
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator()
    osc.type = kind === 'wrong' ? 'sawtooth' : 'triangle'
    osc.frequency.value = f
    osc.connect(g)
    const start = t + i * 0.11
    g.gain.setValueAtTime(0.001, start)
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
    osc.start(start)
    osc.stop(start + 0.32)
  })
  window.setTimeout(() => ctx.close(), (freqs.length * 0.11 + 0.4) * 1000)
}
