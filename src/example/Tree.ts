import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./test";
import { randomBetween } from "../utils";

export class Tree extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = context.assets.model("tree").clone();

    const horizontalScale = randomBetween(0.8, 1.2);
    const verticalScale = randomBetween(0.7, 1.3);

    this.model.scale.set(horizontalScale, verticalScale, horizontalScale);

    this.physics = Matter.Bodies.rectangle(x, -y, size, size, {
      //isStatic: true,
    });
  }

  update() {}
}
