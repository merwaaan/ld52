import * as Three from "three";

export const colors = {
  ground: 0.2,
  tree: 0.3,
  rock: 0.2,
  barn: 0.2,
  human: 0.3,
  cow: 0.1,
  tank: 0.4,
  bg1: 0.3,
  bg2: 0.15,
  bg3: 0.05,
};

export function bw(intensity: number) {
  const x = Math.floor(intensity * 255);
  return `rgb(${x}, ${x}, ${x})`;
}

export function bwMaterial(intensity: number) {
  return new Three.MeshPhongMaterial({
    color: bw(intensity),
    emissive: bw(intensity * 0.25),
    specular: 0xfffff,
    shininess: 5,
  });
}

export function bwMaterialUnlit(intensity: number) {
  return new Three.MeshBasicMaterial({
    color: bw(intensity),
  });
}

export function glowMaterial(color: string) {
  return new Three.MeshBasicMaterial({
    color: color,
  });
}

export function assignMaterial(
  object: Three.Object3D,
  material: Three.Material
) {
  object.traverse((child) => {
    if (child instanceof Three.Mesh) {
      child.material = material;
    }
  });
}

// export function assignMaterial(
//   object: Three.Object3D,
//   color: number
// ): Three.MeshLambertMaterial {
//   const mat = new Three.MeshLambertMaterial({
//     color: color,
//     emissive: color,
//     emissiveIntensity: 0.1,
//   });

//   object.traverse((child) => {
//     if (child instanceof Three.Mesh) {
//       child.material = mat;
//     }
//   });

//   return mat;
// }
