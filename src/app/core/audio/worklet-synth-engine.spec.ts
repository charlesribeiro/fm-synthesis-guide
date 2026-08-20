import { TestBed } from '@angular/core/testing';

import {
  MASTER_GAIN,
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
  envelopeRateToLevelUnitsPerSample,
  midiNoteToFrequency,
  velocityToAmplitude,
} from '../../domain/dx7/audio/value-conversion';
import { GraphRouter, buildRoutingConfig } from '../../domain/dx7/dsp/graph-router';
import { RENDER_QUANTUM_FRAMES } from '../../domain/dx7/dsp/operator';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import { MAX_ALGORITHM_ID, MIN_ALGORITHM_ID } from '../../domain/dx7/models/algorithm';
import { DEFAULT_PATCH, MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL } from '../../domain/dx7/models/patch';
import {
  DEFAULT_ENVELOPE,
  MAX_OUTPUT_LEVEL,
  MIN_OUTPUT_LEVEL,
} from '../../domain/dx7/models/operator-parameters';
import {
  DX7_OPERATOR_PROCESSOR_NAME,
  setAlgorithmMessage,
  setFeedbackMessage,
  setFrequencyMessage,
  setGateMessage,
  setModeMessage,
  setOperatorParametersMessage,
} from '../../domain/dx7/dsp/worklet-messages';
import { InstrumentState } from '../../state/instrument-state';
import { AUDIO_CONTEXT_CTOR, type AudioContextConstructorLike } from './audio-context.token';
import { ANALYSER_FFT_SIZE, ANALYSER_FREQUENCY_BIN_COUNT } from './synth-engine';
import { FakeAnalyserNode, FakeGainNode } from './testing/fake-audio-context';
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
import { WorkletSynthEngine } from './worklet-synth-engine';

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

/** The analyser is the fake analyser node connected to `context.destination`
 * (D-02: the analyser is now the graph's terminal node, not masterGain). */
function findAnalyser(context: FakeAudioWorkletContext): FakeAnalyserNode {
  const analyser = context.createdAnalysers.find((candidate) => candidate.connections.has(context.destination));
  if (analyser === undefined) {
    throw new Error('analyser was not created — buildAndStart did not run as expected');
  }
  return analyser;
}

/** The masterGain is the fake gain node connected to the analyser (D-02:
 * masterGain no longer connects directly to `context.destination`). */
function findMasterGain(context: FakeAudioWorkletContext): FakeGainNode {
  const analyser = findAnalyser(context);
  const masterGain = context.createdGains.find((gain) => gain.connections.has(analyser));
  if (masterGain === undefined) {
    throw new Error('masterGain was not created — buildAndStart did not run as expected');
  }
  return masterGain;
}

async function setupReady() {
  const { service } = setup();
  await service.initialize();
  const context = FakeAudioWorkletContext.instances[0] as FakeAudioWorkletContext;
  const node = FakeAudioWorkletNode.instances[0];
  const instrumentState = TestBed.inject(InstrumentState);
  return { service, context, node, instrumentState };
}

/** The three routing-state messages `applyInstrumentStateToWorklet` posts
 * for the given `InstrumentState`'s *current* signal values, in the fixed
 * order `worklet-synth-engine.ts` always posts them the first time (the
 * initial post-build push, before any `lastAppliedX` field is set). After
 * that first push, only the field(s) that actually changed are posted —
 * see {@link messagesOfKindSince} below for asserting on that narrower
 * per-kind behaviour. */
function routingStateMessages(instrumentState: InstrumentState): [unknown, unknown, unknown] {
  const routingConfig = buildRoutingConfig(instrumentState.algorithm());
  return [
    setAlgorithmMessage(routingConfig.connections, routingConfig.carriers),
    setOperatorParametersMessage(instrumentState.operators()),
    setFeedbackMessage(instrumentState.feedback()),
  ];
}

/**
 * Filters a fake worklet node's recorded port messages (from the given
 * index onward) down to just one `kind` — every case from Task 3 onward
 * (08-03-PLAN.md) asserts on the message kind(s) it cares about through
 * this helper instead of a brittle whole-array `toEqual`, since the
 * diff-based `applyInstrumentStateToWorklet` now posts only the field(s)
 * that actually changed rather than always all three (Pitfall 5).
 */
function messagesOfKindSince(node: FakeAudioWorkletNode, kind: string, sinceIndex: number): unknown[] {
  return node.port.postedMessages
    .slice(sinceIndex)
    .filter((message) => (message as { kind?: unknown }).kind === kind);
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

  it('schedules the master gain to 0 initially (Phase 9, D-02 — the dedicated voice gain node that used to close this window is gone) then unity once routed mode is applied, both via setValueAtTime, during initialize()', async () => {
    const { context } = await setupReady();
    const masterGain = findMasterGain(context);

    const masterEntries = masterGain.gain.automationEntries.filter((entry) => entry.method === 'setValueAtTime');
    expect(masterEntries.map((entry) => entry.value)).toEqual([0, 1]);
  });

  it('constructs exactly one gain node across a full build (Phase 9, D-02 — the mechanical form of "the dedicated per-voice gain node is gone")', async () => {
    const { context } = await setupReady();

    expect(context.createdGains.length).toBe(1);
  });

  describe('AnalyserNode tap (10-01-PLAN.md, D-02, D-08)', () => {
    it('inserts exactly one analyser between masterGain and context.destination, sized from ANALYSER_FFT_SIZE', async () => {
      const { context } = await setupReady();

      expect(context.createdAnalysers.length).toBe(1);
      const analyser = context.createdAnalysers[0];
      const masterGain = findMasterGain(context);

      expect(masterGain.connections.has(analyser)).toBe(true);
      expect(masterGain.connections.has(context.destination)).toBe(false);
      expect(analyser.connections.has(context.destination)).toBe(true);

      expect(analyser.fftSize).toBe(ANALYSER_FFT_SIZE);
      expect(analyser.frequencyBinCount).toBe(ANALYSER_FREQUENCY_BIN_COUNT);
    });

    it('readTimeDomainInto/readFrequencyInto both return false and leave the buffer untouched before initialize()', async () => {
      const { service } = setup();
      const timeBuffer = new Uint8Array(ANALYSER_FFT_SIZE).fill(7);
      const frequencyBuffer = new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT).fill(7);

      expect(service.readTimeDomainInto(timeBuffer)).toBe(false);
      expect(service.readFrequencyInto(frequencyBuffer)).toBe(false);
      expect(timeBuffer.every((byte) => byte === 7)).toBe(true);
      expect(frequencyBuffer.every((byte) => byte === 7)).toBe(true);
    });

    it('readTimeDomainInto/readFrequencyInto return false after initialize() until a note is held', async () => {
      const { service } = await setupReady();
      const timeBuffer = new Uint8Array(ANALYSER_FFT_SIZE).fill(7);
      const frequencyBuffer = new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT).fill(7);

      expect(service.readTimeDomainInto(timeBuffer)).toBe(false);
      expect(service.readFrequencyInto(frequencyBuffer)).toBe(false);
      expect(timeBuffer.every((byte) => byte === 7)).toBe(true);
      expect(frequencyBuffer.every((byte) => byte === 7)).toBe(true);
    });

    it('readTimeDomainInto/readFrequencyInto return true while a note is held and copy the fake analyser\'s canned bytes', async () => {
      const { service, context } = await setupReady();
      const analyser = findAnalyser(context);
      const cannedTime = new Uint8Array(ANALYSER_FFT_SIZE).fill(200);
      const cannedFrequency = new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT).fill(50);
      analyser.cannedTimeDomainData = cannedTime;
      analyser.cannedFrequencyData = cannedFrequency;

      service.noteOn(60, 100);

      const timeBuffer = new Uint8Array(ANALYSER_FFT_SIZE);
      const frequencyBuffer = new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT);

      expect(service.readTimeDomainInto(timeBuffer)).toBe(true);
      expect(service.readFrequencyInto(frequencyBuffer)).toBe(true);
      expect(timeBuffer).toEqual(cannedTime);
      expect(frequencyBuffer).toEqual(cannedFrequency);

      service.noteOff(60);
      timeBuffer.fill(7);
      frequencyBuffer.fill(7);
      expect(service.readTimeDomainInto(timeBuffer)).toBe(true);
      expect(service.readFrequencyInto(frequencyBuffer)).toBe(true);
      expect(timeBuffer).toEqual(cannedTime);
      expect(frequencyBuffer).toEqual(cannedFrequency);
    });

    it('after noteOff, analyser reads still copy live release samples until the graph is torn down', async () => {
      const { service, context } = await setupReady();
      const analyser = findAnalyser(context);
      const cannedTime = new Uint8Array(ANALYSER_FFT_SIZE).fill(180);
      analyser.cannedTimeDomainData = cannedTime;
      service.noteOn(60, 100);
      service.noteOff(60);

      const timeBuffer = new Uint8Array(ANALYSER_FFT_SIZE).fill(7);
      expect(service.readTimeDomainInto(timeBuffer)).toBe(true);
      expect(timeBuffer).toEqual(cannedTime);

      service.destroy();
      timeBuffer.fill(7);
      expect(service.readTimeDomainInto(timeBuffer)).toBe(false);
      expect(timeBuffer.every((byte) => byte === 7)).toBe(true);
    });

    it('FakeAnalyserNode.getByteTimeDomainData/getByteFrequencyData throw a RangeError for a mismatched buffer length', async () => {
      const { context } = await setupReady();
      const analyser = findAnalyser(context);

      expect(() => analyser.getByteTimeDomainData(new Uint8Array(ANALYSER_FFT_SIZE - 1))).toThrow(RangeError);
      expect(() => analyser.getByteFrequencyData(new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT + 1))).toThrow(
        RangeError,
      );
    });

    it('getAnalysisSampleRate returns 0 before initialize() and the context sampleRate after', async () => {
      const { service } = setup();
      expect(service.getAnalysisSampleRate()).toBe(0);

      await service.initialize();
      expect(service.getAnalysisSampleRate()).toBe(44100);
    });
  });

  it('invokes no gain-parameter scheduling method across a full note-on/note-off lifecycle (Phase 9, D-02 — click-safety now lives entirely in the kernel\'s envelopes)', async () => {
    const { service, context } = await setupReady();
    const masterGain = findMasterGain(context);
    const entriesBefore = masterGain.gain.automationEntries.length;

    service.noteOn(60, 100);
    service.noteOff(60);

    expect(masterGain.gain.automationEntries.length).toBe(entriesBefore);
  });

  it("once initialize() resolves, has posted the routed-mode message and one each of the three state messages; changing InstrumentState.algorithm then posts exactly one further routing-config message", async () => {
    const { node, instrumentState } = await setupReady();

    expect(node.port.postedMessages).toEqual([setModeMessage('routed'), ...routingStateMessages(instrumentState)]);

    instrumentState.setAlgorithm(32);
    TestBed.tick();

    const algorithmMessages = node.port.postedMessages.filter(
      (message) => (message as { kind: string }).kind === 'setAlgorithm',
    );
    expect(algorithmMessages.length).toBe(2);
  });

  describe('note lifecycle', () => {
    it('posts the shared setFrequency message and an open gate message carrying the velocity on noteOn, with no AudioParam scheduling of any kind (Phase 9, D-02)', async () => {
      const { service, node } = await setupReady();
      const before = node.port.postedMessages.length;

      service.noteOn(69, 100);

      expect(node.port.postedMessages.slice(before)).toEqual([
        setFrequencyMessage(midiNoteToFrequency(69)),
        setGateMessage(true, 100),
      ]);
    });

    it('rejects a non-integer, out-of-range, NaN, or Infinity note with a RangeError and posts no additional message', async () => {
      const { service, node } = await setupReady();
      const before = node.port.postedMessages.length;

      const invalidNotes = [60.5, MIN_MIDI_NOTE - 1, MAX_MIDI_NOTE + 1, NaN, Infinity];
      for (const note of invalidNotes) {
        expect(() => service.noteOn(note, 100)).toThrow(RangeError);
      }
      expect(node.port.postedMessages.length).toBe(before);
    });

    it('rejects an out-of-range velocity with a RangeError and posts no additional message', async () => {
      const { service, node } = await setupReady();
      const before = node.port.postedMessages.length;

      const invalidVelocities = [MIN_VELOCITY - 1, MAX_VELOCITY + 1, 0.5, NaN];
      for (const velocity of invalidVelocities) {
        expect(() => service.noteOn(60, velocity)).toThrow(RangeError);
      }
      expect(node.port.postedMessages.length).toBe(before);
    });

    it('noteOff for the held note posts a closed gate message', async () => {
      const { service, node } = await setupReady();
      service.noteOn(60, 100);
      const before = node.port.postedMessages.length;

      service.noteOff(60);

      expect(node.port.postedMessages.slice(before)).toEqual([setGateMessage(false, MIN_VELOCITY)]);
    });

    it('noteOff for a note that is not the currently held note posts nothing', async () => {
      const { service, node } = await setupReady();
      service.noteOn(60, 100);
      const before = node.port.postedMessages.length;

      service.noteOff(61);

      expect(node.port.postedMessages.length).toBe(before);
    });

    it('allNotesOff posts a closed gate message unconditionally', async () => {
      const { service, node } = await setupReady();
      const before = node.port.postedMessages.length;

      service.allNotesOff();

      expect(node.port.postedMessages.slice(before)).toEqual([setGateMessage(false, MIN_VELOCITY)]);
    });
  });

  it("setRenderMode('additive') posts exactly one further setMode message and stages MASTER_GAIN on masterGain", async () => {
    const { service, node, context } = await setupReady();
    const before = node.port.postedMessages.length;
    const masterGain = findMasterGain(context);
    const entriesBefore = masterGain.gain.automationEntries.length;

    service.setRenderMode('additive');

    expect(node.port.postedMessages.slice(before)).toEqual([setModeMessage('additive')]);
    const gainEntry = masterGain.gain.automationEntries.slice(entriesBefore).find((entry) => entry.method === 'setValueAtTime');
    expect(gainEntry?.value).toBe(MASTER_GAIN);
  });

  it("setRenderMode('routed') restores unity masterGain after a non-routed mode", async () => {
    const { service, context } = await setupReady();
    const masterGain = findMasterGain(context);

    service.setRenderMode('additive');
    service.setRenderMode('routed');

    const lastGain = masterGain.gain.automationEntries.filter((entry) => entry.method === 'setValueAtTime').at(-1);
    expect(lastGain?.value).toBe(1);
  });

  describe('InstrumentState-backed setters (real as of Phase 8/ENGINE-02; message separation, Pitfall 5)', () => {
    it('setAlgorithm posts exactly one routing-config message reflecting the new algorithm, and zero operator-parameters/feedback messages, for a legal id; throws RangeError for an illegal one and posts nothing extra', async () => {
      const { service, node, instrumentState } = await setupReady();
      const before = node.port.postedMessages.length;

      service.setAlgorithm(32);

      const routingConfig = buildRoutingConfig(instrumentState.algorithm());
      expect(node.port.postedMessages.slice(before)).toEqual([
        setAlgorithmMessage(routingConfig.connections, routingConfig.carriers),
      ]);
      expect(messagesOfKindSince(node, 'setOperatorParameters', before)).toEqual([]);
      expect(messagesOfKindSince(node, 'setFeedback', before)).toEqual([]);

      expect(() => service.setAlgorithm(MIN_ALGORITHM_ID - 1)).toThrow(RangeError);
      expect(() => service.setAlgorithm(MAX_ALGORITHM_ID + 1)).toThrow(RangeError);
      expect(node.port.postedMessages.length).toBe(before + 1);
    });

    it('setFeedback posts exactly one feedback message reflecting the new depth, and zero routing-config/operator-parameters messages, for a legal level; throws RangeError for an illegal one', async () => {
      const { service, node, instrumentState } = await setupReady();
      const before = node.port.postedMessages.length;

      service.setFeedback(5);

      expect(node.port.postedMessages.slice(before)).toEqual([setFeedbackMessage(5)]);
      expect(instrumentState.feedback()).toBe(5);
      expect(messagesOfKindSince(node, 'setAlgorithm', before)).toEqual([]);
      expect(messagesOfKindSince(node, 'setOperatorParameters', before)).toEqual([]);

      expect(() => service.setFeedback(MIN_FEEDBACK_LEVEL - 1)).toThrow(RangeError);
      expect(() => service.setFeedback(MAX_FEEDBACK_LEVEL + 1)).toThrow(RangeError);
    });

    it('updateOperatorLevel posts exactly one operator-parameters message reflecting the new value, and zero routing-config/feedback messages, for a legal operator/level pair; throws RangeError for an illegal one', async () => {
      const { service, node, instrumentState } = await setupReady();
      const before = node.port.postedMessages.length;

      service.updateOperatorLevel(1, MAX_OUTPUT_LEVEL);

      expect(node.port.postedMessages.slice(before)).toEqual([
        setOperatorParametersMessage(instrumentState.operators()),
      ]);
      expect(instrumentState.operators()[1].outputLevel).toBe(MAX_OUTPUT_LEVEL);
      expect(messagesOfKindSince(node, 'setAlgorithm', before)).toEqual([]);
      expect(messagesOfKindSince(node, 'setFeedback', before)).toEqual([]);

      expect(() => service.updateOperatorLevel(1, MIN_OUTPUT_LEVEL - 1)).toThrow(RangeError);
      expect(() => service.updateOperatorLevel(1, MAX_OUTPUT_LEVEL + 1)).toThrow(RangeError);
      expect(() => service.updateOperatorLevel(7 as never, 50)).toThrow(RangeError);
    });

    it('a ratio, detune, or mode change via InstrumentState.updateOperator — none of which has a SynthEngine interface method — each reach the port in an operator-parameters message carrying the new value', async () => {
      const { node, instrumentState } = await setupReady();

      let before = node.port.postedMessages.length;
      instrumentState.updateOperator(2, { ratio: 3 });
      TestBed.tick();
      expect(node.port.postedMessages.slice(before)).toEqual([
        setOperatorParametersMessage(instrumentState.operators()),
      ]);
      expect(instrumentState.operators()[2].ratio).toBe(3);

      before = node.port.postedMessages.length;
      instrumentState.updateOperator(3, { detune: 5 });
      TestBed.tick();
      expect(node.port.postedMessages.slice(before)).toEqual([
        setOperatorParametersMessage(instrumentState.operators()),
      ]);
      expect(instrumentState.operators()[3].detune).toBe(5);

      before = node.port.postedMessages.length;
      instrumentState.updateOperator(4, { mode: 'fixed', fixedFrequencyHz: 880 });
      TestBed.tick();
      expect(node.port.postedMessages.slice(before)).toEqual([
        setOperatorParametersMessage(instrumentState.operators()),
      ]);
      expect(instrumentState.operators()[4].mode).toBe('fixed');
    });

    it('re-patches through InstrumentState.setAlgorithm() via the constructor effect, without any engine method being called — posts only the routing-config message', async () => {
      const { node, instrumentState } = await setupReady();
      const before = node.port.postedMessages.length;

      instrumentState.setAlgorithm(32);
      TestBed.tick();

      const routingConfig = buildRoutingConfig(instrumentState.algorithm());
      expect(node.port.postedMessages.slice(before)).toEqual([
        setAlgorithmMessage(routingConfig.connections, routingConfig.carriers),
      ]);
    });

    it('re-observing an unchanged InstrumentState snapshot posts nothing', async () => {
      const { node } = await setupReady();
      const before = node.port.postedMessages.length;

      TestBed.tick();

      expect(node.port.postedMessages.length).toBe(before);
    });
  });

  it("D-13: switching algorithms while a note is held re-patches live — setAlgorithm posts a routing-config message while the note is still held, with no second note-frequency message and no gate message", async () => {
    const { service, node } = await setupReady();
    service.noteOn(60, 100);
    const before = node.port.postedMessages.length;

    service.setAlgorithm(32);

    expect(messagesOfKindSince(node, 'setAlgorithm', before).length).toBe(1);
    expect(messagesOfKindSince(node, 'setFrequency', before)).toEqual([]);
    // setAlgorithm never touches the gate — no gate message of any kind (in
    // particular, no silencing close-gate message) was posted by the switch.
    expect(messagesOfKindSince(node, 'setGate', before)).toEqual([]);

    // The held voice is still sounding, not cut: the previously-held note 60
    // still triggers a real release, proving the switch never cleared
    // `heldNote` (mirrors WebAudioSynthEngine's D-13 held-note behaviour).
    const beforeRelease = node.port.postedMessages.length;
    service.noteOff(60);
    expect(node.port.postedMessages.slice(beforeRelease)).toEqual([setGateMessage(false, MIN_VELOCITY)]);
  });

  it('destroy() clears the worklet port handler, empties every created node connection — including the analyser, named explicitly so a future createdNodes-getter change cannot silently drop this coverage — closes the context exactly once, and resets status to suspended', async () => {
    const { service, context, node } = await setupReady();
    node.port.onmessage = () => undefined;
    const analyser = findAnalyser(context);

    service.destroy();

    expect(node.port.onmessage).toBeNull();
    expect(node.connections.size).toBe(0);
    // The full created-node registry (10-01-PLAN.md Task 2, item 1) —
    // covers whatever node types `createdNodes` reports, oscillators/gains/
    // delays/analysers alike, not just the ones this test names explicitly.
    for (const created of context.createdNodes) {
      expect(created.connections.size).toBe(0);
    }
    // Named explicitly, on top of the registry walk above, so a future
    // change to `createdNodes`'s getter (e.g. one that stops including
    // analysers) cannot silently drop analyser teardown coverage.
    expect(analyser.connections.size).toBe(0);
    expect(context.closeCalls).toBe(1);
    expect(service.status()).toBe('suspended');
  });

  describe('AnalyserNode teardown and rebuild (10-01-PLAN.md Task 2)', () => {
    it('readTimeDomainInto/readFrequencyInto both return false again after destroy()', async () => {
      const { service } = await setupReady();

      service.destroy();

      const timeBuffer = new Uint8Array(ANALYSER_FFT_SIZE).fill(9);
      const frequencyBuffer = new Uint8Array(ANALYSER_FREQUENCY_BIN_COUNT).fill(9);
      expect(service.readTimeDomainInto(timeBuffer)).toBe(false);
      expect(service.readFrequencyInto(frequencyBuffer)).toBe(false);
      expect(timeBuffer.every((byte) => byte === 9)).toBe(true);
      expect(frequencyBuffer.every((byte) => byte === 9)).toBe(true);
    });

    it('an error partway through graph construction — after the analyser is built but before the chain finishes connecting — still discards it disconnected, exercised through the same discard path (discardLocalGraph) the existing deferred-addModule interruption spec above uses', async () => {
      const { service } = setup();
      // masterGain.connect(analyser) is the connect call that runs right
      // after the analyser has been created and committed to the local
      // `built` graph (buildAndStart commits `built.analyser` immediately
      // on creation — 10-01-PLAN.md Task 2's own reordering fix) but before
      // the chain finishes wiring to context.destination. Failing exactly
      // here proves discardLocalGraph reaches and disconnects an analyser
      // that was successfully built, not merely one that was never created.
      const connectSpy = vi
        .spyOn(FakeGainNode.prototype, 'connect')
        .mockImplementationOnce(() => {
          throw new Error('simulated masterGain.connect(analyser) failure (test double)');
        });

      try {
        await service.initialize();

        expect(service.status()).toBe('error');
        const builtContext = FakeAudioWorkletContext.instances[0] as FakeAudioWorkletContext;
        expect(builtContext.createdAnalysers.length).toBe(1);
        const analyser = builtContext.createdAnalysers[0];
        expect(analyser.connections.size).toBe(0);
        // The masterGain's own connect-to-analyser edge never took hold
        // either — the throw happened before it could be added — and any
        // edge the worklet node made to masterGain before the throw is torn
        // down by the same discard call.
        const masterGain = builtContext.createdGains[0];
        expect(masterGain.connections.size).toBe(0);
        expect(builtContext.closeCalls).toBeGreaterThanOrEqual(1);
      } finally {
        connectSpy.mockRestore();
      }
    });

    it('a second initialize() after destroy() builds a second analyser and re-establishes the full masterGain -> analyser -> destination chain, leaving no stale reference', async () => {
      const { service, context } = await setupReady();
      const firstAnalyser = findAnalyser(context);

      service.destroy();
      await service.initialize();

      // initialize() constructs a brand new AudioContext each time
      // (`new contextCtor()` inside buildAndStart) — the second graph lives
      // on the second context instance, not the first `context` reused.
      expect(FakeAudioWorkletContext.instances.length).toBe(2);
      const secondContext = FakeAudioWorkletContext.instances[1] as FakeAudioWorkletContext;
      expect(secondContext.createdAnalysers.length).toBe(1);
      const secondAnalyser = findAnalyser(secondContext);
      expect(secondAnalyser).not.toBe(firstAnalyser);

      const secondMasterGain = findMasterGain(secondContext);
      expect(secondMasterGain.connections.has(secondAnalyser)).toBe(true);
      expect(secondMasterGain.connections.has(secondContext.destination)).toBe(false);
      expect(secondAnalyser.connections.has(secondContext.destination)).toBe(true);

      // readTimeDomainInto now serves the second analyser's canned data, not
      // a stale reference to the first (destroyed) one — only while a note
      // is held (initialization alone is not live audio).
      const canned = new Uint8Array(ANALYSER_FFT_SIZE).fill(77);
      secondAnalyser.cannedTimeDomainData = canned;
      service.noteOn(60, 100);
      const buffer = new Uint8Array(ANALYSER_FFT_SIZE);
      expect(service.readTimeDomainInto(buffer)).toBe(true);
      expect(buffer).toEqual(canned);
    });
  });

  it('destroy() posts a closed gate message for an in-flight note before tearing the graph down, releasing it rather than cutting it', async () => {
    const { service, node } = await setupReady();
    service.noteOn(60, 100);
    const before = node.port.postedMessages.length;

    service.destroy();

    expect(node.port.postedMessages.slice(before)).toEqual([setGateMessage(false, MIN_VELOCITY)]);
  });

  it('destroy() leaves no held note: noteOff for the previously held note throws nothing and posts nothing', async () => {
    const { service, node } = await setupReady();
    service.noteOn(60, 100);

    service.destroy();

    const before = node.port.postedMessages.length;
    expect(() => service.noteOff(60)).not.toThrow();
    expect(node.port.postedMessages.length).toBe(before);
  });

  it('D-01: SYNTH_ENGINE now resolves to WorkletSynthEngine (Phase 8 cutover)', () => {
    const engine = TestBed.inject(SYNTH_ENGINE);

    expect(engine).toBeInstanceOf(WorkletSynthEngine);
  });
});

/**
 * Pitfall 2's mechanical guard, end to end (Phase 9): `WorkletSynthEngine`
 * itself no longer applies velocity — it posts the raw MIDI-style value
 * unconverted (proved above) — so this regression exercises `GraphRouter`
 * directly, the render-thread kernel where `setGate`'s velocity conversion
 * actually happens. Two independently-constructed, identically-configured
 * routers gated at different velocities are compared, proving both the
 * direction (louder velocity is louder) and the exact curve-predicted ratio
 * survived the removal of the dedicated per-voice Web Audio gain node.
 */
describe('End-to-end velocity regression (Pitfall 2) — GraphRouter, since WorkletSynthEngine no longer converts velocity', () => {
  const SAMPLE_RATE = 44100;
  const NOTE_FREQUENCY_HZ = 440;
  const LOW_VELOCITY = 20;
  const HIGH_VELOCITY = 120;
  const routedAlgorithm = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;

  /** Enough blocks for `DEFAULT_ENVELOPE`'s attack segment (rate index 0) to
   * fully complete, computed from the exported rate curve rather than
   * hardcoded, plus a one-block margin. */
  const ATTACK_BLOCK_COUNT =
    Math.ceil(
      Math.ceil(99 / envelopeRateToLevelUnitsPerSample(DEFAULT_ENVELOPE.rates[0], SAMPLE_RATE)) /
        RENDER_QUANTUM_FRAMES,
    ) + 1;

  function renderGatedBlock(velocity: number): Float32Array {
    const router = new GraphRouter(SAMPLE_RATE, RENDER_QUANTUM_FRAMES);
    router.setRouting(buildRoutingConfig(routedAlgorithm));
    router.setOperatorParameters(DEFAULT_PATCH.operators);
    router.setFeedbackLevel(0);
    router.setNoteFrequencyHz(NOTE_FREQUENCY_HZ);
    router.setGate(true, velocity);

    const scratch = new Float32Array(RENDER_QUANTUM_FRAMES);
    for (let block = 0; block < ATTACK_BLOCK_COUNT; block++) {
      router.render(scratch);
    }
    const output = new Float32Array(RENDER_QUANTUM_FRAMES);
    router.render(output);
    return output;
  }

  function peakAbsAmplitude(block: Float32Array): number {
    let peak = 0;
    for (const sample of block) {
      peak = Math.max(peak, Math.abs(sample));
    }
    return peak;
  }

  it('two notes gated at different velocities produce peak amplitudes in the direction, and at the ratio, velocityToAmplitude predicts', () => {
    const lowPeak = peakAbsAmplitude(renderGatedBlock(LOW_VELOCITY));
    const highPeak = peakAbsAmplitude(renderGatedBlock(HIGH_VELOCITY));

    expect(highPeak).toBeGreaterThan(lowPeak);

    const actualRatio = highPeak / lowPeak;
    const expectedRatio = velocityToAmplitude(HIGH_VELOCITY) / velocityToAmplitude(LOW_VELOCITY);
    // Matches this codebase's existing cross-check convention
    // (CROSS_CHECK_DECIMAL_PLACES = 6 in algorithm-routing.spec.ts).
    expect(actualRatio).toBeCloseTo(expectedRatio, 6);
  });
});
