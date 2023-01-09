import * as Matter from "matter-js";
import * as Three from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";

import { Entity } from "./Entity";
import { GameContext } from "./main";
import { planetAttraction, randomBetween } from "../utils";
import { assignMaterial, bwMaterial, colors } from "./colors";
import { LoopOnce } from "three";

function delay() {
  return Math.random() * 3 + 3;
}

export class Cow extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  mixer?: Three.AnimationMixer;
  eatAction?: Three.AnimationAction;
  panicAction?: Three.AnimationAction;

  mode: "idle" | "eat" | "panic" = "idle";
  nextModeDelay: number = delay();

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

      const anims = assets.model("cow").animations;
      cowModel.translateY(-scale / 2);
      cowModel.scale.set(scale, scale, scale);

      assignMaterial(cowModel, bwMaterial(colors["cow"]));

      this.model.add(cowModel);

      // Anim

      this.mixer = new Three.AnimationMixer(cowModel);
      const idleClip = Three.AnimationClip.findByName(anims, "eat");
      const panicClip = Three.AnimationClip.findByName(anims, "panic");

      this.eatAction = this.mixer.clipAction(idleClip);
      //this.idleAction?.setLoop(Three.LoopOnce, 1);
      this.eatAction?.play();

      this.panicAction = this.mixer.clipAction(panicClip);
      this.panicAction?.play();
      this.panicAction.timeScale = 2;

      this.anim();
    });
  }

  anim() {
    switch (this.mode) {
      case "idle":
        this.panicAction?.stop();
        this.eatAction?.stop();
        break;

      case "eat":
        this.panicAction?.stop();
        this.eatAction?.play();
        break;

      case "panic":
        this.panicAction?.play();
        this.eatAction?.stop();
        break;
    }
  }

  update() {
    const dt = 1 / 60;

    switch (this.mode) {
      case "idle":
        this.nextModeDelay -= dt;

        if (this.nextModeDelay < 0) {
          this.mode = "eat";
          this.nextModeDelay = delay();
          this.anim();
        }
        break;

      case "eat":
        this.nextModeDelay -= dt;

        if (this.nextModeDelay < 0) {
          this.mode = "idle";
          this.nextModeDelay = delay();
          this.anim();
        }
        break;

      case "panic":
        break;
    }

    this.mixer?.update(dt);
  }

  grab(): void {
    super.grab();

    this.mode = "panic";
    this.anim();
  }
}
