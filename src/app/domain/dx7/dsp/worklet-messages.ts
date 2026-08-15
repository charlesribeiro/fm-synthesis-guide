/**
 * The one shared worklet message contract (Phase 7, ENGINE-01; threat
 * `T-07-01` from `07-RESEARCH.md`; widened for Phase 8/ENGINE-02's routed
 * mode, threat `T-08-01`) between the main thread, the
 * `AudioWorkletProcessor` adapter (`worklets/dx7-worklet-processor.ts`),
 * and (in a later plan) the dev harness — so none of the three can drift.
 * Zero Angular imports, enforced by the domain-purity ESLint gate
 * (DOMAIN-04).
 *
 * `parseWorkletMessage` is this phase's single security choke point: it is
 * the only thing standing between an arbitrary structured-clone payload
 * crossing the main-thread → `AudioWorkletGlobalScope` realm boundary and
 * the phase-accumulator kernel state. It narrows `unknown` using runtime
 * checks only (no type assertion that skips a check), rejects every
 * malformed shape by returning `null`, and never throws — including for a
 * payload whose own property getter throws — matching
 * `docs/ACCEPTANCE_CRITERIA.md`'s "reject non-finite output" floor. This
 * stays the single choke point for the three Phase 8 message kinds too — no
 * second validator appears anywhere in the processor.
 */
import type { OperatorConnection } from '../audio/patch-plan';
import { OPERATOR_IDS, isOperatorId, type OperatorId } from '../models/operator';
import {
  MAX_DETUNE,
  MAX_ENVELOPE_LEVEL,
  MAX_OUTPUT_LEVEL,
  MIN_DETUNE,
  MIN_ENVELOPE_LEVEL,
  MIN_OUTPUT_LEVEL,
  isCoarseRatio,
} from '../models/operator-parameters';
import { MAX_FEEDBACK_LEVEL, MIN_FEEDBACK_LEVEL, type OperatorParameterSet } from '../models/patch';

/** The one processor name this project registers and constructs by. */
export const DX7_OPERATOR_PROCESSOR_NAME = 'dx7-operator';

/** Mirrors the `OperatorId`/`OPERATOR_IDS` restricted-union convention in
 * `src/app/domain/dx7/models/operator.ts`. `'routed'` is Phase 8's addition
 * — a persistent `GraphRouter` rendering the currently configured
 * algorithm, alongside the pre-existing single-operator and additive
 * fixture modes (both stay so Phase 7's proof cases keep working). */
export const WORKLET_RENDER_MODES = ['single', 'additive', 'routed'] as const;
export type WorkletRenderMode = (typeof WORKLET_RENDER_MODES)[number];

function isWorkletRenderMode(value: unknown): value is WorkletRenderMode {
  return typeof value === 'string' && (WORKLET_RENDER_MODES as readonly string[]).includes(value);
}

/** An audible-range guard on the operator frequency a `setFrequency`
 * message may carry — not a Nyquist claim. */
export const MAX_OPERATOR_FREQUENCY_HZ = 20000;

export interface SetFrequencyMessage {
  readonly kind: 'setFrequency';
  readonly frequencyHz: number;
}

export interface SetModeMessage {
  readonly kind: 'setMode';
  readonly mode: WorkletRenderMode;
}

/** Carries one algorithm's already-translated routing shape — `connections`
 * and `carriers` are `buildRoutingConfig(algorithm)`'s own `RoutingConfig`
 * fields, never re-derived on the render thread (D-14). */
export interface SetAlgorithmMessage {
  readonly kind: 'setAlgorithm';
  readonly connections: readonly OperatorConnection[];
  readonly carriers: readonly OperatorId[];
}

/** Carries the whole six-operator parameter set in one message — an
 * algorithm change and a slider drag have different cadences and are never
 * combined into the same payload (`worklet-synth-engine.ts` posts this
 * separately from {@link SetAlgorithmMessage} and {@link SetFeedbackMessage}). */
export interface SetOperatorParametersMessage {
  readonly kind: 'setOperatorParameters';
  readonly operators: OperatorParameterSet;
}

/** Carries the instrument-level feedback depth (0..7, `patch.ts`'s scale) —
 * *which* operator it applies to is resolved on the render thread from the
 * routing config's own feedback flag, never carried here. */
export interface SetFeedbackMessage {
  readonly kind: 'setFeedback';
  readonly level: number;
}

export type WorkletMessage =
  | SetFrequencyMessage
  | SetModeMessage
  | SetAlgorithmMessage
  | SetOperatorParametersMessage
  | SetFeedbackMessage;

export function setFrequencyMessage(frequencyHz: number): SetFrequencyMessage {
  return { kind: 'setFrequency', frequencyHz };
}

export function setModeMessage(mode: WorkletRenderMode): SetModeMessage {
  return { kind: 'setMode', mode };
}

export function setAlgorithmMessage(
  connections: readonly OperatorConnection[],
  carriers: readonly OperatorId[],
): SetAlgorithmMessage {
  return { kind: 'setAlgorithm', connections, carriers };
}

export function setOperatorParametersMessage(operators: OperatorParameterSet): SetOperatorParametersMessage {
  return { kind: 'setOperatorParameters', operators };
}

export function setFeedbackMessage(level: number): SetFeedbackMessage {
  return { kind: 'setFeedback', level };
}

export function isValidFrequencyHz(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_OPERATOR_FREQUENCY_HZ;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOperatorIdValue(value: unknown): value is OperatorId {
  return typeof value === 'number' && isOperatorId(value);
}

function isOperatorConnectionLike(value: unknown): value is OperatorConnection {
  if (!isPlainObject(value)) {
    return false;
  }
  const isFeedback = value['isFeedback'];
  return isOperatorIdValue(value['from']) && isOperatorIdValue(value['to']) && typeof isFeedback === 'boolean';
}

/**
 * Structural invariants GraphRouter.render() depends on: non-feedback edges
 * must have `from > to` (higher modulates lower in the single descending
 * pass), and `isFeedback` must be true iff the edge is a self-loop.
 */
function isStructurallyValidConnection(connection: OperatorConnection): boolean {
  return connection.isFeedback ? connection.from === connection.to : connection.from > connection.to;
}

function isRoutingConnectionsArray(value: unknown): value is readonly OperatorConnection[] {
  if (!Array.isArray(value) || !value.every(isOperatorConnectionLike)) {
    return false;
  }
  return value.every(isStructurallyValidConnection);
}

function isCarrierIdArray(value: unknown): value is readonly OperatorId[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isOperatorIdValue)) {
    return false;
  }
  return new Set(value).size === value.length;
}

/** Validates one operator's parameters entry against the same bounds
 * `validateOperatorParameters` (`operator-parameters.ts`) enforces on the
 * main thread — the bound constants and guards are imported rather than
 * re-declared as numeric literals, so the two can never drift apart. */
function isValidOperatorParametersEntry(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  const enabled = value['enabled'];
  const mode = value['mode'];
  const fixedFrequencyHz = value['fixedFrequencyHz'];
  const ratio = value['ratio'];
  const detune = value['detune'];
  const outputLevel = value['outputLevel'];
  const envelopeLevel = value['envelopeLevel'];

  return (
    typeof enabled === 'boolean' &&
    (mode === 'ratio' || mode === 'fixed') &&
    typeof fixedFrequencyHz === 'number' &&
    Number.isFinite(fixedFrequencyHz) &&
    fixedFrequencyHz > 0 &&
    typeof ratio === 'number' &&
    isCoarseRatio(ratio) &&
    typeof detune === 'number' &&
    Number.isInteger(detune) &&
    detune >= MIN_DETUNE &&
    detune <= MAX_DETUNE &&
    typeof outputLevel === 'number' &&
    Number.isInteger(outputLevel) &&
    outputLevel >= MIN_OUTPUT_LEVEL &&
    outputLevel <= MAX_OUTPUT_LEVEL &&
    typeof envelopeLevel === 'number' &&
    Number.isInteger(envelopeLevel) &&
    envelopeLevel >= MIN_ENVELOPE_LEVEL &&
    envelopeLevel <= MAX_ENVELOPE_LEVEL
  );
}

/** Requires exactly the six operator ids — no fewer (a missing id) and no
 * more (a stray/typo'd extra key silently ignored downstream) — closed as
 * part of Task 1's hostile-payload matrix (T-08-01): an object with a
 * seventh, out-of-range key alongside all six valid entries previously
 * passed this guard because `OPERATOR_IDS.every(...)` only checked the keys
 * it expected, never the keys actually present. */
function isOperatorParameterSetLike(value: unknown): value is OperatorParameterSet {
  if (!isPlainObject(value)) {
    return false;
  }
  if (Object.keys(value).length !== OPERATOR_IDS.length) {
    return false;
  }
  return OPERATOR_IDS.every((id) => isValidOperatorParametersEntry(value[String(id)]));
}

function isValidFeedbackLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_FEEDBACK_LEVEL &&
    value <= MAX_FEEDBACK_LEVEL
  );
}

/**
 * Narrows an arbitrary `port.onmessage` payload to a {@link WorkletMessage},
 * or returns `null` for anything malformed. Never throws — the whole body
 * is wrapped in a `try`/`catch` so even a payload with a throwing property
 * getter cannot escape as an exception into the render thread's message
 * handler (T-07-01).
 */
export function parseWorkletMessage(data: unknown): WorkletMessage | null {
  try {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null;
    }

    const kind = (data as { kind?: unknown }).kind;

    if (kind === 'setFrequency') {
      const frequencyHz = (data as { frequencyHz?: unknown }).frequencyHz;
      return isValidFrequencyHz(frequencyHz) ? setFrequencyMessage(frequencyHz) : null;
    }

    if (kind === 'setMode') {
      const mode = (data as { mode?: unknown }).mode;
      return isWorkletRenderMode(mode) ? setModeMessage(mode) : null;
    }

    if (kind === 'setAlgorithm') {
      const connections = (data as { connections?: unknown }).connections;
      const carriers = (data as { carriers?: unknown }).carriers;
      return isRoutingConnectionsArray(connections) && isCarrierIdArray(carriers)
        ? setAlgorithmMessage(connections, carriers)
        : null;
    }

    if (kind === 'setOperatorParameters') {
      const operators = (data as { operators?: unknown }).operators;
      return isOperatorParameterSetLike(operators) ? setOperatorParametersMessage(operators) : null;
    }

    if (kind === 'setFeedback') {
      const level = (data as { level?: unknown }).level;
      return isValidFeedbackLevel(level) ? setFeedbackMessage(level) : null;
    }

    return null;
  } catch {
    return null;
  }
}
