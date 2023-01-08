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

    this.model = new Three.Group();

    const rockModel = context.assets.model("rock").clone();

    const horizontalScale = size * randomBetween(0.7, 1.6);
    const verticalScale = size * randomBetween(0.7, 1.6);

    rockModel.translateY(-verticalScale / 2);

    rockModel.scale.set(horizontalScale, verticalScale, horizontalScale);

    rockModel.rotation.set(
      Math.random() * 2 * Math.PI,
      Math.random() * 2 * Math.PI,
      Math.random() * 2 * Math.PI
    );

    this.model.add(rockModel);

    this.physics = Matter.Bodies.rectangle(
      x,
      -y,
      horizontalScale,
      verticalScale,
      {
        //isStatic: true,
        //isSensor: true,
        //isSleeping: true,
      }
    );
  }

  update() {}
}
