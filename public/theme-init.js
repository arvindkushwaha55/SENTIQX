// Apply the saved theme before first paint so there is no flash of the
// wrong theme. Kept as an external file (not inline) so the app can run
// under a strict Content-Security-Policy without 'unsafe-inline' scripts.
try {
  if (localStorage.getItem("sentiqx.theme") === "bright") {
    document.documentElement.dataset.theme = "bright";
  }
} catch (e) {}
