import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./test";
import { randomBetween } from "../utils";

export class Barn extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    //const horizontalScale = size * randomBetween(0.8, 1.2);
    //const verticalScale = size * randomBetween(0.7, 1.3);

    const barnModel = context.assets.model("barn").clone();
    barnModel.translateY(-size / 2);
    barnModel.scale.set(size, size, size);
    this.model.add(barnModel);

    this.physics = Matter.Bodies.rectangle(x, -y, size, size, {
      //isStatic: true,
      frictionStatic: 10,
    });
  }

  update() {}
}
