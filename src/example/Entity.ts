import * as Three from "three";
import * as Matter from "matter-js";
import { GameState } from "./GameState";
import { World } from "./Worlds";

export enum EntityState {
  Alive,
  BeingAbsorbed,
  Absorbed,
};

export abstract class Entity {
  state: EntityState = EntityState.Alive;

  abstract model: Three.Object3D;
  abstract physics: Matter.Body;

  abstract update(state: GameState, world: World): void;

  grab(): void {}
  release(): void {}
}
