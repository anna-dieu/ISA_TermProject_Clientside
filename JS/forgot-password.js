const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const messageDiv = document.getElementById("message");
const errorDiv = document.getElementById("errorMessage");

forgotPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;

  // Hide previous messages
  messageDiv.style.display = "none";
  errorDiv.style.display = "none";

  // Disable submit button during request
  const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    const response = await authClient.sendPasswordReset(email);

    if (response.success) {
      messageDiv.textContent = response.message || "Password reset link sent! Check your email.";
      messageDiv.style.display = "block";
      forgotPasswordForm.reset();
    } else {
      errorDiv.textContent = response.message || "Failed to send reset link. Please try again.";
      errorDiv.style.display = "block";
    }
  } catch (error) {
    errorDiv.textContent = "An error occurred. Please try again.";
    errorDiv.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Reset Link";
  }
});
