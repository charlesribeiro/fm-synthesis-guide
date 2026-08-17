import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import {
  DEFAULT_ENVELOPE,
  DEFAULT_OPERATOR_PARAMETERS,
  type Dx7Envelope,
  type OperatorParameters,
} from '../models/operator-parameters';
import type { InstrumentPatch, OperatorParameterSet } from '../models/patch';
import type { LessonDefinition, LessonId } from './lesson-definition';

/**
 * Algorithm 1's modulator envelope (Phase 9, ENGINE-03, D-01 — this plan):
 * the concrete expression of the per-operator envelope capability the phase
 * adds. Every operator the canonical `ALGORITHMS` dataset derives as a
 * modulator for Algorithm 1 gets this envelope instead of the shared
 * default; the two carriers keep `DEFAULT_ENVELOPE` unchanged. Rates
 * `[80, 16, 16, 55]` attack slightly faster than the default's `74`, then
 * decay through a middle level (`70`) to a third-segment level (`40`) well
 * under half the attack peak (`99`), before the same zero release target.
 * Decay rates of `16` take the 99→40 drop roughly one second under the
 * geometric rate curve (rate 60 would finish it in tens of milliseconds).
 * A held note in the lesson therefore opens at full modulation brightness
 * and audibly mellows over roughly a second as the modulators fall toward
 * their lower sustain, then releases cleanly — timbral evolution over the
 * life of one note, not only a difference between patches. Frozen at every
 * level, mirroring `DEFAULT_ENVELOPE`.
 */
const ALGORITHM_1_MODULATOR_ENVELOPE: Dx7Envelope = Object.freeze({
  rates: Object.freeze([80, 16, 16, 55] as const),
  levels: Object.freeze([99, 70, 40, 0] as const),
});

/**
 * Algorithm 32's lesson starting patch: all six operators independent
 * carriers (no inter-operator modulation exists under Algorithm 32), each
 * given a distinct integer ratio (1 through 6, all members of
 * `COARSE_RATIOS`) so all six partials are audibly distinguishable rather
 * than six identical unison copies, every `outputLevel` left at the default
 * 50, and `feedback` set to 0 so operator 6's self-loop contributes nothing
 * — the point of the lesson is six clean, independent partials summed
 * together.
 *
 * Built as its own new object by spreading `DEFAULT_OPERATOR_PARAMETERS`
 * per operator, never by mutating `DEFAULT_PATCH`/`DEFAULT_OPERATOR_
 * PARAMETERS` (both frozen precisely so no consumer can corrupt the shared
 * reset target — `patch.ts` T-03-01). Frozen at every level, mirroring
 * `patch.ts`'s `DEFAULT_PATCH`.
 *
 * Every operator keeps the shared `DEFAULT_ENVELOPE` (Phase 9, ENGINE-03):
 * Algorithm 32 has no modulation edges at all, so there is no carrier-
 * versus-modulator pair for a differentiated envelope to contrast — a
 * uniform sustained envelope is the correct expression of this lesson's
 * "six clean, independent partials" point, not an oversight left over from
 * before per-operator envelopes existed.
 */
function buildAlgorithm32StartingPatch(): InstrumentPatch {
  const operatorEntries = OPERATOR_IDS.map((operatorId) => {
    const parameters: OperatorParameters = Object.freeze({
      ...DEFAULT_OPERATOR_PARAMETERS,
      ratio: operatorId,
    });
    return [operatorId, parameters] as const;
  });
  const operators = Object.freeze(Object.fromEntries(operatorEntries)) as OperatorParameterSet;

  return Object.freeze({
    algorithmId: 32,
    operators,
    feedback: 0,
  });
}

/**
 * Algorithm 1's lesson starting patch: every operator's `ratio` left at 1 so
 * the audible timbre difference the lesson teaches comes from routing depth
 * rather than from detuned partials. Both carriers (operators 1 and 3, per
 * `deriveCarriers`) get an audible `outputLevel` of 75; the modulator
 * feeding the short pair (operator 2, edge `2→1`) gets 60; the three
 * operators of the deeper chain (operators 4, 5 and 6, edges
 * `6→5, 5→4, 4→3`) get descending output levels of 55, 50 and 45 from the
 * one nearest output to the one furthest from it, so the chain is bright
 * without being harsh. `feedback` is 3 — mid-scale on the 0..7 depth scale,
 * non-zero so the topmost operator's self-loop (`6→6`) is actually audible.
 * Every role and the feedback operator (6, per `getFeedbackOperator`) is
 * read from Algorithm 1's own edge list in `algorithms.ts`, never restated
 * as a bare assumption here.
 *
 * Built as its own new object by spreading `DEFAULT_OPERATOR_PARAMETERS`
 * per operator, never by mutating `DEFAULT_PATCH`/`DEFAULT_OPERATOR_
 * PARAMETERS` (T-03-01). Frozen at every level, mirroring
 * `buildAlgorithm32StartingPatch`.
 *
 * Every operator the canonical dataset derives as a carrier (1 and 3) keeps
 * the shared `DEFAULT_ENVELOPE`: a fast attack straight to maximum, held
 * there, then the default release. Every operator it derives as a modulator
 * (2, 4, 5 and 6) gets `ALGORITHM_1_MODULATOR_ENVELOPE` instead — this
 * plan's (Phase 9, ENGINE-03) concrete expression of the per-operator
 * envelope capability D-01 adds: a held note opens at full modulation
 * brightness and mellows as the modulators decay toward a lower sustain
 * while the carriers hold steady, the same chain-depth brightness this
 * lesson's explanation already describes, now audible over the life of one
 * note rather than only across patches. The carrier set is read from
 * `deriveCarriers` over the canonical `ALGORITHMS` dataset — never restated
 * as a hardcoded operator-id list — so the envelope assignment and the
 * dataset's own routing facts cannot disagree.
 */
function buildAlgorithm1StartingPatch(): InstrumentPatch {
  const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
  const carriers = deriveCarriers(algorithm1);

  const outputLevels: Readonly<Record<OperatorId, number>> = Object.freeze({
    1: 75, // carrier — short pair (2→1)
    2: 60, // modulator feeding the short pair
    3: 75, // carrier — deeper chain (6→5→4→3)
    4: 55, // deeper chain, nearest output
    5: 50, // deeper chain, middle
    6: 45, // deeper chain, topmost — carries the feedback self-loop
  });
  const operatorEntries = OPERATOR_IDS.map((operatorId) => {
    const parameters: OperatorParameters = Object.freeze({
      ...DEFAULT_OPERATOR_PARAMETERS,
      ratio: 1,
      outputLevel: outputLevels[operatorId],
      envelope: carriers.includes(operatorId) ? DEFAULT_ENVELOPE : ALGORITHM_1_MODULATOR_ENVELOPE,
    });
    return [operatorId, parameters] as const;
  });
  const operators = Object.freeze(Object.fromEntries(operatorEntries)) as OperatorParameterSet;

  return Object.freeze({
    algorithmId: 1,
    operators,
    feedback: 3,
  });
}

/**
 * The canonical lesson dataset (D-01), one row per member of `LESSON_IDS`
 * in curriculum order: Algorithm 32's row (`06-01-PLAN.md` Task 1), then
 * Algorithm 1's row (this plan, `06-02-PLAN.md` Task 1).
 */
export const LESSONS: readonly LessonDefinition[] = Object.freeze([
  Object.freeze({
    id: 'algorithm-32' as LessonId,
    algorithmId: 32,
    title: 'Pure additive synthesis',
    objective:
      "Hear six independent operators sum into one tone, then prove it by removing one of them.",
    explanation: Object.freeze([
      'Every operator in Algorithm 32 sends its output straight to the final mix — none of them ' +
        'feeds its output into another operator’s frequency. An operator only becomes a ' +
        'modulator when another operator reads its signal as a frequency input; here, nothing does.',
      'Because every operator behaves this way, all six sound at once as their own separate, ' +
        'unmodulated tone. The instrument simply adds those six tones together — the sound you ' +
        'hear is their sum, nothing more.',
      'That is what "additive" means: build a tone out of separate parts stacked on top of each ' +
        'other, rather than have one part reshape another’s waveform the way FM modulation does. ' +
        'Algorithm 32 is the simplest possible case — no modulation at all, just six voices added ' +
        'together.',
    ]),
    startingPatch: buildAlgorithm32StartingPatch(),
    tryThis: Object.freeze({
      targetOperator: 3,
      targetParam: 'outputLevel',
      direction: 'decrease',
      instruction: "Pull operator 3's output level down.",
      expectedEffect:
        'The third partial thins out of the tone while every other operator keeps sounding — ' +
        'removing one component of an additive sum changes the whole, without touching the rest.',
    }),
  }),
  Object.freeze({
    id: 'algorithm-1' as LessonId,
    algorithmId: 1,
    title: 'A stack and a tower',
    objective:
      "Hear two independent voices produced by one algorithm, then prove they're truly " +
      "independent by changing one voice's tone and confirming the other doesn't move.",
    explanation: Object.freeze([
      'Algorithm 1 reaches the final output through two separate paths, not one. One path is a ' +
        'short pair: a single operator shapes the frequency of the operator right next to it, and ' +
        'that second operator reaches the output directly. The other path is a deeper chain: ' +
        'several operators stacked so each one shapes the next before the last one in the chain ' +
        'reaches output, and the operator sitting at the very top of that chain also feeds part of ' +
        'its own output back into itself.',
      'Because the two paths never cross, changing something inside the deeper chain leaves the ' +
        'short pair’s voice completely untouched — they are independent voices summed together, ' +
        'not one signal reshaping the other.',
      'A longer chain of modulation produces a brighter, more complex timbre than a pair does at ' +
        'the same output levels, because every extra operator in the chain layers another round of ' +
        'frequency modulation on top of the ones before it — the sidebands compound rather than ' +
        'simply add, so a deep chain sounds richer and more metallic than the same levels reaching ' +
        'output after only one hop.',
    ]),
    startingPatch: buildAlgorithm1StartingPatch(),
    tryThis: Object.freeze({
      targetOperator: 5,
      targetParam: 'ratio',
      direction: 'increase',
      instruction: "Raise operator 5's frequency ratio.",
      expectedEffect:
        'The tower voice grows brighter and more metallic while the pair voice stays exactly ' +
        'where it was — proof the two paths are independent.',
    }),
  }),
]);

/** O(1) lookup, mirroring `instrument-state.ts`'s `ALGORITHMS_BY_ID`. */
export const LESSONS_BY_ID: ReadonlyMap<LessonId, LessonDefinition> = new Map(
  LESSONS.map((lesson) => [lesson.id, lesson]),
);

/**
 * Resolves a `LessonId` to its `LessonDefinition`, mirroring
 * `instrument-state.ts`'s `resolveAlgorithm` posture: throws a `RangeError`
 * naming the id when the dataset has no matching row (rather than silently
 * returning `undefined`) — every `LessonId` now has a matching `LESSONS`
 * row, so this only fires for a future `LessonId` union member added ahead
 * of its data row, a programmer error to call this with directly.
 * Untrusted route input is validated by `isLessonId` *before* it ever
 * becomes a `LessonId` in the first place.
 */
export function getLesson(id: LessonId): LessonDefinition {
  const lesson = LESSONS_BY_ID.get(id);
  if (!lesson) {
    throw new RangeError(`lessonId ${id} is not a known lesson`);
  }
  return lesson;
}
