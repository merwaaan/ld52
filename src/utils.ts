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
