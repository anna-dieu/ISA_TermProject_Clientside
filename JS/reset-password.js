const resetPasswordForm = document.getElementById("resetPasswordForm");
const messageDiv = document.getElementById("message");

// Get API base URL from config
const API_BASE_URL = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";

// Get userId and token from URL hash (after #) since Gmail strips query parameters
let userId = null;
let token = null;

if (window.location.hash) {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  userId = hashParams.get("userId");
  token = hashParams.get("token");
}

// Fallback to query parameters for backward compatibility
if (!userId || !token) {
  const urlParams = new URLSearchParams(window.location.search);
  userId = urlParams.get("userId");
  token = urlParams.get("token");
}

// Debug logging
console.log("Current URL:", window.location.href);
console.log("URL search params:", window.location.search);
console.log("userId:", userId);
console.log("token:", token ? `${token.substring(0, 20)}...` : "null");

if (!userId || !token) {
  messageDiv.textContent = "Invalid reset link. Please request a new password reset.";
  messageDiv.style.color = "red";
  resetPasswordForm.style.display = "none";
}

resetPasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    messageDiv.textContent = "Passwords do not match.";
    messageDiv.style.color = "red";
    return;
  }

  if (password.length < 3) {
    messageDiv.textContent = "Password must be at least 3 characters.";
    messageDiv.style.color = "red";
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/account/reset-password?userId=${encodeURIComponent(userId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "placeholder@example.com", // Required by model but not used when userId is present
          password: password,
          confirmPassword: confirmPassword,
          token: token,
        }),
      }
    );

    if (response.ok) {
      messageDiv.textContent = "Password reset successfully! Redirecting to login...";
      messageDiv.style.color = "green";
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } else {
      const error = await response.text();
      messageDiv.textContent = `Failed to reset password: ${error}`;
      messageDiv.style.color = "red";
    }
  } catch (error) {
    messageDiv.textContent = `Error: ${error.message}`;
    messageDiv.style.color = "red";
  }
});
