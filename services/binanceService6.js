const WebSocket = require("ws");
const axios = require("axios");
const { calculateEMA } = require("./strategyService");

const bot = require("../bot/engine2");

function startBinanceStream(io) {

  io.on("connection", (socket) => {

    console.log("⚡ Cliente conectado:", socket.id);

    let ws = null;
    let candlesMemory = [];

    socket.on("change-symbol", async ({ symbol, interval }) => {

      console.log(`📈 ${symbol.toUpperCase()} | ${interval}`);

      bot.setSymbol(symbol);

      // =========================
      // 1. HISTORIAL
      // =========================
      try {

        const response = await axios.get(
          `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=100`
        );

        const candles = response.data.map(candle => ({
          time: Math.floor(candle[0] / 1000),
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4])
        }));

        candlesMemory = candles;

        // EMA inicial
        const indicators = calculateEMA(candles);

        const lastEMA9 =
          indicators.ema9[indicators.ema9.length - 1];

        const lastEMA21 =
          indicators.ema21[indicators.ema21.length - 1];

        socket.emit("ema-update", {
          ema9: lastEMA9,
          ema21: lastEMA21
        });

        console.log("EMA9:", lastEMA9);
        console.log("EMA21:", lastEMA21);

        socket.emit("candles-history", candles);

      } catch (err) {
        console.error("❌ Error cargando velas:", err.message);
      }

      // =========================
      // 2. LIMPIAR WS ANTERIOR
      // =========================
      if (ws) ws.close();

      // =========================
      // 3. STREAM EN VIVO
      // =========================
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
      );

      ws.on("open", () => {
        console.log(`🟢 Binance conectado: ${symbol} ${interval}`);
      });

      ws.on("message", (data) => {

        const json = JSON.parse(data);
        if (!json.k) return;

        const k = json.k;

        const candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c)
        };

        // =========================
        // ACTUALIZAR MEMORIA
        // =========================
        candlesMemory.push(candle);

        if (candlesMemory.length > 100) {
          candlesMemory.shift();
        }

        // =========================
        // EMA EN TIEMPO REAL
        // =========================
        const indicators = calculateEMA(candlesMemory);

        const lastEMA9 =
          indicators.ema9[indicators.ema9.length - 1];

        const lastEMA21 =
          indicators.ema21[indicators.ema21.length - 1];

        socket.emit("ema-update", {
          ema9: lastEMA9,
          ema21: lastEMA21
        });

        // =========================
        // BOT ENGINE
        // =========================
       bot.onCandle(candle, {
  ema9: lastEMA9,
  ema21: lastEMA21
});

        // =========================
        // FRONTEND
        // =========================
        socket.emit("price-update", {
          symbol,
          price: parseFloat(k.c),
          time: new Date()
        });

        socket.emit("candle-update", candle);
      });

      ws.on("close", () => {
        console.log(`🔴 Binance desconectado: ${symbol}`);
      });

      ws.on("error", (err) => {
        console.error("Binance error:", err.message);
      });

    });

    socket.on("disconnect", () => {
      if (ws) ws.close();
      console.log("❌ Cliente desconectado:", socket.id);
    });

  });
}

module.exports = {
  startBinanceStream
};