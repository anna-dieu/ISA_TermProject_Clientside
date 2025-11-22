class ResetPasswordPage {
  constructor() {
    this.form = document.getElementById("resetPasswordForm");
    this.messageDiv = document.getElementById("message");
    this.passwordInput = document.getElementById("password");
    this.confirmPasswordInput = document.getElementById("confirmPassword");
    this.apiBaseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
    this.userId = null;
    this.token = null;

    this._extractTokenFromUrl();
    this._initialize();
  }

  _extractTokenFromUrl() {
    // Get userId and token from URL hash (after #) since Gmail strips query parameters
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      this.userId = hashParams.get("userId");
      this.token = hashParams.get("token");
    }

    // Fallback to query parameters for backward compatibility
    if (!this.userId || !this.token) {
      const urlParams = new URLSearchParams(window.location.search);
      this.userId = urlParams.get("userId");
      this.token = urlParams.get("token");
    }

    // Debug logging
    console.log("Current URL:", window.location.href);
    console.log("URL search params:", window.location.search);
    console.log("userId:", this.userId);
    console.log("token:", this.token ? `${this.token.substring(0, 20)}...` : "null");
  }

  _initialize() {
    if (!this.userId || !this.token) {
      this._showMessage("Invalid reset link. Please request a new password reset.", "red");
      if (this.form) {
        this.form.style.display = "none";
      }
      return;
    }

    if (this.form) {
      this.form.addEventListener("submit", (e) => this._handleSubmit(e));
    }
  }

  _showMessage(message, color = "black") {
    if (this.messageDiv) {
      this.messageDiv.textContent = message;
      this.messageDiv.style.color = color;
    }
  }

  _validatePasswords() {
    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;

    if (password !== confirmPassword) {
      this._showMessage("Passwords do not match.", "red");
      return false;
    }

    if (password.length < 3) {
      this._showMessage("Password must be at least 3 characters.", "red");
      return false;
    }

    return true;
  }

  async _handleSubmit(e) {
    e.preventDefault();

    if (!this._validatePasswords()) {
      return;
    }

    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/account/reset-password?userId=${encodeURIComponent(this.userId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: "placeholder@example.com", // Required by model but not used when userId is present
            password: password,
            confirmPassword: confirmPassword,
            token: this.token,
          }),
        }
      );

      if (response.ok) {
        this._showMessage("Password reset successfully! Redirecting to login...", "green");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } else {
        const error = await response.text();
        this._showMessage(`Failed to reset password: ${error}`, "red");
      }
    } catch (error) {
      this._showMessage(`Error: ${error.message}`, "red");
    }
  }
}

// Initialize the page
const resetPasswordPage = new ResetPasswordPage();
