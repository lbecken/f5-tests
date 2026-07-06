import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScrollFades {
  start: boolean;
  end: boolean;
}

/**
 * Tracks whether a scroll container is scrolled away from its start/end on
 * the given axis, so edge-fade hints can be shown only where more content
 * actually exists. Re-evaluates on scroll and on resize (of both the
 * container and its content).
 */
export function useScrollFades<T extends HTMLElement>(axis: 'x' | 'y') {
  const ref = useRef<T | null>(null);
  const [fades, setFades] = useState<ScrollFades>({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pos = axis === 'x' ? el.scrollLeft : el.scrollTop;
    const max =
      axis === 'x'
        ? el.scrollWidth - el.clientWidth
        : el.scrollHeight - el.clientHeight;
    const next = { start: pos > 1, end: pos < max - 1 };
    setFades((prev) =>
      prev.start === next.start && prev.end === next.end ? prev : next,
    );
  }, [axis]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [update]);

  return { ref, fades };
}
