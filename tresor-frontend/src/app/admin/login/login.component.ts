import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { AuthService } from "../../core/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./login.component.html",
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = "";
  password = "";
  errorMsg = "";

  onLogin() {
    this.errorMsg = "";
    if (!this.username || !this.password) {
      this.errorMsg = "Veuillez remplir tous les champs";
      return;
    }
    this.auth.loginWithUsername(this.username, this.password).subscribe({
      next: () => this.router.navigate(["/admin"]),
      error: (err) => {
        if (err?.status === 401) this.errorMsg = "Identifiants invalides";
        else this.errorMsg = "Erreur de connexion";
      }
    });
  }
}
