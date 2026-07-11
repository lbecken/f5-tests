import type { Score, ScoreNote, Staff } from './types';
import { FLAT_ORDER, SHARP_ORDER } from './theory';

// ---- geometry (px) ----
const STAFF_SPACE = 10; // distance between staff lines
const HALF_STEP = STAFF_SPACE / 2; // one diatonic step
const TREBLE_TOP = 100; // y of the treble staff's top line
const BASS_TOP = 200;
const SVG_HEIGHT = 320;
const DEFAULT_PX_PER_QUARTER = 64;
const PAD_LEFT = 36;
const PAD_RIGHT = 80;
const FONT_SIZE = 4 * STAFF_SPACE; // SMuFL: 1 em = staff height
const HEAD_W = 11.7; // black/half notehead width at this font size
const STEM_LEN = 3.5 * STAFF_SPACE;

// ---- SMuFL codepoints (Bravura) ----
const cp = (c: number) => String.fromCodePoint(c);
const GLYPH = {
  trebleClef: cp(0xe050), // gClef
  bassClef: cp(0xe062), // fClef
  wholeHead: cp(0xe0a2), // noteheadWhole
  halfHead: cp(0xe0a3), // noteheadHalf
  blackHead: cp(0xe0a4), // noteheadBlack
  flat: cp(0xe260),
  natural: cp(0xe261),
  sharp: cp(0xe262),
  flagUp: [cp(0xe240), cp(0xe242), cp(0xe244)], // 8th, 16th, 32nd
  flagDown: [cp(0xe241), cp(0xe243), cp(0xe245)],
  dot: cp(0xe1e7), // augmentationDot
  timeSigDigit: (d: number) => cp(0xe080 + d),
};

const BEAM_THICKNESS = 5; // 0.5 staff space

interface DurationGlyph {
  head: string;
  hasStem: boolean;
  flags: number; // 0..3 (index+1 into flag glyph arrays)
  dotted: boolean;
}

interface ChordInfo {
  notes: ScoreNote[]; // sorted by step
  staff: Staff;
  ticks: number;
  x: number;
  dur: DurationGlyph;
  stemUpDefault: boolean;
  /** Beat-unit index (unique across measures), filled in by computeBeams. */
  unit?: number;
}

interface Beam {
  chords: ChordInfo[];
  stemUp: boolean;
  x0: number; // stem x of the first chord
  y0: number; // beam y at x0
  slope: number;
  flags: number;
}

/** Quantize a duration in quarter notes to the closest notatable value. */
function classifyDuration(quarters: number): DurationGlyph {
  const candidates: Array<[number, DurationGlyph]> = [
    [4, { head: GLYPH.wholeHead, hasStem: false, flags: 0, dotted: false }],
    [3, { head: GLYPH.halfHead, hasStem: true, flags: 0, dotted: true }],
    [2, { head: GLYPH.halfHead, hasStem: true, flags: 0, dotted: false }],
    [1.5, { head: GLYPH.blackHead, hasStem: true, flags: 0, dotted: true }],
    [1, { head: GLYPH.blackHead, hasStem: true, flags: 0, dotted: false }],
    [0.75, { head: GLYPH.blackHead, hasStem: true, flags: 1, dotted: true }],
    [0.5, { head: GLYPH.blackHead, hasStem: true, flags: 1, dotted: false }],
    [0.375, { head: GLYPH.blackHead, hasStem: true, flags: 2, dotted: true }],
    [0.25, { head: GLYPH.blackHead, hasStem: true, flags: 2, dotted: false }],
    [0.125, { head: GLYPH.blackHead, hasStem: true, flags: 3, dotted: false }],
  ];
  const q = Math.max(quarters, 0.01);
  let best = candidates[0][1];
  let bestDist = Infinity;
  for (const [value, glyph] of candidates) {
    const dist = Math.abs(Math.log2(q / value));
    if (dist < bestDist) {
      bestDist = dist;
      best = glyph;
    }
  }
  return best;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent: SVGElement | null,
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

function glyphText(
  parent: SVGElement,
  glyph: string,
  x: number,
  y: number,
  cls = 'smufl',
): SVGTextElement {
  return el('text', { x, y, 'font-size': FONT_SIZE, class: cls }, parent, glyph);
}

export class ScoreRenderer {
  private headerEl: HTMLElement;
  private contentEl: HTMLElement;
  private score: Score | null = null;
  private cursor: SVGLineElement | null = null;
  private noteGroups: SVGGElement[] = [];
  private pxPerTick = 0;
  pxPerQuarter = DEFAULT_PX_PER_QUARTER;
  contentWidth = 0;

  constructor(headerEl: HTMLElement, contentEl: HTMLElement) {
    this.headerEl = headerEl;
    this.contentEl = contentEl;
  }

  /** y coordinate for a diatonic step on a staff. */
  private yFor(step: number, staff: Staff): number {
    // Treble: bottom line is E4 (step 30). Bass: bottom line is G2 (step 18).
    return staff === 'treble'
      ? TREBLE_TOP + 4 * STAFF_SPACE - (step - 30) * HALF_STEP
      : BASS_TOP + 4 * STAFF_SPACE - (step - 18) * HALF_STEP;
  }

  xForTicks(ticks: number): number {
    return PAD_LEFT + ticks * this.pxPerTick;
  }

  ticksForX(x: number): number {
    return Math.max(0, (x - PAD_LEFT) / this.pxPerTick);
  }

  render(score: Score): void {
    this.score = score;
    this.pxPerTick = this.pxPerQuarter / score.ppq;
    this.renderHeader(score);
    this.renderContent(score);
    this.refreshAllStates();
  }

  /** Change the horizontal note spacing and re-render. */
  setZoom(pxPerQuarter: number): void {
    this.pxPerQuarter = pxPerQuarter;
    if (this.score) this.render(this.score);
  }

  // ------------------------------------------------------------------
  // Fixed header: staff lines, clefs, key signature, time signature
  // ------------------------------------------------------------------
  private renderHeader(score: Score): void {
    const accidentals = Math.abs(score.keyFifths);
    const width = 66 + accidentals * 10 + 30;
    this.headerEl.innerHTML = '';
    const svg = el('svg', { width, height: SVG_HEIGHT }, null);
    this.headerEl.appendChild(svg);

    this.drawStaffLines(svg, 0, width);
    // Systemic barline joining the two staves at the very start.
    el('line', {
      x1: 1, y1: TREBLE_TOP, x2: 1, y2: BASS_TOP + 4 * STAFF_SPACE,
      class: 'barline', 'stroke-width': 2,
    }, svg);

    // Clefs: G clef curls around the G4 line, F clef sits on the F3 line.
    glyphText(svg, GLYPH.trebleClef, 8, TREBLE_TOP + 3 * STAFF_SPACE);
    glyphText(svg, GLYPH.bassClef, 8, BASS_TOP + STAFF_SPACE);

    // Key signature.
    const keyX = 46;
    const order = score.keyFifths >= 0 ? SHARP_ORDER : FLAT_ORDER;
    // Conventional treble-staff positions (diatonic steps) of key signature
    // accidentals, indexed by letter; bass positions sit two staff steps lower.
    const sharpSteps = [35, 36, 37, 38, 39, 33, 34]; // C5 D5 E5 F5 G5 A4 B4
    const flatSteps = [35, 36, 37, 31, 32, 33, 34]; // C5 D5 E5 F4 G4 A4 B4
    const stepForLetter = score.keyFifths >= 0 ? sharpSteps : flatSteps;
    const glyph = score.keyFifths >= 0 ? GLYPH.sharp : GLYPH.flat;
    for (let i = 0; i < accidentals; i++) {
      const trebleStep = stepForLetter[order[i]];
      glyphText(svg, glyph, keyX + i * 10, this.yFor(trebleStep, 'treble'));
      glyphText(svg, glyph, keyX + i * 10, this.yFor(trebleStep - 14, 'bass'));
    }

    // Time signature.
    const ts = score.timeSignatures[0];
    const tsX = keyX + accidentals * 10 + 12;
    for (const staffTop of [TREBLE_TOP, BASS_TOP]) {
      this.drawTimeSigNumber(svg, ts.numerator, tsX, staffTop + STAFF_SPACE);
      this.drawTimeSigNumber(svg, ts.denominator, tsX, staffTop + 3 * STAFF_SPACE);
    }
  }

  private drawTimeSigNumber(svg: SVGElement, value: number, x: number, y: number): void {
    const digits = String(value).split('').map(Number);
    const digitW = 17;
    let dx = x - ((digits.length - 1) * digitW) / 2;
    for (const d of digits) {
      glyphText(svg, GLYPH.timeSigDigit(d), dx, y);
      dx += digitW;
    }
  }

  // ------------------------------------------------------------------
  // Scrolling content: barlines, notes, cursor
  // ------------------------------------------------------------------
  private renderContent(score: Score): void {
    const width = this.xForTicks(score.durationTicks) + PAD_RIGHT;
    this.contentWidth = width;
    this.contentEl.innerHTML = '';
    this.noteGroups = [];
    const svg = el('svg', { width, height: SVG_HEIGHT }, null);
    this.contentEl.appendChild(svg);

    this.drawStaffLines(svg, 0, width);

    // Barlines and measure numbers. Barlines sit a little before the
    // measure's first beat so noteheads never touch them (the time→x
    // mapping itself stays strictly linear for the cursor).
    for (const m of score.measures) {
      const x = this.xForTicks(m.ticks);
      if (m.ticks > 0) {
        el('line', {
          x1: x - 12, y1: TREBLE_TOP, x2: x - 12, y2: BASS_TOP + 4 * STAFF_SPACE,
          class: 'barline', 'stroke-width': 1,
        }, svg);
      }
      el('text', { x: x - 8, y: TREBLE_TOP - 22, class: 'measure-num' }, svg, String(m.number));
    }
    const endX = this.xForTicks(score.durationTicks);
    el('line', {
      x1: endX, y1: TREBLE_TOP, x2: endX, y2: BASS_TOP + 4 * STAFF_SPACE,
      class: 'barline', 'stroke-width': 3,
    }, svg);

    // Group simultaneous notes on the same staff into chords.
    const chordMap = new Map<string, ScoreNote[]>();
    for (const note of score.notes) {
      const key = `${note.staff}:${note.ticks}`;
      let chord = chordMap.get(key);
      if (!chord) chordMap.set(key, (chord = []));
      chord.push(note);
    }
    const chords: ChordInfo[] = [...chordMap.values()]
      .map((notes) => this.layoutChord(notes))
      .sort((a, b) => a.ticks - b.ticks);

    const beams = this.computeBeams(chords, score);
    const beamed = new Map<ChordInfo, Beam>();
    for (const beam of beams) for (const c of beam.chords) beamed.set(c, beam);

    for (const chord of chords) this.drawChord(svg, chord, beamed.get(chord));
    for (const beam of beams) this.drawBeam(svg, beam);

    // Playback cursor.
    this.cursor = el('line', {
      id: 'cursor',
      x1: 0, y1: TREBLE_TOP - 32, x2: 0, y2: BASS_TOP + 4 * STAFF_SPACE + 24,
      transform: 'translate(-10 0)',
    }, svg);
  }

  private drawStaffLines(svg: SVGElement, x1: number, x2: number): void {
    for (const top of [TREBLE_TOP, BASS_TOP]) {
      for (let i = 0; i < 5; i++) {
        const y = top + i * STAFF_SPACE;
        el('line', { x1, y1: y, x2, y2: y, class: 'staff-line', 'stroke-width': 1 }, svg);
      }
    }
  }

  private layoutChord(notes: ScoreNote[]): ChordInfo {
    const score = this.score!;
    const staff = notes[0].staff;
    notes.sort((a, b) => a.step - b.step);
    const maxDur = Math.max(...notes.map((n) => n.durationTicks));
    const middleStep = staff === 'treble' ? 34 : 22; // B4 / D3 (middle line)
    const avgStep = notes.reduce((s, n) => s + n.step, 0) / notes.length;
    return {
      notes,
      staff,
      ticks: notes[0].ticks,
      x: this.xForTicks(notes[0].ticks),
      dur: classifyDuration(maxDur / score.ppq),
      stemUpDefault: avgStep < middleStep,
    };
  }

  /**
   * Group runs of flagged chords into beams: same staff, same flag count,
   * inside the same beat (dotted-quarter beats for x/8 meters, otherwise the
   * meter's denominator beat), with nothing else in between.
   */
  private computeBeams(chords: ChordInfo[], score: Score): Beam[] {
    // Beat-unit index for every chord (chords are sorted by ticks, so the
    // measure/time-signature pointers only ever move forward).
    let m = 0;
    let t = 0;
    for (const chord of chords) {
      while (m + 1 < score.measures.length && score.measures[m + 1].ticks <= chord.ticks) m++;
      while (t + 1 < score.timeSignatures.length && score.timeSignatures[t + 1].ticks <= chord.ticks) t++;
      const den = score.timeSignatures[t].denominator;
      const beatTicks = den >= 8 ? score.ppq * 1.5 : score.ppq * (4 / den);
      chord.unit =
        m * 256 + Math.floor((chord.ticks - score.measures[m].ticks) / beatTicks);
    }

    const beams: Beam[] = [];
    for (const staff of ['treble', 'bass'] as const) {
      const seq = chords.filter((c) => c.staff === staff);
      let run: ChordInfo[] = [];
      const flush = () => {
        if (run.length >= 2) beams.push(this.buildBeam(run));
        run = [];
      };
      for (const chord of seq) {
        if (chord.dur.flags === 0) {
          flush();
          continue;
        }
        if (
          run.length > 0 &&
          (chord.dur.flags !== run[0].dur.flags || chord.unit !== run[0].unit)
        ) {
          flush();
        }
        run.push(chord);
      }
      flush();
    }
    return beams;
  }

  private buildBeam(chords: ChordInfo[]): Beam {
    const staff = chords[0].staff;
    const middleStep = staff === 'treble' ? 34 : 22;
    const steps = chords.flatMap((c) => c.notes.map((n) => n.step));
    const stemUp = steps.reduce((a, b) => a + b, 0) / steps.length < middleStep;

    const stemXOf = (c: ChordInfo) => (stemUp ? c.x + HEAD_W - 0.7 : c.x + 0.7);
    // Ideal stem-tip y for each chord (a full stem beyond the outermost head).
    const tipOf = (c: ChordInfo) => {
      const ys = c.notes.map((n) => this.yFor(n.step, staff));
      return stemUp ? Math.min(...ys) - STEM_LEN : Math.max(...ys) + STEM_LEN;
    };

    const first = chords[0];
    const last = chords[chords.length - 1];
    const x0 = stemXOf(first);
    const x1 = stemXOf(last);
    // Gentle slope through the outer chords, limited to one staff space.
    const rise = Math.max(-STAFF_SPACE, Math.min(STAFF_SPACE, tipOf(last) - tipOf(first)));
    const slope = x1 > x0 ? rise / (x1 - x0) : 0;
    let y0 = tipOf(first);

    // Shift the beam so every stem keeps a decent minimum length.
    const minStem = 2.5 * STAFF_SPACE;
    for (const c of chords) {
      const yAt = y0 + slope * (stemXOf(c) - x0);
      const headYs = c.notes.map((n) => this.yFor(n.step, staff));
      if (stemUp) {
        const limit = Math.min(...headYs) - minStem;
        if (yAt > limit) y0 -= yAt - limit;
      } else {
        const limit = Math.max(...headYs) + minStem;
        if (yAt < limit) y0 += limit - yAt;
      }
    }
    return { chords, stemUp, x0, y0, slope, flags: chords[0].dur.flags };
  }

  private drawBeam(svg: SVGElement, beam: Beam): void {
    const { stemUp, x0, y0, slope } = beam;
    const first = beam.chords[0];
    const last = beam.chords[beam.chords.length - 1];
    const sx0 = stemUp ? first.x + HEAD_W - 0.7 : first.x + 0.7;
    const sx1 = stemUp ? last.x + HEAD_W - 0.7 : last.x + 0.7;
    const yAt = (sx: number) => y0 + slope * (sx - x0);
    const t = stemUp ? BEAM_THICKNESS : -BEAM_THICKNESS;
    for (let b = 0; b < beam.flags; b++) {
      // Second/third beams stack toward the noteheads.
      const off = stemUp ? b * (BEAM_THICKNESS + 2.5) : -b * (BEAM_THICKNESS + 2.5);
      const points = [
        `${sx0 - 0.8},${yAt(sx0) + off}`,
        `${sx1 + 0.8},${yAt(sx1) + off}`,
        `${sx1 + 0.8},${yAt(sx1) + off + t}`,
        `${sx0 - 0.8},${yAt(sx0) + off + t}`,
      ].join(' ');
      el('polygon', { points, class: 'beam' }, svg);
    }
  }

  private drawChord(svg: SVGElement, chord: ChordInfo, beam?: Beam): void {
    const { notes, staff, x, dur } = chord;
    const stemUp = beam ? beam.stemUp : chord.stemUpDefault;

    // Noteheads a second apart sit on opposite sides of the stem.
    const flipped: boolean[] = notes.map(() => false);
    for (let i = 1; i < notes.length; i++) {
      if (notes[i].step - notes[i - 1].step <= 1 && !flipped[i - 1]) flipped[i] = true;
    }

    const stemX = stemUp ? x + HEAD_W - 0.7 : x + 0.7;
    const headXs = notes.map((_, i) => {
      if (!flipped[i]) return x;
      return stemUp ? stemX : stemX - HEAD_W; // flipped heads cross the stem
    });

    // Ledger lines.
    for (let i = 0; i < notes.length; i++) {
      this.drawLedgers(svg, notes[i], headXs[i]);
    }

    // Stem spanning the chord (up to the beam when part of one).
    if (dur.hasStem) {
      const ys = notes.map((n) => this.yFor(n.step, staff));
      const yLow = Math.max(...ys);
      const yHigh = Math.min(...ys);
      const stemY1 = stemUp ? yLow : yHigh;
      const stemY2 = beam
        ? beam.y0 + beam.slope * (stemX - beam.x0)
        : stemUp
          ? yHigh - STEM_LEN
          : yLow + STEM_LEN;
      el('line', { x1: stemX, y1: stemY1, x2: stemX, y2: stemY2, class: 'stem' }, svg);
      if (!beam && dur.flags > 0) {
        const flagGlyph = (stemUp ? GLYPH.flagUp : GLYPH.flagDown)[dur.flags - 1];
        glyphText(svg, flagGlyph, stemX, stemY2, 'smufl flag');
      }
    }

    // Heads, accidentals, dots — one group per note so practice feedback
    // can color notes individually.
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const y = this.yFor(note.step, staff);
      const group = el('g', { class: 'note', 'data-id': note.id }, svg);
      glyphText(group, dur.head, headXs[i], y);
      if (note.accidental) {
        const accGlyph =
          note.accidental === 'sharp' ? GLYPH.sharp
          : note.accidental === 'flat' ? GLYPH.flat
          : GLYPH.natural;
        glyphText(group, accGlyph, x - 12, y);
      }
      if (dur.dotted) {
        const dotY = (y - (staff === 'treble' ? TREBLE_TOP : BASS_TOP)) % STAFF_SPACE === 0 ? y - HALF_STEP : y;
        glyphText(group, GLYPH.dot, x + HEAD_W + 4 + (flipped[i] && stemUp ? HEAD_W : 0), dotY);
      }
      this.noteGroups[note.id] = group;
    }
  }

  private drawLedgers(svg: SVGElement, note: ScoreNote, headX: number): void {
    const top = note.staff === 'treble' ? TREBLE_TOP : BASS_TOP;
    const bottom = top + 4 * STAFF_SPACE;
    const y = this.yFor(note.step, note.staff);
    const onLine = y % STAFF_SPACE === 0;
    const x1 = headX - 4;
    const x2 = headX + HEAD_W + 4;
    // Ledger lines between the staff and the note; a note in a space gets
    // lines only up to the adjacent line position.
    for (let ly = top - STAFF_SPACE; ly >= (onLine ? y : y + HALF_STEP); ly -= STAFF_SPACE) {
      el('line', { x1, y1: ly, x2, y2: ly, class: 'ledger', 'stroke-width': 1.4 }, svg);
    }
    for (let ly = bottom + STAFF_SPACE; ly <= (onLine ? y : y - HALF_STEP); ly += STAFF_SPACE) {
      el('line', { x1, y1: ly, x2, y2: ly, class: 'ledger', 'stroke-width': 1.4 }, svg);
    }
  }

  // ------------------------------------------------------------------
  // Live updates
  // ------------------------------------------------------------------
  setCursorTicks(ticks: number): number {
    const x = this.xForTicks(ticks);
    this.cursor?.setAttribute('transform', `translate(${x.toFixed(1)} 0)`);
    return x;
  }

  applyNoteState(note: ScoreNote): void {
    const group = this.noteGroups[note.id];
    if (group) group.setAttribute('class', note.state === 'idle' ? 'note' : `note ${note.state}`);
  }

  refreshAllStates(): void {
    if (!this.score) return;
    for (const note of this.score.notes) this.applyNoteState(note);
  }
}
