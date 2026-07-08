const WebSocket = require("ws");
const axios = require("axios");
const { calculateEMA } = require("./strategyService");
const bot = require("../bot/engine");

function startBinanceStream(io) {

  io.on("connection", (socket) => {

    console.log("⚡ CLIENTE CONECTADO:", socket.id);

    let ws = null;
    let candlesMemory = [];

    socket.on("change-symbol", async ({ symbol, interval }) => {

      console.log("\n==============================");
      console.log(`📊 CAMBIO: ${symbol.toUpperCase()} | ${interval}`);
      console.log("==============================\n");

      candlesMemory = [];

      // =========================
      // HISTORIAL
      // =========================
      try {

        const res = await axios.get(
          `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=100`
        );

        candlesMemory = res.data.map(c => ({
          time: Math.floor(c[0] / 1000),
          open: +c[1],
          high: +c[2],
          low: +c[3],
          close: +c[4]
        }));

        const indicators = calculateEMA(candlesMemory);

        socket.emit("candles-history", candlesMemory);
        socket.emit("ema-history", {
          ema9: indicators.ema9,
          ema21: indicators.ema21
        });

        console.log("📦 HISTORIAL CARGADO:", candlesMemory.length);

      } catch (err) {
        console.error("❌ HISTORIAL ERROR:", err.message);
      }

      // =========================
      // CLEAN WS
      // =========================
      if (ws) ws.close();

      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
      );

      ws.on("open", () => {
        console.log("🟢 BINANCE WS CONECTADO");
      });

      ws.on("message", (data) => {

        const json = JSON.parse(data);
        const k = json.k;
        if (!k) return;

        const candle = {
          time: Math.floor(k.t / 1000),
          open: +k.o,
          high: +k.h,
          low: +k.l,
          close: +k.c
        };

        candlesMemory.push(candle);
        if (candlesMemory.length > 200) candlesMemory.shift();

        // =========================
        // EMA
        // =========================
        const indicators = calculateEMA(candlesMemory);

        const ema9 = indicators.ema9.at(-1);
        const ema21 = indicators.ema21.at(-1);

        console.log(
          `📈 CLOSE: ${candle.close} | EMA9: ${ema9} | EMA21: ${ema21}`
        );

        socket.emit("ema-update", { ema9, ema21 });

        // =========================
        // ENGINE DEBUG
        // =========================
        const signal = bot.onCandle(candle, {
          ema9,
          ema21,
          symbol,
          candlesMemory
        });

        if (signal) {
          console.log("🚨 SIGNAL DETECTADO:", signal);
          socket.emit("bot-signal", signal);
        }

        socket.emit("price-update", {
          symbol,
          price: +k.c,
          time: new Date()
        });

        socket.emit("candle-update", candle);
      });

      ws.on("close", () => {
        console.log("🔴 WS CERRADO");
      });

      ws.on("error", (err) => {
        console.error("❌ WS ERROR:", err.message);
      });
    });

    socket.on("disconnect", () => {
      if (ws) ws.close();
      console.log("❌ CLIENTE DESCONECTADO:", socket.id);
    });
  });
}

module.exports = { startBinanceStream };