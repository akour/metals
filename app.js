// ====== Metals Planner app.js ======

// Helper query
const qs = (id) => document.getElementById(id);

// ---- Config (update numbers here if your base changes) ----
const baseConfig = {
  gold: {
    holdings: 0.335,
    avg: 2928,
    price: 2950,
    // buy zones (JOD/oz)
    buyStrong: 2870,
    buyLightLow: 2870,
    buyLightHigh: 2900,
    // conservative trim ladder
    trimsCons: [
      { price: 3050, pct: 20 },
      { price: 3120, pct: 20 },
      { price: 3200, pct: 20 }
    ],
    // aggressive trim ladder
    trimsAggro: [
      { price: 3040, pct: 25 },
      { price: 3100, pct: 25 },
      { price: 3180, pct: 25 }
    ]
  },
  silver: {
    holdings: 23.6,
    avg: 37.6,
    price: 37.6,
    buyStrong: 35.0,
    buyLightLow: 35.0,
    buyLightHigh: 38.0,
    trimsCons: [
      { price: 41.0, pct: 20 },
      { price: 43.0, pct: 20 },
      { price: 45.0, pct: 20 }
    ],
    trimsAggro: [
      { price: 40.5, pct: 25 },
      { price: 42.0, pct: 25 },
      { price: 44.0, pct: 25 }
    ]
  }
};

const STORAGE_KEY = "metals-planner-v1";

const state = {
  theme: "dark",
  mode: "cons", // cons | aggro
  // per asset stuff we DO persist (NOT current price)
  assets: {
    gold: {
      holdings: baseConfig.gold.holdings,
      avg: baseConfig.gold.avg,
      bankBuy: "",
      bankSell: "",
      yday: "",
      prevPrice: baseConfig.gold.price
    },
    silver: {
      holdings: baseConfig.silver.holdings,
      avg: baseConfig.silver.avg,
      bankBuy: "",
      bankSell: "",
      yday: "",
      prevPrice: baseConfig.silver.price
    }
  },
  prices: {
    gold: baseConfig.gold.price,
    silver: baseConfig.silver.price
  }
};

// ====== Persistence (no current price) ======

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (saved.theme) state.theme = saved.theme;
    if (saved.mode) state.mode = saved.mode;

    ["gold", "silver"].forEach((k) => {
      if (!saved.assets || !saved.assets[k]) return;
      const src = saved.assets[k];
      const tgt = state.assets[k];
      if (typeof src.holdings === "number") tgt.holdings = src.holdings;
      if (typeof src.avg === "number") tgt.avg = src.avg;
      if (typeof src.bankBuy === "number") tgt.bankBuy = src.bankBuy;
      if (typeof src.bankSell === "number") tgt.bankSell = src.bankSell;
      if (typeof src.yday === "number") tgt.yday = src.yday;
      if (typeof src.prevPrice === "number") tgt.prevPrice = src.prevPrice;
    });
  } catch (e) {
    console.warn("loadState error", e);
  }
}

function saveState() {
  try {
    const toSave = {
      theme: state.theme,
      mode: state.mode,
      assets: state.assets
      // IMPORTANT: we do NOT store state.prices => they reset on reload to API/baseConfig
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("saveState error", e);
  }
}

// ====== Theme handling ======

function applyTheme() {
  const body = document.body;
  body.dataset.theme = state.theme;
  if (state.theme === "light") {
    body.classList.add("light");
  } else {
    body.classList.remove("light");
  }
}

function initThemeToggle() {
  const btn = qs("themeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveState();
  });
}

// ====== Mode toggle (Cons / Aggro) ======

function applyModeUI() {
  const consBtn = qs("modeCons");
  const aggroBtn = qs("modeAggro");
  if (!consBtn || !aggroBtn) return;

  consBtn.classList.toggle("active", state.mode === "cons");
  aggroBtn.classList.toggle("active", state.mode === "aggro");

  const labels = document.querySelectorAll("[data-mode-label]");
  labels.forEach((el) => {
    el.textContent = state.mode === "cons" ? "Cons." : "Aggro";
  });
}

function initModeToggle() {
  const consBtn = qs("modeCons");
  const aggroBtn = qs("modeAggro");
  if (!consBtn || !aggroBtn) return;

  consBtn.addEventListener("click", () => {
    state.mode = "cons";
    applyModeUI();
    updateAll();
    saveState();
  });
  aggroBtn.addEventListener("click", () => {
    state.mode = "aggro";
    applyModeUI();
    updateAll();
    saveState();
  });
}

// ====== Math helpers ======

const fmtMoney = (v) =>
  isFinite(v) ? v.toFixed(1).replace(/\.0$/, "") : "—";

const fmtPct = (v) =>
  isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(2)} %` : "—";

// ====== Asset calculations ======

function readAssetInputs(assetKey) {
  const a = state.assets[assetKey];

  a.holdings = parseFloat(qs(assetKey + "Hold").value || "0") || 0;
  a.avg = parseFloat(qs(assetKey + "Avg").value || "0") || 0;
  a.bankBuy = parseFloat(qs(assetKey + "BankBuy").value || "0") || 0;
  a.bankSell = parseFloat(qs(assetKey + "BankSell").value || "0") || 0;
  a.yday = parseFloat(qs(assetKey + "Yday").value || "0") || 0;
}

function fillAssetInputs(assetKey) {
  const cfg = baseConfig[assetKey];
  const a = state.assets[assetKey];
  const price = state.prices[assetKey];

  qs(assetKey + "Hold").value = a.holdings;
  qs(assetKey + "Avg").value = a.avg;
  qs(assetKey + "Price").value = price;
  qs(assetKey + "Value").value = fmtMoney(a.holdings * price);

  if (qs(assetKey + "BankBuy")) {
    qs(assetKey + "BankBuy").value = a.bankBuy || "";
  }
  if (qs(assetKey + "BankSell")) {
    qs(assetKey + "BankSell").value = a.bankSell || "";
  }
  if (qs(assetKey + "Yday")) {
    qs(assetKey + "Yday").value = a.yday || "";
  }

  // Status chip (buy / hold / trim)
  const statusNode = qs(assetKey + "Status");
  if (statusNode) {
    const s = statusForPrice(price, cfg);
    statusNode.className = "status-chip " + s.className;
    qs(assetKey + "StatusText").textContent = s.label;
  }

  // Bank spread
  updateBankSpread(assetKey);

  // Trim ladder rows
  updateTrimTable(assetKey);
}

function statusForPrice(price, cfg) {
  if (!price) return { label: "—", className: "" };

  if (price <= cfg.buyStrong) {
    return { label: "Strong buy / average-down", className: "good" };
  }
  if (price >= cfg.buyLightLow && price <= cfg.buyLightHigh) {
    return { label: "Light buy / average-down", className: "good" };
  }

  const ladder =
    state.mode === "cons" ? cfg.trimsCons : cfg.trimsAggro;
  const firstTrim = ladder[0].price;
  const lastTrim = ladder[ladder.length - 1].price;

  if (price < firstTrim) {
    return { label: "HOLD – between buy & trims", className: "" };
  }
  if (price >= firstTrim && price < lastTrim) {
    return { label: "Trim zone – partial profit", className: "warn" };
  }
  if (price >= lastTrim) {
    return { label: "Strong trim – take profits", className: "warn" };
  }
  return { label: "HOLD", className: "" };
}

function updateBankSpread(assetKey) {
  const a = state.assets[assetKey];
  const price = state.prices[assetKey];

  const spreadRow = qs(assetKey + "SpreadRow");
  const spreadVal = qs(assetKey + "SpreadVal");
  const breakevenVal = qs(assetKey + "BreakevenVal");
  if (!spreadRow || !spreadVal || !breakevenVal) return;

  if (!a.bankBuy || !a.bankSell) {
    spreadRow.style.visibility = "hidden";
    return;
  }

  spreadRow.style.visibility = "visible";

  const spread = a.bankBuy - a.bankSell; // JOD/oz they take from you
  const spreadPct = (spread / a.bankBuy) * 100;
  spreadVal.textContent = `${fmtMoney(spread)} JOD (${fmtPct(spreadPct)})`;

  const breakeven = a.avg + spread; // rough; what you need to cover spread
  breakevenVal.textContent = `${fmtMoney(breakeven)} JOD/oz`;
}

function updateTrimTable(assetKey) {
  const cfg = baseConfig[assetKey];
  const ladder =
    state.mode === "cons" ? cfg.trimsCons : cfg.trimsAggro;
  const tbody = qs(assetKey + "TrimBody");
  if (!tbody) return;

  const hold = state.assets[assetKey].holdings;
  tbody.innerHTML = "";
  ladder.forEach((step) => {
    const qty = (hold * (step.pct / 100)) || 0;
    const profitApprox = qty * (step.price - cfg.avg); // very rough
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>@ ${step.price.toFixed(1)}</td>
      <td>${step.pct}%</td>
      <td>${qty.toFixed(3)}</td>
      <td>${fmtMoney(profitApprox)} JOD</td>
    `;
    tbody.appendChild(tr);
  });
}

function updatePL(assetKey) {
  const a = state.assets[assetKey];
  const price = state.prices[assetKey];

  const cost = a.holdings * a.avg;
  const value = a.holdings * price;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  const costNode = qs(assetKey + "Cost");
  const valNode = qs(assetKey + "Value");
  const plNode = qs(assetKey + "PL");
  const plPctNode = qs(assetKey + "PLPct");

  if (costNode) costNode.textContent = fmtMoney(cost) + " JOD";
  if (valNode) valNode.value = fmtMoney(value);
  if (plNode) {
    plNode.textContent = `${pl >= 0 ? "+" : ""}${fmtMoney(pl)} JOD`;
    plNode.style.color = pl >= 0 ? "var(--accent-green)" : "var(--accent-red)";
  }
  if (plPctNode) {
    plPctNode.textContent = fmtPct(plPct);
    plPctNode.style.color = pl >= 0 ? "var(--accent-green)" : "var(--accent-red)";
  }
}

function updateBigMove(assetKey) {
  const a = state.assets[assetKey];
  const price = state.prices[assetKey];
  const y = a.yday;
  const label = qs(assetKey + "BigMove");
  if (!label) return;
  if (!y || !price) {
    label.textContent = "—";
    return;
  }
  const changePct = ((price - y) / y) * 100;
  label.textContent = fmtPct(changePct);
}

// ====== Portfolio totals ======

function updatePortfolio() {
  let totalCost = 0;
  let totalValue = 0;

  ["gold", "silver"].forEach((k) => {
    const a = state.assets[k];
    const price = state.prices[k];
    totalCost += a.holdings * a.avg;
    totalValue += a.holdings * price;
  });

  const pl = totalValue - totalCost;
  const plPct = totalCost > 0 ? (pl / totalCost) * 100 : 0;

  const totalCostNode = qs("portfolioCost");
  const totalValNode = qs("portfolioValue");
  const totalPLNode = qs("portfolioPL");

  if (totalCostNode) totalCostNode.textContent = fmtMoney(totalCost) + " JOD";
  if (totalValNode) totalValNode.textContent = fmtMoney(totalValue) + " JOD";
  if (totalPLNode) {
    totalPLNode.textContent = `${pl >= 0 ? "+" : ""}${fmtMoney(pl)} JOD (${fmtPct(
      plPct
    )})`;
    totalPLNode.classList.toggle("positive", pl >= 0);
    totalPLNode.classList.toggle("negative", pl < 0);
  }
}

// ====== API fetch (optional) ======

const METALS_API_KEY = ""; // <-- put your metals-api key here if you have one

async function fetchPricesIfPossible() {
  if (!METALS_API_KEY) {
    // No key, keep baseConfig prices
    state.prices.gold = baseConfig.gold.price;
    state.prices.silver = baseConfig.silver.price;
    return;
  }

  try {
    const res = await fetch(
      `https://metals-api.com/api/latest?access_key=${METALS_API_KEY}&base=JOD&symbols=XAU,XAG`
    );
    const data = await res.json();
    if (!data || !data.rates) throw new Error("No rates");

    // API gives JOD base -> JOD per oz is 1 / rate
    const xau = 1 / data.rates.XAU;
    const xag = 1 / data.rates.XAG;

    state.prices.gold = xau;
    state.prices.silver = xag;
  } catch (e) {
    console.warn("Price API failed; using defaults", e);
    state.prices.gold = baseConfig.gold.price;
    state.prices.silver = baseConfig.silver.price;
  }
}

// ====== Glue: update all ======

function updateAsset(assetKey) {
  readAssetInputs(assetKey);
  updatePL(assetKey);
  updateBigMove(assetKey);
  updateBankSpread(assetKey);
  updateTrimTable(assetKey);
}

function updateAll() {
  ["gold", "silver"].forEach((k) => {
    fillAssetInputs(k);
    updatePL(k);
    updateBigMove(k);
  });
  updatePortfolio();
}

// Listen to input changes
function initInputs() {
  ["gold", "silver"].forEach((k) => {
    const fields = ["Hold", "Avg", "Price", "BankBuy", "BankSell", "Yday"];
    fields.forEach((suffix) => {
      const el = qs(k + suffix);
      if (!el) return;
      el.addEventListener("input", () => {
        if (suffix === "Price") {
          // user overrides price for now, update state.prices but DO NOT save to storage
          state.prices[k] = parseFloat(el.value || "0") || 0;
        } else {
          readAssetInputs(k);
        }
        updateAsset(k);
        updatePortfolio();
        saveState();
      });
    });
  });
}

// ====== Init ======

async function init() {
  loadState();
  applyTheme();
  initThemeToggle();
  initModeToggle();
  applyModeUI();

  await fetchPricesIfPossible(); // sets state.prices, not persisted
  updateAll();
  initInputs();
}

document.addEventListener("DOMContentLoaded", init);