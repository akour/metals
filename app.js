// =============================
// Helpers
// =============================

const qs = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function fmtJod(n) {
  if (isNaN(n)) return "--";
  return n.toFixed(1);
}

function fmtPct(n) {
  if (isNaN(n)) return "--";
  return n.toFixed(2) + " %";
}

// =============================
// Base config
// =============================

const baseConfig = {
  gold: {
    holdings: 0.335,
    avg: 2928,
    price: 2950,
    trimsCons: [
      { price: 3050, pct: 20 },
      { price: 3120, pct: 20 },
      { price: 3200, pct: 20 }
    ],
    trimsAggro: [
      { price: 3040, pct: 25 },
      { price: 3100, pct: 25 },
      { price: 3180, pct: 25 }
    ],
    buyStrong: 2870,
    buyLightLow: 2870,
    buyLightHigh: 2900
  },
  silver: {
    holdings: 23.6,
    avg: 37.6,
    price: 37.6,
    trimsCons: [
      { price: 41.0, pct: 20 },
      { price: 43.0, pct: 20 },
      { price: 45.0, pct: 20 }
    ],
    trimsAggro: [
      { price: 40.5, pct: 25 },
      { price: 42.5, pct: 25 },
      { price: 44.5, pct: 25 }
    ],
    buyStrong: 35.0,
    buyLightLow: 35.0,
    buyLightHigh: 38.0
  }
};

let currentMode = "cons"; // "cons" or "aggro"

// only these inputs are persisted; current spot price is NOT persisted
const persistedFields = ["Hold", "Avg", "BankBuy", "BankSell"];

// =============================
// Theme toggle
// =============================

const themeToggleBtn = qs("themeToggle");

function applyTheme(theme) {
  document.body.classList.remove("dark", "light");
  document.body.classList.add(theme);

  // label text
  themeToggleBtn.textContent =
    theme === "light" ? "Light / Dark" : "Dark / Light";

  try {
    localStorage.setItem("metalsTheme", theme);
  } catch (_) {}
}

function initTheme() {
  if (!themeToggleBtn) return;
  const saved = localStorage.getItem("metalsTheme") || "dark";
  applyTheme(saved);

  themeToggleBtn.addEventListener("click", () => {
    const next = document.body.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
  });
}

// =============================
// Asset logic
// =============================

function loadPersisted(assetKey) {
  persistedFields.forEach((suffix) => {
    const id = assetKey + suffix;
    const el = qs(id);
    if (!el) return;
    const stored = localStorage.getItem("metals_" + id);
    if (stored !== null) {
      el.value = stored;
    }
  });
}

function wirePersistence(assetKey) {
  persistedFields.forEach((suffix) => {
    const id = assetKey + suffix;
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", () => {
      localStorage.setItem("metals_" + id, el.value);
      updateAsset(assetKey);
    });
  });

  // spot price should affect calcs, but is NOT saved in storage
  const priceInput = qs(assetKey + "Price");
  if (priceInput) {
    priceInput.addEventListener("input", () => updateAsset(assetKey));
  }
}

function updateAsset(assetKey) {
  const cfg = baseConfig[assetKey];
  if (!cfg) return;

  const holdInput = qs(assetKey + "Hold");
  const avgInput = qs(assetKey + "Avg");
  const priceInput = qs(assetKey + "Price");

  const hold = parseFloat(holdInput?.value || cfg.holdings);
  const avg = parseFloat(avgInput?.value || cfg.avg);
  const price = parseFloat(priceInput?.value || cfg.price);

  const cost = hold * avg;
  const value = hold * price;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  if (qs(assetKey + "Value")) qs(assetKey + "Value").value = fmtJod(value);
  if (qs(assetKey + "Cost")) qs(assetKey + "Cost").textContent = fmtJod(cost);
  if (qs(assetKey + "PL")) qs(assetKey + "PL").textContent = fmtJod(pl);
  if (qs(assetKey + "PLPct"))
    qs(assetKey + "PLPct").textContent = fmtPct(plPct);

  // Status vs buy/trim zones
  const statusEl = qs(assetKey + "Status");
  if (statusEl) {
    statusEl.className = "status-pill dot status-hold";
    let label = "HOLD – between buy & trims";

    if (price <= cfg.buyStrong) {
      label = "Strong buy / average-down";
      statusEl.classList.replace("status-hold", "status-buy");
    } else if (price >= cfg.trimsCons[0].price) {
      label = "Trim zone / partial sells";
      statusEl.classList.replace("status-hold", "status-trim");
    } else if (
      price >= cfg.buyLightLow &&
      price <= cfg.buyLightHigh
    ) {
      label = "Light buy / top-up";
      statusEl.classList.replace("status-hold", "status-buy");
    }

    statusEl.textContent = label;
  }

  // bank spread
  updateBankSpread(assetKey);

  // trim ladder
  renderTrims(assetKey, hold, currentMode === "cons" ? "trimsCons" : "trimsAggro");

  // portfolio summary
  updatePortfolio();
}

function updateBankSpread(assetKey) {
  const buyEl = qs(assetKey + "BankBuy");
  const sellEl = qs(assetKey + "BankSell");
  const spreadEl = qs(assetKey + "Spread");
  const breakevenEl = qs(assetKey + "BreakEven");

  if (!buyEl || !sellEl || !spreadEl || !breakevenEl) return;

  const bankBuy = parseFloat(buyEl.value);
  const bankSell = parseFloat(sellEl.value);

  if (isNaN(bankBuy) || isNaN(bankSell)) {
    spreadEl.textContent = "--";
    breakevenEl.textContent = "--";
    return;
  }

  const spread = bankBuy - bankSell; // how much you "lose" crossing the spread
  const breakEvenSell = bankBuy + spread; // approx sell level to recover spread

  spreadEl.textContent = fmtJod(spread);
  breakevenEl.textContent = fmtJod(breakEvenSell);
}

function renderTrims(assetKey, holdingsOz, trimsKey) {
  const cfg = baseConfig[assetKey];
  const tbody = qs(assetKey + "TrimBody");
  if (!cfg || !tbody) return;

  const trims = cfg[trimsKey] || [];
  tbody.innerHTML = "";

  trims.forEach((t) => {
    const qty = (holdingsOz * t.pct) / 100;
    const profit = qty * (t.price - cfg.avg);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>@ ${t.price.toFixed(1)}</td>
      <td>${t.pct}%</td>
      <td>${qty.toFixed(3)}</td>
      <td>${fmtJod(profit)} JOD</td>
    `;
    tbody.appendChild(tr);
  });
}

function updatePortfolio() {
  const assets = ["gold", "silver"];
  let totalCost = 0;
  let totalValue = 0;

  assets.forEach((key) => {
    const costNode = qs(key + "Cost");
    const valueNode = qs(key + "Value");
    const cost = parseFloat(costNode?.textContent || costNode?.value || "0");
    const val = parseFloat(valueNode?.value || valueNode?.textContent || "0");
    if (!isNaN(cost)) totalCost += cost;
    if (!isNaN(val)) totalValue += val;
  });

  const pl = totalValue - totalCost;
  const plPct = totalCost > 0 ? (pl / totalCost) * 100 : 0;

  if (qs("portfolioValue"))
    qs("portfolioValue").textContent = fmtJod(totalValue) + " JOD";
  if (qs("portfolioCost"))
    qs("portfolioCost").textContent = fmtJod(totalCost) + " JOD";
  if (qs("portfolioPL"))
    qs("portfolioPL").textContent = fmtJod(pl) + " JOD (" + fmtPct(plPct) + ")";
}

// =============================
// Mode (Conservative / Aggro)
// =============================

function initModeToggle() {
  const consBtn = qs("modeCons");
  const aggBtn = qs("modeAggro");
  if (!consBtn || !aggBtn) return;

  function setMode(mode) {
    currentMode = mode;
    consBtn.classList.toggle("active", mode === "cons");
    aggBtn.classList.toggle("active", mode === "aggro");
    updateAsset("gold");
    updateAsset("silver");
  }

  consBtn.addEventListener("click", () => setMode("cons"));
  aggBtn.addEventListener("click", () => setMode("aggro"));

  setMode("cons");
}

// =============================
// Asset tab switching
// =============================

function initAssetTabs() {
  const goldTab = qs("tabGold");
  const silverTab = qs("tabSilver");
  const goldPanel = qs("panelGold");
  const silverPanel = qs("panelSilver");
  if (!goldTab || !silverTab || !goldPanel || !silverPanel) return;

  function setAsset(which) {
    const isGold = which === "gold";
    goldTab.classList.toggle("active", isGold);
    silverTab.classList.toggle("active", !isGold);
    goldPanel.style.display = isGold ? "block" : "none";
    silverPanel.style.display = isGold ? "none" : "block";
  }

  goldTab.addEventListener("click", () => setAsset("gold"));
  silverTab.addEventListener("click", () => setAsset("silver"));

  setAsset("gold");
}

// =============================
// Init
// =============================

function initAssets() {
  ["gold", "silver"].forEach((key) => {
    loadPersisted(key);
    wirePersistence(key);
    // initialise from base config if empty
    const cfg = baseConfig[key];

    const holdEl = qs(key + "Hold");
    const avgEl = qs(key + "Avg");
    const priceEl = qs(key + "Price");

    if (holdEl && !holdEl.value) holdEl.value = cfg.holdings;
    if (avgEl && !avgEl.value) avgEl.value = cfg.avg;
    if (priceEl && !priceEl.value) priceEl.value = cfg.price;

    updateAsset(key);
  });
}

window.addEventListener("load", () => {
  initTheme();
  initModeToggle();
  initAssetTabs();
  initAssets();
});
