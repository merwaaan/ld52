export function loop(update: () => void) {
  function step() {
    update();
    requestAnimationFrame(step);
  }

  step();
}
