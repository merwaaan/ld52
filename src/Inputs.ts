export class Inputs {
  private _keysDown: Set<string> = new Set();
  private _keysUp: Set<string> = new Set();

  private _mouseButtonsDown: Set<number> = new Set();
  private _mouseButtonsUp: Set<number> = new Set();

  private _cursorPosition: [number, number] = [0, 0];

  constructor() {
    document.addEventListener("keydown", (event) => {
      this._keysDown.add(event.key);
      event.preventDefault();
    });

    document.addEventListener("keyup", (event) => {
      this._keysDown.delete(event.key);
      this._keysUp.add(event.key);
      event.preventDefault();
    });

    document.addEventListener("mousedown", (event) => {
      this._mouseButtonsDown.add(event.button);
    });

    document.addEventListener("mouseup", (event) => {
      this._mouseButtonsDown.delete(event.button);
      this._mouseButtonsUp.add(event.button);
    });

    document.addEventListener("mousemove", (event) => {
      this._cursorPosition = [event.clientX, event.clientY];
    });

    document.addEventListener("blur", (event) => {
      this._keysDown.clear();
    });
  }

  get cursorPosition() {
    return this._cursorPosition;
  }

  isButtonClicked(button: number): [number, number] | null {
    // position | null
    return this._mouseButtonsUp.has(button) ? this._cursorPosition : null;
  }

  isKeyDown(key: string): boolean {
    return this._keysDown.has(key);
  }

  isKeyUp(key: string): boolean {
    return !this._keysDown.has(key);
  }

  // Only returns true when the key has just been released
  isKeyReleased(key: string): boolean {
    return this._keysUp.has(key);
  }

  update() {
    this._mouseButtonsUp.clear();
    this._keysUp.clear();
  }
}
