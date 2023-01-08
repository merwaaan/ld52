import * as Matter from "matter-js";
import * as Three from "three";
import { randomBetween } from "../utils";

import { Entity } from "./Entity";
import { GameContext } from "./test";

export class Rock extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = context.assets.model("rock").clone();

    this.model.scale.set(
      randomBetween(0.7, 1.4),
      randomBetween(0.7, 1.4),
      randomBetween(0.7, 1.4)
    );

    this.model.rotation.set(
      Math.random() * 2 * Math.PI,
      Math.random() * 2 * Math.PI,
      Math.random() * 2 * Math.PI
    );

    this.physics = Matter.Bodies.rectangle(x, -y, size, size, {
      //isStatic: true,
    });
  }

  update() {}
}
