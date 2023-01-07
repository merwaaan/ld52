import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./test";

export class Rock extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = context.assets.model("rock");
    this.physics = Matter.Bodies.rectangle(x, -y, size, size);
  }

  update() {}
}
