import * as Three from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import * as TWEEN from "@tweenjs/tween.js";
import Matter from "matter-js";

import { State } from "../StateMachine";
import { EventId, GameContext } from "./test";
import { clamp, computeNormalizedPosition } from "../utils";
import { House } from "./House";
import { cow, house, rock, tree, World } from "./Worlds";

const shipParams = {
  accelFactor: 0.5,
  maxSpeed: 2.3,
  friction: 0.93,
  slantFactor: 0.05,
  rayMaxAngle: 0.2,
  rayAngleSpeedFactor: 0.1,
  attractRayOffScale: 0.1,
};

const cameraVerticalOffset = 200;

export class GameState extends State<GameContext, EventId> {
  scene: Three.Scene;

  cameraPivot: Three.Group;
  camera: Three.Camera;
  //composer: EffectComposer;
  carModel: Three.Object3D | undefined;

  ship: Three.Object3D;
  shipRay: Three.Mesh;
  shipRayPhysics: Matter.Body;

  rayHolder: Three.Group;

  tractorBeamLight: Three.SpotLight;

  physics: Matter.Engine;
  physicsRenderer: Matter.Render;

  planetRadius: number = 1000;
  planetSpeed: number = 0.0005;
  planetRotation: number = 0;

  shipVelocity: Three.Vector2;
  shipIsGrabbing: boolean = false;
  attractedBodies: Set<Matter.Body> = new Set();

  world: World = new World([
    tree(0),
    rock(-0.02),
    // house(0),
    // house(0.03),
    // cow(0.06),
    // cow(0.08),
    // cow(0.09),
    // cow(0.1),
  ]);

  constructor(context: GameContext) {
    super();

    const shipOptions = context.gui.addFolder("Ship");
    shipOptions.add(shipParams, "accelFactor", 0, 1);
    shipOptions.add(shipParams, "maxSpeed", 0, 3);
    shipOptions.add(shipParams, "friction", 0.85, 1);
    shipOptions.add(shipParams, "slantFactor", 0, 0.1);
    shipOptions.add(shipParams, "rayMaxAngle", 0, 0.5);
    shipOptions.add(shipParams, "rayAngleSpeedFactor", 0, 0.1);
    shipOptions.add(shipParams, "attractRayOffScale", 0, 0.1);

    // Setup scene

    this.scene = new Three.Scene();

    this.camera = new Three.OrthographicCamera(
      -context.renderer.domElement.width / 2,
      context.renderer.domElement.width / 2,
      context.renderer.domElement.height / 2,
      -context.renderer.domElement.height / 2,
      0.01,
      10000
    );
    this.camera.position.z = 500;
    this.camera.lookAt(new Three.Vector3(0, 0, 0));
    this.camera.position.y = this.planetRadius + 200;

    this.cameraPivot = new Three.Group();
    this.cameraPivot.add(this.camera);
    this.scene.add(this.cameraPivot);

    const ambientLight = new Three.AmbientLight(0x202020);
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

    // Ground
    const geometry = new Three.SphereGeometry(this.planetRadius, 64, 64);
    const material = new Three.MeshLambertMaterial({
      color: 0xffff80,
      emissive: 0x000000,
    });
    material.flatShading = true;
    //material.wireframe = true;
    const circle = new Three.Mesh(geometry, material);
    this.scene.add(circle);

    // Ship
    {
      this.ship = new Three.Group();
      this.ship.position.z = -this.camera.position.z;
      this.camera.add(this.ship);

      context.assets.onReady((assets) => {
        const shipModel = assets.model("ufo");
        this.ship.add(shipModel);
      });
    }

    // Tractor beam
    {
      const width = 180;
      const height = 1000;
      const geometry = new Three.ConeGeometry(width, height, 32);
      const material = new Three.MeshBasicMaterial({ color: 0xffff00 });
      material.transparent = true;
      material.opacity = 0.5;
      this.shipRay = new Three.Mesh(geometry, material);
      this.shipRay.position.y = -height / 2;

      this.shipRayPhysics = Matter.Bodies.fromVertices(
        0,
        0,
        [
          [
            { x: 0, y: 0 },
            { x: width / 2, y: height },
            { x: -width / 2, y: height },
          ],
        ],
        {
          isStatic: true,
          isSensor: true,
        }
      );
      Matter.Body.setCentre(
        this.shipRayPhysics,
        Matter.Vector.create(0, -height / 2),
        true
      );
      Matter.Composite.add(this.physics.world, this.shipRayPhysics);

      Matter.Events.on(this.physics, "collisionStart", (event) => {
        const rayCollisions = event.pairs.filter(
          (p) =>
            p.bodyA == this.shipRayPhysics || p.bodyB == this.shipRayPhysics
        );

        if (rayCollisions.length > 0) {
          for (const pair of rayCollisions) {
            const other =
              pair.bodyA == this.shipRayPhysics ? pair.bodyB : pair.bodyA;

            this.attractedBodies.add(other);
          }
        }
      });

      Matter.Events.on(this.physics, "collisionEnd", (event) => {
        const rayCollisions = event.pairs.filter(
          (p) =>
            p.bodyA == this.shipRayPhysics || p.bodyB == this.shipRayPhysics
        );

        if (rayCollisions.length > 0) {
          for (const pair of rayCollisions) {
            const other =
              pair.bodyA == this.shipRayPhysics ? pair.bodyB : pair.bodyA;

            this.attractedBodies.delete(other);
          }
        }
      });

      this.rayHolder = new Three.Group();
      this.rayHolder.add(this.shipRay);
      this.rayHolder.rotation.z = 2 * Math.PI;
      this.ship.add(this.rayHolder);
    }

    // Ship light
    {
      const spotLight = new Three.SpotLight(0x00a0af);
      spotLight.angle = Math.PI / 6;
      spotLight.intensity = 0.5;
      spotLight.penumbra = 0.2;
      spotLight.position.set(0, 0, 60);
      spotLight.target = circle;
      spotLight.castShadow = true;
      this.ship.add(spotLight);
    }

    // Tractor beam light
    {
      const spotLight = new Three.SpotLight(0x00ff00);
      spotLight.angle = Math.PI / 12;
      spotLight.penumbra = 0.8;
      spotLight.position.set(0, 0, 60);
      spotLight.target = circle;
      spotLight.castShadow = true;
      this.tractorBeamLight = spotLight;
      this.ship.add(spotLight);
    }

    // Physics debugger
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
      Matter.Vector.create(200, 500)
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

    // if (context.inputs.isButtonClicked(0)) {
    //   for (const entity of this.world.spawnedEntities) {
    //     const intersections = raycaster.intersectObject(entity.model);

    //     if (intersections.length > 0) {
    //       Matter.Body.setStatic(entity.physics, false);

    //       Matter.Body.applyForce(
    //         entity.physics,
    //         entity.physics.position,
    //         Matter.Vector.create(0, -0.1)
    //       );
    //     }
    //   }
    // }

    // Move ship
    const accel = new Three.Vector2(0, 0);

    if (
      context.inputs.isKeyDown("a") ||
      context.inputs.isKeyDown("ArrowLeft")
    ) {
      accel.x = -1;
    }
    if (
      context.inputs.isKeyDown("s") ||
      context.inputs.isKeyDown("ArrowRight")
    ) {
      accel.x = +1;
    }
    if (context.inputs.isKeyDown("w") || context.inputs.isKeyDown("ArrowUp")) {
      accel.y = +1;
    }
    if (
      context.inputs.isKeyDown("r") ||
      context.inputs.isKeyDown("ArrowDown")
    ) {
      accel.y = -1;
    }

    accel.normalize().multiplyScalar(shipParams.accelFactor);

    this.shipVelocity.add(accel);
    this.shipVelocity.multiplyScalar(shipParams.friction);
    if (this.shipVelocity.length() < 0.001) {
      this.shipVelocity.x = 0;
      this.shipVelocity.y = 0;
    }
    this.shipVelocity.x = clamp(
      this.shipVelocity.x,
      -shipParams.maxSpeed,
      shipParams.maxSpeed
    );
    this.shipVelocity.y = clamp(
      this.shipVelocity.y,
      -shipParams.maxSpeed,
      shipParams.maxSpeed
    );

    this.ship.position.x += this.shipVelocity.x;
    this.ship.position.y += this.shipVelocity.y;

    const shipBoundsX = 350;
    const shipBoundsY = [-180, 280];

    this.ship.position.x = clamp(
      this.ship.position.x,
      -shipBoundsX,
      shipBoundsX
    );
    this.ship.position.y = clamp(
      this.ship.position.y,
      shipBoundsY[0],
      shipBoundsY[1]
    );

    const shipAngle = this.shipVelocity.x * shipParams.slantFactor;
    this.ship.rotation.z = shipAngle;

    // Move ray
    if (context.inputs.isButtonClicked(0)) {
      this.shipIsGrabbing = !this.shipIsGrabbing;
    }

    if (this.shipIsGrabbing) {
      this.shipRay.scale.x = 1;
      if (this.shipRay.material instanceof Three.MeshBasicMaterial)
        this.shipRay.material.color = new Three.Color(0x00ff00);
      this.tractorBeamLight.color = new Three.Color(0x00ff00);
      this.tractorBeamLight.angle = Math.PI / 14;
    } else {
      this.shipRay.scale.x = shipParams.attractRayOffScale;
      if (this.shipRay.material instanceof Three.MeshBasicMaterial)
        this.shipRay.material.color = new Three.Color(0x00ffff);
      this.tractorBeamLight.color = new Three.Color(0x00ffff);
      this.tractorBeamLight.angle = Math.PI / 64;
    }

    const worldShipPosition = new Three.Vector3();
    this.ship.getWorldPosition(worldShipPosition);
    worldShipPosition.project(this.camera);

    const normalShipPosition = new Three.Vector2(
      worldShipPosition.x,
      worldShipPosition.y
    );

    const shipToCursor = viewCursor.clone().sub(normalShipPosition);
    shipToCursor.normalize();
    let rayAngle = shipToCursor.angle();
    if (rayAngle > Math.PI) {
      rayAngle = clamp(
        rayAngle,
        Math.PI * (1 + shipParams.rayMaxAngle),
        Math.PI * (2 - shipParams.rayMaxAngle)
      );
      // Adjust for initial angle + ship slant offset
      rayAngle += Math.PI / 2 - shipAngle;

      // Clamp rotation speed
      let dt = rayAngle - this.rayHolder.rotation.z;
      dt = clamp(
        dt,
        -shipParams.rayAngleSpeedFactor,
        shipParams.rayAngleSpeedFactor
      );
      this.rayHolder.rotation.z += dt;
    }

    const coneWorldPos = new Three.Vector3();
    this.ship.getWorldPosition(coneWorldPos);
    Matter.Body.setPosition(this.shipRayPhysics, {
      x: coneWorldPos.x,
      y: -coneWorldPos.y,
    });
    Matter.Body.setAngle(
      this.shipRayPhysics,
      this.planetRotation - this.rayHolder.rotation.z
    );

    if (this.attractedBodies.size > 0) {
      for (const body of this.attractedBodies) {
        const bodyPos = new Three.Vector3(body.position.x, -body.position.y, 0);

        const shipPos = coneWorldPos.clone();
        shipPos.z = 0;

        const bodyToShip = shipPos.sub(bodyPos);
        bodyToShip.normalize();
        bodyToShip.multiplyScalar(0.003);

        Matter.Body.applyForce(
          body,
          body.position,
          Matter.Vector.create(bodyToShip.x, -bodyToShip.y)
        );
      }
    }

    // const bodies = [
    //   this.conePhysics,
    //   ...this.world.spawnedEntities.map((e) => e.physics),
    // ];
    // const detector = Matter.Detector.create({ bodies });
    // console.log(Matter.Detector.collisions(detector));

    // Update

    Matter.Engine.update(this.physics, 1000 / 60);
    this.world.update(this, context);

    // Render

    context.renderer.render(this.scene, this.camera);
  }
}
