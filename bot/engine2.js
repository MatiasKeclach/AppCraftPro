let lastSignal = null;
let lastTradeTime = 0;

const COOLDOWN_MS = 8000;

function calculateMomentum(candles) {
  if (!candles || candles.length < 5) return 0;

  const last = candles.at(-1).close;
  const prev = candles.at(-3).close;

  return (last - prev) / prev;
}

function onCandle(candle, indicators = {}, candlesMemory = []) {

  const { ema9, ema21 } = indicators;

  console.log("🧠 ENGINE INPUT:", {
    ema9,
    ema21,
    len: candlesMemory.length
  });

  if (!ema9 || !ema21) {
    console.log("⚠️ EMA INVALIDA");
    return null;
  }

  const now = Date.now();

  if (now - lastTradeTime < COOLDOWN_MS) {
    console.log("⏳ COOLDOWN ACTIVO");
    return null;
  }

  if (candlesMemory.length < 10) return null;

  const momentum = calculateMomentum(candlesMemory);

  let score = 0;

  if (ema9 > ema21) score += 2;
  if (ema9 < ema21) score -= 2;

  if (momentum > 0.0001) score += 1;
  if (momentum < -0.0001) score -= 1;

  console.log("📊 SCORE:", score, "MOMENTUM:", momentum);

  let signal = null;

  if (score >= 2 && lastSignal !== "BUY") {
    signal = {
      type: "BUY",
      price: candle.close,
      reason: `score ${score}`,
      time: now
    };
  }

  if (score <= -2 && lastSignal !== "SELL") {
    signal = {
      type: "SELL",
      price: candle.close,
      reason: `score ${score}`,
      time: now
    };
  }

  if (signal) {
    lastSignal = signal.type;
    lastTradeTime = now;

    console.log("🚨 ENGINE SIGNAL:", signal);
    return signal;
  }

  return null;
}

module.exports = { onCandle };