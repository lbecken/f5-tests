/* ============================================================
   Elara Vane — Portfolio
   Three.js flow-field hero + GSAP scroll choreography
   ============================================================ */

import * as THREE from '../vendor/three.module.min.js';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ------------------------------------------------------------
   Text splitting (lines + chars) — lightweight SplitText stand-in
   ------------------------------------------------------------ */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  el.setAttribute('aria-hidden', 'true');
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'split-char';
    span.textContent = ch === ' ' ? ' ' : ch;
    frag.appendChild(span);
  }
  el.appendChild(frag);
  return el.querySelectorAll('.split-char');
}

function splitLines(el) {
  // Treat <br> boundaries as lines; wrap each in a masked block.
  const lines = el.innerHTML.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
  el.innerHTML = lines
    .map((line) => `<span class="split-line"><span>${line}</span></span>`)
    .join('');
  return el.querySelectorAll('.split-line > span');
}

document.querySelectorAll('[data-split="chars"]').forEach(splitChars);
document.querySelectorAll('[data-split="lines"]').forEach(splitLines);

/* ------------------------------------------------------------
   Three.js — hero flow-field shader background
   ------------------------------------------------------------ */
function initWebGL() {
  const canvas = document.getElementById('webgl');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  } catch (err) {
    canvas.style.display = 'none';
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;

      // --- simplex noise (Ashima) ---
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m; m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x  = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.55;
        for (int i = 0; i < 4; i++) {
          v += a * snoise(p);
          p = p * 2.1 + 13.7;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        vec2 p = uv;
        p.x *= uResolution.x / uResolution.y;

        float t = uTime * 0.08;
        vec2 m = uMouse;
        m.x *= uResolution.x / uResolution.y;

        // Domain-warped flow field
        vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t * 0.7 + 4.2));
        float mouseWell = 0.35 * exp(-3.5 * distance(p, m));
        float f = fbm(p * 1.6 + q * 1.3 + mouseWell);

        // Palette: near-black base, violet mid, lime highlights
        vec3 base   = vec3(0.043, 0.043, 0.063);
        vec3 violet = vec3(0.29, 0.22, 0.62);
        vec3 lime   = vec3(0.776, 0.961, 0.259);

        vec3 col = base;
        col = mix(col, violet, smoothstep(-0.15, 0.75, f) * 0.55);
        col = mix(col, lime, smoothstep(0.55, 1.05, f + mouseWell) * 0.5);

        // Fine grain to kill banding
        float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.035;
        col += grain;

        // Vignette so the type stays readable
        float vig = smoothstep(1.25, 0.35, distance(uv, vec2(0.5, 0.42)));
        col *= mix(0.55, 1.0, vig);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const hero = document.getElementById('hero');
  const mouseTarget = new THREE.Vector2(0.5, 0.5);

  function resize() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w * dpr, h * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  if (isFinePointer) {
    window.addEventListener('pointermove', (e) => {
      mouseTarget.set(e.clientX / hero.clientWidth, 1 - e.clientY / hero.clientHeight);
    });
  }

  const startTime = performance.now();
  let heroVisible = true;
  let pageVisible = !document.hidden;

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
  }).observe(hero);

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
  });

  function render() {
    if (heroVisible && pageVisible) {
      uniforms.uTime.value = (performance.now() - startTime) / 1000;
      uniforms.uMouse.value.lerp(mouseTarget, 0.05);
      renderer.render(scene, camera);
    }
    if (!prefersReducedMotion) requestAnimationFrame(render);
  }

  // Reduced motion: draw a single static frame.
  uniforms.uTime.value = 12.0;
  renderer.render(scene, camera);
  if (!prefersReducedMotion) requestAnimationFrame(render);
}

initWebGL();

/* ------------------------------------------------------------
   Custom cursor
   ------------------------------------------------------------ */
if (isFinePointer && !prefersReducedMotion) {
  const cursor = document.getElementById('cursor');
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

  window.addEventListener('pointermove', (e) => {
    dotX(e.clientX); dotY(e.clientY);
    ringX(e.clientX); ringY(e.clientY);
  });

  document.querySelectorAll('[data-cursor]').forEach((el) => {
    const mode = el.dataset.cursor === 'view' ? 'is-view' : 'is-hover';
    el.addEventListener('pointerenter', () => cursor.classList.add(mode));
    el.addEventListener('pointerleave', () => cursor.classList.remove(mode));
  });
}

/* ------------------------------------------------------------
   Mobile menu
   ------------------------------------------------------------ */
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
let menuOpen = false;

const menuTl = gsap.timeline({ paused: true })
  .set(menu, { visibility: 'visible' })
  .to(menu, { clipPath: 'inset(0% 0 0% 0)', duration: 0.7, ease: 'power4.inOut' })
  .from(menu.querySelectorAll('.menu__link'), {
    yPercent: 60, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power3.out',
  }, '-=0.25')
  .from(menu.querySelector('.menu__foot'), { opacity: 0, duration: 0.4 }, '-=0.3');

function toggleMenu(force) {
  menuOpen = force !== undefined ? force : !menuOpen;
  burger.classList.toggle('is-open', menuOpen);
  burger.setAttribute('aria-expanded', String(menuOpen));
  menu.setAttribute('aria-hidden', String(!menuOpen));
  document.body.classList.toggle('is-locked', menuOpen);
  menuOpen ? menuTl.timeScale(1).play() : menuTl.timeScale(1.6).reverse();
}

burger.addEventListener('click', () => toggleMenu());
menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggleMenu(false)));

/* ------------------------------------------------------------
   Preloader + hero intro
   ------------------------------------------------------------ */
const preloader = document.getElementById('preloader');
const counter = { value: 0 };
document.body.classList.add('is-locked');

const heroIntro = gsap.timeline({ paused: true })
  .from('.hero__title .split-char', {
    yPercent: 110, duration: 1, stagger: 0.045, ease: 'power4.out',
  })
  .from('.hero__eyebrow .split-line > span, .hero__tagline .split-line > span, .hero__location .split-line > span', {
    yPercent: 110, duration: 0.8, stagger: 0.08, ease: 'power3.out',
  }, '-=0.6')
  .from('.header, .hero__scroll', { opacity: 0, y: -12, duration: 0.6, ease: 'power2.out' }, '-=0.4');

const preloadTl = gsap.timeline({
  onComplete() {
    preloader.style.display = 'none';
    document.body.classList.remove('is-locked');
    ScrollTrigger.refresh();
  },
});

preloadTl
  .to(counter, {
    value: 100,
    duration: prefersReducedMotion ? 0.01 : 1.4,
    ease: 'power2.inOut',
    onUpdate() {
      document.getElementById('preloaderCount').textContent = Math.round(counter.value);
    },
  })
  .to(preloader, {
    yPercent: -100,
    duration: prefersReducedMotion ? 0.01 : 0.8,
    ease: 'power4.inOut',
  }, '+=0.15')
  .add(() => heroIntro.play(), '-=0.55');

/* ------------------------------------------------------------
   Marquee — endless loop
   ------------------------------------------------------------ */
if (!prefersReducedMotion) {
  gsap.to('#marqueeTrack', {
    xPercent: -50,
    duration: 22,
    ease: 'none',
    repeat: -1,
  });
}

/* ------------------------------------------------------------
   Scroll choreography
   ------------------------------------------------------------ */

// Section headers: masked line reveals
document.querySelectorAll('.section__label, .section__title').forEach((el) => {
  const targets = el.querySelectorAll('.split-line > span');
  if (!targets.length) return;
  gsap.from(targets, {
    yPercent: 110,
    duration: 0.9,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%' },
  });
});

// Project cards: rise + unveil
document.querySelectorAll('.project').forEach((card) => {
  gsap.from(card, {
    y: 70,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 88%' },
  });
  gsap.from(card.querySelector('.project__media'), {
    clipPath: 'inset(12% 6% 12% 6% round 20px)',
    duration: 1.2,
    ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 82%' },
  });
});

// About statement: word-by-word scrubbed reveal
const statement = document.getElementById('aboutStatement');
statement.innerHTML = statement.textContent
  .trim()
  .split(/\s+/)
  .map((w) => `<span class="word">${w}</span>`)
  .join(' ');
gsap.to(statement.querySelectorAll('.word'), {
  opacity: 1,
  stagger: 0.06,
  ease: 'none',
  scrollTrigger: {
    trigger: statement,
    start: 'top 78%',
    end: 'bottom 45%',
    scrub: 0.4,
  },
});

// Stats: count up when visible
document.querySelectorAll('.about__stats strong').forEach((el) => {
  const target = Number(el.dataset.count);
  const obj = { value: 0 };
  gsap.to(obj, {
    value: target,
    duration: prefersReducedMotion ? 0.01 : 1.6,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = Math.round(obj.value); },
    scrollTrigger: { trigger: el, start: 'top 90%' },
  });
});

// Service rows: slide in
gsap.from('.service', {
  y: 50,
  opacity: 0,
  duration: 0.8,
  stagger: 0.1,
  ease: 'power3.out',
  scrollTrigger: { trigger: '.services__list', start: 'top 85%' },
});

// Footer CTA: char reveal
gsap.from('.contact__cta .split-char', {
  yPercent: 110,
  duration: 0.9,
  stagger: 0.04,
  ease: 'power4.out',
  scrollTrigger: { trigger: '.contact__cta', start: 'top 88%' },
});
gsap.from('.contact__grid, .contact__bottom', {
  opacity: 0,
  y: 30,
  duration: 0.8,
  stagger: 0.15,
  ease: 'power2.out',
  scrollTrigger: { trigger: '.contact__grid', start: 'top 92%' },
});

/* ------------------------------------------------------------
   Header background once scrolled past the top
   ------------------------------------------------------------ */
const headerEl = document.getElementById('header');
window.addEventListener('scroll', () => {
  headerEl.classList.toggle('is-scrolled', window.scrollY > 40);
}, { passive: true });

/* ------------------------------------------------------------
   Local time in footer
   ------------------------------------------------------------ */
function tickClock() {
  const el = document.getElementById('localTime');
  const time = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  });
  el.textContent = `AMS ${time}`;
}
tickClock();
setInterval(tickClock, 30000);
