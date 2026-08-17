import { envelopeRateToLevelUnitsPerSample, outputLevelToAmplitude } from '../audio/value-conversion';
import {
  DEFAULT_ENVELOPE,
  MAX_ENVELOPE_LEVEL,
  MAX_ENVELOPE_RATE,
  MIN_ENVELOPE_LEVEL,
  MIN_ENVELOPE_RATE,
  type Dx7Envelope,
} from '../models/operator-parameters';
import { EnvelopeGenerator } from './envelope-generator';
import { RENDER_QUANTUM_FRAMES } from './operator';

const SAMPLE_RATE = 44100;

/** The largest possible single-sample amplitude delta for a given
 * level-per-sample `step`. `outputLevelToAmplitude` is a convex
 * (squared-normalized) curve, so a fixed level step produces its largest
 * amplitude delta when the level is already near {@link MAX_ENVELOPE_LEVEL}
 * — evaluating there gives an upper bound that holds regardless of where
 * `currentLevel` actually sits when the step occurs. */
function maxAmplitudeStepBound(step: number): number {
  return outputLevelToAmplitude(MAX_ENVELOPE_LEVEL) - outputLevelToAmplitude(Math.max(MIN_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL - step));
}

/**
 * Assertion-style conventions for this file (stated once, per Task 2's
 * instruction): sample counts derived from the exported rate-curve function
 * use exact integer equality, since the constant-step model gives a
 * closed-form count; amplitude values written into the output buffer use
 * `toBeCloseTo` at six decimal places, matching `operator.spec.ts`'s
 * float32/float64 precision precedent.
 */

describe('EnvelopeGenerator', () => {
  it('a freshly constructed, never-gated generator writes all-zero amplitude across multiple rendered blocks', () => {
    const generator = new EnvelopeGenerator(SAMPLE_RATE, DEFAULT_ENVELOPE);
    const output = new Float32Array(RENDER_QUANTUM_FRAMES);

    for (let block = 0; block < 5; block++) {
      generator.render(output);
      for (const sample of output) {
        expect(sample).toBe(0);
      }
    }
  });

  it('after gateOn(), rises from zero and advances through all three held segments to the sustain plateau, then holds there while gated', () => {
    const envelope: Dx7Envelope = {
      rates: [99, 99, 99, 50],
      levels: [20, 60, 95, 0],
    };
    const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
    generator.gateOn();

    const output = new Float32Array(RENDER_QUANTUM_FRAMES);
    let sawRise = false;
    let previous = 0;
    // Several blocks — enough for even the slowest segment in this fixture
    // to reach its target — well before the sustain plateau assertion below.
    for (let block = 0; block < 10; block++) {
      generator.render(output);
      for (const sample of output) {
        if (sample > previous) {
          sawRise = true;
        }
        previous = sample;
      }
    }
    expect(sawRise).toBe(true);

    // Sustains at the third segment's target for further blocks, with no drift.
    const sustainAmplitude = outputLevelToAmplitude(95);
    for (let block = 0; block < 5; block++) {
      generator.render(output);
      for (const sample of output) {
        expect(sample).toBeCloseTo(sustainAmplitude, 6);
      }
    }
  });

  it('settles at the third segment target without stalling when the first three levels are identical (zero-distance settle)', () => {
    const level = 90;
    const rate = 80;
    const envelope: Dx7Envelope = {
      rates: [rate, rate, rate, 40],
      levels: [level, level, level, 0],
    };
    const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
    generator.gateOn();

    const step = envelopeRateToLevelUnitsPerSample(rate, SAMPLE_RATE);
    const samplesToTarget = Math.ceil(level / step);
    const targetAmplitude = outputLevelToAmplitude(level);

    const scratch = new Float32Array(samplesToTarget + 10);
    generator.render(scratch);

    // Reaches the target at exactly the closed-form sample count...
    expect(scratch[samplesToTarget - 1]).toBeCloseTo(targetAmplitude, 6);
    // ...and holds there for every subsequent sample in this same render
    // call, settling immediately rather than costing one further rendered
    // sample per zero-distance segment.
    for (let i = samplesToTarget; i < scratch.length; i++) {
      expect(scratch[i]).toBeCloseTo(targetAmplitude, 6);
    }
  });

  it('after gateOff() mid-attack, the very next rendered sample differs from the previous one by no more than one segment step — no jump to a fixed starting value', () => {
    const envelope: Dx7Envelope = {
      rates: [10, 10, 10, MAX_ENVELOPE_RATE],
      levels: [99, 99, 99, 0],
    };
    const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
    generator.gateOn();

    const attackStep = envelopeRateToLevelUnitsPerSample(10, SAMPLE_RATE);
    const releaseStep = envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE);
    const maxStepAmplitudeDelta = maxAmplitudeStepBound(Math.max(attackStep, releaseStep));

    // Render partway into the attack, then release mid-segment.
    const attackPortion = new Float32Array(50);
    generator.render(attackPortion);
    const lastAttackSample = attackPortion[attackPortion.length - 1]!;

    generator.gateOff();
    const afterRelease = new Float32Array(1);
    generator.render(afterRelease);

    expect(Math.abs(afterRelease[0]! - lastAttackSample)).toBeLessThanOrEqual(maxStepAmplitudeDelta);
  });
});

/**
 * Task 2 (09-01-PLAN.md): the exhaustive envelope state-machine invariant
 * suite — segment-advance timing, mid-segment continuity, rate-curve
 * boundaries, and the per-sample (not per-block) advance guarantee. Task 1's
 * implementation already satisfied every case below with zero production
 * changes required; see 09-01-SUMMARY.md's "TDD Gate Compliance" section for
 * the break-then-restore regression probe substituted for a classic
 * pre-implementation RED phase, per this task's own instruction.
 */
describe('EnvelopeGenerator state-machine invariants (Task 2)', () => {
  describe('segment-advance timing', () => {
    it.each([
      { rate: MIN_ENVELOPE_RATE, distance: 30 },
      { rate: 50, distance: 60 },
      { rate: MAX_ENVELOPE_RATE, distance: 10 },
    ])(
      'reaches its target at the exact closed-form sample count for rate=$rate, distance=$distance (checked once per sample, not once per block)',
      ({ rate, distance }) => {
        const envelope: Dx7Envelope = {
          rates: [rate, rate, rate, MAX_ENVELOPE_RATE],
          levels: [distance, distance, distance, MIN_ENVELOPE_LEVEL],
        };
        const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
        generator.gateOn();

        const step = envelopeRateToLevelUnitsPerSample(rate, SAMPLE_RATE);
        const samplesToTarget = Math.ceil(distance / step);
        const targetAmplitude = outputLevelToAmplitude(distance);

        // Driven through a single render() call over the whole span, so the
        // per-sample-not-per-block guarantee is asserted directly.
        const output = new Float32Array(samplesToTarget + 5);
        generator.render(output);

        if (samplesToTarget > 1) {
          expect(output[samplesToTarget - 2]).toBeLessThan(targetAmplitude);
        }
        expect(output[samplesToTarget - 1]).toBeCloseTo(targetAmplitude, 6);
      },
    );

    it('a segment fast enough to complete inside a single render block advances the segment index within that same block, not at the next block boundary', () => {
      const fastRate = MAX_ENVELOPE_RATE;
      const firstTarget = 10;
      const envelope: Dx7Envelope = {
        rates: [fastRate, fastRate, fastRate, fastRate],
        levels: [firstTarget, 90, 90, MIN_ENVELOPE_LEVEL],
      };
      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();

      const step = envelopeRateToLevelUnitsPerSample(fastRate, SAMPLE_RATE);
      const samplesToFirstTarget = Math.ceil(firstTarget / step);
      // Sanity: this segment really does complete inside one render quantum.
      expect(samplesToFirstTarget).toBeLessThan(RENDER_QUANTUM_FRAMES);

      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      generator.render(output);

      // The level kept moving past segment 0's target and toward segment 1's
      // (90) within this same render() call — proof the segment index
      // advanced mid-block, since a per-block check would have held the
      // stale segment-0 target for the rest of this quantum.
      const firstTargetAmplitude = outputLevelToAmplitude(firstTarget);
      expect(output[RENDER_QUANTUM_FRAMES - 1]).toBeGreaterThan(firstTargetAmplitude);
    });
  });

  describe('mid-segment continuity (D-04)', () => {
    it('gating off mid-attack and gating on again mid-release leaves the rendered amplitude stream free of any jump larger than a single segment step', () => {
      // Rate 70, a 500-sample attack window, and a 100-sample release window
      // are chosen so each phase leaves currentLevel meaningfully far from
      // both 0 and its segment's target at the next gate transition. A short
      // attack would still sit below the non-zero release target, so release
      // would finish (and mute) inside the 100-sample window — hiding a
      // mid-segment jump. Verified by the break-then-restore probe recorded
      // in 09-01-SUMMARY.md.
      const attackRate = 70;
      const releaseRate = 70;
      const releaseTarget = 20; // non-zero, so the release phase also has real distance to travel
      const envelope: Dx7Envelope = {
        rates: [attackRate, attackRate, attackRate, releaseRate],
        levels: [90, 90, 90, releaseTarget],
      };
      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();

      const attackStep = envelopeRateToLevelUnitsPerSample(attackRate, SAMPLE_RATE);
      const releaseStep = envelopeRateToLevelUnitsPerSample(releaseRate, SAMPLE_RATE);
      const maxAmplitudeStep = maxAmplitudeStepBound(Math.max(attackStep, releaseStep));

      const stream: number[] = [];
      const collect = (count: number): void => {
        const block = new Float32Array(count);
        generator.render(block);
        for (const sample of block) {
          stream.push(sample);
        }
      };

      collect(500); // well into the attack and clearly above releaseTarget, still short of 90
      generator.gateOff();
      collect(100); // partway into the release, well short of releaseTarget
      generator.gateOn();
      collect(100); // partway back into the (restarted) attack

      for (let i = 1; i < stream.length; i++) {
        expect(Math.abs(stream[i]! - stream[i - 1]!)).toBeLessThanOrEqual(maxAmplitudeStep);
      }
    });
  });

  describe('rate-curve boundary behaviour', () => {
    it('rate 99 reaches a target in strictly fewer samples than rate 50, which reaches it in strictly fewer samples than rate 0; rate 0 still completes in a finite sample count', () => {
      const distance = 50;
      const samplesFor = (rate: number): number => {
        const step = envelopeRateToLevelUnitsPerSample(rate, SAMPLE_RATE);
        return Math.ceil(distance / step);
      };

      const samplesAtMinRate = samplesFor(MIN_ENVELOPE_RATE);
      const samplesAtMidRate = samplesFor(50);
      const samplesAtMaxRate = samplesFor(MAX_ENVELOPE_RATE);

      expect(Number.isFinite(samplesAtMinRate)).toBe(true);
      expect(samplesAtMaxRate).toBeLessThan(samplesAtMidRate);
      expect(samplesAtMidRate).toBeLessThan(samplesAtMinRate);
    });

    it.each([
      { rate: MIN_ENVELOPE_RATE - 1, label: 'one step below MIN_ENVELOPE_RATE (out of range)' },
      { rate: MIN_ENVELOPE_RATE, label: 'MIN_ENVELOPE_RATE' },
      { rate: MIN_ENVELOPE_RATE + 1, label: 'one step above MIN_ENVELOPE_RATE' },
      { rate: MAX_ENVELOPE_RATE - 1, label: 'one step below MAX_ENVELOPE_RATE' },
      { rate: MAX_ENVELOPE_RATE, label: 'MAX_ENVELOPE_RATE' },
      { rate: MAX_ENVELOPE_RATE + 1, label: 'one step above MAX_ENVELOPE_RATE (out of range)' },
    ])('rate $label produces only finite, non-NaN amplitude output', ({ rate }) => {
      const envelope: Dx7Envelope = {
        rates: [rate, rate, rate, rate],
        levels: [MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MIN_ENVELOPE_LEVEL],
      };
      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();

      const output = new Float32Array(256);
      generator.render(output);

      for (const sample of output) {
        expect(Number.isFinite(sample)).toBe(true);
        expect(Number.isNaN(sample)).toBe(false);
      }
    });

    it.each([
      { level: MIN_ENVELOPE_LEVEL - 1, label: 'one step below MIN_ENVELOPE_LEVEL (out of range)' },
      { level: MIN_ENVELOPE_LEVEL, label: 'MIN_ENVELOPE_LEVEL' },
      { level: MIN_ENVELOPE_LEVEL + 1, label: 'one step above MIN_ENVELOPE_LEVEL' },
      { level: MAX_ENVELOPE_LEVEL - 1, label: 'one step below MAX_ENVELOPE_LEVEL' },
      { level: MAX_ENVELOPE_LEVEL, label: 'MAX_ENVELOPE_LEVEL' },
      { level: MAX_ENVELOPE_LEVEL + 1, label: 'one step above MAX_ENVELOPE_LEVEL (out of range)' },
    ])('level $label produces only finite, non-NaN amplitude output', ({ level }) => {
      const envelope: Dx7Envelope = {
        rates: [50, 50, 50, 50],
        levels: [level, level, level, MIN_ENVELOPE_LEVEL],
      };
      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();

      const output = new Float32Array(256);
      generator.render(output);

      for (const sample of output) {
        expect(Number.isFinite(sample)).toBe(true);
        expect(Number.isNaN(sample)).toBe(false);
      }
    });

    it('a non-finite rate resolves to the same slowest in-range speed as MIN_ENVELOPE_RATE, rather than stalling or emitting a non-finite step', () => {
      const nonFiniteStep = envelopeRateToLevelUnitsPerSample(Number.NaN, SAMPLE_RATE);
      const slowestStep = envelopeRateToLevelUnitsPerSample(MIN_ENVELOPE_RATE, SAMPLE_RATE);

      expect(nonFiniteStep).toBe(slowestStep);
      expect(Number.isFinite(nonFiniteStep)).toBe(true);
      expect(nonFiniteStep).toBeGreaterThan(0);
    });
  });

  describe('long-hold precision backstop', () => {
    it('a note held for a very large number of blocks sustains at exactly the third segment target amplitude, with no drift', () => {
      const sustainLevel = 77;
      const envelope: Dx7Envelope = {
        rates: [MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, 20],
        levels: [sustainLevel, sustainLevel, sustainLevel, MIN_ENVELOPE_LEVEL],
      };
      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();

      // Float32Array storage means the sustained value is float32-rounded —
      // fround the expectation so the exact-equality assertion below compares
      // like for like, rather than a float64 value against its own rounding.
      const sustainAmplitude = Math.fround(outputLevelToAmplitude(sustainLevel));
      const output = new Float32Array(RENDER_QUANTUM_FRAMES);
      const manyBlocks = 20_000; // several minutes of audio at 44.1kHz/128-sample blocks
      for (let block = 0; block < manyBlocks; block++) {
        generator.render(output);
      }

      // Exactness, not closeness: the clamp-at-target rule is what makes
      // exactness the correct assertion here — a per-sample accumulation
      // that drifted away from the modeled state machine would fail this.
      for (const sample of output) {
        expect(sample).toBe(sustainAmplitude);
      }
    });

    it('an envelope whose release target is zero renders exactly zero amplitude for every sample once the release segment has completed', () => {
      const envelope: Dx7Envelope = {
        rates: [MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE],
        levels: [MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MIN_ENVELOPE_LEVEL],
      };
      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();
      const warmUp = new Float32Array(RENDER_QUANTUM_FRAMES);
      generator.render(warmUp); // reaches the sustain plateau

      generator.gateOff();
      const releaseStep = envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE);
      const samplesToRelease = Math.ceil(MAX_ENVELOPE_LEVEL / releaseStep);
      const output = new Float32Array(samplesToRelease + 10);
      generator.render(output);

      for (let i = samplesToRelease; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }
    });

    it('a non-zero release target is silent with no note held, and stays silent once release finishes', () => {
      const releaseTarget = 40;
      const envelope: Dx7Envelope = {
        rates: [MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE, MAX_ENVELOPE_RATE],
        levels: [MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, MAX_ENVELOPE_LEVEL, releaseTarget],
      };

      const idle = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      const idleOutput = new Float32Array(RENDER_QUANTUM_FRAMES);
      idle.render(idleOutput);
      for (const sample of idleOutput) {
        expect(sample).toBe(0);
      }

      const generator = new EnvelopeGenerator(SAMPLE_RATE, envelope);
      generator.gateOn();
      const warmUp = new Float32Array(RENDER_QUANTUM_FRAMES);
      generator.render(warmUp);
      generator.gateOff();

      const releaseStep = envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE);
      const samplesToRelease = Math.ceil((MAX_ENVELOPE_LEVEL - releaseTarget) / releaseStep);
      const output = new Float32Array(samplesToRelease + 10);
      generator.render(output);
      for (let i = samplesToRelease; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }

      generator.gateOn();
      const retrigger = new Float32Array(1);
      generator.render(retrigger);
      const firstAttackStep = envelopeRateToLevelUnitsPerSample(MAX_ENVELOPE_RATE, SAMPLE_RATE);
      expect(retrigger[0]).toBeCloseTo(outputLevelToAmplitude(firstAttackStep), 6);
    });
  });
});
