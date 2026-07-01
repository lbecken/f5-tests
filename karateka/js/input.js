/* input.js — keyboard state: held keys + one-frame "just pressed" edge detection. */
const Input = (() => {
  const down = new Set();
  const pressed = new Set();

  const TRACKED = new Set([
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter",
    "KeyU", "KeyI", "KeyO", "KeyJ", "KeyK", "KeyL",
  ]);

  window.addEventListener("keydown", (e) => {
    AudioFX.unlock();
    if (!TRACKED.has(e.code)) return;
    e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });

  window.addEventListener("keyup", (e) => {
    down.delete(e.code);
  });

  window.addEventListener("blur", () => down.clear());

  return {
    held: (code) => down.has(code),
    justPressed: (code) => pressed.has(code),
    endFrame: () => pressed.clear(),
  };
})();
