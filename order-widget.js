/* Виджет «Заказать онлайн» для любого сайта (в т.ч. сайта-меню tandyr-menu).
 *
 * Подключение на странице (2 строки перед </body>):
 *   <script>window.TANDRY_WIDGET = { url: "https://ilfat1346-sys.github.io/vk-tandyr/?src=site" };</script>
 *   <script src="https://ilfat1346-sys.github.io/vk-tandyr/order-widget.js" defer></script>
 *
 * Все заказы уходят в единую админку (AdminHub) с пометкой «сайт».
 * Опции: url, label, side ("left"/"right"), color, textColor, mode ("tab"/"modal").
 */
(function () {
  var cfg = window.TANDRY_WIDGET || {};
  var url = cfg.url || "https://ilfat1346-sys.github.io/vk-tandyr/?src=site";
  var label = cfg.label || "🛒 Заказать";
  var side = cfg.side === "left" ? "left" : "right";
  var bg = cfg.color || "#e0ba48";
  var fg = cfg.textColor || "#1a1a1a";

  function modal() {
    var back = document.createElement("div");
    back.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483001;display:flex;" +
      "align-items:center;justify-content:center;padding:12px;";
    var frame = document.createElement("iframe");
    frame.src = url;
    frame.style.cssText = "width:100%;max-width:420px;height:92%;border:0;border-radius:14px;background:#0d0d0d;";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "✕";
    close.setAttribute("aria-label", "Закрыть");
    close.style.cssText = "position:absolute;top:14px;right:16px;background:#222;color:#fff;border:0;border-radius:50%;" +
      "width:38px;height:38px;font-size:17px;cursor:pointer;z-index:2;";
    close.onclick = function () { back.remove(); };
    back.appendChild(frame);
    back.appendChild(close);
    back.onclick = function (e) { if (e.target === back) back.remove(); };
    document.body.appendChild(back);
  }

  function open() {
    if (cfg.mode === "modal") { modal(); } else { window.open(url, "_blank"); }
  }

  function make() {
    if (document.getElementById("tandyrOrderBtn")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.id = "tandyrOrderBtn";
    b.textContent = label;
    b.style.cssText = "position:fixed;bottom:" + (cfg.bottom || "18px") + ";" + side + ":" + (cfg.offset || "16px") + ";" +
      "z-index:2147483000;background:" + bg + ";color:" + fg + ";border:0;border-radius:24px;" +
      "padding:13px 22px;font:600 15px/1 system-ui,-apple-system,sans-serif;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer;";
    b.onclick = open;
    document.body.appendChild(b);
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", make); } else { make(); }
  window.TANDRY_WIDGET_OPEN = open;
})();
