/* Бай-Тандыр · VK-бот — интерактивная песочница.
   Порт логики bot/bot.py 1:1: меню, корзина, шаги оформления, статусы, владелец.
   Тексты и клавиатуры совпадают с реальным ботом (сверено автотестом диалога). */
(function () {
  "use strict";

  var SHOP = window.SHOP, MENU = window.MENU, ALL = window.ALL_ITEMS;
  var NEXT_ORDER = 1024; // как на скринах демо

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "\u00a0₽";
  }
  function trunc(s, n) { return s.length <= n ? s : s.slice(0, n - 1) + "…"; }

  /* ---------------- корзина (порт cart.py) ---------------- */
  function Cart() { this.items = {}; }
  Cart.prototype.add = function (id, q) {
    q = q || 1;
    this.items[id] = (this.items[id] || 0) + q;
    return this.items[id];
  };
  Cart.prototype.dec = function (id) {
    if (!this.items[id]) return 0;
    this.items[id] -= 1;
    if (this.items[id] <= 0) { delete this.items[id]; return 0; }
    return this.items[id];
  };
  Cart.prototype.count = function () {
    var s = 0; for (var k in this.items) s += this.items[k]; return s;
  };
  Cart.prototype.total = function () {
    var s = 0; for (var k in this.items) s += ALL[k].price * this.items[k]; return s;
  };
  Cart.prototype.rows = function () {
    var out = [], self = this;
    Object.keys(ALL).forEach(function (k) {
      if (self.items[k]) out.push([ALL[k], self.items[k], ALL[k].price * self.items[k]]);
    });
    return out;
  };
  Cart.prototype.isEmpty = function () { return this.count() === 0; };
  Cart.prototype.text = function (title) {
    title = title || "🛒 Ваш заказ";
    if (this.isEmpty()) return title + "\n\nПока пусто. Добавьте что-нибудь из меню 😋";
    var lines = [title, ""], self = this;
    this.rows().forEach(function (r) {
      lines.push("• " + r[0].name + " × " + r[1] + " — " + fmt(r[2]));
    });
    lines.push("");
    lines.push("Итого: " + fmt(self.total()));
    return lines.join("\n");
  };

  /* ---------------- состояние ---------------- */
  function newRole() {
    return { chat: [], kb: [], cart: new Cart(), step: null, sec: MENU[0].id,
             draft: { delivery: false, name: "", phone: "", address: "", comment: "" } };
  }
  var S = {
    client: newRole(),
    owner: newRole(),
    orders: [],       // {number, items[], total, delivery, name, phone, address, comment, status}
    typing: {},       // role -> bool
  };

  /* ---------------- клавиатуры (порт bot.py) ---------------- */
  function kbMain(role) {
    var c = S[role].cart;
    var label = "🛒 Корзина" + (c.isEmpty() ? "" : " · " + c.count() + " шт · " + c.total() + " ₽");
    var rows = [
      [B("🫓 Из тандыра", "sec", "tandyr"), B("🍖 Мангал", "sec", "mangal")],
      [B("🍲 Горячее", "sec", "hot"), B("🥫 Соусы", "sec", "sauces")],
      [B(label, "cart", null, "g"), B("ℹ️ О заведении", "about")],
    ];
    if (role === "owner") rows.push([B("📋 Активные заказы", "orders")]);
    return rows;
  }
  function B(label, cmd, v, color) { return { label: trunc(label, 40), cmd: cmd, v: v, color: color }; }

  function kbSection(sec) {
    var rows = sec.items.map(function (it) {
      return [B(it.emoji + " " + it.name + " — " + it.price + " ₽", "dish", it.id)];
    });
    rows.push([B("⬅️ В меню", "menu", null, "s"), B("🛒 Корзина", "cart", null, "p")]);
    return rows;
  }
  function kbDish(secId, itemId) {
    return [
      [B("➕ Добавить в корзину", "add", itemId, "g"), B("⬅️ К разделу", "sec", secId, "s")],
      [B("🛒 Корзина", "cart", null, "p")],
    ];
  }
  function kbCart(role) {
    var s = S[role], rows = [];
    s.cart.rows().slice(0, 4).forEach(function (r) {
      rows.push([B("➖ " + r[0].name + " (×" + r[1] + ")", "dec", r[0].id, "s")]);
    });
    if (s.cart.isEmpty()) {
      rows.push([B("⬅️ В меню", "menu", null, "s")]);
    } else {
      rows.push([B("🧹 Очистить", "clear", null, "r"), B("✅ Оформить заказ", "checkout", null, "g")]);
      rows.push([B("⬅️ В меню", "menu", null, "s")]);
    }
    return rows;
  }
  function kbDelivery() {
    return [[B("🏠 Самовывоз", "mode", "pickup", "p"), B("🛵 Доставка", "mode", "delivery", "p")]];
  }
  function kbSkip() { return [[B("⏭ Пропустить", "skip", null, "s")]]; }
  function kbConfirm() {
    return [[B("✅ Подтвердить", "confirm", null, "g"), B("❌ Отменить", "cancel", null, "r")]];
  }
  function kbInline(orderId) {
    return [
      { label: "🍳 Принять", cmd: "adm", a: "accept", id: orderId, cls: "p" },
      { label: "✅ Готово", cmd: "adm", a: "ready", id: orderId, cls: "g" },
      { label: "❌ Отклонить", cmd: "adm", a: "reject", id: orderId, cls: "r" },
    ];
  }

  /* ---------------- тексты (порт bot.py) ---------------- */
  function aboutText() {
    return "🫓 " + SHOP.name + "\n\n📍 " + SHOP.address + "\n🕘 " + SHOP.hours +
           "\n⏱ Готовность: " + SHOP.cookTime + "\n\nХаляль. Тандыр · Мангал · Казан.\n\n" +
           "Это демонстрационный бот: заказы принимаются, но не передаются в работу.";
  }
  function orderSummary(s) {
    var d = s.draft, lines = ["Проверьте заказ:", ""];
    s.cart.rows().forEach(function (r) {
      lines.push("• " + r[0].name + " × " + r[1] + " — " + fmt(r[2]));
    });
    lines.push(""); lines.push("Итого: " + fmt(s.cart.total()));
    lines.push(""); lines.push("👤 " + d.name); lines.push("📞 " + d.phone);
    lines.push(d.delivery ? "🛵 Доставка: " + d.address : "🏠 Самовывоз: " + SHOP.address);
    if (d.comment) lines.push("💬 " + d.comment);
    return lines.join("\n");
  }
  function orderForOwner(o) {
    var lines = ["🆕 Заказ №" + o.number, "👤 " + o.name, "📞 " + o.phone,
                 o.delivery ? "🛵 Доставка: " + o.address : "🏠 Самовывоз"];
    if (o.comment) lines.push("💬 «" + o.comment + "»");
    lines.push("—");
    o.items.forEach(function (r) {
      lines.push("• " + r[0].name + " × " + r[1] + " — " + fmt(r[2]));
    });
    lines.push("Итого: " + fmt(o.total));
    return lines.join("\n");
  }
  var STATUS_EMOJI = { pending: "🆕", accepted: "🍳", cooking: "🍳" };
  function activeOrdersText() {
    var act = S.orders.filter(function (o) { return o.status === "pending" || o.status === "accepted" || o.status === "cooking"; });
    if (!act.length) return "Активных заказов нет ✅";
    var out = ["📋 Активные заказы:", ""];
    act.slice(0, 10).forEach(function (o) {
      out.push((STATUS_EMOJI[o.status] || "•") + " №" + o.number + " — " + o.name + ", " + o.phone + " — " + o.total + " ₽ (" + o.status + ")");
    });
    return out.join("\n");
  }

  /* ---------------- отрисовка ---------------- */
  var dom = {};
  function initDom() {
    ["client", "owner"].forEach(function (role) {
      dom[role] = {
        chat: document.getElementById(role + "Chat"),
        kb: document.getElementById(role + "Kb"),
        input: document.getElementById(role + "Input"),
        frame: document.getElementById(role + "Frame"),
      };
    });
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (x) { x.classList.remove("on"); });
        t.classList.add("on");
        document.body.setAttribute("data-tab", t.getAttribute("data-role"));
        if (t.getAttribute("data-role") === "owner") clearBadge();
      });
    });
    document.querySelectorAll(".reset").forEach(function (b) {
      b.addEventListener("click", function () { location.reload(); });
    });
    ["client", "owner"].forEach(function (role) {
      var inp = dom[role].input;
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && inp.value.trim()) {
          var t = inp.value.trim(); inp.value = "";
          userText(role, t);
        }
      });
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render(role) {
    var box = dom[role].chat, s = S[role];
    var html = "";
    s.chat.forEach(function (m) {
      if (m.who === "note") { html += '<div class="note">' + esc(m.text) + "</div>"; return; }
      var cls = "msg" + (m.who === "me" ? " me" : "");
      html += '<div class="' + cls + '">';
      if (m.photo) html += '<img class="photo" src="img/' + m.photo + '" alt="">';
      html += esc(m.text).replace(/\n/g, "<br>");
      if (m.inline) {
        html += '<div class="inl">';
        m.inline.forEach(function (b, i) {
          html += '<button class="seg ' + (b.cls || "") + '" data-role="' + role + '" data-cmd="' + b.cmd +
                  '" data-a="' + b.a + '" data-id="' + b.id + '">' + esc(b.label) + "</button>";
        });
        html += "</div>";
      }
      html += "</div>";
    });
    if (S.typing[role]) {
      html += '<div class="msg typing"><span></span><span></span><span></span></div>';
    }
    box.innerHTML = html;

    var kbHtml = '<div class="kbi">';
    s.kb.forEach(function (row) {
      kbHtml += '<div class="row">';
      row.forEach(function (b) {
        kbHtml += '<button class="b ' + (b.color || "") + '" data-role="' + role + '" data-cmd="' + b.cmd +
                  '" data-v="' + (b.v === null || b.v === undefined ? "" : b.v) + '">' + esc(b.label) + "</button>";
      });
      kbHtml += "</div>";
    });
    kbHtml += "</div>";
    dom[role].kb.innerHTML = kbHtml;
    box.scrollTop = box.scrollHeight;
  }

  function push(role, who, text, extra) {
    var m = { who: who, text: text };
    if (extra) { for (var k in extra) m[k] = extra[k]; }
    S[role].chat.push(m);
    render(role);
  }
  function setKb(role, kb) { S[role].kb = kb; }

  function badge(n) {
    var t = document.querySelector('.tab[data-role="owner"]');
    if (!t) return;
    var b = t.querySelector(".badge");
    if (n > 0) { b.hidden = false; b.textContent = n; } else { b.hidden = true; }
  }
  function clearBadge() {
    S.ownerUnseen = 0;
    badge(0);
  }
  function bumpBadge() {
    S.ownerUnseen = (S.ownerUnseen || 0) + 1;
    badge(S.ownerUnseen);
  }

  /* ответ бота с «печатает…» */
  function botReply(role, fn) {
    S.typing[role] = true;
    render(role);
    setTimeout(function () {
      S.typing[role] = false;
      fn();
      render(role);
    }, 420 + Math.random() * 260);
  }

  /* ---------------- логика: клиент (порт router/handle_step) ---------------- */
  var NAV = { menu: 1, cart: 1, sec: 1, dish: 1, about: 1 };

  function clientAction(cmd, v, text) {
    var s = S.client;

    if (s.step && s.step !== "mode") {
      if (handleStep(s, cmd, text)) return;
    }
    if (cmd === "sec") { var sec = findSec(v); return botReply("client", function () { showSection(sec); }); }
    if (cmd === "dish") { return botReply("client", function () { showDish(parseInt(v, 10)); }); }
    if (cmd === "add") {
      var it = ALL[parseInt(v, 10)];
      if (it) botReply("client", function () {
        s.cart.add(it.id);
        push("client", "bot", "➕ " + it.name + " добавлено.\n\n" + s.cart.text());
        setKb("client", kbDish(secOf(it.id), it.id));
      });
      return;
    }
    if (cmd === "dec") {
      var it2 = ALL[parseInt(v, 10)];
      if (it2) botReply("client", function () {
        var left = s.cart.dec(it2.id);
        push("client", "bot", "➖ " + it2.name + ": " + (left ? "осталось " + left + " шт" : "убрано из корзины"));
        setKb("client", kbCart("client"));
      });
      return;
    }
    if (cmd === "clear") { botReply("client", function () { s.cart = new Cart(); showCart(); }); return; }
    if (cmd === "cart") { botReply("client", function () { showCart(); }); return; }
    if (cmd === "checkout") {
      botReply("client", function () {
        if (s.cart.isEmpty()) return showCart();
        s.step = "mode"; s.draft.delivery = false;
        push("client", "bot", "Как вам удобнее получить заказ?");
        setKb("client", kbDelivery());
      });
      return;
    }
    if (cmd === "mode") {
      botReply("client", function () {
        s.draft.delivery = (v === "delivery");
        s.step = "name"; s.kb = [];
        push("client", "bot", "Как вас зовут? Напишите имя одним сообщением.");
        setKb("client", []);
      });
      return;
    }
    if (cmd === "about") { botReply("client", function () { push("client", "bot", aboutText()); setKb("client", kbMain("client")); }); return; }
    if (cmd === "menu" || cmd === "start") {
      botReply("client", function () {
        s.step = null;
        push("client", "bot", "🫓 Бай-Тандыр — заказ еды (демо)\n\nТандырные лепёшки и самса, шашлык на углях, плов, лагман, манты.\n📍 " +
          SHOP.address + "\n🕘 " + SHOP.hours + "\n\nВыберите раздел 👇");
        setKb("client", kbMain("client"));
      });
      return;
    }
    // текстовый ввод в неожиданном месте — как в боте: показать меню
    botReply("client", function () {
      s.step = null;
      push("client", "bot", "🫓 Бай-Тандыр — заказ еды (демо)\n\nВыберите раздел 👇");
      setKb("client", kbMain("client"));
    });
  }

  function handleStep(s, cmd, text) {
    var d = s.draft;
    if (s.step === "comment" && cmd === "skip") {
      d.comment = ""; s.step = "confirm";
      botReply("client", function () {
        push("client", "bot", orderSummary(s));
        setKb("client", kbConfirm());
      });
      return true;
    }
    if (s.step === "confirm") {
      if (cmd === "confirm") { botReply("client", function () { placeOrder(); }); return true; }
      if (cmd === "cancel") {
        s.step = null;
        botReply("client", function () {
          push("client", "bot", "Оформление отменено. Заказ остался в корзине.");
          setKb("client", kbCart("client"));
        });
        return true;
      }
      return false;
    }
    if (NAV[cmd]) return false;
    if (s.step === "name") {
      if (!text || text.trim().length < 2) {
        botReply("client", function () { push("client", "bot", "Имя слишком короткое. Напишите, пожалуйста, ещё раз."); });
        return true;
      }
      d.name = text.trim(); s.step = "phone";
      botReply("client", function () { push("client", "bot", "Телефон для связи? Например: +7 999 123-45-67"); });
      return true;
    }
    if (s.step === "phone") {
      if (!validPhone(text)) {
        botReply("client", function () { push("client", "bot", "Не похоже на номер 🤔 Напишите в формате +7 999 123-45-67."); });
        return true;
      }
      d.phone = text.trim();
      if (d.delivery) {
        s.step = "address";
        botReply("client", function () { push("client", "bot", "Адрес доставки? Улица, дом, квартира."); });
      } else {
        s.step = "comment";
        botReply("client", function () {
          push("client", "bot", "Комментарий к заказу? Можно пропустить.");
          setKb("client", kbSkip());
        });
      }
      return true;
    }
    if (s.step === "address") {
      if (!text || text.trim().length < 5) {
        botReply("client", function () { push("client", "bot", "Адрес коротковат. Напишите улицу, дом и квартиру."); });
        return true;
      }
      d.address = text.trim(); s.step = "comment";
      botReply("client", function () {
        push("client", "bot", "Комментарий к заказу? Можно пропустить.");
        setKb("client", kbSkip());
      });
      return true;
    }
    if (s.step === "comment") {
      d.comment = text.trim().slice(0, 200); s.step = "confirm";
      botReply("client", function () {
        push("client", "bot", orderSummary(s));
        setKb("client", kbConfirm());
      });
      return true;
    }
    return false;
  }

  function validPhone(p) {
    if (!p) return false;
    var digits = (p.match(/\d/g) || []).length;
    var t = p.trim();
    return digits === 11 && (t.charAt(0) === "+" || t.charAt(0) === "7" || t.charAt(0) === "8");
  }

  function showSection(sec) {
    var s = S.client; s.sec = sec.id; s.step = null;
    var lines = [sec.emoji + " " + sec.title + " — " + sec.sub, ""];
    sec.items.forEach(function (it) { lines.push(it.emoji + " " + it.name + " — " + fmt(it.price)); });
    lines.push(""); lines.push("Нажмите блюдо, чтобы посмотреть и добавить.");
    push("client", "bot", lines.join("\n"));
    setKb("client", kbSection(sec));
  }
  function showDish(id) {
    var it = ALL[id]; if (!it) return;
    var s = S.client; s.step = null;
    var qty = s.cart.items[id] || 0;
    push("client", "bot", it.emoji + " " + it.name + " — " + fmt(it.price) + "\n\n" + it.desc +
      "\n\n" + (qty ? "В корзине: " + qty : "В корзине пока нет"), { photo: it.photo });
    setKb("client", kbDish(secOf(id), id));
  }
  function showCart() {
    var s = S.client;
    push("client", "bot", s.cart.text());
    setKb("client", kbCart("client"));
  }
  function secOf(itemId) {
    for (var i = 0; i < MENU.length; i++) {
      for (var j = 0; j < MENU[i].items.length; j++) {
        if (MENU[i].items[j].id === itemId) return MENU[i].id;
      }
    }
    return MENU[0].id;
  }
  function findSec(id) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return MENU[0];
  }

  function placeOrder() {
    var s = S.client, d = s.draft;
    var o = {
      number: NEXT_ORDER++, items: s.cart.rows(), total: s.cart.total(),
      delivery: d.delivery, name: d.name, phone: d.phone, address: d.address,
      comment: d.comment, status: "pending",
    };
    S.orders.push(o);
    s.step = null; s.cart = new Cart();
    push("client", "bot", "✅ Заказ №" + o.number + " принят!\n\nМы позвоним на " + o.phone +
      " для подтверждения.\nГотовность ~ " + SHOP.cookTime + ".\n\nСпасибо! 🧡");
    setKb("client", kbMain("client"));
    // владельцу
    push("owner", "bot", orderForOwner(o), { inline: kbInline(o.number) });
    setKb("owner", [[B("📋 Активные заказы", "orders")]]);
    bumpBadge();
  }

  /* ---------------- логика: владелец ---------------- */
  function ownerAction(cmd, v, a, id, text) {
    if (cmd === "orders") {
      botReply("owner", function () {
        push("owner", "bot", activeOrdersText());
        setKb("owner", [[B("📋 Активные заказы", "orders")]]);
      });
      return;
    }
    if (cmd === "adm") {
      var o = null;
      S.orders.forEach(function (x) { if (x.number === parseInt(id, 10)) o = x; });
      if (!o) return;
      botReply("owner", function () {
        if (a === "accept") {
          o.status = "accepted";
          push("owner", "bot", "Заказ №" + o.number + " принят в работу 🍳");
          push("client", "bot", "👨‍🍳 Ваш заказ №" + o.number + " принят и готовится!\nГотовность ~ " + SHOP.cookTime + ".");
        } else if (a === "ready") {
          o.status = "ready";
          push("owner", "bot", "Заказ №" + o.number + " отмечен готовым ✅");
          var extra = o.delivery ? "Курьер выехал к вам 🛵" : ("Ждём вас: " + SHOP.address + " 🏠");
          push("client", "bot", "🎉 Ваш заказ №" + o.number + " готов!\n" + extra);
        } else if (a === "reject") {
          o.status = "cancelled";
          push("owner", "bot", "Заказ №" + o.number + " отклонён ❌");
          push("client", "bot", "😔 К сожалению, заказ №" + o.number + " отклонён.\nСвяжитесь с нами для уточнения.");
        }
        render("client");
      });
      return;
    }
    // любой текст владельца
    botReply("owner", function () {
      push("owner", "bot", "👑 Вы вошли как владелец.\n\nЗдесь приходят заказы. Кнопка ниже — список активных.");
      setKb("owner", [[B("📋 Активные заказы", "orders")]]);
    });
  }

  /* ---------------- ввод ---------------- */
  function userText(role, text) {
    push(role, "me", text);
    if (role === "client") clientAction(null, null, text);
    else ownerAction(null, null, null, null, text);
  }

  function onButton(role, el) {
    var cmd = el.getAttribute("data-cmd");
    var v = el.getAttribute("data-v");
    var a = el.getAttribute("data-a");
    var id = el.getAttribute("data-id");
    if (role === "client" && cmd === "sec") return clientAction("sec", v);
    if (role === "client" && cmd === "dish") return clientAction("dish", v);
    if (role === "client") return clientAction(cmd, v);
    return ownerAction(cmd, v, a, id);
  }

  /* ---------------- старт ---------------- */
  function boot() {
    initDom();
    document.addEventListener("click", function (e) {
      var el = e.target.closest("button[data-cmd]");
      if (!el) return;
      onButton(el.getAttribute("data-role"), el);
    });
    // стартовые сцены
    botReply("client", function () {
      push("client", "bot", "🫓 Бай-Тандыр — заказ еды (демо)\n\nТандырные лепёшки и самса, шашлык на углях, плов, лагман, манты.\n📍 " +
        SHOP.address + "\n🕘 " + SHOP.hours + "\n\nВыберите раздел 👇");
      setKb("client", kbMain("client"));
    });
    setTimeout(function () {
      push("owner", "note", "👑 Кабинет владельца. Нажмите «Начать» или сразу закажите что-нибудь у клиента — заказ упадёт сюда.");
      setKb("owner", [[B("Начать", "start", null, "p")], [B("📋 Активные заказы", "orders")]]);
    }, 650);
    var firstTab = document.querySelector('.tab[data-role="client"]');
    if (firstTab) firstTab.classList.add("on");
    document.body.setAttribute("data-tab", "client");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__SANDBOX = {
    state: S,
    clientAction: clientAction,
    ownerAction: ownerAction,
    userText: userText,
    orderCount: function () { return S.orders.length; },
    activeCount: function () {
      return S.orders.filter(function (o) { return ["pending", "accepted", "cooking"].indexOf(o.status) >= 0; }).length;
    },
    lastOrder: function () { return S.orders[S.orders.length - 1] || null; },
    clientKb: function () { return S.client.kb; },
  };
})();
