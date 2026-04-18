import { useState, useRef, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { LayoutDashboard, PenLine, ClipboardList, BarChart2, Bot, TrendingUp, TrendingDown, Trash2, Brain, Target, X, Save, RefreshCw, Zap, Shield, Activity, Wallet, ChevronLeft, ChevronRight, Settings, ArrowDownCircle, ArrowUpCircle, DollarSign } from "lucide-react";

const EMOTIONS = [
  { label: "😤 자신감", value: "자신감" }, { label: "😰 FOMO", value: "FOMO" },
  { label: "🤬 복수매매", value: "복수매매" }, { label: "🧊 냉철함", value: "냉철함" },
  { label: "😟 불안함", value: "불안함" }, { label: "💎 확신", value: "확신" },
  { label: "🤑 과욕", value: "과욕" }, { label: "😌 평온", value: "평온" },
];
const ASSETS = ["🇰🇷 국내주식", "🌍 해외주식", "₿ 암호화폐(현물)", "📈 암호화폐(선물)"];
const ASSET_KEYS = ["국내주식", "해외주식", "암호화폐(현물)", "암호화폐(선물)"];
const CURRENCIES = ["₩", "USD", "USDT"];
const COLORS = ["#00e5ff", "#ff3d71", "#ffe066", "#00e676", "#b47aff"];

const fmt = (v, currency) => {
  const cur = currency || "₩";
  const sign = v >= 0 ? "+" : "";
  if (cur === "₩") return sign + Math.round(v).toLocaleString("ko-KR") + "₩";
  return sign + Number(v).toFixed(2) + " " + cur;
};
const fmtPct = (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";
const todayStr = () => new Date().toISOString().split("T")[0];

function calcPnl(entry, exit, qty, dir, lev) {
  entry = parseFloat(entry) || 0; exit = parseFloat(exit) || 0;
  qty = parseFloat(qty) || 0; lev = parseFloat(lev) || 1;
  if (!entry) return 0;
  return dir === "숏" ? (entry - exit) * qty * lev : (exit - entry) * qty * lev;
}
function calcPct(entry, exit, dir, lev) {
  entry = parseFloat(entry) || 0; exit = parseFloat(exit) || 0; lev = parseFloat(lev) || 1;
  if (!entry) return 0;
  const raw = ((exit - entry) / entry) * 100 * lev;
  return dir === "숏" ? -raw : raw;
}

const DARK_THEME = {
  bg: "#09090f", surface: "#111118", surface2: "#1a1a25",
  border: "#2a2a3a", accent: "#00e5ff", accent3: "#ffe066",
  green: "#00e676", red: "#ff3d71", text: "#e8e8f0", muted: "#6b6b80",
};

const LIGHT_THEME = {
  bg: "#f5f5fa", surface: "#ffffff", surface2: "#f0f0f7",
  border: "#e0e0ea", accent: "#0099bb", accent3: "#cc9900",
  green: "#00a855", red: "#e0284f", text: "#1a1a2e", muted: "#7777aa",
};

let s = DARK_THEME;

const DARK_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { background: #09090f; margin: 0; }
  input, select, textarea { background: #09090f; border: 1px solid #2a2a3a; color: #e8e8f0; font-family: 'Noto Sans KR', sans-serif; font-size: 14px; padding: 10px 14px; border-radius: 8px; outline: none; width: 100%; -webkit-appearance: none; appearance: none; }
  input:focus, select:focus, textarea:focus { border-color: #00e5ff; box-shadow: 0 0 0 3px rgba(0,229,255,0.1); }
  textarea { resize: vertical; min-height: 80px; }
  select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b6b80' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 2px; padding: 0; border: none; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #00e5ff; cursor: pointer; }
  .sidebar { display: none; width: 0; }
  .bottom-nav { display: flex; }
  .main-content { padding: 16px; padding-bottom: 80px; width: 100%; }
  .top-header { display: flex; position: sticky; top: 0; z-index: 50; }
  .app-root { flex-direction: column; }
  @media (min-width: 1024px) {
    .app-root { flex-direction: row; }
    .sidebar { display: flex; flex-direction: column; width: 220px; min-height: 100vh; background: #111118; border-right: 1px solid #2a2a3a; position: fixed; top: 0; left: 0; z-index: 40; padding: 24px 0; }
    .bottom-nav { display: none; }
    .top-header { display: none; }
    .main-content { padding: 24px 32px; padding-bottom: 24px; width: calc(100% - 220px); margin-left: 220px; }
    .cal-cell { aspect-ratio: auto !important; height: 60px !important; }
  }
  @media (min-width: 1440px) { .cal-cell { height: 80px !important; } }
`;

const LIGHT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { background: #f5f5fa; margin: 0; }
  input, select, textarea { background: #ffffff; border: 1px solid #e0e0ea; color: #1a1a2e; font-family: 'Noto Sans KR', sans-serif; font-size: 14px; padding: 10px 14px; border-radius: 8px; outline: none; width: 100%; -webkit-appearance: none; appearance: none; }
  input:focus, select:focus, textarea:focus { border-color: #0099bb; box-shadow: 0 0 0 3px rgba(0,153,187,0.15); }
  textarea { resize: vertical; min-height: 80px; }
  select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%237777aa' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #e0e0ea; border-radius: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 2px; padding: 0; border: none; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #0099bb; cursor: pointer; }
  .sidebar { display: none; width: 0; }
  .bottom-nav { display: flex; }
  .main-content { padding: 16px; padding-bottom: 80px; width: 100%; }
  .top-header { display: flex; position: sticky; top: 0; z-index: 50; }
  .app-root { flex-direction: column; }
  @media (min-width: 1024px) {
    .app-root { flex-direction: row; }
    .sidebar { display: flex; flex-direction: column; width: 220px; min-height: 100vh; background: #ffffff; border-right: 1px solid #e0e0ea; position: fixed; top: 0; left: 0; z-index: 40; padding: 24px 0; }
    .bottom-nav { display: none; }
    .top-header { display: none; }
    .main-content { padding: 24px 32px; padding-bottom: 24px; width: calc(100% - 220px); margin-left: 220px; }
    .cal-cell { aspect-ratio: auto !important; height: 60px !important; }
  }
  @media (min-width: 1440px) { .cal-cell { height: 80px !important; } }
`;

function Card({ children, style, accent }) {
  return (
    <div style={{ background: s.surface, border: "1px solid " + s.border, borderRadius: 12, padding: 16, position: "relative", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + (accent || s.accent) + ", transparent)", opacity: 0.7 }} />
      {children}
    </div>
  );
}

function Badge({ type }) {
  const map = { "롱": { bg: "rgba(0,230,118,0.15)", color: s.green, border: "rgba(0,230,118,0.3)", label: "롱" }, "숏": { bg: "rgba(255,61,113,0.15)", color: s.red, border: "rgba(255,61,113,0.3)", label: "숏" }, "stock": { bg: "rgba(0,229,255,0.1)", color: s.accent, border: "rgba(0,229,255,0.2)", label: "주식" }, "crypto": { bg: "rgba(255,224,102,0.1)", color: s.accent3, border: "rgba(255,224,102,0.2)", label: "코인" } };
  const m = map[type] || map["stock"];
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: m.bg, color: m.color, border: "1px solid " + m.border }}>{m.label}</span>;
}

function Btn({ children, onClick, style, variant, disabled }) {
  const v = variant || "primary";
  const base = { border: "none", borderRadius: 8, fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", padding: "11px 20px", opacity: disabled ? 0.5 : 1 };
  const vars = { primary: { background: s.accent, color: "#000" }, ghost: { background: "transparent", color: s.accent, border: "1px solid " + s.accent }, danger: { background: s.red, color: "#fff" }, ai: { background: "linear-gradient(135deg, #7b2fff, #00e5ff)", color: "#fff" } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...vars[v], ...style }}>{children}</button>;
}

function StatCard({ label, value, sub, color, bar }) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: s.muted, letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600, color: color || s.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>{sub}</div>}
      {bar !== undefined && <div style={{ height: 6, background: s.surface2, borderRadius: 3, marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", width: bar + "%", borderRadius: 3, background: "linear-gradient(90deg, " + s.green + ", " + s.accent + ")" }} /></div>}
    </Card>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: s.muted, letterSpacing: 0.5, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

const ACCOUNT_LIST = [
  { key: "국내주식",      label: "국내주식",      icon: "🇰🇷", color: "#00e5ff", currencies: ["₩"] },
  { key: "해외주식",      label: "해외주식",      icon: "🌍", color: "#b47aff", currencies: ["₩", "USD"] },
  { key: "암호화폐(현물)", label: "암호화폐 현물", icon: "₿",  color: "#ffe066", currencies: ["₩", "USDT"] },
  { key: "암호화폐(선물)", label: "암호화폐 선물", icon: "📈", color: "#00e676", currencies: ["₩", "USDT"] },
];

const TABS = [
  { id: "dashboard", icon: <LayoutDashboard size={18} />, label: "대시보드" },
  { id: "record",    icon: <PenLine size={18} />,         label: "기록" },
  { id: "history",   icon: <ClipboardList size={18} />,   label: "내역" },
  { id: "cashflow",  icon: <DollarSign size={18} />,      label: "입출금" },
  { id: "stats",     icon: <BarChart2 size={18} />,       label: "통계" },
  { id: "ai",        icon: <Bot size={18} />,             label: "AI" },
  { id: "settings",  icon: <Settings size={18} />,        label: "설정" },
];

// Upstash Redis API helpers
async function saveData(key, value) {
  await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value })
  });
}
async function loadData(key) {
  const r = await fetch(`/api/data?key=${key}`);
  const j = await r.json();
  return j.data;
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [trades, setTrades] = useState([]);
  const [capitals, setCapitals] = useState({});
  const [cashflows, setCashflows] = useState([]);
  const [strategies, setStrategies] = useState({
    entryZones: ["피보 0.786~0.886", "피보 1.13~1.414", "지지/저항", "추세선", "기타"],
    slTypes: ["피보 0.886 근처", "피보 1.414 근처", "전저점/전고점", "이평선", "기타"]
  });
  const [activeAssets, setActiveAssets] = useState(["국내주식", "해외주식", "암호화폐(현물)", "암호화폐(선물)"]);
  const [showCapInput, setShowCapInput] = useState(false);
  const [capDrafts, setCapDrafts] = useState({});
  const [modal, setModal] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [krwRate, setKrwRate] = useState({ USD: 1380, USDT: 1380 }); // 기본값
  const [showKrwMode, setShowKrwMode] = useState(false);
  const [tickerCodes, setTickerCodes] = useState({}); // { "후성": "005180" }
  const [isDark, setIsDark] = useState(true);

  // 테마 전역 동기화
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  Object.assign(s, theme);
  const css = isDark ? DARK_CSS : LIGHT_CSS;

  // 환율 자동 로딩
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        if (data.rates && data.rates.KRW) {
          const rate = Math.round(data.rates.KRW);
          setKrwRate({ USD: rate, USDT: rate });
        }
      } catch (e) {}
    };
    fetchRate();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
        const safeLoad = (key) => Promise.race([loadData(key), timeout(5000)]);
        const parse = (v) => { if (!v) return null; if (typeof v === "string") return JSON.parse(v); return v; };
        try { const t = await safeLoad("trades"); if (t) setTrades(parse(t)); } catch (e) {}
        try { const c = await safeLoad("capitals"); if (c) setCapitals(parse(c)); } catch (e) {}
        try { const cf = await safeLoad("cashflows"); if (cf) setCashflows(parse(cf)); } catch (e) {}
        try { const st = await safeLoad("strategies"); if (st) setStrategies(parse(st)); } catch (e) {}
        try { const aa = await safeLoad("activeAssets"); if (aa) setActiveAssets(parse(aa)); } catch (e) {}
        try { const tc = await safeLoad("tickerCodes"); if (tc) setTickerCodes(parse(tc)); } catch (e) {}
      } catch (e) {}
      setLoaded(true);
    };
    load();
  }, []);

  const saveTrades = async (newTrades) => {
    setTrades(newTrades);
    try { await saveData("trades", JSON.stringify(newTrades)); } catch (e) {}
  };

  const addTrade = (t) => saveTrades([t, ...trades]);
  const deleteTrade = (id) => saveTrades(trades.filter(t => t.id !== id));
  const editTrade = (updated) => saveTrades(trades.map(t => t.id === updated.id ? updated : t));

  const saveCashflows = async (newCf) => {
    setCashflows(newCf);
    try { await saveData("cashflows", JSON.stringify(newCf)); } catch (e) {}
  };
  const addCashflow = (cf) => saveCashflows([cf, ...cashflows]);
  const deleteCashflow = (id) => saveCashflows(cashflows.filter(cf => cf.id !== id));

  const saveStrategies = async (newSt) => {
    setStrategies(newSt);
    try { await saveData("strategies", JSON.stringify(newSt)); } catch (e) {}
  };

  const saveActiveAssets = async (newAA) => {
    setActiveAssets(newAA);
    try { await saveData("activeAssets", JSON.stringify(newAA)); } catch (e) {}
  };

  const saveTickerCodes = async (newTC) => {
    setTickerCodes(newTC);
    try { await saveData("tickerCodes", JSON.stringify(newTC)); } catch (e) {}
  };

  const saveCapitals = async () => {
    const parsed = {};
    ACCOUNT_LIST.forEach(a => {
      const draft = capDrafts[a.key] || {};
      const v = parseFloat((draft.amount || "").toString().replace(/,/g, "")) || 0;
      const cur = draft.currency || "₩";
      if (v > 0) parsed[a.key] = { amount: v, currency: cur };
    });
    setCapitals(parsed);
    try { await saveData("capitals", JSON.stringify(parsed)); } catch (e) { console.error("capitals save error", e); }
    setShowCapInput(false);
  };

  // 원금의 통화별 총합 (₩만)
  const totalCapital = Object.values(capitals).reduce((a, v) => {
    const cap = typeof v === "object" ? v : { amount: v, currency: "₩" };
    return cap.currency === "₩" ? a + cap.amount : a;
  }, 0);

  // JSON 내보내기
  const exportJSON = () => {
    const data = { trades, capitals, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "매매일지_" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV 내보내기
  const exportCSV = () => {
    const headers = ["날짜", "종목", "자산", "방향", "레버리지", "진입가", "청산가", "수량", "통화", "손익", "수익률(%)", "감정", "리스크", "메모"];
    const rows = trades.map(t => [
      t.date, t.symbol, t.assetKey, t.dir, t.lev,
      t.entry, t.exit, t.qty, t.currency || "₩",
      t.pnl, t.pct, t.emotion || "", t.risk || "",
      (t.memo || "").replace(/,/g, " ").replace(/\n/g, " ")
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "매매일지_" + todayStr() + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON 가져오기
  const importJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.trades) {
          await saveTrades(data.trades);
          if (data.capitals) {
            setCapitals(data.capitals);
            await saveData("capitals", JSON.stringify(data.capitals));
          }
          setModal({ title: "가져오기 완료", content: <div style={{ fontSize: 14, lineHeight: 1.8 }}>✅ <strong>{data.trades.length}건</strong>의 거래 기록을 불러왔어요!</div> });
        }
      } catch (err) {
        setModal({ title: "오류", content: <div style={{ fontSize: 14, color: s.red }}>❌ 파일을 읽을 수 없어요. JSON 형식을 확인해주세요.</div> });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importRef = useRef();

  // 통화별 손익 집계
  const pnlByCurrency = trades.reduce((acc, t) => {
    const cur = t.currency || "₩";
    acc[cur] = (acc[cur] || 0) + t.pnl;
    return acc;
  }, {});
  const closedTrades = trades.filter(t => t.status === "청산" || t.status === "부분청산" || (t.status !== "홀딩" && t.pnl !== 0));
  const wins = closedTrades.filter(t => t.pnl > 0).length;
  const wr = closedTrades.length ? Math.round(wins / closedTrades.length * 100) : 0;

  // 헬퍼: capitals에서 amount/currency 추출
  const getCapInfo = (key) => {
    const v = capitals[key];
    if (!v) return null;
    if (typeof v === "object") return v;
    return { amount: v, currency: "₩" };
  };

  if (!loaded) return (
    <div style={{ background: s.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <style>{css}</style>
      <div style={{ width: 32, height: 32, border: "3px solid " + s.border, borderTopColor: s.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: s.muted, fontSize: 13 }}>데이터 불러오는 중...</div>
    </div>
  );

  return (
    <div className="app-root" style={{ background: s.bg, minHeight: "100vh", color: s.text, fontFamily: "'Noto Sans KR', sans-serif", display: "flex" }}>
      <style>{css}</style>
      <div className="sidebar">
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid " + s.border, marginBottom: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: s.text, marginBottom: 16 }}>매매일지</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.keys(pnlByCurrency).length === 0 ? (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: s.muted }}>+0₩</div>
            ) : Object.entries(pnlByCurrency).map(([cur, val]) => (
              <div key={cur} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: val >= 0 ? s.green : s.red }}>
                {showKrwMode
                  ? fmt(Math.round(val * (cur === "₩" ? 1 : krwRate[cur] || 1380)), "₩")
                  : fmt(val, cur)}
              </div>
            ))}
            {showKrwMode && Object.keys(pnlByCurrency).length > 1 && (
              <div style={{ fontSize: 11, color: s.muted, marginTop: 2 }}>
                합계: {fmt(Math.round(Object.entries(pnlByCurrency).reduce((a, [c, v]) => a + v * (c === "₩" ? 1 : krwRate[c] || 1380), 0)), "₩")}
              </div>
            )}
            <div style={{ fontSize: 12, color: s.muted, marginTop: 2 }}>승률 <span style={{ color: wr >= 50 ? s.green : s.red, fontWeight: 600 }}>{wr}%</span> · {closedTrades.length}건 청산</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 8,
              background: tab === t.id ? "rgba(0,229,255,0.08)" : "transparent",
              border: "none", color: tab === t.id ? s.accent : s.muted,
              cursor: "pointer", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif",
              fontWeight: tab === t.id ? 700 : 400, width: "100%", textAlign: "left",
              borderLeft: "3px solid " + (tab === t.id ? s.accent : "transparent"),
            }}>
              <span style={{ display: "flex", alignItems: "center" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid " + s.border, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 원화 환산 토글 */}
          <button onClick={() => setShowKrwMode(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: showKrwMode ? "rgba(0,229,255,0.08)" : "none", border: "1px solid " + (showKrwMode ? s.accent : s.border), borderRadius: 8, color: showKrwMode ? s.accent : s.muted, padding: "8px 12px", cursor: "pointer", fontSize: 12, width: "100%", fontFamily: "'Noto Sans KR', sans-serif" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>💱 원화 환산 보기</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>1USD≈{krwRate.USD?.toLocaleString()}₩</span>
          </button>
          <button onClick={() => setIsDark(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "1px solid " + s.border, borderRadius: 8, color: s.muted, padding: "8px 12px", cursor: "pointer", fontSize: 12, width: "100%", fontFamily: "'Noto Sans KR', sans-serif" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{isDark ? "☀️ 라이트 모드" : "🌙 다크 모드"}</span>
          <button onClick={() => { const drafts = {}; ACCOUNT_LIST.forEach(a => { const cap = capitals[a.key]; if (cap) { const info = typeof cap === "object" ? cap : { amount: cap, currency: "₩" }; drafts[a.key] = { amount: info.amount.toLocaleString("ko-KR"), currency: info.currency || "₩" }; } }); setCapDrafts(drafts); setShowCapInput(true); }}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "1px solid " + s.border, borderRadius: 8, color: s.muted, padding: "8px 12px", cursor: "pointer", fontSize: 13, width: "100%", fontFamily: "'Noto Sans KR', sans-serif" }}>
            <Settings size={14} /> 계좌 원금 설정
          </button>
        </div>
      </div>

      {/* 모바일 상단 헤더 */}
      <div className="top-header" style={{ background: s.surface, borderBottom: "1px solid " + s.border, padding: "12px 16px", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, width: "100%" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: s.text }}>매매일지</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: s.muted }}>승률 </span><span style={{ color: wr >= 50 ? s.green : s.red, fontWeight: 600 }}>{wr}%</span>
          </div>
          {Object.keys(pnlByCurrency).length === 0 ? (
            <div style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: s.muted }}>+0₩</div>
          ) : Object.entries(pnlByCurrency).map(([cur, val]) => (
            <div key={cur} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: val >= 0 ? s.green : s.red, fontWeight: 600 }}>{fmt(val, cur)}</div>
          ))}
          <button onClick={() => setIsDark(v => !v)} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 20, padding: "4px 10px", cursor: "pointer", color: s.muted, display: "flex", alignItems: "center", fontSize: 14 }}>{isDark ? "☀️" : "🌙"}</button>
          <button onClick={() => { const drafts = {}; ACCOUNT_LIST.forEach(a => { const cap = capitals[a.key]; if (cap) { const info = typeof cap === "object" ? cap : { amount: cap, currency: "₩" }; drafts[a.key] = { amount: info.amount.toLocaleString("ko-KR"), currency: info.currency || "₩" }; } }); setCapDrafts(drafts); setShowCapInput(true); }} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 20, padding: "4px 10px", cursor: "pointer", color: s.muted, display: "flex", alignItems: "center" }}><Settings size={12} /></button>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* 계좌별 자산 설정 모달 */}
        {showCapInput && (
          <div onClick={() => setShowCapInput(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: s.surface, border: "1px solid " + s.border, borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Wallet size={16} color={s.accent} /> 계좌별 원금 설정</div>
              <div style={{ fontSize: 12, color: s.muted, marginBottom: 20 }}>각 계좌의 시작 원금을 입력하세요.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {ACCOUNT_LIST.filter(a => !activeAssets || activeAssets.includes(a.key)).map(a => {
                  const draft = capDrafts[a.key] || { amount: "", currency: a.currencies[0] };
                  const cur = draft.currency || a.currencies[0];
                  return (
                    <div key={a.key}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{a.icon}</span><span>{a.label}</span>
                        {capitals[a.key] && (() => { const info = typeof capitals[a.key] === "object" ? capitals[a.key] : { amount: capitals[a.key], currency: "₩" }; return <span style={{ marginLeft: "auto", fontSize: 11, color: s.muted }}>{info.amount.toLocaleString("ko-KR")} {info.currency}</span>; })()}
                      </div>
                      {a.currencies.length > 1 && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                          {a.currencies.map(c => (
                            <button key={c} onClick={() => setCapDrafts(d => ({ ...d, [a.key]: { ...((d[a.key]) || {}), currency: c } }))} style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: cur === c ? s.accent : s.surface2, color: cur === c ? "#000" : s.muted }}>{c}</button>
                          ))}
                        </div>
                      )}
                      <input type="text" placeholder={"예: 1,000,000 " + cur + " (미사용시 공란)"} value={draft.amount || ""} onChange={e => setCapDrafts(d => ({ ...d, [a.key]: { ...((d[a.key]) || { currency: a.currencies[0] }), amount: e.target.value } }))} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <Btn onClick={saveCapitals} style={{ flex: 1 }}>저장</Btn>
                <Btn onClick={() => setShowCapInput(false)} variant="ghost" style={{ flex: 1 }}>취소</Btn>
              </div>
            </div>
          </div>
        )}

        <div className="main-content">
          {tab === "dashboard" && <DashboardTab trades={trades} setModal={setModal} capitals={capitals} totalCapital={totalCapital} pnlByCurrency={pnlByCurrency} activeAssets={activeAssets} krwRate={krwRate} showKrwMode={showKrwMode} onSetCapital={() => { const drafts = {}; ACCOUNT_LIST.forEach(a => { const cap = capitals[a.key]; if (cap) { const info = typeof cap === "object" ? cap : { amount: cap, currency: "₩" }; drafts[a.key] = { amount: info.amount.toLocaleString("ko-KR"), currency: info.currency || "₩" }; } }); setCapDrafts(drafts); setShowCapInput(true); }} />}
          {tab === "record" && <RecordTab onAdd={addTrade} strategies={strategies} activeAssets={activeAssets} />}
          {tab === "history" && <HistoryTab trades={trades} onDelete={deleteTrade} onEdit={editTrade} setModal={setModal} activeAssets={activeAssets} tickerCodes={tickerCodes} onSaveTickerCodes={saveTickerCodes} />}
          {tab === "cashflow" && <CashflowTab cashflows={cashflows} trades={trades} onAdd={addCashflow} onDelete={deleteCashflow} activeAssets={activeAssets} />}
          {tab === "stats" && <StatsTab trades={trades} krwRate={krwRate} showKrwMode={showKrwMode} />}
          {tab === "ai" && <AITab trades={trades} />}
          {tab === "settings" && <SettingsTab trades={trades} capitals={capitals} strategies={strategies} onSaveStrategies={saveStrategies} activeAssets={activeAssets} onSaveActiveAssets={saveActiveAssets} onExportJSON={exportJSON} onExportCSV={exportCSV} onImport={() => importRef.current.click()} onSetCapital={() => { const drafts = {}; ACCOUNT_LIST.forEach(a => { const cap = capitals[a.key]; if (cap) { const info = typeof cap === "object" ? cap : { amount: cap, currency: "₩" }; drafts[a.key] = { amount: info.amount.toLocaleString("ko-KR"), currency: info.currency || "₩" }; } }); setCapDrafts(drafts); setShowCapInput(true); }} onClearAll={async () => { await saveTrades([]); setCapitals({}); try { await saveData("capitals", "{}"); } catch(e) {} }} />}
        </div>
        <input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />

        {/* 모바일 하단 탭바 */}
        <div className="bottom-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: s.surface, borderTop: "1px solid " + s.border, zIndex: 50 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", color: tab === t.id ? s.accent : s.muted, padding: "10px 4px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderTop: "2px solid " + (tab === t.id ? s.accent : "transparent") }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 모달 */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: s.surface, borderRadius: 16, border: "1px solid " + s.border, padding: 24, width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{modal.title}</div>
              <button onClick={() => setModal(null)} style={{ background: s.surface2, border: "1px solid " + s.border, color: s.text, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            {modal.content}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardTab({ trades, setModal, capitals, totalCapital, pnlByCurrency, activeAssets, onSetCapital }) {
  const visibleAccounts = ACCOUNT_LIST.filter(a => !activeAssets || activeAssets.includes(a.key));
  const total = trades.length;
  const closedTrades = trades.filter(t => t.status === "청산" || t.status === "부분청산" || (t.status !== "홀딩" && t.pnl !== 0));
  const wins = closedTrades.filter(t => t.pnl > 0).length;
  const losses = closedTrades.filter(t => t.pnl < 0).length;
  const wr = closedTrades.length ? Math.round(wins / closedTrades.length * 100) : 0;
  const avgW = wins ? trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0) / wins : 0;
  const avgL = losses ? Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0) / losses) : 0;
  const rr = avgL > 0 ? (avgW / avgL).toFixed(2) : "-";
  const cumData = []; let running = 0;
  [...trades].reverse().forEach((t, i) => { running += t.pnl; cumData.push({ i: i + 1, pnl: Math.round(running) }); });

  const hasAnyCapital = Object.keys(capitals).length > 0;

  // 파이차트 데이터
  const assetCountMap = {};
  trades.forEach(t => { assetCountMap[t.assetKey] = (assetCountMap[t.assetKey] || 0) + 1; });
  const pieData = Object.entries(assetCountMap).map(([name, value]) => ({ name, value }));

  // 계좌별 손익 집계 (통화별) - 활성화된 자산만
  const accountStats = visibleAccounts.map(a => {
    const acTrades = trades.filter(t => t.assetKey === a.key);
    const acClosed = acTrades.filter(t => t.status === "청산" || t.status === "부분청산" || (t.status !== "홀딩" && t.pnl !== 0));
    const acWins = acClosed.filter(t => t.pnl > 0).length;
    const capRaw = capitals[a.key];
    const capInfo = capRaw ? (typeof capRaw === "object" ? capRaw : { amount: capRaw, currency: "₩" }) : null;
    const capAmount = capInfo ? capInfo.amount : 0;
    const capCur = capInfo ? (capInfo.currency || "₩") : "₩";
    const pnlByCur = acTrades.reduce((acc, t) => {
      const c = t.currency || "₩";
      acc[c] = (acc[c] || 0) + t.pnl;
      return acc;
    }, {});
    const capPnl = pnlByCur[capCur] || 0;
    return { ...a, trades: acTrades.length, closed: acClosed.length, pnlByCur, wins: acWins, capital: capAmount, capitalCur: capCur, current: capAmount + capPnl, returnPct: capAmount > 0 ? (capPnl / capAmount * 100) : null };
  }).filter(a => a.trades > 0 || a.capital > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>

      {/* 자산 현황 - PC에서 가로 4칸 */}
      <Card accent={s.accent3} style={{ padding: 0 }}>
        <div style={{ padding: "14px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: s.muted, display: "flex", alignItems: "center", gap: 6 }}><Wallet size={12} /> 전체 자산 합산</div>
          <button onClick={onSetCapital} style={{ background: "none", border: "1px solid " + s.border, borderRadius: 6, color: s.muted, fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>{hasAnyCapital ? "원금 수정" : "계좌 원금 설정"}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <div style={{ padding: "10px 16px 14px" }}>
            <div style={{ fontSize: 11, color: s.muted, marginBottom: 4 }}>총 원금</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 600 }}>{totalCapital > 0 ? totalCapital.toLocaleString("ko-KR") + "₩" : <span style={{ color: s.muted, fontSize: 12 }}>미설정</span>}</div>
          </div>
          <div style={{ padding: "10px 16px 14px", borderLeft: "1px solid " + s.border }}>
            <div style={{ fontSize: 11, color: s.muted, marginBottom: 4 }}>₩ 현재가</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 600, color: totalCapital > 0 ? ((totalCapital + (pnlByCurrency["₩"] || 0)) >= totalCapital ? s.green : s.red) : s.muted }}>{totalCapital > 0 ? (totalCapital + (pnlByCurrency["₩"] || 0)).toLocaleString("ko-KR") + "₩" : "-"}</div>
          </div>
          <div style={{ padding: "10px 16px 14px", borderLeft: "1px solid " + s.border }}>
            <div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>통화별 손익</div>
            {Object.keys(pnlByCurrency).length === 0
              ? <div style={{ color: s.muted, fontSize: 13 }}>-</div>
              : Object.entries(pnlByCurrency).map(([cur, val]) => (
                <div key={cur} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: val >= 0 ? s.green : s.red }}>{fmt(val, cur)}</div>
              ))}
          </div>
          <div style={{ padding: "10px 16px 14px", borderLeft: "1px solid " + s.border }}>
            <div style={{ fontSize: 11, color: s.muted, marginBottom: 4 }}>총 수익률(₩)</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 700, color: (pnlByCurrency["₩"] || 0) >= 0 ? s.green : s.red }}>{totalCapital > 0 ? fmtPct((pnlByCurrency["₩"] || 0) / totalCapital * 100) : <span style={{ color: s.muted, fontSize: 12 }}>-</span>}</div>
          </div>
        </div>
      </Card>

      {/* 계좌별 카드 - PC에서 2열 */}
      {accountStats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: s.muted, display: "flex", alignItems: "center", gap: 6 }}><Shield size={13} /> 계좌별 현황</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {accountStats.map(a => (
              <div key={a.key} style={{ background: s.surface, border: "1px solid " + s.border, borderRadius: 12, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + a.color + ", transparent)", opacity: 0.8 }} />
                <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid " + s.border }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</span>
                    <span style={{ fontSize: 11, color: s.muted }}>{a.trades}건</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {Object.entries(a.pnlByCur).map(([cur, val]) => (
                      <div key={cur} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700, color: val >= 0 ? s.green : s.red }}>{fmt(Math.round(val * 100) / 100, cur)}</div>
                    ))}
                    {a.returnPct !== null && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: a.returnPct >= 0 ? s.green : s.red }}>{fmtPct(a.returnPct)}</div>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "8px 0" }}>
                  <div style={{ padding: "4px 14px", borderRight: "1px solid " + s.border }}>
                    <div style={{ fontSize: 10, color: s.muted }}>원금</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginTop: 2 }}>{a.capital > 0 ? fmt(a.capital, a.capitalCur) : <span style={{ color: s.muted }}>-</span>}</div>
                  </div>
                  <div style={{ padding: "4px 14px", borderRight: "1px solid " + s.border }}>
                    <div style={{ fontSize: 10, color: s.muted }}>현재</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginTop: 2, color: a.capital > 0 ? (a.current >= a.capital ? s.green : s.red) : s.text }}>{a.capital > 0 ? fmt(a.current, a.capitalCur) : <span style={{ color: s.muted }}>-</span>}</div>
                  </div>
                  <div style={{ padding: "4px 14px" }}>
                    <div style={{ fontSize: 10, color: s.muted }}>승률</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginTop: 2, color: a.closed > 0 ? (Math.round(a.wins / a.closed * 100) >= 50 ? s.green : s.red) : s.muted }}>{a.closed > 0 ? Math.round(a.wins / a.closed * 100) + "%" : "-"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 통계 카드 - PC에서 4열 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        <StatCard label="승률" value={wr + "%"} bar={wr} />
        <StatCard label="손익비" value={rr} sub="Avg Win / Avg Loss" />
        <StatCard label="총 거래" value={total} sub={total ? "최근 " + trades[0].date : "-"} />
        <StatCard label="수익/손실" value={wins + "/" + losses} sub="건" color={wins >= losses ? s.green : s.red} />
      </div>

      {/* 차트 + 파이차트 - PC에서 2열 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Activity size={13} /> 누적 손익 추이</div>
          {cumData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cumData}>
                <XAxis dataKey="i" hide /><YAxis hide />
                <Tooltip contentStyle={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 8, fontSize: 12 }} formatter={(v) => [fmt(v), "누적손익"]} labelFormatter={() => ""} />
                <Line type="monotone" dataKey="pnl" stroke={s.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={{ textAlign: "center", color: s.muted, padding: "48px 0", fontSize: 13 }}>거래를 기록하면 차트가 나타납니다</div>}
        </Card>

        {pieData.length > 0 && (
          <Card>
            <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><BarChart2 size={13} /> 자산별 비중</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <PieChart width={140} height={140}><Pie data={pieData} cx={65} cy={65} innerRadius={35} outerRadius={65} dataKey="value" paddingAngle={2}>{pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {pieData.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} /><span style={{ color: s.muted }}>{d.name}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", marginLeft: "auto" }}>{d.value}건</span></div>)}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 최근 거래 - PC에서 다열 그리드 */}
      <Card>
        <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={13} /> 최근 거래</div>
        {!trades.length ? <div style={{ textAlign: "center", color: s.muted, padding: "20px 0", fontSize: 13 }}>기록된 거래가 없습니다</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
            {trades.slice(0, 6).map(t => (
              <div key={t.id} onClick={() => setModal({ title: t.symbol, content: <TradeDetail t={t} /> })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: s.surface2, borderRadius: 8, cursor: "pointer" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{t.symbol}</span><Badge type={t.dir} /><Badge type={t.assetKey && t.assetKey.includes("암호") ? "crypto" : "stock"} /></div>
                  <div style={{ fontSize: 11, color: s.muted }}>{t.date}{t.emotion ? " • " + t.emotion : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? s.green : s.red }}>{fmt(t.pnl, t.currency)}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: t.pct >= 0 ? s.green : s.red }}>{fmtPct(t.pct)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// LegRow는 반드시 컴포넌트 밖에 정의해야 포커스가 안 날아감
function LegRow({ leg, onChange, onRemove, canRemove, label }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr 1fr auto", gap: 8, alignItems: "end" }}>
      <FormField label={label + " 날짜"}><input type="date" value={leg.date} onChange={e => onChange("date", e.target.value)} /></FormField>
      <FormField label="시간(선택)"><input type="text" placeholder="09:30" value={leg.time} onChange={e => onChange("time", e.target.value)} style={{ fontSize: 13 }} /></FormField>
      <FormField label="가격"><input type="number" placeholder="0" value={leg.price} onChange={e => onChange("price", e.target.value)} /></FormField>
      <FormField label="수량"><input type="number" placeholder="0" value={leg.qty} onChange={e => onChange("qty", e.target.value)} /></FormField>
      {canRemove
        ? <button onClick={onRemove} style={{ background: "rgba(255,61,113,0.1)", border: "1px solid rgba(255,61,113,0.3)", color: s.red, width: 36, height: 36, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 22, flexShrink: 0 }}><X size={13} /></button>
        : <div style={{ width: 36 }} />}
    </div>
  );
}

function RecordTab({ onAdd, strategies, activeAssets }) {
  // 활성화된 자산만 필터링
  const visibleAssets = ASSETS.filter((_, i) => !activeAssets || activeAssets.includes(ASSET_KEYS[i]));
  const visibleAssetKeys = ASSET_KEYS.filter(k => !activeAssets || activeAssets.includes(k));
  const defaultAssetIdx = ASSET_KEYS.indexOf(visibleAssetKeys[visibleAssetKeys.length - 1] || ASSET_KEYS[0]);
  const emptyLeg = () => ({ date: todayStr(), time: "", price: "", qty: "" });
  const [entries, setEntries] = useState([emptyLeg()]);
  const [exits, setExits] = useState([]);
  const [meta, setMeta] = useState({
    assetIdx: defaultAssetIdx, symbol: "", dir: "롱", lev: "1", sl: "", tp: "",
    risk: 5, emotion: "", memo: "", currency: "₩",
    entryZone: "", slType: "", slHit: "", stophunt: ""
  });
  const [saved, setSaved] = useState(false);
  const [imgBase64, setImgBase64] = useState(null);
  const [imgMime, setImgMime] = useState("image/jpeg");
  const [imgPreview, setImgPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const fileRef = useRef();

  const setM = (k, v) => setMeta(f => ({ ...f, [k]: v }));
  const isFutures = ASSET_KEYS[meta.assetIdx] === "암호화폐(선물)";
  const lev = isFutures ? (parseFloat(meta.lev) || 1) : 1;
  const [showSlTp, setShowSlTp] = useState(false);

  // 자산별 사용 가능한 통화
  const assetKey = ASSET_KEYS[meta.assetIdx];
  const availableCurrencies = assetKey === "국내주식" ? ["₩"]
    : assetKey === "해외주식" ? ["₩", "USD"]
    : ["₩", "USDT"]; // 암호화폐 현물/선물

  // 평균 진입가 / 총 진입수량
  const totalEntryQty = entries.reduce((a, e) => a + (parseFloat(e.qty) || 0), 0);
  const avgEntry = totalEntryQty > 0
    ? entries.reduce((a, e) => a + (parseFloat(e.price) || 0) * (parseFloat(e.qty) || 0), 0) / totalEntryQty
    : 0;

  // 평균 청산가 / 총 청산수량
  const totalExitQty = exits.reduce((a, e) => a + (parseFloat(e.qty) || 0), 0);
  const avgExit = totalExitQty > 0
    ? exits.reduce((a, e) => a + (parseFloat(e.price) || 0) * (parseFloat(e.qty) || 0), 0) / totalExitQty
    : 0;

  // 손익 계산 (청산된 수량만)
  const closedQty = Math.min(totalEntryQty, totalExitQty);
  const rawPnl = avgEntry > 0 && avgExit > 0 && closedQty > 0
    ? (meta.dir === "숏" ? (avgEntry - avgExit) : (avgExit - avgEntry)) * closedQty * lev
    : 0;
  const pnl = Math.round(rawPnl * 100) / 100;
  const pct = avgEntry > 0 && avgExit > 0
    ? ((meta.dir === "숏" ? (avgEntry - avgExit) : (avgExit - avgEntry)) / avgEntry) * 100 * lev
    : 0;
  const invested = avgEntry * totalEntryQty;

  const isFullyClosed = totalExitQty >= totalEntryQty && totalEntryQty > 0;
  const isPartial = totalExitQty > 0 && totalExitQty < totalEntryQty;
  const status = isFullyClosed ? "청산" : (isPartial ? "부분청산" : "홀딩");

  // 레그 수정
  const setEntry = (i, k, v) => setEntries(es => es.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const setExit = (i, k, v) => setExits(es => es.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const addEntry = () => setEntries(es => [...es, emptyLeg()]);
  const addExit = () => setExits(es => [...es, emptyLeg()]);
  const removeEntry = (i) => setEntries(es => es.filter((_, idx) => idx !== i));
  const removeExit = (i) => setExits(es => es.filter((_, idx) => idx !== i));

  const handleImg = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const mime = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = (ev) => { setImgPreview(ev.target.result); setImgBase64(ev.target.result.split(",")[1]); setImgMime(mime); setScanMsg(""); };
    reader.readAsDataURL(file);
  };

  const scanImage = async () => {
    if (!imgBase64) return;
    setScanning(true); setScanMsg("이미지 분석 중...");
    const validMime = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(imgMime) ? imgMime : "image/jpeg";
    const prompt = "이 트레이딩 캡처 이미지에서 매매 정보를 추출하여 다음 JSON 형식으로만 응답하세요. 추출 불가는 null:\n{\"symbol\":\"종목명\",\"dir\":\"롱 또는 숏\",\"entry\":숫자,\"exit\":숫자,\"qty\":숫자,\"lev\":숫자,\"date\":\"YYYY-MM-DD\",\"currency\":\"₩ 또는 USD 또는 USDT\",\"assetKey\":\"국내주식 또는 해외주식 또는 암호화폐(현물) 또는 암호화폐(선물)\",\"memo\":\"특이사항\"}";
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: validMime, data: imgBase64 } }, { type: "text", text: prompt }] }] }) });
      const data = await res.json();
      const raw = data.content?.map(c => c.text || "").join("") || "";
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("파싱 실패");
      const p = JSON.parse(m[0]);
      if (p.symbol) setM("symbol", p.symbol);
      if (p.dir === "롱" || p.dir === "숏") setM("dir", p.dir);
      if (p.currency && CURRENCIES.includes(p.currency)) setM("currency", p.currency);
      if (p.assetKey) { const idx = ASSET_KEYS.indexOf(p.assetKey); if (idx >= 0) setM("assetIdx", idx); }
      if (p.lev) setM("lev", String(p.lev));
      if (p.memo) setM("memo", p.memo);
      if (p.entry || p.qty) setEntries([{ date: p.date || todayStr(), time: "", price: p.entry ? String(p.entry) : "", qty: p.qty ? String(p.qty) : "" }]);
      if (p.exit && p.qty) setExits([{ date: p.date || todayStr(), time: "", price: String(p.exit), qty: p.qty ? String(p.qty) : "" }]);
      setScanMsg("✅ AI 자동완성! 날짜/시간/수량 확인 후 저장하세요.");
    } catch (e) { setScanMsg("⚠️ 일부 정보를 읽지 못했어요. 직접 입력해주세요."); }
    setScanning(false);
  };

  const handleSave = () => {
    if (!meta.symbol.trim()) { alert("종목명을 입력해주세요"); return; }
    if (!entries[0].price || !entries[0].qty) { alert("진입가와 수량을 입력해주세요"); return; }
    const firstDate = entries[0].date || todayStr();
    const entryList = entries.map(e => ({ ...e, price: parseFloat(e.price) || 0, qty: parseFloat(e.qty) || 0 }));
    const totalQty = entryList.reduce((a, e) => a + e.qty, 0);
    const avgEntryPrice = totalQty > 0 ? entryList.reduce((a, e) => a + e.price * e.qty, 0) / totalQty : 0;
    const trade = {
      id: Date.now(),
      date: firstDate,
      assetKey: ASSET_KEYS[meta.assetIdx],
      symbol: meta.symbol.trim(),
      dir: meta.dir,
      currency: meta.currency,
      lev: isFutures ? (parseFloat(meta.lev) || 1) : 1,
      sl: parseFloat(meta.sl) || null,
      tp: parseFloat(meta.tp) || null,
      risk: meta.risk,
      emotion: meta.emotion,
      memo: meta.memo,
      chartImg: imgBase64 || null,
      status: "홀딩",
      entries: entryList,
      exits: [],
      entry: Math.round(avgEntryPrice * 100) / 100,
      exit: null,
      qty: totalQty,
      pnl: 0, pct: 0,
      entryZone: meta.entryZone, slType: meta.slType,
      slHit: meta.slHit, stophunt: meta.stophunt
    };
    onAdd(trade);
    setSaved(true);
    setImgBase64(null); setImgPreview(null); setScanMsg("");
    setTimeout(() => setSaved(false), 2000);
    setEntries([emptyLeg()]);
    setMeta(m => ({ ...m, symbol: "", lev: "1", sl: "", tp: "", risk: 5, emotion: "", memo: "", entryZone: "", slType: "", slHit: "", stophunt: "" }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>
      {/* AI 캡처 */}
      <Card accent="#7b2fff">
        <div style={{ fontSize: 11, color: "#7b2fff", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Bot size={13} /> AI 자동 기록 (캡처 업로드)</div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImg} style={{ display: "none" }} />
        {!imgPreview ? (
          <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: 20, border: "2px dashed " + s.border, borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: s.muted }}>
            <div style={{ fontSize: 28 }}>📸</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>거래 캡처 이미지 업로드</div>
            <div style={{ fontSize: 11 }}>트레이딩뷰, 바이낸스, 업비트, 키움 등</div>
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <img src={imgPreview} alt="캡처" style={{ width: "100%", borderRadius: 8, maxHeight: 200, objectFit: "cover" }} />
              <button onClick={() => { setImgPreview(null); setImgBase64(null); setScanMsg(""); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
            </div>
            <Btn onClick={scanImage} variant="ai" disabled={scanning} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {scanning ? <><RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> 분석 중...</> : <><Zap size={14} /> AI로 자동 기록하기</>}
            </Btn>
            {scanMsg && <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: scanMsg.startsWith("✅") ? "rgba(0,230,118,0.1)" : "rgba(255,224,102,0.1)", color: scanMsg.startsWith("✅") ? s.green : s.accent3, border: "1px solid " + (scanMsg.startsWith("✅") ? "rgba(0,230,118,0.3)" : "rgba(255,224,102,0.3)") }}>{scanMsg}</div>}
            <button onClick={() => fileRef.current.click()} style={{ background: "none", border: "1px solid " + s.border, borderRadius: 8, color: s.muted, fontSize: 12, padding: 8, cursor: "pointer" }}>다른 이미지로 변경</button>
          </div>
        )}
      </Card>

      {/* 기본 정보 */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isFutures && (
            <FormField label="방향">
              <div style={{ display: "flex", gap: 8 }}>
                {["롱", "숏"].map(d => <button key={d} onClick={() => setM("dir", d)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", background: meta.dir === d ? (d === "롱" ? s.green : s.red) : s.surface2, color: meta.dir === d ? "#000" : s.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{d === "롱" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{d}</button>)}
              </div>
            </FormField>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isFutures ? "1fr 1fr" : "1fr", gap: 12 }}>
            {availableCurrencies.length > 1 && (
              <FormField label="통화">
                <div style={{ display: "flex", gap: 6 }}>
                  {availableCurrencies.map(c => <button key={c} onClick={() => setM("currency", c)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: meta.currency === c ? s.accent : s.surface2, color: meta.currency === c ? "#000" : s.muted }}>{c}</button>)}
                </div>
              </FormField>
            )}
            {isFutures && <FormField label="레버리지"><input type="number" placeholder="1" min="1" value={meta.lev} onChange={e => setM("lev", e.target.value)} /></FormField>}
          </div>
          <FormField label="자산 유형"><select value={meta.assetIdx} onChange={e => {
            const idx = parseInt(e.target.value);
            const key = ASSET_KEYS[idx];
            const curs = key === "국내주식" ? ["₩"] : key === "해외주식" ? ["₩", "USD"] : ["₩", "USDT"];
            setMeta(f => ({ ...f, assetIdx: idx, currency: curs.includes(f.currency) ? f.currency : curs[0] }));
          }}>{visibleAssets.map((a, i) => { const realIdx = ASSET_KEYS.indexOf(visibleAssetKeys[i]); return <option key={realIdx} value={realIdx}>{a}</option>; })}</select></FormField>
          <FormField label="종목명"><input placeholder="예: 삼성전자, AAPL, BTC/USDT" value={meta.symbol} onChange={e => setM("symbol", e.target.value)} /></FormField>
        </div>
      </Card>

      {/* 진입 정보 */}
      <Card accent={s.green}>
        <div style={{ fontSize: 11, color: s.green, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><TrendingUp size={13} /> 첫 진입</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((leg, i) => (
            <LegRow key={i} leg={leg} label={"진입" + (entries.length > 1 ? (i + 1) : "")} onChange={(k, v) => setEntry(i, k, v)} onRemove={() => removeEntry(i)} canRemove={entries.length > 1} />
          ))}
        </div>
        <button onClick={addEntry} style={{ marginTop: 10, width: "100%", padding: "8px 0", background: "rgba(0,230,118,0.06)", border: "1px dashed rgba(0,230,118,0.4)", borderRadius: 8, color: s.green, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>+ 분할진입 추가</button>
      </Card>

      {/* 추가 설정 */}
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <button onClick={() => setShowSlTp(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px dashed " + s.border, borderRadius: 8, color: s.muted, padding: "8px 14px", cursor: "pointer", fontSize: 12, width: "fit-content" }}>
            <span>{showSlTp ? "▲" : "▼"}</span>
            {showSlTp ? "손절가/목표가 닫기" : "손절가/목표가 입력"}
          </button>
          {showSlTp && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="손절가"><input type="number" placeholder="0" value={meta.sl} onChange={e => setM("sl", e.target.value)} /></FormField>
              <FormField label="목표가"><input type="number" placeholder="0" value={meta.tp} onChange={e => setM("tp", e.target.value)} /></FormField>
            </div>
          )}
          <FormField label={"리스크 체감: " + meta.risk + "/10"}>
            <input type="range" min="1" max="10" value={meta.risk} onChange={e => setM("risk", parseInt(e.target.value))} style={{ background: "linear-gradient(90deg, " + s.accent + " " + (meta.risk * 10) + "%, " + s.border + " " + (meta.risk * 10) + "%)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: s.muted, marginTop: 2 }}><span>낮음</span><span>높음</span></div>
          </FormField>
          <FormField label="매매 감정">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EMOTIONS.map(e => <button key={e.value} onClick={() => setM("emotion", meta.emotion === e.value ? "" : e.value)} style={{ background: meta.emotion === e.value ? s.accent : s.surface2, border: "1px solid " + (meta.emotion === e.value ? s.accent : s.border), color: meta.emotion === e.value ? "#000" : s.text, padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: meta.emotion === e.value ? 700 : 400, fontFamily: "'Noto Sans KR', sans-serif" }}>{e.label}</button>)}
            </div>
          </FormField>
          <FormField label="진입 근거 / 메모"><textarea placeholder="진입 이유, 시장 상황, 기대 시나리오..." value={meta.memo} onChange={e => setM("memo", e.target.value)} /></FormField>
        </div>
      </Card>

      {/* 백테스팅 전략 */}
      <Card accent={s.accent3}>
        <div style={{ fontSize: 11, color: s.accent3, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Target size={13} /> 백테스팅 전략 기록 (선택)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FormField label="진입 구간">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(strategies?.entryZones || []).map(v => (
                <button key={v} onClick={() => setM("entryZone", meta.entryZone === v ? "" : v)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (meta.entryZone === v ? s.accent3 : s.border), background: meta.entryZone === v ? "rgba(255,224,102,0.15)" : "transparent", color: meta.entryZone === v ? s.accent3 : s.muted, fontSize: 12, cursor: "pointer", fontWeight: meta.entryZone === v ? 700 : 400, fontFamily: "'Noto Sans KR', sans-serif" }}>{v}</button>
              ))}
            </div>
          </FormField>
          <FormField label="손절 유형">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(strategies?.slTypes || []).map(v => (
                <button key={v} onClick={() => setM("slType", meta.slType === v ? "" : v)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (meta.slType === v ? s.red : s.border), background: meta.slType === v ? "rgba(255,61,113,0.1)" : "transparent", color: meta.slType === v ? s.red : s.muted, fontSize: 12, cursor: "pointer", fontWeight: meta.slType === v ? 700 : 400, fontFamily: "'Noto Sans KR', sans-serif" }}>{v}</button>
              ))}
            </div>
          </FormField>
          <FormField label="손절 맞았나요?">
            <div style={{ display: "flex", gap: 8 }}>
              {[["미청산/홀딩", s.muted], ["손절 안 맞음", s.green], ["손절 맞음", s.red]].map(([v, c]) => (
                <button key={v} onClick={() => setM("slHit", meta.slHit === v ? "" : v)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid " + (meta.slHit === v ? c : s.border), background: meta.slHit === v ? c + "22" : "transparent", color: meta.slHit === v ? c : s.muted, fontSize: 12, cursor: "pointer", fontWeight: meta.slHit === v ? 700 : 400, fontFamily: "'Noto Sans KR', sans-serif" }}>{v}</button>
              ))}
            </div>
          </FormField>
          {meta.slHit === "손절 맞음" && (
            <FormField label="손절 후 가격 방향">
              <div style={{ display: "flex", gap: 8 }}>
                {[["원래 방향으로 돌아감 (스탑헌팅)", s.accent3], ["계속 반대 방향 (정상 손절)", s.muted]].map(([v, c]) => (
                  <button key={v} onClick={() => setM("stophunt", meta.stophunt === v ? "" : v)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "1px solid " + (meta.stophunt === v ? c : s.border), background: meta.stophunt === v ? c + "22" : "transparent", color: meta.stophunt === v ? c : s.muted, fontSize: 11, cursor: "pointer", fontWeight: meta.stophunt === v ? 700 : 400, fontFamily: "'Noto Sans KR', sans-serif", textAlign: "center" }}>{v}</button>
                ))}
              </div>
            </FormField>
          )}
        </div>
      </Card>

      <Btn onClick={handleSave} style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Save size={15} />{saved ? "저장완료!" : "기록 저장"}
      </Btn>
    </div>
  );
}

function HistoryTab({ trades, onDelete, onEdit, setModal, activeAssets, tickerCodes, onSaveTickerCodes }) {
  const visibleAssetKeys = ASSET_KEYS.filter(k => !activeAssets || activeAssets.includes(k));
  const [filter, setFilter] = useState({ asset: "", dir: "", result: "", symbol: "" });
  const [confirmId, setConfirmId] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [addLegTarget, setAddLegTarget] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [codeInputs, setCodeInputs] = useState({});
  const set = (k, v) => setFilter(f => ({ ...f, [k]: v }));

  const getPriceType = (t) => {
    if (t.assetKey === "암호화폐(현물)" || t.assetKey === "암호화폐(선물)") return "crypto";
    if (t.assetKey === "해외주식") return "foreign";
    return "korean";
  };

  const fetchPrice = async (t) => {
    const type = getPriceType(t);
    const code = tickerCodes?.[t.symbol];
    if (type === "korean" && !code) {
      setLivePrices(p => ({ ...p, [t.id]: { loading: false, needCode: true } }));
      return;
    }
    setLivePrices(p => ({ ...p, [t.id]: { loading: true } }));
    try {
      const params = new URLSearchParams({ type, symbol: t.symbol });
      if (type === "korean") params.set("code", code);
      const res = await fetch("/api/price?" + params.toString());
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLivePrices(p => ({ ...p, [t.id]: { price: data.price, loading: false } }));
    } catch (e) {
      setLivePrices(p => ({ ...p, [t.id]: { loading: false, error: e.message } }));
    }
  };

  const saveCode = (t) => {
    const code = (codeInputs[t.symbol] || "").trim();
    if (!code) return;
    const newCodes = { ...tickerCodes, [t.symbol]: code };
    onSaveTickerCodes(newCodes);
    setCodeInputs(c => ({ ...c, [t.symbol]: "" }));
    // 코드 저장 후 바로 조회
    setTimeout(() => fetchPrice({ ...t }), 100);
  };

  const filtered = trades.filter(t => {
    if (filter.asset && t.assetKey !== filter.asset) return false;
    if (filter.dir && t.dir !== filter.dir) return false;
    if (filter.result === "win" && t.pnl <= 0) return false;
    if (filter.result === "loss" && t.pnl >= 0) return false;
    if (filter.symbol && !t.symbol.toLowerCase().includes(filter.symbol.toLowerCase())) return false;
    return true;
  });

  const handleAddLeg = (trade, type, leg) => {
    const newLeg = { date: leg.date, time: leg.time, price: parseFloat(leg.price) || 0, qty: parseFloat(leg.qty) || 0, memo: leg.memo || "" };
    const entries = [...(trade.entries || [{ date: trade.date, time: "", price: trade.entry || 0, qty: trade.qty || 0 }])];
    const exits = [...(trade.exits || (trade.exit ? [{ date: trade.date, time: "", price: trade.exit, qty: trade.qty || 0 }] : []))];

    if (type === "entry") entries.push(newLeg);
    else exits.push(newLeg);

    // 재계산
    const totalEQty = entries.reduce((a, e) => a + e.qty, 0);
    const avgEntry = totalEQty > 0 ? entries.reduce((a, e) => a + e.price * e.qty, 0) / totalEQty : 0;
    const totalXQty = exits.reduce((a, e) => a + e.qty, 0);
    const avgExit = totalXQty > 0 ? exits.reduce((a, e) => a + e.price * e.qty, 0) / totalXQty : 0;
    const lev = trade.lev || 1;
    const closedQty = Math.min(totalEQty, totalXQty);
    const pnl = avgEntry > 0 && avgExit > 0 && closedQty > 0
      ? Math.round(((trade.dir === "숏" ? (avgEntry - avgExit) : (avgExit - avgEntry)) * closedQty * lev) * 100) / 100
      : 0;
    const pct = avgEntry > 0 && avgExit > 0
      ? Math.round(((trade.dir === "숏" ? (avgEntry - avgExit) : (avgExit - avgEntry)) / avgEntry * 100 * lev) * 100) / 100
      : 0;
    const isFullyClosed = totalXQty >= totalEQty && totalEQty > 0;
    const isPartial = totalXQty > 0 && totalXQty < totalEQty;
    const status = isFullyClosed ? "청산" : (isPartial ? "부분청산" : "홀딩");

    const updated = { ...trade, entries, exits, entry: Math.round(avgEntry * 100) / 100, exit: (isFullyClosed || isPartial) ? Math.round(avgExit * 100) / 100 : null, qty: totalEQty, pnl, pct, status };
    onEdit(updated);
    setAddLegTarget(null);
  };

  if (editTarget) {
    return <EditTradeForm trade={editTarget} onSave={(updated) => { onEdit(updated); setEditTarget(null); }} onCancel={() => setEditTarget(null)} />;
  }

  if (addLegTarget) {
    return <AddLegForm trade={addLegTarget.trade} type={addLegTarget.type} onSave={(leg) => handleAddLeg(addLegTarget.trade, addLegTarget.type, leg)} onCancel={() => setAddLegTarget(null)} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select value={filter.asset} onChange={e => set("asset", e.target.value)}><option value="">전체 자산</option>{visibleAssetKeys.map(k => <option key={k} value={k}>{k}</option>)}</select>
        <select value={filter.dir} onChange={e => set("dir", e.target.value)}><option value="">전체 방향</option><option value="롱">롱</option><option value="숏">숏</option></select>
        <select value={filter.result} onChange={e => set("result", e.target.value)}><option value="">전체 결과</option><option value="win">수익</option><option value="loss">손실</option></select>
        <input placeholder="종목 검색..." value={filter.symbol} onChange={e => set("symbol", e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: s.muted }}>총 {filtered.length}건</div>
      {filtered.length === 0
        ? <Card><div style={{ textAlign: "center", color: s.muted, padding: "32px 0", fontSize: 13 }}>해당하는 거래가 없습니다</div></Card>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(t => (
              <Card key={t.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }} onClick={() => setModal({ title: t.symbol, content: <TradeDetail t={t} onEdit={(updated) => { onEdit(updated); setModal(null); }} /> })}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{t.symbol}</span>
                      <Badge type={t.dir} />
                      {t.lev > 1 && <span style={{ fontSize: 10, color: s.muted }}>{t.lev}x</span>}
                      {t.status === "홀딩" && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(255,224,102,0.15)", color: s.accent3, border: "1px solid rgba(255,224,102,0.3)", fontWeight: 700 }}>홀딩중</span>}
                      {t.status === "부분청산" && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(0,229,255,0.1)", color: s.accent, border: "1px solid rgba(0,229,255,0.2)", fontWeight: 700 }}>부분청산</span>}
                    </div>
                    <div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>{t.date} • {t.assetKey}</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <div><div style={{ fontSize: 10, color: s.muted }}>진입가</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{t.entry?.toLocaleString()}</div></div>
                      {(() => {
                        const totalE = t.entries ? t.entries.reduce((a, e) => a + (e.qty || 0), 0) : (t.qty || 0);
                        const totalX = t.exits ? t.exits.reduce((a, e) => a + (e.qty || 0), 0) : 0;
                        const remaining = Math.max(0, totalE - totalX);
                        return t.status === "청산"
                          ? <div><div style={{ fontSize: 10, color: s.muted }}>총수량</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{totalE}</div></div>
                          : <div><div style={{ fontSize: 10, color: s.muted }}>보유</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: s.accent3, fontWeight: 700 }}>{remaining}<span style={{ fontSize: 10, color: s.muted, fontWeight: 400 }}> / {totalE}</span></div></div>;
                      })()}
                      {t.exit && <div><div style={{ fontSize: 10, color: s.muted }}>청산가</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{t.exit.toLocaleString()}</div></div>}
                      {t.status !== "홀딩" && <>
                        <div><div style={{ fontSize: 10, color: s.muted }}>손익</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? s.green : s.red }}>{fmt(t.pnl, t.currency)}</div></div>
                        <div><div style={{ fontSize: 10, color: s.muted }}>수익률</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: t.pct >= 0 ? s.green : s.red }}>{fmtPct(t.pct)}</div></div>
                      </>}
                    </div>
                    {/* 추가 진입/청산 버튼 */}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      <button onClick={e => { e.stopPropagation(); setAddLegTarget({ trade: t, type: "entry" }); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(0,230,118,0.4)", background: "rgba(0,230,118,0.08)", color: s.green, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>+ 추가진입</button>
                      <button onClick={e => { e.stopPropagation(); setAddLegTarget({ trade: t, type: "exit" }); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,61,113,0.4)", background: "rgba(255,61,113,0.08)", color: s.red, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>+ 청산추가</button>
                      {/* 현재가 조회 버튼 - 홀딩/부분청산만 */}
                      {(t.status === "홀딩" || t.status === "부분청산") && (
                        <button onClick={e => { e.stopPropagation(); fetchPrice(t); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(123,47,255,0.4)", background: "rgba(123,47,255,0.08)", color: "#b47aff", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          {livePrices[t.id]?.loading ? "조회중..." : "📡 현재가"}
                        </button>
                      )}
                    </div>

                    {/* 현재가 / 미실현 손익 표시 */}
                    {livePrices[t.id] && !livePrices[t.id].loading && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 8 }}>
                        {livePrices[t.id].needCode || livePrices[t.id].error === "종목코드 필요" ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              placeholder="종목코드 입력 (예: 005180)"
                              value={codeInputs[t.symbol] || ""}
                              onChange={e => setCodeInputs(c => ({ ...c, [t.symbol]: e.target.value }))}
                              onKeyDown={e => e.key === "Enter" && saveCode(t)}
                              style={{ flex: 1, fontSize: 12, padding: "6px 10px" }}
                            />
                            <button onClick={() => saveCode(t)} style={{ padding: "6px 12px", background: "#7b2fff", border: "none", color: "#fff", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>저장 후 조회</button>
                          </div>
                        ) : livePrices[t.id].error ? (
                          <div style={{ fontSize: 11, color: s.red, padding: "4px 8px", background: "rgba(255,61,113,0.08)", borderRadius: 6 }}>⚠️ {livePrices[t.id].error}</div>
                        ) : (() => {
                          const cur = t.currency || "₩";
                          const currentPrice = livePrices[t.id].price;
                          const totalEQty = t.entries ? t.entries.reduce((a, e) => a + (e.qty || 0), 0) : (t.qty || 0);
                          const totalXQty = t.exits ? t.exits.reduce((a, e) => a + (e.qty || 0), 0) : 0;
                          const holdingQty = Math.max(0, totalEQty - totalXQty);
                          const dir = t.dir || "롱";
                          const unrealized = (dir === "숏" ? (t.entry - currentPrice) : (currentPrice - t.entry)) * holdingQty * (t.lev || 1);
                          const unrealizedPct = t.entry > 0 ? ((dir === "숏" ? (t.entry - currentPrice) : (currentPrice - t.entry)) / t.entry) * 100 * (t.lev || 1) : 0;
                          return (
                            <div style={{ padding: "8px 12px", background: unrealized >= 0 ? "rgba(0,230,118,0.08)" : "rgba(255,61,113,0.08)", border: "1px solid " + (unrealized >= 0 ? "rgba(0,230,118,0.25)" : "rgba(255,61,113,0.25)"), borderRadius: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                              <div><div style={{ fontSize: 9, color: s.muted }}>현재가</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700 }}>{currentPrice.toLocaleString()}</div></div>
                              <div><div style={{ fontSize: 9, color: s.muted }}>미실현 손익</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: unrealized >= 0 ? s.green : s.red }}>{fmt(Math.round(unrealized), cur)}</div></div>
                              <div><div style={{ fontSize: 9, color: s.muted }}>수익률</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: unrealizedPct >= 0 ? s.green : s.red }}>{fmtPct(unrealizedPct)}</div></div>
                              <div><div style={{ fontSize: 9, color: s.muted }}>보유수량</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{holdingQty}</div></div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {t.emotion && <div style={{ marginTop: 6, fontSize: 11, color: s.muted }}>{t.emotion}</div>}
                  </div>

                  {/* 수정/삭제 버튼 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    {confirmId === t.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                        <div style={{ fontSize: 11, color: s.muted, marginBottom: 2 }}>삭제할까요?</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => { onDelete(t.id); setConfirmId(null); }} style={{ background: s.red, border: "none", color: "#fff", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>삭제</button>
                          <button onClick={() => setConfirmId(null)} style={{ background: s.surface2, border: "1px solid " + s.border, color: s.muted, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setEditTarget(t)} style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.3)", color: s.accent, width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PenLine size={13} /></button>
                        <button onClick={() => setConfirmId(t.id)} style={{ background: "rgba(255,61,113,0.1)", border: "1px solid rgba(255,61,113,0.3)", color: s.red, width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );
}

function AddLegForm({ trade, type, onSave, onCancel }) {
  const [leg, setLeg] = useState({ date: todayStr(), time: "", price: "", qty: "", memo: "" });
  const setL = (k, v) => setLeg(f => ({ ...f, [k]: v }));
  const isEntry = type === "entry";
  const color = isEntry ? s.green : s.red;
  const label = isEntry ? "추가 진입" : "청산";

  const handleSave = () => {
    if (!leg.price || !leg.qty) { alert("가격과 수량을 입력해주세요"); return; }
    onSave(leg);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onCancel} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 8, color: s.muted, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>← 취소</button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{trade.symbol} — {label} 기록</div>
      </div>

      {/* 현재 포지션 현황 */}
      <Card>
        <div style={{ fontSize: 11, color: s.muted, marginBottom: 10 }}>현재 포지션</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px,1fr))", gap: 10 }}>
          <div><div style={{ fontSize: 10, color: s.muted }}>종목</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700 }}>{trade.symbol}</div></div>
          {(trade.dir === "롱" || trade.dir === "숏") && <div><div style={{ fontSize: 10, color: s.muted }}>방향</div><div style={{ fontSize: 13, color: trade.dir === "롱" ? s.green : s.red, fontWeight: 700 }}>{trade.dir}</div></div>}
          <div><div style={{ fontSize: 10, color: s.muted }}>보유수량</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{trade.qty}</div></div>
          <div><div style={{ fontSize: 10, color: s.muted }}>평균 진입가</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{trade.entry?.toLocaleString()}</div></div>
          <div><div style={{ fontSize: 10, color: s.muted }}>상태</div><div style={{ fontSize: 13, color: s.accent3, fontWeight: 700 }}>{trade.status || "홀딩"}</div></div>
        </div>
      </Card>

      {/* 입력 폼 */}
      <Card accent={color}>
        <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 14 }}>
          {isEntry ? "📈 추가 진입 정보" : "📉 청산 정보"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
            <FormField label="날짜"><input type="date" value={leg.date} onChange={e => setL("date", e.target.value)} /></FormField>
            <FormField label="시간(선택)"><input type="text" placeholder="09:30" value={leg.time} onChange={e => setL("time", e.target.value)} /></FormField>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label={isEntry ? "진입가" : "청산가"}><input type="number" placeholder="0" value={leg.price} onChange={e => setL("price", e.target.value)} /></FormField>
            <FormField label="수량"><input type="number" placeholder="0" value={leg.qty} onChange={e => setL("qty", e.target.value)} /></FormField>
          </div>
          {leg.price && leg.qty && (
            <div style={{ padding: 10, background: s.surface2, borderRadius: 8, fontSize: 12, color: s.muted }}>
              {parseFloat(leg.qty)}주 × {parseFloat(leg.price).toLocaleString()} = {(parseFloat(leg.price) * parseFloat(leg.qty)).toLocaleString()} {trade.currency || "₩"}
            </div>
          )}
          <FormField label={isEntry ? "추가 진입 이유 (선택)" : "청산 이유 (선택)"}>
            <textarea placeholder={isEntry ? "추가 매수 근거, 시장 상황..." : "청산 이유, 목표 달성, 손절 이유..."} value={leg.memo} onChange={e => setL("memo", e.target.value)} style={{ minHeight: 72 }} />
          </FormField>
        </div>
      </Card>

      <Btn onClick={handleSave} style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Save size={15} /> {label} 저장
      </Btn>
    </div>
  );
}

function EditTradeForm({ trade, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: trade.date, assetIdx: ASSET_KEYS.indexOf(trade.assetKey) >= 0 ? ASSET_KEYS.indexOf(trade.assetKey) : 0,
    symbol: trade.symbol, dir: trade.dir,
    entry: String(trade.entry), exit: String(trade.exit),
    qty: String(trade.qty), lev: String(trade.lev || 1),
    sl: trade.sl ? String(trade.sl) : "", tp: trade.tp ? String(trade.tp) : "",
    risk: trade.risk || 5, emotion: trade.emotion || "", memo: trade.memo || "",
    currency: trade.currency || "₩"
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const pnl = calcPnl(form.entry, form.exit, form.qty, form.dir, form.lev);
  const pct = calcPct(form.entry, form.exit, form.dir, form.lev);

  const handleSave = () => {
    if (!form.symbol.trim() || !form.entry || !form.qty) { return; }
    const isOpen = !form.exit || parseFloat(form.exit) === 0;
    const updated = {
      ...trade, date: form.date, assetKey: ASSET_KEYS[form.assetIdx],
      symbol: form.symbol.trim(), dir: form.dir,
      entry: parseFloat(form.entry), exit: isOpen ? null : parseFloat(form.exit),
      qty: parseFloat(form.qty), lev: parseFloat(form.lev) || 1,
      sl: parseFloat(form.sl) || null, tp: parseFloat(form.tp) || null,
      risk: form.risk, emotion: form.emotion, memo: form.memo, currency: form.currency,
      status: isOpen ? "홀딩" : "청산",
      pnl: isOpen ? 0 : Math.round(pnl * 100) / 100,
      pct: isOpen ? 0 : Math.round(pct * 100) / 100
    };
    onSave(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onCancel} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 8, color: s.muted, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>← 취소</button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{trade.symbol} 수정</div>
      </div>

      {form.entry && form.exit && form.qty && (
        <div style={{ background: pnl >= 0 ? "rgba(0,230,118,0.08)" : "rgba(255,61,113,0.08)", border: "1px solid " + (pnl >= 0 ? "rgba(0,230,118,0.3)" : "rgba(255,61,113,0.3)"), borderRadius: 10, padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            <div><div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>투자금액</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600 }}>{form.currency === "₩" ? Math.round((parseFloat(form.entry)||0)*(parseFloat(form.qty)||0)).toLocaleString("ko-KR") + "₩" : ((parseFloat(form.entry)||0)*(parseFloat(form.qty)||0)).toFixed(2) + " " + form.currency}</div></div>
            <div><div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>손익</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: pnl >= 0 ? s.green : s.red }}>{fmt(pnl, form.currency)}</div></div>
            <div><div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>수익률</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: pct >= 0 ? s.green : s.red }}>{fmtPct(pct)}</div></div>
          </div>
        </div>
      )}

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="거래일"><input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></FormField>
            <FormField label="방향">
              <div style={{ display: "flex", gap: 8 }}>
                {["롱", "숏"].map(d => <button key={d} onClick={() => set("dir", d)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", background: form.dir === d ? (d === "롱" ? s.green : s.red) : s.surface2, color: form.dir === d ? "#000" : s.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{d === "롱" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{d}</button>)}
              </div>
            </FormField>
          </div>
          <FormField label="자산 유형"><select value={form.assetIdx} onChange={e => set("assetIdx", parseInt(e.target.value))}>{ASSETS.map((a, i) => <option key={i} value={i}>{a}</option>)}</select></FormField>
          <FormField label="종목명"><input placeholder="종목명" value={form.symbol} onChange={e => set("symbol", e.target.value)} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="진입가"><input type="number" value={form.entry} onChange={e => set("entry", e.target.value)} /></FormField>
            <FormField label="청산가"><input type="number" value={form.exit} onChange={e => set("exit", e.target.value)} /></FormField>
            <FormField label="수량"><input type="number" value={form.qty} onChange={e => set("qty", e.target.value)} /></FormField>
            <FormField label="통화">
              <div style={{ display: "flex", gap: 6 }}>
                {CURRENCIES.map(c => <button key={c} onClick={() => set("currency", c)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: form.currency === c ? s.accent : s.surface2, color: form.currency === c ? "#000" : s.muted }}>{c}</button>)}
              </div>
            </FormField>
            <FormField label="레버리지"><input type="number" min="1" value={form.lev} onChange={e => set("lev", e.target.value)} /></FormField>
            <FormField label="손절가 (선택)"><input type="number" placeholder="0" value={form.sl} onChange={e => set("sl", e.target.value)} /></FormField>
            <FormField label="목표가 (선택)"><input type="number" placeholder="0" value={form.tp} onChange={e => set("tp", e.target.value)} /></FormField>
          </div>
          <FormField label={"리스크 체감: " + form.risk + "/10"}>
            <input type="range" min="1" max="10" value={form.risk} onChange={e => set("risk", parseInt(e.target.value))} style={{ background: "linear-gradient(90deg, " + s.accent + " " + (form.risk * 10) + "%, " + s.border + " " + (form.risk * 10) + "%)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: s.muted, marginTop: 2 }}><span>낮음</span><span>높음</span></div>
          </FormField>
          <FormField label="매매 감정">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EMOTIONS.map(e => <button key={e.value} onClick={() => set("emotion", form.emotion === e.value ? "" : e.value)} style={{ background: form.emotion === e.value ? s.accent : s.surface2, border: "1px solid " + (form.emotion === e.value ? s.accent : s.border), color: form.emotion === e.value ? "#000" : s.text, padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontWeight: form.emotion === e.value ? 700 : 400, fontFamily: "'Noto Sans KR', sans-serif" }}>{e.label}</button>)}
            </div>
          </FormField>
          <FormField label="진입 근거 / 메모"><textarea value={form.memo} onChange={e => set("memo", e.target.value)} /></FormField>
        </div>
      </Card>
      <Btn onClick={handleSave} style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Save size={15} /> 수정 저장</Btn>
    </div>
  );
}

function CalendarHeatmap({ trades, krwRate, showKrwMode }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // 손익을 청산일 기준으로 집계 (진입일 아님)
  const dayMap = {};
  trades.forEach(t => {
    if (!t.pnl || t.pnl === 0) return; // 홀딩 중인 건 제외
    const cur = t.currency || "₩";

    // 마지막 청산 날짜 추출
    let dateKey = t.date; // 기본값: 진입일
    if (t.exits && t.exits.length > 0) {
      const lastExit = t.exits[t.exits.length - 1];
      if (lastExit.date) dateKey = lastExit.date;
    }
    if (!dateKey) return;
    if (!dayMap[dateKey]) dayMap[dateKey] = { pnl: 0, count: 0, byCurrency: {} };
    dayMap[dateKey].pnl += t.pnl;
    dayMap[dateKey].count += 1;
    dayMap[dateKey].byCurrency[cur] = (dayMap[dateKey].byCurrency[cur] || 0) + t.pnl;
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
  const mk = year + "-" + String(month + 1).padStart(2, "0");

  // 이달 통화별 손익 — 청산일 기준
  const monthByCurrency = {};
  let monthDays = 0, monthCount = 0;
  Object.entries(dayMap).forEach(([date, dd]) => {
    if (!date.startsWith(mk)) return;
    monthDays++;
    monthCount += dd.count;
    Object.entries(dd.byCurrency).forEach(([cur, val]) => {
      monthByCurrency[cur] = (monthByCurrency[cur] || 0) + val;
    });
  });
  const prevM = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextM = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // 숫자 축약 (원화 환산 포함)
  const toKrw = (val, cur) => val * (cur === "₩" ? 1 : (krwRate?.[cur] || 1380));
  const fmtShort = (val, cur) => {
    const v = showKrwMode ? toKrw(val, cur) : val;
    const c = showKrwMode ? "₩" : cur;
    const abs = Math.abs(v);
    const sign = v >= 0 ? "+" : "-";
    if (c === "₩") {
      if (abs >= 100000000) return sign + (abs / 100000000).toFixed(1).replace(/\.0$/, "") + "억";
      if (abs >= 10000000) return sign + (abs / 10000000).toFixed(1).replace(/\.0$/, "") + "천만";
      if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "백만";
      if (abs >= 10000) return sign + Math.round(abs / 10000) + "만";
      if (abs >= 1000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, "") + "천";
      return sign + Math.round(abs);
    }
    if (abs >= 1000) return sign + (abs / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return sign + abs.toFixed(1);
  };

  return (
    <Card>
      {/* 헤더: 월 이동 + 이달 총 손익 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={prevM} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 6, color: s.muted, padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center" }}><ChevronLeft size={14} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700 }}>{year}년 {month + 1}월</div>
            {Object.keys(monthByCurrency).length > 0 && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {showKrwMode ? (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: Object.entries(monthByCurrency).reduce((a, [c, v]) => a + toKrw(v, c), 0) >= 0 ? s.green : s.red }}>
                    {fmt(Math.round(Object.entries(monthByCurrency).reduce((a, [c, v]) => a + toKrw(v, c), 0)), "₩")}
                  </span>
                ) : Object.entries(monthByCurrency).map(([cur, val]) => (
                  <span key={cur} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: val >= 0 ? s.green : s.red }}>{fmt(val, cur)}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={nextM} style={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 6, color: s.muted, padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center" }}><ChevronRight size={14} /></button>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: s.muted }}>
          <span>{monthDays}일 거래</span>
          <span>{monthCount}건</span>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        {DAY_LABELS.map((d, i) => <div key={d} style={{ textAlign: "center", fontSize: 10, color: i === 0 ? "#ff6b6b" : i === 6 ? s.accent : s.muted, fontWeight: 600, padding: "2px 0" }}>{d}</div>)}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={"e" + i} className="cal-cell" />;
          const ds = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
          const dd = dayMap[ds];
          const isToday = ds === todayStr();
          const hasTrade = !!dd;
          const isProfit = dd && dd.pnl > 0;
          const isLoss = dd && dd.pnl < 0;

          // 통화별 주요 손익 (가장 큰 절대값)
          const mainCur = dd ? Object.entries(dd.byCurrency).reduce((a, b) => Math.abs(b[1]) > Math.abs(a[1]) ? b : a, ["₩", 0]) : null;

          return (
            <div key={day} className="cal-cell" style={{
              background: isProfit ? "rgba(0,230,118,0.1)" : isLoss ? "rgba(255,61,113,0.1)" : s.surface2,
              borderRadius: 5, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between",
              border: "1px solid " + (isToday ? s.accent : isProfit ? "rgba(0,230,118,0.3)" : isLoss ? "rgba(255,61,113,0.3)" : s.border),
              padding: "4px 5px",
            }}>
              <span style={{ fontSize: 11, color: isToday ? s.accent : hasTrade ? s.text : s.muted, fontWeight: isToday ? 700 : 400 }}>{day}</span>
              {mainCur && mainCur[0] && (
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: isProfit ? s.green : s.red, lineHeight: 1.2, wordBreak: "break-all" }}>
                  {fmtShort(mainCur[1], mainCur[0])}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatsTab({ trades, krwRate, showKrwMode }) {
  const closedTrades = trades.filter(t => t.status === "청산" || t.status === "부분청산" || (t.status !== "홀딩" && t.pnl !== 0));
  const wins = closedTrades.filter(t => t.pnl > 0);
  const losses = closedTrades.filter(t => t.pnl < 0);

  // 원화 환산 헬퍼 - 먼저 정의
  const toKrwVal = (pnl, cur) => pnl * (cur === "₩" ? 1 : (krwRate?.[cur] || 1380));

  const monthly = {};
  closedTrades.forEach(t => {
    if (!t.pnl || t.pnl === 0) return;
    let dateKey = t.date;
    if (t.exits && t.exits.length > 0 && t.exits[t.exits.length - 1].date) {
      dateKey = t.exits[t.exits.length - 1].date;
    }
    const m = dateKey && dateKey.substring(0, 7);
    const krwPnl = toKrwVal(t.pnl, t.currency || "₩");
    if (m) monthly[m] = (monthly[m] || 0) + krwPnl;
  });
  const monthData = Object.keys(monthly).sort().map(k => ({ month: k.substring(5), pnl: Math.round(monthly[k]) }));
  const emotionMap = {};
  closedTrades.forEach(t => { if (!t.emotion) return; if (!emotionMap[t.emotion]) emotionMap[t.emotion] = { w: 0, total: 0 }; emotionMap[t.emotion].total++; if (t.pnl > 0) emotionMap[t.emotion].w++; });
  const emotionData = Object.entries(emotionMap).map(([name, e]) => ({ name, wr: Math.round(e.w / e.total * 100), total: e.total })).sort((a, b) => b.wr - a.wr);
  const assetMap = {};
  closedTrades.forEach(t => { if (!assetMap[t.assetKey]) assetMap[t.assetKey] = { trades: [], wins: 0 }; assetMap[t.assetKey].trades.push(t); if (t.pnl > 0) assetMap[t.assetKey].wins++; });
  const avgPct = closedTrades.length ? closedTrades.reduce((a, t) => a + t.pct, 0) / closedTrades.length : 0;
  const maxWin = wins.length ? wins.reduce((a, t) => toKrwVal(t.pnl, t.currency || "₩") > toKrwVal(a.pnl, a.currency || "₩") ? t : a) : null;
  const maxLoss = losses.length ? losses.reduce((a, t) => toKrwVal(t.pnl, t.currency || "₩") < toKrwVal(a.pnl, a.currency || "₩") ? t : a) : null;

  // 백테스팅 통계
  const btTrades = trades.filter(t => t.slType || t.entryZone);

  // 손절 유형별 통계
  const slTypeMap = {};
  trades.filter(t => t.slType).forEach(t => {
    if (!slTypeMap[t.slType]) slTypeMap[t.slType] = { total: 0, wins: 0, slHit: 0, stophunt: 0 };
    slTypeMap[t.slType].total++;
    if (t.pnl > 0) slTypeMap[t.slType].wins++;
    if (t.slHit === "손절 맞음") slTypeMap[t.slType].slHit++;
    if (t.stophunt && t.stophunt.includes("스탑헌팅")) slTypeMap[t.slType].stophunt++;
  });

  // 진입 구간별 통계
  const ezMap = {};
  trades.filter(t => t.entryZone).forEach(t => {
    if (!ezMap[t.entryZone]) ezMap[t.entryZone] = { total: 0, wins: 0 };
    ezMap[t.entryZone].total++;
    if (t.pnl > 0) ezMap[t.entryZone].wins++;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}><StatCard label="청산 거래" value={closedTrades.length} /><StatCard label="수익" value={wins.length} color={s.green} /><StatCard label="손실" value={losses.length} color={s.red} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard label="최대 수익"
          value={maxWin ? (showKrwMode ? fmt(Math.round(toKrwVal(maxWin.pnl, maxWin.currency || "₩")), "₩") : fmt(maxWin.pnl, maxWin.currency)) : "-"}
          sub={maxWin ? maxWin.symbol : ""}
          color={s.green} />
        <StatCard label="최대 손실"
          value={maxLoss ? (showKrwMode ? fmt(Math.round(toKrwVal(maxLoss.pnl, maxLoss.currency || "₩")), "₩") : fmt(maxLoss.pnl, maxLoss.currency)) : "-"}
          sub={maxLoss ? maxLoss.symbol : ""}
          color={s.red} />
        <StatCard label="평균 수익률" value={fmtPct(avgPct)} color={avgPct >= 0 ? s.green : s.red} />
      </div>
      <CalendarHeatmap trades={trades} krwRate={krwRate} showKrwMode={showKrwMode} />
      {monthData.length > 0 && <Card><div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><BarChart2 size={13} /> 월별 손익</div><ResponsiveContainer width="100%" height={160}><BarChart data={monthData}><XAxis dataKey="month" tick={{ fill: s.muted, fontSize: 11 }} /><YAxis hide /><Tooltip contentStyle={{ background: s.surface2, border: "1px solid " + s.border, borderRadius: 8, fontSize: 12, color: s.text }} itemStyle={{ color: s.text }} labelStyle={{ color: s.muted }} formatter={(v) => [fmt(v), "손익"]} /><Bar dataKey="pnl" radius={[4, 4, 0, 0]}>{monthData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "rgba(0,230,118,0.7)" : "rgba(255,61,113,0.7)"} />)}</Bar></BarChart></ResponsiveContainer></Card>}
      {emotionData.length > 0 && <Card><div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Brain size={13} /> 감정별 승률</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{emotionData.map(e => <div key={e.name}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{e.name} <span style={{ color: s.muted }}>({e.total}건)</span></span><span style={{ fontFamily: "'JetBrains Mono',monospace", color: e.wr >= 50 ? s.green : s.red }}>{e.wr}%</span></div><div style={{ height: 6, background: s.surface2, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: e.wr + "%", background: e.wr >= 50 ? s.green : s.red, borderRadius: 3 }} /></div></div>)}</div></Card>}
      {Object.keys(assetMap).length > 0 && (
        <Card>
          <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Shield size={13} /> 자산별 통계</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(assetMap).map(([name, d]) => {
              const wr = Math.round(d.wins / d.trades.length * 100);
              const pnlByCur = d.trades.reduce((acc, t) => { const c = t.currency || "₩"; acc[c] = (acc[c] || 0) + t.pnl; return acc; }, {});
              return (
                <div key={name} style={{ padding: 12, background: s.surface2, borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{name}</span>
                    <div style={{ textAlign: "right" }}>
                      {Object.entries(pnlByCur).map(([cur, val]) => (
                        <div key={cur} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: val >= 0 ? s.green : s.red }}>{fmt(Math.round(val * 100) / 100, cur)}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: s.muted }}>
                    <span>{d.trades.length}건</span>
                    <span style={{ color: wr >= 50 ? s.green : s.red }}>승률 {wr}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 백테스팅 통계 */}
      {btTrades.length > 0 && (
        <Card accent={s.accent3}>
          <div style={{ fontSize: 11, color: s.accent3, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><Target size={13} /> 전략 백테스팅 통계 ({btTrades.length}건)</div>

          {/* 손절 유형별 */}
          {Object.keys(slTypeMap).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: s.muted, fontWeight: 600, marginBottom: 10 }}>손절 유형별 비교</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(slTypeMap).map(([type, d]) => {
                  const wr = Math.round(d.wins / d.total * 100);
                  const slHitRate = Math.round(d.slHit / d.total * 100);
                  const shRate = d.slHit > 0 ? Math.round(d.stophunt / d.slHit * 100) : 0;
                  return (
                    <div key={type} style={{ padding: 12, background: s.surface2, borderRadius: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{type} <span style={{ fontWeight: 400, fontSize: 11, color: s.muted }}>({d.total}건)</span></div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8 }}>
                        <div style={{ textAlign: "center", padding: "8px", background: s.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>승률</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: wr >= 50 ? s.green : s.red }}>{wr}%</div>
                        </div>
                        <div style={{ textAlign: "center", padding: "8px", background: s.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>손절 비율</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: slHitRate > 40 ? s.red : s.muted }}>{slHitRate}%</div>
                        </div>
                        <div style={{ textAlign: "center", padding: "8px", background: s.surface, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>스탑헌팅률</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 700, color: shRate > 50 ? s.accent3 : s.muted }}>{d.slHit > 0 ? shRate + "%" : "-"}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ height: 4, background: s.surface, borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: wr + "%", background: wr >= 50 ? s.green : s.red, borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 진입 구간별 */}
          {Object.keys(ezMap).length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: s.muted, fontWeight: 600, marginBottom: 10 }}>진입 구간별 승률</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(ezMap).sort((a, b) => (b[1].wins/b[1].total) - (a[1].wins/a[1].total)).map(([zone, d]) => {
                  const wr = Math.round(d.wins / d.total * 100);
                  return (
                    <div key={zone}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: s.text }}>{zone} <span style={{ color: s.muted }}>({d.total}건)</span></span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: wr >= 50 ? s.green : s.red, fontWeight: 700 }}>{wr}%</span>
                      </div>
                      <div style={{ height: 6, background: s.surface2, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: wr + "%", background: wr >= 50 ? s.green : s.accent3, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function AITab({ trades }) {
  const [aiType, setAiType] = useState("overall");
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [singleLoading, setSingleLoading] = useState(null);
  const [chartImg, setChartImg] = useState(null);
  const [chartBase64, setChartBase64] = useState(null);
  const [chartMime, setChartMime] = useState("image/jpeg");
  const [chartQ, setChartQ] = useState("");
  const [chartAnalysis, setChartAnalysis] = useState("");
  const [chartLoading, setChartLoading] = useState(false);
  const chartRef = useRef();

  const handleChartUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const mime = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = (ev) => { setChartImg(ev.target.result); setChartBase64(ev.target.result.split(",")[1]); setChartMime(mime); setChartAnalysis(""); };
    reader.readAsDataURL(file);
  };

  const analyzeChart = async () => {
    if (!chartBase64) return;
    setChartLoading(true); setChartAnalysis("");
    const validChartMime = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(chartMime) ? chartMime : "image/jpeg";
    const prompt = "당신은 전문 트레이딩 코치입니다. 이 차트 이미지를 분석하여 한국어로 복기 피드백을 제공해주세요.\n1. 추세와 패턴\n2. 진입/청산 포인트 적절성\n3. 지지/저항 레벨\n4. 잘한 점과 개선할 점\n5. 다음 대응법" + (chartQ ? "\n\n추가질문: " + chartQ : "");
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: validChartMime, data: chartBase64 } }, { type: "text", text: prompt }] }] }) });
      const data = await res.json();
      setChartAnalysis(data.content?.map(c => c.text || "").join("") || "응답 없음");
    } catch (e) { setChartAnalysis("❌ 오류: " + e.message); }
    setChartLoading(false);
  };

  const buildSummary = () => {
    const total = trades.length, wins = trades.filter(t => t.pnl > 0).length, pnl = trades.reduce((a, t) => a + t.pnl, 0);
    const em = {};
    trades.forEach(t => { if (!t.emotion) return; if (!em[t.emotion]) em[t.emotion] = { w: 0, total: 0 }; em[t.emotion].total++; if (t.pnl > 0) em[t.emotion].w++; });
    const emStr = Object.entries(em).map(([e, v]) => e + ":승률" + Math.round(v.w / v.total * 100) + "%(" + v.total + "건)").join(", ");
    const recent = trades.slice(0, 10).map(t => "[" + t.date + "] " + t.symbol + " " + t.dir + "(" + t.lev + "x) 진입:" + t.entry + " 청산:" + t.exit + " 손익:" + t.pnl + "(" + t.pct + "%) 감정:" + (t.emotion || "-")).join("\n");
    return "[요약] 총" + total + "건 승률" + (total ? Math.round(wins / total * 100) : 0) + "% 누적" + Math.round(pnl) + "₩\n[감정] " + (emStr || "없음") + "\n[기록]\n" + recent;
  };

  const PROMPTS = { overall: "전문 트레이딩 코치로서 매매 데이터를 분석하여 한국어로 패턴 분석을 해주세요:\n\n", emotion: "트레이딩 심리 전문가로서 감정 패턴과 심리적 함정을 한국어로 분석해주세요:\n\n", improve: "퀀트 트레이더로서 구체적인 개선점과 전략을 한국어로 제안해주세요:\n\n", risk: "리스크 관리 전문가로서 리스크 관리의 문제점과 개선방안을 한국어로 진단해주세요:\n\n", recent: "트레이딩 멘토로서 최근 매매 기록에 대해 피드백과 조언을 한국어로 주세요:\n\n" };

  const requestAI = async () => {
    if (!trades.length) { setResponse("❌ 거래 기록이 없습니다."); return; }
    setLoading(true); setResponse("");
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: PROMPTS[aiType] + buildSummary() + (question ? "\n\n추가질문: " + question : "") }] }) });
      const data = await res.json();
      setResponse(data.content?.map(c => c.text || "").join("") || "응답 없음");
    } catch (e) { setResponse("❌ 오류: " + e.message); }
    setLoading(false);
  };

  const getSingleFeedback = async (t) => {
    setSingleLoading(t.id);
    const prompt = "트레이딩 코치로서 다음 거래에 대해 2-3문장으로 간결한 한국어 피드백을 주세요:\n종목: " + t.symbol + "(" + t.assetKey + ") " + t.dir + " " + t.lev + "x\n진입:" + t.entry + " 청산:" + t.exit + " 손익:" + t.pnl + "(" + t.pct + "%)\n감정:" + (t.emotion || "미기록") + " 리스크:" + t.risk + "/10\n메모:" + (t.memo || "없음");
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json();
      return data.content?.map(c => c.text || "").join("") || "응답 없음";
    } catch (e) { return "❌ 오류: " + e.message; }
    finally { setSingleLoading(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>
      <Card accent={s.accent3}>
        <div style={{ fontSize: 11, color: s.accent3, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Activity size={13} /> 차트 복기 분석</div>
        <input ref={chartRef} type="file" accept="image/*" onChange={handleChartUpload} style={{ display: "none" }} />
        {!chartImg ? (
          <button onClick={() => chartRef.current.click()} style={{ width: "100%", padding: 18, border: "2px dashed " + s.border, borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: s.muted }}>
            <div style={{ fontSize: 24 }}>📊</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>트레이딩뷰 차트 캡처 업로드</div>
            <div style={{ fontSize: 11 }}>AI가 차트를 보고 복기 피드백을 드려요</div>
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <img src={chartImg} alt="차트" style={{ width: "100%", borderRadius: 8, maxHeight: 220, objectFit: "cover" }} />
              <button onClick={() => { setChartImg(null); setChartBase64(null); setChartAnalysis(""); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
            </div>
            <FormField label="추가 질문 (선택)"><textarea placeholder="예: 이 진입이 좋았나요? 손절을 어디 잡았어야 할까요?" value={chartQ} onChange={e => setChartQ(e.target.value)} style={{ minHeight: 56 }} /></FormField>
            <Btn onClick={analyzeChart} variant="ai" disabled={chartLoading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {chartLoading ? <><RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> 분석 중...</> : <><Brain size={14} /> 차트 복기 분석하기</>}
            </Btn>
            {chartAnalysis && <div style={{ padding: 14, background: "rgba(255,224,102,0.06)", border: "1px solid rgba(255,224,102,0.2)", borderRadius: 8, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{chartAnalysis}</div>}
            <button onClick={() => chartRef.current.click()} style={{ background: "none", border: "1px solid " + s.border, borderRadius: 8, color: s.muted, fontSize: 12, padding: 8, cursor: "pointer" }}>다른 차트로 변경</button>
          </div>
        )}
      </Card>

      <Card accent="#7b2fff">
        <div style={{ fontSize: 11, color: "#7b2fff", fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Bot size={13} /> AI 전체 분석</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FormField label="분석 유형">
            <select value={aiType} onChange={e => setAiType(e.target.value)}>
              <option value="overall">전체 매매 패턴 분석</option>
              <option value="emotion">감정 매매 분석</option>
              <option value="improve">개선점 & 전략 제안</option>
              <option value="risk">리스크 관리 진단</option>
              <option value="recent">최근 거래 피드백</option>
            </select>
          </FormField>
          <FormField label="추가 질문 (선택)"><textarea placeholder="AI에게 구체적으로 물어보고 싶은 내용..." value={question} onChange={e => setQuestion(e.target.value)} style={{ minHeight: 60 }} /></FormField>
          <Btn onClick={requestAI} variant="ai" disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> 분석 중...</> : <><Zap size={14} /> AI 분석 시작</>}
          </Btn>
        </div>
        {response && <div style={{ marginTop: 16, padding: 14, background: "rgba(123,47,255,0.08)", border: "1px solid rgba(123,47,255,0.2)", borderRadius: 8, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{response}</div>}
      </Card>

      <Card>
        <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Target size={13} /> 개별 거래 AI 피드백</div>
        {!trades.length ? <div style={{ textAlign: "center", color: s.muted, padding: "20px 0", fontSize: 13 }}>기록된 거래가 없습니다</div> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{trades.slice(0, 8).map(t => <SingleFeedbackRow key={t.id} t={t} loading={singleLoading === t.id} onRequest={getSingleFeedback} />)}</div>}
      </Card>
    </div>
  );
}

function SingleFeedbackRow({ t, loading, onRequest }) {
  const [feedback, setFeedback] = useState("");
  const [open, setOpen] = useState(false);
  const handle = async () => { if (feedback) { setOpen(o => !o); return; } const res = await onRequest(t); setFeedback(res); setOpen(true); };
  return (
    <div style={{ background: s.surface2, borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontWeight: 700, fontSize: 13 }}>{t.symbol}</div><div style={{ fontSize: 11, color: s.muted }}>{t.date} • <span style={{ color: t.pnl >= 0 ? s.green : s.red }}>{fmt(t.pnl, t.currency)}</span></div></div>
        <Btn onClick={handle} variant="ghost" disabled={loading} style={{ padding: "6px 12px", fontSize: 12 }}>{loading ? "분석중..." : feedback ? (open ? "닫기" : "보기") : "AI 피드백"}</Btn>
      </div>
      {open && feedback && <div style={{ marginTop: 10, padding: 12, background: "rgba(123,47,255,0.08)", border: "1px solid rgba(123,47,255,0.2)", borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>{feedback}</div>}
    </div>
  );
}

// LegItem 컴포넌트 - TradeDetail 밖에 정의해야 커서 안 날아감
function LegItem({ leg, type, idx, color, editingLeg, setEditingLeg, confirmLeg, setConfirmLeg, onSave, onDelete }) {
  const isEditing = editingLeg?.type === type && editingLeg?.idx === idx;
  const isConfirm = confirmLeg?.type === type && confirmLeg?.idx === idx;

  if (isEditing) {
    return (
      <div style={{ padding: "10px 12px", background: s.surface, border: "1px solid " + color + "44", borderRadius: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr 1fr", gap: 8, marginBottom: 8 }}>
          <FormField label="날짜"><input type="date" value={editingLeg.date} onChange={e => setEditingLeg(l => ({ ...l, date: e.target.value }))} /></FormField>
          <FormField label="시간"><input type="text" placeholder="09:30" value={editingLeg.time} onChange={e => setEditingLeg(l => ({ ...l, time: e.target.value }))} /></FormField>
          <FormField label="가격"><input type="number" value={editingLeg.price} onChange={e => setEditingLeg(l => ({ ...l, price: e.target.value }))} /></FormField>
          <FormField label="수량"><input type="number" value={editingLeg.qty} onChange={e => setEditingLeg(l => ({ ...l, qty: e.target.value }))} /></FormField>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); onSave(); }} style={{ flex: 1, padding: "8px 0", background: color, border: "none", borderRadius: 6, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>저장</button>
          <button onClick={e => { e.stopPropagation(); setEditingLeg(null); }} style={{ flex: 1, padding: "8px 0", background: s.surface2, border: "1px solid " + s.border, borderRadius: 6, color: s.muted, fontSize: 13, cursor: "pointer" }}>취소</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: s.surface2, borderRadius: 6 }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: s.muted }}>{leg.date}{leg.time ? " " + leg.time : ""}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, marginLeft: 12 }}>{(leg.price || 0).toLocaleString()} × {leg.qty}</span>
      </div>
      {isConfirm ? (
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onDelete(type, idx); }} style={{ padding: "4px 8px", background: s.red, border: "none", color: "#fff", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>삭제</button>
          <button onClick={e => { e.stopPropagation(); setConfirmLeg(null); }} style={{ padding: "4px 8px", background: s.surface, border: "1px solid " + s.border, color: s.muted, borderRadius: 4, fontSize: 11, cursor: "pointer" }}>취소</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); setEditingLeg({ type, idx, date: leg.date, time: leg.time || "", price: String(leg.price || ""), qty: String(leg.qty || "") }); }} style={{ width: 26, height: 26, background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.3)", color: s.accent, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PenLine size={11} /></button>
          <button onClick={e => { e.stopPropagation(); setConfirmLeg({ type, idx }); }} style={{ width: 26, height: 26, background: "rgba(255,61,113,0.1)", border: "1px solid rgba(255,61,113,0.3)", color: s.red, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={11} /></button>
        </div>
      )}
    </div>
  );
}

function TradeDetail({ t, onEdit }) {
  const cur = t.currency || "₩";
  const hasMulti = t.entries && t.entries.length > 0;
  const invested = t.entry * (t.qty || 0);
  const [editingLeg, setEditingLeg] = useState(null);
  const [confirmLeg, setConfirmLeg] = useState(null);

  const recalc = (entries, exits, dir, lev) => {
    const totalEQty = entries.reduce((a, e) => a + (e.qty || 0), 0);
    const avgEntry = totalEQty > 0 ? entries.reduce((a, e) => a + (e.price || 0) * (e.qty || 0), 0) / totalEQty : 0;
    const totalXQty = exits.reduce((a, e) => a + (e.qty || 0), 0);
    const avgExit = totalXQty > 0 ? exits.reduce((a, e) => a + (e.price || 0) * (e.qty || 0), 0) / totalXQty : 0;
    const closedQty = Math.min(totalEQty, totalXQty);
    const pnl = avgEntry > 0 && avgExit > 0 && closedQty > 0
      ? Math.round(((dir === "숏" ? (avgEntry - avgExit) : (avgExit - avgEntry)) * closedQty * (lev || 1)) * 100) / 100 : 0;
    const pct = avgEntry > 0 && avgExit > 0
      ? Math.round(((dir === "숏" ? (avgEntry - avgExit) : (avgExit - avgEntry)) / avgEntry * 100 * (lev || 1)) * 100) / 100 : 0;
    const isFullyClosed = totalXQty >= totalEQty && totalEQty > 0;
    const isPartial = totalXQty > 0 && totalXQty < totalEQty;
    return { entries, exits, entry: Math.round(avgEntry * 100) / 100, exit: (isFullyClosed || isPartial) ? Math.round(avgExit * 100) / 100 : null, qty: totalEQty, pnl, pct, status: isFullyClosed ? "청산" : isPartial ? "부분청산" : "홀딩" };
  };

  const handleDeleteLeg = (type, idx) => {
    const entries = [...(t.entries || [])];
    const exits = [...(t.exits || [])];
    if (type === "entry") entries.splice(idx, 1);
    else exits.splice(idx, 1);
    onEdit({ ...t, ...recalc(entries, exits, t.dir, t.lev) });
    setConfirmLeg(null);
  };

  const handleSaveLeg = () => {
    if (!editingLeg) return;
    const entries = (t.entries || []).map((e, i) => editingLeg.type === "entry" && i === editingLeg.idx ? { date: editingLeg.date, time: editingLeg.time, price: parseFloat(editingLeg.price) || 0, qty: parseFloat(editingLeg.qty) || 0 } : e);
    const exits = (t.exits || []).map((e, i) => editingLeg.type === "exit" && i === editingLeg.idx ? { date: editingLeg.date, time: editingLeg.time, price: parseFloat(editingLeg.price) || 0, qty: parseFloat(editingLeg.qty) || 0 } : e);
    onEdit({ ...t, ...recalc(entries, exits, t.dir, t.lev) });
    setEditingLeg(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          ["날짜", t.date], ["자산", t.assetKey], ["방향", t.dir],
          ...(t.lev && t.lev > 1 ? [["레버리지", t.lev + "x"]] : []),
          ["통화", cur], ["리스크", t.risk ? t.risk + "/10" : "-"], ["감정", t.emotion || "-"],
          ["상태", t.status || "청산"]
        ].map(([k, v]) => <div key={k}><div style={{ fontSize: 11, color: s.muted, marginBottom: 3 }}>{k}</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{v}</div></div>)}
      </div>

      {/* 분할진입 내역 */}
      {hasMulti && t.entries.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: s.green, fontWeight: 700, marginBottom: 8 }}>진입 내역</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {t.entries.map((e, i) => <LegItem key={i} leg={e} type="entry" idx={i} color={s.green} editingLeg={editingLeg} setEditingLeg={setEditingLeg} confirmLeg={confirmLeg} setConfirmLeg={setConfirmLeg} onSave={handleSaveLeg} onDelete={handleDeleteLeg} />)}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: 11, color: s.muted }}>
              <span>평균 진입가</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: s.text, fontWeight: 700 }}>{(t.entry || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* 분할청산 내역 */}
      {hasMulti && t.exits && t.exits.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: s.red, fontWeight: 700, marginBottom: 8 }}>청산 내역</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {t.exits.map((e, i) => <LegItem key={i} leg={e} type="exit" idx={i} color={s.red} editingLeg={editingLeg} setEditingLeg={setEditingLeg} confirmLeg={confirmLeg} setConfirmLeg={setConfirmLeg} onSave={handleSaveLeg} onDelete={handleDeleteLeg} />)}
            {t.exit && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", fontSize: 11, color: s.muted }}>
              <span>평균 청산가</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: s.text, fontWeight: 700 }}>{(t.exit || 0).toLocaleString()}</span>
            </div>}
          </div>
        </div>
      )}

      {/* 기존 단순 거래 */}
      {!hasMulti && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><div style={{ fontSize: 11, color: s.muted, marginBottom: 3 }}>진입가</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{t.entry?.toLocaleString()} {cur}</div></div>
          <div><div style={{ fontSize: 11, color: s.muted, marginBottom: 3 }}>청산가</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{t.exit ? t.exit.toLocaleString() + " " + cur : "홀딩"}</div></div>
          <div><div style={{ fontSize: 11, color: s.muted, marginBottom: 3 }}>수량</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{t.qty}</div></div>
        </div>
      )}

      <div style={{ background: s.surface2, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {[["투자금액", cur === "₩" ? Math.round(invested).toLocaleString("ko-KR") + "₩" : invested.toFixed(2) + " " + cur, s.text], ["손익", fmt(t.pnl, cur), t.pnl >= 0 ? s.green : s.red], ["수익률", fmtPct(t.pct), t.pct >= 0 ? s.green : s.red]].map(([label, val, color]) => <div key={label} style={{ padding: "12px 10px", textAlign: "center", borderRight: "1px solid " + s.border }}><div style={{ fontSize: 10, color: s.muted, marginBottom: 4 }}>{label}</div><div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color }}>{val}</div></div>)}
        </div>
      </div>
      {t.chartImg && <div><div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>첨부 차트</div><img src={"data:image/jpeg;base64," + t.chartImg} alt="차트" style={{ width: "100%", borderRadius: 8 }} /></div>}
      {t.memo && <div style={{ padding: 14, background: s.surface2, borderRadius: 8 }}><div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>메모 / 근거</div><div style={{ fontSize: 14, lineHeight: 1.7 }}>{t.memo}</div></div>}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────
function SettingsTab({ trades, capitals, strategies, onSaveStrategies, activeAssets, onSaveActiveAssets, onExportJSON, onExportCSV, onImport, onSetCapital, onClearAll }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [newEntryZone, setNewEntryZone] = useState("");
  const [newSlType, setNewSlType] = useState("");
  const totalCapital = Object.values(capitals).reduce((a, v) => {
    const cap = typeof v === "object" ? v : { amount: v, currency: "₩" };
    return cap.currency === "₩" ? a + cap.amount : a;
  }, 0);

  const toggleAsset = (key) => {
    const cur = activeAssets || ASSET_KEYS;
    if (cur.includes(key)) {
      if (cur.length <= 1) return; // 최소 1개는 켜져 있어야
      onSaveActiveAssets(cur.filter(k => k !== key));
    } else {
      onSaveActiveAssets([...cur, key]);
    }
  };

  const addEntryZone = () => {
    if (!newEntryZone.trim()) return;
    onSaveStrategies({ ...strategies, entryZones: [...(strategies.entryZones || []), newEntryZone.trim()] });
    setNewEntryZone("");
  };
  const removeEntryZone = (v) => onSaveStrategies({ ...strategies, entryZones: strategies.entryZones.filter(e => e !== v) });
  const addSlType = () => {
    if (!newSlType.trim()) return;
    onSaveStrategies({ ...strategies, slTypes: [...(strategies.slTypes || []), newSlType.trim()] });
    setNewSlType("");
  };
  const removeSlType = (v) => onSaveStrategies({ ...strategies, slTypes: strategies.slTypes.filter(e => e !== v) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>

      {/* 데이터 현황 */}
      <Card>
        <div style={{ fontSize: 11, color: s.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Activity size={13} /> 데이터 현황</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
          <div style={{ textAlign: "center", padding: "10px 0", background: s.surface2, borderRadius: 8 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: s.accent }}>{trades.length}</div>
            <div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>거래 기록</div>
          </div>
          <div style={{ textAlign: "center", padding: "10px 0", background: s.surface2, borderRadius: 8 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: s.accent }}>{Object.keys(capitals).length}</div>
            <div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>계좌 설정</div>
          </div>
          <div style={{ textAlign: "center", padding: "10px 0", background: s.surface2, borderRadius: 8 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700, color: s.accent }}>{totalCapital > 0 ? (totalCapital / 10000).toFixed(0) + "만" : "-"}</div>
            <div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>총 원금(₩)</div>
          </div>
        </div>
      </Card>

      {/* 사용 자산 설정 */}
      <Card accent={s.accent}>
        <div style={{ fontSize: 11, color: s.accent, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Shield size={13} /> 사용 자산 설정</div>
        <div style={{ fontSize: 12, color: s.muted, marginBottom: 14 }}>본인이 거래하는 자산만 켜두면 기록 화면이 간결해져요.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ACCOUNT_LIST.map(a => {
            const isOn = !activeAssets || activeAssets.includes(a.key);
            return (
              <div key={a.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: s.surface2, borderRadius: 10, border: "1px solid " + (isOn ? s.accent + "44" : s.border) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: isOn ? s.text : s.muted }}>{a.label}</div>
                  </div>
                </div>
                <button onClick={() => toggleAsset(a.key)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: isOn ? s.accent : s.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: isOn ? 23 : 3, transition: "left 0.2s" }} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 백업 & 내보내기 */}
      <Card accent={s.green}>
        <div style={{ fontSize: 11, color: s.green, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Save size={13} /> 백업 & 내보내기</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: 14, background: s.surface2, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>JSON 백업</div>
            <div style={{ fontSize: 12, color: s.muted, marginBottom: 12 }}>거래 기록 + 계좌 원금 전체 저장. 나중에 앱 복원 시 사용.</div>
            <Btn onClick={onExportJSON} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Save size={14} /> JSON 파일로 저장
            </Btn>
          </div>
          <div style={{ padding: 14, background: s.surface2, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>엑셀(CSV) 내보내기</div>
            <div style={{ fontSize: 12, color: s.muted, marginBottom: 12 }}>엑셀/구글시트에서 바로 열 수 있는 형식. 눈으로 보는 백업용.</div>
            <Btn onClick={onExportCSV} variant="ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <BarChart2 size={14} /> CSV 파일로 저장
            </Btn>
          </div>
        </div>
      </Card>

      {/* 가져오기 */}
      <Card accent={s.accent}>
        <div style={{ fontSize: 11, color: s.accent, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={13} /> 데이터 가져오기</div>
        <div style={{ fontSize: 12, color: s.muted, marginBottom: 12 }}>이전에 백업한 JSON 파일을 불러와요. 기존 데이터는 덮어씌워집니다.</div>
        <Btn onClick={onImport} variant="ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <RefreshCw size={14} /> JSON 파일 가져오기
        </Btn>
      </Card>

      {/* 전략 관리 */}
      <Card accent={s.accent3}>
        <div style={{ fontSize: 11, color: s.accent3, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}><Target size={13} /> 백테스팅 전략 관리</div>

        {/* 진입 구간 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: s.muted, fontWeight: 600, marginBottom: 10 }}>진입 구간</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {(strategies?.entryZones || []).map(v => (
              <div key={v} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, border: "1px solid " + s.border, background: s.surface2 }}>
                <span style={{ fontSize: 12, color: s.text }}>{v}</span>
                <button onClick={() => removeEntryZone(v)} style={{ background: "none", border: "none", cursor: "pointer", color: s.muted, display: "flex", alignItems: "center", padding: 0 }}><X size={11} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="새 진입 구간 추가..." value={newEntryZone} onChange={e => setNewEntryZone(e.target.value)} onKeyDown={e => e.key === "Enter" && addEntryZone()} style={{ flex: 1 }} />
            <Btn onClick={addEntryZone} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>추가</Btn>
          </div>
        </div>

        {/* 손절 유형 */}
        <div>
          <div style={{ fontSize: 12, color: s.muted, fontWeight: 600, marginBottom: 10 }}>손절 유형</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {(strategies?.slTypes || []).map(v => (
              <div key={v} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, border: "1px solid " + s.border, background: s.surface2 }}>
                <span style={{ fontSize: 12, color: s.text }}>{v}</span>
                <button onClick={() => removeSlType(v)} style={{ background: "none", border: "none", cursor: "pointer", color: s.muted, display: "flex", alignItems: "center", padding: 0 }}><X size={11} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="새 손절 유형 추가..." value={newSlType} onChange={e => setNewSlType(e.target.value)} onKeyDown={e => e.key === "Enter" && addSlType()} style={{ flex: 1 }} />
            <Btn onClick={addSlType} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>추가</Btn>
          </div>
        </div>
      </Card>

      {/* 계좌 설정 */}
      <Card>
        <div style={{ fontSize: 11, color: s.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Wallet size={13} /> 계좌 원금 설정</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {ACCOUNT_LIST.filter(a => !activeAssets || activeAssets.includes(a.key)).map(a => {
            const capRaw = capitals[a.key];
            const capInfo = capRaw ? (typeof capRaw === "object" ? capRaw : { amount: capRaw, currency: "₩" }) : null;
            return (
              <div key={a.key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: s.surface2, borderRadius: 8, fontSize: 13 }}>
                <span>{a.icon} {a.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: capInfo ? s.accent : s.muted }}>
                  {capInfo ? capInfo.amount.toLocaleString("ko-KR") + " " + capInfo.currency : "미설정"}
                </span>
              </div>
            );
          })}
        </div>
        <Btn onClick={onSetCapital} variant="ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Settings size={14} /> 원금 수정
        </Btn>
      </Card>

      {/* 전체 데이터 삭제 */}
      <Card accent={s.red}>
        <div style={{ fontSize: 11, color: s.red, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Trash2 size={13} /> 위험 구역</div>
        <div style={{ fontSize: 12, color: s.muted, marginBottom: 12 }}>모든 거래 기록과 설정이 삭제됩니다. 삭제 전 반드시 백업하세요.</div>
        {confirmClear ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: s.red, textAlign: "center", padding: "8px 0" }}>정말 모든 데이터를 삭제할까요?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => { onClearAll(); setConfirmClear(false); }} variant="danger" style={{ flex: 1 }}>삭제</Btn>
              <Btn onClick={() => setConfirmClear(false)} variant="ghost" style={{ flex: 1 }}>취소</Btn>
            </div>
          </div>
        ) : (
          <Btn onClick={() => setConfirmClear(true)} variant="danger" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Trash2 size={14} /> 전체 데이터 삭제
          </Btn>
        )}
      </Card>
    </div>
  );
}

// ── Cashflow Tab ──────────────────────────────────────────────────────
function CashflowTab({ cashflows, trades, onAdd, onDelete, activeAssets }) {
  const visibleAccounts = ACCOUNT_LIST.filter(a => !activeAssets || activeAssets.includes(a.key));
  const defaultAccount = visibleAccounts[visibleAccounts.length - 1]?.key || ACCOUNT_LIST[0].key;
  const [form, setForm] = useState({
    date: todayStr(), type: "입금", accountKey: defaultAccount,
    amount: "", currency: "₩", memo: "", isProfit: false
  });
  const [confirmId, setConfirmId] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.amount) { alert("금액을 입력해주세요"); return; }
    const cf = {
      id: Date.now(), date: form.date, type: form.type,
      accountKey: form.accountKey, amount: parseFloat(form.amount.replace(/,/g, "")) || 0,
      currency: form.currency, memo: form.memo, isProfit: form.isProfit
    };
    onAdd(cf);
    setForm(f => ({ ...f, amount: "", memo: "", isProfit: false }));
  };

  // 계좌별 집계
  const accountStats = visibleAccounts.map(a => {
    const aFlows = cashflows.filter(cf => cf.accountKey === a.key);
    const aTrades = trades.filter(t => t.assetKey === a.key);

    // 통화별 집계
    const byCur = {};
    aFlows.forEach(cf => {
      const cur = cf.currency || "₩";
      if (!byCur[cur]) byCur[cur] = { in: 0, out: 0, profitOut: 0 };
      if (cf.type === "입금") byCur[cur].in += cf.amount;
      else {
        byCur[cur].out += cf.amount;
        if (cf.isProfit) byCur[cur].profitOut += cf.amount;
      }
    });

    // 매매 손익 (통화별)
    const tradePnl = {};
    aTrades.forEach(t => {
      const cur = t.currency || "₩";
      tradePnl[cur] = (tradePnl[cur] || 0) + t.pnl;
    });

    return { ...a, byCur, tradePnl, flows: aFlows.length };
  }).filter(a => a.flows > 0 || Object.keys(a.tradePnl).length > 0);

  // 월별 요약
  const monthly = {};
  cashflows.forEach(cf => {
    const m = cf.date.substring(0, 7);
    if (!monthly[m]) monthly[m] = { in: 0, out: 0, profitOut: 0 };
    if (cf.type === "입금") monthly[m].in += cf.amount;
    else { monthly[m].out += cf.amount; if (cf.isProfit) monthly[m].profitOut += cf.amount; }
  });
  const monthList = Object.keys(monthly).sort().reverse().slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease" }}>

      {/* 입출금 기록 폼 */}
      <Card accent={s.green}>
        <div style={{ fontSize: 11, color: s.green, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><DollarSign size={13} /> 입출금 기록</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <FormField label="날짜"><input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></FormField>
          <FormField label="유형">
            <div style={{ display: "flex", gap: 8 }}>
              {["입금", "출금"].map(t => (
                <button key={t} onClick={() => set("type", t)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", background: form.type === t ? (t === "입금" ? s.green : s.red) : s.surface2, color: form.type === t ? "#000" : s.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {t === "입금" ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}{t}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="계좌">
            <select value={form.accountKey} onChange={e => set("accountKey", e.target.value)}>
              {visibleAccounts.map(a => <option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
            </select>
          </FormField>
          <FormField label="금액">
            <input type="text" placeholder="예: 1,000,000" value={form.amount} onChange={e => set("amount", e.target.value)} />
          </FormField>
          <FormField label="통화">
            <div style={{ display: "flex", gap: 6 }}>
              {["₩", "USD", "USDT"].map(c => (
                <button key={c} onClick={() => set("currency", c)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", background: form.currency === c ? s.accent : s.surface2, color: form.currency === c ? "#000" : s.muted }}>{c}</button>
              ))}
            </div>
          </FormField>
          <FormField label="메모 (선택)"><input placeholder="출금 사유 등..." value={form.memo} onChange={e => set("memo", e.target.value)} /></FormField>
        </div>
        {form.type === "출금" && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => set("isProfit", !form.isProfit)} style={{ width: 20, height: 20, borderRadius: 4, border: "2px solid " + (form.isProfit ? s.green : s.border), background: form.isProfit ? s.green : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {form.isProfit && <span style={{ color: "#000", fontSize: 12, fontWeight: 700 }}>✓</span>}
            </button>
            <span style={{ fontSize: 13, color: s.muted }}>수익 실현 출금 (원금이 아닌 수익금 인출)</span>
          </div>
        )}
        <Btn onClick={handleAdd} style={{ width: "100%", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Save size={14} /> 기록 저장
        </Btn>
      </Card>

      {/* 계좌별 현황 */}
      {accountStats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: s.muted, display: "flex", alignItems: "center", gap: 6 }}><Shield size={13} /> 계좌별 입출금 현황</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {accountStats.map(a => (
              <Card key={a.key} style={{ padding: 0 }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + a.color + ", transparent)", opacity: 0.8 }} />
                <div style={{ padding: "12px 16px", borderBottom: "1px solid " + s.border, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</span>
                </div>
                {Object.entries(a.byCur).map(([cur, v]) => {
                  const netIn = v.in - v.out;
                  const pnl = a.tradePnl[cur] || 0;
                  const realReturn = v.in > 0 ? ((pnl + v.profitOut) / v.in * 100) : null;
                  return (
                    <div key={cur} style={{ padding: "10px 16px", borderBottom: "1px solid " + s.border }}>
                      <div style={{ fontSize: 10, color: s.muted, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>{cur}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: s.muted }}>총 입금</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: s.green }}>{fmt(v.in, cur)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: s.muted }}>총 출금</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: s.red }}>{fmt(v.out, cur)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: s.muted }}>순 투입</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600 }}>{fmt(netIn, cur)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: s.muted }}>매매 손익</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: pnl >= 0 ? s.green : s.red }}>{fmt(pnl, cur)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: s.muted }}>수익 출금</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: s.accent }}>{fmt(v.profitOut, cur)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: s.muted }}>실현 수익률</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: realReturn !== null ? (realReturn >= 0 ? s.green : s.red) : s.muted }}>{realReturn !== null ? fmtPct(realReturn) : "-"}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 월별 요약 */}
      {monthList.length > 0 && (
        <Card>
          <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><BarChart2 size={13} /> 월별 입출금 요약</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {monthList.map(m => {
              const d = monthly[m];
              const net = d.in - d.out;
              return (
                <div key={m} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr 1fr", gap: 12, alignItems: "center", padding: "10px 12px", background: s.surface2, borderRadius: 8, fontSize: 13 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: s.muted }}>{m}</div>
                  <div>
                    <div style={{ fontSize: 10, color: s.muted }}>총 입금</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: s.green }}>{d.in > 0 ? "+" + d.in.toLocaleString("ko-KR") + "₩" : "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: s.muted }}>총 출금</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: s.red }}>{d.out > 0 ? "-" + d.out.toLocaleString("ko-KR") + "₩" : "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: s.muted }}>수익 출금</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: s.accent }}>{d.profitOut > 0 ? "+" + d.profitOut.toLocaleString("ko-KR") + "₩" : "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: s.muted }}>순 입금</div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: net >= 0 ? s.green : s.red }}>{net !== 0 ? (net > 0 ? "+" : "") + net.toLocaleString("ko-KR") + "₩" : "-"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 입출금 내역 */}
      <Card>
        <div style={{ fontSize: 11, color: s.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><ClipboardList size={13} /> 입출금 내역</div>
        {cashflows.length === 0 ? (
          <div style={{ textAlign: "center", color: s.muted, padding: "32px 0", fontSize: 13 }}>입출금 기록이 없습니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cashflows.map(cf => (
              <div key={cf.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: s.surface2, borderRadius: 8 }}>
                <div style={{ color: cf.type === "입금" ? s.green : s.red, display: "flex", alignItems: "center" }}>
                  {cf.type === "입금" ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: cf.type === "입금" ? s.green : s.red }}>
                      {cf.type === "입금" ? "+" : "-"}{cf.amount.toLocaleString("ko-KR")} {cf.currency}
                    </span>
                    {cf.isProfit && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "rgba(0,229,255,0.1)", color: s.accent, border: "1px solid rgba(0,229,255,0.2)" }}>수익출금</span>}
                  </div>
                  <div style={{ fontSize: 11, color: s.muted }}>{cf.date} · {cf.accountKey}{cf.memo ? " · " + cf.memo : ""}</div>
                </div>
                {confirmId === cf.id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { onDelete(cf.id); setConfirmId(null); }} style={{ background: s.red, border: "none", color: "#fff", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>삭제</button>
                    <button onClick={() => setConfirmId(null)} style={{ background: s.surface, border: "1px solid " + s.border, color: s.muted, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>취소</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(cf.id)} style={{ background: "rgba(255,61,113,0.1)", border: "1px solid rgba(255,61,113,0.3)", color: s.red, width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
