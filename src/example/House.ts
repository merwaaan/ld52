import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";

export class House extends Entity {
  model: Three.Mesh;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number) {
    super();

    const geometry = new Three.BoxGeometry(size, size);
    const material = new Three.MeshBasicMaterial({ color: 0x00ff00 });
    this.model = new Three.Mesh(geometry, material);

    this.physics = Matter.Bodies.rectangle(x, -y, size, size, {});
    Matter.Body.setStatic(this.physics, true);
  }

  update() {}
}
