/* level.js — the fortress: layered parallax background, floor, columns with
 * flickering torches, entrance gate, and the princess's chamber at the end. */

const Level = (() => {
  const WIDTH = 7000;      // world width in px
  const GROUND = 236;      // floor line (internal resolution is 480x270)

  function skyGradient(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, "#1b1030");
    g.addColorStop(0.45, "#4a1f3d");
    g.addColorStop(0.8, "#a34a2a");
    g.addColorStop(1, "#d98a3d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, GROUND);
  }

  // deterministic pseudo-random for scenery placement
  const hash = (n) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };

  function mountains(ctx, camX, w) {
    ctx.fillStyle = "#2a1530";
    const par = 0.15;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (let x = -20; x <= w + 20; x += 20) {
      const wx = (x + camX * par) / 90;
      const hgt = 55 + Math.sin(wx) * 22 + Math.sin(wx * 2.7) * 12;
      ctx.lineTo(x, GROUND - 60 - hgt);
    }
    ctx.lineTo(w, GROUND);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#3d1c33";
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    const par2 = 0.3;
    for (let x = -20; x <= w + 20; x += 16) {
      const wx = (x + camX * par2) / 60;
      const hgt = 30 + Math.sin(wx * 1.3 + 5) * 18 + Math.sin(wx * 3.1) * 8;
      ctx.lineTo(x, GROUND - 35 - hgt);
    }
    ctx.lineTo(w, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  // Fortress wall silhouette with crenellations (mid parallax layer).
  function fortressWall(ctx, camX, w) {
    const par = 0.55;
    ctx.fillStyle = "#4a2226";
    const top = GROUND - 72;
    ctx.fillRect(0, top, w, 72);
    ctx.fillStyle = "#57292c";
    const seg = 26;
    const off = -((camX * par) % seg);
    for (let x = off - seg; x < w + seg; x += seg) {
      ctx.fillRect(x, top - 8, seg * 0.55, 8); // crenellation teeth
    }
    // faint arches
    ctx.fillStyle = "#3c1c21";
    const aseg = 110;
    const aoff = -((camX * par) % aseg);
    for (let x = aoff - aseg; x < w + aseg; x += aseg) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND);
      ctx.lineTo(x, top + 34);
      ctx.arc(x + 22, top + 34, 22, Math.PI, 0);
      ctx.lineTo(x + 44, GROUND);
      ctx.closePath();
      ctx.fill();
    }
  }

  function floor(ctx, camX, w) {
    ctx.fillStyle = "#6b4a33";
    ctx.fillRect(0, GROUND, w, 270 - GROUND);
    ctx.fillStyle = "#593c29";
    ctx.fillRect(0, GROUND, w, 3);
    // stone slab seams
    ctx.strokeStyle = "#593c29";
    ctx.lineWidth = 1;
    const seg = 42;
    const off = -(camX % seg);
    for (let x = off - seg; x < w + seg; x += seg) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND + 3);
      ctx.lineTo(x - 8, 270);
      ctx.stroke();
    }
  }

  // Foreground columns with animated torch flames (full parallax = playfield).
  function columns(ctx, camX, w, time) {
    const seg = 240;
    const first = Math.floor(camX / seg) * seg;
    for (let wx = first - seg; wx < camX + w + seg; wx += seg) {
      const x = wx - camX;
      const n = wx / seg;
      if (hash(n) < 0.25) continue; // occasional gap
      ctx.fillStyle = "#3a1e22";
      ctx.fillRect(x - 7, GROUND - 150, 14, 150);
      ctx.fillStyle = "#4e282c";
      ctx.fillRect(x - 7, GROUND - 150, 4, 150);
      ctx.fillStyle = "#2c161a";
      ctx.fillRect(x - 10, GROUND - 156, 20, 7);
      ctx.fillRect(x - 9, GROUND - 4, 18, 4);
      // torch bracket + flame
      const fy = GROUND - 108;
      ctx.fillStyle = "#222";
      ctx.fillRect(x + 6, fy, 3, 10);
      const flick = Math.sin(time * 13 + n * 7) * 1.5 + Math.sin(time * 29 + n * 3);
      const grd = ctx.createRadialGradient(x + 7.5, fy - 4, 1, x + 7.5, fy - 4, 10);
      grd.addColorStop(0, "rgba(255,220,120,0.9)");
      grd.addColorStop(1, "rgba(255,120,20,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x + 7.5, fy - 4, 9 + flick, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd870";
      ctx.beginPath();
      ctx.ellipse(x + 7.5, fy - 4 + flick * 0.3, 2.2, 4.5 + flick * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The princess's dais at the end of the level.
  function chamber(ctx, camX, princessX) {
    const x = princessX - camX;
    if (x < -120 || x > 600) return;
    ctx.fillStyle = "#7a2230";
    ctx.fillRect(x - 46, GROUND - 6, 110, 6); // dais
    ctx.fillStyle = "#8f2a3a";
    ctx.fillRect(x - 40, GROUND - 10, 98, 4);
    // hanging banners
    ctx.fillStyle = "#801d2e";
    ctx.fillRect(x - 34, GROUND - 160, 12, 92);
    ctx.fillRect(x + 42, GROUND - 160, 12, 92);
    ctx.fillStyle = "#e0b13e";
    ctx.fillRect(x - 34, GROUND - 160, 12, 4);
    ctx.fillRect(x + 42, GROUND - 160, 12, 4);
  }

  /* Princess: rig pose wrapped in a kimono, drawn over the skeleton. */
  function drawPrincess(ctx, fighter) {
    const pts = fighter.pts;
    // kimono: trapezoid from shoulders to the ground
    ctx.fillStyle = "#c94f6d";
    ctx.beginPath();
    ctx.moveTo(pts.neck.x - 6 * fighter.facing, pts.neck.y + 2);
    ctx.lineTo(pts.neck.x + 6 * fighter.facing, pts.neck.y + 2);
    ctx.lineTo(pts.hip.x + 12 * fighter.facing, pts.hip.y + Rig.HIP_STAND);
    ctx.lineTo(pts.hip.x - 12 * fighter.facing, pts.hip.y + Rig.HIP_STAND);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a83a56";
    ctx.fillRect(pts.hip.x - 7, pts.hip.y - 4, 14, 5); // obi sash
    // arms
    Rig.draw && null;
    ctx.strokeStyle = "#c94f6d";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(pts.shoulder.x, pts.shoulder.y); ctx.lineTo(pts.elbowN.x, pts.elbowN.y); ctx.lineTo(pts.handN.x, pts.handN.y); ctx.stroke();
    // head + long hair
    ctx.fillStyle = "#e8c39e";
    ctx.beginPath(); ctx.arc(pts.head.x, pts.head.y, Rig.L.headR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1114";
    ctx.beginPath();
    ctx.arc(pts.head.x, pts.head.y - 1, Rig.L.headR + 1, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    ctx.fillRect(pts.head.x - (Rig.L.headR + 1) * fighter.facing - (fighter.facing === 1 ? 0 : -1), pts.head.y - 2, 3, 20);
  }

  function draw(ctx, camX, w, time, princessX) {
    skyGradient(ctx, w, 270);
    // low sun
    ctx.fillStyle = "#f2b04a";
    ctx.beginPath();
    ctx.arc(w * 0.72 - camX * 0.05, GROUND - 88, 16, 0, Math.PI * 2);
    ctx.fill();
    mountains(ctx, camX, w);
    fortressWall(ctx, camX, w);
    floor(ctx, camX, w);
    chamber(ctx, camX, princessX);
    columns(ctx, camX, w, time);
  }

  return { WIDTH, GROUND, draw, drawPrincess };
})();
