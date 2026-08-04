import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Learn } from './learn';

describe('Learn', () => {
  let fixture: ComponentFixture<Learn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Learn],
    }).compileComponents();

    fixture = TestBed.createComponent(Learn);
    await fixture.whenStable();
  });

  it('renders one card per upcoming lesson', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.lesson-card');
    expect(cards.length).toBe(2);
  });

  it('leads with Algorithm 32 before Algorithm 1', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const algorithmLabels = Array.from(compiled.querySelectorAll('.lesson-card__algorithm')).map(
      (el) => el.textContent?.trim(),
    );
    expect(algorithmLabels).toEqual(['Algorithm 32', 'Algorithm 1']);
  });
});
