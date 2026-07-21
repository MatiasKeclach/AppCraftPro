const WebSocket = require("ws");

let latestPrice = null;

function startBinanceStream(io) {
  const ws = new WebSocket(
    "wss://stream.binance.com:9443/ws/ethusdt@trade"
  );

  ws.on("open", () => {
    console.log("🟢 Binance conectado");
  });

  ws.on("message", (data) => {
    const json = JSON.parse(data);

    latestPrice = parseFloat(json.p);

    io.emit("eth-price", {
      price: latestPrice,
      time: new Date()
    });

    console.log("ETH:", latestPrice);
  });

  ws.on("close", () => {
    console.log("🔴 Binance desconectado");
  });

  ws.on("error", (err) => {
    console.error("Binance error:", err.message);
  });
}

module.exports = {
  startBinanceStream
};