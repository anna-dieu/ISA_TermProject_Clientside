/**
 * Controller for the reset password page.
 * Responsible for extracting the token from the URL, validating user input,
 * and calling the backend reset endpoint.
 */
class ResetPasswordPage {
  /**
   * Construct the page controller and wire up initial state.
   */
  constructor() {
    this.form = document.getElementById("resetPasswordForm");
    this.messageDiv = document.getElementById("message");
    this.errorDiv = document.getElementById("errorMessage");
    this.passwordInput = document.getElementById("password");
    this.confirmPasswordInput = document.getElementById("confirmPassword");
    this.apiBaseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
    this.userId = null;
    this.token = null;

    this._extractTokenFromUrl();
    this._initialize();
  }

  /**
   * Extract `userId` and `token` from the URL. First attempts the URI hash
   * (recommended: Gmail-friendly links), then falls back to query string
   * parameters for backward compatibility.
   * @private
   */
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

  /**
   * Initialize the form handlers and validate that the token data exists.
   * If the token is missing the form will be hidden and an error message shown.
   * @private
   */
  _initialize() {
    if (!this.userId || !this.token) {
      this._showMessage("Invalid reset link. Please request a new password reset.", true);
      if (this.form) {
        this.form.style.display = "none";
      }
      return;
    }

    if (this.form) {
      this.form.addEventListener("submit", (e) => this._handleSubmit(e));
    }
  }

  /**
   * Display a status message to the user. When `isError` is true the
   * message is rendered in the error container.
   * @param {string} message - Text to display
   * @param {boolean} [isError=false] - Whether this message is an error
   * @private
   */
  _showMessage(message, isError = false) {
    if (this.messageDiv) {
      this.messageDiv.style.display = "none";
    }
    if (this.errorDiv) {
      this.errorDiv.style.display = "none";
    }

    if (isError) {
      if (this.errorDiv) {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = "block";
      }
    } else {
      if (this.messageDiv) {
        this.messageDiv.textContent = message;
        this.messageDiv.style.display = "block";
      }
    }
  }

  /**
   * Validate the password inputs locally (matching and minimal length).
   * @returns {boolean} true when validation passes, otherwise false
   * @private
   */
  _validatePasswords() {
    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;

    if (password !== confirmPassword) {
      this._showMessage("Passwords do not match.", true);
      return false;
    }

    if (password.length < 3) {
      this._showMessage("Password must be at least 3 characters.", true);
      return false;
    }

    return true;
  }

  /**
   * POST the new password to the API using the extracted `userId` and `token`.
   * Shows success or error messages depending on the response.
   * @param {Event} e - Submit event
   * @returns {Promise<void>}
   * @private
   */
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
        this._showMessage("Password reset successfully! Redirecting to login...", false);
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } else {
        const error = await response.text();
        this._showMessage(`Failed to reset password: ${error}`, true);
      }
    } catch (error) {
      this._showMessage(`Error: ${error.message}`, true);
    }
  }
}

// Initialize the page
const resetPasswordPage = new ResetPasswordPage();
