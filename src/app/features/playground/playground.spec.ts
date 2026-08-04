import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Playground } from './playground';

describe('Playground', () => {
  let fixture: ComponentFixture<Playground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Playground],
    }).compileComponents();

    fixture = TestBed.createComponent(Playground);
    await fixture.whenStable();
  });

  it('discloses that no audio engine is wired up yet', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="status"]')?.textContent).toContain(
      'No audio engine is wired up yet',
    );
  });

  it('lists the planned Playground capabilities', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.feature-list li').length).toBeGreaterThan(0);
  });
});
