import * as Three from "three";
import * as Matter from "matter-js";

export abstract class Entity {
  abstract model: Three.Mesh;
  abstract physics: Matter.Body;

  abstract update(): void;
}
