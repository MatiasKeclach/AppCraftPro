const WebSocket = require("ws");
const axios = require("axios");

function startBinanceStream(io) {

  io.on("connection", (socket) => {

    console.log("⚡ Cliente conectado:", socket.id);

    let ws = null;

    socket.on("change-symbol", (symbol) => {

      console.log("📈 Nuevo símbolo:", symbol);

      // Obtener últimas 100 velas
axios
  .get(
    `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1m&limit=100`
  )
  .then((response) => {

    const candles = response.data.map(candle => ({
      time: Math.floor(candle[0] / 1000),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4])
    }));

    socket.emit("candles-history", candles);

  })
  .catch(err => {
    console.error("Error cargando velas:", err.message);
  });
      // cerrar websocket anterior
      if (ws) {
        ws.close();
      }

     ws = new WebSocket(
  `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1m`
);

      ws.on("open", () => {
        console.log("🟢 Binance conectado:", symbol);
      });

     ws.on("message", (data) => {

  const json = JSON.parse(data);

  const k = json.k;

  socket.emit("candle-update", {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c)
  });

  socket.emit("price-update", {
    symbol,
    price: parseFloat(k.c),
    time: new Date()
  });

});

      ws.on("close", () => {
        console.log("🔴 Binance desconectado");
      });

      ws.on("error", (err) => {
        console.error("Binance error:", err.message);
      });

    });

    socket.on("disconnect", () => {

      if (ws) {
        ws.close();
      }

      console.log("❌ Cliente desconectado:", socket.id);
    });

  });

}

module.exports = {
  startBinanceStream
};