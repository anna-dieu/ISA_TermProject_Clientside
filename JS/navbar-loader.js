// navbar-loader.js -> refactored to NavBarLoader class
class NavBarLoader {
  constructor(containerId = "navbar-container", opts = {}) {
    this.container = document.getElementById(containerId);
    this.attempts = 0;
    this.maxAttempts = opts.maxAttempts || 10;
    this.pollInterval = opts.pollInterval || 100;
  }

  async loadNavbar() {
    if (!this.container) return;

    let navbarFile = "navbar.html";

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

    try {
      const response = await fetch(navbarFile);
      if (!response.ok) throw new Error(`Failed to load ${navbarFile}`);
      const html = await response.text();
      this.container.innerHTML = html;
      this.initAuthLink();
    } catch (err) {
      console.error("Navbar load error:", err);
    }
  }

  initAuthLink() {
    let authLink = this.container.querySelector(".auth-link");
    if (!authLink) authLink = document.querySelector(".auth-link");
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

  checkAuthClient() {
    if (window.authClient || this.attempts >= this.maxAttempts) {
      this.loadNavbar();
      return;
    }
    this.attempts += 1;
    setTimeout(() => this.checkAuthClient(), this.pollInterval);
  }

  init() {
    if (!this.container) return;
    if (window.authClient) {
      this.loadNavbar();
    } else {
      this.checkAuthClient();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loader = new NavBarLoader();
  window.navbarLoader = loader;
  loader.init();
});
