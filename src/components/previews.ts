import { useEffect, useRef, useState } from "react";
import {
  convertToExcalidrawElements,
  exportToSvg,
} from "@excalidraw/excalidraw";
import type { Skeleton } from "../stencils/types";

const cache = new Map<string, string>();

/** Renders a skeleton to standalone SVG markup, cached by key + theme. */
export async function renderSkeletonPreview(
  key: string,
  elements: Skeleton[],
  dark: boolean,
): Promise<string> {
  const cacheKey = `${key}:${dark ? "dark" : "light"}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const svg = await exportToSvg({
    elements: convertToExcalidrawElements(elements),
    appState: {
      exportBackground: false,
      exportWithDarkMode: dark,
      exportEmbedScene: false,
    },
    files: null,
    exportPadding: 6,
  });
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const html = svg.outerHTML;
  cache.set(cacheKey, html);
  return html;
}

/** React hook wrapper around renderSkeletonPreview. */
export function useSkeletonPreview(
  key: string,
  elements: Skeleton[],
  dark: boolean,
): string {
  const [svg, setSvg] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    renderSkeletonPreview(key, elements, dark).then((html) => {
      if (alive.current) setSvg(html);
    });
    return () => {
      alive.current = false;
    };
  }, [key, elements, dark]);
  return svg;
}
