import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Serve Excalidraw's fonts from our own origin (copied by vite.config.ts)
// instead of its CDN fallback, so the app works fully offline.
window.EXCALIDRAW_ASSET_PATH = "/";

createRoot(document.getElementById("root")!).render(<App />);
