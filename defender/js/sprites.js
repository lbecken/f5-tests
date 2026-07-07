// sprites.js — pixel-art sprites baked to offscreen canvases at boot.
// Each sprite is a string grid; characters index into its palette.
// '.' is transparent.

const SPRITE_DEFS = {
  ship: {
    palette: { 1: '#ffffff', 2: '#f03030', 3: '#b0b8c8', 4: '#40d0ff' },
    rows: [
      '....11..........',
      '....133.........',
      '2233333311111111',
      '.224444444443331',
      '2233333311111111',
      '....133.........',
      '....11..........',
    ],
  },
  lander: {
    palette: { 1: '#30e030', 2: '#108010', 3: '#ffe040', 4: '#ffffff' },
    rows: [
      '...1...1...',
      '....1.1....',
      '..1111111..',
      '.112222211.',
      '11223432211',
      '.112222211.',
      '..1111111..',
      '..2..2..2..',
      '.2...2...2.',
    ],
  },
  mutant: {
    palette: { 1: '#ff40ff', 2: '#801080', 3: '#30ff30', 4: '#ffffff' },
    rows: [
      '...1...1...',
      '....1.1....',
      '..1111111..',
      '.112222211.',
      '11223432211',
      '.112222211.',
      '..1111111..',
      '..2..2..2..',
      '.2...2...2.',
    ],
  },
  humanoid: {
    palette: { 1: '#d0a0ff', 2: '#ffffff', 3: '#9060c0' },
    rows: [
      '.2.',
      '111',
      '.1.',
      '111',
      '.1.',
      '3.3',
      '3.3',
    ],
  },
  bomber: {
    palette: { 1: '#4060ff', 2: '#90b0ff', 3: '#ffffff' },
    rows: [
      '....11....',
      '...1221...',
      '..122221..',
      '.12233221.',
      '..122221..',
      '...1221...',
      '....11....',
    ],
  },
  pod: {
    palette: { 1: '#c040ff', 2: '#7020a0', 3: '#ffffff' },
    rows: [
      '..111..',
      '.12221.',
      '1223221',
      '.12221.',
      '..111..',
    ],
  },
  swarmer: {
    palette: { 1: '#ff8020', 2: '#ff2020', 3: '#ffff80' },
    rows: [
      '.11.',
      '1331',
      '1331',
      '.22.',
    ],
  },
  baiter: {
    palette: { 1: '#c0ff20', 2: '#608010', 3: '#ffffff' },
    rows: [
      '...1111...',
      '.11333311.',
      '1122222211',
      '.11333311.',
      '...1111...',
    ],
  },
  mine: {
    palette: { 1: '#ff4040', 2: '#ffffff' },
    rows: [
      '.1.',
      '121',
      '.1.',
    ],
  },
};

// Bake every sprite (and a horizontally flipped copy) to canvases.
function bakeSprites() {
  const out = {};
  for (const [name, def] of Object.entries(SPRITE_DEFS)) {
    const h = def.rows.length, w = def.rows[0].length;
    for (const flip of [false, true]) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ch = def.rows[y][flip ? w - 1 - x : x];
          if (ch === '.') continue;
          g.fillStyle = def.palette[ch];
          g.fillRect(x, y, 1, 1);
        }
      }
      out[flip ? name + '_flip' : name] = c;
    }
  }
  return out;
}
