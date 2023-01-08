import Matter from "matter-js";

// Returns relative position wrt top-left corner of element
export function computeRelativePosition(
  position: [number, number],
  element: HTMLElement
) {
  const rect = element.getBoundingClientRect();
  const x = position[0] - rect.left;
  const y = position[1] - rect.top;
  return [x, y];
}

// Returns relative position in [0, 1] range
export function computeNormalizedPosition(
  position: [number, number],
  element: HTMLElement
) {
  const relativePosition = computeRelativePosition(position, element);
  const rect = element.getBoundingClientRect();
  const x = relativePosition[0] / rect.width;
  const y = relativePosition[1] / rect.height;
  return [x, y];
}

export function clamp(x: number, min: number, max: number) {
  if (x < min) return min;
  else if (x > max) return max;
  else return x;
}

export function randomBetween(min: number, max: number): number {
  return min + (max - min) * Math.random();
}

export function weightedRandom(array: [any, number][]): any {
  const psums = [];
  let pTotal = 0;

  for (const [_, p] of array) {
    pTotal += p;
    psums.push(pTotal);
  }

  const c = Math.random() * 100;

  for (let i=0; i < psums.length; ++i) {
    if (c < psums[i])
      return array[i][0];
  }

  return undefined;
}

export function planetAttraction() {
  return {
    attractors: [
      (a: Matter.Body, b: Matter.Body) => {
        const p = b.position;
        const dir = Matter.Vector.sub(Matter.Vector.create(0, 0), p);
        const dirNorm = Matter.Vector.normalise(dir);
        const g = Matter.Vector.mult(dirNorm, 0.0005);

        return g;
      },
    ],
  };
}
