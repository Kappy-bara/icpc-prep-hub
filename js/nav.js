/**
 * Shared top nav, rendered into a <header id="site-nav"> present on every
 * page (same "JS module renders into a container div" pattern as
 * Roadmap.render/Timeline.render elsewhere in this app) — avoids duplicating
 * nav markup across 5 static HTML files.
 */
const Nav = {
  PAGES: [
    { href: "index.html", label: "Home" },
    { href: "dashboard.html", label: "Dashboard" },
    { href: "codeforces.html", label: "Codeforces" },
    { href: "team.html", label: "Team" },
    { href: "roadmap.html", label: "Roadmap" },
    { href: "self-rule.html", label: "Self-rule" },
  ],

  currentPage(pathname) {
    const last = pathname.split("/").pop();
    return last || "index.html";
  },

  render(pathname) {
    const root = $("site-nav");
    if (!root) return;
    const current = this.currentPage(pathname);
    root.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="index.html"><h1>ICPC Prep Hub</h1></a>
        <nav class="site-links" aria-label="Main">
          ${this.PAGES.map((p) => `<a href="${p.href}" class="${p.href === current ? "active" : ""}">${p.label}</a>`).join("")}
        </nav>
        <div class="topbar-actions">
          <span id="points-badge" class="points-badge" title="Point balance">0 pts</span>
          <button id="theme-toggle" class="btn-icon" type="button" aria-label="Toggle theme">Auto</button>
        </div>
      </div>
    `;
  },

  updatePointsBadge() {
    const el = $("points-badge");
    if (el) el.textContent = `${Store.data.points.balance} pts`;
  },
};
