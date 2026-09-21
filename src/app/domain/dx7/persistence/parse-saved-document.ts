import { isLessonId, type LessonId } from '../lessons/lesson-definition';
import { isAlgorithmId } from '../models/algorithm';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import {
  isDx7EnvelopeLike,
  validateOperatorParameters,
  type OperatorParameters,
} from '../models/operator-parameters';
import { validateFeedbackLevel, type InstrumentPatch, type OperatorParameterSet } from '../models/patch';
import { PERSISTENCE_SCHEMA_VERSION, type SavedDocument } from './saved-document';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOperatorParameters(value: unknown): OperatorParameters | null {
  if (!isPlainObject(value)) {
    return null;
  }
  try {
    validateOperatorParameters(value as Partial<OperatorParameters>);
  } catch {
    return null;
  }
  const enabled = value['enabled'];
  const mode = value['mode'];
  const ratio = value['ratio'];
  const fixedFrequencyHz = value['fixedFrequencyHz'];
  const detune = value['detune'];
  const outputLevel = value['outputLevel'];
  const envelope = value['envelope'];
  if (typeof enabled !== 'boolean') {
    return null;
  }
  if (mode !== 'ratio' && mode !== 'fixed') {
    return null;
  }
  if (typeof ratio !== 'number' || typeof fixedFrequencyHz !== 'number') {
    return null;
  }
  if (typeof detune !== 'number' || typeof outputLevel !== 'number') {
    return null;
  }
  if (!isDx7EnvelopeLike(envelope)) {
    return null;
  }
  return {
    enabled,
    mode,
    ratio,
    fixedFrequencyHz,
    detune,
    outputLevel,
    envelope,
  };
}

function parsePlaygroundPatch(value: unknown): InstrumentPatch | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const algorithmId = value['algorithmId'];
  if (typeof algorithmId !== 'number' || !isAlgorithmId(algorithmId)) {
    return null;
  }
  const operatorsRaw = value['operators'];
  if (!isPlainObject(operatorsRaw)) {
    return null;
  }
  if (Object.keys(operatorsRaw).length !== OPERATOR_IDS.length) {
    return null;
  }
  const operators = {} as Record<OperatorId, OperatorParameters>;
  for (const id of OPERATOR_IDS) {
    const entry = parseOperatorParameters(operatorsRaw[String(id)]);
    if (entry === null) {
      return null;
    }
    operators[id] = entry;
  }
  const feedback = value['feedback'];
  try {
    validateFeedbackLevel(feedback as number);
  } catch {
    return null;
  }
  return {
    algorithmId,
    operators: operators as OperatorParameterSet,
    feedback: feedback as number,
  };
}

function parseCompletedLessonIds(value: unknown): readonly LessonId[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const kept: LessonId[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && isLessonId(entry)) {
      kept.push(entry);
    }
  }
  return kept;
}

function parseLastMidiDeviceId(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value === '' ? null : value;
  }
  return undefined;
}

/**
 * Fail-closed decode for untrusted JSON (storage or import). Never throws;
 * hostile getters, prototype keys, and malformed shapes become `null`.
 */
export function parseSavedDocument(data: unknown): SavedDocument | null {
  try {
    if (!isPlainObject(data)) {
      return null;
    }
    if (data['schemaVersion'] !== PERSISTENCE_SCHEMA_VERSION) {
      return null;
    }
    const playgroundPatch = parsePlaygroundPatch(data['playgroundPatch']);
    if (playgroundPatch === null) {
      return null;
    }
    const completedLessonIds = parseCompletedLessonIds(data['completedLessonIds']);
    if (completedLessonIds === null) {
      return null;
    }
    const lastMidiDeviceId = parseLastMidiDeviceId(data['lastMidiDeviceId']);
    if (lastMidiDeviceId === undefined) {
      return null;
    }
    return {
      schemaVersion: PERSISTENCE_SCHEMA_VERSION,
      playgroundPatch,
      completedLessonIds,
      lastMidiDeviceId,
    };
  } catch {
    return null;
  }
}
