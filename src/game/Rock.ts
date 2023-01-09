import * as Matter from "matter-js";
import * as Three from "three";
import { planetAttraction, randomBetween } from "../utils";
import { assignMaterial, bwMaterial, colors } from "./colors";

import { Entity } from "./Entity";
import { GameContext } from "./main";

export class Rock extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  size: number;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    this.size = size;
    const horizontalScale = size * randomBetween(0.7, 1.6);
    const verticalScale = size * randomBetween(0.7, 1.6);

    const isStatic = size > 30;

    this.physics = Matter.Bodies.rectangle(
      x,
      -y,
      horizontalScale,
      verticalScale,
      {
        isStatic: isStatic,
        //isSensor: true,
        //isSleeping: true,
        friction: 10,
        frictionAir: 0.01,
        mass: 1,
        inverseMass: 1,
        plugin: planetAttraction(),
      }
    );

    context.assets.onReady((assets) => {
      const rockModel = context.assets.model("rock").clone();

      rockModel.translateY(-verticalScale / 2);

      rockModel.scale.set(horizontalScale, verticalScale, horizontalScale);

      rockModel.rotation.set(
        Math.random() * 2 * Math.PI,
        Math.random() * 2 * Math.PI,
        Math.random() * 2 * Math.PI
      );

      assignMaterial(rockModel, bwMaterial(colors["rock"]));

      this.model.add(rockModel);
    });
  }

  update() {}
}
