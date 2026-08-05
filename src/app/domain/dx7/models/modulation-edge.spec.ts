import { isModulationEdge } from './modulation-edge';

describe('isModulationEdge', () => {
  it('accepts a well-formed inter-operator edge', () => {
    expect(isModulationEdge({ from: 6, to: 5 })).toBe(true);
  });

  it('accepts a self-loop edge, because D-01 makes feedback a valid edge, not a special case to reject', () => {
    expect(isModulationEdge({ from: 6, to: 6 })).toBe(true);
  });

  it('rejects an edge whose from operator id is out of range', () => {
    expect(isModulationEdge({ from: 0, to: 5 })).toBe(false);
    expect(isModulationEdge({ from: 7, to: 5 })).toBe(false);
  });

  it('rejects an edge whose to operator id is out of range', () => {
    expect(isModulationEdge({ from: 6, to: 0 })).toBe(false);
    expect(isModulationEdge({ from: 6, to: 7 })).toBe(false);
  });

  it('rejects an edge with a non-integer operator id', () => {
    expect(isModulationEdge({ from: 1.5, to: 5 })).toBe(false);
  });

  it('rejects null', () => {
    expect(isModulationEdge(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isModulationEdge(undefined)).toBe(false);
  });

  it('rejects a bare number', () => {
    expect(isModulationEdge(6)).toBe(false);
  });

  it('rejects an object missing the to member', () => {
    expect(isModulationEdge({ from: 6 })).toBe(false);
  });
});
