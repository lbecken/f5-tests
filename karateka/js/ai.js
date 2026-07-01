/* ai.js — opponent behaviour: close distance, probe with attacks at random
 * heights, occasionally step back to reset spacing. Aggression and speed
 * scale per opponent so guards get harder as the player advances. */

class EnemyAI {
  constructor(fighter, profile) {
    this.f = fighter;
    this.profile = profile; // { cooldown: [min,max], stepBackChance, engageRange }
    this.cool = 1.2;
    this.retreatT = 0;
  }

  pickAttack() {
    const heights = ["high", "mid", "low"];
    const h = heights[(Math.random() * 3) | 0];
    const kind = Math.random() < 0.6 ? "punch" : "kick";
    return `${kind}_${h}`;
  }

  update(dt, player) {
    const f = this.f;
    if (f.state === "ko" || player.state === "ko") { f.update(dt, 0); return; }

    f.facing = player.x < f.x ? -1 : 1;
    const dist = Math.abs(player.x - f.x);
    const reach = 34;
    let move = 0;

    this.cool -= dt;
    if (this.retreatT > 0) {
      this.retreatT -= dt;
      move = f.facing * -1; // step away
    } else if (dist > reach) {
      move = f.facing;      // close in
    } else if (!f.busy && this.cool <= 0 && player.state !== "ko") {
      f.startAttack(this.pickAttack());
      const [c0, c1] = this.profile.cooldown;
      this.cool = c0 + Math.random() * (c1 - c0);
      if (Math.random() < this.profile.stepBackChance) this.retreatT = 0.35;
    }

    f.update(dt, f.busy ? 0 : move);
  }
}
