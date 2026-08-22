/**
 * タブ切替の共通制御。
 * 各タブ固有の処理は js/tabs/ 配下のモジュールが担当する。
 */
(() => {
  const tabButtons = document.querySelectorAll("[data-tab-target]");

  function activateTab(targetPanelId) {
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === targetPanelId);
    });
    tabButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tabTarget === targetPanelId);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tabTarget));
  });
})();
