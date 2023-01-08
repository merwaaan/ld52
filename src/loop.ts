export function loop(update: () => void) {
  let accumulator = 0;
  let lastTime = 0;

  function step(time: number) {
    const dt = time - lastTime;
    lastTime = time;
    accumulator += dt;

    const stepMs = 1000 / 60;

    while (accumulator >= stepMs) {
      accumulator -= stepMs;
      update();
    }

    requestAnimationFrame(step);
  }

  step(0);
}
