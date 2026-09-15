/**
 * Shared bootstrap — runs on every page, owns whatever must behave identically no matter which
 * page loaded first: nav, theme, and the points badge.
 */
const Shell = {
  init() {
    Nav.render(location.pathname);
    Theme.init(); // must run after Nav.render() creates #theme-toggle
    Nav.updatePointsBadge();
  },
};

document.addEventListener("DOMContentLoaded", () => Shell.init());
