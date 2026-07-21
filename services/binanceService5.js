const WebSocket = require("ws");
const axios = require("axios");
const { calculateEMA } = require("./strategyService");

const bot = require("../bot/engine2");

function startBinanceStream(io) {

  io.on("connection", (socket) => {

    console.log("⚡ Cliente conectado:", socket.id);

    let ws = null;

    socket.on("change-symbol", async ({ symbol, interval }) => {

      console.log(`📈 ${symbol.toUpperCase()} | ${interval}`);

      bot.setSymbol(symbol);

      // =========================
      // 1. HISTORIAL (solo gráfico + indicadores base)
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

        // EMA SOLO PARA DEBUG (por ahora)
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

        if (lastEMA9 > lastEMA21) {
          console.log("🟢 TENDENCIA ALCISTA");
        } else if (lastEMA9 < lastEMA21) {
          console.log("🔴 TENDENCIA BAJISTA");
        } else {
          console.log("⚪ SIN DEFINIR");
        }

        socket.emit("candles-history", candles);

      } catch (err) {
        console.error("❌ Error cargando velas:", err.message);
      }

      // =========================
      // 2. LIMPIEZA WS ANTERIOR
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

        // =========================
        // VELA ACTUAL
        // =========================
        const candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c)
        };

        // =========================
        // BOT ENGINE (AQUÍ ESTÁ EL CEREBRO)
        // =========================
        bot.onCandle(candle);

        // =========================
        // FRONTEND UPDATES
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