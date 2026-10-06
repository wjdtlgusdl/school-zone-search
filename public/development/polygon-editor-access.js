(() => {
  const btn = document.getElementById("polygonEditorBtn");
  const title = document.querySelector("header h1");
  if (!btn || !title) return;

  let clicks = [];
  const reveal = () => {
    btn.hidden = false;
    btn.style.display = "inline-flex";
  };

  title.addEventListener("click", () => {
    const now = Date.now();
    clicks = clicks.filter(t => now - t < 3000);
    clicks.push(now);
    if (clicks.length >= 5) {
      reveal();
      clicks = [];
    }
  });

  let keys = [];
  document.addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || "")) return;
    if ((e.key || "").toLowerCase() !== "e") return;
    const now = Date.now();
    keys = keys.filter(t => now - t < 3000);
    keys.push(now);
    if (keys.length >= 5) {
      reveal();
      keys = [];
    }
  });

  btn.addEventListener("click", () => {
    window.open("/tools/개발사업_폴리곤편집기.html", "_blank", "noopener");
  });
})();