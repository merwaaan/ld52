import * as Three from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import * as TWEEN from "@tweenjs/tween.js";
import Matter from "matter-js";

import { State } from "../StateMachine";
import { EventId, GameContext } from "./test";
import { computeNormalizedPosition } from "../utils";
import { House } from "./House";
import { cow, house, World } from "./Worlds";

const shipParams = {
  accelFactor: 0.01,
  maxSpeed: 0.1,
  friction: 0.93,
  slantFactor: 1,
  rayMaxAngle: 0.2,
  rayAngleSpeedFactor: 0.03,
};

const cameraVerticalOffset = 200;

export class GameState extends State<GameContext, EventId> {
  scene: Three.Scene;

  cameraPivot: Three.Group;
  camera: Three.Camera;
  //composer: EffectComposer;
  carModel: THREE.Object3D | undefined;
  cube: THREE.Object3D;
  cone: THREE.Object3D;

  rayHolder: THREE.Group;

  physics: Matter.Engine;
  physicsRenderer: Matter.Render;

  planetRadius: number = 1000;
  planetSpeed: number = 0.0005 * 3;
  planetRotation: number = 0;

  shipVelocity: Three.Vector2;

  world: World = new World([
    house(-0.02),
    house(0),
    house(0.03),
    cow(0.06),
    cow(0.08),
    cow(0.09),
    cow(0.1),
  ]);

  constructor(context: GameContext) {
    super();

    context.gui.add(shipParams, "accelFactor", 0, 0.2);
    context.gui.add(shipParams, "maxSpeed", 0, 0.1);
    context.gui.add(shipParams, "friction", 0.7, 1);
    context.gui.add(shipParams, "slantFactor", 0, 10);
    context.gui.add(shipParams, "rayMaxAngle", 0, 0.5);
    context.gui.add(shipParams, "rayAngleSpeedFactor", 0, 0.1);

    // Setup scene

    this.scene = new Three.Scene();

    this.camera = new Three.PerspectiveCamera(
      70,
      1,
      0.01,
      this.planetRadius + cameraVerticalOffset
    );
    this.camera.position.z = 500;
    this.camera.position.y = this.planetRadius;
    this.camera.lookAt(
      new Three.Vector3(0, this.planetRadius + cameraVerticalOffset, 0)
    );

    this.cameraPivot = new Three.Group();
    this.cameraPivot.add(this.camera);
    this.scene.add(this.cameraPivot);

    const ambientLight = new Three.AmbientLight("white");
    this.scene.add(ambientLight);

    const axesHelper = new Three.AxesHelper(50);
    this.scene.add(axesHelper);

    this.physics = Matter.Engine.create();

    var ground = Matter.Bodies.circle(
      0,
      0,
      this.planetRadius,
      {
        isStatic: true,
      },
      100
    );
    Matter.Composite.add(this.physics.world, [ground]);

    {
      const geometry = new Three.BoxGeometry(4, 1, 0.1);
      const material = new Three.MeshBasicMaterial({ color: 0x00ff00 });
      this.cube = new Three.Mesh(geometry, material);
      this.scene.add(this.cube);
    }
    const geometry = new Three.CircleGeometry(this.planetRadius, 100);
    const material = new Three.MeshBasicMaterial({ color: 0xffff00 });
    const circle = new Three.Mesh(geometry, material);
    this.scene.add(circle);

    {
      const width = 3;
      const height = 40;
      const geometry = new Three.ConeGeometry(width, height, 32);
      const material = new Three.MeshBasicMaterial({ color: 0xffff00 });
      material.transparent = true;
      material.opacity = 0.5;
      this.cone = new Three.Mesh(geometry, material);
      this.cone.position.y = -height / 2;
      // Physics debugger

      this.rayHolder = new Three.Group();
      this.rayHolder.add(this.cone);
      this.rayHolder.rotation.z = 2 * Math.PI;
      this.cube.add(this.rayHolder);
    }
    this.physicsRenderer = Matter.Render.create({
      engine: this.physics,
      element: document.body,
      options: {
        width: 400,
        height: 400,
        hasBounds: true,
        showVelocity: true,
      },
    });

    Matter.Render.lookAt(
      this.physicsRenderer,
      ground,
      Matter.Vector.create(300, 300)
    );
    Matter.Render.run(this.physicsRenderer);

    this.shipVelocity = new Three.Vector2(0, 0);
  }

  enter(context: GameContext) {}

  exit(context: GameContext) {}

  update(context: GameContext, doTransition: (eventId: EventId) => void) {
    // Rotate the camera

    const deltaRotation = this.planetSpeed; // TODO dt
    this.planetRotation += deltaRotation;
    this.cameraPivot.rotateZ(-deltaRotation);

    // Redirect gravity

    // const gravityDir = new Three.Vector2(0, 1);
    // gravityDir.rotateAround(new Three.Vector2(0, 0), this.planetRotation);
    // this.physics.gravity.x = gravityDir.x;
    // this.physics.gravity.y = gravityDir.y;

    // Click = jump!

    const cursor = context.inputs.cursorPosition;

    const normalizedCursor = computeNormalizedPosition(
      cursor,
      context.renderer.domElement
    );

    const viewCursor = new Three.Vector2(
      normalizedCursor[0] * 2 - 1,
      -normalizedCursor[1] * 2 + 1
    );

    const raycaster = new Three.Raycaster();
    raycaster.setFromCamera(viewCursor, this.camera);

    if (context.inputs.isButtonClicked(0)) {
      for (const entity of this.world.spawnedEntities) {
        const intersections = raycaster.intersectObject(entity.model);

        if (intersections.length > 0) {
          Matter.Body.setStatic(entity.physics, false);

          Matter.Body.applyForce(
            entity.physics,
            entity.physics.position,
            Matter.Vector.create(0, -0.1)
          );
        }
      }
    }

    // Update

    Matter.Engine.update(this.physics, 1000 / 60);
    this.world.update(this);

    // Render

    context.renderer.render(this.scene, this.camera);
  }
}
