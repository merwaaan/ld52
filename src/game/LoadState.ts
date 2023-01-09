import { State } from "../StateMachine";
import { EventId, GameContext } from "./main";

export class MenuState extends State<GameContext, EventId> {
  private _loaded = false;

  enter(context: GameContext) {
    context.assets.load();
    context.assets.onReady((assets) => {
      this._loaded = true;
    });
  }

  update(context: GameContext, doTransition: (eventId: EventId) => void) {
    if (this._loaded) {
      doTransition("game_started");
    }
  }
}
