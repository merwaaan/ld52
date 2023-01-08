import * as Three from "three";
import * as Matter from "matter-js";

export enum EntityState {
  Alive,
  BeingAbsorbed,
  Absorbed,
};

export abstract class Entity {
  state: EntityState = EntityState.Alive;

  abstract model: Three.Object3D;
  abstract physics: Matter.Body;

  abstract update(): void;

  grab(): void {}
  release(): void {}
}
