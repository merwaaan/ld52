import * as Three from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass";
import * as TWEEN from "@tweenjs/tween.js";
import Matter from "matter-js";
import { createNoise2D } from "simplex-noise";

import { MatterAttractors } from "./MatterAttractors";

import { EntityState } from "./Entity";
import { State } from "../StateMachine";
import { DEBUG, EventId, GameContext } from "./main";
import { clamp, computeNormalizedPosition, randomBetween } from "../utils";
import { House } from "./House";
import { barn, cow, house, tank, tree, World } from "./Worlds";
import { Entity } from "./Entity";
import { bulletCollisionCat } from "./physics";
import { Cow } from "./Cow";
import { Rock } from "./Rock";
import { Tree } from "./Tree";
import { Tank } from "./Tank";
import { bwMaterial, colors, bwMaterialUnlit, bw } from "./colors";

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

enum PlayState {
  IntroEnter,
  Intro,
  IntroExit,
  Playing,
};

export class GameState extends State<GameContext, EventId> {
  scene: Three.Scene;

  playState: PlayState;
  isPaused: boolean = false;
  circleMaskRadius: number;

  cameraPivot: Three.Group;
  camera: Three.Camera;
  composer: EffectComposer;

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
    this.scene.background = new Three.Color(bw(0.01));

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

    const ambientLight = new Three.AmbientLight(0xffffff, 0.12);
    //this.scene.add(ambientLight);

    // const light = new Three.DirectionalLight(0xffffff, 0.05);
    // light.position.set(-500, this.planetRadius + 500, 500);
    // light.target.position.set(0, 0, 0);
    // this.scene.add(light);

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
    const mat = bwMaterial(colors["ground"]);
    mat.flatShading = true;
    const circle = new Three.Mesh(geometry, mat);
    this.scene.add(circle);

    // Background layers

    {
      const noise = createNoise2D();

      const layerColors = [colors["bg1"], colors["bg2"], colors["bg3"]];
      const layerHeights = [70, 120, 150];
      const layerHeightDeltas = [25, 10, 10];

      for (let layer = 0; layer < layerColors.length; ++layer) {
        const layerHeight = this.planetRadius + layerHeights[layer];
        const layerHeightDelta = layerHeightDeltas[layer];

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
        const material = bwMaterialUnlit(layerColors[layer]);
        const mesh = new Three.Mesh(geometry, material);

        // Move back layers to avoid clipping with entities geometry
        mesh.position.z = -(layer + 1) * 1000;
        this.scene.add(mesh);
      }
    }

    // Moon

    {
      const g = new Three.SphereGeometry(200);
      const m = new Three.MeshBasicMaterial({ color: bw(0.9) });
      const moon = new Three.Mesh(g, m);
      this.camera.add(moon);
      moon.position.set(-400, 300, -5000);

      const light = new Three.PointLight(0xffffff, 1, 2000);
      light.position.set(-900, 1000, 100);
      this.camera.add(light);
    }

    // Clouds

    {
      context.assets.onReady((assets) => {
        // @ts-ignore
        const cloud = (texName) => {
          const map = assets.texture(texName);
          const material = new Three.SpriteMaterial({
            map: map,
            opacity: randomBetween(0.3, 0.7),
          });
          const sprite = new Three.Sprite(material);

          const sw = 700;

          const x = randomBetween(-sw, sw);
          const y = randomBetween(50, 300);
          sprite.position.set(x, y, -500);

          const s = randomBetween(1, 2);
          sprite.scale.setScalar(s * 300);

          sprite.rotateZ(Math.random() * 2 * Math.PI);

          this.camera.add(sprite);

          const destx = randomBetween(-sw, sw);
          const speed = randomBetween(30000, 60000);

          new TWEEN.Tween(sprite.position)
            .to({ x: destx }, speed)
            .yoyo(true)
            .repeat(Infinity)
            //.easing(TWEEN.Easing.Elastic.Out)
            .start();
        };

        const c = 2;
        for (let i = 0; i < c; ++i) cloud("cloud1");
        for (let i = 0; i < c; ++i) cloud("cloud2");
        for (let i = 0; i < c; ++i) cloud("cloud3");

        const star = () => {
          const col = bw(randomBetween(0.8, 0.95));
          const g = new Three.BoxGeometry(1, 1, 1);
          const m = new Three.MeshBasicMaterial({ color: col });
          const obj = new Three.Mesh(g, m);

          const sw = 700;
          const x = randomBetween(-sw, sw);
          const y = randomBetween(0, 300);
          obj.position.set(x, y, -600);

          const s = randomBetween(1, 4);
          obj.scale.setScalar(s);

          obj.rotateZ(Math.random() * 2 * Math.PI);

          this.camera.add(obj);
        };

        for (let i = 0; i < 20; ++i) star();
      });
    }

    // Ship
    {
      this.ship = new Three.Group();
      this.ship.position.z = -this.camera.position.z;
      this.camera.add(this.ship);

      context.assets.onReady((assets) => {
        const shipModel = assets.model("ufo");
        this.ship.add(shipModel);

        // Materials

        /*shipModel.traverse((child) => {
          if (child instanceof Three.Mesh) {
            child.material = bwMaterial(0.6);
          }
        });*/

        const applyMat = (
          nodeName: string,
          matData: Three.MeshPhongMaterialParameters
        ) => {
          const node = this.ship.getObjectByName(nodeName) as
            | Three.Mesh
            | undefined;
          if (node) {
            node.material = new Three.MeshPhongMaterial(matData);
          }
        };

        applyMat("base", {
          emissive: 0x505050,
          specular: 0xffffff,
          shininess: 80,
        });

        applyMat("dome", {
          transparent: true,
          opacity: 0.3,
          specular: 0xffffff,
          shininess: 60,
        });

        applyMat("eye1", {
          emissive: 0xff0000,
        });

        applyMat("eye2", {
          emissive: 0xff0000,
        });

        const head = this.ship.getObjectByName("head") as
          | Three.Mesh
          | undefined;
        if (head) {
          head.material = bwMaterial(0.6);
        }

        const eye = this.ship.getObjectByName("eye");
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
        this.physicsRenderer = Matter.Render.create({
          engine: this.physics,
          element: document.body,
          options: {
            width: 400,
            height: 400,
            hasBounds: true,
            showVelocity: true,
            showSleeping: true,
          },
        });
      } else {
        this.physicsRenderer = Matter.Render.create({ engine: this.physics });
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
      //this.shipSfx.play();
    });

    // Post

    this.composer = new EffectComposer(context.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    const filmPass = new FilmPass(0.6, 0, 100, 0);
    const bloomPass = new UnrealBloomPass(
      new Three.Vector2(
        context.renderer.domElement.width,
        context.renderer.domElement.height
      ),
      0.5,
      0.2,
      0.2
    );
    this.composer.addPass(renderPass);
    //this.composer.addPass(bloomPass);
    this.composer.addPass(filmPass);

    this.circleMaskRadius = 80;
    this.playState = PlayState.IntroEnter;
    this.isPaused = true;
  }

  enter(context: GameContext) {}
  exit(context: GameContext) {}

  updateUI(context: GameContext) {
    if (this.playState == PlayState.Intro) {
      context.ui.globalCompositeOperation = 'source-over';
      context.ui.fillStyle = '#000';
      context.ui.fillRect(0, 0, 800, 600);

      context.ui.globalCompositeOperation = 'destination-out';
      context.ui.fillStyle = '#fff';

      context.ui.beginPath();
      context.ui.arc(400, 300, this.circleMaskRadius, 0, Math.PI*2);
      context.ui.fill();

      if (this.circleMaskRadius >= 400) {
        this.playState = PlayState.IntroExit;
      }
    } else if (this.playState == PlayState.IntroExit) {
      context.ui.clearRect(0, 0, 800, 600);
    }
  }

  update(context: GameContext, doTransition: (eventId: EventId) => void) {
    if (this.playState == PlayState.IntroEnter) {
      const f0 = new TWEEN.Tween(this)
        .to({ circleMaskRadius: 200 }, 2500)
        .easing(TWEEN.Easing.Cubic.Out)
        .delay(3500);

      const f1 = new TWEEN.Tween(this)
        .to({ circleMaskRadius: 600 }, 3000)
        .easing(TWEEN.Easing.Cubic.Out)
        .delay(3000);

      f0.chain(f1).start();

      this.playState = PlayState.Intro;
    }
    else if (this.playState == PlayState.IntroExit) {
      this.isPaused = false;
    }

    this.updateUI(context);

    // Rotate the camera

    if (!this.isPaused) {
      const deltaRotation = this.planetSpeed; // TODO dt
      this.planetRotation += deltaRotation;
      this.cameraPivot.rotateZ(-deltaRotation);
    }

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

    if (!this.isPaused) {
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
    }

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
    if (!this.isPaused) {
      if (context.inputs.isButtonClicked(0)) {
        this.shipIsGrabbing = !this.shipIsGrabbing;

        if (this.shipIsGrabbing) {
          if (this.beamSfx) {
            this.beamSfx.play();
          }

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
          if (this.beamSfx) {
            this.beamSfx.stop();
          }

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
    if (!this.isPaused) {
      this.shipLife -= this.shipLifeDownFactor;
      this.shipLife = clamp(this.shipLife, 0, 100);
      this.shipLifeBar.scale.y = this.shipLife / 100;
      this.shipLifeBar.position.x = -60 + 60 * this.shipLifeBar.scale.y;
    }

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

    this.composer.render();
    //context.renderer.render(this.scene, this.camera);
  }
}
