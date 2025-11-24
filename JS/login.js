class LoginPage {
  constructor(authClient) {
    this.authClient = authClient;
    this.loginForm = document.getElementById("loginForm");
    this.errorMessage = document.getElementById("errorMessage");
    this.usageInfo = document.getElementById("usageInfo");
    this.apiCallsSpan = document.getElementById("apiCalls");
    this.forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    this.forgotPasswordMsg = document.getElementById("forgotPasswordMsg");

    this._bindEvents();
    // On load, check API usage if already authenticated
    window.addEventListener("load", async () => this._checkUsage());
  }

  _bindEvents() {
    if (this.forgotPasswordBtn) {
      this.forgotPasswordBtn.addEventListener("click", async () => this._handleForgot());
    }

    if (this.loginForm) {
      this.loginForm.addEventListener("submit", async (e) => this._handleSubmit(e));
    }
  }

  async _handleForgot() {
    const email = prompt("Enter your email to reset password:");
    if (!email) return;
    this.forgotPasswordBtn.disabled = true;
    if (this.forgotPasswordMsg) this.forgotPasswordMsg.style.display = "none";
    try {
      const resp = await this.authClient.sendPasswordReset(email);
      if (resp.success) {
        this.forgotPasswordMsg.textContent = "Password reset link sent! Check your email.";
        this.forgotPasswordMsg.style.display = "inline-block";
      } else {
        this.forgotPasswordMsg.textContent = resp.message || "Failed to send reset link.";
        this.forgotPasswordMsg.style.display = "inline-block";
      }
    } catch (err) {
      this.forgotPasswordMsg.textContent = "Error sending reset link.";
      this.forgotPasswordMsg.style.display = "inline-block";
    }
    this.forgotPasswordBtn.disabled = false;
  }

  async _handleSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    console.log("=== LOGIN ATTEMPT ===");
    console.log("Email:", email);
    console.log("Config:", window.APP_CONFIG);

    try {
      const response = await this.authClient.login(email, password);
      console.log("Login response:", response);

      if (response.success) {
        console.log("✓ Login successful");
        if (this.loginForm) {
          this.loginForm.querySelectorAll("input, button").forEach((el) => {
            el.disabled = true;
          });
        }

        const token = response.token || this.authClient.getToken();
        if (!token) {
          console.error("✗ No token after login");
          if (this.errorMessage) {
            this.errorMessage.style.display = "block";
            this.errorMessage.textContent = "Login failed: No token received. Check browser console.";
          }
          return;
        }

        console.log("✓ Token obtained, fetching user info...");
        
        try {
          const apiBase =
            (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || "http://localhost:5157";
          const userMeUrl = `${apiBase}/api/user/me`;
          console.log("Fetching from:", userMeUrl);
          
          const userInfoResponse = await fetch(userMeUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          console.log("User info response:", userInfoResponse.status, userInfoResponse.statusText);
          
          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            console.log("✓ User info retrieved:", userInfo);
            
            this.authClient.setAuthData({
              token: token,
              user: userInfo,
            });

            // Redirect based on role
            if (userInfo.roles && userInfo.roles.includes("Admin")) {
              console.log("→ Redirecting to admin.html");
              window.location.href = "./admin.html";
            } else {
              console.log("→ Redirecting to index.html");
              window.location.href = "./index.html";
            }
          } else {
            const errorText = await userInfoResponse.text();
            console.warn("✗ Failed to fetch user info:", userInfoResponse.status, errorText);
            console.log("→ Using fallback redirect based on email");
            
            // Fallback redirect based on email
            if (email === "admin@admin.com") {
              window.location.href = "./admin.html";
            } else {
              window.location.href = "./index.html";
            }
          }
        } catch (error) {
          console.error("✗ Error fetching user info:", error);
          console.log("→ Proceeding with fallback redirect");
          window.location.href = "./index.html";
        }
      } else {
        console.log("✗ Login failed:", response.message);
        if (this.errorMessage) {
          this.errorMessage.style.display = "block";
          this.errorMessage.textContent = response.message || "Invalid email or password";
        }
      }
    } catch (error) {
      console.error("✗ Login exception:", error);
      if (this.errorMessage) {
        this.errorMessage.style.display = "block";
        this.errorMessage.textContent = "An error occurred. Check browser console for details.";
      }
    }
  }

  async _checkUsage() {
    const token = this.authClient.getToken();
    if (token && this.usageInfo && this.apiCallsSpan) {
      try {
        const usage = await this.authClient.getApiUsage();
        if (usage.success) {
          this.usageInfo.style.display = "block";
          this.apiCallsSpan.textContent = usage.calls;
        }
      } catch (error) {
        console.error("Failed to fetch API usage:", error);
      }
    }
  }
}

// Initialize when DOM is ready. Auth client is loaded before this script in login.html,
// but wait briefly if it's not immediately available.
document.addEventListener("DOMContentLoaded", () => {
  const start = () => {
    if (window.authClient) {
      const instance = new LoginPage(window.authClient);
      window.login = instance;
    } else {
      // poll briefly
      let tries = 0;
      const max = 10;
      const wait = () => {
        if (window.authClient || tries++ >= max) {
          const instance = new LoginPage(
            window.authClient || { login: async () => ({ success: false }) }
          );
          window.login = instance;
        } else setTimeout(wait, 100);
      };
      wait();
    }
  };

  start();
});
