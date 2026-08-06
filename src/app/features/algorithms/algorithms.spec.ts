import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { ALGORITHMS } from '../../domain/dx7/models/algorithms';
import { isUnresolvedAlgorithm } from '../../domain/dx7/models/algorithm-definition';
import { Algorithms } from './algorithms';

describe('Algorithms', () => {
  let fixture: ComponentFixture<Algorithms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Algorithms],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(Algorithms);
    await fixture.whenStable();
  });

  it('renders all four algorithm groups covering 1 through 32', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const ranges = Array.from(compiled.querySelectorAll('.group-card__range')).map((el) =>
      el.textContent?.trim(),
    );
    expect(ranges).toEqual([
      'Algorithms 1–6',
      'Algorithms 7–18',
      'Algorithms 19–25',
      'Algorithms 26–32',
    ]);
  });

  it('renders exactly 32 algorithm cards, numbered 1 through 32 in DOM order', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = Array.from(compiled.querySelectorAll('.algorithm-card'));
    expect(cards.length).toBe(32);

    const numbers = cards.map((card) => {
      const numberText = card.querySelector('.algorithm-card__number')?.textContent ?? '';
      const match = numberText.match(/\d+/);
      return match ? Number(match[0]) : NaN;
    });
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
  });

  it('groups algorithms exactly by their dataset teachingTags, not by a hardcoded id range', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const groupCards = Array.from(compiled.querySelectorAll('.group-card'));

    for (const groupCard of groupCards) {
      const heading = groupCard.querySelector('h2');
      const headingId = heading?.id ?? '';
      const tag = headingId.replace(/^group-/, '');

      const expectedIds = ALGORITHMS.filter((algorithm) => algorithm.teachingTags.includes(tag as never))
        .map((algorithm) => algorithm.id)
        .sort((a, b) => a - b);

      const renderedIds = Array.from(groupCard.querySelectorAll('.algorithm-card'))
        .map((card) => {
          const numberText = card.querySelector('.algorithm-card__number')?.textContent ?? '';
          const match = numberText.match(/\d+/);
          return match ? Number(match[0]) : NaN;
        })
        .sort((a, b) => a - b);

      expect(renderedIds).toEqual(expectedIds);
    }
  });

  it('links every algorithm card to its own detail route', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = Array.from(compiled.querySelectorAll<HTMLAnchorElement>('.algorithm-card'));

    for (const card of cards) {
      const numberText = card.querySelector('.algorithm-card__number')?.textContent ?? '';
      const match = numberText.match(/\d+/);
      const id = match ? Number(match[0]) : NaN;
      expect(card.getAttribute('href')).toMatch(new RegExp(`/algorithms/${id}$`));
    }
  });

  it('removes the Phase 1 placeholder notice', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.status')).toBeNull();
    expect(compiled.textContent).not.toMatch(/aren't built yet/i);
  });

  it("renders algorithm 1's full dataset name as card body text", () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const algorithm1 = ALGORITHMS.find((algorithm) => algorithm.id === 1);
    expect(algorithm1).toBeDefined();

    const cards = Array.from(compiled.querySelectorAll('.algorithm-card'));
    const card1 = cards.find((card) => {
      const numberText = card.querySelector('.algorithm-card__number')?.textContent ?? '';
      return /\b1\b/.test(numberText);
    });

    const nameText = card1?.querySelector('.algorithm-card__name')?.textContent?.trim();
    expect(nameText).toBe(algorithm1?.name);
  });

  it('shows a review marker only on the browse item whose dataset row is flagged unresolved', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const unresolved = ALGORITHMS.find((algorithm) => isUnresolvedAlgorithm(algorithm));
    const resolved = ALGORITHMS.find((algorithm) => !isUnresolvedAlgorithm(algorithm));
    expect(unresolved).toBeDefined();
    expect(resolved).toBeDefined();

    const cards = Array.from(compiled.querySelectorAll('.algorithm-card'));
    const findCard = (id: number) =>
      cards.find((card) => {
        const numberText = card.querySelector('.algorithm-card__number')?.textContent ?? '';
        return new RegExp(`\\b${id}\\b`).test(numberText);
      });

    const unresolvedCard = findCard(unresolved!.id);
    const resolvedCard = findCard(resolved!.id);

    expect(unresolvedCard?.querySelector('.algorithm-card__flag')).not.toBeNull();
    expect(resolvedCard?.querySelector('.algorithm-card__flag')).toBeNull();
  });
});

describe('Algorithms browse-to-detail round trip (in-app navigation counterpart to Plan 01 cold deep link)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('follows the rendered Algorithm 7 link from /algorithms into its detail route, in-app (the counterpart to Plan 01s cold deep link on a mid-dataset id)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms', Algorithms);

    const browseRoot = harness.routeNativeElement as HTMLElement;
    const cards = Array.from(browseRoot.querySelectorAll<HTMLAnchorElement>('.algorithm-card'));
    const algorithm7Card = cards.find(
      (card) => card.querySelector('.algorithm-card__number')?.textContent?.trim() === 'Algorithm 7',
    );
    expect(algorithm7Card).toBeDefined();

    const href = algorithm7Card!.getAttribute('href');
    expect(href).toBeDefined();

    await harness.navigateByUrl(href!);

    const detailRoot = harness.routeNativeElement as HTMLElement;
    const svg = detailRoot.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(detailRoot.querySelector('h1')?.textContent).toMatch(/Algorithm\s+7/i);
    expect(svg?.querySelector('desc')?.textContent).toContain('operator 4 modulates operator 2');
  });

  it('follows the rendered Algorithm 32 link from /algorithms into its detail route and reaches the pure-additive end of the dataset', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/algorithms', Algorithms);

    const browseRoot = harness.routeNativeElement as HTMLElement;
    const cards = Array.from(browseRoot.querySelectorAll<HTMLAnchorElement>('.algorithm-card'));
    const algorithm32Card = cards.find(
      (card) => card.querySelector('.algorithm-card__number')?.textContent?.trim() === 'Algorithm 32',
    );
    expect(algorithm32Card).toBeDefined();

    const href = algorithm32Card!.getAttribute('href');
    expect(href).toBeDefined();

    await harness.navigateByUrl(href!);

    const detailRoot = harness.routeNativeElement as HTMLElement;
    expect(detailRoot.querySelectorAll('[data-operator-id]').length).toBe(6);
    expect(detailRoot.querySelectorAll('path.edge--modulation').length).toBe(0);
  });
});
