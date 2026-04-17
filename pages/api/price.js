// pages/api/price.js
// 현재가 조회 프록시 - CORS 우회용 서버사이드 라우트

export default async function handler(req, res) {
  const { type, symbol, code } = req.query;
  res.setHeader("Access-Control-Allow-Origin", "*");

  const clean = (v) => {
    if (v === null || v === undefined) return NaN;
    return parseFloat(String(v).replace(/,/g, ""));
  };

  try {

    // ── 암호화폐 (Binance) ──────────────────────────
    if (type === "crypto") {
      const binanceSymbol = symbol.replace("/", "").replace("-", "").toUpperCase();
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (!r.ok) throw new Error("Binance 조회 실패");
      const data = await r.json();
      return res.json({ price: parseFloat(data.price), source: "binance" });
    }

    // ── 국내주식 (네이버 금융 - 복수 엔드포인트 시도) ──
    if (type === "korean") {
      if (!code) return res.status(400).json({ error: "종목코드가 필요합니다" });

      const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Referer": "https://m.stock.naver.com/",
        "Accept": "application/json"
      };

      // 방법1: 네이버 realtime polling API
      try {
        const r1 = await fetch(
          `https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`,
          { headers }
        );
        if (r1.ok) {
          const d1 = await r1.json();
          const price = clean(d1?.datas?.[0]?.closePrice) ||
                        clean(d1?.datas?.[0]?.currentPrice) ||
                        clean(d1?.closePrice);
          if (price && !isNaN(price)) return res.json({ price, source: "naver-polling" });
        }
      } catch (e) {}

      // 방법2: 네이버 integration API
      try {
        const r2 = await fetch(
          `https://m.stock.naver.com/api/stock/${code}/integration`,
          { headers }
        );
        if (r2.ok) {
          const d2 = await r2.json();
          const price = clean(d2?.totalInfos?.find(i => i.key === "closePrice")?.value) ||
                        clean(d2?.closePrice) ||
                        clean(d2?.stockPrice?.closePrice);
          if (price && !isNaN(price)) return res.json({ price, source: "naver-integration" });
        }
      } catch (e) {}

      // 방법3: 네이버 basic API (콤마 제거 처리)
      try {
        const r3 = await fetch(
          `https://m.stock.naver.com/api/stock/${code}/basic`,
          { headers }
        );
        if (r3.ok) {
          const d3 = await r3.json();
          const price = clean(d3?.closePrice) ||
                        clean(d3?.currentPrice) ||
                        clean(d3?.dealTrendInfos?.[0]?.closePrice) ||
                        clean(d3?.stockItemTotalInfos?.find(i => i.key === "closePrice")?.value);
          if (price && !isNaN(price)) return res.json({ price, source: "naver-basic" });

          return res.status(500).json({
            error: "현재가 파싱 실패",
            debug: {
              closePrice: d3?.closePrice,
              currentPrice: d3?.currentPrice,
              keys: Object.keys(d3 || {}).slice(0, 15)
            }
          });
        }
      } catch (e) {}

      throw new Error("모든 네이버 API 시도 실패");
    }

    // ── 해외주식 (Yahoo Finance) ────────────────────
    if (type === "foreign") {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!r.ok) throw new Error("Yahoo Finance 조회 실패");
      const data = await r.json();
      const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (!price) throw new Error("현재가를 찾을 수 없습니다");
      return res.json({ price, source: "yahoo" });
    }

    return res.status(400).json({ error: "type 파라미터 필요 (crypto/korean/foreign)" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
