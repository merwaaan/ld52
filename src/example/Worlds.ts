import * as Three from "three";
import * as Matter from "matter-js";

import { Cow } from "./Cow";
import { GameState } from "./GameState";
import { House } from "./House";
import { Entity } from "./Entity";
import { GameContext } from "./test";
import { Tree } from "./Tree";
import { Rock } from "./Rock";
import { Barn } from "./Barn";

type EntityDesc = {
  position: number;
} & (
  | { type: "barn" }
  | { type: "cow" }
  | { type: "house" }
  | { type: "rock" }
  | { type: "tree" }
);

//

export function barn(x: number): EntityDesc {
  return { type: "barn", position: x };
}

export function cow(x: number): EntityDesc {
  return { type: "cow", position: x };
}

export function house(x: number): EntityDesc {
  return { type: "house", position: x };
}
export function tree(x: number): EntityDesc {
  return { type: "tree", position: x };
}

export function rock(x: number): EntityDesc {
  return { type: "rock", position: x };
}

// World

export class World {
  private entitiesToSpawn: EntityDesc[];

  spawnedEntities: Entity[] = [];

  constructor() {
    // const desc = [
    //   rock(-0.03),
    //   rock(-0.027),
    //   rock(-0.025),
    //   rock(-0.023),
    //   rock(-0.021),
    //   rock(-0.017),
    //   rock(-0.015),
    //   rock(-0.012),
    //   rock(-0.002),
    //   tree(0),
    //   cow(0.03),
    //   barn(0.05),
    //   tree(0.01),
    //   rock(0.012),
    //   rock(0.015),
    //   tree(0.025),
    //   tree(0.028),
    //   rock(0.03),
    //   tree(0.06),
    //   tree(0.08),
    //   rock(0.09),
    //   tree(0.1),
    // ];

    this.entitiesToSpawn = this.generateNewEntities(-0.05);
  }

  generateNewEntities(t: number) : EntityDesc[] {
    let desc = [];
    const tInc = 0.01;

    let stop = 10;
    while (t < stop) {
      desc.push(rock(t));
      t += tInc;
    }

    return desc;
  }

  lookupEntity(physics: Matter.Body): Entity | undefined {
    for (const entity of this.spawnedEntities) {
      if (entity.physics == physics) return entity;
    }
    return undefined;
  }

  spawn(entityDesc: EntityDesc, state: GameState, context: GameContext) {
    console.debug("spawning entity", entityDesc);

    let angle = entityDesc.position * 2 * Math.PI;
    let position = new Three.Vector2(0, state.planetRadius + 100);
    position.rotateAround(new Three.Vector2(0, 0), -angle);

    let entity: Entity;

    switch (entityDesc.type) {
      case "barn":
        entity = new Barn(position.x, position.y, 80, context);
        break;
      case "cow":
        entity = new Cow(position.x, position.y, context);
        break;
      case "house":
        entity = new House(position.x, position.y, 50);
        break;
      case "tree":
        entity = new Tree(position.x, position.y, 60, context);
        break;
      case "rock":
        entity = new Rock(position.x, position.y, 20, context);
        break;
    }

    this.spawnedEntities.push(entity);

    state.scene.add(entity.model);

    Matter.Body.setAngle(entity.physics, angle);
    Matter.Composite.add(state.physics.world, [entity.physics]);
  }

  despawn(entity: Entity, state: GameState) {
    console.debug("despawning entity", entity);

    state.scene.remove(entity.model);
    Matter.Composite.remove(state.physics.world, entity.physics);
  }

  update(state: GameState, context: GameContext) {
    // Spawn new entities

    const cycles = state.planetRotation / (2 * Math.PI); // radians to cycles
    const margin = 0.08;
    const spawnLimit = cycles + margin;

    while (
      this.entitiesToSpawn.length > 0 &&
      this.entitiesToSpawn[0].position < spawnLimit
    ) {
      const entityDesc = this.entitiesToSpawn.shift()!;
      this.spawn(entityDesc, state, context);
    }

    // Remove old entities

    this.spawnedEntities = this.spawnedEntities.filter((entity) => {
      const cameraSpacePos = entity.model.position.clone();
      cameraSpacePos.project(state.camera);

      const remove = cameraSpacePos.x < -1.2 || cameraSpacePos.x > 1.2;

      if (remove) {
        this.despawn(entity, state);
      }

      return !remove;
    });

    // Update

    for (const entity of this.spawnedEntities) {
      entity.update();
    }

    // Sync physics and models

    for (const entity of this.spawnedEntities) {
      entity.model.position.x = entity.physics.position.x;
      entity.model.position.y = -entity.physics.position.y;
      entity.model.rotation.z = -entity.physics.angle;
    }
  }

  entityFromPhysics(physics: Matter.Body) {
    return this.spawnedEntities.find((entity) => entity.physics == physics);
  }
}
