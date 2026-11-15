// Presentation mode for projector/TV: full screen + everything scaled up.
// Works without the Fullscreen API too (then only the large layout).
const root = document.documentElement;
const listeners = new Set();

export const isPresentation = () => root.classList.contains('is-presentation');

export function onPresentationChange(fn) {
  listeners.add(fn);
}

function apply(on) {
  root.classList.toggle('is-presentation', on);
  listeners.forEach((fn) => fn(on));
}

export function togglePresentation() {
  const on = !isPresentation();
  apply(on);
  try {
    if (on && !document.fullscreenElement) root.requestFullscreen?.()?.catch?.(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
  } catch {
    /* fullscreen not allowed – large layout still applies */
  }
}

// leaving full screen with the browser's own Esc/F11 also ends presentation mode
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && isPresentation()) apply(false);
});
