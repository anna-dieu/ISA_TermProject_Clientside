/* global authClient */

class IndexPage {
  constructor() {
    this.resetPasswordBtn = null;
    this.resetPasswordMsg = null;
  }

  bindResetPassword() {
    this.resetPasswordBtn = document.getElementById("resetPasswordBtn");
    this.resetPasswordMsg = document.getElementById("resetPasswordMsg");
    if (this.resetPasswordBtn) {
      this.resetPasswordBtn.addEventListener("click", async () => {
        // Prompt for email, new password, confirm password, and token
        const email = prompt("Enter your email:");
        if (!email) return;
        const password = prompt("Enter new password:");
        if (!password) return;
        const confirmPassword = prompt("Confirm new password:");
        if (!confirmPassword || confirmPassword !== password) {
          alert("Passwords do not match.");
          return;
        }
        const token = prompt("Enter the password reset token (from your email):");
        if (!token) return;
        this.resetPasswordBtn.disabled = true;
        if (this.resetPasswordMsg) this.resetPasswordMsg.style.display = "none";
        try {
          const resp = await authClient.resetPassword({ email, password, confirmPassword, token });
          if (this.resetPasswordMsg) {
            if (resp && resp.success) {
              this.resetPasswordMsg.textContent = "Password reset successful!";
            } else {
              if (resp && resp.message) {
                this.resetPasswordMsg.textContent = resp.message;
              } else {
                this.resetPasswordMsg.textContent = "Failed to reset password.";
              }
            }
            this.resetPasswordMsg.style.display = "inline-block";
          }
        } catch (err) {
          if (this.resetPasswordMsg) {
            this.resetPasswordMsg.textContent = "Error resetting password.";
            this.resetPasswordMsg.style.display = "inline-block";
          }
        }
        this.resetPasswordBtn.disabled = false;
      });
    }
  }

  checkAuthAndAdmin() {
    if (!authClient || typeof authClient.isAuthenticated !== "function") {
      console.warn("authClient not available on index page.");
      return;
    }

    if (!authClient.isAuthenticated()) {
      window.location.replace("./login.html");
      return;
    }

    // Navbar initialization is handled by navbar-loader.js.
    // Keep auth check and admin detection here.
    const user = authClient.getUser();
    if (user && (user.isAdmin || (user.roles && user.roles.includes("Admin")))) {
      // Add admin-specific UI elements here if needed
      console.log("Admin user logged in");
    }
  }

  init() {
    this.bindResetPassword();
    window.addEventListener("load", () => this.checkAuthAndAdmin());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const page = new IndexPage();
  window.indexPage = page;
  page.init();
});
