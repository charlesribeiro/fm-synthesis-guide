import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Algorithms } from './algorithms';

describe('Algorithms', () => {
  let fixture: ComponentFixture<Algorithms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Algorithms],
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
});
