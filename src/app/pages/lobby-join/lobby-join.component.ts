import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LobbyCodeService } from '../../services/lobby-code.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-lobby-join',
  imports: [FormsModule, RouterModule],
  templateUrl: './lobby-join.component.html',
  styleUrl: './lobby-join.component.scss',
})
export class LobbyJoinComponent {
  private lobbyCodeService = inject(LobbyCodeService);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  joinCode = '';
  resolvedLobbyId = '';
  errorMessage = '';
  isResolving = false;

  async ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (code) {
      this.joinCode = code;
      await this.resolveCode();
    }
  }

  async resolveCode() {
    this.isResolving = true;
    this.errorMessage = '';
    this.resolvedLobbyId = '';

    const lobbyId = await this.lobbyCodeService.resolveLobbyCode(this.joinCode);
    if (!lobbyId) {
      this.errorMessage = 'No lobby found for that code.';
    } else {
      this.resolvedLobbyId = lobbyId;
      this.supabaseService.lobbyId.set(lobbyId);
      this.supabaseService.joinCode.set(
        this.joinCode.trim().toUpperCase().replace(/\s+/g, '')
      );
      localStorage.setItem(
        'lobbyJoinCode',
        this.joinCode.trim().toUpperCase().replace(/\s+/g, '')
      );
      localStorage.setItem('lobbyId', lobbyId);
    }

    this.isResolving = false;
  }

  async joinLobby() {
    if (!this.resolvedLobbyId) {
      return;
    }
    await this.router.navigate(['/lobby', this.resolvedLobbyId]);
  }
}
