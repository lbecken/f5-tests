/* fighter.js — a fighter (player or enemy): state machine, movement,
 * attack timing/hit windows, animation playback with pose blending. */

const ATTACKS = {
  punch_high: { anim: "punch_high", height: "high", dmg: 1,   limb: "handN", active: [0.42, 0.66] },
  punch_mid:  { anim: "punch_mid",  height: "mid",  dmg: 1,   limb: "handN", active: [0.42, 0.66] },
  punch_low:  { anim: "punch_low",  height: "low",  dmg: 1,   limb: "handN", active: [0.42, 0.66] },
  kick_high:  { anim: "kick_high",  height: "high", dmg: 2,   limb: "toeN",  active: [0.42, 0.68] },
  kick_mid:   { anim: "kick_mid",   height: "mid",  dmg: 2,   limb: "toeN",  active: [0.42, 0.68] },
  kick_low:   { anim: "kick_low",   height: "low",  dmg: 1.5, limb: "toeN",  active: [0.42, 0.66] },
};

const BLEND_TIME = 0.12; // seconds to blend into a new animation

class Fighter {
  constructor(opts) {
    this.x = opts.x;
    this.facing = opts.facing || 1;
    this.colors = opts.colors;
    this.hpMax = opts.hpMax;
    this.hp = opts.hpMax;
    this.isPlayer = !!opts.isPlayer;
    this.speedWalk = opts.speedWalk || 55;
    this.speedRun = opts.speedRun || 150;

    this.stance = opts.stance || "fight"; // 'travel' | 'fight'
    this.state = "idle"; // idle | move | attack | hit | block | ko | bow | victory
    this.vx = 0;
    this.attack = null;   // current ATTACKS entry
    this.hasHit = false;  // current attack already connected / was blocked
    this.regenT = 0;
    this.stepPhase = 0;

    this.anim = null;
    this.animT = 0;
    this.pose = Anim.sample(this.stance === "fight" ? "fight_idle" : "travel_idle", 0);
    this.prevPose = null;
    this.blendT = 1;
    this.setAnim(this.stance === "fight" ? "fight_idle" : "travel_idle");
    this.pts = null;
  }

  /* Turn to face dir (+1/-1), blending through a neutral upright pose so the
   * horizontal mirror flip doesn't visually pop. */
  turnTo(dir) {
    if (this.facing === dir) return;
    this.facing = dir;
    this.prevPose = Anim.sample("travel_idle", 0);
    this.blendT = 0;
  }

  setAnim(name, restart = false) {
    if (this.anim === name && !restart) return;
    this.prevPose = this.pose;
    this.blendT = 0;
    this.anim = name;
    this.animT = 0;
  }

  get busy() {
    return this.state === "attack" || this.state === "hit" || this.state === "block" || this.state === "ko";
  }

  startAttack(key) {
    if (this.busy || this.stance !== "fight") return false;
    this.attack = ATTACKS[key];
    this.state = "attack";
    this.hasHit = false;
    this.setAnim(this.attack.anim, true);
    AudioFX.whoosh();
    return true;
  }

  /* True while the current attack's strike window is open. */
  attackActive() {
    if (this.state !== "attack" || this.hasHit) return false;
    const u = this.animT / Anim.defs[this.attack.anim].dur;
    return u >= this.attack.active[0] && u <= this.attack.active[1];
  }

  strikePoint() {
    return this.pts ? this.pts[this.attack.limb] : null;
  }

  takeHit(attack, fromX) {
    if (this.state === "ko") return;
    this.hp = Math.max(0, this.hp - attack.dmg);
    this.regenT = 0;
    const push = 13 * (this.x >= fromX ? 1 : -1);
    this.x += push;
    if (this.hp <= 0) {
      this.knockOut();
    } else {
      this.state = "hit";
      this.attack = null;
      this.setAnim(attack.height === "high" ? "hit_high" : "hit_mid", true);
    }
  }

  knockOut() {
    this.hp = 0;
    this.state = "ko";
    this.attack = null;
    this.setAnim("ko", true);
    AudioFX.ko();
  }

  playBlock() {
    this.state = "block";
    this.attack = null;
    this.setAnim("block", true);
  }

  /* move: -1/0/+1 desired direction (in facing-independent world coords). */
  update(dt, move) {
    // finish timed one-shot states
    if ((this.state === "attack" || this.state === "hit" || this.state === "block") &&
        this.animT >= Anim.defs[this.anim].dur) {
      this.state = "idle";
      this.attack = null;
      this.setAnim(this.stance === "fight" ? "fight_idle" : "travel_idle");
    }

    if (this.state === "idle" || this.state === "move") {
      if (move !== 0) {
        const speed = this.stance === "travel"
          ? this.speedRun                                          // travel: facing follows movement, always a run
          : this.speedWalk * (move * this.facing > 0 ? 1 : 0.75);  // fight stance: shuffle, backward slightly slower
        this.vx = move * speed;
        this.state = "move";
        this.setAnim(this.stance === "travel"
          ? (Math.abs(this.vx) >= this.speedRun ? "run" : "walk")
          : "fight_step");
      } else {
        this.vx = 0;
        this.state = "idle";
        this.setAnim(this.stance === "fight" ? "fight_idle" : "travel_idle");
      }
    } else {
      this.vx = 0;
    }

    this.x += this.vx * dt;

    // footstep sounds keyed to the walk/run cycle
    const def = Anim.defs[this.anim];
    if (def.steps && this.state === "move") {
      const u0 = (this.animT / def.dur) % 1;
      const u1 = ((this.animT + dt) / def.dur) % 1;
      for (const s of def.steps) {
        if ((u0 < s && u1 >= s) || (u1 < u0 && (s >= u0 || s < u1))) AudioFX.step();
      }
    }

    // slow vitality regeneration while unhurt and idle (like the original's rest mechanic)
    if (this.state === "idle" && this.hp > 0 && this.hp < this.hpMax) {
      this.regenT += dt;
      if (this.regenT > 2.2) { this.hp = Math.min(this.hpMax, this.hp + 1); this.regenT = 0; }
    }

    this.animT += dt;
    this.blendT += dt;

    const target = Anim.sample(this.anim, this.animT);
    this.pose = (this.blendT < BLEND_TIME && this.prevPose)
      ? Anim.lerpPose(this.prevPose, target, this.blendT / BLEND_TIME)
      : target;
  }

  solve(groundY) {
    this.pts = Rig.solve(this.pose, this.x, groundY, this.facing);
    return this.pts;
  }

  draw(ctx) {
    Rig.draw(ctx, this.pts, this.colors, this.facing);
  }
}
