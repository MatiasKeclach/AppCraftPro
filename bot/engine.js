const tradeManager = require("./tradeManager");

let lastDiff = null;
let lastTradeTime = 0;

const COOLDOWN_MS = 10000;
const MIN_TREND = 1.5;

function onCandle(candle, indicators = {}) {

  const {
    ema9,
    ema21,
    ema50,
    rsi
  } = indicators;

  if (
    ema9 == null ||
    ema21 == null ||
    ema50 == null ||
    rsi == null
  ) {
    return null;
  }

  const now = Date.now();
  const price = candle.close;

  const position = tradeManager.getPosition();

  const diff = ema9 - ema21;

  console.log(
    `📊 CLOSE: ${price} | EMA9: ${ema9.toFixed(2)} | EMA21: ${ema21.toFixed(2)} | EMA50: ${ema50.toFixed(2)} | RSI: ${rsi.toFixed(2)}`
  );

  const riskExit = tradeManager.checkRiskExit(price);

  if (riskExit) {
    console.log("💰 TRADE CLOSED:", riskExit);
    return riskExit;
  }

  if (lastDiff === null) {
    lastDiff = diff;
    return null;
  }

  const crossedUp =
    lastDiff <= 0 && diff > 0;

  const crossedDown =
    lastDiff >= 0 && diff < 0;

  lastDiff = diff;

  let result = null;

  if (!position) {

    if (
      now - lastTradeTime <
      COOLDOWN_MS
    ) {
      return null;
    }

    if (
      Math.abs(diff) < MIN_TREND
    ) {
      return null;
    }

    const bullishTrend =
      ema21 > ema50 &&
      rsi > 50;

    const bearishTrend =
      ema21 < ema50 &&
      rsi < 50;

    if (
      crossedUp &&
      bullishTrend
    ) {

      const trade =
        tradeManager.openTrade(
          "BUY",
          price
        );

      lastTradeTime = now;

      result = {
        type: "BUY",
        price,
        entry: trade.entry,
        stopLoss: trade.stopLoss,
        reason: "EMA+RSI BUY",
        time: now
      };
    }

    else if (
      crossedDown &&
      bearishTrend
    ) {

      const trade =
        tradeManager.openTrade(
          "SELL",
          price
        );

      lastTradeTime = now;

      result = {
        type: "SELL",
        price,
        entry: trade.entry,
        stopLoss: trade.stopLoss,
        reason: "EMA+RSI SELL",
        time: now
      };
    }
  }

  else {

    const shouldClose =
      (position.type === "BUY" && crossedDown) ||
      (position.type === "SELL" && crossedUp);

    if (shouldClose) {

      return tradeManager.closeTrade(
        price,
        "EMA EXIT"
      );
    }
  }

  if (result) {
    console.log(
      "🚨 ENGINE EVENT:",
      result
    );
  }

  return result;
}

module.exports = {
  onCandle
};