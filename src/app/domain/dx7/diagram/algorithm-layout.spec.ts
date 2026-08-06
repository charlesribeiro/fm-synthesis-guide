import { ALGORITHMS } from '../models/algorithms';
import { deriveCarriers, getFeedbackOperator } from '../models/derive-role';
import { OPERATOR_IDS } from '../models/operator';
import {
  ALGORITHM_LAYOUTS,
  CARRIER_ROW_Y,
  COLUMN_X,
  DIAGRAM_VIEWBOX_WIDTH,
  NODE_RADIUS,
  OUTPUT_BUS_Y,
  ROW_Y,
  getAlgorithmLayout,
  type AlgorithmLayout,
} from './algorithm-layout';
import { buildDiagramViewModelForId } from './build-diagram-view-model';

/**
 * Dataset-wide invariant suite for the 32 hand-authored layout records
 * (D-05/D-06/D-07) — mirrors `models/algorithms.spec.ts`'s style of
 * iterating all 32 rows inside one `it` per invariant and accumulating
 * offending ids, so a failure names exactly which algorithm broke the rule.
 */

/**
 * Perpendicular distance from `point` to the segment `a`-`b`. Returns the
 * distance to the nearest endpoint when the projection falls outside the
 * segment (clamped), matching the geometry a straight modulation edge
 * actually occupies.
 */
function distanceToSegment(
  point: { readonly x: number; readonly y: number },
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  let t = lengthSquared === 0 ? 0 : ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return Math.sqrt(dx * dx + dy * dy);
}

describe('ALGORITHM_LAYOUTS completeness (VIS-02, D-05)', () => {
  it('has exactly 32 entries', () => {
    expect(ALGORITHM_LAYOUTS.size).toBe(32);
  });

  it('has an entry for every algorithm id 1 through 32', () => {
    const missing: number[] = [];
    for (let id = 1; id <= 32; id += 1) {
      if (!ALGORITHM_LAYOUTS.has(id)) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every entry has all six OPERATOR_IDS keys with numeric x and y', () => {
    const broken: number[] = [];
    for (const [id, layout] of ALGORITHM_LAYOUTS) {
      const hasAllOperators = OPERATOR_IDS.every((operatorId) => {
        const position = layout[operatorId];
        return position !== undefined && typeof position.x === 'number' && typeof position.y === 'number';
      });
      if (!hasAllOperators) {
        broken.push(id);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS grid membership (D-07)', () => {
  it('every operator position is a member of COLUMN_X and ROW_Y', () => {
    const offenders: string[] = [];
    for (const [id, layout] of ALGORITHM_LAYOUTS) {
      for (const operatorId of OPERATOR_IDS) {
        const position = layout[operatorId];
        if (!COLUMN_X.includes(position.x) || !ROW_Y.includes(position.y)) {
          offenders.push(`algorithm ${id} operator ${operatorId}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS carrier row placement (D-06)', () => {
  it('every deriveCarriers operator sits on CARRIER_ROW_Y', () => {
    const offenders: string[] = [];
    for (const algorithm of ALGORITHMS) {
      const layout = ALGORITHM_LAYOUTS.get(algorithm.id);
      if (!layout) {
        offenders.push(`algorithm ${algorithm.id} (missing layout)`);
        continue;
      }
      const carriers = deriveCarriers(algorithm);
      for (const carrierId of carriers) {
        if (layout[carrierId].y !== CARRIER_ROW_Y) {
          offenders.push(`algorithm ${algorithm.id} operator ${carrierId}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS downward signal flow (D-06)', () => {
  it('every non-self-loop modulation edge has source y strictly less than target y', () => {
    const offenders: string[] = [];
    for (const algorithm of ALGORITHMS) {
      const layout = ALGORITHM_LAYOUTS.get(algorithm.id);
      if (!layout) {
        offenders.push(`algorithm ${algorithm.id} (missing layout)`);
        continue;
      }
      for (const edge of algorithm.edges) {
        if (edge.from === edge.to) {
          continue;
        }
        const sourceY = layout[edge.from].y;
        const targetY = layout[edge.to].y;
        if (!(sourceY < targetY)) {
          offenders.push(`algorithm ${algorithm.id} edge ${edge.from}->${edge.to}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS distinct positions', () => {
  it('within each algorithm, all six x,y pairs are pairwise distinct', () => {
    const offenders: number[] = [];
    for (const [id, layout] of ALGORITHM_LAYOUTS) {
      const keys = OPERATOR_IDS.map((operatorId) => `${layout[operatorId].x},${layout[operatorId].y}`);
      if (new Set(keys).size !== keys.length) {
        offenders.push(id);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS edge clearance (VIS-01 adjacency)', () => {
  it('every non-endpoint operator centre stays at least NODE_RADIUS + 4 from every modulation edge segment', () => {
    const offenders: string[] = [];
    const clearance = NODE_RADIUS + 4;
    for (const algorithm of ALGORITHMS) {
      const layout = ALGORITHM_LAYOUTS.get(algorithm.id);
      if (!layout) {
        offenders.push(`algorithm ${algorithm.id} (missing layout)`);
        continue;
      }
      for (const edge of algorithm.edges) {
        if (edge.from === edge.to) {
          continue;
        }
        const a = layout[edge.from];
        const b = layout[edge.to];
        for (const operatorId of OPERATOR_IDS) {
          if (operatorId === edge.from || operatorId === edge.to) {
            continue;
          }
          const distance = distanceToSegment(layout[operatorId], a, b);
          if (distance < clearance) {
            offenders.push(
              `algorithm ${algorithm.id} edge ${edge.from}->${edge.to} vs operator ${operatorId} (distance ${distance.toFixed(2)})`,
            );
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS canvas bounds', () => {
  it('every position stays inside the diagram viewBox with room for the node, output stem and bus', () => {
    const offenders: string[] = [];
    for (const [id, layout] of ALGORITHM_LAYOUTS) {
      for (const operatorId of OPERATOR_IDS) {
        const { x, y } = layout[operatorId];
        const inBounds =
          x - NODE_RADIUS >= 0 &&
          x + NODE_RADIUS + 30 <= DIAGRAM_VIEWBOX_WIDTH &&
          y - NODE_RADIUS - 30 >= 0 &&
          y + NODE_RADIUS <= OUTPUT_BUS_Y;
        if (!inBounds) {
          offenders.push(`algorithm ${id} operator ${operatorId}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('ALGORITHM_LAYOUTS immutability', () => {
  it('every layout record and every OperatorPosition inside it is frozen', () => {
    const offenders: string[] = [];
    for (const [id, layout] of ALGORITHM_LAYOUTS) {
      if (!Object.isFrozen(layout)) {
        offenders.push(`algorithm ${id} (layout record not frozen)`);
      }
      for (const operatorId of OPERATOR_IDS) {
        if (!Object.isFrozen(layout[operatorId])) {
          offenders.push(`algorithm ${id} operator ${operatorId} (position not frozen)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('exported facade rejects mutation attempts and preserves original lookups', () => {
    const before = ALGORITHM_LAYOUTS.get(1);
    expect(before).toBeDefined();

    const asMap = ALGORITHM_LAYOUTS as unknown as Map<number, AlgorithmLayout>;
    expect(typeof asMap.set).not.toBe('function');
    expect(typeof asMap.delete).not.toBe('function');
    expect(typeof asMap.clear).not.toBe('function');

    expect(() => {
      asMap.set(1, before!);
    }).toThrow();
    expect(() => {
      asMap.delete(1);
    }).toThrow();
    expect(() => {
      asMap.clear();
    }).toThrow();

    expect(ALGORITHM_LAYOUTS.get(1)).toBe(before);
    expect(ALGORITHM_LAYOUTS.size).toBe(32);
    expect(getAlgorithmLayout(1)).toBe(before!);
  });
});

describe('getAlgorithmLayout guard behaviour', () => {
  it('returns a record for algorithm ids 1, 19 and 32', () => {
    expect(getAlgorithmLayout(1)).not.toBeNull();
    expect(getAlgorithmLayout(19)).not.toBeNull();
    expect(getAlgorithmLayout(32)).not.toBeNull();
  });

  it('returns null for 0, 33, -1, 7.5 and NaN, and never throws', () => {
    const invalidInputs = [0, 33, -1, 7.5, Number.NaN];
    for (const input of invalidInputs) {
      let result: AlgorithmLayout | null = null;
      expect(() => {
        result = getAlgorithmLayout(input);
      }).not.toThrow();
      expect(result).toBeNull();
    }
  });
});

/**
 * End-to-end proof, through the real view-model builder, that a layout
 * record satisfying the geometric invariants above still produces a
 * complete diagram — catches a record that is grid-valid but somehow
 * unusable by `buildDiagramViewModelForId` (e.g. a typo dropping an
 * operator key) before a user opening a route would.
 */
describe('every algorithm produces a complete diagram view model (VIS-02)', () => {
  it('buildDiagramViewModelForId returns correct node/edge/feedback/output-bus counts for ids 1-32', () => {
    const offenders: string[] = [];
    for (const algorithm of ALGORITHMS) {
      const viewModel = buildDiagramViewModelForId(algorithm.id);
      if (!viewModel) {
        offenders.push(`algorithm ${algorithm.id} (null view model)`);
        continue;
      }
      if (viewModel.nodes.length !== 6) {
        offenders.push(`algorithm ${algorithm.id} (nodes.length ${viewModel.nodes.length} !== 6)`);
      }
      if (viewModel.edges.length !== algorithm.edges.length) {
        offenders.push(
          `algorithm ${algorithm.id} (edges.length ${viewModel.edges.length} !== ${algorithm.edges.length})`,
        );
      }
      const feedbackOperator = getFeedbackOperator(algorithm);
      const expectedFeedbackEdgeCount = feedbackOperator !== null ? 1 : 0;
      const actualFeedbackEdgeCount = viewModel.edges.filter((edge) => edge.kind === 'feedback').length;
      if (actualFeedbackEdgeCount !== expectedFeedbackEdgeCount) {
        offenders.push(
          `algorithm ${algorithm.id} (feedback edge count ${actualFeedbackEdgeCount} !== ${expectedFeedbackEdgeCount})`,
        );
      }
      const expectedStemCount = deriveCarriers(algorithm).length;
      if (viewModel.outputBus.stems.length !== expectedStemCount) {
        offenders.push(
          `algorithm ${algorithm.id} (outputBus.stems.length ${viewModel.outputBus.stems.length} !== ${expectedStemCount})`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every edge id within a single view model is unique, across all 32 algorithms', () => {
    const offenders: number[] = [];
    for (const algorithm of ALGORITHMS) {
      const viewModel = buildDiagramViewModelForId(algorithm.id);
      if (!viewModel) {
        offenders.push(algorithm.id);
        continue;
      }
      const edgeIds = viewModel.edges.map((edge) => edge.id);
      if (new Set(edgeIds).size !== edgeIds.length) {
        offenders.push(algorithm.id);
      }
    }
    expect(offenders).toEqual([]);
  });
});
