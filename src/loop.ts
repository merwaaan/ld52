export function loop(update: (time: number) => void) {
  function step(time: number) {
    update(time);
    requestAnimationFrame(step);
  }

  step(0);
}
