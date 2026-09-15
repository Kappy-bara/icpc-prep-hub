/** Team page: wires the 3-handle form to TeamAnalysis, nothing else. */
(function () {
  function setStatus(msg, kind) {
    const el = $("team-status");
    el.textContent = msg;
    el.className = `sync-status ${kind || ""}`;
  }

  function prefillOwnHandle() {
    const handle = Store.data.profile.cfHandle;
    const input = $("team-handle-1");
    if (handle && !input.value) input.value = handle;
  }

  function wireForm() {
    const btn = $("team-analyze-btn");
    $("team-analyze-form").addEventListener("submit", async (evt) => {
      evt.preventDefault();
      const handles = [$("team-handle-1").value, $("team-handle-2").value, $("team-handle-3").value];
      btn.disabled = true;
      setStatus("Fetching handles…", "");
      $("team-results-root").innerHTML = "";

      const result = await TeamAnalysis.analyze(handles);
      btn.disabled = false;

      if (!result.ok) {
        setStatus(result.error, "error");
        return;
      }
      setStatus(`Analyzed ${result.members.length} handles.`, "success");
      TeamAnalysis.render($("team-results-root"));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    prefillOwnHandle();
    wireForm();
  });

  document.addEventListener("icpc:auth-changed", () => {
    prefillOwnHandle();
  });
})();
