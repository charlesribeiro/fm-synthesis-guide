import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers, getFeedbackOperator } from '../models/derive-role';
import type { AlgorithmDefinition } from '../models/algorithm-definition';
import { planConnections } from './patch-plan';

function findAlgorithm(id: number): AlgorithmDefinition {
  const algorithm = ALGORITHMS.find((candidate) => candidate.id === id);
  if (algorithm === undefined) {
    throw new Error(`fixture algorithm ${id} not found in ALGORITHMS`);
  }
  return algorithm;
}

describe('planConnections', () => {
  it('Algorithm 1: returns the four-deep stack, the tower edge, and the feedback self-loop, in declaration order', () => {
    const algorithm1 = findAlgorithm(1);

    expect(planConnections(algorithm1)).toEqual([
      { from: 6, to: 5, isFeedback: false },
      { from: 5, to: 4, isFeedback: false },
      { from: 4, to: 3, isFeedback: false },
      { from: 2, to: 1, isFeedback: false },
      { from: 6, to: 6, isFeedback: true },
    ]);
  });

  it('Algorithm 32: returns exactly one connection — the feedback self-loop', () => {
    const algorithm32 = findAlgorithm(32);

    expect(planConnections(algorithm32)).toEqual([{ from: 6, to: 6, isFeedback: true }]);
  });

  it('does not mutate the algorithm it was given, and returns a frozen array of frozen entries', () => {
    const algorithm1 = findAlgorithm(1);
    const edgesBefore = JSON.stringify(algorithm1.edges);

    const plan = planConnections(algorithm1);

    expect(JSON.stringify(algorithm1.edges)).toBe(edgesBefore);
    expect(Object.isFrozen(plan)).toBe(true);
    for (const connection of plan) {
      expect(Object.isFrozen(connection)).toBe(true);
    }
  });

  // The sweep below is what makes a future dataset edit fail here rather
  // than silently in the audio graph — every one of the 32 canonical rows
  // is checked, not a hand-picked subset.
  describe('cross-algorithm invariants (all 32 ALGORITHMS entries)', () => {
    for (const algorithm of ALGORITHMS) {
      describe(`Algorithm ${algorithm.id}`, () => {
        it('connection count and declaration order match algorithm.edges exactly', () => {
          const plan = planConnections(algorithm);

          expect(plan.length).toBe(algorithm.edges.length);
          plan.forEach((connection, index) => {
            expect(connection.from).toBe(algorithm.edges[index].from);
            expect(connection.to).toBe(algorithm.edges[index].to);
          });
        });

        it('isFeedback is true only for the self-loop whose operator equals getFeedbackOperator(algorithm), at most one', () => {
          const plan = planConnections(algorithm);
          const feedbackOperator = getFeedbackOperator(algorithm);
          const feedbackFlagged = plan.filter((connection) => connection.isFeedback);

          expect(feedbackFlagged.length).toBeLessThanOrEqual(1);
          for (const connection of plan) {
            const expectedFeedback =
              connection.from === connection.to && connection.from === feedbackOperator;
            expect(connection.isFeedback).toBe(expectedFeedback);
          }
          for (const connection of feedbackFlagged) {
            expect(connection.from).toBe(feedbackOperator);
            expect(connection.to).toBe(feedbackOperator);
          }
        });

        it('no carrier (per deriveCarriers) appears as the from of a non-feedback connection', () => {
          const plan = planConnections(algorithm);
          const carriers = new Set(deriveCarriers(algorithm));

          for (const connection of plan) {
            if (!connection.isFeedback) {
              expect(carriers.has(connection.from)).toBe(false);
            }
          }
        });
      });
    }
  });
});
