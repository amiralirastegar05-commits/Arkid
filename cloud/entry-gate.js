// Run before the hub's game code: it creates local progress during startup.
// Conservative prefixes deliberately include unknown older game keys. Never
// decide that a browser with possible game data is safe to overwrite.
(function () {
  'use strict';
  try {
    const potentialGameKey = /^(?:arcade_|arkid_cloud_|2048_|ast_|bk_|mk_|mp_|rr_|pong_|snake_|si_|tr_|arcade-runner_|ar_tutorial_|GameRunnerSave$)/;
    for (let i = 0; i < localStorage.length; i++) {
      if (potentialGameKey.test(localStorage.key(i) || '')) return;
    }
    document.documentElement.dataset.arkidEntry = 'pending';
    window.arkidEntryGate = new Promise(resolve => {
      window.arkidShowEntryGate = () => {
        const gate = document.getElementById('arkidEntryGate');
        const start = document.getElementById('arkidEntryStart');
        if (!gate || !start) { delete document.documentElement.dataset.arkidEntry; resolve(); return; }
        gate.hidden = false;
        start.addEventListener('click', () => {
          gate.hidden = true;
          delete document.documentElement.dataset.arkidEntry;
          resolve();
        }, { once: true });
      };
    });
  } catch (_) {
    // Storage unavailable: do not block offline play.
  }
})();
