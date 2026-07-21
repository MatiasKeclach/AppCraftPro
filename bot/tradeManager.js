let position = null;
let trades = [];

const FEE = 0.0004; // 0.04% por lado

let stats = {
  totalTrades: 0,
  wins: 0,
  losses: 0,
  totalPnL: 0
};

const STOP_PCT = 0.002;      // 0.20%
const TRAILING_PCT = 0.002;  // 0.20%

// =========================
// OPEN TRADE
// =========================
function openTrade(type, price) {

  if (position) return position;

  const stopLoss =
    type === "BUY"
      ? price * (1 - STOP_PCT)
      : price * (1 + STOP_PCT);

  position = {
    type,
    entry: price,
    stopLoss,
    highestPrice: price,
    lowestPrice: price,
    time: Date.now()
  };

  console.log("📥 ENTRY:", position);

  return position;
}

// =========================
// CLOSE TRADE
// =========================
function closeTrade(price, reason = "MANUAL") {

  if (!position) return null;

  const grossPnL =
    position.type === "BUY"
      ? price - position.entry
      : position.entry - price;

  const entryFee = position.entry * FEE;
  const exitFee = price * FEE;

  const fees = entryFee + exitFee;
  const netPnL = grossPnL - fees;

  const trade = {
    ...position,
    exit: price,
    grossPnL,
    fees,
    netPnL,
    reason,
    timeClose: Date.now()
  };

  trades.push(trade);

  stats.totalTrades++;
  stats.totalPnL += netPnL;

  if (netPnL > 0) {
    stats.wins++;
  } else {
    stats.losses++;
  }

  console.log("\n==============================");
  console.log("📤 EXIT:", trade);
  console.log("📊 STATS:", getStats());
  console.log("==============================\n");

  position = null;

  return trade;
}

// =========================
// TRAILING + STOP LOSS
// =========================
function checkRiskExit(price) {

  if (!position) return null;

  if (position.type === "BUY") {

    // actualizar máximo
    if (price > position.highestPrice) {

      position.highestPrice = price;

      const trailingStop =
        position.highestPrice * (1 - TRAILING_PCT);

      if (trailingStop > position.stopLoss) {
        position.stopLoss = trailingStop;
      }
    }

    // salida
    if (price <= position.stopLoss) {
      return closeTrade(price, "TRAILING STOP");
    }

  } else {

    // actualizar mínimo
    if (price < position.lowestPrice) {

      position.lowestPrice = price;

      const trailingStop =
        position.lowestPrice * (1 + TRAILING_PCT);

      if (trailingStop < position.stopLoss) {
        position.stopLoss = trailingStop;
      }
    }

    // salida
    if (price >= position.stopLoss) {
      return closeTrade(price, "TRAILING STOP");
    }

  }

  return null;
}

// =========================
// STATS
// =========================
function getStats() {

  const winrate =
    stats.totalTrades > 0
      ? (stats.wins / stats.totalTrades) * 100
      : 0;

  return {
    totalTrades: stats.totalTrades,
    wins: stats.wins,
    losses: stats.losses,
    totalPnL: Number(stats.totalPnL.toFixed(2)),
    winrate: winrate.toFixed(2) + "%"
  };
}

function getPosition() {
  return position;
}

function getTrades() {
  return trades;
}

module.exports = {
  openTrade,
  closeTrade,
  checkRiskExit,
  getPosition,
  getTrades,
  getStats
};