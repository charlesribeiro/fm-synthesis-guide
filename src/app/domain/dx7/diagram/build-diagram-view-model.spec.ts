import { ALGORITHMS } from '../models/algorithms';
import { OUTPUT_BUS_Y, getAlgorithmLayout } from './algorithm-layout';
import { buildDiagramViewModel, buildDiagramViewModelForId } from './build-diagram-view-model';

const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1)!;
const algorithm32 = ALGORITHMS.find((algorithm) => algorithm.id === 32)!;
const layout1 = getAlgorithmLayout(1)!;
const layout32 = getAlgorithmLayout(32)!;

describe('buildDiagramViewModel — Algorithm 1', () => {
  const viewModel = buildDiagramViewModel(algorithm1, layout1);

  it('builds 6 nodes in ascending operator order 1..6', () => {
    expect(viewModel.nodes.map((node) => node.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('nodes 1 and 3 are carriers, the rest are modulators', () => {
    const rolesById = new Map(viewModel.nodes.map((node) => [node.id, node.role]));
    expect(rolesById.get(1)).toBe('carrier');
    expect(rolesById.get(3)).toBe('carrier');
    expect(rolesById.get(2)).toBe('modulator');
    expect(rolesById.get(4)).toBe('modulator');
    expect(rolesById.get(5)).toBe('modulator');
    expect(rolesById.get(6)).toBe('modulator');
  });

  it('only node 6 has hasFeedback true', () => {
    for (const node of viewModel.nodes) {
      expect(node.hasFeedback).toBe(node.id === 6);
    }
  });

  it('builds 5 edges preserving dataset declaration order, with unique ids', () => {
    expect(viewModel.edges.map((edge) => `${edge.from}-${edge.to}`)).toEqual([
      '6-5',
      '5-4',
      '4-3',
      '2-1',
      '6-6',
    ]);
    const ids = viewModel.edges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exactly one edge has kind "feedback" and its from/to both equal 6', () => {
    const feedbackEdges = viewModel.edges.filter((edge) => edge.kind === 'feedback');
    expect(feedbackEdges).toHaveLength(1);
    expect(feedbackEdges[0].from).toBe(6);
    expect(feedbackEdges[0].to).toBe(6);
  });

  it('D-09: every modulation edge is a straight "M ... L ..." segment, the feedback edge is a curve', () => {
    for (const edge of viewModel.edges) {
      if (edge.kind === 'modulation') {
        expect(edge.d.startsWith('M ')).toBe(true);
        expect(edge.d).toContain(' L ');
      } else {
        expect(edge.d).toContain(' C ');
      }
    }
  });

  it('outputBus has one stem per carrier and y equals OUTPUT_BUS_Y', () => {
    expect(viewModel.outputBus.stems).toHaveLength(2);
    expect(viewModel.outputBus.stems.map((stem) => stem.operatorId).sort()).toEqual([1, 3]);
    expect(viewModel.outputBus.y).toBe(OUTPUT_BUS_Y);
  });
});

describe('buildDiagramViewModel — Algorithm 32', () => {
  const viewModel = buildDiagramViewModel(algorithm32, layout32);

  it('all six nodes are carriers', () => {
    expect(viewModel.nodes.every((node) => node.role === 'carrier')).toBe(true);
  });

  it('has 0 modulation edges and 1 feedback edge', () => {
    expect(viewModel.edges.filter((edge) => edge.kind === 'modulation')).toHaveLength(0);
    expect(viewModel.edges.filter((edge) => edge.kind === 'feedback')).toHaveLength(1);
  });

  it('has 6 output-bus stems', () => {
    expect(viewModel.outputBus.stems).toHaveLength(6);
  });
});

describe('buildDiagramViewModelForId', () => {
  it('returns a view model for algorithm 1 and algorithm 32', () => {
    expect(buildDiagramViewModelForId(1)).not.toBeNull();
    expect(buildDiagramViewModelForId(32)).not.toBeNull();
  });

  it('returns null for ids outside the authored/valid range: 0, 33, -1, 7.5, NaN', () => {
    expect(buildDiagramViewModelForId(0)).toBeNull();
    expect(buildDiagramViewModelForId(33)).toBeNull();
    expect(buildDiagramViewModelForId(-1)).toBeNull();
    expect(buildDiagramViewModelForId(7.5)).toBeNull();
    expect(buildDiagramViewModelForId(Number.NaN)).toBeNull();
  });
});

describe('view-model selection safety (RESEARCH Pitfall 4)', () => {
  it('no node object exposes a "selected" field, so selection state cannot invalidate @for tracking', () => {
    const viewModel = buildDiagramViewModel(algorithm1, layout1);
    for (const node of viewModel.nodes) {
      expect(Object.prototype.hasOwnProperty.call(node, 'selected')).toBe(false);
    }
  });
});
