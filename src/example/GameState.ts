import * as Three from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import * as TWEEN from "@tweenjs/tween.js";
import Matter from "matter-js";
import { createNoise2D } from "simplex-noise";

import { MatterAttractors } from "./MatterAttractors";

import { EntityState } from "./Entity";
import { State } from "../StateMachine";
import { DEBUG, EventId, GameContext } from "./test";
import { clamp, computeNormalizedPosition } from "../utils";
import { House } from "./House";
import { barn, cow, house, tank, tree, World } from "./Worlds";
import { Entity } from "./Entity";
import { bulletCollisionCat } from "./physics";
import { Cow } from "./Cow";
import { Rock } from "./Rock";
import { Tree } from "./Tree";
import { Tank } from "./Tank";

const shipParams = {
  accelFactor: 1.22,
  maxSpeed: 14,
  friction: 0.9,
  slantFactorX: 0.028,
  slantFactorY: 0.031,

  rayMaxAngle: 0.2,
  rayAngleSpeedFactor: 0.3,
  attractRayOffScale: 0.1,
  beamOpenSpeed: 320,
  beamCloseSpeed: 160,

  beamForce: 0.016,
  shipSlurpDistance: 40,
  shipDespawnDistance: 20,
};

const cameraVerticalOffset = 200;

export class GameState extends State<GameContext, EventId> {
  scene: Three.Scene;

  cameraPivot: Three.Group;
  camera: Three.Camera;
  //composer: EffectComposer;
  carModel: Three.Object3D | undefined;

  ship: Three.Object3D;
  shipPhysics: Matter.Body;

  shipRay: Three.Mesh;
  shipRayPhysics: Matter.Body;

  rayHolder: Three.Group;

  tractorBeamLight: Three.SpotLight;

  soundBgm: Three.Audio | undefined;
  beamSfx: Three.Audio | undefined;
  shipSfx: Three.Audio | undefined;

  physics: Matter.Engine;
  physicsRenderer: Matter.Render;

  planetRadius: number = 1000;
  planetSpeed: number = 0.002;
  planetRotation: number = 0;

  shipVelocity: Three.Vector2;
  shipIsGrabbing: boolean = false;
  attractedEntities: Set<Entity> = new Set();

  world: World = new World();

  shipLife: number = 100;
  shipLifeDownFactor: number = 0.1;
  shipLifeBar: Three.Mesh;

  constructor(context: GameContext) {
    super();

    if (context.gui) {
      const shipOptions = context.gui.addFolder("Ship");
      shipOptions.add(shipParams, "accelFactor", 0, 2);
      shipOptions.add(shipParams, "maxSpeed", 0, 20);
      shipOptions.add(shipParams, "friction", 0.85, 1);
      shipOptions.add(shipParams, "slantFactorX", 0, 0.1);
      shipOptions.add(shipParams, "slantFactorY", 0, 0.1);

      const beamOptions = context.gui.addFolder("Beam");
      beamOptions.add(shipParams, "rayMaxAngle", 0, 0.5);
      beamOptions.add(shipParams, "rayAngleSpeedFactor", 0, 0.3);
      beamOptions.add(shipParams, "attractRayOffScale", 0, 0.1);
      beamOptions.add(shipParams, "beamOpenSpeed", 0, 500);
      beamOptions.add(shipParams, "beamCloseSpeed", 0, 500);

      const physicsOptions = context.gui.addFolder("Physics");
      physicsOptions.add(shipParams, "beamForce", 0, 0.02);
      physicsOptions.add(shipParams, "shipSlurpDistance", 0, 500);
      physicsOptions.add(shipParams, "shipDespawnDistance", 0, 100);

      const gameplayOptions = context.gui.addFolder("Gameplay");
      gameplayOptions.add(this, "shipLife", 0, 100);
    }

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

    // @ts-ignore
    Matter.use(MatterAttractors);

    this.physics = Matter.Engine.create();
    this.physics.gravity.scale = 0;

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

    // Background layers

    {
      const noise = createNoise2D();

      const layerColors = [0x3a0ca3, 0x480ca8, 0x560bad];

      for (let layer = 0; layer < 3; ++layer) {
        const layerHeight = this.planetRadius + 50 * (layer + 1);
        const layerHeightDelta = 25;

        const shape = new Three.Shape();

        const divs = 200;
        let step = (2 * Math.PI) / divs;

        for (let i = 0; i < divs; ++i) {
          const sample = i * (layer + 1) * 0.2;
          const height = layerHeight + layerHeightDelta * noise(sample, 0);

          const x = height * Math.cos(i * step);
          const y = height * Math.sin(i * step);
          if (i == 0) {
            shape.moveTo(x, y);
          } else {
            shape.lineTo(x, y);
          }
        }
        shape.closePath();

        const geometry = new Three.ShapeGeometry(shape);
        const material = new Three.MeshBasicMaterial({
          color: layerColors[layer],
        });
        const mesh = new Three.Mesh(geometry, material);
        // Move back layers to avoid clipping with entities geometry
        mesh.position.z = -(layer + 1) * 1000;
        this.scene.add(mesh);
      }
    }

    // Ship
    {
      this.ship = new Three.Group();
      this.ship.position.z = -this.camera.position.z;
      this.camera.add(this.ship);

      context.assets.onReady((assets) => {
        const shipModel = assets.model("ufo");
        this.ship.add(shipModel);
        shipModel.traverse((child) => {
          if (child instanceof Three.Mesh) {
            child.material = new Three.MeshLambertMaterial({
              color: 0x404040,
              emissive: 0x00404f,
            });
          }
        });
      });

      this.shipPhysics = Matter.Bodies.rectangle(0, 0, 160, 60, {
        isStatic: true,
        isSensor: true,
        collisionFilter: {
          mask: bulletCollisionCat,
          category: bulletCollisionCat,
        },
      });
      Matter.Composite.add(this.physics.world, [this.shipPhysics]);

      // React to bullet collisions

      Matter.Events.on(this.physics, "collisionStart", (event) => {
        const bulletCollisions = event.pairs.filter(
          (p) => p.bodyA == this.shipPhysics || p.bodyB == this.shipPhysics
        );

        if (bulletCollisions.length > 0) {
          for (const pair of bulletCollisions) {
            const bullet =
              pair.bodyA == this.shipPhysics ? pair.bodyB : pair.bodyA;

            this.shipLife -= 10;
            const bulletEntity = this.world.lookupEntity(bullet);
            if (bulletEntity) this.world.despawn(bulletEntity, this);
          }
        }
      });
    }

    // Ship life bar
    {
      const width = 120;

      const geometry = new Three.CapsuleGeometry(3, width, 8, 8);
      const material = new Three.MeshBasicMaterial({ color: 0x00ff00 });
      const capsule = new Three.Mesh(geometry, material);
      capsule.rotation.z = Math.PI / 2;
      capsule.position.y = -2;
      capsule.position.z = 90;

      this.shipLifeBar = capsule;
      this.ship.add(capsule);
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
      this.shipRay.scale.x = shipParams.attractRayOffScale;
      if (this.shipRay.material instanceof Three.MeshBasicMaterial)
        this.shipRay.material.color = new Three.Color(0x00ffff);

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

            const entity = this.world.entityFromPhysics(other);
            if (entity) {
              this.attractedEntities.add(entity);
              entity.grab();
            }
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

            other.frictionAir = 0.01;

            const entity = this.world.entityFromPhysics(other);
            if (entity) {
              this.attractedEntities.delete(entity);
              entity.release();
            }
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
      //spotLight.position.set(0, 0, 60);
      spotLight.castShadow = true;
      this.ship.add(spotLight);
    }

    // Tractor beam light
    {
      const spotLight = new Three.SpotLight(0x00ffff);
      spotLight.angle = Math.PI / 64;
      spotLight.penumbra = 0.8;
      spotLight.target = new Three.Object3D();
      spotLight.target.position.y = -200;
      //spotLight.target.position.z = 30;
      spotLight.castShadow = true;
      this.tractorBeamLight = spotLight;
      this.rayHolder.add(spotLight.target);
      this.rayHolder.add(spotLight);
    }

    // Physics debugger
    {
      if (DEBUG) {
        this.physicsRenderer = Matter.Render.create(
          {engine: this.physics,
           element: document.body,
           options: {
          width: 400,
          height: 400,
          hasBounds: true,
          showVelocity: true,
          showSleeping: true,
           }
          });
      } else {
        this.physicsRenderer = Matter.Render.create(
          {engine: this.physics});
      }
    }

    Matter.Render.lookAt(
      this.physicsRenderer,
      ground,
      Matter.Vector.create(200, 500)
    );
    Matter.Render.run(this.physicsRenderer);

    this.shipVelocity = new Three.Vector2(0, 0);

    // Start BGM if not already started (due to requiring an interaction)
    context.assets.onReady((assets) => {
      const listener = new Three.AudioListener();
      this.camera.add(listener);
      this.soundBgm = new Three.Audio(listener);
      this.soundBgm.setBuffer(assets.sound("bg"));
      this.soundBgm.setLoop(true);
      this.soundBgm.setVolume(0.5);
      this.soundBgm.play();

      this.beamSfx = new Three.Audio(listener);
      this.beamSfx.setBuffer(assets.sound("beam"));
      this.beamSfx.setLoop(true);
      this.beamSfx.setLoopStart(0.8);
      this.beamSfx.setLoopEnd(8.0);
      this.beamSfx.setVolume(0.09);

      this.shipSfx = new Three.Audio(listener);
      this.shipSfx.setBuffer(assets.sound("ship"));
      this.shipSfx.setLoop(true);
      this.shipSfx.setVolume(0.04);
      this.shipSfx.play();
    });
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
    // gravityDir.normalize();
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
      context.inputs.isKeyDown("KeyA") ||
      context.inputs.isKeyDown("ArrowLeft")
    ) {
      accel.x = -1;
    }
    if (
      context.inputs.isKeyDown("KeyD") ||
      context.inputs.isKeyDown("ArrowRight")
    ) {
      accel.x = +1;
    }
    if (
      context.inputs.isKeyDown("KeyW") ||
      context.inputs.isKeyDown("ArrowUp")
    ) {
      accel.y = +1;
    }
    if (
      context.inputs.isKeyDown("KeyS") ||
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

    const shipAngleX = this.shipVelocity.x * -shipParams.slantFactorX;
    this.ship.rotation.z = shipAngleX;
    const shipAngleY = this.shipVelocity.y * -shipParams.slantFactorY;
    this.ship.rotation.x = shipAngleY;

    // Move ray
    if (context.inputs.isButtonClicked(0)) {
      this.shipIsGrabbing = !this.shipIsGrabbing;

      if (this.shipIsGrabbing) {
        if (this.beamSfx)
          this.beamSfx.play();

        new TWEEN.Tween(this.shipRay.scale)
          .to({ x: 1 }, shipParams.beamOpenSpeed)
          .easing(TWEEN.Easing.Elastic.Out)
          .start();

        if (this.shipRay.material instanceof Three.MeshBasicMaterial)
          this.shipRay.material.color = new Three.Color(0x00ff00);
        this.tractorBeamLight.color = new Three.Color(0x00ff00);

        new TWEEN.Tween(this.tractorBeamLight)
          .to({ angle: Math.PI / 14 }, shipParams.beamOpenSpeed)
          .easing(TWEEN.Easing.Elastic.Out)
          .start();
      } else {
        if (this.beamSfx)
          this.beamSfx.stop();

        new TWEEN.Tween(this.shipRay.scale)
          .to({ x: shipParams.attractRayOffScale }, shipParams.beamCloseSpeed)
          .easing(TWEEN.Easing.Quadratic.Out)
          .start();

        if (this.shipRay.material instanceof Three.MeshBasicMaterial)
          this.shipRay.material.color = new Three.Color(0x00ffff);
        this.tractorBeamLight.color = new Three.Color(0x00ffff);

        new TWEEN.Tween(this.tractorBeamLight)
          .to({ angle: Math.PI / 64 }, shipParams.beamCloseSpeed)
          .easing(TWEEN.Easing.Quadratic.Out)
          .start();
      }
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
      rayAngle += Math.PI / 2 - shipAngleX;

      // Clamp rotation speed
      let d = rayAngle - this.rayHolder.rotation.z;
      d = clamp(
        d,
        -shipParams.rayAngleSpeedFactor,
        shipParams.rayAngleSpeedFactor
      );
      this.rayHolder.rotation.z += d;
      this.rayHolder.rotation.x = -shipAngleY;
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

    //

    if (this.attractedEntities.size > 0) {
      for (const entity of this.attractedEntities) {
        const bodyPos = new Three.Vector3(
          entity.physics.position.x,
          -entity.physics.position.y,
          0
        );

        const shipPos = coneWorldPos.clone();
        shipPos.z = 0;

        const bodyToShip = shipPos.sub(bodyPos);
        const distanceToShip = bodyToShip.length();
        bodyToShip.normalize();
        bodyToShip.multiplyScalar(shipParams.beamForce);

        if (this.shipIsGrabbing || entity.state > EntityState.BeingAbsorbed) {
          entity.physics.frictionAir = 1;

          Matter.Body.applyForce(
            entity.physics,
            entity.physics.position,
            Matter.Vector.create(bodyToShip.x, -bodyToShip.y)
          );

          if (distanceToShip < shipParams.shipDespawnDistance) {
            this.world.despawn(entity, this);
            this.attractedEntities.delete(entity);

            if (entity instanceof Cow) {
              this.shipLife += 10;
            } else if (entity instanceof Tree) {
              this.shipLife += 1;
            } else if (entity instanceof Rock) {
              if (entity.size >= 20) {
                this.shipLife -= 10;
              } else {
                this.shipLife -= 5;
              }
            } else if (entity instanceof Tank) {
              this.shipLife -= 8;
            }
          } else if (distanceToShip < shipParams.shipSlurpDistance) {
            entity.state == EntityState.BeingAbsorbed;
            const scale = distanceToShip / shipParams.shipSlurpDistance;

            entity.model.scale.x = scale;
            entity.model.scale.y = scale;
            entity.model.scale.z = scale;
          }
        } else {
          entity.physics.frictionAir = 0.01;
        }
      }
    }

    // Update ship life
    this.shipLife -= this.shipLifeDownFactor;
    this.shipLife = clamp(this.shipLife, 0, 100);
    this.shipLifeBar.scale.y = this.shipLife / 100;
    this.shipLifeBar.position.x = -60 + 60 * this.shipLifeBar.scale.y;

    if (this.shipLife == 0) {
      //doTransition("game_ended");
    }

    // Sync ship physics

    const worldShipPos = new Three.Vector3(0, 0, 0);
    this.ship.getWorldPosition(worldShipPos);

    Matter.Body.setPosition(this.shipPhysics, {
      x: worldShipPos.x,
      y: -worldShipPos.y,
    });

    Matter.Body.setAngle(this.shipPhysics, this.planetRotation);

    // const bodies = [
    //   this.conePhysics,
    //   ...this.world.spawnedEntities.map((e) => e.physics),
    // ];
    // const detector = Matter.Detector.create({ bodies });
    // console.log(Matter.Detector.collisions(detector));

    // Update

    TWEEN.update();
    Matter.Engine.update(this.physics, 1000 / 60);
    this.world.update(this, context);

    // Render

    context.renderer.render(this.scene, this.camera);
  }
}
