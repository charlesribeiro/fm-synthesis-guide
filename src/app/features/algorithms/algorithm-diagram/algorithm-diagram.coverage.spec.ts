import { ComponentFixture, TestBed } from '@angular/core/testing';

import { buildDiagramViewModelForId } from '../../../domain/dx7/diagram/build-diagram-view-model';
import { ALGORITHMS } from '../../../domain/dx7/models/algorithms';
import {
  deriveCarriers,
  getFeedbackOperator,
  getOperatorRole,
} from '../../../domain/dx7/models/derive-role';
import { OPERATOR_IDS } from '../../../domain/dx7/models/operator';
import { AlgorithmDiagram } from './algorithm-diagram';

/**
 * Dataset-wide invariant sweep (VIS-02/VIS-03), companion to
 * `algorithm-diagram.spec.ts`'s two-fixture readable contract. Every
 * expected value below is computed from `ALGORITHMS`/the derivation helpers
 * at test time — never a transcribed table — so this file cannot become a
 * second, driftable copy of routing knowledge the way the Phase 2 Algorithm
 * 26/27 correction proved a transcribed copy can (see `04-05-PLAN.md`
 * design_decisions). Each `it` accumulates every offending algorithm id and
 * reason, then asserts the accumulated list is empty, so a failure names
 * every algorithm that broke and why rather than stopping at the first one
 * (mirrors `algorithms.spec.ts`'s accumulate-then-assert-empty style).
 *
 * A single TestBed module/fixture is created once per `it` and reused
 * across all 32 algorithms (input reset via `setInput` + `whenStable`)
 * rather than recreating the testing module 32 times per assertion group,
 * keeping the sweep inside the 10s feedback budget recorded in
 * `04-VALIDATION.md`.
 */

interface Failure {
  readonly algorithmId: number;
  readonly reason: string;
}

async function createSweepFixture(): Promise<ComponentFixture<AlgorithmDiagram>> {
  await TestBed.configureTestingModule({
    imports: [AlgorithmDiagram],
  }).compileComponents();
  return TestBed.createComponent(AlgorithmDiagram);
}

async function renderAlgorithm(
  fixture: ComponentFixture<AlgorithmDiagram>,
  algorithmId: number,
): Promise<HTMLElement> {
  fixture.componentRef.setInput('viewModel', buildDiagramViewModelForId(algorithmId)!);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('AlgorithmDiagram coverage sweep (all 32 algorithms)', () => {
  it('renders a complete accessible description for every algorithm (VIS-02, D-12)', async () => {
    const fixture = await createSweepFixture();
    const failures: Failure[] = [];

    for (const algorithm of ALGORITHMS) {
      const root = await renderAlgorithm(fixture, algorithm.id);
      const desc = root.querySelector('desc');
      const text = desc?.textContent ?? '';

      if (!desc) {
        failures.push({ algorithmId: algorithm.id, reason: 'no <desc> element rendered' });
        continue;
      }

      for (const edge of algorithm.edges) {
        if (edge.from === edge.to) {
          continue;
        }
        const sentence = `operator ${edge.from} modulates operator ${edge.to}`;
        if (!text.includes(sentence)) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `desc is missing edge sentence "${sentence}"`,
          });
        }
      }

      for (const carrierId of deriveCarriers(algorithm)) {
        const carrierMention = `operator ${carrierId}`;
        if (!text.includes(carrierMention)) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `desc is missing carrier mention "${carrierMention}"`,
          });
        }
      }

      const feedbackOperator = getFeedbackOperator(algorithm);
      if (feedbackOperator !== null) {
        const feedbackSentence = `operator ${feedbackOperator} modulates itself`;
        if (!text.includes(feedbackSentence)) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `desc is missing feedback sentence "${feedbackSentence}"`,
          });
        }
      } else if (text.includes('modulates itself')) {
        failures.push({
          algorithmId: algorithm.id,
          reason: 'desc reports a feedback self-loop but getFeedbackOperator returned null',
        });
      }
    }

    expect(failures).toEqual([]);
  });

  it('renders the correct node, edge, feedback and output-bus counts for every algorithm (VIS-02)', async () => {
    const fixture = await createSweepFixture();
    const failures: Failure[] = [];

    for (const algorithm of ALGORITHMS) {
      const root = await renderAlgorithm(fixture, algorithm.id);

      const operatorGroups = root.querySelectorAll('[data-operator-id]');
      if (operatorGroups.length !== 6) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `expected 6 operator-id elements, found ${operatorGroups.length}`,
        });
      }

      const expectedModulationCount = algorithm.edges.filter(
        (edge) => edge.from !== edge.to,
      ).length;
      const modulationCount = root.querySelectorAll('path.edge--modulation').length;
      if (modulationCount !== expectedModulationCount) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `expected ${expectedModulationCount} modulation-class edge paths, found ${modulationCount}`,
        });
      }

      const expectedFeedbackCount = getFeedbackOperator(algorithm) !== null ? 1 : 0;
      const feedbackCount = root.querySelectorAll('path.edge--feedback').length;
      if (feedbackCount !== expectedFeedbackCount) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `expected ${expectedFeedbackCount} feedback-class edge paths, found ${feedbackCount}`,
        });
      }

      const expectedStemCount = deriveCarriers(algorithm).length;
      const stemCount = root.querySelectorAll('.output-bus__stem').length;
      if (stemCount !== expectedStemCount) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `expected ${expectedStemCount} output-bus stem paths, found ${stemCount}`,
        });
      }
    }

    expect(failures).toEqual([]);
  });

  it('encodes carrier/modulator role by shape and feedback by class, never by color, for every algorithm (VIS-03, D-08, D-09)', async () => {
    const fixture = await createSweepFixture();
    const failures: Failure[] = [];

    for (const algorithm of ALGORITHMS) {
      const root = await renderAlgorithm(fixture, algorithm.id);

      for (const operatorId of OPERATOR_IDS) {
        const group = root.querySelector(`[data-operator-id="${operatorId}"]`);
        if (!group) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `no rendered group for operator ${operatorId}`,
          });
          continue;
        }

        const expectedRole = getOperatorRole(algorithm, operatorId);
        const actualRole = group.getAttribute('data-role');
        if (actualRole !== expectedRole) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `operator ${operatorId} data-role is "${actualRole}", expected "${expectedRole}"`,
          });
          continue;
        }

        const circleCount = group.querySelectorAll('circle').length;
        const rectCount = group.querySelectorAll('rect').length;
        if (expectedRole === 'carrier' && (circleCount !== 2 || rectCount !== 0)) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `carrier operator ${operatorId} shape mismatch (circles=${circleCount}, rects=${rectCount}, expected 2 circles/0 rects)`,
          });
        }
        if (expectedRole === 'modulator' && (rectCount !== 1 || circleCount !== 0)) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `modulator operator ${operatorId} shape mismatch (rects=${rectCount}, circles=${circleCount}, expected 1 rect/0 circles)`,
          });
        }
      }

      for (const edge of Array.from(root.querySelectorAll('path.edge--modulation'))) {
        if (edge.classList.contains('edge--feedback')) {
          failures.push({
            algorithmId: algorithm.id,
            reason: 'a modulation-class edge path also carries edge--feedback',
          });
        }
      }
      for (const edge of Array.from(root.querySelectorAll('path.edge--feedback'))) {
        if (edge.classList.contains('edge--modulation')) {
          failures.push({
            algorithmId: algorithm.id,
            reason: 'a feedback-class edge path also carries edge--modulation',
          });
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('namespaces title/desc/marker ids by algorithm id and keeps them collision-free across all 32 (VIS-02, RESEARCH Pitfall 2)', async () => {
    const fixture = await createSweepFixture();
    const failures: Failure[] = [];
    const titleIds: string[] = [];
    const markerIds: string[] = [];

    for (const algorithm of ALGORITHMS) {
      const root = await renderAlgorithm(fixture, algorithm.id);
      const svg = root.querySelector('svg');
      const title = svg?.querySelector('title') ?? null;
      const desc = svg?.querySelector('desc') ?? null;
      const marker = svg?.querySelector('marker') ?? null;
      const idToken = String(algorithm.id);

      if (!title || !title.id.includes(idToken)) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `title id "${title?.id}" does not contain "${idToken}"`,
        });
      }
      if (!desc || !desc.id.includes(idToken)) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `desc id "${desc?.id}" does not contain "${idToken}"`,
        });
      }
      if (!marker || !marker.id.includes(idToken)) {
        failures.push({
          algorithmId: algorithm.id,
          reason: `marker id "${marker?.id}" does not contain "${idToken}"`,
        });
      }

      const edgesWithMarker = Array.from(root.querySelectorAll('path[marker-end]'));
      if (edgesWithMarker.length === 0) {
        failures.push({
          algorithmId: algorithm.id,
          reason: 'no rendered edge path carries a marker-end reference',
        });
      }
      const expectedMarkerRef = marker ? `url(#${marker.id})` : null;
      for (const edge of edgesWithMarker) {
        if (edge.getAttribute('marker-end') !== expectedMarkerRef) {
          failures.push({
            algorithmId: algorithm.id,
            reason: `marker-end "${edge.getAttribute('marker-end')}" does not reference this algorithm's own marker id`,
          });
        }
      }

      if (title) {
        titleIds.push(title.id);
      }
      if (marker) {
        markerIds.push(marker.id);
      }
    }

    expect(failures).toEqual([]);
    expect(new Set(titleIds).size).toBe(titleIds.length);
    expect(new Set(markerIds).size).toBe(markerIds.length);
  });
});
