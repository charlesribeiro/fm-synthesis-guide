/**
 * The one shared worklet message contract (Phase 7, ENGINE-01; threat
 * `T-07-01` from `07-RESEARCH.md`) between the main thread, the
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
 * `docs/ACCEPTANCE_CRITERIA.md`'s "reject non-finite output" floor.
 */

/** The one processor name this project registers and constructs by. */
export const DX7_OPERATOR_PROCESSOR_NAME = 'dx7-operator';

/** Mirrors the `OperatorId`/`OPERATOR_IDS` restricted-union convention in
 * `src/app/domain/dx7/models/operator.ts`. */
export const WORKLET_RENDER_MODES = ['single', 'additive'] as const;
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

export type WorkletMessage = SetFrequencyMessage | SetModeMessage;

export function setFrequencyMessage(frequencyHz: number): SetFrequencyMessage {
  return { kind: 'setFrequency', frequencyHz };
}

export function setModeMessage(mode: WorkletRenderMode): SetModeMessage {
  return { kind: 'setMode', mode };
}

export function isValidFrequencyHz(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_OPERATOR_FREQUENCY_HZ;
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

    return null;
  } catch {
    return null;
  }
}
