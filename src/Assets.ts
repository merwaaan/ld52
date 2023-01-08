import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

type AudioBuffer = NonNullable<THREE.Audio["buffer"]>;

// Collection of {id: path}, sorted by asset type
interface AssetList {
  models?: { [key: string]: string };
  textures?: { [key: string]: string };
  sounds?: { [key: string]: string };
}

type OnReadyCallback<TAssets> = (assets: TAssets) => void;

export class Assets<TAssets extends AssetList> {
  private _assetList: TAssets;

  private _models: { [key in keyof TAssets["models"]]: THREE.Object3D } =
    {} as { [key in keyof TAssets["models"]]: THREE.Object3D };
  private _textures: { [key in keyof TAssets["textures"]]: THREE.Texture } =
    {} as { [key in keyof TAssets["textures"]]: THREE.Texture };
  private _sounds: { [key in keyof TAssets["sounds"]]: AudioBuffer } = {} as {
    [key in keyof TAssets["sounds"]]: AudioBuffer;
  };

  private _loaded: boolean = false;
  private _onReadyCallbacks: OnReadyCallback<Assets<TAssets>>[] = [];

  constructor(assetList: TAssets) {
    this._assetList = assetList;
  }

  get loaded() {
    return this._loaded;
  }

  load(): Assets<TAssets> {
    console.debug("Loading assets", this._assetList);

    const manager = new THREE.LoadingManager(
      () => {
        this._loaded = true;
        this._onReadyCallbacks.forEach((callback) => callback(this));
      },
      (url, loaded, total) => {
        console.debug(`Loaded ${url} (${loaded}/${total})`);
      },
      (url) => {
        console.error(`Cannot load ${url}`);
      }
    );

    // Models

    Object.entries(this._assetList["models"] ?? {}).forEach(([id, path]) => {
      console.log(id, path);
      if (path.includes(".obj")) {
        new OBJLoader(manager).load(path, (object) => {
          this._models[id as keyof TAssets["models"]] = object;
        });
      } else if (path.includes("glb")) {
        new GLTFLoader(manager).load(path, (gltf) => {
          gltf.scene.animations = gltf.animations; // Attach animations
          this._models[id as keyof TAssets["models"]] = gltf.scene;
        });
      } else {
        throw new Error(`Unknown extension: ${path}`);
      }
    });

    // Textures

    Object.entries(this._assetList["textures"] ?? {}).forEach(([id, path]) => {
      new THREE.TextureLoader(manager).load(path, (texture) => {
        this._textures[id as keyof TAssets["textures"]] = texture;
      });
    });

    // Sounds

    Object.entries(this._assetList["sounds"] ?? {}).forEach(([id, path]) => {
      new THREE.AudioLoader(manager).load(path, (buffer) => {
        this._sounds[id as keyof TAssets["sounds"]] = buffer;
      });
    });

    return this;
  }

  onReady(callback: OnReadyCallback<Assets<TAssets>>) {
    // Already loaded: call immediately
    if (this._loaded) {
      this._onReadyCallbacks.forEach((callback) => callback(this));
    }
    // Otherwise, will be called later
    {
      this._onReadyCallbacks.push(callback);
    }
  }

  model(id: keyof TAssets["models"]): THREE.Object3D {
    return this._models[id];
  }

  texture(id: keyof TAssets["textures"]): THREE.Texture {
    return this._textures[id];
  }

  sound(id: keyof TAssets["sounds"]): AudioBuffer {
    return this._sounds[id];
  }
}
