import { State } from "../StateMachine";
import { EventId, GameContext } from "./main";

export class MenuState extends State<GameContext, EventId> {
  private _loaded = false;

  enter(context: GameContext) {
    const w = 800;
    const h = 600;

    context.ui.fillStyle = "#222";
    context.ui.fillRect(0, 0, w, h);
    context.ui.font = '50px Courier';
    context.ui.fillStyle = '#fff';
    let text = 'Loading...';
    let m = context.ui.measureText(text);
    context.ui.fillText(text, w/2 - m.width/2, h/2);

    context.assets.load();
    context.assets.onReady((assets) => {
      this._loaded = true;
      context.ui.clearRect(0, 0, w, h);
    });
  }

  update(context: GameContext, doTransition: (eventId: EventId) => void) {
    if (this._loaded) {
      doTransition("game_started");
    }
  }
}
