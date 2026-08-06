import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { buildDiagramViewModelForId } from '../../../domain/dx7/diagram/build-diagram-view-model';
import { MAX_ALGORITHM_ID, MIN_ALGORITHM_ID } from '../../../domain/dx7/models/algorithm';
import { routes } from '../../../app.routes';
import { AlgorithmDetail } from './algorithm-detail';

describe('AlgorithmDetail route', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('renders an accessible SVG diagram for algorithm 1 on a cold deep link (RESEARCH Pitfall 1)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/1', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    const svg = root.querySelector('svg');
    expect(svg).not.toBeNull();

    const desc = svg?.querySelector('desc');
    expect(desc?.textContent).toContain('operator 6 modulates operator 5');
  });

  it('renders exactly six operator nodes, four modulation edges, and one feedback edge for algorithm 1', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/1', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelectorAll('[data-operator-id]').length).toBe(6);
    expect(root.querySelectorAll('path.edge--modulation').length).toBe(4);
    expect(root.querySelectorAll('path.edge--feedback').length).toBe(1);
  });

  it('renders no svg and an explicit not-found message for an out-of-range id, with no thrown error', async () => {
    const harness = await RouterTestingHarness.create();

    // Awaiting without a try/catch means any thrown error fails this test
    // directly — the "no thrown error" assertion is the successful await.
    await harness.navigateByUrl('/algorithms/33', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('svg')).toBeNull();
    expect(root.textContent).toMatch(/not found/i);
  });

  it('renders exactly two pager links at the middle of the range with the correct neighbours (/algorithms/7)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/7', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.pager__link'));
    expect(links.length).toBe(2);

    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.endsWith('/algorithms/6'))).toBe(true);
    expect(hrefs.some((href) => href?.endsWith('/algorithms/8'))).toBe(true);
  });

  it('renders only a next link at the lower boundary (/algorithms/1) and never wraps to 32', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/1', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.pager__link'));
    expect(links.length).toBe(1);

    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.endsWith('/algorithms/2'))).toBe(true);
    expect(hrefs.some((href) => href?.endsWith('/algorithms/32'))).toBe(false);
    expect(hrefs.some((href) => href?.endsWith('/algorithms/0'))).toBe(false);
  });

  it('renders only a previous link at the upper boundary (/algorithms/32) and never wraps to 1', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/32', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.pager__link'));
    expect(links.length).toBe(1);

    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs.some((href) => href?.endsWith('/algorithms/31'))).toBe(true);
    expect(hrefs.some((href) => href?.endsWith('/algorithms/1'))).toBe(false);
    expect(hrefs.some((href) => href?.endsWith('/algorithms/33'))).toBe(false);
  });

  it('renders a back link to the grouped browser, distinct from the pager links', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/7', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    const backLink = root.querySelector<HTMLAnchorElement>('a.back-link');
    expect(backLink).not.toBeNull();
    expect(backLink?.getAttribute('href')).toMatch(/\/algorithms$/);
    expect(backLink?.classList.contains('pager__link')).toBe(false);
  });

  it('re-renders the diagram for algorithm 2 after following the next link from algorithm 1 (same-route navigation)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/1', AlgorithmDetail);

    const initialRoot = harness.routeNativeElement as HTMLElement;
    const nextHref = initialRoot
      .querySelector<HTMLAnchorElement>('a.pager__link--next')
      ?.getAttribute('href');
    expect(nextHref).toBeTruthy();

    // Navigate using the href taken from the rendered anchor, not a
    // hand-constructed URL, so this test fails if the link expression breaks.
    await harness.navigateByUrl(nextHref as string, AlgorithmDetail);

    const updatedRoot = harness.routeNativeElement as HTMLElement;
    const desc = updatedRoot.querySelector('svg desc');
    expect(desc?.textContent).toContain('Algorithm 2:');
    expect(desc?.textContent).not.toContain('Algorithm 1:');
  });

  it('supports stepping across the full 1–32 range with correct pager neighbours and a rendered diagram at every id', async () => {
    // One harness reused across the whole sweep (only one harness may be
    // created per test) — this also exercises same-route navigation 31
    // times over, not just the single-step case above.
    const harness = await RouterTestingHarness.create();
    const failures: string[] = [];

    for (let id = MIN_ALGORITHM_ID; id <= MAX_ALGORITHM_ID; id += 1) {
      await harness.navigateByUrl(`/algorithms/${id}`, AlgorithmDetail);
      const root = harness.routeNativeElement as HTMLElement;

      const svg = root.querySelector('svg');
      const desc = svg?.querySelector('desc');
      const descOk = desc?.textContent?.includes(`Algorithm ${id}:`) ?? false;

      const hrefs = Array.from(root.querySelectorAll<HTMLAnchorElement>('a.pager__link'))
        .map((link) => link.getAttribute('href'))
        .filter((href): href is string => href !== null);

      const expectedNeighbours: number[] = [];
      if (id > MIN_ALGORITHM_ID) {
        expectedNeighbours.push(id - 1);
      }
      if (id < MAX_ALGORITHM_ID) {
        expectedNeighbours.push(id + 1);
      }

      const hrefsOk =
        hrefs.length === expectedNeighbours.length &&
        expectedNeighbours.every((neighbour) =>
          hrefs.some((href) => href.endsWith(`/algorithms/${neighbour}`)),
        );

      if (!svg || !descOk || !hrefsOk) {
        failures.push(
          `id ${id}: svg=${!!svg} descOk=${descOk} hrefs=${JSON.stringify(hrefs)} expected=${JSON.stringify(expectedNeighbours)}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('AlgorithmDetail not-found matrix (T-4-01, T-4-04)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  // 0/33/99 out of range; -1 out of range and non-matching sign; 7.5 not an
  // integer; abc not numeric; %20 decodes to whitespace; ' 7x' has leading
  // whitespace and trailing junk; 1e1 is exponent notation (Number('1e1')
  // === 10, a legitimately in-range integer as a *number* — rejecting it
  // requires a string-shape guard, not just isAlgorithmId's numeric range
  // check, see the dedicated assertion below); the last is an oversized
  // integer string.
  const rejectedSegments = [
    '0',
    '33',
    '99',
    '-1',
    '7.5',
    'abc',
    '%20',
    ' 7x',
    '1e1',
    '999999999999999999999',
  ];

  it('renders an explanatory, recoverable not-found state for every rejected segment, with no thrown error and no diagram', async () => {
    const harness = await RouterTestingHarness.create();
    const failures: string[] = [];

    for (const segment of rejectedSegments) {
      // Awaiting without a try/catch means any thrown error fails this loop
      // iteration directly — part of the "no thrown error" assertion.
      await harness.navigateByUrl(`/algorithms/${segment}`, AlgorithmDetail);
      const root = harness.routeNativeElement as HTMLElement;

      const headingOk = /algorithm not found/i.test(root.querySelector('h1')?.textContent ?? '');
      const noSvg = root.querySelector('svg') === null;
      const backLink = root.querySelector<HTMLAnchorElement>('a.back-link');
      const backLinkOk = backLink !== null && backLink.getAttribute('href')?.endsWith('/algorithms');

      if (!headingOk || !noSvg || !backLinkOk) {
        failures.push(
          `segment "${segment}": headingOk=${headingOk} noSvg=${noSvg} backLinkOk=${!!backLinkOk}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('accepts both range boundaries (1 and 32) and renders a diagram, so the matrix cannot pass by rejecting everything', async () => {
    const harness = await RouterTestingHarness.create();

    for (const id of [MIN_ALGORITHM_ID, MAX_ALGORITHM_ID]) {
      await harness.navigateByUrl(`/algorithms/${id}`, AlgorithmDetail);
      const root = harness.routeNativeElement as HTMLElement;
      expect(root.querySelector('svg')).not.toBeNull();
    }
  });

  it('never reaches the dataset/layout lookup for the numerically-rejected segments — buildDiagramViewModelForId returns null after conversion', () => {
    // '1e1' is excluded here: Number('1e1') === 10, a legitimately in-range
    // integer, so buildDiagramViewModelForId(10) is not null — the guard
    // that rejects the string '1e1' lives in AlgorithmDetail's own
    // string-shape check (it must never reach Number() at all), not in this
    // domain function's numeric range check. The harness-level sweep above
    // already proves '/algorithms/1e1' is rejected end to end.
    const numericallyRejectedSegments = rejectedSegments.filter((segment) => segment !== '1e1');

    for (const segment of numericallyRejectedSegments) {
      expect(buildDiagramViewModelForId(Number(segment))).toBeNull();
    }
  });

  it('echoes the rejected segment back through text interpolation only', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms/99', AlgorithmDetail);

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.textContent).toContain('99');
  });
});
