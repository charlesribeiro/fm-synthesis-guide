import { ComponentFixture, TestBed } from '@angular/core/testing';

import { About } from './about';

describe('About', () => {
  let fixture: ComponentFixture<About>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [About],
    }).compileComponents();

    fixture = TestBed.createComponent(About);
    await fixture.whenStable();
  });

  it('states there is no affiliation with Yamaha or Dexed', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('no affiliation with Yamaha Corporation');
  });

  it('discloses the audio engine is an educational approximation, not exact emulation', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('educational approximation');
    expect(compiled.textContent).toContain('does not claim exact hardware fidelity');
  });
});
