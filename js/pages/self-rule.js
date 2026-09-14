/** Self-rule page: the points-formula explainer and the rewards catalog. */
(function () {
  function renderFormula() {
    const p = Store.data.profile;
    const tags = p.focusTags && p.focusTags.length ? p.focusTags.join(", ") : "none set";
    $("formula-focus-tags").textContent = tags;
    $("formula-start-date").textContent = p.gamificationStart ? new Date(p.gamificationStart).toLocaleDateString() : "not set";
  }

  function renderRewards() {
    RewardsUI.render($("rewards-list"), $("redemption-history"));
  }

  function wireRewardsForm() {
    $("add-reward-form").addEventListener("submit", (evt) => {
      evt.preventDefault();
      const name = $("reward-name-input").value.trim();
      const cost = Number($("reward-cost-input").value);
      if (!name || !cost || cost <= 0) return;
      Gamification.addReward(name, Math.round(cost));
      evt.target.reset();
      renderRewards();
    });
  }

  function refresh() {
    renderFormula();
    renderRewards();
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireRewardsForm();
    refresh();
  });
  document.addEventListener("icpc:auth-changed", refresh);
})();
