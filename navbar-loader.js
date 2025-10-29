// navbar-loader.js
document.addEventListener("DOMContentLoaded", () => {
  fetch("navbar.html")
    .then(response => {
      if (!response.ok) throw new Error("Failed to load navbar");
      return response.text();
    })
    .then(html => {
      document.getElementById("navbar-container").innerHTML = html;
    })
    .catch(err => console.error("Navbar load error:", err));
});
