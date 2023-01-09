import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./main";
import { planetAttraction, randomBetween } from "../utils";
import { assignMaterial, bwMaterial, colors } from "./colors";

export class Barn extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    this.physics = Matter.Bodies.rectangle(x, -y - 30, size, size, {
      isStatic: true,
      frictionStatic: 10,
      plugin: planetAttraction(),
    });

    //const horizontalScale = size * randomBetween(0.8, 1.2);
    //const verticalScale = size * randomBetween(0.7, 1.3);

    context.assets.onReady(() => {
      const barnModel = context.assets.model("barn").clone();
      assignMaterial(barnModel, bwMaterial(colors["barn"]));
      barnModel.translateY(-size / 2);
      barnModel.scale.set(size, size, size);
      this.model.add(barnModel);
    });
  }

  update() {}
}
