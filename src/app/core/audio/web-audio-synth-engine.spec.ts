import { TestBed } from '@angular/core/testing';

import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import { deriveCarriers, getFeedbackOperator } from '../../domain/dx7/models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../../domain/dx7/models/operator';
import type { AlgorithmDefinition } from '../../domain/dx7/models/algorithm-definition';
import { planConnections } from '../../domain/dx7/audio/patch-plan';
import {
  MAX_MIDI_NOTE,
  MAX_VELOCITY,
  MIN_MIDI_NOTE,
  MIN_VELOCITY,
  feedbackLevelToDepthHz,
  midiNoteToFrequency,
  operatorFrequencyHz,
  outputLevelToModulationDepthHz,
} from '../../domain/dx7/audio/value-conversion';
import { InstrumentState } from '../../state/instrument-state';
import { AUDIO_CONTEXT_CTOR, type AudioContextConstructorLike } from './audio-context.token';
import {
  FakeAudioContext,
  FakeDelayNode,
  FakeGainNode,
  FakeOscillatorNode,
  ThrowingAudioContext,
} from './testing/fake-audio-context';
import { RELEASE_TIME_CONSTANT, RETRIGGER_CUT_SECONDS, WebAudioSynthEngine } from './web-audio-synth-engine';

/**
 * Engine lifecycle spec — mirrors `motion-preference.spec.ts`'s
 * `setup()`-helper-plus-flat-`it()` structure. Every case here injects a
 * fake `AudioContext` constructor; no spec touches a real Web Audio global
 * (`jsdom` has none, `05-RESEARCH.md` Pitfall 6).
 */
function setup(ctor: AudioContextConstructorLike | null = FakeAudioContext) {
  FakeAudioContext.instances.length = 0;
  TestBed.configureTestingModule({
    providers: [{ provide: AUDIO_CONTEXT_CTOR, useValue: ctor }],
  });
  return { service: TestBed.inject(WebAudioSynthEngine) };
}

/** The masterGain is the fake gain node connected to `context.destination`. */
function findMasterGain(context: FakeAudioContext): FakeGainNode {
  const masterGain = context.createdGains.find((gain) => gain.connections.has(context.destination));
  if (masterGain === undefined) {
    throw new Error('masterGain was not created — buildGraph did not run as expected');
  }
  return masterGain;
}

/** The voiceGain is the fake gain node connected to masterGain. */
function findVoiceGain(context: FakeAudioContext): FakeGainNode {
  const masterGain = findMasterGain(context);
  const voiceGain = context.createdGains.find((gain) => gain.connections.has(masterGain));
  if (voiceGain === undefined) {
    throw new Error('voiceGain was not created — buildGraph did not run as expected');
  }
  return voiceGain;
}

async function setupReady() {
  const { service } = setup();
  await service.initialize();
  const context = FakeAudioContext.instances[0];
  const voiceGain = findVoiceGain(context);
  return { service, context, voiceGain };
}

interface OperatorFakeNodes {
  readonly oscillator: FakeOscillatorNode;
  readonly levelGain: FakeGainNode;
  readonly feedbackGain: FakeGainNode;
  readonly feedbackDelay: FakeDelayNode;
}

/**
 * Resolves each of the six persistent operator node bundles from the fake
 * context's creation-order arrays, without relying on any assumed ordering
 * beyond what `buildGraph()` itself guarantees: `createdOscillators[i]`
 * corresponds to `OPERATOR_IDS[i]`, and each oscillator's two connected
 * gains are disambiguated by which one is (persistently, never torn down)
 * wired to a `FakeDelayNode` — that one is the `feedbackGain`.
 */
function findOperatorNodes(context: FakeAudioContext): ReadonlyMap<OperatorId, OperatorFakeNodes> {
  const map = new Map<OperatorId, OperatorFakeNodes>();
  OPERATOR_IDS.forEach((operatorId, index) => {
    const oscillator = context.createdOscillators[index];
    const connectedGains = context.createdGains.filter((gain) => oscillator.connections.has(gain));
    const feedbackGain = connectedGains.find((gain) =>
      context.createdDelays.some((delay) => gain.connections.has(delay)),
    );
    const levelGain = connectedGains.find((gain) => gain !== feedbackGain);
    const feedbackDelay = context.createdDelays.find((delay) => feedbackGain?.connections.has(delay));
    if (feedbackGain === undefined || levelGain === undefined || feedbackDelay === undefined) {
      throw new Error(`could not resolve operator ${operatorId}'s fake nodes`);
    }
    map.set(operatorId, { oscillator, levelGain, feedbackGain, feedbackDelay });
  });
  return map;
}

function findAlgorithm(id: number): AlgorithmDefinition {
  const algorithm = ALGORITHMS.find((candidate) => candidate.id === id);
  if (algorithm === undefined) {
    throw new Error(`fixture algorithm ${id} not found in ALGORITHMS`);
  }
  return algorithm;
}

/**
 * Asserts the live fake-node topology equals exactly the connections
 * `planConnections`/`deriveCarriers` derive for `algorithm` — computed here
 * from the same pure functions the engine itself calls, never a hardcoded
 * per-algorithm table. Because every assertion is an exact match (one
 * connection per node, no more), this also proves no link from a
 * previously-applied algorithm survives.
 */
function assertTopologyMatchesAlgorithm(
  algorithm: AlgorithmDefinition,
  operatorNodes: ReadonlyMap<OperatorId, OperatorFakeNodes>,
  voiceGain: FakeGainNode,
): void {
  const plan = planConnections(algorithm);
  const carriers = new Set(deriveCarriers(algorithm));
  const feedbackOperator = getFeedbackOperator(algorithm);

  for (const operatorId of OPERATOR_IDS) {
    const nodes = operatorNodes.get(operatorId);
    if (nodes === undefined) {
      throw new Error(`missing fake nodes for operator ${operatorId}`);
    }

    if (operatorId === feedbackOperator) {
      expect(nodes.feedbackDelay.connections.size).toBe(1);
      expect(nodes.feedbackDelay.connections.has(nodes.oscillator.frequency)).toBe(true);
    } else {
      expect(nodes.feedbackDelay.connections.size).toBe(0);
    }

    if (carriers.has(operatorId)) {
      expect(nodes.levelGain.connections.size).toBe(1);
      expect(nodes.levelGain.connections.has(voiceGain)).toBe(true);
    } else {
      // An operator can fan out to more than one target (e.g. one
      // modulator feeding two carriers) — levelGain.connect() is called
      // once per outgoing non-feedback edge, so the expected connection
      // set has exactly as many entries as this operator has outgoing
      // non-feedback edges, not necessarily one.
      const outgoing = plan.filter((connection) => !connection.isFeedback && connection.from === operatorId);
      if (outgoing.length === 0) {
        throw new Error(`operator ${operatorId} is neither a carrier nor a modulation source in Algorithm ${algorithm.id}`);
      }
      expect(nodes.levelGain.connections.size).toBe(outgoing.length);
      for (const connection of outgoing) {
        const target = operatorNodes.get(connection.to);
        if (target === undefined) {
          throw new Error(`missing fake nodes for target operator ${connection.to}`);
        }
        expect(nodes.levelGain.connections.has(target.oscillator.frequency)).toBe(true);
      }
    }
  }
}

describe('WebAudioSynthEngine', () => {
  describe('AudioEngineStatus reachability', () => {
    it("is 'suspended' immediately on construction — DI instantiation alone never invokes the AudioContext constructor", () => {
      const { service } = setup();

      expect(service.status()).toBe('suspended');
      expect(FakeAudioContext.instances.length).toBe(0);
    });

    it("is 'unavailable' on construction when no AudioContext constructor exists, and initialize() is then a no-op", async () => {
      const { service } = setup(null);

      expect(service.status()).toBe('unavailable');

      await service.initialize();

      expect(service.status()).toBe('unavailable');
      expect(FakeAudioContext.instances.length).toBe(0);
    });

    it("resolves to 'ready' after a successful initialize(), leaving the fake context 'running'", async () => {
      const { service } = setup();

      await service.initialize();

      expect(service.status()).toBe('ready');
      expect(FakeAudioContext.instances[0].state).toBe('running');
    });

    it("is 'error' when the injected AudioContext constructor throws", async () => {
      const { service } = setup(ThrowingAudioContext as unknown as AudioContextConstructorLike);

      await service.initialize();

      expect(service.status()).toBe('error');
    });
  });

  it('recovers to ready after a failed initialize(), dropping the failed context reference behind', async () => {
    let attempts = 0;
    class FlakyAudioContext extends FakeAudioContext {
      constructor() {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('simulated AudioContext construction failure');
        }
        super();
      }
    }

    const { service } = setup(FlakyAudioContext);

    await service.initialize();
    expect(service.status()).toBe('error');

    await service.initialize();
    expect(service.status()).toBe('ready');
    // Only the second, successful construction registered — the failed
    // attempt threw before FakeAudioContext's own constructor ever ran.
    expect(FakeAudioContext.instances.length).toBe(1);
  });

  it('CR-02: closes the AudioContext when it was constructed successfully but graph construction fails afterward', async () => {
    // Unlike FlakyAudioContext/ThrowingAudioContext (both throw *before*
    // FakeAudioContext's own constructor runs, so `this.context` is never
    // assigned), this fake constructs successfully and only fails inside
    // `resume()` — reaching the "context exists, buildGraph/resume throws"
    // path that previously leaked the context.
    class FailsAfterConstructionAudioContext extends FakeAudioContext {
      override resume(): Promise<void> {
        throw new Error('simulated resume() failure after construction');
      }
    }

    const { service } = setup(FailsAfterConstructionAudioContext);

    await service.initialize();

    expect(service.status()).toBe('error');
    expect(FakeAudioContext.instances.length).toBe(1);
    expect(FakeAudioContext.instances[0].closeCalls).toBe(1);
  });

  it('constructs exactly one context and exactly six oscillators even when initialize() is called twice', async () => {
    const { service } = setup();

    await service.initialize();
    await service.initialize();

    expect(FakeAudioContext.instances.length).toBe(1);
    expect(FakeAudioContext.instances[0].createdOscillators.length).toBe(6);
  });

  it('starts each of the six oscillators exactly once', async () => {
    const { service } = setup();

    await service.initialize();

    const context = FakeAudioContext.instances[0];
    expect(context.createdOscillators.length).toBe(6);
    for (const oscillator of context.createdOscillators) {
      expect(oscillator.startCalls.length).toBe(1);
    }
  });

  it('destroy() stops every started oscillator once, disconnects every created node, closes the context, and returns status to suspended', async () => {
    const { service } = setup();

    await service.initialize();
    const context = FakeAudioContext.instances[0];

    service.destroy();

    for (const oscillator of context.createdOscillators) {
      expect(oscillator.stopCalls.length).toBe(1);
    }
    for (const node of context.createdNodes) {
      expect(node.connections.size).toBe(0);
    }
    expect(context.state).toBe('closed');
    expect(service.status()).toBe('suspended');
  });

  it('destroy() called while initialize() is still awaiting context.resume() leaves status at suspended, not a resurrected ready', async () => {
    const { service } = setup();

    const initializePromise = service.initialize();
    // `resume()` is a genuine async boundary (a real Promise, even on the
    // fake) — destroy() runs here, before initialize()'s continuation does.
    service.destroy();
    await initializePromise;

    expect(service.status()).toBe('suspended');
    expect(FakeAudioContext.instances[0].closeCalls).toBe(1);
  });

  it('destroy() called while initialize() is pending does not clobber a subsequent, legitimate re-initialize()', async () => {
    const { service } = setup();

    const stalePromise = service.initialize();
    service.destroy();
    const secondInitializePromise = service.initialize();
    await Promise.all([stalePromise, secondInitializePromise]);

    expect(service.status()).toBe('ready');
    expect(FakeAudioContext.instances.length).toBe(2);
    // The second, legitimate context must still be open — the stale first
    // call's continuation must not have nulled it out or closed it.
    expect(FakeAudioContext.instances[1].state).toBe('running');
    expect(FakeAudioContext.instances[1].closeCalls).toBe(0);
  });

  it('runs the same teardown on injector destruction, without an explicit destroy() call', async () => {
    const { service } = setup();
    await service.initialize();

    const destroySpy = vi.spyOn(service, 'destroy');
    TestBed.resetTestingModule();

    expect(destroySpy).toHaveBeenCalled();
  });

  describe('note lifecycle', () => {
    it('rejects a non-integer, out-of-range, NaN, or Infinity note with a RangeError and schedules no automation', async () => {
      const { service, voiceGain } = await setupReady();

      const invalidNotes = [60.5, MIN_MIDI_NOTE - 1, MAX_MIDI_NOTE + 1, NaN, Infinity];
      for (const note of invalidNotes) {
        expect(() => service.noteOn(note, 100)).toThrow(RangeError);
      }
      expect(voiceGain.gain.automationEntries.length).toBe(0);
    });

    it('rejects an out-of-range velocity with a RangeError and schedules no automation', async () => {
      const { service, voiceGain } = await setupReady();

      const invalidVelocities = [MIN_VELOCITY - 1, MAX_VELOCITY + 1, 0.5, NaN];
      for (const velocity of invalidVelocities) {
        expect(() => service.noteOn(60, velocity)).toThrow(RangeError);
      }
      expect(voiceGain.gain.automationEntries.length).toBe(0);
    });

    it('schedules a rising ramp on note-on and terminates release at exactly 0 on note-off', async () => {
      const { service, voiceGain } = await setupReady();

      service.noteOn(60, 100);
      const risingRamp = voiceGain.gain.automationEntries.find(
        (entry) => entry.method === 'linearRampToValueAtTime' && entry.value > 0,
      );
      expect(risingRamp).toBeTruthy();

      service.noteOff(60);
      const lastEntry = voiceGain.gain.automationEntries.at(-1);
      expect(lastEntry?.method).toBe('setValueAtTime');
      expect(lastEntry?.value).toBe(0);
    });

    it('cancels a still-running ramp with cancelAndHoldAtTime, not cancelScheduledValues plus a manual re-read of .value — the former holds the interpolated value atomically, the latter is not consistently the mid-ramp value across browsers', async () => {
      const { service, voiceGain } = await setupReady();

      service.noteOn(60, 100);
      expect(voiceGain.gain.automationEntries[0].method).toBe('cancelAndHoldAtTime');

      const entriesBeforeRelease = voiceGain.gain.automationEntries.length;
      service.noteOff(60);
      const releaseEntries = voiceGain.gain.automationEntries.slice(entriesBeforeRelease);
      expect(releaseEntries[0].method).toBe('cancelAndHoldAtTime');
      expect(voiceGain.gain.automationEntries.some((entry) => entry.method === 'cancelScheduledValues')).toBe(false);
    });

    it("WR-04: note-off's setTargetAtTime carries RELEASE_TIME_CONSTANT, not some other time constant", async () => {
      const { service, voiceGain } = await setupReady();

      service.noteOn(60, 100);
      service.noteOff(60);

      const releaseEntry = voiceGain.gain.automationEntries.find((entry) => entry.method === 'setTargetAtTime');
      expect(releaseEntry?.timeConstant).toBe(RELEASE_TIME_CONSTANT);
    });

    it('ignores a note-off for a note that is not the currently held note', async () => {
      const { service, voiceGain } = await setupReady();

      service.noteOn(60, 100);
      const entriesAfterNoteOn = voiceGain.gain.automationEntries.length;

      service.noteOff(61);

      expect(voiceGain.gain.automationEntries.length).toBe(entriesAfterNoteOn);
    });

    it('terminates the schedule at exactly 0 and clears the held note on allNotesOff()', async () => {
      const { service, voiceGain } = await setupReady();

      service.noteOn(60, 100);
      service.allNotesOff();

      const lastEntry = voiceGain.gain.automationEntries.at(-1);
      expect(lastEntry?.method).toBe('setValueAtTime');
      expect(lastEntry?.value).toBe(0);

      // A stale release for the previously-held note is now a no-op — proves
      // the held note was cleared, not merely silenced.
      const entriesAfterAllNotesOff = voiceGain.gain.automationEntries.length;
      service.noteOff(60);
      expect(voiceGain.gain.automationEntries.length).toBe(entriesAfterAllNotesOff);
    });

    it('D-04 retrigger: cuts toward zero, retunes at the cut boundary (not call time), and creates/starts/stops zero nodes', async () => {
      const { service, context, voiceGain } = await setupReady();

      service.noteOn(60, 100);
      const oscillatorCountBefore = context.createdOscillators.length;
      const startCallsBefore = context.createdOscillators.map((oscillator) => oscillator.startCalls.length);
      const stopCallsBefore = context.createdOscillators.map((oscillator) => oscillator.stopCalls.length);

      const entriesBeforeRetrigger = voiceGain.gain.automationEntries.length;
      service.noteOn(64, 110);
      const retriggerEntries = voiceGain.gain.automationEntries.slice(entriesBeforeRetrigger);

      // Begins with a cancel-and-hold + a ramp toward zero...
      expect(retriggerEntries[0].method).toBe('cancelAndHoldAtTime');
      const rampToZero = retriggerEntries.find(
        (entry) => entry.method === 'linearRampToValueAtTime' && entry.value === 0,
      );
      expect(rampToZero).toBeTruthy();

      // ...and ends with a ramp up to the new note's level.
      const lastEntry = retriggerEntries.at(-1);
      expect(lastEntry?.method).toBe('linearRampToValueAtTime');
      expect(lastEntry?.value).toBeGreaterThan(0);

      // The retuned frequency is scheduled at the cut boundary, not at call time.
      const cutBoundaryTime = rampToZero!.time;
      expect(cutBoundaryTime).toBeCloseTo(context.currentTime + RETRIGGER_CUT_SECONDS, 10);
      for (const { frequency } of context.createdOscillators.map((oscillator) => ({ frequency: oscillator.frequency }))) {
        const retunedEntry = frequency.automationEntries.at(-1);
        expect(retunedEntry?.time).toBeCloseTo(cutBoundaryTime, 10);
      }

      // Zero nodes created, started, or stopped by the retrigger.
      expect(context.createdOscillators.length).toBe(oscillatorCountBefore);
      expect(context.createdOscillators.map((oscillator) => oscillator.startCalls.length)).toEqual(startCallsBefore);
      expect(context.createdOscillators.map((oscillator) => oscillator.stopCalls.length)).toEqual(stopCallsBefore);
    });

    it('records zero direct value assignments on the voice gain across a full note-on/note-off cycle', async () => {
      const { service, voiceGain } = await setupReady();

      const directAssignmentsBefore = voiceGain.gain.directAssignmentCount;
      service.noteOn(60, 100);
      service.noteOff(60);

      expect(voiceGain.gain.directAssignmentCount).toBe(directAssignmentsBefore);
    });
  });

  describe('routing (D-01 all 32 algorithms, D-02 live re-patch)', () => {
    it('applies all 32 algorithm ids without throwing, with the live topology matching planConnections/deriveCarriers exactly', async () => {
      const { service, context, voiceGain } = await setupReady();
      const operatorNodes = findOperatorNodes(context);

      for (const algorithm of ALGORITHMS) {
        expect(() => service.setAlgorithm(algorithm.id)).not.toThrow();
        assertTopologyMatchesAlgorithm(algorithm, operatorNodes, voiceGain);
      }
    });

    it('produces exactly one delay-to-frequency link when getFeedbackOperator returns an operator, and zero when it returns null', async () => {
      const { service, context } = await setupReady();
      const operatorNodes = findOperatorNodes(context);

      for (const algorithm of ALGORITHMS) {
        service.setAlgorithm(algorithm.id);
        const feedbackOperator = getFeedbackOperator(algorithm);
        const delayLinkCount = OPERATOR_IDS.reduce((count, operatorId) => {
          const nodes = operatorNodes.get(operatorId);
          return nodes !== undefined && nodes.feedbackDelay.connections.size > 0 ? count + 1 : count;
        }, 0);
        expect(delayLinkCount).toBe(feedbackOperator === null ? 0 : 1);
      }
    });

    it('switch matrix: after switching across representative algorithm pairs, the live topology always matches the destination algorithm exactly (no stale link from the source)', async () => {
      const { service, context, voiceGain } = await setupReady();
      const operatorNodes = findOperatorNodes(context);

      // Every algorithm in this dataset carries feedback (verified: all 32
      // rows declare a `from === to` self-loop edge in algorithms.ts), so a
      // "feedback to no-feedback" pair does not exist in the canonical
      // dataset. This sequence instead switches between pairs whose
      // feedback OPERATOR and carrier/modulator shape differ substantially
      // (a deep stack vs. six independent carriers vs. a feedback op on a
      // pure modulator), which equally proves "no stale link survives"
      // because each assertion is an exact-match check.
      const sequence = [1, 32, 2, 1];

      for (const algorithmId of sequence) {
        service.setAlgorithm(algorithmId);
        assertTopologyMatchesAlgorithm(findAlgorithm(algorithmId), operatorNodes, voiceGain);
      }
    });

    it('switching algorithms while a note is held creates zero nodes, adds no voice-gain automation entry, and starts/stops no oscillator', async () => {
      const { service, context, voiceGain } = await setupReady();

      service.noteOn(60, 100);

      const oscillatorCountBefore = context.createdOscillators.length;
      const gainCountBefore = context.createdGains.length;
      const delayCountBefore = context.createdDelays.length;
      const startCallsBefore = context.createdOscillators.map((oscillator) => oscillator.startCalls.length);
      const stopCallsBefore = context.createdOscillators.map((oscillator) => oscillator.stopCalls.length);
      const voiceGainEntriesBefore = voiceGain.gain.automationEntries.length;

      service.setAlgorithm(32);

      expect(context.createdOscillators.length).toBe(oscillatorCountBefore);
      expect(context.createdGains.length).toBe(gainCountBefore);
      expect(context.createdDelays.length).toBe(delayCountBefore);
      expect(context.createdOscillators.map((oscillator) => oscillator.startCalls.length)).toEqual(startCallsBefore);
      expect(context.createdOscillators.map((oscillator) => oscillator.stopCalls.length)).toEqual(stopCallsBefore);
      expect(voiceGain.gain.automationEntries.length).toBe(voiceGainEntriesBefore);
    });

    it('setAlgorithm applies routing synchronously, and the effect skips re-applying that same snapshot', async () => {
      const { service, context, voiceGain } = await setupReady();
      const operatorNodes = findOperatorNodes(context);
      const carrierNodes = operatorNodes.get(1);
      if (carrierNodes === undefined) {
        throw new Error('missing fake nodes for operator 1');
      }
      const entriesBefore = carrierNodes.levelGain.gain.automationEntries.length;

      service.setAlgorithm(32);
      assertTopologyMatchesAlgorithm(findAlgorithm(32), operatorNodes, voiceGain);
      const entriesAfterSync = carrierNodes.levelGain.gain.automationEntries.length;
      expect(entriesAfterSync).toBeGreaterThan(entriesBefore);

      TestBed.tick();
      expect(carrierNodes.levelGain.gain.automationEntries.length).toBe(entriesAfterSync);
    });

    it('re-patches through InstrumentState.setAlgorithm() via the constructor effect, without the caller touching the engine directly', async () => {
      const { context, voiceGain } = await setupReady();
      const operatorNodes = findOperatorNodes(context);
      const instrumentState = TestBed.inject(InstrumentState);

      instrumentState.setAlgorithm(32);
      TestBed.tick();

      assertTopologyMatchesAlgorithm(findAlgorithm(32), operatorNodes, voiceGain);
    });

    it('a disabled operator contributes zero gain on both its carrier path and its modulation path', async () => {
      const { service, context } = await setupReady();
      const operatorNodes = findOperatorNodes(context);
      const instrumentState = TestBed.inject(InstrumentState);

      // Algorithm 32: six independent carriers, each with its own feedback
      // self-loop test only on operator 6 — disable a carrier (operator 1)
      // and disable the feedback operator (operator 6) to cover both paths.
      service.setAlgorithm(32);
      instrumentState.updateOperator(1, { enabled: false });
      instrumentState.updateOperator(6, { enabled: false });
      TestBed.tick();

      const carrierNodes = operatorNodes.get(1);
      const feedbackNodes = operatorNodes.get(6);
      if (carrierNodes === undefined || feedbackNodes === undefined) {
        throw new Error('missing fake nodes for operators 1 or 6');
      }
      expect(carrierNodes.levelGain.gain.value).toBe(0);
      expect(feedbackNodes.feedbackGain.gain.value).toBe(0);
    });

    it('sets the feedback delay time to a minimal non-zero value derived from the context sample rate', async () => {
      const { context } = await setupReady();
      const operatorNodes = findOperatorNodes(context);

      for (const operatorId of OPERATOR_IDS) {
        const nodes = operatorNodes.get(operatorId);
        if (nodes === undefined) {
          throw new Error(`missing fake nodes for operator ${operatorId}`);
        }
        expect(nodes.feedbackDelay.delayTime.value).toBeGreaterThan(0);
        expect(nodes.feedbackDelay.delayTime.value).toBeLessThan(0.01);
      }
    });

    it('CR-01: modulation/feedback depth tracks the currently-held note, not a stale readback from before any note (or a different note) played', async () => {
      const { service, context } = await setupReady();
      const operatorNodes = findOperatorNodes(context);
      const instrumentState = TestBed.inject(InstrumentState);

      service.setAlgorithm(1);
      service.setFeedback(4);

      const algorithm = findAlgorithm(1);
      const feedbackOperatorId = getFeedbackOperator(algorithm);
      const modulationEdge = planConnections(algorithm).find((connection) => !connection.isFeedback);
      if (feedbackOperatorId === null || modulationEdge === undefined) {
        throw new Error('Algorithm 1 fixture must have both a feedback loop and a modulation edge for this test');
      }
      const feedbackNodes = operatorNodes.get(feedbackOperatorId);
      const modulatorNodes = operatorNodes.get(modulationEdge.from);
      if (feedbackNodes === undefined || modulatorNodes === undefined) {
        throw new Error('missing fake nodes for the feedback/modulator operator');
      }

      const operators = instrumentState.operators();
      const feedbackLevel = instrumentState.feedback();

      // Before CR-01, this depth was frozen at whatever the (unset,
      // default-440Hz) oscillator frequency was when applyRouting() last
      // ran (here, at the setAlgorithm/setFeedback calls above) — never
      // recomputed from the note actually played.
      service.noteOn(60, 100);
      const frequencyAt60 = midiNoteToFrequency(60);
      expect(feedbackNodes.feedbackGain.gain.value).toBeCloseTo(
        feedbackLevelToDepthHz(feedbackLevel, operatorFrequencyHz(operators[feedbackOperatorId], frequencyAt60)),
        9,
      );
      expect(modulatorNodes.levelGain.gain.value).toBeCloseTo(
        outputLevelToModulationDepthHz(
          operators[modulationEdge.from].outputLevel,
          operatorFrequencyHz(operators[modulationEdge.from], frequencyAt60),
        ),
        9,
      );

      // D-04 retrigger to a different pitch (no algorithm/level/feedback
      // change) — the depth must move with the new note, exercising
      // scheduleRetrigger()'s recompute path specifically.
      service.noteOn(72, 100);
      const frequencyAt72 = midiNoteToFrequency(72);
      const expectedFeedbackDepthAt72 = feedbackLevelToDepthHz(
        feedbackLevel,
        operatorFrequencyHz(operators[feedbackOperatorId], frequencyAt72),
      );
      const expectedModulationDepthAt72 = outputLevelToModulationDepthHz(
        operators[modulationEdge.from].outputLevel,
        operatorFrequencyHz(operators[modulationEdge.from], frequencyAt72),
      );
      expect(feedbackNodes.feedbackGain.gain.value).toBeCloseTo(expectedFeedbackDepthAt72, 9);
      expect(modulatorNodes.levelGain.gain.value).toBeCloseTo(expectedModulationDepthAt72, 9);

      // An octave up doubles a 'ratio'-mode operator's frequency — proving
      // the depth actually moved, not coincidentally landed on the same value.
      expect(expectedFeedbackDepthAt72).toBeGreaterThan(0);
      expect(feedbackNodes.feedbackGain.gain.value).not.toBeCloseTo(
        feedbackLevelToDepthHz(feedbackLevel, operatorFrequencyHz(operators[feedbackOperatorId], frequencyAt60)),
        9,
      );
    });
  });
});
