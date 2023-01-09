import * as Three from "three";
import * as Matter from "matter-js";
import { GameState } from "./GameState";
import { World } from "./Worlds";

export enum EntityState {
  Alive,
  BeingAbsorbed,
  Absorbed,
}

export abstract class Entity {
  state: EntityState = EntityState.Alive;

  abstract model: Three.Object3D;
  abstract physics: Matter.Body;

  otherPhysics: (Matter.Body | Matter.Constraint)[] = [];

  abstract update(state: GameState, world: World): void;

  grab(): void {}
  release(): void {}

  dirFromCenter(): Three.Vector3 {
    return this.model.position.clone().normalize();
  }

  dirLeft(): Three.Vector3 {
    const fromCenter = this.dirFromCenter();
    fromCenter.cross(new Three.Vector3(0, 0, -1));
    return fromCenter;
  }

  dirRight(): Three.Vector3 {
    return this.dirLeft().negate();
  }
}
