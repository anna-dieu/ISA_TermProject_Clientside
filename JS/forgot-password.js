/**
 * Page controller for the "Forgot Password" page.
 * Handles form wiring, validation and invoking the auth client's
 * password reset API.
 */
class ForgotPasswordPage {
  /**
   * Create a ForgotPasswordPage instance.
   * @param {{sendPasswordReset:function(string):Promise<object>}} authClient - Client with `sendPasswordReset(email)` method that returns a { success, message } shape.
   */
  constructor(authClient) {
    this.authClient = authClient;
    this.form = document.getElementById("forgotPasswordForm");
    this.messageDiv = document.getElementById("message");
    this.errorDiv = document.getElementById("errorMessage");
    this.emailInput = document.getElementById("email");
    this.submitBtn = null;

    this._initialize();
  }

  /**
   * Wire up DOM references and attach the submit handler if the form exists.
   * This is called automatically from the constructor.
   * @private
   */
  _initialize() {
    if (this.form) {
      this.submitBtn = this.form.querySelector('button[type="submit"]');
      this.form.addEventListener("submit", (e) => this._handleSubmit(e));
    }
  }

  /**
   * Display a status message to the user.
   * @param {string} message - The message text to display.
   * @param {boolean} [isError=false] - When true, shows the message as an error.
   * @private
   */
  _showMessage(message, isError = false) {
    this.messageDiv.style.display = "none";
    this.errorDiv.style.display = "none";

    if (isError) {
      this.errorDiv.textContent = message;
      this.errorDiv.style.display = "block";
    } else {
      this.messageDiv.textContent = message;
      this.messageDiv.style.display = "block";
    }
  }

  /**
   * Toggle the submit button loading state.
   * @param {boolean} isLoading - true to set the button into loading/disabled state.
   * @private
   */
  _setLoading(isLoading) {
    if (this.submitBtn) {
      this.submitBtn.disabled = isLoading;
      this.submitBtn.textContent = isLoading ? "Sending..." : "Send Reset Link";
    }
  }

  /**
   * Handle the form submit event: validate input, call the auth client,
   * and show success/error messages.
   * @param {Event} e - Submit event from the form
   * @returns {Promise<void>}
   * @private
   */
  async _handleSubmit(e) {
    e.preventDefault();

    const email = this.emailInput.value.trim();
    if (!email) {
      this._showMessage("Please enter your email address.", true);
      return;
    }

    this._showMessage("", false); // Clear previous messages
    this._setLoading(true);

    try {
      const response = await this.authClient.sendPasswordReset(email);

      if (response.success) {
        this._showMessage(response.message || "Password reset link sent! Check your email.", false);
        this.form.reset();
      } else {
        this._showMessage(response.message || "Failed to send reset link. Please try again.", true);
      }
    } catch (error) {
      this._showMessage("An error occurred. Please try again.", true);
    } finally {
      this._setLoading(false);
    }
  }
}

// Initialize the page
const forgotPasswordPage = new ForgotPasswordPage(authClient);
