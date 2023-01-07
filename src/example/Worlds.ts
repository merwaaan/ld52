import * as Three from "three";
import * as Matter from "matter-js";

import { Cow } from "./Cow";
import { GameState } from "./GameState";
import { House } from "./House";
import { Entity } from "./Entity";

type EntityDesc = {
  position: number;
} & ({ type: "house" } | { type: "cow" });

export function house(x: number): EntityDesc {
  return { type: "house", position: x };
}

export function cow(x: number): EntityDesc {
  return { type: "cow", position: x };
}

export class World {
  private entitiesToSpawn: EntityDesc[];

  spawnedEntities: Entity[] = [];

  constructor(desc: EntityDesc[]) {
    this.entitiesToSpawn = desc;

    // Sort entities by position

    this.entitiesToSpawn.sort((a, b) => (a > b ? 1 : b > a ? -1 : 0));
  }

  spawn(entityDesc: EntityDesc, state: GameState) {
    console.debug("spawning entity", entityDesc);

    let angle = entityDesc.position * 2 * Math.PI;
    let position = new Three.Vector2(0, state.planetRadius + 50);
    position.rotateAround(new Three.Vector2(0, 0), -angle);

    let entity: House | Cow;

    switch (entityDesc.type) {
      case "house":
        entity = new House(position.x, position.y, 50);
        break;

      case "cow":
        entity = new Cow(position.x, position.y, 50);
        break;
    }

    this.spawnedEntities.push(entity);

    state.scene.add(entity.model);

    entity.physics.angle = angle;
    Matter.Composite.add(state.physics.world, [entity.physics]);
  }

  despawn(entity: Entity, state: GameState) {
    console.debug("despawning entity", entity);

    state.scene.remove(entity.model);
    Matter.Composite.remove(state.physics.world, entity.physics);
  }

  update(state: GameState) {
    // Spawn new entities

    const cycles = state.planetRotation / (2 * Math.PI); // radians to cycles
    const margin = 0.04;
    const spawnLimit = cycles + margin;

    while (
      this.entitiesToSpawn.length > 0 &&
      this.entitiesToSpawn[0].position < spawnLimit
    ) {
      const entityDesc = this.entitiesToSpawn.shift()!;
      this.spawn(entityDesc, state);
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
    for (const entity of this.spawnedEntities) {
    }

    // Sync physics and models

    for (const entity of this.spawnedEntities) {
      entity.model.position.x = entity.physics.position.x;
      entity.model.position.y = -entity.physics.position.y;
      entity.model.rotation.z = -entity.physics.angle;
      entity.physics.angle;
    }
  }
}