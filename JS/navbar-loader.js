// navbar-loader.js
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("navbar-container");
  if (!container) return;

  // Determine which navbar to load based on user role
  function loadNavbar() {
    let navbarFile = "navbar.html"; // default for regular users

    // Check if user is admin via authClient
    if (window.authClient) {
      try {
        const user = window.authClient.getUser();
        if (user && (user.isAdmin || (user.roles && user.roles.includes("Admin")))) {
          navbarFile = "adminNavBar.html";
        }
      } catch (err) {
        console.warn("Could not check user admin status:", err);
      }
    }

    // Fetch and insert the appropriate navbar
    fetch(navbarFile)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${navbarFile}`);
        return response.text();
      })
      .then((html) => {
        container.innerHTML = html;
        initAuthLink();
      })
      .catch((err) => console.error("Navbar load error:", err));
  }

  // Initialize the auth link (Login/Logout) based on authentication state
  function initAuthLink() {
    const authLink = container.querySelector(".auth-link") || document.querySelector(".auth-link");
    if (!authLink) return;

    if (window.authClient && window.authClient.isAuthenticated()) {
      authLink.textContent = "Sign Out";
      authLink.href = "#";
      authLink.onclick = (e) => {
        e.preventDefault();
        window.authClient.logout();
      };
    } else {
      authLink.textContent = "Login";
      authLink.href = "login.html";
    }
  }

  // If authClient is already available, load navbar immediately
  if (window.authClient) {
    loadNavbar();
  } else {
    // Wait briefly for authClient to be available, then load navbar
    let attempts = 0;
    const maxAttempts = 10;

    const checkAuthClient = () => {
      if (window.authClient || attempts >= maxAttempts) {
        loadNavbar();
      } else {
        attempts++;
        setTimeout(checkAuthClient, 100);
      }
    };

    checkAuthClient();
  }
});
