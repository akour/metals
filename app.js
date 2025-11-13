// Metals Planner logic with bank spread support

const baseConfig = {
  gold: {
    holdings: 0.335,
    avg: 2928,
    price: 2929,
    buyStrong: 2870,
    buyLightLow: 2870,
    buyLightHigh: 2900,
    trimsCons: [
      { price: 3050, pct: 20 },
      { price: 3120, pct: 20 },
      { price: 3200, pct: 20 }
    ],
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
      { price: 40.0, pct: 25 },
      { price: 42.0, pct: 25 },
      { price: 44.0, pct: 25 }
    ]
  }
};

let currentMode = "cons"; // cons or aggro

function qs(id) {
  return document.getElementById(id);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("metalsState"));
    if (!saved) return;

    currentMode = saved.mode || "cons";
    if (saved.gold) Object.assign(baseConfig.gold, saved.gold);
    if (saved.silver) Object.assign(baseConfig.silver, saved.silver);
    if (saved.theme === "light") document.body.classList.add("light");
  } catch (_) {}
}

function saveState() {
  const state = {
    mode: currentMode,
    theme: document.body.classList.contains("light") ? "light" : "dark",
    gold: {
      holdings: parseFloat(qs("goldHold").value) || 0,
      avg: parseFloat(qs("goldAvg").value) || 0,
      price: parseFloat(qs("goldPrice").value) || 0,
      bankBuy: parseFloat(qs("goldBankBuy").value) || 0,
      bankSell: parseFloat(qs("goldBankSell").value) || 0
    },
    silver: {
      holdings: parseFloat(qs("silverHold").value) || 0,
      avg: parseFloat(qs("silverAvg").value) || 0,
      price: parseFloat(qs("silverPrice").value) || 0,
      bankBuy: parseFloat(qs("silverBankBuy").value) || 0,
      bankSell: parseFloat(qs("silverBankSell").value) || 0
    }
  };
  localStorage.setItem("metalsState", JSON.stringify(state));
}

function formatJOD(v) {
  if (isNaN(v)) return "—";
  return v.toFixed(1) + " JOD";
}

function formatPct(v) {
  if (isNaN(v)) return "—";
  return v.toFixed(2) + " %";
}

function updateAsset(assetKey) {
  const cfg = baseConfig[assetKey];

  const holdInput = qs(assetKey + "Hold");
  const avgInput = qs(assetKey + "Avg");
  const priceInput = qs(assetKey + "Price");
  const prevInput = qs(assetKey + "Prev");
  const bankBuyInput = qs(assetKey + "BankBuy");
  const bankSellInput = qs(assetKey + "BankSell");
  const valueInput = qs(assetKey + "Value");

  const hold = parseFloat(holdInput.value) || 0;
  const avg = parseFloat(avgInput.value) || 0;
  const priceRaw = parseFloat(priceInput.value) || 0;
  const prev = parseFloat(prevInput?.value) || null;
  const bankBuy = parseFloat(bankBuyInput?.value) || null;
  const bankSell = parseFloat(bankSellInput?.value) || null;

  // Use bank SELL as the real exit price if present
  let price = priceRaw;
  if (bankSell && bankSell > 0) {
    price = bankSell;
    priceInput.value = bankSell.toFixed(3);
  }

  // Position
  const cost = hold * avg;
  const value = hold * price;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  if (valueInput) valueInput.value = value ? value.toFixed(1) : "";

  qs(assetKey + "Cost").textContent = formatJOD(cost);
  const plNode = qs(assetKey + "PL");
  const plPctNode = qs(assetKey + "PLPct");

  plNode.textContent = formatJOD(pl);
  plPctNode.textContent = formatPct(plPct);

  plNode.classList.remove("value-green", "value-red");
  plPctNode.classList.remove("value-green", "value-red");
  if (pl > 0) {
    plNode.classList.add("value-green");
    plPctNode.classList.add("value-green");
  } else if (pl < 0) {
    plNode.classList.add("value-red");
    plPctNode.classList.add("value-red");
  }

  // Bank spread + break-even
  const spreadNode = qs(assetKey + "Spread");
  const breakEvenNode = qs(assetKey + "BreakEven");

  if (bankBuy && bankSell && bankBuy > 0 && bankSell > 0) {
    const spreadJOD = bankBuy - bankSell;
    const spreadPct = (spreadJOD / bankBuy) * 100;

    spreadNode.textContent =
      spreadJOD.toFixed(3) + " JOD (" + spreadPct.toFixed(2) + " %)";

    const breakEvenPrice = avg * (1 + spreadPct / 100);
    breakEvenNode.textContent = breakEvenPrice.toFixed(1) + " JOD/oz";
  } else {
    if (spreadNode) spreadNode.textContent = "—";
    if (breakEvenNode) breakEvenNode.textContent = "—";
  }

  // Status (buy / hold / trim)
  const statusEl = qs(assetKey + "Status");
  const dot = statusEl.querySelector(".status-dot");
  let text = "";

  if (!price || !avg) {
    dot.className = "status-dot hold";
    text = "Fill holdings, avg & price to see status";
  } else if (price <= cfg.buyStrong) {
    dot.className = "status-dot buy";
    text = "STRONG BUY zone";
  } else if (price <= cfg.buyLightHigh && price >= cfg.buyLightLow) {
    dot.className = "status-dot buy";
    text = "Light buy / average-down";
  } else {
    const trims = currentMode === "cons" ? cfg.trimsCons : cfg.trimsAggro;
    const hit = trims.find(t => price >= t.price);
    if (hit) {
      dot.className = "status-dot sell";
      text = `Trim zone @ ${hit.price} JOD`;
    } else {
      dot.className = "status-dot hold";
      text = "HOLD – between buy & trims";
    }
  }
  statusEl.lastElementChild.textContent = text;

  // 24h move
  if (prev && price) {
    const change = ((price - prev) / prev) * 100;
    const moveId = assetKey + "Move";
    const moveStatusId = assetKey + "MoveStatus";

    qs(moveId).value = change.toFixed(2) + " %";

    const statusText = qs(moveStatusId);
    let msg = "Big move status: ";
    if (Math.abs(change) >= 5) {
      msg += `⚡ ${change > 0 ? "UP" : "DOWN"} > 5% – check trims / buys`;
    } else {
      msg += "Calm – inside normal daily range";
    }
    statusText.innerHTML = msg;
  }

  // Trim ladder table
  const bodyId = assetKey === "gold" ? "goldTrimBody" : "silverTrimBody";
  const body = qs(bodyId);
  body.innerHTML = "";

  const trims = currentMode === "cons" ? cfg.trimsCons : cfg.trimsAggro;
  trims.forEach(t => {
    const qty = hold * (t.pct / 100);
    const profit = (t.price - avg) * qty;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>@ ${t.price.toFixed(1)}</td>
      <td>${t.pct}%</td>
      <td>${qty.toFixed(3)}</td>
      <td class="${profit >= 0 ? "value-green" : "value-red"}">
        ${formatJOD(profit)}
      </td>
    `;
    body.appendChild(tr);
  });

  updatePortfolio();
}

function updatePortfolio() {
  const gHold = parseFloat(qs("goldHold").value) || 0;
  const gAvg = parseFloat(qs("goldAvg").value) || 0;
  const gPrice = parseFloat(qs("goldPrice").value) || 0;
  const sHold = parseFloat(qs("silverHold").value) || 0;
  const sAvg = parseFloat(qs("silverAvg").value) || 0;
  const sPrice = parseFloat(qs("silverPrice").value) || 0;

  const gCost = gHold * gAvg;
  const gVal = gHold * gPrice;
  const sCost = sHold * sAvg;
  const sVal = sHold * sPrice;

  const totalCost = gCost + sCost;
  const totalVal = gVal + sVal;
  const totalPL = totalVal - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  qs("pfTotalValue").textContent = formatJOD(totalVal);
  qs("pfTotalCost").textContent = formatJOD(totalCost);

  const pfNode = qs("pfTotalPL");
  pfNode.textContent = `${formatJOD(totalPL)} (${formatPct(totalPLPct)})`;

  pfNode.classList.remove("value-green", "value-red");
  if (totalPL > 0) pfNode.classList.add("value-green");
  else if (totalPL < 0) pfNode.classList.add("value-red");
}

function applyConfigToInputs() {
  qs("goldHold").value = baseConfig.gold.holdings;
  qs("goldAvg").value = baseConfig.gold.avg;
  qs("goldPrice").value = baseConfig.gold.price;

  qs("silverHold").value = baseConfig.silver.holdings;
  qs("silverAvg").value = baseConfig.silver.avg;
  qs("silverPrice").value = baseConfig.silver.price;
}

function setupThemeToggle() {
  const btn = document.getElementById("themeToggle");
  btn.addEventListener("click", () => {
    document.body.classList.toggle("light");
    saveState();
  });
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const asset = tab.dataset.asset;
      document.getElementById("goldPanel").classList.toggle("hidden", asset !== "gold");
      document.getElementById("silverPanel").classList.toggle("hidden", asset !== "silver");
    });
  });
}

function setupModeToggle() {
  const btns = document.querySelectorAll("#modeToggle .mode-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentMode = btn.dataset.mode;

      qs("goldModeLabel").textContent =
        "Mode: " + (currentMode === "cons" ? "Cons." : "Aggro");
      qs("silverModeLabel").textContent =
        "Mode: " + (currentMode === "cons" ? "Cons." : "Aggro");

      updateAsset("gold");
      updateAsset("silver");
      saveState();
    });
  });
}

function setupInputs() {
  [
    "goldHold",
    "goldAvg",
    "goldPrice",
    "goldPrev",
    "goldBankBuy",
    "goldBankSell",
    "silverHold",
    "silverAvg",
    "silverPrice",
    "silverPrev",
    "silverBankBuy",
    "silverBankSell"
  ].forEach(id => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener("input", () => {
      updateAsset("gold");
      updateAsset("silver");
      saveState();
    });
  });
}

function init() {
  loadState();
  setupThemeToggle();
  setupTabs();
  setupModeToggle();
  applyConfigToInputs();
  setupInputs();
  updateAsset("gold");
  updateAsset("silver");
}

document.addEventListener("DOMContentLoaded", init);
