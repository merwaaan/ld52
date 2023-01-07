import * as THREE from "three";
import { Assets } from "../Assets";
import { Inputs } from "../Inputs";
import { loop } from "../loop";

import { StateMachine } from "../StateMachine";
import { GameState } from "./GameState";
import { MenuState } from "./MenuState";

// Assets

import carModelPath from "url:./assets/car/Car3.obj";
import carTexturePath from "url:./assets/car/car3.png";
import carStartupSoundPath from "url:./assets/car/Car_Engine_Start_Up.ogg";
import carEngineSoundPath from "url:./assets/car/Car_Engine_Loop.ogg";

const assets = new Assets({
  models: {
    carModel: carModelPath,
  },
  textures: {
    carTexture: carTexturePath,
  },
  sounds: {
    carStartupSound: carStartupSoundPath,
    carEngineSound: carEngineSoundPath,
  },
});

//const carModel = assets.model("carModel");
//const carEngineSound = assets.sound("carEngineSound");

// Setup game

export type GameContext = {
  renderer: THREE.WebGLRenderer;
  inputs: Inputs;
  assets: typeof assets;
};

const gameContext: GameContext = {
  renderer: new THREE.WebGLRenderer({ antialias: true }),
  inputs: new Inputs(),
  assets,
};

gameContext.renderer.setSize(800, 600);
gameContext.renderer.setClearColor(0x0, 1);
document.body.appendChild(gameContext.renderer.domElement);

// Setup states

export type StateId = "menu" | "game";
export type EventId = "game_started" | "game_ended";

const machine = new StateMachine<GameContext, StateId, EventId>(gameContext, {
  initial: "menu",
  states: {
    menu: {
      state: new MenuState(),
      transitions: [{ event: "game_started", target: "game" }],
    },
    game: {
      state: new GameState(gameContext),
      transitions: [{ event: "game_ended", target: "menu" }],
    },
  },
});

// Run

loop(() => {
  machine.update(gameContext);
  gameContext.inputs.update();
});
