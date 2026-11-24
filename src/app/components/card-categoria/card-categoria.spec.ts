import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule, provideRouter } from '@angular/router';
import { CardCategoria } from './card-categoria';

describe('CardCategoria', () => {
  let fixture: ComponentFixture<CardCategoria>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardCategoria],
      imports: [CommonModule, RouterModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CardCategoria);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
