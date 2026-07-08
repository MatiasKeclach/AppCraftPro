const { EMA, RSI } = require("technicalindicators");

function calculateEMA(candles) {

const closes = candles.map(c => c.close);

const ema9 = EMA.calculate({
period: 9,
values: closes
});

const ema21 = EMA.calculate({
period: 21,
values: closes
});

const ema50 = EMA.calculate({
period: 50,
values: closes
});

const rsi = RSI.calculate({
period: 14,
values: closes
});

return {
ema9,
ema21,
ema50,
rsi
};
}

module.exports = {
calculateEMA
};
