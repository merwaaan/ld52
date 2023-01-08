import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./test";
import { planetAttraction, randomBetween } from "../utils";

export class Cow extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  mixer?: Three.AnimationMixer;
  idleAction?: Three.AnimationAction;

  constructor(x: number, y: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    const scale = 25;

    this.physics = Matter.Bodies.rectangle(x, -y, scale, scale, {
      //isStatic: true,
      plugin: planetAttraction(),

        friction: 1,
        frictionAir: 0.01,
        mass: 1,
        inverseMass: 1,
    });

    context.assets.onReady((assets) => {
      const cowModel = context.assets.model("cow").clone();
      cowModel.translateY(-scale / 2);
      cowModel.scale.set(scale, scale, scale);

      cowModel.traverse((child) => {
        if (child instanceof Three.Mesh) {
          child.material = new Three.MeshBasicMaterial({
            color: 0xff0000,
          });
        }
      });

      this.model.add(cowModel);

      // Anim

      this.mixer = new Three.AnimationMixer(cowModel);
      const idleClip = Three.AnimationClip.findByName(
        cowModel.animations,
        "eat"
      );

      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction?.play();
    });
  }

  update() {
    this.mixer?.update(1 / 60);
  }

  grab(): void {
    console.log("moo");
    // TODO panic anim
  }
}
