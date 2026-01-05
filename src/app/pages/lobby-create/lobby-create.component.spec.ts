import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LobbyCreateComponent } from './lobby-create.component';

describe('LobbyCreateComponent', () => {
  let component: LobbyCreateComponent;
  let fixture: ComponentFixture<LobbyCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LobbyCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LobbyCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
