import * as Three from "three";
import * as Matter from "matter-js";

import { Cow } from "./Cow";
import { GameState } from "./GameState";
import { House } from "./House";
import { Entity } from "./Entity";
import { GameContext } from "./main";
import { Tree } from "./Tree";
import { Rock } from "./Rock";
import { Barn } from "./Barn";
import { weightedRandom } from "../utils";
import { Tank } from "./Tank";
import { Human } from "./Human";

type EntityDesc = {
  position: number;
} & (
  | { type: "barn" }
  | { type: "bullet"; velocity: [number, number] }
  | { type: "cow" }
  | { type: "house" }
  | { type: "smallRock" }
  | { type: "medRock" }
  | { type: "bigRock" }
  | { type: "tank" }
  | { type: "tree" }
  | { type: "bigTree" }
  | { type: "human" }
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

export function human(x: number): EntityDesc {
  return { type: "human", position: x };
}

export function tank(x: number): EntityDesc {
  return { type: "tank", position: x };
}

export function tree(x: number): EntityDesc {
  return { type: "tree", position: x };
}

export function bigTree(x: number): EntityDesc {
  return { type: "bigTree", position: x };
}

export function smallRock(x: number): EntityDesc {
  return { type: "smallRock", position: x };
}

export function medRock(x: number): EntityDesc {
  return { type: "medRock", position: x };
}

export function bigRock(x: number): EntityDesc {
  return { type: "bigRock", position: x };
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
    // this.entitiesToSpawn = desc;

    this.entitiesToSpawn = this.generateNewEntities(-0.05);
  }

  generateNewEntities(t: number): EntityDesc[] {
    let desc = [];
    const tInc = 0.01;

    //console.log("genlevel", t);

    let p: [any, number][];
    if (t < 0.5) {
      //console.log("level 1");
      p = [
        [smallRock, 15],
        [medRock, 10],
        [bigRock, 3],
        [tree, 13],
        [bigTree, 2],
        [cow, 40],
        [barn, 3],
        [tank, 5],
        [human, 5],
      ];
    } else if (t < 1) {
      //console.log("level 2");
      p = [
        [smallRock, 15],
        [medRock, 10],
        [bigRock, 3],
        [tree, 13],
        [bigTree, 2],
        [cow, 30],
        [barn, 3],
        [tank, 10],
      ];
    } else {
      //console.log("level 3");
      p = [
        [smallRock, 10],
        [medRock, 15],
        [bigRock, 3],
        [tree, 10],
        [bigTree, 5],
        [cow, 20],
        [barn, 2],
        [tank, 20],
      ];
    }

    let stop = t + 0.4;
    while (t < stop) {
      const f = weightedRandom(p);
      if (f) {
        desc.push(f(t));
      }
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

  add(entity: Entity, state: GameState) {
    //console.debug("adding entity", entity);

    this.spawnedEntities.push(entity);

    state.scene.add(entity.model);

    //Matter.Body.setAngle(entity.physics, angle);
    Matter.Composite.add(state.physics.world, [
      entity.physics,
      ...entity.otherPhysics,
    ]);
  }

  spawn(entityDesc: EntityDesc, state: GameState, context: GameContext) {
    //console.debug("spawning entity", entityDesc);

    let angle = cyclesToAngle(entityDesc.position);
    let position = angleToWorldSpace(angle, state.planetRadius);

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
      case "human":
        entity = new Human(position.x, position.y, context, state);
        break;
      case "tank":
        entity = new Tank(position.x, position.y, context);
        break;
      case "tree":
        entity = new Tree(position.x, position.y, 60, context);
        break;
      case "bigTree":
        entity = new Tree(position.x, position.y, 120, context);
        break;
      case "smallRock":
        entity = new Rock(position.x, position.y, 10, context);
        break;
      case "medRock":
        entity = new Rock(position.x, position.y, 25, context);
        break;
      case "bigRock":
        entity = new Rock(position.x, position.y, 40, context);
        break;
      default:
        throw new Error(`cannot spawn ${entityDesc.type}`);
    }

    this.spawnedEntities.push(entity);

    state.scene.add(entity.model);

    Matter.Body.setAngle(entity.physics, angle);
    Matter.Composite.add(state.physics.world, [
      entity.physics,
      ...entity.otherPhysics,
    ]);
  }

  despawn(entity: Entity, state: GameState) {
    //console.debug("despawning entity", entity);

    state.scene.remove(entity.model);
    Matter.Composite.remove(state.physics.world, entity.physics);
  }

  reset(state: GameState) {
    for (const entity of this.spawnedEntities) {
      this.despawn(entity, state);
    }

    this.entitiesToSpawn.length = 0;
    this.entitiesToSpawn = this.generateNewEntities(-0.05);
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

      if (this.entitiesToSpawn.length == 0) {
        for (const e of this.generateNewEntities(entityDesc.position))
          this.entitiesToSpawn.push(e);
      }
    }

    // Sync physics and models

    for (const entity of this.spawnedEntities) {
      entity.model.position.x = entity.physics.position.x;
      entity.model.position.y = -entity.physics.position.y;
      entity.model.rotation.z = -entity.physics.angle;
    }

    // Remove old entities

    this.spawnedEntities = this.spawnedEntities.filter((entity) => {
      const cameraSpacePos = entity.model.position.clone();
      cameraSpacePos.project(state.camera);

      const nearPlanetCenter =
        entity.model.position.y < 100 &&
        entity.model.position.y > -100 &&
        entity.model.position.x < 100 &&
        entity.model.position.x > -100;

      const remove = cameraSpacePos.x < -1.2 || nearPlanetCenter;

      if (remove) {
        this.despawn(entity, state);
      }

      return !remove;
    });

    // Update

    if (!state.isPaused) {
      for (const entity of this.spawnedEntities) {
        entity.update(state, this);
      }
    }
  }

  entityFromPhysics(physics: Matter.Body) {
    return this.spawnedEntities.find((entity) => entity.physics == physics);
  }
}

export function cyclesToAngle(cycles: number) {
  return cycles * 2 * Math.PI;
}

export function angleToWorldSpace(
  angle: number,
  planetRadius: number
): Three.Vector2 {
  let position = new Three.Vector2(0, planetRadius + 10);
  return position.rotateAround(new Three.Vector2(0, 0), -angle);
}
