/**
 * Roadmap page: the full checklist, locked behind Codeforces verification — same
 * verified-gates-the-real-content pattern as self-rule.js's points/rewards lock, applied here so
 * checking off topics isn't possible before you've proven the handle is yours (previously the only
 * thing verification gated was points; the roadmap checklist itself was editable by anyone with no
 * check at all, which read as a bug once points/rewards already worked this way).
 */
(function () {
  function applyLockState() {
    // Show the "roadmap is locked/sign in" notice if they aren't signed in, OR if they are signed in but haven't verified a handle yet.
    const canTrack = Auth.isSignedIn() && Store.isLoaded() && Boolean(Store.data.profile.cfVerified);
    
    const card = $("roadmap-locked-card");
    card.hidden = canTrack;
    
    if (!canTrack) {
      if (!Auth.isSignedIn()) {
        card.innerHTML = `
          <h2>Sign in to track progress</h2>
          <p class="card-subtitle">
            The full roadmap is visible below, but you need to <a href="dashboard.html">sign in</a> with a Codeforces handle to check things off and track your progress.
          </p>
        `;
      } else {
        card.innerHTML = `
          <h2>Roadmap is locked</h2>
          <p class="card-subtitle">
            Verify your Codeforces handle on the <a href="dashboard.html">Dashboard</a> to track your roadmap progress here.
          </p>
        `;
      }
    }
    
    // The roadmap itself is now always visible, read-only if not signed in/verified
    $("roadmap-root").hidden = false;
  }

  function render() {
    applyLockState();
    // Re-rendering on Auth change but before Store is loaded causes a flash of 0%. 
    // We only skip rendering if they ARE signed in but Store is NOT loaded yet.
    // If they aren't signed in at all, we render immediately.
    if (Auth.isSignedIn() && !Store.isLoaded()) return; 
    Roadmap.render($("roadmap-root"));
  }
  document.addEventListener("DOMContentLoaded", async () => {
    await Shell.ready;
    render();
  });

  // Sign-in/out, another device syncing, a focus-triggered refetch — see storage.js/shell.js.
  document.addEventListener("icpc:external-data-change", render);
})();
