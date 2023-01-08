import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./test";
import { randomBetween } from "../utils";

export class Cow extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    const scale = 25;

    const cowModel = context.assets.model("cow").clone();
    cowModel.translateY(-scale / 2);
    cowModel.scale.set(scale, scale, scale);
    this.model.add(cowModel);

    this.physics = Matter.Bodies.rectangle(x, -y, scale, scale, {
      //isStatic: true,
    });
  }

  update() {}
}
