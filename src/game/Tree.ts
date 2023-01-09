import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./main";
import { planetAttraction, randomBetween } from "../utils";

export class Tree extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  constructor(x: number, y: number, size: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    const horizontalScale = size * randomBetween(0.8, 1.2);
    const verticalScale = size * randomBetween(0.7, 1.3);

    const treeModel = context.assets.model("tree").clone();
    treeModel.translateY(-verticalScale / 2);
    treeModel.scale.set(horizontalScale, verticalScale, horizontalScale);
    this.model.add(treeModel);

    const isStatic = size > 100;

    this.physics = Matter.Bodies.rectangle(
      x,
      -y,
      horizontalScale,
      verticalScale,
      {
        isStatic: isStatic,
        friction: 1,
        frictionAir: 0.01,
        mass: 1,
        inverseMass: 1,
        plugin: planetAttraction(),
      }
    );
  }

  update() {}
}
