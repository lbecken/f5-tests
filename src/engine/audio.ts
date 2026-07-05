import type { AmbientProfile } from './types'
import sfxDraw from '../assets/sfx/draw.mp3'
import sfxTick from '../assets/sfx/tick.mp3'
import sfxTear from '../assets/sfx/tear.mp3'
import sfxCorrect from '../assets/sfx/correct.mp3'
import sfxWrong from '../assets/sfx/wrong.mp3'
import sfxWin from '../assets/sfx/win.mp3'
import sfxFold from '../assets/sfx/fold.mp3'
import sfxRub from '../assets/sfx/rub.mp3'
import sfxScale from '../assets/sfx/scale.mp3'
import sfxPage from '../assets/sfx/page.mp3'
import sfxHint from '../assets/sfx/hint.mp3'
import sfxStory from '../assets/sfx/story.mp3'

/** Procedurally generated, looping ambient bed — no audio files required, just
 * oscillators, a slow filter, and a sparse generative sequence per theme mood.
 *
 * The bed EVOLVES with story progress via setIntensity(0..1):
 *   - the lowpass filter opens up (brighter, more present)
 *   - the note pulse quickens
 *   - past 0.45 a second melodic voice (a fifth up) joins
 *   - past 0.75 a low heartbeat pulse enters for the final act
 *
 * If the theme ships produced audio (profile.tracks), those replace the
 * procedural bed — see docs/PRODUCTION.md for the asset pipeline. */
class AmbientEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private timer: number | null = null
  private heartbeatTimer: number | null = null
  private droneOsc: OscillatorNode[] = []
  private playing = false
  private profile: AmbientProfile | null = null
  private intensity = 0
  private trackEl: HTMLAudioElement | null = null
  private trackKind: 'main' | 'finale' | null = null

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

  start(profile: AmbientProfile, intensity = 0) {
    this.profile = profile
    this.intensity = intensity

    if (profile.tracks?.main) {
      this.startTrack(intensity >= 0.75 && profile.tracks.finale ? 'finale' : 'main')
      return
    }

    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') ctx.resume()
    if (this.playing) this.stopInternal()
    this.playing = true

    const now = ctx.currentTime
    this.master!.gain.cancelScheduledValues(now)
    this.master!.gain.setValueAtTime(this.master!.gain.value, now)
    this.master!.gain.linearRampToValueAtTime(0.16, now + 1.5)
    this.applyIntensity()

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

    this.scheduleNotes()
    this.scheduleHeartbeat()
  }

  /** 0..1 — call as the player advances; reshapes the bed without restarting it. */
  setIntensity(v: number) {
    const clamped = Math.max(0, Math.min(1, v))
    const wasBelow = this.intensity < 0.75
    this.intensity = clamped
    if (this.trackEl && this.profile?.tracks) {
      if (wasBelow && clamped >= 0.75 && this.profile.tracks.finale && this.trackKind !== 'finale') {
        this.startTrack('finale')
      }
      return
    }
    if (this.playing) this.applyIntensity()
  }

  private applyIntensity() {
    if (!this.ctx || !this.filter || !this.profile) return
    const t = this.ctx.currentTime
    const target = this.profile.filterFreq * (1 + this.intensity * 2.2)
    this.filter.frequency.cancelScheduledValues(t)
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t)
    this.filter.frequency.linearRampToValueAtTime(target, t + 2.5)
  }

  private noteTempo() {
    const p = this.profile!
    return p.tempoMs * (1 - this.intensity * 0.45)
  }

  private scheduleNotes() {
    const playNote = () => {
      if (!this.ctx || !this.playing || !this.profile) return
      const p = this.profile
      const degree = p.scale[Math.floor(Math.random() * p.scale.length)]
      const freq = p.baseFreq * Math.pow(2, degree / 12) * (Math.random() < 0.3 ? 2 : 1)
      this.voice(freq, p.mood === 'mechanical' ? 'square' : p.waveform, 0.06, 2.2)
      // second act: a companion voice a fifth above, slightly delayed
      if (this.intensity > 0.45 && Math.random() < 0.6) {
        window.setTimeout(() => {
          if (this.playing) this.voice(freq * 1.5, 'triangle', 0.035, 1.6)
        }, 260)
      }
      this.timer = window.setTimeout(playNote, this.noteTempo() * (0.7 + Math.random() * 0.8))
    }
    playNote()
  }

  private scheduleHeartbeat() {
    const beat = () => {
      if (!this.ctx || !this.playing) return
      if (this.intensity > 0.75) {
        this.voice(this.profile!.baseFreq / 2, 'sine', 0.09, 0.35)
        window.setTimeout(() => {
          if (this.playing && this.intensity > 0.75) this.voice(this.profile!.baseFreq / 2, 'sine', 0.06, 0.3)
        }, 320)
      }
      this.heartbeatTimer = window.setTimeout(beat, 2100 - this.intensity * 600)
    }
    beat()
  }

  private voice(freq: number, type: OscillatorType, gain: number, dur: number) {
    if (!this.ctx || !this.filter) return
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    const t = this.ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.4, dur * 0.2))
    g.gain.linearRampToValueAtTime(0, t + dur)
    osc.connect(g)
    g.connect(this.filter)
    osc.start(t)
    osc.stop(t + dur + 0.1)
  }

  private startTrack(kind: 'main' | 'finale') {
    const src = this.profile?.tracks?.[kind]
    if (!src) return
    this.stopInternal()
    if (this.trackEl) {
      this.trackEl.pause()
      this.trackEl = null
    }
    const el = new Audio(src)
    el.loop = true
    el.volume = 0.5
    el.play().catch(() => { /* autoplay policies — user gesture will retry */ })
    this.trackEl = el
    this.trackKind = kind
    this.playing = true
  }

  private stopInternal() {
    if (this.timer) window.clearTimeout(this.timer)
    if (this.heartbeatTimer) window.clearTimeout(this.heartbeatTimer)
    this.timer = null
    this.heartbeatTimer = null
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
    this.playing = false
    if (this.trackEl) {
      this.trackEl.pause()
      this.trackEl = null
      this.trackKind = null
    }
    if (!this.ctx || !this.master) {
      this.stopInternal()
      return
    }
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(this.master.gain.value, now)
    this.master.gain.linearRampToValueAtTime(0, now + 0.8)
    window.setTimeout(() => this.stopInternal(), 900)
  }
}

export const ambientEngine = new AmbientEngine()

let uiCtx: AudioContext | null = null
function getUiCtx() {
  if (!uiCtx) uiCtx = new AudioContext()
  if (uiCtx.state === 'suspended') uiCtx.resume()
  return uiCtx
}

/** Produced sound effects (ElevenLabs) — see scripts/gen-audio.sh. Kinds without a
 * file fall through to the procedural synth stinger below. */
const SFX_FILES: Partial<Record<string, string>> = {
  draw: sfxDraw,
  tick: sfxTick,
  tear: sfxTear,
  correct: sfxCorrect,
  wrong: sfxWrong,
  win: sfxWin,
  fold: sfxFold,
  rub: sfxRub,
  scale: sfxScale,
  page: sfxPage,
  hint: sfxHint,
  story: sfxStory,
}
const SFX_VOLUME: Record<string, number> = { tick: 0.35, draw: 0.45, tear: 0.55, correct: 0.55, wrong: 0.4, win: 0.6, fold: 0.5, rub: 0.35, scale: 0.4, page: 0.4, hint: 0.45, story: 0.5 }

/** One-shot narration/voice clip player — only one speaks at a time. */
let voiceEl: HTMLAudioElement | null = null
export function playVoice(url: string): HTMLAudioElement {
  stopVoice()
  voiceEl = new Audio(url)
  voiceEl.volume = 0.9
  voiceEl.play().catch(() => { /* needs a user gesture; buttons provide one */ })
  return voiceEl
}
export function stopVoice() {
  if (voiceEl) {
    voiceEl.pause()
    voiceEl = null
  }
}

/** Short one-shot UI stingers. 'story' is the four-note act motif played when a
 * blue card advances the narrative; 'tick' is the decoder ring snapping home. */
export function playChime(kind: 'correct' | 'wrong' | 'hint' | 'draw' | 'story' | 'tick' | 'tear' | 'win' | 'fold' | 'rub' | 'scale' | 'page') {
  const file = SFX_FILES[kind]
  if (file) {
    const el = new Audio(file)
    el.volume = SFX_VOLUME[kind] ?? 0.5
    el.play().catch(() => { /* pre-gesture; procedural fallback below still runs nothing */ })
    return
  }
  const ctx = getUiCtx()
  const g = ctx.createGain()
  g.connect(ctx.destination)
  const t = ctx.currentTime

  if (kind === 'tick') {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 1800
    osc.connect(g)
    g.gain.setValueAtTime(0.05, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
    osc.start(t)
    osc.stop(t + 0.05)
    return
  }

  const notes: Record<string, number[]> = {
    correct: [523.25, 659.25, 783.99],
    wrong: [220, 196],
    hint: [440, 523.25],
    draw: [349.23],
    story: [392, 466.16, 587.33, 783.99],
  }
  const freqs = notes[kind]
  if (!freqs) return
  const step = kind === 'story' ? 0.16 : 0.11
  g.gain.setValueAtTime(0.001, t)
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator()
    osc.type = kind === 'wrong' ? 'sawtooth' : 'triangle'
    osc.frequency.value = f
    osc.connect(g)
    const start = t + i * step
    g.gain.setValueAtTime(0.001, start)
    g.gain.exponentialRampToValueAtTime(0.16, start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.001, start + (kind === 'story' ? 0.4 : 0.3))
    osc.start(start)
    osc.stop(start + (kind === 'story' ? 0.42 : 0.32))
  })
}
