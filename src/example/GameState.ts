import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import * as TWEEN from "@tweenjs/tween.js";

import { State } from "../StateMachine";
import { EventId, GameContext } from "./test";
import { clamp, computeNormalizedPosition } from "../utils";

export class GameState extends State<GameContext, EventId> {
  scene: THREE.Scene;
  camera: THREE.Camera;
  composer: EffectComposer;

  carModel: THREE.Object3D | undefined;
  cube: THREE.Object3D;
  cone: THREE.Object3D;

  startupSound: THREE.Audio | undefined;
  engineSound: THREE.Audio | undefined;

  constructor(context: GameContext) {
    super();

    // Setup scene

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(90, 1, 0.01, 100);
    this.camera.position.z = 10;
    this.camera.position.y = 0;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    const ambientLight = new THREE.AmbientLight("white");
    this.scene.add(ambientLight);

    this.composer = new EffectComposer(context.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        context.renderer.domElement.width,
        context.renderer.domElement.height
      ),
      0.5,
      0.2,
      0.2
    );
    //this.composer.addPass(bloomPass);

    {
      const geometry = new THREE.BoxGeometry(4,1,0.1);
      const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
      this.cube = new THREE.Mesh(geometry, material);
      this.scene.add(this.cube);
    }

    {
      const geometry = new THREE.ConeGeometry(1, 10, 32);
      const material = new THREE.MeshBasicMaterial({color: 0xffff00});
      material.transparent = true;
      material.opacity = 0.5;
      this.cone = new THREE.Mesh(geometry, material);
      this.cone.position.x = 0;
      this.cone.position.y = -5;
      this.cone.position.z = 0;

      //this.cone.rotation.z = 1;
      this.cube.add(this.cone);
    }

    // context.assets.onReady((assets) => {
    //   // Load the car

    //   this.carModel = assets.model("carModel");
    //   const carTexture = assets.texture("carTexture");

    //   this.carModel.traverse((child) => {
    //     if (child instanceof THREE.Mesh) {
    //       child.material.map = carTexture;
    //     }
    //   });

    //   //this.scene.add(this.carModel);

    //   // Setup animations

    //   this.carModel.rotation.y = -1;

    //   new TWEEN.Tween(this.carModel.rotation)
    //     .to({ y: 1 }, 10000)
    //     .yoyo(true)
    //     .repeat(Infinity)
    //     .easing(TWEEN.Easing.Quadratic.InOut)
    //     .start();

    //   new TWEEN.Tween(this.carModel.scale)
    //     .to({ y: 1.05 }, 100)
    //     .yoyo(true)
    //     .repeat(Infinity)
    //     .start();

    //   // Sounds

    //   const listener = new THREE.AudioListener();

    //   this.startupSound = new THREE.Audio(listener);
    //   this.startupSound.setBuffer(assets.sound("carStartupSound"));

    //   this.engineSound = new THREE.Audio(listener);
    //   this.engineSound.setBuffer(assets.sound("carEngineSound"));
    // });
  }

  enter(context: GameContext) {
    this.startupSound?.play();
    this.engineSound?.play();
  }

  exit(context: GameContext) {
    this.startupSound?.stop();
    this.engineSound?.stop();
  }

  update(context: GameContext, doTransition: (eventId: EventId) => void) {
    TWEEN.update();

    // if (this.carModel) {
    //   // Hover object = change color

    //   const cursor = context.inputs.cursorPosition;

    //   const normalizedCursor = computeNormalizedPosition(
    //     cursor,
    //     context.renderer.domElement
    //   );

    //   const viewCursor = new THREE.Vector2(
    //     normalizedCursor[0] * 2 - 1,
    //     -normalizedCursor[1] * 2 + 1
    //   );

    //   const raycaster = new THREE.Raycaster();
    //   raycaster.setFromCamera(viewCursor, this.camera);
    //   const intersections = raycaster.intersectObject(this.carModel);

    //   const color = new THREE.Color(
    //     intersections.length > 0 ? "yellow" : "white"
    //   );

    //   this.carModel.traverse((child) => {
    //     if (child instanceof THREE.Mesh) {
    //       child.material.color = color;
    //     }
    //   });

    //   // Click object = exit game

    //   const click = context.inputs.isButtonClicked(0);

    //   if (click && intersections.length > 0) {
    //     doTransition("game_ended");
    //   }
    // }

    const cursor = context.inputs.cursorPosition;

    const normalizedCursor = computeNormalizedPosition(
      cursor,
      context.renderer.domElement
    );

    const angleFactor = 1;
    const shipAngle = (normalizedCursor[0] - 0.5) * angleFactor;
    this.cube.rotation.z = shipAngle;

    if (context.inputs.isKeyDown('a')) {
      this.cube.position.x -= 0.1;
    }
    if (context.inputs.isKeyDown('s')) {
      this.cube.position.x += 0.1;
    }
    if (context.inputs.isKeyDown('w')) {
      this.cube.position.y += 0.1;
    }
    if (context.inputs.isKeyDown('r')) {
      this.cube.position.y -= 0.1;
    }

    this.cube.position.x = clamp(this.cube.position.x, -10, 10);
    this.cube.position.y = clamp(this.cube.position.y, -10, 10);

    // Render

    //context.renderer.render(this.scene, this.camera);
    this.composer.render();
  }
}
