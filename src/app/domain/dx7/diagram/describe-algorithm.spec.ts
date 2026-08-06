import { ALGORITHMS } from '../models/algorithms';
import { getFeedbackOperator } from '../models/derive-role';
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { buildDiagramDescription, buildDiagramTitle } from './describe-algorithm';

const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
const algorithm7 = ALGORITHMS.find((algorithm) => algorithm.id === 7)!;
const algorithm32 = ALGORITHMS.find((algorithm) => algorithm.id === 32)!;

describe('buildDiagramTitle', () => {
  it('returns "Algorithm {id} routing diagram"', () => {
    expect(buildDiagramTitle(algorithm7)).toBe('Algorithm 7 routing diagram');
  });
});

describe('buildDiagramDescription', () => {
  it('D-12: enumerates every one of Algorithm 1s four modulation edges individually, not a count', () => {
    const description = buildDiagramDescription(algorithm1);
    expect(description).toContain('operator 6 modulates operator 5');
    expect(description).toContain('operator 5 modulates operator 4');
    expect(description).toContain('operator 4 modulates operator 3');
    expect(description).toContain('operator 2 modulates operator 1');
  });

  it('names both of Algorithm 1s carriers and states its feedback operator', () => {
    const description = buildDiagramDescription(algorithm1);
    expect(description).toContain('operator 1');
    expect(description).toContain('operator 3');
    expect(description).toContain('Feedback: operator 6 modulates itself.');
  });

  it('states Algorithm 32 has no operator modulating another and all six feed the output, while still reporting its feedback operator', () => {
    const description = buildDiagramDescription(algorithm32);
    expect(description).toContain(
      'No operator modulates another; all six operators feed the output directly.',
    );
    expect(description).toContain('Feedback: operator 6 modulates itself.');
  });

  it('produces "Feedback: none." with no modulates-itself clause when an algorithm declares no feedback edge', () => {
    const withoutFeedback = ALGORITHMS.find((algorithm) => getFeedbackOperator(algorithm) === null);
    const fixture: AlgorithmDefinition =
      withoutFeedback ??
      ({
        id: 1,
        name: 'No-feedback fixture',
        edges: [{ from: 2, to: 1 }],
        teachingTags: ['additive-stacks'],
      } as AlgorithmDefinition);

    const description = buildDiagramDescription(fixture);

    expect(description).toContain('Feedback: none.');
    expect(description).not.toContain('modulates itself');
  });

  it('appends the historical-review routing note only for the row flagged reviewStatus "unresolved"', () => {
    const unresolved = ALGORITHMS.find((algorithm) => algorithm.reviewStatus === 'unresolved');
    expect(unresolved).toBeDefined();
    const description = buildDiagramDescription(unresolved!);
    expect(description).toContain(
      "Routing note: this algorithm's edge list is flagged for historical review and may not match the original hardware.",
    );
  });

  it('does not append the historical-review routing note for a row without reviewStatus "unresolved"', () => {
    const resolved = ALGORITHMS.find((algorithm) => algorithm.reviewStatus !== 'unresolved');
    expect(resolved).toBeDefined();
    const description = buildDiagramDescription(resolved!);
    expect(description).not.toContain('Routing note:');
  });
});
