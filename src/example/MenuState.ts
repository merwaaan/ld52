import { State } from "../StateMachine";
import { EventId, GameContext } from "./test";

export class MenuState extends State<GameContext, EventId> {
  startButton: HTMLButtonElement;
  startButtonClicked: boolean = false;

  constructor(){
    super();

    this.startButton = document.createElement("button");
    this.startButton.innerHTML = "Start";
    this.startButton.addEventListener(
      "click",
      () => (this.startButtonClicked = true)
    );
    document.body.append(this.startButton);
  }

  enter(context: GameContext) {
    this.startButtonClicked = false;

    if (context.assets.loaded) {
      this.startButton.disabled = false;
    } else {
      this.startButton.disabled = true;

      context.assets.load();
      context.assets.onReady((assets) => {
        this.startButton.disabled = false;
      });
    }
  }

  exit(context: GameContext) {
    this.startButton.disabled = true;
  }

  update(context: GameContext, doTransition: (eventId: EventId) => void) {
    if (this.startButtonClicked) {
      doTransition("game_started");
    }
  }
}
