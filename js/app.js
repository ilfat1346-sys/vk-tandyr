/* Бай-Тандыр · VK Mini App — логика
   Работает и внутри ВКонтакте (vk-bridge), и как обычная веб-страница (демо-режим). */
(function () {
  "use strict";

  var SHOP = window.SHOP, MENU = window.MENU, ALL = window.ALL_ITEMS;

  /* ---------- состояние ---------- */
  var state = {
    cart: {},          // itemId -> qty
    cat: MENU[0].id,
    dishQty: 1,        // количество в модалке блюда
    dishId: null,
    delivery: false,   // false = самовывоз
    form: { name: "", phone: "", address: "", comment: "", agree: false },
    orderCounter: 1024,
    inVK: false,
    userName: "",
    userId: null,
    lastOrder: null,
    statusTimer: null,
  };

  var LS_CART = "td_cart_v1", LS_CNT = "td_cnt_v1", LS_FORM = "td_form_v1";

  try { state.cart = JSON.parse(localStorage.getItem(LS_CART) || "{}") || {}; } catch (e) { state.cart = {}; }
  try { state.orderCounter = parseInt(localStorage.getItem(LS_CNT) || "1024", 10) || 1024; } catch (e) {}
  try { state.form = Object.assign(state.form, JSON.parse(localStorage.getItem(LS_FORM) || "{}") || {}); state.form.agree = false; } catch (e) {}

  function saveCart() { try { localStorage.setItem(LS_CART, JSON.stringify(state.cart)); } catch (e) {} }
  function saveForm() { try { localStorage.setItem(LS_FORM, JSON.stringify(state.form)); } catch (e) {} }

  /* ---------- утилиты ---------- */
  function rub(n) { return n.toLocaleString("ru-RU") + " ₽"; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined && html !== null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.hidden = true; }, 250);
    }, 1600);
  }
  function haptic(style) {
    if (!state.inVK || !window.vkBridge) return;
    try { window.vkBridge.send("VKWebAppTapticImpactOccurred", { style: style || "light" }); } catch (e) {}
  }

  /* ---------- корзина ---------- */
  function cartCount() {
    var n = 0; for (var k in state.cart) n += state.cart[k];
    return n;
  }
  function cartSum() {
    var s = 0;
    for (var k in state.cart) { if (ALL[k]) s += ALL[k].price * state.cart[k]; }
    return s;
  }
  function setQty(id, q) {
    q = Math.max(0, q | 0);
    if (q === 0) delete state.cart[id]; else state.cart[id] = q;
    saveCart();
    renderCartbar();
    if (!$("cartScreen").hidden) renderCartScreen();
    if (!$("dishSheet").hidden && state.dishId === "" + id) renderDishSheet(id, true);
    document.querySelectorAll('.btn-add[data-id="' + id + '"]').forEach(function (b) {
      var inCart = state.cart[id] ? state.cart[id] : 0;
      b.textContent = inCart ? inCart : "+";
      b.classList.toggle("in-cart", !!inCart);
    });
  }
  function addToCart(id, q) {
    q = q === undefined ? 1 : q;
    setQty(id, (state.cart[id] || 0) + q);
    haptic("light");
  }
  function clearCart() {
    state.cart = {};
    saveCart();
    renderCartbar();
    renderCartScreen();
  }

  /* ---------- рендер: шапка/подвал ---------- */
  function renderStatic() {
    $("shopInfo").innerHTML =
      "<span>📍 <b>" + esc(SHOP.address) + "</b></span>" +
      "<span>🕘 <b>" + esc(SHOP.hours) + "</b></span>" +
      "<span>⏱ <b>" + esc(SHOP.cookTime) + "</b></span>";
    $("foot").innerHTML = "<hr>Бай-Тандыр · " + esc(SHOP.address) + "<br>Халяль · " +
      esc(SHOP.tagline) + "<br><br>Мини-приложение ВКонтакте · демонстрация";
  }

  /* ---------- рендер: категории и список ---------- */
  function renderCats() {
    var c = $("cats");
    c.innerHTML = "";
    MENU.forEach(function (sec) {
      var b = el("button", "chip" + (sec.id === state.cat ? " active" : ""), sec.emoji + " " + esc(sec.title));
      b.type = "button";
      b.onclick = function () { state.cat = sec.id; renderCats(); renderList(); };
      c.appendChild(b);
    });
  }
  function renderList() {
    var box = $("list");
    box.innerHTML = "";
    var sec = MENU.filter(function (s) { return s.id === state.cat; })[0] || MENU[0];
    box.appendChild(el("div", "section-title", "<h2>" + sec.emoji + " " + esc(sec.title) + "</h2><span>" + esc(sec.sub) + "</span>"));
    sec.items.forEach(function (it) {
      var row = el("div", "item");
      row.setAttribute("data-dish", it.id);
      var img = el("img", "item-img");
      img.src = SHOP.imgBase + it.photo; img.alt = it.name; img.loading = "lazy";
      var main = el("div", "item-main");
      main.appendChild(el("div", "item-name", esc(it.name)));
      main.appendChild(el("div", "item-desc", esc(it.desc)));
      var bottom = el("div", "item-bottom");
      bottom.appendChild(el("div", "item-price", rub(it.price)));
      var b = el("button", "btn-add");
      b.type = "button"; b.setAttribute("data-id", it.id);
      var n = state.cart[it.id] || 0;
      b.textContent = n ? n : "+";
      b.classList.toggle("in-cart", !!n);
      b.onclick = function (ev) { ev.stopPropagation(); addToCart(it.id); toast(esc(it.name) + " — в корзине"); };
      bottom.appendChild(b);
      main.appendChild(bottom);
      row.appendChild(img); row.appendChild(main);
      row.onclick = function () { openDish(it.id); };
      box.appendChild(row);
    });
  }

  /* ---------- модалка блюда ---------- */
  function openDish(id) {
    state.dishId = "" + id; state.dishQty = 1;
    renderDishSheet(id);
    $("dishBackdrop").hidden = false;
    $("dishSheet").hidden = false;
    requestAnimationFrame(function () {
      $("dishBackdrop").classList.add("show");
      $("dishSheet").classList.add("show");
    });
  }
  function closeDish() {
    $("dishBackdrop").classList.remove("show");
    $("dishSheet").classList.remove("show");
    setTimeout(function () { $("dishBackdrop").hidden = true; $("dishSheet").hidden = true; }, 260);
  }
  function renderDishSheet(id, keepQty) {
    var it = ALL[id];
    if (!it) return;
    if (!keepQty) state.dishQty = 1;
    var body = $("dishBody");
    body.innerHTML = "";
    var img = el("img", "dish-hero"); img.src = SHOP.imgBase + it.photo; img.alt = it.name;
    body.appendChild(img);
    var info = el("div", "dish-info");
    info.appendChild(el("div", "dish-name", esc(it.name)));
    info.appendChild(el("div", "dish-desc", esc(it.desc)));
    var row = el("div", "dish-row");
    row.appendChild(el("div", "dish-price", rub(it.price)));
    var st = el("div", "stepper");
    var minus = el("button", null, "−"); minus.type = "button";
    var num = el("span", null, String(state.dishQty));
    var plus = el("button", null, "+"); plus.type = "button";
    minus.onclick = function () { state.dishQty = Math.max(1, state.dishQty - 1); num.textContent = state.dishQty; };
    plus.onclick = function () { state.dishQty = Math.min(20, state.dishQty + 1); num.textContent = state.dishQty; };
    st.appendChild(minus); st.appendChild(num); st.appendChild(plus);
    row.appendChild(st);
    info.appendChild(row);
    var btn = el("button", "btn-primary", "В корзину · " + rub(it.price * state.dishQty));
    btn.type = "button";
    btn.onclick = function () {
      addToCart(it.id, state.dishQty);
      toast(esc(it.name) + " × " + state.dishQty + " — в корзине");
      closeDish();
    };
    info.appendChild(btn);
    body.appendChild(info);
    btn.setAttribute("data-add-btn", "1");
  }

  /* ---------- корзина-бар ---------- */
  function renderCartbar() {
    var n = cartCount();
    var bar = $("cartbar");
    bar.hidden = n === 0;
    $("cartbarCount").textContent = n;
    $("cartbarSum").textContent = rub(cartSum());
  }

  /* ---------- экран корзины ---------- */
  function renderCartScreen() {
    var body = $("cartBody"), foot = $("cartFoot");
    body.innerHTML = ""; foot.innerHTML = "";
    var ids = Object.keys(state.cart).filter(function (k) { return ALL[k]; });
    if (!ids.length) {
      body.appendChild(el("div", "cart-empty", '<div class="big">🛒</div>Корзина пуста.<br>Добавьте что-нибудь вкусное!'));
      return;
    }
    ids.forEach(function (k) {
      var it = ALL[k], q = state.cart[k];
      var row = el("div", "cart-row"); row.setAttribute("data-cart-row", k);
      var img = el("img"); img.src = SHOP.imgBase + it.photo; img.alt = it.name;
      var main = el("div", "cart-row-main");
      main.appendChild(el("div", "cart-row-name", esc(it.name)));
      main.appendChild(el("div", "cart-row-price", rub(it.price * q)));
      var st = el("div", "stepper");
      var minus = el("button", null, "−"); minus.type = "button";
      var num = el("span", null, String(q));
      var plus = el("button", null, "+"); plus.type = "button";
      minus.onclick = function () { setQty(+k, q - 1); };
      plus.onclick = function () { setQty(+k, q + 1); };
      st.appendChild(minus); st.appendChild(num); st.appendChild(plus);
      row.appendChild(img); row.appendChild(main); row.appendChild(st);
      body.appendChild(row);
    });
    var sub = cartSum();
    foot.innerHTML =
      '<div class="total-line"><span>Блюда (' + cartCount() + ')</span><span>' + rub(sub) + "</span></div>" +
      '<button class="btn-primary" id="toCheckout" type="button">Перейти к оформлению</button>';
    foot.querySelector("#toCheckout").onclick = openCheckout;
  }

  function openCart() {
    renderCartScreen();
    var s = $("cartScreen");
    s.hidden = false;
    requestAnimationFrame(function () { s.classList.add("show"); });
  }
  function closeScreen(id) {
    var s = $(id);
    s.classList.remove("show");
    setTimeout(function () { s.hidden = true; }, 250);
  }

  /* ---------- оформление ---------- */
  function openCheckout() {
    renderCheckout();
    var s = $("checkoutScreen");
    s.hidden = false;
    requestAnimationFrame(function () { s.classList.add("show"); });
  }
  function renderCheckout() {
    var body = $("checkoutBody"), foot = $("checkoutFoot");
    var f = state.form;
    body.innerHTML =
      '<div class="seg">' +
        '<button type="button" data-mode="pickup" class="' + (f.delivery ? "" : "active") + '">🏠 Самовывоз</button>' +
        '<button type="button" data-mode="delivery" class="' + (f.delivery ? "active" : "") + '">🛵 Доставка</button>' +
      "</div>" +
      '<div class="pickup-note" id="modeNote"></div>' +
      '<div class="field"><label>Как вас зовут *</label><input id="fName" autocomplete="name" placeholder="Имя" value="' + esc(f.name) + '"></div>' +
      '<div class="field"><label>Телефон *</label><input id="fPhone" autocomplete="tel" inputmode="tel" placeholder="+7 (___) ___-__-__" value="' + esc(f.phone) + '"><div class="hint">Позвоним для подтверждения заказа</div></div>' +
      '<div class="field" id="addrField" ' + (f.delivery ? "" : "hidden") + '><label>Адрес доставки *</label><input id="fAddress" autocomplete="street-address" placeholder="Улица, дом, квартира" value="' + esc(f.address) + '"></div>' +
      '<div class="field"><label>Комментарий</label><textarea id="fComment" rows="2" placeholder="Например: без лука, позвонить за 5 минут">' + esc(f.comment) + "</textarea></div>" +
      '<label class="check"><input type="checkbox" id="fAgree"' + (f.agree ? " checked" : "") + '><span>Согласен на обработку персональных данных: имя, телефон и адрес используются только для выполнения заказа (152-ФЗ).</span></label>';
    var note = body.querySelector("#modeNote");
    function updNote() {
      note.innerHTML = state.form.delivery
        ? "🛵 Доставка по Баймаку. Стоимость доставки подтвердим при звонке."
        : "🏠 Самовывоз: " + esc(SHOP.address) + " · " + esc(SHOP.hours);
    }
    updNote();
    body.querySelectorAll(".seg button").forEach(function (b) {
      b.onclick = function () {
        state.form.delivery = b.getAttribute("data-mode") === "delivery";
        body.querySelectorAll(".seg button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        body.querySelector("#addrField").hidden = !state.form.delivery;
        updNote(); saveForm();
      };
    });
    ["fName", "fPhone", "fAddress", "fComment"].forEach(function (id) {
      var inp = body.querySelector("#" + id);
      inp.addEventListener("input", function () {
        var key = id.slice(1).toLowerCase();
        state.form[key] = inp.value;
        if (id === "fPhone") inp.value = fmtPhone(inp.value);
        inp.classList.remove("err");
        saveForm();
      });
    });
    body.querySelector("#fAgree").addEventListener("change", function (e) { state.form.agree = e.target.checked; });

    foot.innerHTML =
      '<div class="total-line grand"><span>Итого</span><span>' + rub(cartSum()) + "</span></div>" +
      '<button class="btn-primary" id="submitOrder" type="button">Подтвердить заказ · ' + rub(cartSum()) + "</button>";
    foot.querySelector("#submitOrder").onclick = submitOrder;
  }
  function fmtPhone(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    var out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 5) out += ") " + d.slice(4, 7);
    if (d.length >= 8) out += "-" + d.slice(7, 9);
    if (d.length >= 10) out += "-" + d.slice(9, 11);
    return out;
  }
  function phoneOK(v) { return String(v).replace(/\D/g, "").length === 11; }

  /* ---------- отправка заказа ---------- */
  function collectOrder() {
    var items = [];
    for (var k in state.cart) {
      if (ALL[k]) items.push({ id: +k, name: ALL[k].name, price: ALL[k].price, qty: state.cart[k], sum: ALL[k].price * state.cart[k] });
    }
    return {
      items: items,
      total: cartSum(),
      delivery: state.form.delivery,
      customer: state.form.name.trim(),
      phone: state.form.phone.trim(),
      address: state.form.delivery ? state.form.address.trim() : "",
      comment: state.form.comment.trim(),
      source: (function () { var m = /[?&]src=([a-z]+)/i.exec(location.search); return (m && /^(site|miniapp|vkb)$/.test(m[1])) ? m[1] : "miniapp"; })(),
      vk_id: state.userId || null,
      createdAt: new Date().toISOString(),
    };
  }
  function submitOrder() {
    var f = state.form, body = $("checkoutBody");
    var bad = null;
    if (f.name.trim().length < 2) bad = "#fName";
    else if (!phoneOK(f.phone)) bad = "#fPhone";
    else if (f.delivery && f.address.trim().length < 4) bad = "#fAddress";
    else if (!f.agree) bad = "#fAgree";
    if (bad) {
      var n = body.querySelector(bad);
      if (bad !== "#fAgree") { n.classList.add("err"); n.focus(); }
      toast(bad === "#fAgree" ? "Нужно согласие на обработку данных" : "Проверьте выделенное поле");
      return;
    }
    var order = collectOrder();
    var btn = $("checkoutFoot").querySelector("#submitOrder");
    btn.disabled = true; btn.textContent = "Отправляем…";

    sendOrder(order).then(function (res) {
      state.lastOrder = Object.assign({}, order, { number: res.number, demo: !!res.demo });
      state.orderCounter += 1;
      try { localStorage.setItem(LS_CNT, String(state.orderCounter)); } catch (e) {}
      clearCart();
      state.form = { name: f.name, phone: f.phone, address: f.address, comment: "", agree: false, delivery: f.delivery };
      saveForm();
      haptic("success");
      closeScreen("checkoutScreen");
      showDone(state.lastOrder);
    }).catch(function () {
      btn.disabled = false; btn.textContent = "Подтвердить заказ · " + rub(cartSum());
      toast("Не получилось отправить. Попробуйте ещё раз.");
    });
  }
  function sendOrder(order) {
    /* Реальный режим: если задан window.TANDRY_API_URL — заказ уходит на сервер
       (VPS), который пересылает его в сообщество ВК. Иначе — демо. */
    var url = window.TANDRY_API_URL;
    var number = state.orderCounter;
    if (!url) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve({ ok: true, number: number, demo: true }); }, 600);
      });
    }
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (data) {
      return { ok: true, number: data.number || number, demo: false };
    });
  }

  /* ---------- экран успеха ---------- */
  function showDone(o) {
    var bymode = o.delivery
      ? "🛵 Доставка: " + esc(o.address)
      : "🏠 Самовывоз: " + esc(SHOP.address);
    var rows = o.items.map(function (i) {
      return '<div class="total-line"><span>' + esc(i.name) + " × " + i.qty + "</span><span>" + rub(i.sum) + "</span></div>";
    }).join("");
    $("doneBody").innerHTML =
      '<div class="done-emoji">🎉</div>' +
      '<div class="done-title">Заказ <span class="done-num">№' + o.number + "</span> принят!</div>" +
      '<div class="done-sub">' + (state.userName ? esc(state.userName) + ", мы" : "Мы") + " позвоним на " + esc(o.phone) + " для подтверждения.<br>Готовность ~ " + esc(SHOP.cookTime) + ".</div>" +
      '<div class="done-card">' + rows +
        '<div class="total-line grand"><span>Итого</span><span>' + rub(o.total) + "</span></div>" +
        '<div class="total-line"><span>' + bymode + "</span></div>" +
      "</div>" +
      (window.TANDRY_API_URL && !o.demo ? '<div class="done-status" id="orderStatus">Статус: <b>новый</b></div>' : "") +
      (o.demo ? '<div class="done-tip">Демонстрационный режим: заказ не отправлен, показан пример работы приложения.</div>' : "") +
      (window.VK_GROUP_ID && state.inVK ? '<button class="btn-primary" id="allowMsg" type="button">🔔 Сообщать о статусе заказа в ВК</button>' : "") +
      '<button class="btn-primary" id="doneBack" type="button">Вернуться в меню</button>';
    var s = $("doneScreen");
    s.hidden = false;
    requestAnimationFrame(function () { s.classList.add("show"); });
    $("doneBack").onclick = function () { stopStatusPoll(); closeScreen("doneScreen"); };
    startStatusPoll(o);
    var am = $("allowMsg");
    if (am) am.onclick = function () {
      window.vkBridge.send("VKWebAppAllowMessagesFromGroup", { group_id: window.VK_GROUP_ID })
        .then(function () { toast("Готово! Сообщим о готовности заказа"); am.remove(); })
        .catch(function () { toast("Не получилось. Можно повторить в настройках."); });
    };
  }

  /* ---------- статус заказа (реальный режим, сервер заказов) ---------- */
  function startStatusPoll(o) {
    stopStatusPoll();
    var url = window.TANDRY_API_URL;
    if (!url || o.demo) return;
    var el = document.getElementById("orderStatus");
    var tries = 0;
    state.statusTimer = setInterval(function () {
      tries += 1;
      if (tries > 120) { stopStatusPoll(); return; }
      var scr = $("doneScreen");
      if (!scr || scr.hidden) return;
      fetch(url + "/" + o.number)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.order && el) {
            var mark = d.order.status === "ready" ? " \u2705" : (d.order.status === "cancelled" ? " \u274c" : "");
            el.innerHTML = "Статус: <b>" + esc(d.order.status_ru) + "</b>" + mark;
          }
        })
        .catch(function () {});
    }, 7000);
  }
  function stopStatusPoll() {
    if (state.statusTimer) { clearInterval(state.statusTimer); state.statusTimer = null; }
  }

  /* ---------- VK Bridge ---------- */
  function initVK() {
    if (!window.vkBridge) { $("demoNote").hidden = false; return; }
    var settled = false;
    var timeout = setTimeout(function () { if (!settled) { $("demoNote").hidden = false; } }, 1800);
    try {
      window.vkBridge.send("VKWebAppInit")
        .then(function () {
          settled = true; clearTimeout(timeout);
          state.inVK = true;
          return window.vkBridge.send("VKWebAppGetUserInfo").catch(function () { return null; });
        })
        .then(function (u) {
          if (u && u.first_name) { state.userName = u.first_name; }
          if (u && u.id) { state.userId = u.id; }
        })
        .catch(function () {});
    } catch (e) { $("demoNote").hidden = false; }
  }

  /* ---------- старт ---------- */
  function start() {
    renderStatic(); renderCats(); renderList(); renderCartbar();
    $("cartbar").onclick = openCart;
    $("dishBackdrop").onclick = closeDish;
    $("dishClose").onclick = closeDish;
    $("cartBack").onclick = function () { closeScreen("cartScreen"); };
    $("cartClear").onclick = function () { clearCart(); toast("Корзина очищена"); };
    $("checkoutBack").onclick = function () { closeScreen("checkoutScreen"); openCart(); };
    initVK();
  }

  /* ---------- хуки для автотестов ---------- */
  window.__D = {
    menuSections: function () { return MENU.length; },
    menuItems: function () { return Object.keys(ALL).length; },
    add: addToCart,
    set: setQty,
    clear: clearCart,
    cart: function () { return JSON.parse(JSON.stringify(state.cart)); },
    count: cartCount,
    sum: cartSum,
    setForm: function (o) { Object.assign(state.form, o); },
    submit: function () { return submitOrder(); },
    lastOrder: function () { return state.lastOrder; },
    inVK: function () { return state.inVK; },
    dishes: function () { return Object.keys(ALL).map(function (k) { return ALL[k].name + "=" + ALL[k].price; }); },
    /* полный смоук: собрать корзину, заполнить форму, отправить */
    smoke: function () {
      clearCart();
      addToCart(1, 2);   // лепёшка 50 ×2
      addToCart(3, 1);   // самса говядина 130
      addToCart(10, 1);  // шашлык говядина 380
      return { count: cartCount(), sum: cartSum() };
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
