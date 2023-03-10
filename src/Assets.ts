import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader, Font } from "three/examples/jsm/loaders/FontLoader";

type AudioBuffer = NonNullable<THREE.Audio["buffer"]>;

// Collection of {id: path}, sorted by asset type
interface AssetList {
  models?: { [key: string]: string };
  textures?: { [key: string]: string };
  sounds?: { [key: string]: string };
  fonts?: { [key: string]: string };
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
  private _fonts: { [key in keyof TAssets["fonts"]]: Font } = {} as {
    [key in keyof TAssets["fonts"]]: Font;
  };

  private _assetsCount: number = 0;
  private _loadedCount: number = 0;

  private _loaded: boolean = false;
  private _onReadyCallbacks: OnReadyCallback<Assets<TAssets>>[] = [];

  constructor(assetList: TAssets) {
    this._assetList = assetList;

    this._assetsCount =
      Object.keys(assetList["models"] ?? {}).length +
      Object.keys(assetList["textures"] ?? {}).length +
      Object.keys(assetList["sounds"] ?? {}).length +
      Object.keys(assetList["fonts"] ?? {}).length;
  }

  get loaded() {
    return this._loaded;
  }

  checkAllLoaded() {
    this._loadedCount += 1;
    if (this._loadedCount == this._assetsCount) {
      this._loaded = true;
      this._onReadyCallbacks.forEach((callback) => callback(this));
    }
  }

  load(): Assets<TAssets> {
    console.debug("Loading assets", this._assetList);

    const manager = new THREE.LoadingManager(
      () => {
        // Don't bother with this callback
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
      if (path.includes(".obj")) {
        new OBJLoader(manager).load(path, (object) => {
          this._models[id as keyof TAssets["models"]] = object;
          this.checkAllLoaded();
        });
      } else if (path.includes("glb")) {
        new GLTFLoader(manager).load(path, (gltf) => {
          //console.log(gltf);
          gltf.scene.animations = gltf.animations; // Attach animations
          this._models[id as keyof TAssets["models"]] = gltf.scene;
          this.checkAllLoaded();
        });
      } else {
        throw new Error(`Unknown extension: ${path}`);
      }
    });

    // Textures

    Object.entries(this._assetList["textures"] ?? {}).forEach(([id, path]) => {
      new THREE.TextureLoader(manager).load(path, (texture) => {
        this._textures[id as keyof TAssets["textures"]] = texture;
        this.checkAllLoaded();
      });
    });

    // Sounds

    Object.entries(this._assetList["sounds"] ?? {}).forEach(([id, path]) => {
      new THREE.AudioLoader(manager).load(path, (buffer) => {
        this._sounds[id as keyof TAssets["sounds"]] = buffer;
        this.checkAllLoaded();
      });
    });

    // Fonts

    Object.entries(this._assetList["fonts"] ?? {}).forEach(([id, path]) => {
      new FontLoader(manager).load(path, (font) => {
        this._fonts[id as keyof TAssets["fonts"]] = font;
        this.checkAllLoaded();
      });
    });

    return this;
  }

  onReady(callback: OnReadyCallback<Assets<TAssets>>) {
    // Already loaded: call immediately
    if (this._loaded) {
      callback(this);
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

  font(id: keyof TAssets["fonts"]): Font {
    return this._fonts[id];
  }
}
