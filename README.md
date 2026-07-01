# Elara Vane — Designer Portfolio Landing Page

A modern, motion-driven landing page for a fictional UI/UX designer, built with
**Three.js** (WebGL flow-field hero background) and **GSAP + ScrollTrigger**
(preloader, split-text reveals, scroll choreography).

## Run it

No build step — it's a static site. Serve the folder and open it:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

(A server is required because the JS is loaded as an ES module.)

## Highlights

- **WebGL hero** — domain-warped simplex-noise shader with mouse-reactive
  distortion, DPR capped per device, paused when off-screen or tab-hidden
- **GSAP choreography** — counting preloader, masked char/line reveals,
  scrubbed word-by-word about statement, count-up stats, infinite marquee
- **Custom cursor** — dot + trailing ring with hover/"View" states,
  fine-pointer devices only
- **Mobile-friendly** — responsive layout, full-screen animated menu,
  no horizontal overflow at 390px, touch-safe interactions
- **Accessible touches** — `prefers-reduced-motion` renders a static hero
  frame and skips animations; ARIA states on the menu toggle
- **Fully self-contained** — GSAP, Three.js and fonts (Syne + Inter) are
  vendored locally; no CDN or network dependency

## Structure

```
index.html      Markup for all sections
css/style.css   Design tokens, layout, generative CSS project covers
js/main.js      Three.js shader + GSAP animations
vendor/         gsap, ScrollTrigger, three (module build)
fonts/          Self-hosted woff2 (Syne, Inter)
```
