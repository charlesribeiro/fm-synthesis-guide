import type { AlgorithmId } from '../models/algorithm';
import { isAlgorithmId } from '../models/algorithm';
import type { AlgorithmDefinition, AlgorithmReviewStatus } from '../models/algorithm-definition';
import { ALGORITHMS } from '../models/algorithms';
import { OPERATOR_IDS, type OperatorId } from '../models/operator';
import {
  deriveCarriers,
  getOperatorRole,
  hasFeedbackLoop,
  type OperatorRole,
} from '../models/derive-role';
import {
  DIAGRAM_VIEWBOX,
  NODE_RADIUS,
  OUTPUT_BUS_Y,
  getAlgorithmLayout,
  type AlgorithmLayout,
  type OperatorPosition,
} from './algorithm-layout';
import { buildDiagramDescription, buildDiagramTitle } from './describe-algorithm';

export interface DiagramNode {
  readonly id: OperatorId;
  readonly x: number;
  readonly y: number;
  readonly role: OperatorRole;
  readonly hasFeedback: boolean;
  readonly label: string;
}

export type DiagramEdgeKind = 'modulation' | 'feedback';

export interface DiagramEdge {
  readonly id: string;
  readonly from: OperatorId;
  readonly to: OperatorId;
  readonly kind: DiagramEdgeKind;
  readonly d: string;
}

export interface DiagramOutputStem {
  readonly operatorId: OperatorId;
  readonly d: string;
}

export interface DiagramOutputBus {
  readonly y: number;
  readonly d: string;
  readonly stems: readonly DiagramOutputStem[];
}

export interface AlgorithmDiagramViewModel {
  readonly algorithmId: AlgorithmId;
  readonly algorithmName: string;
  readonly title: string;
  readonly description: string;
  readonly viewBox: string;
  readonly nodeRadius: number;
  readonly reviewStatus?: AlgorithmReviewStatus;
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
  readonly outputBus: DiagramOutputBus;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildModulationPath(source: OperatorPosition, target: OperatorPosition): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const unitX = distance === 0 ? 0 : dx / distance;
  const unitY = distance === 0 ? 0 : dy / distance;

  const startX = round2(source.x + unitX * NODE_RADIUS);
  const startY = round2(source.y + unitY * NODE_RADIUS);
  const endX = round2(target.x - unitX * (NODE_RADIUS + 4));
  const endY = round2(target.y - unitY * (NODE_RADIUS + 4));

  return `M ${startX} ${startY} L ${endX} ${endY}`;
}

function buildFeedbackPath(position: OperatorPosition): string {
  const { x, y } = position;
  const startX = round2(x + NODE_RADIUS);
  const startY = round2(y);
  const controlX = round2(x + NODE_RADIUS + 30);
  const control1Y = round2(y);
  const control2Y = round2(y - NODE_RADIUS - 30);
  const endX = round2(x);
  const endY = round2(y - NODE_RADIUS - 4);

  return `M ${startX} ${startY} C ${controlX} ${control1Y}, ${controlX} ${control2Y}, ${endX} ${endY}`;
}

function buildOutputStemPath(position: OperatorPosition): string {
  const x = round2(position.x);
  const stemStartY = round2(position.y + NODE_RADIUS);
  const busY = round2(OUTPUT_BUS_Y);
  return `M ${x} ${stemStartY} L ${x} ${busY}`;
}

function buildOutputBusPath(carrierPositions: readonly OperatorPosition[]): string {
  const xs = carrierPositions.map((position) => position.x);
  const leftX = round2(Math.min(...xs) - 24);
  const rightX = round2(Math.max(...xs) + 24);
  const busY = round2(OUTPUT_BUS_Y);
  return `M ${leftX} ${busY} L ${rightX} ${busY}`;
}

/**
 * Combines an `AlgorithmDefinition` with its layout-hint record into a fully
 * resolved view model. Every routing fact (role, feedback, carriers) is
 * sourced from the existing `derive-role.ts` helpers — this function never
 * re-derives role/carrier/feedback logic itself, so the diagram and any
 * future audio engine cannot drift apart the way the Phase 2 Algorithm
 * 26/27 correction already proved a second copy would (RESEARCH.md
 * Anti-Patterns).
 */
export function buildDiagramViewModel(
  algorithm: AlgorithmDefinition,
  layout: AlgorithmLayout,
): AlgorithmDiagramViewModel {
  const nodes: DiagramNode[] = OPERATOR_IDS.map((operatorId) => {
    const position = layout[operatorId];
    const role = getOperatorRole(algorithm, operatorId);
    const feedback = hasFeedbackLoop(algorithm, operatorId);
    const label = `Operator ${operatorId}, ${role}${feedback ? ', with feedback' : ''}`;
    return {
      id: operatorId,
      x: position.x,
      y: position.y,
      role,
      hasFeedback: feedback,
      label,
    };
  });

  const edges: DiagramEdge[] = algorithm.edges.map((edge) => {
    const isFeedback = edge.from === edge.to;
    const d = isFeedback
      ? buildFeedbackPath(layout[edge.from])
      : buildModulationPath(layout[edge.from], layout[edge.to]);
    return {
      id: `${edge.from}-${edge.to}`,
      from: edge.from,
      to: edge.to,
      kind: isFeedback ? 'feedback' : 'modulation',
      d,
    };
  });

  const carrierIds = deriveCarriers(algorithm);
  const carrierPositions = carrierIds.map((id) => layout[id]);
  const stems: DiagramOutputStem[] = carrierIds.map((id) => ({
    operatorId: id,
    d: buildOutputStemPath(layout[id]),
  }));

  const outputBus: DiagramOutputBus = {
    y: OUTPUT_BUS_Y,
    d: buildOutputBusPath(carrierPositions),
    stems,
  };

  return {
    algorithmId: algorithm.id,
    algorithmName: algorithm.name,
    title: buildDiagramTitle(algorithm),
    description: buildDiagramDescription(algorithm),
    viewBox: DIAGRAM_VIEWBOX,
    nodeRadius: NODE_RADIUS,
    reviewStatus: algorithm.reviewStatus,
    nodes,
    edges,
    outputBus,
  };
}

/** O(1) selected-algorithm lookup — mirrors `InstrumentState`'s `ALGORITHMS_BY_ID` pattern. */
const ALGORITHMS_BY_ID: ReadonlyMap<AlgorithmId, AlgorithmDefinition> = new Map(
  ALGORITHMS.map((algorithm) => [algorithm.id, algorithm]),
);

/**
 * The single validated entry point the route component uses — validates
 * with `isAlgorithmId` before touching any collection, so an untrusted URL
 * value can never index `ALGORITHMS`/`ALGORITHM_LAYOUTS` unchecked (T-4-01).
 * Never throws: returns `null` when the id is invalid or either lookup
 * misses.
 */
export function buildDiagramViewModelForId(algorithmId: number): AlgorithmDiagramViewModel | null {
  if (!isAlgorithmId(algorithmId)) {
    return null;
  }
  const algorithm = ALGORITHMS_BY_ID.get(algorithmId);
  if (!algorithm) {
    return null;
  }
  const layout = getAlgorithmLayout(algorithmId);
  if (!layout) {
    return null;
  }
  return buildDiagramViewModel(algorithm, layout);
}
