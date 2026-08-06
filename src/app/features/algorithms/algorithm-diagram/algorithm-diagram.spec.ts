import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

import {
  buildDiagramViewModelForId,
  type AlgorithmDiagramViewModel,
} from '../../../domain/dx7/diagram/build-diagram-view-model';
import { AlgorithmDiagram } from './algorithm-diagram';

async function createFixture(algorithmId: number): Promise<ComponentFixture<AlgorithmDiagram>> {
  await TestBed.configureTestingModule({
    imports: [AlgorithmDiagram],
  }).compileComponents();

  const fixture = TestBed.createComponent(AlgorithmDiagram);
  fixture.componentRef.setInput('viewModel', buildDiagramViewModelForId(algorithmId)!);
  await fixture.whenStable();
  return fixture;
}

describe('AlgorithmDiagram', () => {
  describe('VIS-02 accessibility contract (Algorithm 1 fixture)', () => {
    let svg: SVGSVGElement;

    beforeEach(async () => {
      const fixture = await createFixture(1);
      const root = fixture.nativeElement as HTMLElement;
      svg = root.querySelector('svg')!;
    });

    it('the svg element does not use role="img" so operator buttons stay exposed', () => {
      expect(svg.getAttribute('role')).not.toBe('img');
    });

    it('a title child exists with non-empty text', () => {
      const title = svg.querySelector('title');
      expect(title).not.toBeNull();
      expect(title?.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('a desc child exists whose text contains "operator 6 modulates operator 5"', () => {
      const desc = svg.querySelector('desc');
      expect(desc).not.toBeNull();
      expect(desc?.textContent).toContain('operator 6 modulates operator 5');
    });

    it('aria-labelledby, split on whitespace, is exactly the title id followed by the desc id', () => {
      const title = svg.querySelector('title')!;
      const desc = svg.querySelector('desc')!;
      const labelledBy = svg.getAttribute('aria-labelledby')?.split(/\s+/);
      expect(labelledBy).toEqual([title.id, desc.id]);
    });

    it('title, desc, and marker ids contain the algorithm id and an instance suffix', () => {
      const title = svg.querySelector('title')!;
      const desc = svg.querySelector('desc')!;
      const marker = svg.querySelector('marker')!;
      expect(title.id).toContain('1');
      expect(desc.id).toContain('1');
      expect(marker.id).toContain('1');
      expect(title.id).toMatch(/-title-\d+$/);
      expect(desc.id).toMatch(/-desc-\d+$/);
      expect(marker.id).toMatch(/-arrow-\d+$/);
    });

    it('the marker id is referenced by every marker-end attribute', () => {
      const marker = svg.querySelector('marker')!;
      const edgesWithMarker = Array.from(svg.querySelectorAll('path[marker-end]'));
      expect(edgesWithMarker.length).toBeGreaterThan(0);
      for (const edge of edgesWithMarker) {
        expect(edge.getAttribute('marker-end')).toBe(`url(#${marker.id})`);
      }
    });

    it('two instances with the same view model generate distinct title, desc, and marker ids', async () => {
      @Component({
        standalone: true,
        imports: [AlgorithmDiagram],
        template: `
          <app-algorithm-diagram [viewModel]="vm" />
          <app-algorithm-diagram [viewModel]="vm" />
        `,
      })
      class DualDiagramHost {
        readonly vm: AlgorithmDiagramViewModel = buildDiagramViewModelForId(1)!;
      }

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [DualDiagramHost],
      }).compileComponents();

      const hostFixture = TestBed.createComponent(DualDiagramHost);
      await hostFixture.whenStable();
      const root = hostFixture.nativeElement as HTMLElement;
      const svgs = Array.from(root.querySelectorAll('svg'));
      expect(svgs.length).toBe(2);

      const ids = svgs.map((diagram) => ({
        title: diagram.querySelector('title')!.id,
        desc: diagram.querySelector('desc')!.id,
        marker: diagram.querySelector('marker')!.id,
        labelledBy: diagram.getAttribute('aria-labelledby'),
      }));

      expect(ids[0].title).not.toBe(ids[1].title);
      expect(ids[0].desc).not.toBe(ids[1].desc);
      expect(ids[0].marker).not.toBe(ids[1].marker);

      for (let i = 0; i < svgs.length; i += 1) {
        const diagram = ids[i];
        const svg = svgs[i];
        expect(diagram.labelledBy).toBe(`${diagram.title} ${diagram.desc}`);
        const edges = Array.from(svg.querySelectorAll('path[marker-end]'));
        expect(edges.length).toBeGreaterThan(0);
        for (const edge of edges) {
          expect(edge.getAttribute('marker-end')).toBe(`url(#${diagram.marker})`);
        }
      }
    });
  });

  describe('VIS-02 structure from data', () => {
    it('Algorithm 1 renders exactly 6 operator nodes, 4 modulation edges, 1 feedback edge, 2 output-bus stems', async () => {
      const fixture = await createFixture(1);
      const root = fixture.nativeElement as HTMLElement;

      const operatorIds = Array.from(root.querySelectorAll('[data-operator-id]'))
        .map((element) => element.getAttribute('data-operator-id'))
        .sort();
      expect(operatorIds).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(root.querySelectorAll('path.edge--modulation').length).toBe(4);
      expect(root.querySelectorAll('path.edge--feedback').length).toBe(1);
      expect(root.querySelectorAll('.output-bus__stem').length).toBe(2);
    });

    it('Algorithm 32 renders 6 operator nodes, 0 modulation edges, 1 feedback edge, 6 output-bus stems', async () => {
      const fixture = await createFixture(32);
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelectorAll('[data-operator-id]').length).toBe(6);
      expect(root.querySelectorAll('path.edge--modulation').length).toBe(0);
      expect(root.querySelectorAll('path.edge--feedback').length).toBe(1);
      expect(root.querySelectorAll('.output-bus__stem').length).toBe(6);
    });
  });

  // VIS-03/D-08: every assertion below reads a data-* attribute, a class
  // name, or a child element's tag — never a rendered color/fill/stroke
  // value — which is what makes the role encoding demonstrably survive a
  // color-blind or high-contrast rendering rather than relying on color.
  describe('VIS-03 and D-08 non-color encoding (Algorithm 1 fixture)', () => {
    let root: HTMLElement;

    beforeEach(async () => {
      const fixture = await createFixture(1);
      root = fixture.nativeElement as HTMLElement;
    });

    it('each operator g carries a data-role of carrier or modulator matching the view model', () => {
      const expectedRoles = new Map<string, string>([
        ['1', 'carrier'],
        ['2', 'modulator'],
        ['3', 'carrier'],
        ['4', 'modulator'],
        ['5', 'modulator'],
        ['6', 'modulator'],
      ]);
      for (const group of Array.from(root.querySelectorAll('[data-operator-id]'))) {
        const id = group.getAttribute('data-operator-id')!;
        expect(group.getAttribute('data-role')).toBe(expectedRoles.get(id));
      }
    });

    it('every carrier g (shape, not color, distinguishes it) contains two circle children and no rect', () => {
      const carrierGroups = root.querySelectorAll('[data-role="carrier"]');
      expect(carrierGroups.length).toBe(2);
      for (const group of Array.from(carrierGroups)) {
        expect(group.querySelectorAll('circle').length).toBe(2);
        expect(group.querySelectorAll('rect').length).toBe(0);
      }
    });

    it('every modulator g (shape, not color, distinguishes it) contains one rect and no circle', () => {
      const modulatorGroups = root.querySelectorAll('[data-role="modulator"]');
      expect(modulatorGroups.length).toBe(4);
      for (const group of Array.from(modulatorGroups)) {
        expect(group.querySelectorAll('rect').length).toBe(1);
        expect(group.querySelectorAll('circle').length).toBe(0);
      }
    });

    it('the feedback paths class list contains edge--feedback and does not contain edge--modulation', () => {
      const feedbackPath = root.querySelector('path.edge--feedback')!;
      expect(feedbackPath.classList.contains('edge--feedback')).toBe(true);
      expect(feedbackPath.classList.contains('edge--modulation')).toBe(false);
    });
  });

  describe('D-10 selection (Algorithm 1 fixture)', () => {
    let fixture: ComponentFixture<AlgorithmDiagram>;
    let root: HTMLElement;

    beforeEach(async () => {
      fixture = await createFixture(1);
      root = fixture.nativeElement as HTMLElement;
    });

    function operatorGroup(operatorId: string): Element {
      return root.querySelector(`[data-operator-id="${operatorId}"]`)!;
    }

    function statusRegion(): Element {
      return root.querySelector('[role="status"]')!;
    }

    it('clicking the g whose data-operator-id is 3 sets aria-pressed true and adds operator--selected', async () => {
      operatorGroup('3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();

      expect(operatorGroup('3').getAttribute('aria-pressed')).toBe('true');
      expect(operatorGroup('3').classList.contains('operator--selected')).toBe(true);
    });

    it('selecting operator 3 adds edge--connected to every path whose data-from or data-to is 3, and no other', async () => {
      operatorGroup('3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();

      const allEdges = Array.from(root.querySelectorAll('path.edge'));
      for (const edge of allEdges) {
        const isConnected =
          edge.getAttribute('data-from') === '3' || edge.getAttribute('data-to') === '3';
        expect(edge.classList.contains('edge--connected')).toBe(isConnected);
      }
      expect(allEdges.some((edge) => edge.classList.contains('edge--connected'))).toBe(true);
    });

    it('a second click on the same node clears both the selection and the connected-edge highlight', async () => {
      operatorGroup('3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();
      operatorGroup('3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();

      expect(operatorGroup('3').getAttribute('aria-pressed')).toBe('false');
      expect(operatorGroup('3').classList.contains('operator--selected')).toBe(false);
      expect(root.querySelectorAll('path.edge--connected').length).toBe(0);
    });

    it('an Enter keydown on the node produces the same selected state as a click', async () => {
      operatorGroup('3').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await fixture.whenStable();

      expect(operatorGroup('3').getAttribute('aria-pressed')).toBe('true');
      expect(operatorGroup('3').classList.contains('operator--selected')).toBe(true);
    });

    it('the visually hidden status region is empty before selection and names the selected operator and its role after', async () => {
      expect(statusRegion().textContent?.trim()).toBe('');

      operatorGroup('3').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();

      expect(statusRegion().textContent).toContain('Operator 3');
      expect(statusRegion().textContent).toContain('carrier');
    });

    it('no [data-operator-id] element has an empty aria-label', () => {
      for (const group of Array.from(root.querySelectorAll('[data-operator-id]'))) {
        expect((group.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
      }
    });
  });
});
