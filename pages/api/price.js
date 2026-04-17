// pages/api/price.js
// 현재가 조회 프록시 - CORS 우회용 서버사이드 라우트

export default async function handler(req, res) {
  const { type, symbol, code } = req.query;

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // ── 암호화폐 (Binance) ──────────────────────────
    if (type === "crypto") {
      // BTC/USDT → BTCUSDT, ETH/USDT → ETHUSDT
      const binanceSymbol = symbol.replace("/", "").replace("-", "").toUpperCase();
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (!r.ok) throw new Error("Binance API 오류");
      const data = await r.json();
      return res.json({ price: parseFloat(data.price), source: "binance" });
    }

    // ── 국내주식 (네이버 금융) ──────────────────────
    if (type === "korean") {
      if (!code) return res.status(400).json({ error: "종목코드가 필요합니다" });
      const r = await fetch(
        `https://m.stock.naver.com/api/stock/${code}/basic`,
        { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" } }
      );
      if (!r.ok) throw new Error("네이버 API 오류");
      const data = await r.json();
      // 네이버 응답에서 현재가 추출
      const price = parseFloat(
        data.closePrice ||
        data.dealTrendInfos?.[0]?.closePrice ||
        data.stockItemTotalInfos?.find(i => i.key === "closePrice")?.value?.replace(/,/g, "")
      );
      if (!price || isNaN(price)) throw new Error("현재가를 찾을 수 없습니다");
      return res.json({ price, source: "naver" });
    }

    // ── 해외주식 (Yahoo Finance) ────────────────────
    if (type === "foreign") {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!r.ok) throw new Error("Yahoo Finance API 오류");
      const data = await r.json();
      const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (!price) throw new Error("현재가를 찾을 수 없습니다");
      return res.json({ price, source: "yahoo" });
    }

    return res.status(400).json({ error: "type 파라미터가 필요합니다 (crypto/korean/foreign)" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
