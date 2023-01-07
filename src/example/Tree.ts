import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./test";

export class Tree extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = context.assets.model("tree");
    this.physics = Matter.Bodies.rectangle(x, -y, size, size);
  }

  update() {}
}
