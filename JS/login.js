// Initialize auth client and handle form submission
const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const usageInfo = document.getElementById("usageInfo");
const apiCallsSpan = document.getElementById("apiCalls");

// Forgot password logic
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const forgotPasswordMsg = document.getElementById("forgotPasswordMsg");
forgotPasswordBtn.addEventListener("click", async () => {
  const email = prompt("Enter your email to reset password:");
  if (!email) return;
  forgotPasswordBtn.disabled = true;
  forgotPasswordMsg.style.display = "none";
  try {
    const resp = await authClient.sendPasswordReset(email);
    if (resp.success) {
      forgotPasswordMsg.textContent = "Password reset link sent! Check your email.";
      forgotPasswordMsg.style.display = "inline-block";
    } else {
      forgotPasswordMsg.textContent = resp.message || "Failed to send reset link.";
      forgotPasswordMsg.style.display = "inline-block";
    }
  } catch (err) {
    forgotPasswordMsg.textContent = "Error sending reset link.";
    forgotPasswordMsg.style.display = "inline-block";
  }
  forgotPasswordBtn.disabled = false;
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const response = await authClient.login(email, password);
    console.log("Login response:", response); // Debug log

    if (response.success) {
      console.log("Login successful, redirecting..."); // Debug log

      // Disable form while redirecting
      loginForm.querySelectorAll("input, button").forEach((el) => (el.disabled = true));

      // Try to get user info including roles from backend
      try {
        const token = response.token || authClient.getToken();
        if (token) {
          const apiBase =
            (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
          const userInfoResponse = await fetch(`${apiBase}/api/user/me`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            // Store user data with roles in session manager
            authClient.setAuthData({ token: token || authClient.getToken(), user: userInfo });
            console.log("User info stored:", userInfo);

            // Redirect based on role
            if (userInfo.roles && userInfo.roles.includes("Admin")) {
              window.location.href = "./admin.html";
              return;
            } else {
              window.location.href = "./index.html";
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }

      // Fallback: redirect based on email (backward compatibility)
      setTimeout(() => {
        if (email === "admin@admin.com" || email === "aa@aa.aa" || email === "john@john.com") {
          window.location.href = "./admin.html";
        } else {
          window.location.href = "./index.html#/chat";
        }
      }, 100);
    } else {
      console.log("Login failed:", response.message); // Debug log
      errorMessage.style.display = "block";
      errorMessage.textContent = response.message || "Invalid email or password";
    }
  } catch (error) {
    console.error("Login error:", error); // Debug log
    errorMessage.style.display = "block";
    errorMessage.textContent = "An error occurred. Please try again.";
  }
});

// Check if user is already logged in
window.addEventListener("load", async () => {
  const token = authClient.getToken();
  if (token) {
    try {
      const usage = await authClient.getApiUsage();
      if (usage.success) {
        usageInfo.style.display = "block";
        apiCallsSpan.textContent = usage.calls;
      }
    } catch (error) {
      console.error("Failed to fetch API usage:", error);
    }
  }
});

