import * as Matter from "matter-js";
import * as Three from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";

import { Entity } from "./Entity";
import { GameContext } from "./main";
import { planetAttraction, randomBetween } from "../utils";
import { GameState } from "./GameState";
import { angleToWorldSpace, World } from "./Worlds";
import { bulletCollisionCat } from "./physics";
import { Vector2, Vector3 } from "three";
import { assignMaterial, bwMaterial, colors } from "./colors";

function delay() {
  return randomBetween(3, 6);
}

export class Human extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  mode:
    | { type: "idle" }
    | { type: "panic" }
    | { type: "walk"; goingLeft: boolean };

  nextModeDelay: number = delay();

  mixer?: Three.AnimationMixer;
  idleAction?: Three.AnimationAction;
  walkAction?: Three.AnimationAction;
  panicAction?: Three.AnimationAction;

  constructor(x: number, y: number, context: GameContext, state: GameState) {
    super();

    this.model = new Three.Group();

    const scale = 50;

    this.physics = Matter.Bodies.rectangle(x, -y, scale, scale, {
      isStatic: true,
      //frictionAir: 0.01,

      friction: 1,
      frictionAir: 0.01,
      mass: 1,
      inverseMass: 1,
    });
    //Matter.Body.setMass(this.physics, 1);

    // const sensor = Matter.Bodies.rectangle(x - 50, -y, scale, scale, {
    //   //isStatic: true,
    //   //frictionAir: 0.01,
    // });
    // Matter.Body.setMass(this.physics, 1);

    // const constraint = Matter.Constraint.create({
    //   //bodyA: this.physics,
    //   pointA: { x: x, y: -y },
    //   bodyB: sensor,
    //   //pointB: { x: 0, y: 0 },
    //   length: 0,
    // });
    // this.otherPhysics.push(sensor, constraint);

    // Matter.Events.on(state.physics, "collisionStart", (event) => {
    //   console.log(event.pairs.length);
    // });

    this.mode = { type: "walk", goingLeft: true }; /*{
        type: "idle",
      }*/

    context.assets.onReady((assets) => {
      const humanModel = SkeletonUtils.clone(assets.model("human"));
      assignMaterial(humanModel, bwMaterial(colors["human"]));

      const a = assets.model("human").animations;
      humanModel.translateY(-scale / 2);
      humanModel.scale.set(scale, scale, scale);

      this.model.add(humanModel);

      // Anim

      this.mixer = new Three.AnimationMixer(humanModel);

      const idleClip = Three.AnimationClip.findByName(a, "idle");
      this.idleAction = this.mixer.clipAction(idleClip);

      const walkClip = Three.AnimationClip.findByName(a, "walk");
      this.walkAction = this.mixer.clipAction(walkClip);
      this.walkAction!.timeScale = 5;

      const panicClip = Three.AnimationClip.findByName(a, "panic");
      this.panicAction = this.mixer.clipAction(panicClip);
      this.panicAction!.timeScale = 5;

      this.anim();
    });
  }

  anim() {
    switch (this.mode.type) {
      case "idle":
        this.idleAction?.play();
        this.walkAction?.stop();
        this.panicAction?.stop();
        break;
      case "walk":
        this.idleAction?.stop();
        this.walkAction?.play();
        this.panicAction?.stop();

        const dir = this.mode.goingLeft ? this.dirLeft() : this.dirRight();
        const target = this.model.children[0].position
          .clone()
          .add(dir.multiplyScalar(10));

        this.model.children[0].lookAt(target);
        break;
      case "panic":
        this.idleAction?.stop();
        this.walkAction?.stop();
        this.panicAction?.play();

        this.model.children[0].lookAt(new Vector3(0, 1000, 500));
        break;
    }
  }

  grab() {
    //this.mode = { type: "panic" };
  }

  update(state: GameState, world: World) {
    const dt = 1 / 60;

    // Check ray

    Matter.Body.setStatic(this.physics, false);
    const d = Matter.Detector.create({
      bodies: [this.physics, state.shipRayPhysics],
    });
    const collisions = Matter.Detector.collisions(d);

    const collidesWithRay = collisions.some(
      (c) => c.bodyA == state.shipRayPhysics || c.bodyB == state.shipRayPhysics
    );

    if (collidesWithRay) {
      //this.mode = { type: "panic" };
      //this.anim();
    } else {
    }
    Matter.Body.setStatic(this.physics, true);

    // State update

    switch (this.mode.type) {
      case "idle":
        this.nextModeDelay -= dt;

        if (this.nextModeDelay < 0) {
          this.mode = { type: "walk", goingLeft: Math.random() > 0.5 };
          this.nextModeDelay = delay();
          this.anim();
        }
        break;

      case "walk":
        /*const force = this.mode.goingLeft ? this.dirLeft() : this.dirRight();
        force.multiplyScalar(0.00001);
        Matter.Body.applyForce(this.physics, this.physics.position, {
          x: force.x,
          y: -force.y,
        });*/

        const pos = new Three.Vector3(
          this.physics.position.x,
          -this.physics.position.y
        );
        const angle = pos.angleTo(new Three.Vector3(0, 1, 0));
        const newAngle = angle + 0.001;
        const newPos = angleToWorldSpace(newAngle, state.planetRadius);

        Matter.Body.setPosition(this.physics, { x: newPos.x, y: -newPos.y });

        this.nextModeDelay -= dt;

        if (this.nextModeDelay < 0) {
          this.mode = { type: "idle" };
          this.nextModeDelay = delay();
          this.anim();
        }

        break;

      case "panic":
        // TODO
        break;
    }

    this.mixer?.update(1 / 60);
  }
}
