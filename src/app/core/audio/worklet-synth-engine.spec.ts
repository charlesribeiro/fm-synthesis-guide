import { TestBed } from '@angular/core/testing';

import {
  MASTER_GAIN,
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
  midiNoteToFrequency,
  velocityToAmplitude,
} from '../../domain/dx7/audio/value-conversion';
import { MAX_ALGORITHM_ID, MIN_ALGORITHM_ID } from '../../domain/dx7/models/algorithm';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL } from '../../domain/dx7/models/patch';
import { MAX_OUTPUT_LEVEL, MIN_OUTPUT_LEVEL } from '../../domain/dx7/models/operator-parameters';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  setFrequencyMessage,
  setModeMessage,
} from '../../domain/dx7/dsp/worklet-messages';
import { AUDIO_CONTEXT_CTOR, type AudioContextConstructorLike } from './audio-context.token';
import { FakeGainNode } from './testing/fake-audio-context';
import {
  AUDIO_WORKLET_MODULE_URL,
  AUDIO_WORKLET_NODE_CTOR,
  type AudioWorkletNodeConstructorLike,
} from './audio-worklet-node.token';
import {
  FakeAudioWorklet,
  FakeAudioWorkletContext,
  FakeAudioWorkletNode,
  ThrowingAudioWorkletNode,
} from './testing/fake-audio-worklet-node';
import type { SynthEngine } from './synth-engine';
import { SYNTH_ENGINE } from './synth-engine.token';
import { WebAudioSynthEngine } from './web-audio-synth-engine';
import { WORKLET_RELEASE_TIME_CONSTANT, WorkletSynthEngine } from './worklet-synth-engine';

/**
 * Mirrors `web-audio-synth-engine.spec.ts`'s `setup()`-helper-plus-flat-
 * `it()` structure. Every case injects fake context/node constructors; no
 * spec touches a real Web Audio global (`jsdom` has none,
 * `05-RESEARCH.md` Pitfall 6).
 */
const TEST_MODULE_URL = 'test-worklets/dx7-operator.js';

function setup(
  contextCtor: AudioContextConstructorLike | null = FakeAudioWorkletContext,
  nodeCtor: AudioWorkletNodeConstructorLike | null = FakeAudioWorkletNode,
) {
  FakeAudioWorkletContext.instances.length = 0;
  FakeAudioWorkletNode.instances.length = 0;
  FakeAudioWorklet.failAddModule = false;
  FakeAudioWorklet.deferredAddModule = null;
  TestBed.configureTestingModule({
    providers: [
      { provide: AUDIO_CONTEXT_CTOR, useValue: contextCtor },
      { provide: AUDIO_WORKLET_NODE_CTOR, useValue: nodeCtor },
      { provide: AUDIO_WORKLET_MODULE_URL, useValue: TEST_MODULE_URL },
    ],
  });
  return { service: TestBed.inject(WorkletSynthEngine) };
}

/** The masterGain is the fake gain node connected to `context.destination`. */
function findMasterGain(context: FakeAudioWorkletContext): FakeGainNode {
  const masterGain = context.createdGains.find((gain) => gain.connections.has(context.destination));
  if (masterGain === undefined) {
    throw new Error('masterGain was not created — buildAndStart did not run as expected');
  }
  return masterGain;
}

/** The voiceGain is the fake gain node connected to masterGain. */
function findVoiceGain(context: FakeAudioWorkletContext): FakeGainNode {
  const masterGain = findMasterGain(context);
  const voiceGain = context.createdGains.find((gain) => gain.connections.has(masterGain));
  if (voiceGain === undefined) {
    throw new Error('voiceGain was not created — buildAndStart did not run as expected');
  }
  return voiceGain;
}

async function setupReady() {
  const { service } = setup();
  await service.initialize();
  const context = FakeAudioWorkletContext.instances[0] as FakeAudioWorkletContext;
  const node = FakeAudioWorkletNode.instances[0];
  const voiceGain = findVoiceGain(context);
  return { service, context, node, voiceGain };
}

describe('WorkletSynthEngine', () => {
  it('implements the full SynthEngine surface (compile-time check)', () => {
    const { service } = setup();
    const typed: SynthEngine = service;

    expect(typed.status()).toBe('suspended');
  });

  describe('AudioEngineStatus reachability', () => {
    it("is 'suspended' immediately on construction — DI instantiation alone never invokes either constructor", () => {
      const { service } = setup();

      expect(service.status()).toBe('suspended');
      expect(FakeAudioWorkletContext.instances.length).toBe(0);
    });

    it("is 'unavailable' when the AudioContext constructor token is null, and initialize() is then a no-op", async () => {
      const { service } = setup(null, FakeAudioWorkletNode);

      expect(service.status()).toBe('unavailable');

      await service.initialize();

      expect(service.status()).toBe('unavailable');
      expect(FakeAudioWorkletContext.instances.length).toBe(0);
    });

    it("is 'unavailable' when the AudioWorkletNode constructor token is null, and initialize() is then a no-op", async () => {
      const { service } = setup(FakeAudioWorkletContext, null);

      expect(service.status()).toBe('unavailable');

      await service.initialize();

      expect(service.status()).toBe('unavailable');
      expect(FakeAudioWorkletContext.instances.length).toBe(0);
    });

    it("resolves to 'ready' after initialize(), resuming the context and loading the module exactly once", async () => {
      const { service } = setup();

      await service.initialize();

      expect(service.status()).toBe('ready');
      const context = FakeAudioWorkletContext.instances[0] as FakeAudioWorkletContext;
      expect(context.state).toBe('running');
      expect(context.audioWorklet.addedModuleUrls).toEqual([TEST_MODULE_URL]);
      expect(FakeAudioWorkletNode.instances.length).toBe(1);
      expect(FakeAudioWorkletNode.instances[0].processorName).toBe(DX7_OPERATOR_PROCESSOR_NAME);
    });

    it('is idempotent: a second awaited initialize() builds nothing extra', async () => {
      const { service } = setup();

      await service.initialize();
      await service.initialize();

      expect(FakeAudioWorkletContext.instances.length).toBe(1);
      const context = FakeAudioWorkletContext.instances[0] as FakeAudioWorkletContext;
      expect(context.audioWorklet.addedModuleUrls.length).toBe(1);
    });

    it('serializes two concurrent, unawaited initialize() calls into a single context/module-load/node rather than racing two builds', async () => {
      const { service } = setup();

      const first = service.initialize();
      const second = service.initialize();
      await Promise.all([first, second]);

      expect(service.status()).toBe('ready');
      expect(FakeAudioWorkletContext.instances.length).toBe(1);
      const context = FakeAudioWorkletContext.instances[0] as FakeAudioWorkletContext;
      expect(context.audioWorklet.addedModuleUrls.length).toBe(1);
      expect(FakeAudioWorkletNode.instances.length).toBe(1);
    });

    it("is 'error' when addModule() rejects, closing the context and leaving no worklet node constructed", async () => {
      const { service } = setup();
      FakeAudioWorklet.failAddModule = true;

      await service.initialize();

      expect(service.status()).toBe('error');
      expect(FakeAudioWorkletContext.instances[0].closeCalls).toBe(1);
      expect(FakeAudioWorkletNode.instances.length).toBe(0);
    });

    it("is 'error' when the AudioWorkletNode constructor throws, closing the context", async () => {
      const { service } = setup(
        FakeAudioWorkletContext,
        ThrowingAudioWorkletNode as unknown as AudioWorkletNodeConstructorLike,
      );

      await service.initialize();

      expect(service.status()).toBe('error');
      expect(FakeAudioWorkletContext.instances[0].closeCalls).toBe(1);
    });

    it('destroy() during a deferred addModule() discards the local graph and never commits ownership', async () => {
      const { service } = setup();
      let resolveAddModule!: () => void;
      FakeAudioWorklet.deferredAddModule = new Promise<void>((resolve) => {
        resolveAddModule = resolve;
      });

      const initializePromise = service.initialize();
      service.destroy();
      resolveAddModule();
      await initializePromise;

      expect(service.status()).toBe('suspended');
      expect(FakeAudioWorkletContext.instances[0].closeCalls).toBeGreaterThanOrEqual(1);
      // destroy() fired before addModule() resolved, so the stale build must
      // never have reached node construction at all — not merely have its
      // node torn down after the fact.
      expect(FakeAudioWorkletNode.instances.length).toBe(0);
      // A subsequent initialize must build a fresh graph rather than revive the discarded one.
      FakeAudioWorklet.deferredAddModule = null;
      await service.initialize();
      expect(service.status()).toBe('ready');
      expect(FakeAudioWorkletContext.instances.length).toBe(2);
      expect(FakeAudioWorkletNode.instances.length).toBe(1);
    });
  });

  it('schedules the master gain to MASTER_GAIN and the voice gain to 0, both via setValueAtTime, during initialize()', async () => {
    const { context } = await setupReady();
    const masterGain = findMasterGain(context);
    const voiceGain = findVoiceGain(context);

    const masterEntry = masterGain.gain.automationEntries.find((entry) => entry.method === 'setValueAtTime');
    expect(masterEntry?.value).toBe(MASTER_GAIN);
    const voiceEntry = voiceGain.gain.automationEntries.find((entry) => entry.method === 'setValueAtTime');
    expect(voiceEntry?.value).toBe(0);
  });

  describe('note lifecycle', () => {
    it('posts exactly the shared setFrequency message and schedules a rising ramp toward velocityToAmplitude on noteOn, with zero direct gain assignments', async () => {
      const { service, node, voiceGain } = await setupReady();
      const directAssignmentsBefore = voiceGain.gain.directAssignmentCount;

      service.noteOn(69, 100);

      expect(node.port.postedMessages).toEqual([setFrequencyMessage(midiNoteToFrequency(69))]);
      const risingRamp = voiceGain.gain.automationEntries.find(
        (entry) => entry.method === 'linearRampToValueAtTime' && entry.value > 0,
      );
      expect(risingRamp?.value).toBeCloseTo(velocityToAmplitude(100), 10);
      expect(voiceGain.gain.directAssignmentCount).toBe(directAssignmentsBefore);
    });

    it('rejects a non-integer, out-of-range, NaN, or Infinity note with a RangeError and posts no message', async () => {
      const { service, node } = await setupReady();

      const invalidNotes = [60.5, MIN_MIDI_NOTE - 1, MAX_MIDI_NOTE + 1, NaN, Infinity];
      for (const note of invalidNotes) {
        expect(() => service.noteOn(note, 100)).toThrow(RangeError);
      }
      expect(node.port.postedMessages.length).toBe(0);
    });

    it('rejects an out-of-range velocity with a RangeError and posts no message', async () => {
      const { service, node } = await setupReady();

      const invalidVelocities = [MIN_VELOCITY - 1, MAX_VELOCITY + 1, 0.5, NaN];
      for (const velocity of invalidVelocities) {
        expect(() => service.noteOn(60, velocity)).toThrow(RangeError);
      }
      expect(node.port.postedMessages.length).toBe(0);
    });

    it('noteOff for the held note schedules an exponential release terminating at exactly 0', async () => {
      const { service, voiceGain } = await setupReady();
      service.noteOn(60, 100);

      service.noteOff(60);

      const releaseEntry = voiceGain.gain.automationEntries.find((entry) => entry.method === 'setTargetAtTime');
      expect(releaseEntry?.timeConstant).toBe(WORKLET_RELEASE_TIME_CONSTANT);
      const lastEntry = voiceGain.gain.automationEntries.at(-1);
      expect(lastEntry?.method).toBe('setValueAtTime');
      expect(lastEntry?.value).toBe(0);
    });

    it('noteOff for a note that is not the currently held note changes nothing', async () => {
      const { service, voiceGain } = await setupReady();
      service.noteOn(60, 100);
      const entriesAfterNoteOn = voiceGain.gain.automationEntries.length;

      service.noteOff(61);

      expect(voiceGain.gain.automationEntries.length).toBe(entriesAfterNoteOn);
    });

    it('allNotesOff releases unconditionally, terminating at exactly 0', async () => {
      const { service, voiceGain } = await setupReady();

      service.allNotesOff();

      const lastEntry = voiceGain.gain.automationEntries.at(-1);
      expect(lastEntry?.method).toBe('setValueAtTime');
      expect(lastEntry?.value).toBe(0);
    });
  });

  it("setRenderMode('additive') posts exactly one setMode message", async () => {
    const { service, node } = await setupReady();

    service.setRenderMode('additive');

    expect(node.port.postedMessages).toEqual([setModeMessage('additive')]);
  });

  describe('not-yet-meaningful interface members (validated no-ops)', () => {
    it('setAlgorithm posts no message for a legal id and throws RangeError for an illegal one', async () => {
      const { service, node } = await setupReady();

      expect(() => service.setAlgorithm(1)).not.toThrow();
      expect(() => service.setAlgorithm(32)).not.toThrow();
      expect(node.port.postedMessages.length).toBe(0);

      expect(() => service.setAlgorithm(MIN_ALGORITHM_ID - 1)).toThrow(RangeError);
      expect(() => service.setAlgorithm(MAX_ALGORITHM_ID + 1)).toThrow(RangeError);
    });

    it('setFeedback posts no message for a legal level and throws RangeError for an illegal one', async () => {
      const { service, node } = await setupReady();

      expect(() => service.setFeedback(MIN_FEEDBACK_LEVEL)).not.toThrow();
      expect(() => service.setFeedback(MAX_FEEDBACK_LEVEL)).not.toThrow();
      expect(node.port.postedMessages.length).toBe(0);

      expect(() => service.setFeedback(MIN_FEEDBACK_LEVEL - 1)).toThrow(RangeError);
      expect(() => service.setFeedback(MAX_FEEDBACK_LEVEL + 1)).toThrow(RangeError);
    });

    it('updateOperatorLevel posts no message for a legal operator/level pair and throws RangeError for an illegal one', async () => {
      const { service, node } = await setupReady();

      expect(() => service.updateOperatorLevel(1, MIN_OUTPUT_LEVEL)).not.toThrow();
      expect(() => service.updateOperatorLevel(6, MAX_OUTPUT_LEVEL)).not.toThrow();
      expect(node.port.postedMessages.length).toBe(0);

      expect(() => service.updateOperatorLevel(1, MIN_OUTPUT_LEVEL - 1)).toThrow(RangeError);
      expect(() => service.updateOperatorLevel(1, MAX_OUTPUT_LEVEL + 1)).toThrow(RangeError);
      expect(() => service.updateOperatorLevel(7 as never, 50)).toThrow(RangeError);
    });
  });

  it('destroy() clears the worklet port handler, empties every created node connection, closes the context exactly once, and resets status to suspended', async () => {
    const { service, context, node, voiceGain } = await setupReady();
    node.port.onmessage = () => undefined;

    service.destroy();

    expect(node.port.onmessage).toBeNull();
    expect(node.connections.size).toBe(0);
    expect(voiceGain.connections.size).toBe(0);
    expect(context.closeCalls).toBe(1);
    expect(service.status()).toBe('suspended');
  });

  it('D-01: SYNTH_ENGINE still resolves to WebAudioSynthEngine, unaffected by this class existing', () => {
    const engine = TestBed.inject(SYNTH_ENGINE);

    expect(engine).toBeInstanceOf(WebAudioSynthEngine);
  });
});
