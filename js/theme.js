/**
 * Theme handling: "system" follows prefers-color-scheme; "light"/"dark" are
 * explicit manual overrides. Applied via a data-theme attribute on <html>.
 */
const Theme = {
  apply() {
    const theme = Store.data.theme || "system";
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    this.updateToggleLabel();
  },

  cycle() {
    const order = ["system", "light", "dark"];
    const current = Store.data.theme || "system";
    const next = order[(order.indexOf(current) + 1) % order.length];
    Store.update((d) => {
      d.theme = next;
    });
    this.apply();
  },

  updateToggleLabel() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const theme = Store.data.theme || "system";
    const icons = { system: "\u{1F5A5}️ Auto", light: "☀️ Light", dark: "\u{1F319} Dark" };
    btn.textContent = icons[theme];
  },

  init() {
    this.apply();
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", () => this.cycle());
  },
};
