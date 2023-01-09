import * as Matter from "matter-js";
import * as Three from "three";

import { Entity } from "./Entity";
import { GameContext } from "./main";
import { planetAttraction, randomBetween } from "../utils";
import { GameState } from "./GameState";
import { World } from "./Worlds";
import { bulletCollisionCat } from "./physics";
import { assignMaterial, bwMaterial, colors } from "./colors";

function delay() {
  return randomBetween(1, 3);
}

export class Tank extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  gunObject?: Three.Object3D;

  mode: "target" | "panic" = "target";
  nextShotDelay: number = delay();

  constructor(x: number, y: number, context: GameContext) {
    super();

    this.model = new Three.Group();

    const scale = 50;

    const tankModel = context.assets.model("tank").clone();
    tankModel.translateY(-scale / 2);
    tankModel.scale.set(scale, scale, scale);
    assignMaterial(tankModel, bwMaterial(colors["tank"]));

    tankModel.traverse((child) => {
      if (child.name == "gun") {
        this.gunObject = child;
      }
    });

    this.model.add(tankModel);

    this.physics = Matter.Bodies.rectangle(x, -y, scale, scale, {
      //isStatic: true,
    });
  }

  update(state: GameState, world: World) {
    const dt = 1 / 60;

    if (this.gunObject) {
      // Target the ship

      const gunWorldPos = new Three.Vector3();
      this.gunObject.getWorldPosition(gunWorldPos);

      const shipWorldPos = new Three.Vector3();
      state.ship.getWorldPosition(shipWorldPos);

      const dir = shipWorldPos;
      dir.sub(gunWorldPos);
      dir.normalize();

      this.gunObject.rotation.z = -new Three.Vector3(0, 1, 0).angleTo(dir);

      // Shoot

      this.nextShotDelay -= dt;

      if (this.nextShotDelay < 0) {
        const gunOffset = dir.clone().multiplyScalar(50);
        const pos = gunWorldPos.add(gunOffset);

        const vel = dir.multiplyScalar(10);

        world.add(new Bullet(pos.x, pos.y, vel.x, vel.y), state);

        this.nextShotDelay = delay();
      }
    }
  }
}

export class Bullet extends Entity {
  model: Three.Object3D;
  physics: Matter.Body;

  velocity: Three.Vector3;

  constructor(px: number, py: number, vx: number, vy: number) {
    super();

    this.velocity = new Three.Vector3(vx, vy, 0);

    const size = 5;

    this.model = new Three.Group();
    const geom = new Three.SphereGeometry(size);
    const mat = new Three.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new Three.Mesh(geom, mat);
    this.model.add(mesh);

    this.physics = Matter.Bodies.circle(px, -py, size, {
      //isStatic: true,
      //friction: 1,
      //frictionAir: 0.1,
      //mass: 20,
      //inverseMass: 1,
      collisionFilter: {
        category: bulletCollisionCat,
        mask: bulletCollisionCat,
      },
      plugin: planetAttraction(),
    });
    Matter.Body.setVelocity(this.physics, { x: vx, y: -vy });
    Matter.Body.setMass(this.physics, 10);
  }

  update() {}
}
