import type { AlgorithmId } from '../models/algorithm';
import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers } from '../models/derive-role';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import { DEFAULT_ENVELOPE, DEFAULT_OPERATOR_PARAMETERS, type OperatorParameters } from '../models/operator-parameters';
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import type { InstrumentPatch, OperatorParameterSet } from '../models/patch';
import type { LessonDefinition, LessonId } from './lesson-definition';
import { SHARED_MODULATOR_ENVELOPE, buildStructuralStartingPatch } from './structural-lesson-patch';
import { buildStructuralTryThis } from './try-this-selection';

/**
 * Looks up an algorithm by id in the canonical `ALGORITHMS` dataset, raising
 * a `RangeError` naming the id when absent — replaces the non-null assertion
 * `buildAlgorithm1StartingPatch` used to carry directly.
 */
function requireAlgorithm(id: AlgorithmId): AlgorithmDefinition {
  const algorithm = ALGORITHMS.find((entry) => entry.id === id);
  if (!algorithm) {
    throw new RangeError(`requireAlgorithm: no ALGORITHMS row with id ${id}`);
  }
  return algorithm;
}

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
 * (2, 4, 5 and 6) gets `SHARED_MODULATOR_ENVELOPE` instead (Phase 11,
 * promoted from this file's former module-local
 * `ALGORITHM_1_MODULATOR_ENVELOPE` — identical rates and levels, so this
 * patch is byte-for-byte unchanged; see `structural-lesson-patch.ts`) — the
 * concrete expression of the per-operator envelope capability Phase 9's D-01
 * added: a held note opens at full modulation brightness and mellows as the
 * modulators decay toward a lower sustain while the carriers hold steady,
 * the same chain-depth brightness this lesson's explanation already
 * describes, now audible over the life of one note rather than only across
 * patches. The carrier set is read from `deriveCarriers` over the canonical
 * `ALGORITHMS` dataset — never restated as a hardcoded operator-id list — so
 * the envelope assignment and the dataset's own routing facts cannot
 * disagree.
 */
function buildAlgorithm1StartingPatch(): InstrumentPatch {
  const algorithm1 = requireAlgorithm(1);
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
      envelope: carriers.includes(operatorId) ? DEFAULT_ENVELOPE : SHARED_MODULATOR_ENVELOPE,
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
 * Row factory for every lesson built through the shared structural machinery
 * (`structural-lesson-patch.ts`/`try-this-selection.ts`) — every lesson
 * except Algorithm 32's and Algorithm 1's own hand-authored rows (D-04
 * scopes the shared builder to the thirty remaining algorithms). Resolves
 * the algorithm with `requireAlgorithm`, builds `startingPatch` with
 * `buildStructuralStartingPatch` and `tryThis` with `buildStructuralTryThis`,
 * freezes the explanation array and the row, and raises a `RangeError` when
 * `id` is not the string `algorithm-` followed by `algorithmId` — so a row's
 * slug and its algorithm can never disagree.
 */
function structuralLesson(
  id: LessonId,
  algorithmId: AlgorithmId,
  title: string,
  objective: string,
  explanation: readonly string[],
  instruction: string,
  expectedEffect: string,
): LessonDefinition {
  const expectedId = `algorithm-${algorithmId}`;
  if (id !== expectedId) {
    throw new RangeError(
      `structuralLesson: id "${id}" does not match algorithmId ${algorithmId} (expected "${expectedId}")`,
    );
  }
  const algorithm = requireAlgorithm(algorithmId);
  const startingPatch = buildStructuralStartingPatch(algorithm);
  const tryThis = buildStructuralTryThis(algorithm, instruction, expectedEffect);

  return Object.freeze({
    id,
    algorithmId,
    title,
    objective,
    explanation: Object.freeze([...explanation]),
    startingPatch,
    tryThis,
  });
}

/**
 * The canonical lesson dataset (D-01), one row per member of `LESSON_IDS`
 * in curriculum order: Algorithm 32's row (`06-01-PLAN.md` Task 1), the six
 * structurally-generated Parallel-group rows 26 through 31 (Phase 11,
 * `11-01-PLAN.md`), Algorithm 1's row (`06-02-PLAN.md` Task 1), the five
 * remaining structurally-generated Additive Stacks rows 2 through 6, the
 * first six structurally-generated Tree/Branch rows 7 through 12
 * (Phase 11, `11-03-PLAN.md` Tasks 1 and 2), the remaining six
 * structurally-generated Tree/Branch rows 13 through 18, and all seven
 * structurally-generated Rooting rows 19 through 25 (Phase 11,
 * `11-04-PLAN.md` Tasks 1 and 2) — completing all thirty-two algorithms.
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
  structuralLesson(
    'algorithm-26' as LessonId,
    26,
    'Two modulators converging on one carrier',
    "Hear two modulators converge on a single carrier while a third feeds a separate voice, " +
      "then prove it by raising the feedback modulator's ratio and hearing only the shared voice brighten.",
    [
      'Algorithm 26 sends two modulators, operators 6 and 5, into the same carrier: operator 4. ' +
        'A third modulator, operator 3, feeds a different carrier, operator 2, along a separate ' +
        'one-hop path. Operator 1 receives no modulation at all — it reaches the output as a ' +
        'bare, unmodulated partial. Operator 6 also feeds part of its own output back into itself.',
      'Because two independent modulators land on operator 4, that voice carries a denser, more ' +
        'complex spectrum than operator 2’s single-modulator voice or operator 1’s untouched ' +
        'partial. The three voices never cross paths, so changing anything about the convergence ' +
        'on operator 4 leaves operator 2’s voice and operator 1’s bare tone completely alone.',
      'The feedback loop sits on operator 6 — one of the two modulators converging on operator 4, ' +
        'not on the lone modulator feeding operator 2. Raising operator 6’s ratio widens the ' +
        'sidebands only on the voice it shares with operator 5, while the other two voices hold ' +
        'perfectly still.',
    ],
    "Raise operator 6's frequency ratio.",
    "Operator 4's voice — fed by both operator 6 and operator 5 — grows brighter and more " +
      "complex, while operator 2's separate voice and operator 1's bare tone stay exactly where " +
      'they were.',
  ),
  structuralLesson(
    'algorithm-27' as LessonId,
    27,
    'Same convergence, feedback moved',
    'Hear the same two-modulator convergence as Algorithm 26, then prove the feedback loop ' +
      "moved by raising operator 3's ratio and hearing only the simpler voice brighten.",
    [
      'Algorithm 27 routes exactly the same way Algorithm 26 does: operators 6 and 5 both feed ' +
        'operator 4, operator 3 feeds operator 2 along a separate path, and operator 1 reaches ' +
        'the output completely unmodulated. Only one fact differs between the two algorithms — ' +
        'where the feedback loop sits.',
      'Here the loop lands on operator 3, the single modulator feeding operator 2, rather than ' +
        'on one of the two operators converging into operator 4. That relocation moves feedback ' +
        'off the denser voice and onto the simpler one.',
      "Because feedback now shapes only operator 2's one-modulator voice, raising operator 3's " +
        'ratio changes that voice alone — the two-modulator convergence into operator 4 and ' +
        "operator 1's bare partial hold still, proving the loop's new position by exactly what " +
        "it does and doesn't touch.",
    ],
    "Raise operator 3's frequency ratio.",
    "Operator 2's voice — the one fed by operator 3 alone — grows brighter, while the " +
      "two-modulator convergence into operator 4 and operator 1's bare tone stay exactly where " +
      'they were.',
  ),
  structuralLesson(
    'algorithm-28' as LessonId,
    28,
    'A chain, a pair, and a spare partial',
    "Hear Algorithm 1's chain-and-pair shape plus one extra independent partial, then prove it " +
      "by raising the chain's own ratio and hearing the spare partial hold still.",
    [
      'Algorithm 28 reaches output through three paths: a three-operator chain (operators 5, 4 ' +
        'and 3) ending at carrier 3, a short pair (operator 2 into carrier 1), and a completely ' +
        'unmodulated carrier, operator 6, that reaches the output entirely on its own. The ' +
        "chain's top operator, 5, also feeds part of its own output back into itself.",
      'This is the same chain-and-pair shape Algorithm 1 uses, with one difference: a third, ' +
        'fully independent voice. Because operator 6 has no incoming or outgoing modulation ' +
        'edges at all, nothing that happens inside the chain or the pair can ever touch it.',
      "Raising the chain's own top operator's ratio deepens and brightens the chain's voice — " +
        "the same brightening Algorithm 1's lesson demonstrates — while the pair's voice and " +
        "operator 6's bare partial stay exactly where they were, proving all three paths are " +
        'independent.',
    ],
    "Raise operator 5's frequency ratio.",
    "The three-operator chain's voice grows brighter and more metallic, while the short pair " +
      "and the bare partial on operator 6 don't move.",
  ),
  structuralLesson(
    'algorithm-29' as LessonId,
    29,
    'Two pairs and two bare partials',
    'Hear two independent two-operator pairs plus two untouched partials sum together, then ' +
      "prove it by pulling operator 1's output level down and hearing only that partial thin out.",
    [
      'Algorithm 29 has four independent paths to output: one pair (operator 6 into carrier 5, ' +
        'carrying the feedback loop), a second pair (operator 4 into carrier 3), and two ' +
        'completely unmodulated carriers, operators 1 and 2, each of which reaches output ' +
        'entirely on its own.',
      'None of the four paths ever touches another — changing the feedback pair, the plain ' +
        "pair, or either bare partial leaves the other three exactly as they were, the same " +
        'independent-partials-summing structure Algorithm 32 teaches, just with two of the six ' +
        'partials paired off by FM instead of left bare.',
      "Because every partial in this algorithm is independent, pulling operator 1's own output " +
        'level down removes only that one partial from the sum — the two pairs and operator ' +
        "2's bare partial keep sounding at full strength, proving the sum really is built from " +
        'separate, addable parts.',
    ],
    "Pull operator 1's output level down.",
    "Operator 1's bare partial thins out of the mix while both FM pairs and operator 2's " +
      'partial keep sounding at full strength.',
  ),
  structuralLesson(
    'algorithm-30' as LessonId,
    30,
    'Three bare partials and one two-deep chain',
    'Hear three untouched partials alongside one genuine two-operator-deep chain, then prove ' +
      "the chain is real by raising its top operator's ratio.",
    [
      'Algorithm 30 reaches output through four paths: a two-hop chain (operator 5 into ' +
        'operator 4 into carrier 3, with the feedback loop on operator 5, the chain’s top), and ' +
        'three completely unmodulated carriers — operators 1, 2 and 6 — each landing on the ' +
        'output with no modulation at all.',
      "Three of the algorithm's six operators are bare partials, which makes this look close to " +
        "Algorithm 32's pure-additive shape at first listen. But the remaining three operators " +
        'are a genuine two-deep chain, not a shallow one-hop pair — operator 5 shapes operator ' +
        "4's frequency, and operator 4 in turn shapes carrier 3's — so this algorithm still has " +
        "real routing depth Algorithm 32 doesn't.",
      "Raising operator 5's ratio — the chain's own top, two hops from output — brightens " +
        'carrier 3’s voice with the compounding sidebands a two-deep chain produces, while the ' +
        'three bare partials on operators 1, 2 and 6 stay exactly where they were.',
    ],
    "Raise operator 5's frequency ratio.",
    'Carrier 3’s voice grows brighter and more complex from the two-hop chain, while the three ' +
      "bare partials on operators 1, 2 and 6 don't move.",
  ),
  structuralLesson(
    'algorithm-31' as LessonId,
    31,
    'One step from pure additive',
    'Hear four bare partials plus one FM pair sit right at the edge of pure additive synthesis, ' +
      "then prove it by pulling operator 1's output level down.",
    [
      'Algorithm 31 has only one modulation edge in the entire algorithm: operator 6 feeds ' +
        'operator 5, and that pair also carries the feedback loop. Every other operator — 1, 2, ' +
        '3 and 4 — is a completely unmodulated carrier, reaching output on its own.',
      "That is five of the algorithm's six operators behaving exactly as they do in Algorithm " +
        "32's pure-additive lesson, with only one FM pair standing between this algorithm and " +
        "true additive synthesis — the dataset's own description of Algorithm 31 calls this " +
        '"approaching pure additive." Because every operator’s ratio is distinct here too, each ' +
        'of the six partials is audibly its own pitch, the same independent-partials character ' +
        'Algorithm 32 teaches.',
      "Pulling operator 1's output level down removes one bare partial from the sum, exactly as " +
        "it does in Algorithm 32's own lesson — the FM pair and the remaining three bare " +
        "partials keep sounding, proving this algorithm's near-additive character the same way.",
    ],
    "Pull operator 1's output level down.",
    'One partial thins out of the mix while the FM pair and the remaining bare partials keep ' +
      "sounding — this algorithm sits one step from Algorithm 32's pure-additive sum.",
  ),
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
  structuralLesson(
    'algorithm-2' as LessonId,
    2,
    "Algorithm 1's shape, feedback moved to the pair",
    "Hear Algorithm 1's exact chain-and-pair routing with the feedback loop relocated from the " +
      "chain's top to the pair's modulator, then prove it by raising operator 2's ratio and " +
      "hearing only the pair's voice change.",
    [
      'Algorithm 2 routes exactly like Algorithm 1: a short pair, operator 2 into carrier 1, and ' +
        'a deeper four-operator chain, 6 into 5 into 4 into carrier 3. Only one fact differs — ' +
        "where the feedback self-loop sits. Here it sits on operator 2, the pair's own modulator, " +
        "instead of operator 6 at the chain's top.",
      'The two paths still never cross, so the independence Algorithm 1 already demonstrated ' +
        "still holds. What changes is which voice the feedback loop colors: it now shapes the " +
        "pair's simpler, shallower voice rather than the chain's deeper one.",
      "Raising operator 2's ratio widens the sidebands only on the pair's voice — the one now " +
        'carrying the feedback loop — while the four-operator chain holds exactly where it was, ' +
        'proving the loop really did move.',
    ],
    "Raise operator 2's frequency ratio.",
    "The short pair's voice grows brighter and buzzier from its own feedback loop, while the " +
      'four-operator chain stays exactly where it was.',
  ),
  structuralLesson(
    'algorithm-3' as LessonId,
    3,
    'Two matched three-operator chains',
    'Hear two equally deep three-operator chains reach output side by side, then prove it by ' +
      "raising operator 6's ratio and hearing only one chain brighten.",
    [
      'Algorithm 3 reaches output through two chains of matched depth: operators 6 and 5 feed ' +
        'carrier 4, and operators 3 and 2 feed carrier 1. Unlike Algorithm 1, there is no short ' +
        "pair here — both paths are the same three-operator length. The first chain's top " +
        'operator, 6, also feeds part of its own output back into itself.',
      'Because both chains sit at the same depth, neither dominates the timbre the way Algorithm ' +
        "1's deeper chain outweighs its short pair. The two paths still never cross — changing " +
        "one chain leaves the other's voice completely untouched.",
      "Raising operator 6's ratio — the feedback-carrying top of the first chain — brightens " +
        "only carrier 4's voice, while carrier 1's voice, reached through the second chain, " +
        'holds perfectly still.',
    ],
    "Raise operator 6's frequency ratio.",
    "Carrier 4's voice grows brighter and more complex from its own three-operator chain, while " +
      "carrier 1's voice, reached through the matching second chain, doesn't move.",
  ),
  structuralLesson(
    'algorithm-4' as LessonId,
    4,
    'The same two chains again',
    'Hear the identical two-chain shape as Algorithm 3, then prove the routing really is the ' +
      "same by raising operator 6's ratio and hearing the identical result.",
    [
      "Algorithm 4 routes exactly like Algorithm 3: the same two matched three-operator chains, " +
        'the same feedback self-loop on operator 6. There is no routing difference between them ' +
        'at all — the canonical dataset itself records the two as a probable near-duplicate pair.',
      "That is worth stating plainly rather than hunting for a difference that isn't there. The " +
        "DX7's thirty-two algorithms include shapes that repeat, and recognising a shape you've " +
        'already met is itself part of what this curriculum teaches.',
      "Raising operator 6's ratio here produces the exact same brightening on carrier 4's voice " +
        "that it does in Algorithm 3 — the same experiment, the same result, because it's the " +
        'same routing wearing a different algorithm number.',
    ],
    "Raise operator 6's frequency ratio.",
    "Carrier 4's voice brightens exactly as it does in Algorithm 3, while carrier 1's voice " +
      "doesn't move — proof this really is the same routing.",
  ),
  structuralLesson(
    'algorithm-5' as LessonId,
    5,
    'Three independent pairs',
    'Hear three separate two-operator pairs sum together, then prove it by raising operator 6’s ' +
      "ratio and hearing only its own pair brighten.",
    [
      'Algorithm 5 has three independent two-operator pairs: 6 into carrier 5, 4 into carrier 3, ' +
        'and 2 into carrier 1. Every operator participates in modulating something or being ' +
        "modulated — unlike Algorithm 32, nothing here is a bare, untouched partial. The first " +
        "pair's modulator, operator 6, also feeds part of its own output back into itself.",
      'None of the three pairs ever touches another, so this is the shallowest possible way to ' +
        'reach three separate voices while every operator still does modulation work — a middle ' +
        "ground between Algorithm 1's deep single chain and Algorithm 32's fully bare partials.",
      "Raising operator 6's ratio brightens only the pair it belongs to, carrier 5's voice, while " +
        "the other two pairs' voices hold exactly where they were.",
    ],
    "Raise operator 6's frequency ratio.",
    "Carrier 5's voice grows brighter and buzzier from its own pair's feedback loop, while the " +
      "other two pairs' voices don't move.",
  ),
  structuralLesson(
    'algorithm-6' as LessonId,
    6,
    'The same three pairs again',
    'Hear the identical three-pair shape as Algorithm 5, then prove the routing is the same by ' +
      "raising operator 6's ratio and hearing the identical result.",
    [
      'Algorithm 6 routes exactly like Algorithm 5: the same three independent two-operator ' +
        'pairs, the same feedback self-loop on operator 6. The canonical dataset records this as ' +
        'another duplicate pair — there is no routing distinction to find here.',
      'As with Algorithm 4 and Algorithm 3, the honest lesson is recognition rather than an ' +
        "invented difference: this exact three-pair shape has already appeared once, and it's " +
        'appearing again under a different algorithm number.',
      "Raising operator 6's ratio produces the same brightening on carrier 5's voice that it " +
        'does in Algorithm 5 — identical routing, identical result.',
    ],
    "Raise operator 6's frequency ratio.",
    "Carrier 5's voice brightens exactly as it does in Algorithm 5, while the other two pairs' " +
      "voices don't move — proof this really is the same routing.",
  ),
  structuralLesson(
    'algorithm-7' as LessonId,
    7,
    'The deepest chain, plus one untouched partial',
    "Hear the instrument's deepest four-hop chain sit beside one completely bare partial, then " +
      "prove it by raising operator 6's ratio and hearing only the chain deepen.",
    [
      'Algorithm 7 reaches output through a five-operator chain — 6 into 5 into 4 into 2 into ' +
        'carrier 1 — the deepest single chain anywhere in the instrument, four modulation hops ' +
        "stacked before the signal reaches output. Alongside it sits carrier 3, which receives no " +
        'incoming modulation at all. The feedback self-loop sits on operator 6, the chain’s top.',
      'Because carrier 3 has no incoming edge, nothing that happens inside the four-hop chain can ' +
        'ever reach it — this algorithm holds the maximum possible modulation depth and zero ' +
        'modulation depth in the very same patch, with nothing in between.',
      "Raising operator 6's ratio compounds sidebands through all four hops on its way to carrier " +
        "1, producing the most complex single-chain timbre the instrument can make, while carrier " +
        "3's bare tone doesn't move at all. The chain's descending output levels come from that " +
        'hop depth alone, not from any per-operator choice.',
    ],
    "Raise operator 6's frequency ratio.",
    "Carrier 1's voice grows dramatically brighter and more complex from the four-hop chain, " +
      "while carrier 3's untouched partial stays exactly where it was.",
  ),
  structuralLesson(
    'algorithm-8' as LessonId,
    8,
    'Two modulators converging on one carrier',
    "Hear two modulators reach the same carrier by two different routes, then prove it by " +
      "raising operator 4's ratio and hearing only the shared voice thicken.",
    [
      'Algorithm 8 sends two separate routes into carrier 3: operator 4 feeds it directly in a ' +
        'single hop, while operator 6 reaches it by a two-hop chain through operator 5. A ' +
        'separate pair, operator 2 into carrier 1, reaches output along its own untouched path. ' +
        'The feedback self-loop sits on operator 4 — the direct route, not the two-hop chain’s top.',
      "Because feedback landed on the direct route rather than on operator 6 at the top of the " +
        "longer route, the loop colors carrier 3's voice without needing the deeper 6-into-5 half " +
        "of the convergence to be involved at all; the separate pair stays untouched by any of it.",
      "Raising operator 4's ratio — also the feedback operator — widens carrier 3's spectrum from " +
        "the direct side while the 6-into-5 route and the separate pair hold exactly still.",
    ],
    "Raise operator 4's frequency ratio.",
    "Carrier 3's voice — fed by both routes — grows thicker and buzzier from its own feedback " +
      "loop, while the separate pair's voice on carrier 1 stays exactly where it was.",
  ),
  structuralLesson(
    'algorithm-9' as LessonId,
    9,
    'Same convergence, feedback on the separate pair',
    'Hear the identical two-route convergence as Algorithm 8, then prove the feedback loop moved ' +
      "by raising operator 2's ratio and hearing only the separate pair brighten.",
    [
      'Algorithm 9 routes exactly like Algorithm 8: operator 4 feeds carrier 3 directly, operator ' +
        '6 reaches the same carrier by a two-hop chain through operator 5, and a separate pair, ' +
        "operator 2 into carrier 1, sits apart from all of it. Only the feedback loop's position " +
        "differs — here it sits on operator 2, the separate pair's modulator, not on operator 4.",
      "Relocating feedback off the convergence entirely means the loop no longer touches carrier " +
        "3's voice at all — it now shapes only the smaller, separate voice on carrier 1 instead.",
      "Raising operator 2's ratio brightens only the separate pair's voice; the two-route " +
        "convergence into carrier 3 doesn't move — same routing as Algorithm 8, a different " +
        'demonstration of what feedback placement changes.',
    ],
    "Raise operator 2's frequency ratio.",
    "The separate pair's voice on carrier 1 grows brighter and buzzier, while the two-route " +
      "convergence into carrier 3 stays exactly where it was.",
  ),
  structuralLesson(
    'algorithm-10' as LessonId,
    10,
    'The matched chains, feedback on the other side',
    'Hear the same two-chain shape as Algorithms 3, 4 and 11, then prove the feedback loop sits ' +
      "on the other chain's top by raising operator 3's ratio and hearing only that chain change.",
    [
      'Algorithm 10 reaches output through two matched three-operator chains: 6 into 5 into ' +
        'carrier 4, and 3 into 2 into carrier 1 — the same shape Algorithms 3, 4 and 11 all use. ' +
        "The one difference: here the feedback self-loop sits on operator 3, the second chain's " +
        'top, rather than on operator 6.',
      "That relocation is the only thing separating this algorithm from that three-way-identical " +
        'cluster — both chains remain equally deep and independent of each other either way.',
      "Raising operator 3's ratio brightens the second chain's voice on carrier 1, while the " +
        "first chain's voice on carrier 4 holds exactly still — the mirror image of what raising " +
        "operator 6's ratio does in Algorithms 3, 4 and 11.",
    ],
    "Raise operator 3's frequency ratio.",
    "Carrier 1's voice grows brighter from its own chain's feedback loop, while carrier 4's " +
      "voice, reached through the matching first chain, doesn't move.",
  ),
  structuralLesson(
    'algorithm-11' as LessonId,
    11,
    'A third match for the same two chains',
    'Hear the identical two-chain shape as Algorithms 3 and 4 for a third time, then prove the ' +
      "routing is the same by raising operator 6's ratio and hearing the identical result.",
    [
      'Algorithm 11 routes exactly like Algorithms 3 and 4: two matched three-operator chains, 6 ' +
        'into 5 into carrier 4 and 3 into 2 into carrier 1, with the feedback self-loop on ' +
        'operator 6. The dataset itself records all three as topologically identical.',
      "This is the same shape appearing a third time under a third algorithm number — the " +
        "recognition this curriculum keeps asking for, not a search for a difference that isn't " +
        'there.',
      "Raising operator 6's ratio brightens carrier 4's voice exactly as it does in Algorithms 3 " +
        'and 4 — the same experiment, the same result, for the third time.',
    ],
    "Raise operator 6's frequency ratio.",
    "Carrier 4's voice brightens exactly as it does in Algorithms 3 and 4, while carrier 1's " +
      "voice doesn't move — proof this really is the same routing, a third time.",
  ),
  structuralLesson(
    'algorithm-12' as LessonId,
    12,
    "Algorithm 2's shape, reappearing",
    "Hear the identical stack-and-tower shape from Algorithm 2 show up again here, then prove it " +
      "by raising operator 2's frequency ratio and hearing the identical result.",
    [
      'Algorithm 12 routes exactly like Algorithm 2: a short pair, operator 2 into carrier 1, and ' +
        'a deeper four-operator chain, 6 into 5 into 4 into carrier 3, with the feedback ' +
        "self-loop on operator 2, the pair's own modulator. The dataset records the two as " +
        'topologically identical.',
      'This same shape first appeared in the Additive Stacks group; here it reappears inside the ' +
        "Tree and Branch group — a reminder that this curriculum's four groups describe recurring " +
        "structure, not a guarantee that every algorithm's exact routing is unique to its group.",
      "Raising operator 2's ratio brightens the short pair's voice exactly as it does in " +
        'Algorithm 2, while the four-operator chain holds exactly still.',
    ],
    "Raise operator 2's frequency ratio.",
    "The short pair's voice grows brighter and buzzier from its own feedback loop, exactly as " +
      "in Algorithm 2, while the four-operator chain doesn't move.",
  ),
  structuralLesson(
    'algorithm-13' as LessonId,
    13,
    "Algorithm 1's shape, a group away",
    "Hear the exact routing that opened this curriculum reappear in a different group, then " +
      "prove it by raising operator 6's frequency ratio and hearing the chain deepen.",
    [
      'Algorithm 13 routes exactly like Algorithm 1: a short pair, operator 2 into carrier 1, ' +
        'and a deeper four-operator chain, 6 into 5 into 4 into carrier 3, with the feedback ' +
        "self-loop on operator 6, the chain's own top. Every edge and the feedback operator " +
        "match Algorithm 1's row exactly.",
      'That is worth noting plainly: this is the curriculum’s opening shape showing up again, ' +
        'now inside the Tree and Branch group rather than Additive Stacks. The four-group ' +
        'taxonomy describes recurring structure, not a promise that every routing pattern ' +
        'belongs to only one group.',
      "Raising operator 6's ratio compounds sidebands through the whole four-operator chain on " +
        "its way to carrier 3, brightening that voice exactly the way it does in Algorithm 1, " +
        "while the short pair's voice on carrier 1 holds perfectly still.",
    ],
    "Raise operator 6's frequency ratio.",
    "The four-operator chain's voice grows brighter and more metallic, exactly as it does in " +
      "Algorithm 1, while the short pair's voice on carrier 1 doesn't move.",
  ),
  structuralLesson(
    'algorithm-14' as LessonId,
    14,
    'The same shape, a third time',
    "Hear the identical stack-and-tower routing show up for a third time, then prove it's " +
      "unchanged by raising operator 6's frequency ratio and hearing the same chain brighten.",
    [
      'Algorithm 14 routes exactly like Algorithm 1 and Algorithm 13: the same short pair ' +
        '(operator 2 into carrier 1) and the same four-operator chain (6 into 5 into 4 into ' +
        "carrier 3), with feedback on operator 6, the chain's own top. There is no routing " +
        'difference among the three anywhere in the edge list.',
      'This is the third and final appearance of this exact shape in the curriculum — the ' +
        "point isn't to keep hunting for something new, it's recognising the pattern once it's " +
        "been seen. This algorithm's own generated preset is not identical to Algorithm 1's " +
        "hand-authored one (Algorithm 1's starting levels were tuned by hand before this " +
        "generator existed), but the two lessons' routings, and Algorithm 13's, are exactly the " +
        'same.',
      "Raising operator 6's ratio brightens the chain's voice on carrier 3 exactly as it does in " +
        'Algorithms 1 and 13, while the short pair holds still — the third demonstration of the ' +
        'same fact.',
    ],
    "Raise operator 6's frequency ratio.",
    "The four-operator chain's voice brightens exactly as it does in Algorithms 1 and 13, while " +
      "the short pair's voice on carrier 1 doesn't move.",
  ),
  structuralLesson(
    'algorithm-15' as LessonId,
    15,
    'Two modulators feeding a modulator, not a carrier',
    'Hear two modulators converge on a third operator that is itself still shaping another ' +
      "carrier, then prove it by raising operator 2's frequency ratio and hearing the whole " +
      'converged voice change.',
    [
      'Algorithm 15 sends two modulators, operators 5 and 4, into operator 2 — and operator 2 ' +
        'is not a bare carrier the way it might look at first glance. It has its own outgoing ' +
        'edge into carrier 1, so the strict routing rule (derived from the edge list, not from ' +
        'any name) makes it a modulator too. What actually reaches output as a carrier here is ' +
        'operator 1 and, completely separately, operator 3, which receives no modulation of any ' +
        'kind.',
      "That means what listeners hear on carrier 1's voice has been shaped twice: first by the " +
        'convergence of operators 5 and 4 landing on operator 2, then again by operator 2 ' +
        "modulating carrier 1 in turn. Operator 3's bare tone never touches any of it. The " +
        'feedback self-loop sits on operator 2, the shared convergence point, one hop from ' +
        'output rather than at the top of either incoming chain.',
      "Raising operator 2's ratio — also the feedback operator — widens the sidebands on the " +
        "twice-shaped voice reaching carrier 1, while operator 3's untouched partial stays " +
        'exactly where it was.',
    ],
    "Raise operator 2's frequency ratio.",
    "Carrier 1's voice — shaped twice, first by the converging modulators and then by operator " +
      "2 itself — grows denser and buzzier, while operator 3's bare partial doesn't move.",
  ),
  structuralLesson(
    'algorithm-16' as LessonId,
    16,
    'Three chains converge on one carrier',
    'Hear three separate modulation paths converge on a single carrier, then prove it by ' +
      "raising operator 6's frequency ratio and hearing the whole voice change.",
    [
      'Algorithm 16 sends three separate paths into the same single carrier, operator 1: a ' +
        'two-hop chain (operator 6 into operator 5 into carrier 1), a second two-hop chain ' +
        '(operator 4 into operator 3 into carrier 1), and a direct one-hop modulator (operator ' +
        '2 into carrier 1). Every other operator in the algorithm is a modulator — operator 1 ' +
        'is the only carrier in the entire routing.',
      "That is the opposite extreme from Algorithm 32's six independent voices: instead of six " +
        'separate, unmodulated partials summed together, every one of this algorithm’s six ' +
        'operators contributes to shaping a single output voice, with no additive summing ' +
        'anywhere in the patch. The feedback self-loop sits on operator 6, the top of the ' +
        'longest of the three paths.',
      "Raising operator 6's ratio deepens the sidebands the longest chain contributes to that " +
        'single shared voice, changing the whole output tone since there is only one voice for ' +
        'it to change.',
    ],
    "Raise operator 6's frequency ratio.",
    'The single carrier’s voice grows noticeably brighter and more complex, since every operator ' +
      'in this algorithm feeds that one voice.',
  ),
  structuralLesson(
    'algorithm-17' as LessonId,
    17,
    'Same convergence, feedback moved to the shortest path',
    'Hear the identical three-path convergence as Algorithm 16, then prove the feedback loop ' +
      "moved by raising operator 2's frequency ratio and hearing the same single voice change.",
    [
      'Algorithm 17 routes exactly like Algorithm 16: two two-hop chains and one direct ' +
        'modulator all converge on the same single carrier, operator 1. Only one fact differs ' +
        'between the two algorithms — where the feedback self-loop sits.',
      'Here the loop lands on operator 2, the shortest of the three paths — a direct, one-hop ' +
        'modulator — rather than on operator 6 at the top of the longest chain. Every operator ' +
        'still feeds the same single voice; feedback simply now shapes it through the shallowest ' +
        'possible route instead of the deepest one.',
      "Raising operator 2's ratio — now the feedback operator — changes the same single output " +
        'voice that raising operator 6 changed in Algorithm 16, proving the loop’s relocation by ' +
        'producing the identical kind of effect through a different, shorter path.',
    ],
    "Raise operator 2's frequency ratio.",
    'The single carrier’s voice grows brighter, exactly as raising operator 6 does in Algorithm ' +
      '16, now driven from the shortest of the three converging paths.',
  ),
  structuralLesson(
    'algorithm-18' as LessonId,
    18,
    'A chain and two direct modulators, one carrier',
    'Hear a three-operator chain and two direct modulators all reach the same single carrier, ' +
      "then prove the loop sits on a direct modulator by raising operator 3's frequency ratio.",
    [
      'Algorithm 18 reaches its one carrier, operator 1, through three paths: a three-operator ' +
        'chain (operator 6 into operator 5 into operator 4 into carrier 1), and two separate ' +
        'direct modulators (operator 2 and operator 3, each feeding carrier 1 in a single hop). ' +
        'As in Algorithms 16 and 17, every operator but the carrier itself is a modulator, and ' +
        'every path lands on the same single voice.',
      'The feedback self-loop sits on operator 3, one of the two direct modulators, rather than ' +
        'at the top of the three-operator chain. That places feedback on the shallowest possible ' +
        'path again, the same pattern Algorithm 17 already showed relative to Algorithm 16.',
      "Raising operator 3's ratio — the feedback operator — changes the single shared voice from " +
        'its shallow, direct route, while the deeper three-operator chain and the other direct ' +
        'modulator contribute their own parts to that same voice regardless.',
    ],
    "Raise operator 3's frequency ratio.",
    "The single carrier's voice grows brighter and buzzier from its own feedback loop, the same " +
      'convergence-onto-one-carrier pattern Algorithms 16 and 17 already demonstrated.',
  ),
  structuralLesson(
    'algorithm-19' as LessonId,
    19,
    'One modulator fanning out to three carriers',
    'Hear one modulator drive three separate carriers at once, then prove it by raising ' +
      "operator 6's frequency ratio and hearing all three move together.",
    [
      'Algorithm 19 sends operator 5 into three carriers at once — operators 2, 3 and 4 — while ' +
        'operator 6 feeds into operator 5 itself and carries the feedback self-loop. Operator 1 ' +
        'receives no modulation of any kind and reaches output as a bare, untouched partial.',
      'Because a single modulator drives three carriers simultaneously, those three voices ' +
        "always move together: nothing can change one of them without changing all three. " +
        "Operator 1's bare tone is the only voice in the algorithm no adjustment inside that " +
        'fan-out can ever touch.',
      "Raising operator 6's ratio changes the shared source that all three fed carriers rely " +
        "on, moving all three voices together, while operator 1's untouched partial stays " +
        'exactly where it was.',
    ],
    "Raise operator 6's frequency ratio.",
    'The three carriers fed by operator 5 all shift together, since they share one modulation ' +
      "source, while operator 1's bare partial doesn't move.",
  ),
  structuralLesson(
    'algorithm-20' as LessonId,
    20,
    'A chain, a pair, and a bare partial',
    'Hear a two-operator chain and a separate shallow pair reach output alongside one untouched ' +
      "partial, then prove the feedback sits on the pair by raising operator 3's frequency " +
      'ratio.',
    [
      'Algorithm 20 reaches output through three separate paths: a two-hop chain (operator 6 ' +
        'into operator 5 into carrier 4), a one-hop pair (operator 3 into carrier 2), and a ' +
        'completely unmodulated carrier, operator 1, on its own. The feedback self-loop sits on ' +
        "operator 3, the shallow pair's own modulator, rather than on operator 6 at the top of " +
        'the deeper chain.',
      "None of the three paths ever crosses another, so the pair's voice, the chain's voice, " +
        "and operator 1's bare tone can each be changed in isolation. Placing feedback on the " +
        'shallow pair rather than the deep chain means the loop shapes the simpler of the two ' +
        'modulated voices.',
      "Raising operator 3's ratio — also the feedback operator — brightens only the pair's " +
        "voice on carrier 2, while the deeper chain's voice on carrier 4 and operator 1's bare " +
        'partial hold exactly still.',
    ],
    "Raise operator 3's frequency ratio.",
    "Carrier 2's voice — the shallow pair carrying the feedback loop — grows brighter and " +
      "buzzier, while the deeper chain's voice and the bare partial on operator 1 don't move.",
  ),
  structuralLesson(
    'algorithm-21' as LessonId,
    21,
    'Two shallow pairs and two bare partials',
    'Hear two shallow FM pairs sit beside two completely bare partials, then prove every voice ' +
      "is independent by pulling operator 1's output level down.",
    [
      'Algorithm 21 has four independent voices reaching output: one pair (operator 6 into ' +
        'carrier 5, carrying the feedback loop), a second pair (operator 3 into carrier 2), and ' +
        'two completely unmodulated carriers, operators 1 and 4, each reaching output entirely ' +
        'on their own.',
      "Half of this algorithm's six operators are bare partials and the other half are two " +
        "shallow, one-hop pairs — the additive character Algorithm 32 teaches is starting to " +
        "dominate here, with only a little FM shaping layered on top of it. Every operator's " +
        'own frequency ratio is distinct, so every partial is audibly its own pitch.',
      "Because every voice is independent, pulling operator 1's own output level down removes " +
        'only that one bare partial from the sum — the two pairs and operator 4’s bare tone ' +
        'keep sounding at full strength, the same proof-by-removal Algorithm 32’s own lesson ' +
        'uses.',
    ],
    "Pull operator 1's output level down.",
    "Operator 1's bare partial thins out of the mix while both shallow pairs and operator 4's " +
      'bare partial keep sounding at full strength.',
  ),
  structuralLesson(
    'algorithm-22' as LessonId,
    22,
    'As many carriers as Algorithm 21, but none of them bare',
    'Hear four carriers that are each still individually modulated, then prove none of them is ' +
      "truly bare by raising operator 6's frequency ratio and hearing three voices move at " +
      'once.',
    [
      'Algorithm 22 has the same number of carriers as Algorithm 21 — four, operators 1, 3, 4 ' +
        'and 5 — but not one of them is bare. Operator 6 fans out directly to three of them at ' +
        'once (operators 3, 4 and 5), and a separate pair, operator 2 into carrier 1, handles ' +
        'the fourth. Every carrier here receives modulation from somewhere.',
      "That is the instructive difference from Algorithm 21's near-identical carrier count: " +
        'having many carriers does not by itself mean an algorithm is additive-like. What ' +
        'matters is whether any of them are bare, and here none are — every operator’s ratio ' +
        'stays at 1, because routing still carries this lesson rather than distinct partials ' +
        'summing.',
      "Raising operator 6's ratio — also the feedback operator — moves the three carriers it " +
        "fans into all at once, while carrier 1's separately modulated voice, fed only by " +
        'operator 2, holds still.',
    ],
    "Raise operator 6's frequency ratio.",
    "The three carriers fed directly by operator 6 all brighten together, while carrier 1's " +
      "voice, reached through the separate pair, doesn't move.",
  ),
  structuralLesson(
    'algorithm-23' as LessonId,
    23,
    'Two shallow modulators and two bare partials, rearranged',
    'Hear the same two-pairs-and-two-bare-carriers shape as Algorithm 21 built from different ' +
      "operators, then prove it by pulling operator 2's output level down.",
    [
      'Algorithm 23 has the same shape as Algorithm 21: two shallow, one-hop modulators ' +
        '(operator 6 into carrier 5, carrying the feedback loop, and operator 3 into carrier ' +
        '1) alongside two completely unmodulated carriers, operators 2 and 4. Only the specific ' +
        'operators playing each role differ between the two algorithms.',
      'As with Algorithm 21, every ratio here is distinct rather than uniformly 1, because ' +
        "this algorithm's teaching point is the same independent-partials-summing character " +
        "Algorithm 32 demonstrates, just with two of the six partials paired off by shallow FM " +
        'instead of left bare.',
      "Pulling operator 2's own output level down removes only that one bare partial from the " +
        'sum, exactly the way the same experiment works on Algorithm 21 — the two shallow pairs ' +
        "and operator 4's bare tone keep sounding at full strength.",
    ],
    "Pull operator 2's output level down.",
    "Operator 2's bare partial thins out of the mix while both shallow pairs and operator 4's " +
      'bare partial keep sounding at full strength.',
  ),
  structuralLesson(
    'algorithm-24' as LessonId,
    24,
    'The same near-additive shape as Algorithm 31',
    'Hear the same near-pure-additive shape met earlier as Algorithm 31, then prove every voice ' +
      "is independent by pulling operator 1's output level down.",
    [
      'Algorithm 24 routes exactly like Algorithm 31, met earlier in the Parallel group: five ' +
        'of six operators are carriers, four of them — operators 1, 2, 3 and 4 — completely ' +
        'bare, and the only modulation anywhere is a single pair, operator 6 into carrier 5, ' +
        'which also carries the feedback loop.',
      'This is the same shape appearing again under a different algorithm number, not a new ' +
        'structural idea — recognising it is the point. Because every ratio here is distinct ' +
        'rather than uniformly 1, all six partials are audibly their own pitch, the same ' +
        "independent-partials character Algorithm 32's opening lesson teaches.",
      "Pulling operator 1's own output level down removes one bare partial from the sum, " +
        "exactly as it does in Algorithm 31's own lesson, while the small FM pair and the " +
        'remaining bare partials keep sounding.',
    ],
    "Pull operator 1's output level down.",
    'One partial thins out of the mix while the small FM pair and the remaining bare partials ' +
      "keep sounding — the identical result Algorithm 31's own experiment produces.",
  ),
  structuralLesson(
    'algorithm-25' as LessonId,
    25,
    'The same shape a third time',
    "Hear this near-pure-additive shape for a third time, now as Algorithm 25, then prove it's " +
      "unchanged by pulling operator 1's output level down.",
    [
      'Algorithm 25 routes exactly like both Algorithm 24 and Algorithm 31 — the identical ' +
        'five-carrier, one-pair shape appearing for a third time across two different ' +
        'curriculum groups. Four operators (1, 2, 3 and 4) are completely bare, one pair ' +
        '(operator 6 into carrier 5) carries the only modulation and the feedback loop.',
      'There is no structural distinction left to find between these three algorithms; naming ' +
        'the repetition honestly is the whole lesson. Every ratio stays distinct, so all six ' +
        'partials remain audibly separate pitches, the same independent-partials character ' +
        'this shape has demonstrated twice already.',
      "Pulling operator 1's own output level down produces the identical result it does in " +
        'Algorithms 24 and 31: one partial thins out of the sum while the small FM pair and ' +
        'the remaining bare partials keep sounding.',
    ],
    "Pull operator 1's output level down.",
    'One partial thins out of the mix while the small FM pair and the remaining bare partials ' +
      'keep sounding — the same result as Algorithms 24 and 31.',
  ),
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
