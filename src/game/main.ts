import * as THREE from "three";
import * as dat from "dat.gui";
import Stats from "stats.js";
import { Assets } from "../Assets";
import { Inputs } from "../Inputs";
import { loop } from "../loop";

import { StateMachine } from "../StateMachine";
import { GameState } from "./GameState";
import { MenuState as LoadState } from "./LoadState";

// Assets

import barnModelPath from "url:./assets/barn.obj";
import cowModelPath from "url:./assets/cow.glb";
import humanModelPath from "url:./assets/human.glb";
import rockModelPath from "url:./assets/rock.obj";
import tankModelPath from "url:./assets/tank.glb";
import treeModelPath from "url:./assets/tree.obj";
import ufoModelPath from "url:./assets/ufo.obj";

import bgSfxPath from "url:./assets/sfx/bg.ogg";
import beamSfxPath from "url:./assets/sfx/beam.ogg";
import shipSfxPath from "url:./assets/sfx/ship.ogg";

const assets = new Assets({
  models: {
    barn: barnModelPath,
    cow: cowModelPath,
    human: humanModelPath,
    rock: rockModelPath,
    tank: tankModelPath,
    tree: treeModelPath,
    ufo: ufoModelPath,
  },

  sounds: {
    bg: bgSfxPath,
    beam: beamSfxPath,
    ship: shipSfxPath,
  },
});

// Setup game

export const DEBUG = false;

export type GameContext = {
  renderer: THREE.WebGLRenderer;
  inputs: Inputs;
  gui: dat.GUI | undefined;
  assets: typeof assets;
};

export type StateId = "load" | "game";
export type EventId = "game_started" | "game_ended";

function setup() {
  document.removeEventListener("click", setup);
  const startPrompt = document.getElementById("startPrompt");
  if (startPrompt)
    startPrompt.style.display = 'none';

  const gameContext: GameContext = {
    renderer: new THREE.WebGLRenderer({ antialias: true }),
    inputs: new Inputs(),
    gui: DEBUG ? new dat.GUI() : undefined,
    assets,
  };

  gameContext.renderer.setSize(800, 600);
  gameContext.renderer.setClearColor(0x0, 1);
  document
    .getElementById("container")
    ?.appendChild(gameContext.renderer.domElement);
  gameContext.renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  // Setup states
  const machine = new StateMachine<GameContext, StateId, EventId>(gameContext, {
    initial: "load",
    states: {
      load: {
        state: new LoadState(),
        transitions: [{ event: "game_started", target: "game" }],
      },
      game: {
        state: new GameState(gameContext),
        transitions: [{ event: "game_ended", target: "load" }],
      },
    },
  });

  // Run
  let g_stats: Stats | undefined;
  if (DEBUG) {
    g_stats = new Stats();
    g_stats.showPanel(1);
    document.body.appendChild(g_stats.dom);
  }

  loop(() => {
    if (g_stats) g_stats.begin();
    machine.update(gameContext);
    gameContext.inputs.update();
    if (g_stats) g_stats.end();
  });
}

document.addEventListener("click", setup);
