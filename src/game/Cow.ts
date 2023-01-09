import * as Matter from "matter-js";
import * as Three from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";

import { Entity } from "./Entity";
import { GameContext } from "./main";
import { planetAttraction, randomBetween } from "../utils";
import { assignMaterial, bwMaterial, colors } from "./colors";

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
      const cowModel = SkeletonUtils.clone(assets.model("cow"));

      const a = assets.model("cow").animations;
      cowModel.translateY(-scale / 2);
      cowModel.scale.set(scale, scale, scale);

      assignMaterial(cowModel, bwMaterial(colors["cow"]));

      this.model.add(cowModel);

      // Anim

      this.mixer = new Three.AnimationMixer(cowModel);
      const idleClip = Three.AnimationClip.findByName(a, "eat");

      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction?.play();
    });
  }

  update() {
    this.mixer?.update(1 / 60);
  }

  grab(): void {
    // TODO panic anim
  }
}
