// Fee checkboxes for the Fee options block (Liquid) and app embed (#fee-cart-config).
// Writes _selected_fees / _declined_fees (fee engine) and _accepted_fees (fee guard).
(() => {
  if (window.__feeCartLoaded) return;
  window.__feeCartLoaded = true;

  const list = (raw) => String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
  const without = (ids, id) => ids.filter((x) => x !== id);
  // Mirrors withoutRule in extensions/fee-summary/src/fees.js.
  const withoutRule = (tokens, id) => tokens.filter((t) => t !== id && !t.startsWith(`${id}@`));
  const root = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";

  // Shop-currency limits vs. a buyer-currency subtotal; other conditions are left to the functions.
  function limitsMet(limits, subtotalCents, quantity) {
    const rate = Number(window.Shopify && window.Shopify.currency && window.Shopify.currency.rate) || 1;
    const subtotal = Number(subtotalCents) / 100;
    const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
    const min = num(limits.minSubtotal);
    const max = num(limits.maxSubtotal);
    const minQty = num(limits.minQuantity);
    if (min !== null && subtotal < min * rate) return false;
    if (max !== null && subtotal > max * rate) return false;
    if (minQty !== null && Number(quantity) < minQty) return false;
    return true;
  }

  // Hide block rows whose limits aren't met (and the block if none are left).
  function applyBlockLimits(box) {
    let visible = 0;
    box.querySelectorAll(".fee-options__row").forEach((row) => {
      const ok = limitsMet(
        { minSubtotal: row.dataset.minSubtotal, maxSubtotal: row.dataset.maxSubtotal, minQuantity: row.dataset.minQuantity },
        box.dataset.subtotal,
        box.dataset.quantity,
      );
      row.hidden = !ok;
      if (ok) visible += 1;
    });
    box.hidden = visible === 0;
  }
  document.querySelectorAll("[data-fee-options]:not([data-fee-embed])").forEach(applyBlockLimits);

  const configEl = document.getElementById("fee-cart-config");
  let config = null;
  try {
    config = configEl ? JSON.parse(configEl.textContent) : null;
  } catch (e) {
    console.error("Fee options: bad config", e);
  }

  // Latest known attribute values, shared by every box on the page.
  const state = {
    selected: list(config && config.selected),
    declined: list(config && config.declined),
    accepted: list(config && config.accepted),
  };
  const firstBlock = document.querySelector("[data-fee-options]:not([data-fee-embed])");
  if (!config && firstBlock) {
    state.selected = list(firstBlock.dataset.selected);
    state.declined = list(firstBlock.dataset.declined);
    state.accepted = list(firstBlock.dataset.accepted);
  }

  const DRAWERS = ["cart-drawer", "#CartDrawer", "#cart-drawer", ".cart-drawer", ".drawer--cart", "[data-cart-drawer]"];
  const ANCHORS = [".cart__ctas", "[name='checkout']", "button[type='submit'][name='checkout']", ".cart__checkout", "[href$='/checkout']"];
  const onCartPage = /\/cart\/?$/.test(window.location.pathname);

  const isOn = (o) =>
    o.required
      ? state.accepted.includes(o.token)
      : o.selection === "OPT_IN"
        ? state.selected.includes(o.id)
        : !state.declined.includes(o.id);

  // Totals are as of page load.
  const eligibleOptions = () =>
    config.options.filter((o) => limitsMet(o, config.subtotal, config.quantity));

  function buildBox() {
    const box = document.createElement("div");
    box.className = "fee-options";
    box.dataset.feeOptions = "";
    box.dataset.feeEmbed = "";
    if (config.heading) {
      const h = document.createElement("p");
      h.className = "fee-options__heading";
      h.textContent = config.heading;
      box.append(h);
    }
    for (const o of eligibleOptions()) {
      const row = document.createElement("label");
      row.className = "fee-options__row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.feeId = o.id;
      input.dataset.selection = o.selection;
      if (o.required) input.dataset.token = o.token;
      input.checked = isOn(o);
      const text = document.createElement("span");
      text.className = "fee-options__text";
      const name = document.createElement("span");
      name.className = "fee-options__name";
      name.textContent = o.name;
      text.append(name);
      if (o.note) {
        const note = document.createElement("span");
        note.className = "fee-options__note";
        note.textContent = o.note;
        text.append(note);
      }
      row.append(input, text);
      if (o.required) {
        row.classList.add("fee-options__row--required");
      } else {
        const price = document.createElement("span");
        price.className = "fee-options__price";
        price.textContent = o.price;
        row.append(price);
      }
      box.append(row);
    }
    return box;
  }

  // First element in `scope` to place the checkboxes before.
  function findAnchor(scope) {
    const selectors = config.selector ? [config.selector, ...ANCHORS] : ANCHORS;
    for (const sel of selectors) {
      let el = null;
      try {
        el = scope.querySelector(sel);
      } catch {
        continue; // invalid custom selector
      }
      if (el) return el;
    }
    return null;
  }

  function place(scope) {
    if (scope.querySelector("[data-fee-embed]")) return;
    const anchor = findAnchor(scope);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(buildBox(), anchor);
  }

  function placeAll() {
    if (!config || !config.options || eligibleOptions().length === 0) return;

    if (config.drawer) {
      for (const sel of DRAWERS) document.querySelectorAll(sel).forEach(place);
    }

    if (config.cartPage && onCartPage && config.itemCount > 0) {
      if (document.querySelector("[data-fee-options]:not([data-fee-embed])")) return; // block already there
      const main = document.querySelector("main") || document.body;
      const inDrawer = (el) => DRAWERS.some((sel) => el.closest(sel));
      if (Array.from(main.querySelectorAll("[data-fee-embed]")).some((el) => !inDrawer(el))) return;
      const anchor = findAnchor(main);
      if (anchor && !inDrawer(anchor) && anchor.parentNode) {
        anchor.parentNode.insertBefore(buildBox(), anchor);
      }
    }
  }

  if (config) {
    placeAll();
    // Themes re-render the cart drawer after every change; put the box back.
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        placeAll();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  async function updateCart(body) {
    const res = await fetch(`${root()}cart/update.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`cart/update.js ${res.status}`);
    const cart = await res.json();
    const attrs = cart.attributes || {};
    state.selected = list(attrs._selected_fees);
    state.declined = list(attrs._declined_fees);
    state.accepted = list(attrs._accepted_fees);
    return cart;
  }

  // Attributes outlive the items; clear an old acceptance once the cart is empty.
  if (config && config.itemCount === 0 && state.accepted.length > 0) {
    updateCart({ attributes: { _accepted_fees: "" } }).catch((e) =>
      console.error("Fee options: clearing old acceptance failed", e),
    );
  }

  async function onChange(box, input) {
    const id = input.dataset.feeId;
    const token = input.dataset.token;
    const optIn = input.dataset.selection === "OPT_IN";
    const on = input.checked;
    const attributes = {};

    if (token) {
      const rest = withoutRule(state.accepted, id);
      attributes._accepted_fees = (on ? [...rest, token] : rest).join(",");
    } else {
      let selected = state.selected;
      let declined = state.declined;
      // Mirrors toggleFee in extensions/fee-summary/src/fees.js.
      if (optIn) selected = on ? [...without(selected, id), id] : without(selected, id);
      declined = on ? without(declined, id) : optIn ? declined : [...without(declined, id), id];
      attributes._selected_fees = selected.join(",");
      attributes._declined_fees = declined.join(",");
    }

    // Dawn-style drawers can re-render themselves from the response.
    const drawer = box.closest("cart-drawer");
    const canRender =
      drawer && typeof drawer.renderContents === "function" && typeof drawer.getSectionsToRender === "function";
    const body = { attributes };
    if (canRender) {
      body.sections = drawer.getSectionsToRender().map((s) => s.id);
      body.sections_url = window.location.pathname;
    }

    box.setAttribute("aria-busy", "true");
    try {
      const cart = await updateCart(body);
      box.dataset.selected = state.selected.join(",");
      box.dataset.declined = state.declined.join(",");
      box.dataset.accepted = state.accepted.join(",");
      document.dispatchEvent(new CustomEvent("fee-cart:updated", { detail: cart }));

      const refresh = box.hasAttribute("data-fee-embed")
        ? Boolean(config && config.refresh)
        : box.dataset.refresh === "true";
      if (canRender && cart.sections) drawer.renderContents(cart);
      else if (refresh) window.location.reload();
    } catch (e) {
      console.error("Fee options:", e);
      input.checked = !on;
    } finally {
      box.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("change", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.feeId) return;
    const box = input.closest("[data-fee-options]");
    if (box) onChange(box, input);
  });
})();
