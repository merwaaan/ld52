export class State<TContext, TEventId extends string> {
  enter(context: TContext) {}
  exit(context: TContext) {}
  update(context: TContext, doTransition: (eventId: TEventId) => void): void {}
}

type Transition<TStateId extends string, TEventId extends string> = {
  event: TEventId;
  target: TStateId;
};

type StateDescription<
  TContext,
  TStateId extends string,
  TEventId extends string
> = {
  state: State<TContext, TEventId>;
  transitions: Transition<TStateId, TEventId>[];
};

export class StateMachine<
  TContext,
  TStateId extends string,
  TEventId extends string
> {
  states: Record<TStateId, StateDescription<TContext, TStateId, TEventId>>;
  currentStateId: TStateId;

  constructor(
    context: TContext,
    desc: {
      initial: TStateId;
      states: Record<TStateId, StateDescription<TContext, TStateId, TEventId>>;
    }
  ) {
    this.states = desc.states;
    this.currentStateId = desc.initial;

    const initialStateDesc = this.states[this.currentStateId];
    initialStateDesc.state.enter(context);
  }

  update(context: TContext) {
    const currentStateDesc = this.states[this.currentStateId];

    const doTransition = (eventId: TEventId) => {
      const transition = currentStateDesc.transitions.find(
        (t) => t.event == eventId
      );

      if (transition) {
        console.debug(
          `Transition from "${this.currentStateId}" to "${transition.target}"`
        );

        currentStateDesc.state.exit(context);

        this.currentStateId = transition.target;

        const newStateDesc = this.states[this.currentStateId];
        newStateDesc.state.enter(context);
      } else {
        console.warn(
          `State "${this.currentStateId}": no transition for event "${eventId}"`
        );
      }
    };

    currentStateDesc.state.update(context, doTransition);
  }
}
