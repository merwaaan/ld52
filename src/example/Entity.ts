import * as Three from "three";
import * as Matter from "matter-js";

export abstract class Entity {
  abstract model: Three.Object3D;
  abstract physics: Matter.Body;

  abstract update(): void;
}
