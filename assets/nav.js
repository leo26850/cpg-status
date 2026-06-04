(function () {
  const buttons = Array.from(document.querySelectorAll(".sidebar nav button[data-panel]"));
  const panels = Array.from(document.querySelectorAll(".panel[data-panel]"));

  function activate(id) {
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === id));
    buttons.forEach((b) => b.classList.toggle("is-active", b.dataset.panel === id));
    if (window.CPGCharts && typeof window.CPGCharts.ensure === "function") {
      window.CPGCharts.ensure(id);
    }
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }

  buttons.forEach((b) => b.addEventListener("click", () => activate(b.dataset.panel)));

  const initial = (location.hash || "#overview").slice(1);
  activate(panels.some((p) => p.dataset.panel === initial) ? initial : "overview");
})();
