import { DEFAULT_OPERATOR_PARAMETERS } from '../models/operator-parameters';
import { OPERATOR_IDS, isOperatorId } from '../models/operator';
import { DEFAULT_PATCH } from '../models/patch';
import {
  PERSISTENCE_SCHEMA_VERSION,
  defaultSavedDocument,
} from './saved-document';
import { parseSavedDocument } from './parse-saved-document';

function validRawDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...(JSON.parse(JSON.stringify(defaultSavedDocument())) as Record<string, unknown>),
    ...overrides,
  };
}

describe('parseSavedDocument', () => {
  const rejectedPayloads: readonly { readonly name: string; readonly payload: unknown }[] = [
    { name: 'a non-object (null)', payload: null },
    { name: 'a non-object (number)', payload: 1 },
    { name: 'a non-object (string)', payload: 'F0 43 00 00 01' },
    { name: 'an array root', payload: [] },
    {
      name: 'a missing schemaVersion',
      payload: (() => {
        const raw = validRawDocument();
        delete raw['schemaVersion'];
        return raw;
      })(),
    },
    { name: 'schemaVersion: 2', payload: validRawDocument({ schemaVersion: 2 }) },
    {
      name: 'a seventh operator key alongside the six legal ones',
      payload: (() => {
        const raw = validRawDocument();
        const playgroundPatch = raw['playgroundPatch'] as Record<string, unknown>;
        const operators = playgroundPatch['operators'] as Record<string, unknown>;
        playgroundPatch['operators'] = { ...operators, 7: DEFAULT_OPERATOR_PARAMETERS };
        return raw;
      })(),
    },
    {
      name: 'a Dexed-shaped object with no schema version',
      payload: { format: 'dexed', bank: 0, voices: [{ name: 'INIT VOICE' }] },
    },
    {
      name: 'a __proto__-only object that is not a valid document',
      payload: JSON.parse('{"__proto__": {"polluted": true}}'),
    },
    { name: 'lastMidiDeviceId as a number', payload: validRawDocument({ lastMidiDeviceId: 12 }) },
    { name: 'lastMidiDeviceId as an object', payload: validRawDocument({ lastMidiDeviceId: { id: 'x' } }) },
  ];

  it.each(rejectedPayloads)('returns null and throws nothing for $name', ({ payload }) => {
    expect(() => parseSavedDocument(payload)).not.toThrow();
    expect(parseSavedDocument(payload)).toBeNull();
  });

  it('returns null and throws nothing for a payload whose schemaVersion getter throws', () => {
    const hostilePayload = {
      get schemaVersion(): number {
        throw new Error('hostile getter');
      },
    };

    expect(() => parseSavedDocument(hostilePayload)).not.toThrow();
    expect(parseSavedDocument(hostilePayload)).toBeNull();
  });

  it('succeeds for a valid schema-version-1 document that also carries an unknown extra key, and omits that key from the result', () => {
    const parsed = parseSavedDocument(validRawDocument({ extraKey: 'ignore me' }));

    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed!).sort()).toEqual([
      'completedLessonIds',
      'lastMidiDeviceId',
      'playgroundPatch',
      'schemaVersion',
    ]);
    expect('extraKey' in parsed!).toBe(false);
  });

  it('round-trips JSON.parse(JSON.stringify(defaultSavedDocument())) with numeric operator keys and schema version 1', () => {
    const parsed = parseSavedDocument(JSON.parse(JSON.stringify(defaultSavedDocument())));

    expect(parsed).not.toBeNull();
    expect(parsed!.schemaVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(parsed!.schemaVersion).toBe(1);
    expect(parsed!.playgroundPatch.algorithmId).toBe(DEFAULT_PATCH.algorithmId);
    expect(parsed!.completedLessonIds).toEqual([]);
    expect(parsed!.lastMidiDeviceId).toBeNull();
    expect(Object.keys(parsed!.playgroundPatch.operators)).toHaveLength(OPERATOR_IDS.length);
    for (const id of OPERATOR_IDS) {
      expect(isOperatorId(id)).toBe(true);
      expect(parsed!.playgroundPatch.operators[id]).toEqual(DEFAULT_PATCH.operators[id]);
    }
  });

  it('drops unknown slugs inside completedLessonIds and keeps remaining isLessonId strings', () => {
    const parsed = parseSavedDocument(
      validRawDocument({ completedLessonIds: ['algorithm-32', 'not-a-real-lesson', 'algorithm-1'] }),
    );

    expect(parsed).not.toBeNull();
    expect(parsed!.completedLessonIds).toEqual(['algorithm-32', 'algorithm-1']);
  });

  it('coerces lastMidiDeviceId of empty string to null without rejecting the document', () => {
    const parsed = parseSavedDocument(validRawDocument({ lastMidiDeviceId: '' }));

    expect(parsed).not.toBeNull();
    expect(parsed!.lastMidiDeviceId).toBeNull();
  });
});
