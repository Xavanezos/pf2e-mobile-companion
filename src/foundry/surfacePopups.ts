// Foundry mounts popout windows (roll dialogs, target pickers, module dialogs)
// INSIDE its chrome containers (#interface, #players, …) which the takeover hides
// with display:none. A hidden ancestor can't be undone by z-index, so those popups
// never surface over the mobile UI. We watch for framed popout windows and hoist
// each one out to <body> (escaping the hidden ancestor); the takeover CSS then
// lifts `.pf2e-mc-surfaced` above the app root and fits it to the viewport.
//
// Only FRAMED windows (a visible `.window-header`, or a dialog) are hoisted —
// frameless docked apps like SmallTime are persistent chrome we deliberately keep
// hidden, and hoisting one would float it over the screen.

const ROOT_ID = "pf2e-mobile-companion-root";
const SURFACED_CLASS = "pf2e-mc-surfaced";
const WINDOW_SELECTOR = ".application, .app.window-app, .dialog, dialog";

export interface PopupCandidate {
  isWindow: boolean; // matches a Foundry window/dialog selector
  framed: boolean; // a real popout: a visible window header, or a dialog
  inOwnRoot: boolean; // lives inside our React root (one of ours)
  surfaced: boolean; // already hoisted
}

/** Hoist a popout above the mobile UI only when it's a genuine framed dialog/sheet
 *  that isn't ours and isn't already surfaced — never a frameless docked widget
 *  (SmallTime, scene controls), which is chrome we keep hidden. */
export function shouldSurface(c: PopupCandidate): boolean {
  return c.isWindow && c.framed && !c.inOwnRoot && !c.surfaced;
}

/** A framed popout has a rendered window header (drag bar + close), or is a dialog.
 *  SmallTime & co. are frameless (no header, or one hidden via CSS) → not framed. */
function isFramed(el: Element): boolean {
  if (el.tagName === "DIALOG" || el.classList.contains("dialog")) return true;
  const header = el.querySelector(":scope > .window-header");
  return !!header && getComputedStyle(header).display !== "none";
}

function describe(el: Element): PopupCandidate {
  return {
    isWindow: el.matches(WINDOW_SELECTOR),
    framed: isFramed(el),
    inOwnRoot: !!el.closest(`#${ROOT_ID}`),
    surfaced: el.classList.contains(SURFACED_CLASS),
  };
}

function surface(el: Element): void {
  if (!shouldSurface(describe(el))) return;
  el.classList.add(SURFACED_CLASS);
  // Re-parent to <body> so no display:none chrome ancestor can hide it. Foundry
  // keeps its own `app.element` reference, so close/position still work.
  if (el.parentElement !== document.body) document.body.appendChild(el);
}

let installed = false;
/** Start hoisting framed popout windows out of hidden chrome to <body>. Idempotent;
 *  call once when the takeover mounts. Also sweeps any window already open. */
export function installPopupSurfacing(): void {
  if (installed) return;
  installed = true;

  const sweep = (): void => {
    for (const el of document.querySelectorAll(WINDOW_SELECTOR)) surface(el);
  };

  // A childList burst (React re-render, canvas, a dialog opening) coalesces into one
  // sweep per frame, and only when a window-like node was actually added — so routine
  // app updates don't trigger a document-wide scan.
  let queued = false;
  const observer = new MutationObserver((mutations) => {
    if (queued) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const el = node as Element;
        if (el.matches?.(WINDOW_SELECTOR) || el.querySelector?.(WINDOW_SELECTOR)) {
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            sweep();
          });
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  sweep(); // windows already open when the takeover mounted
}
