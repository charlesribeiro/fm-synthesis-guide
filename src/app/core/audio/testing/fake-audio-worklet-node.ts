import type { AudioNodeLike, AudioParamLike } from '../audio-context.token';
import type {
  AudioWorkletContextLike,
  AudioWorkletLike,
  AudioWorkletNodeLike,
  AudioWorkletNodeOptionsLike,
  AudioWorkletPortLike,
} from '../audio-worklet-node.token';
import { FakeAudioContext } from './fake-audio-context';

/**
 * Hand-rolled `AudioWorkletNode`/`AudioWorklet` doubles (mirrors
 * `testing/fake-audio-context.ts`'s conventions precisely) — no test
 * library, every interesting call recorded in an ordered array a spec can
 * assert against.
 */

/** Records every posted payload into an ordered array so a spec can assert
 * the render thread received exactly the expected message(s). */
export class FakeAudioWorkletPort implements AudioWorkletPortLike {
  readonly postedMessages: unknown[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;

  postMessage(data: unknown): void {
    this.postedMessages.push(data);
  }
}

/**
 * Implements `connect`/`disconnect` locally rather than reusing
 * `fake-audio-context.ts`'s currently-private `FakeAudioNode` base — a
 * six-line duplication is cheaper than modifying a Phase 5 file that Phase
 * 5's own suite depends on (deliberate choice, documented in the SUMMARY).
 */
export class FakeAudioWorkletNode implements AudioWorkletNodeLike {
  /** Every `FakeAudioWorkletNode` ever constructed, across the whole test
   * file — reset this in a `beforeEach` (`FakeAudioWorkletNode.instances.length = 0`). */
  static readonly instances: FakeAudioWorkletNode[] = [];

  readonly connections = new Set<AudioNodeLike | AudioParamLike>();
  readonly port: FakeAudioWorkletPort = new FakeAudioWorkletPort();
  readonly processorName: string;
  readonly options: AudioWorkletNodeOptionsLike | undefined;

  constructor(
    _context: AudioWorkletContextLike,
    processorName: string,
    options?: AudioWorkletNodeOptionsLike,
  ) {
    this.processorName = processorName;
    this.options = options;
    FakeAudioWorkletNode.instances.push(this);
  }

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

/**
 * Resolves immediately unless the static `failAddModule` flag is set — the
 * flag is static because the context is constructed inside `initialize()`,
 * out of the spec's reach, and must be reset in `beforeEach` just as
 * `FakeAudioContext.instances.length = 0` already is.
 */
export class FakeAudioWorklet implements AudioWorkletLike {
  static failAddModule = false;
  /** When set, `addModule` returns this promise instead of resolving
   * immediately — lets a spec call `destroy()` while initialize() is still
   * awaiting the module load. Reset to `null` in each setup. */
  static deferredAddModule: Promise<void> | null = null;

  readonly addedModuleUrls: string[] = [];

  addModule(moduleUrl: string): Promise<void> {
    this.addedModuleUrls.push(moduleUrl);
    if (FakeAudioWorklet.failAddModule) {
      return Promise.reject(new Error('simulated addModule() failure (test double)'));
    }
    if (FakeAudioWorklet.deferredAddModule !== null) {
      return FakeAudioWorklet.deferredAddModule;
    }
    return Promise.resolve();
  }
}

/**
 * Extends `FakeAudioContext` so the existing gain/param/teardown recording
 * machinery is reused rather than reimplemented, and adds the
 * `audioWorklet` surface `AudioWorkletContextLike` requires.
 */
export class FakeAudioWorkletContext extends FakeAudioContext implements AudioWorkletContextLike {
  readonly audioWorklet: FakeAudioWorklet = new FakeAudioWorklet();
}

/** A constructor stub that always throws — for exercising the `'error'`
 * `AudioEngineStatus` when node construction (rather than module loading)
 * fails. */
export class ThrowingAudioWorkletNode {
  constructor() {
    throw new Error('AudioWorkletNode construction failed (test double)');
  }
}
