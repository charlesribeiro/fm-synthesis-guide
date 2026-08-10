import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  DelayNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from '../audio-context.token';

/** One scheduled `AudioParam` automation call, recorded in call order.
 * `timeConstant` is only ever populated for a `setTargetAtTime` entry
 * (WR-04) — every other method leaves it `undefined`. */
export interface AudioParamAutomationEntry {
  readonly method:
    | 'setValueAtTime'
    | 'linearRampToValueAtTime'
    | 'setTargetAtTime'
    | 'cancelScheduledValues'
    | 'cancelAndHoldAtTime';
  readonly value: number;
  readonly time: number;
  readonly timeConstant?: number;
}

/**
 * Hand-rolled `AudioParam` fake (mirrors `motion-preference.spec.ts`'s
 * `FakeMediaQueryList` pattern — no test library). Every scheduling call is
 * recorded as an ordered automation entry so a spec can prove a transition
 * was *scheduled*, never assigned. Direct `.value =` assignments are tracked
 * separately so a spec can also prove a transition was NOT a direct
 * assignment (`05-RESEARCH.md` Pitfall 4).
 */
export class FakeAudioParam implements AudioParamLike {
  private _value: number;
  readonly automationEntries: AudioParamAutomationEntry[] = [];
  directAssignmentCount = 0;

  constructor(initialValue: number) {
    this._value = initialValue;
  }

  get value(): number {
    return this._value;
  }

  set value(next: number) {
    this._value = next;
    this.directAssignmentCount += 1;
  }

  setValueAtTime(value: number, startTime: number): AudioParamLike {
    this._value = value;
    this.automationEntries.push({ method: 'setValueAtTime', value, time: startTime });
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike {
    this._value = value;
    this.automationEntries.push({ method: 'linearRampToValueAtTime', value, time: endTime });
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): AudioParamLike {
    this._value = target;
    this.automationEntries.push({ method: 'setTargetAtTime', value: target, time: startTime, timeConstant });
    return this;
  }

  cancelScheduledValues(cancelTime: number): AudioParamLike {
    this.automationEntries.push({
      method: 'cancelScheduledValues',
      value: this._value,
      time: cancelTime,
    });
    return this;
  }

  /** Records the held value as whatever this fake's simplified,
   * immediate-jump `_value` currently is — the fake does not model
   * audio-rate interpolation, so "the value the curve would have had at
   * `cancelTime`" and "the value the last scheduling call set" coincide
   * here; a spec asserts this call happened (not a `cancelScheduledValues`
   * + manual re-anchor) rather than the interpolation itself. */
  cancelAndHoldAtTime(cancelTime: number): AudioParamLike {
    this.automationEntries.push({
      method: 'cancelAndHoldAtTime',
      value: this._value,
      time: cancelTime,
    });
    return this;
  }
}

/** Shared connect/disconnect tracking for every fake node type. */
abstract class FakeAudioNode implements AudioNodeLike {
  readonly connections = new Set<AudioNodeLike | AudioParamLike>();

  connect(destination: AudioNodeLike | AudioParamLike): AudioNodeLike | AudioParamLike {
    this.connections.add(destination);
    return destination;
  }

  disconnect(destination?: AudioNodeLike | AudioParamLike): void {
    if (destination === undefined) {
      this.connections.clear();
      return;
    }
    this.connections.delete(destination);
  }
}

export class FakeOscillatorNode extends FakeAudioNode implements OscillatorNodeLike {
  type = 'sine';
  readonly frequency = new FakeAudioParam(440);
  readonly detune = new FakeAudioParam(0);
  readonly startCalls: number[] = [];
  readonly stopCalls: number[] = [];

  start(when = 0): void {
    this.startCalls.push(when);
  }

  stop(when = 0): void {
    this.stopCalls.push(when);
  }
}

export class FakeGainNode extends FakeAudioNode implements GainNodeLike {
  readonly gain = new FakeAudioParam(1);
}

export class FakeDelayNode extends FakeAudioNode implements DelayNodeLike {
  readonly delayTime = new FakeAudioParam(0);
}

/**
 * Hand-rolled `AudioContext` fake — the only Web Audio double any spec in
 * this app touches (`05-RESEARCH.md` Pitfall 6). Keeps a created-node
 * registry so a spec can assert teardown covers every node `initialize()`
 * built, and a static instance registry so a spec can assert exactly how
 * many real contexts were constructed (proving the gesture gate, T-05-03).
 */
export class FakeAudioContext implements AudioContextLike {
  /** Every `FakeAudioContext` ever constructed, across the whole test file —
   * reset this in a `beforeEach` (`FakeAudioContext.instances.length = 0`). */
  static readonly instances: FakeAudioContext[] = [];

  currentTime = 0;
  readonly sampleRate = 44100;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  readonly destination: AudioNodeLike = new FakeGainNode();

  readonly createdOscillators: FakeOscillatorNode[] = [];
  readonly createdGains: FakeGainNode[] = [];
  readonly createdDelays: FakeDelayNode[] = [];

  /** Counts `close()` calls (CR-02) — lets a spec prove a context that was
   * successfully constructed but then failed later in `initialize()` was
   * still explicitly closed, not merely dropped. */
  closeCalls = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    this.closeCalls += 1;
    return Promise.resolve();
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.createdOscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.createdGains.push(gain);
    return gain;
  }

  createDelay(): FakeDelayNode {
    const delay = new FakeDelayNode();
    this.createdDelays.push(delay);
    return delay;
  }

  /** Test helper: move the fake audio clock forward deterministically. */
  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }

  /** Every node this context has created — the cleanup-assertion registry. */
  get createdNodes(): readonly (FakeOscillatorNode | FakeGainNode | FakeDelayNode)[] {
    return [...this.createdOscillators, ...this.createdGains, ...this.createdDelays];
  }
}

/** A constructor stub that always throws — for exercising the `'error'` `AudioEngineStatus`. */
export class ThrowingAudioContext {
  constructor() {
    throw new Error('AudioContext construction failed (test double)');
  }
}
