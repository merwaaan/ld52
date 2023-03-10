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

function haaDelay() {
  return Math.random() * 5 + 5;
}

const haas = ["HAAA", "HA!", "HAaaAAaaaAa", "oh no", ":("];

function randomHaa() {
  const i = Math.floor(Math.random() * haas.length);
  return haas[i];
}

export class Human extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  mode:
    | { type: "grabbed" }
    | { type: "falling" }
    | { type: "run"; goingLeft: boolean };

  nextModeDelay: number = delay();

  nextHaaDelay: number = haaDelay();

  mixer?: Three.AnimationMixer;
  runAction?: Three.AnimationAction;
  panicAction?: Three.AnimationAction;

  constructor(x: number, y: number, context: GameContext, state: GameState) {
    super();

    this.model = new Three.Group();

    const scale = 50;

    this.physics = Matter.Bodies.rectangle(x, -y - 30, scale, scale, {
      //isStatic: true,
      friction: 10,
      frictionAir: 0.01,
      mass: 1,
      inverseMass: 1,
      plugin: planetAttraction(),
    });
    this.autoAddPhysics = false;

    this.mode = { type: "run", goingLeft: Math.random() > 0.5 };

    context.assets.onReady((assets) => {
      const humanModel = SkeletonUtils.clone(assets.model("human"));
      assignMaterial(humanModel, bwMaterial(colors["human"]));

      const a = assets.model("human").animations;
      humanModel.translateY(-scale / 2);
      humanModel.scale.set(scale, scale, scale);

      this.model.add(humanModel);

      // Anim

      this.mixer = new Three.AnimationMixer(humanModel);

      const runClip = Three.AnimationClip.findByName(a, "flee");
      this.runAction = this.mixer.clipAction(runClip);
      this.runAction!.timeScale = 2;

      const panicClip = Three.AnimationClip.findByName(a, "panic");
      this.panicAction = this.mixer.clipAction(panicClip);
      this.panicAction!.timeScale = 2;

      this.anim();
    });
  }

  anim() {
    switch (this.mode.type) {
      case "run":
        this.runAction?.play();
        this.panicAction?.stop();

        this.model.children[0].rotation.y =
          (Math.PI / 2) * (this.mode.goingLeft ? 1 : -1) * 0.8;
        break;
      case "grabbed":
      case "falling":
        this.runAction?.stop();
        this.panicAction?.play();

        this.model.children[0].rotation.y = 0;
        break;
    }
  }

  grab() {
    super.grab();

    this.mode = { type: "grabbed" };
    this.anim();

    Matter.Body.applyForce(
      this.physics,
      Matter.Vector.create(0, 0),
      Matter.Vector.create(Math.random() * 100, Math.random())
    );
    Matter.Body.setAngularVelocity(this.physics, 1);
    //Matter.Body.setStatic(this.physics, false);
  }

  release() {
    super.release();

    this.mode = { type: "falling" };
    this.anim();

    //Matter.Body.setStatic(this.physics, false);
  }

  update(state: GameState, world: World, context: GameContext) {
    const dt = 1 / 60;

    // Haa

    this.nextHaaDelay -= dt;

    if (this.nextHaaDelay < 0) {
      const p = new Three.Vector3();
      p.copy(this.model.position);
      p.y += 30;

      state.spawnBubble(context, randomHaa(), p, {
        size: 10,
        endScale: 1,
        vertOffset: 10,
        duration: 3000,
      });
      this.nextHaaDelay = haaDelay();
    }

    // State update

    switch (this.mode.type) {
      case "run":
        // Move

        const runSpeed = 0.002;

        const pos = new Three.Vector3(
          this.physics.position.x,
          -this.physics.position.y
        );
        const angle = pos.angleTo(new Three.Vector3(0, 1, 0));
        const newAngle = angle + runSpeed * (this.mode.goingLeft ? 1 : -1);
        const newPos = angleToWorldSpace(newAngle, state.planetRadius);

        Matter.Body.setPosition(this.physics, { x: newPos.x, y: -newPos.y });
        Matter.Body.setAngle(this.physics, state.planetRotation);

        // Collide with ray

        //Matter.Body.setStatic(this.physics, false);
        const d = Matter.Detector.create({
          bodies: [this.physics, state.shipRayPhysics],
        });
        const collisions = Matter.Detector.collisions(d);

        const collidesWithRay = collisions.some(
          (c) =>
            c.bodyA == state.shipRayPhysics || c.bodyB == state.shipRayPhysics
        );

        if (collidesWithRay && state.shipIsGrabbing) {
          Matter.Composite.add(state.physics.world, this.physics);
          //Matter.Body.setStatic(this.physics, true);
        }

        // Timer

        this.nextModeDelay -= dt;

        if (this.nextModeDelay < 0) {
          this.mode = { type: "run", goingLeft: !this.mode.goingLeft };
          this.nextModeDelay = delay();
          this.anim();
        }

        break;

      case "grabbed":
        // TODO
        break;

      case "falling":
        const toCenter = Matter.Vector.normalise(this.physics.position);
        const g = Matter.Vector.mult(Matter.Vector.neg(toCenter), 0.001);

        Matter.Body.applyForce(this.physics, this.physics.position, g);

        // Collide with ground

        const d_ = Matter.Detector.create({
          bodies: [this.physics, state.planetPhysics],
        });
        const collisions_ = Matter.Detector.collisions(d_);

        const collidesWithGround = collisions_.some(
          (c) =>
            c.bodyA == state.planetPhysics || c.bodyB == state.planetPhysics
        );

        if (collidesWithGround) {
          this.mode = { type: "run", goingLeft: true };
          this.anim();
          Matter.World.remove(state.physics.world, this.physics);
          //Matter.Body.setStatic(this.physics, true);
        }

        break;
    }

    this.mixer?.update(1 / 60);
  }
}
