import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";

const assetCategories = ["BTC", "알트", "국내주식", "해외주식"];
const storageKey = "tv-journal-app-v4-local";
const firebaseConfigKey = "tv-journal-firebase-config";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultEntry() {
  return {
    id: createId(),
    date: getToday(),
    category: "BTC",
    market: "BTCUSDT",
    side: "Long",
    setup: "반등매매",
    timeframe: "1H",
    entryPrice: "",
    stopPrice: "",
    targetPrice: "",
    exitPrice: "",
    pnl: "",
    riskReward: "",
    riskPct: "",
    rewardPct: "",
    status: "대기",
    stochastic: "과매도",
    marketCondition: "횡보",
    externalFlow: "나스닥 동조",
    thesis: "",
    scenarioA: "",
    scenarioB: "",
    executionNote: "",
    resultReview: "",
    mistake: "",
    lesson: "",
    tvLink: "",
    screenshot: "",
    tags: "",
    updatedAt: Date.now(),
  };
}

function createFirebaseConfigForm(initial = {}) {
  return {
    apiKey: initial.apiKey || "",
    authDomain: initial.authDomain || "",
    projectId: initial.projectId || "",
    storageBucket: initial.storageBucket || "",
    messagingSenderId: initial.messagingSenderId || "",
    appId: initial.appId || "",
  };
}

function isFirebaseConfigReady(config) {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId,
  );
}

function loadFirebaseConfig() {
  try {
    const raw = localStorage.getItem(firebaseConfigKey);
    if (!raw) return createFirebaseConfigForm();
    const parsed = JSON.parse(raw);
    return createFirebaseConfigForm(parsed);
  } catch {
    return createFirebaseConfigForm();
  }
}

function saveFirebaseConfig(config) {
  localStorage.setItem(firebaseConfigKey, JSON.stringify(config));
}

function toNum(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function calcRate(entryPrice, exitPrice, side) {
  const en = toNum(entryPrice);
  const ex = toNum(exitPrice);
  if (en === null || ex === null || en === 0) return "";
  const raw = side === "Short" ? ((en - ex) / en) * 100 : ((ex - en) / en) * 100;
  return raw.toFixed(2);
}

function calcRiskReward(entryPrice, stopPrice, targetPrice, side) {
  const en = toNum(entryPrice);
  const st = toNum(stopPrice);
  const ta = toNum(targetPrice);
  if (en === null || st === null || ta === null || en === 0) {
    return { riskPct: "", rewardPct: "", rr: "" };
  }

  const risk = side === "Short" ? ((st - en) / en) * 100 : ((en - st) / en) * 100;
  const reward = side === "Short" ? ((en - ta) / en) * 100 : ((ta - en) / en) * 100;

  if (risk <= 0 || reward <= 0) {
    return {
      riskPct: Number.isFinite(risk) ? risk.toFixed(2) : "",
      rewardPct: Number.isFinite(reward) ? reward.toFixed(2) : "",
      rr: "",
    };
  }

  return {
    riskPct: risk.toFixed(2),
    rewardPct: reward.toFixed(2),
    rr: (reward / risk).toFixed(2),
  };
}

function formatSigned(value, digits = 2, suffix = "%") {
  const n = Number(value);
  if (!Number.isFinite(n)) return `0${suffix}`;
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}${suffix}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
    reader.readAsDataURL(file);
  });
}

function recalculateEntry(entry) {
  const rr = calcRiskReward(entry.entryPrice, entry.stopPrice, entry.targetPrice, entry.side);
  const pnl = entry.entryPrice && entry.exitPrice ? calcRate(entry.entryPrice, entry.exitPrice, entry.side) : entry.pnl || "";
  return {
    ...entry,
    pnl,
    riskPct: rr.riskPct,
    rewardPct: rr.rewardPct,
    riskReward: rr.rr,
    updatedAt: Date.now(),
  };
}

function computeStats(entries) {
  const finished = entries.filter((e) => e.status === "종료" && e.pnl !== "" && Number.isFinite(Number(e.pnl)));
  const wins = finished.filter((e) => Number(e.pnl) > 0);
  const losses = finished.filter((e) => Number(e.pnl) < 0);
  const total = finished.length;
  const grossWin = wins.reduce((sum, e) => sum + Number(e.pnl), 0);
  const grossLoss = losses.reduce((sum, e) => sum + Number(e.pnl), 0);
  const totalRRItems = finished.filter((e) => e.riskReward !== "" && Number.isFinite(Number(e.riskReward)));

  return {
    finished,
    summary: {
      total,
      wins: wins.length,
      losses: losses.length,
      avg: total ? finished.reduce((sum, e) => sum + Number(e.pnl), 0) / total : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      avgWin: wins.length ? grossWin / wins.length : 0,
      net: finished.reduce((sum, e) => sum + Number(e.pnl), 0),
      winRate: total ? (wins.length / total) * 100 : 0,
      lossRate: total ? (losses.length / total) * 100 : 0,
      profitFactor: Math.abs(grossLoss) > 0 ? grossWin / Math.abs(grossLoss) : grossWin > 0 ? Infinity : 0,
      avgRR: totalRRItems.length ? totalRRItems.reduce((sum, e) => sum + Number(e.riskReward), 0) / totalRRItems.length : 0,
    },
  };
}

function groupByDate(entries) {
  const map = new Map();
  entries.forEach((e) => {
    const key = e.date;
    const prev = map.get(key) || { date: key, count: 0, win: 0, loss: 0, pnl: 0 };
    const pnl = Number(e.pnl);
    prev.count += 1;
    prev.pnl += pnl;
    if (pnl > 0) prev.win += 1;
    if (pnl < 0) prev.loss += 1;
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function groupByMonth(entries) {
  const map = new Map();
  entries.forEach((e) => {
    const key = e.date.slice(0, 7);
    const prev = map.get(key) || { month: key, count: 0, win: 0, loss: 0, pnl: 0 };
    const pnl = Number(e.pnl);
    prev.count += 1;
    prev.pnl += pnl;
    if (pnl > 0) prev.win += 1;
    if (pnl < 0) prev.loss += 1;
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
}

function buildCategoryStats(entries) {
  return assetCategories.map((category) => {
    const items = entries.filter((e) => e.category === category);
    return {
      category,
      count: items.length,
      pnl: items.reduce((sum, e) => sum + Number(e.pnl || 0), 0),
      wins: items.filter((e) => Number(e.pnl) > 0).length,
      losses: items.filter((e) => Number(e.pnl) < 0).length,
    };
  });
}

function normalizeSymbol(raw, category) {
  const text = String(raw || "").trim().toUpperCase().replaceAll(" ", "");
  if (!text) return "BINANCE:BTCUSDT";
  if (text.includes(":")) return text;
  if (category === "국내주식") return `KRX:${text.replace(/\.KS$|\.KQ$/g, "")}`;
  if (category === "해외주식") return `NASDAQ:${text}`;
  if (category === "알트") return `BINANCE:${text.includes("USDT") ? text : `${text}USDT`}`;
  return `BINANCE:${text.includes("USDT") ? text : `${text}USDT`}`;
}

function buildTradingViewEmbedUrl(symbol, timeframe) {
  const intervalMap = { "5M": "5", "15M": "15", "1H": "60", "4H": "240", "1D": "D" };
  const interval = intervalMap[timeframe] || "60";
  const tvSymbol = encodeURIComponent(symbol);
  return `https://s.tradingview.com/widgetembed/?symbol=${tvSymbol}&interval=${interval}&theme=dark&style=1&timezone=Asia%2FSeoul&withdateranges=1&hide_top_toolbar=0&hide_legend=0&saveimage=1`;
}

function buildTradingViewOpenUrl(symbol) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function runSelfTests() {
  return [
    { name: "long pnl", ok: calcRate("100", "110", "Long") === "10.00" },
    { name: "short pnl", ok: calcRate("100", "90", "Short") === "10.00" },
    { name: "zero entry safe", ok: calcRate("0", "90", "Short") === "" },
    { name: "rr long", ok: calcRiskReward("100", "95", "110", "Long").rr === "2.00" },
    { name: "rr short", ok: calcRiskReward("100", "105", "90", "Short").rr === "2.00" },
    { name: "comma parse", ok: toNum("1,234.5") === 1234.5 },
    { name: "krx symbol", ok: normalizeSymbol("005930", "국내주식") === "KRX:005930" },
    { name: "us stock symbol", ok: normalizeSymbol("AAPL", "해외주식") === "NASDAQ:AAPL" },
  ];
}

function getFirebaseServices(config) {
  const app = getApps().length ? getApp() : initializeApp(config);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-cyan-500/10 bg-slate-950/70 shadow-2xl shadow-cyan-950/20 backdrop-blur ${className}`}>{children}</div>;
}
function CardHeader({ children, className = "" }) {
  return <div className={`p-5 md:p-6 ${className}`}>{children}</div>;
}
function CardTitle({ children, className = "" }) {
  return <h2 className={`text-xl font-semibold ${className}`}>{children}</h2>;
}
function CardContent({ children, className = "" }) {
  return <div className={`px-5 pb-5 md:px-6 md:pb-6 ${className}`}>{children}</div>;
}
function Button({ children, className = "", variant = "primary", type = "button", ...props }) {
  const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50";
  const styles = variant === "outline" ? "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400";
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
function Input({ className = "", ...props }) {
  return <input className={`input ${className}`} {...props} />;
}
function Textarea({ className = "", ...props }) {
  return <textarea className={`input ${className}`} {...props} />;
}
function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200 ${className}`}>{children}</span>;
}
function Field({ label, children }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}
function StatCard({ title, value, emoji }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
        <span>{emoji}</span>
        <span>{title}</span>
      </div>
      <div className="text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}
function MetricCard({ label, value, tone = "cyan" }) {
  const tones = { cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200", rose: "border-rose-500/20 bg-rose-500/10 text-rose-200", violet: "border-violet-500/20 bg-violet-500/10 text-violet-200" };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export default function TradingJournalApp() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(createDefaultEntry());
  const [selectedId, setSelectedId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const [firebaseConfig, setFirebaseConfig] = useState(createFirebaseConfigForm());
  const [configOpen, setConfigOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState("브라우저 저장 모드");
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const unsubscribeRef = useRef(null);
  const authUnsubscribeRef = useRef(null);
  const tests = useMemo(() => runSelfTests(), []);

  const activeSymbol = useMemo(() => normalizeSymbol(form.market, form.category), [form.market, form.category]);
  const tvEmbedUrl = useMemo(() => buildTradingViewEmbedUrl(activeSymbol, form.timeframe), [activeSymbol, form.timeframe]);
  const tvOpenUrl = useMemo(() => form.tvLink || buildTradingViewOpenUrl(activeSymbol), [form.tvLink, activeSymbol]);

  useEffect(() => {
    setFirebaseConfig(loadFirebaseConfig());
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed.map((entry) => recalculateEntry({ ...createDefaultEntry(), ...entry, id: entry.id || createId() }));
      setEntries(normalized);
      if (normalized[0]) {
        setSelectedId(normalized[0].id);
        setForm(normalized[0]);
      }
    } catch {
      setLoadError("저장된 로컬 데이터를 불러오지 못해 새 기록으로 시작합니다.");
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      setLoadError("브라우저 저장 공간에 기록을 저장하지 못했습니다.");
    }
  }, [entries]);

  useEffect(() => {
    if (authUnsubscribeRef.current) {
      authUnsubscribeRef.current();
      authUnsubscribeRef.current = null;
    }
    if (!isFirebaseConfigReady(firebaseConfig)) {
      setUser(null);
      setAuthReady(true);
      setSyncMessage("브라우저 저장 모드");
      return;
    }

    try {
      const { auth } = getFirebaseServices(firebaseConfig);
      authUnsubscribeRef.current = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
        if (nextUser) {
          setSyncMessage(`클라우드 동기화 중 · ${nextUser.email || nextUser.displayName || "Google User"}`);
        } else {
          setSyncMessage("Firebase 연결됨 · Google 로그인 대기");
        }
      });
    } catch {
      setSyncMessage("Firebase 초기화 실패 · 로컬 저장 모드");
      setAuthReady(true);
    }

    return () => {
      if (authUnsubscribeRef.current) authUnsubscribeRef.current();
    };
  }, [firebaseConfig]);

  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (!user || !isFirebaseConfigReady(firebaseConfig)) return;

    try {
      const { db } = getFirebaseServices(firebaseConfig);
      const entriesQuery = query(collection(db, "users", user.uid, "entries"), orderBy("updatedAt", "desc"));
      unsubscribeRef.current = onSnapshot(entriesQuery, (snapshot) => {
        const next = snapshot.docs.map((item) => recalculateEntry({ ...createDefaultEntry(), ...item.data(), id: item.id }));
        setEntries(next);
        setSyncMessage(`클라우드 동기화 완료 · ${next.length}개 기록`);
        if (next.length > 0) {
          const keepCurrent = next.find((item) => item.id === selectedId);
          setForm(keepCurrent || next[0]);
          setSelectedId((prev) => (keepCurrent ? prev : next[0].id));
        }
      });
    } catch {
      setSyncMessage("실시간 동기화 실패 · 로컬 저장 모드");
    }

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user, firebaseConfig, selectedId]);

  const derived = useMemo(() => computeStats(entries), [entries]);
  const finished = derived.finished;
  const stats = derived.summary;
  const dailyStats = useMemo(() => groupByDate(finished).slice(0, 10), [finished]);
  const monthlyStats = useMemo(() => groupByMonth(finished), [finished]);
  const categoryStats = useMemo(() => buildCategoryStats(finished), [finished]);

  const filtered = useMemo(() => {
    const normalizedSearch = queryStringNormalize(searchText);
    return entries.filter((e) => {
      const matchesQuery = !normalizedSearch
        ? true
        : queryStringNormalize([e.date, e.category, e.market, e.side, e.setup, e.thesis, e.lesson, e.tags].join(" ")).includes(normalizedSearch);
      const matchesCategory = categoryFilter === "전체" ? true : e.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [entries, searchText, categoryFilter]);

  function updateForm(key, value) {
    setForm((prev) => recalculateEntry({ ...prev, [key]: value }));
  }

  async function handleScreenshotChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      if (user && isFirebaseConfigReady(firebaseConfig)) {
        const { storage } = getFirebaseServices(firebaseConfig);
        const storageRef = ref(storage, `users/${user.uid}/screenshots/${form.id}-${Date.now()}`);
        await uploadString(storageRef, dataUrl, "data_url");
        const downloadUrl = await getDownloadURL(storageRef);
        setForm((prev) => ({ ...prev, screenshot: downloadUrl, updatedAt: Date.now() }));
      } else {
        setForm((prev) => ({ ...prev, screenshot: dataUrl, updatedAt: Date.now() }));
      }
    } catch {
      setFileError("스크린샷을 불러오지 못했습니다.");
    }
  }

  async function signInWithGoogle() {
    if (!isFirebaseConfigReady(firebaseConfig)) {
      setConfigOpen(true);
      setSyncMessage("먼저 Firebase 설정을 입력해줘.");
      return;
    }
    try {
      const { auth } = getFirebaseServices(firebaseConfig);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch {
      setSyncMessage("Google 로그인 실패");
    }
  }

  async function signOutGoogle() {
    try {
      const { auth } = getFirebaseServices(firebaseConfig);
      await signOut(auth);
    } catch {
      setSyncMessage("로그아웃 실패");
    }
  }

  async function saveEntry() {
    const nextEntry = recalculateEntry(form);
    setForm(nextEntry);

    if (user && isFirebaseConfigReady(firebaseConfig)) {
      try {
        setIsSavingCloud(true);
        const { db } = getFirebaseServices(firebaseConfig);
        await setDoc(
          doc(db, "users", user.uid, "entries", nextEntry.id),
          {
            ...nextEntry,
            userId: user.uid,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setSelectedId(nextEntry.id);
        setSyncMessage("클라우드에 저장됨");
        return;
      } catch {
        setSyncMessage("클라우드 저장 실패 · 로컬 저장으로 유지");
      } finally {
        setIsSavingCloud(false);
      }
    }

    setEntries((prev) => {
      const index = prev.findIndex((e) => e.id === nextEntry.id);
      if (index === -1) return [nextEntry, ...prev];
      const clone = [...prev];
      clone[index] = nextEntry;
      return clone;
    });
    setSelectedId(nextEntry.id);
  }

  function newEntry() {
    const fresh = createDefaultEntry();
    setForm(fresh);
    setSelectedId(fresh.id);
    setFileError("");
  }

  function selectEntry(id) {
    const found = entries.find((e) => e.id === id);
    if (!found) return;
    setForm(found);
    setSelectedId(id);
    setFileError("");
  }

  async function deleteEntry(id) {
    if (!id) return;
    if (user && isFirebaseConfigReady(firebaseConfig)) {
      try {
        const { db } = getFirebaseServices(firebaseConfig);
        await deleteDoc(doc(db, "users", user.uid, "entries", id));
        return;
      } catch {
        setSyncMessage("클라우드 삭제 실패");
      }
    }

    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (selectedId === id) {
        if (next[0]) {
          setForm(next[0]);
          setSelectedId(next[0].id);
        } else {
          const fresh = createDefaultEntry();
          setForm(fresh);
          setSelectedId(fresh.id);
        }
      }
      return next;
    });
  }

  function handleConfigField(key, value) {
    setFirebaseConfig((prev) => ({ ...prev, [key]: value }));
  }

  function applyFirebaseConfig() {
    saveFirebaseConfig(firebaseConfig);
    setConfigOpen(false);
    setSyncMessage(isFirebaseConfigReady(firebaseConfig) ? "Firebase 설정 저장됨" : "설정이 아직 완전하지 않음");
  }

  return (
    <div className="min-h-screen app-bg p-3 text-slate-100 md:p-6">
      <div className="mx-auto mb-4 flex max-w-7xl flex-col gap-3 rounded-3xl border border-cyan-500/10 bg-slate-950/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-cyan-100">모바일 + 구글 로그인 + 클라우드 저장 + TradingView 연결</div>
          <div className="text-sm text-slate-400">{syncMessage}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfigOpen((v) => !v)}>
            Firebase 설정
          </Button>
          {user ? (
            <Button variant="outline" onClick={signOutGoogle}>
              로그아웃
            </Button>
          ) : (
            <Button onClick={signInWithGoogle} disabled={!authReady}>
              Google 로그인
            </Button>
          )}
        </div>
      </div>

      {configOpen ? (
        <div className="mx-auto mb-4 max-w-7xl rounded-3xl border border-violet-500/10 bg-slate-950/70 p-4 shadow-2xl shadow-violet-950/20 backdrop-blur">
          <div className="mb-3 text-lg font-semibold text-violet-100">Firebase 설정</div>
          <div className="mb-4 text-sm text-slate-400">Firebase 프로젝트를 만들고 Authentication에서 Google 로그인, Firestore Database, Storage를 켠 뒤 아래 키를 넣으면 폰/PC에서 같은 데이터가 동기화돼.</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="apiKey"><Input value={firebaseConfig.apiKey} onChange={(e) => handleConfigField("apiKey", e.target.value)} /></Field>
            <Field label="authDomain"><Input value={firebaseConfig.authDomain} onChange={(e) => handleConfigField("authDomain", e.target.value)} /></Field>
            <Field label="projectId"><Input value={firebaseConfig.projectId} onChange={(e) => handleConfigField("projectId", e.target.value)} /></Field>
            <Field label="storageBucket"><Input value={firebaseConfig.storageBucket} onChange={(e) => handleConfigField("storageBucket", e.target.value)} /></Field>
            <Field label="messagingSenderId"><Input value={firebaseConfig.messagingSenderId} onChange={(e) => handleConfigField("messagingSenderId", e.target.value)} /></Field>
            <Field label="appId"><Input value={firebaseConfig.appId} onChange={(e) => handleConfigField("appId", e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={applyFirebaseConfig}>설정 저장</Button>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              닫기
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[360px,1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-cyan-100">📝 매매일지</CardTitle>
                <Button onClick={newEntry}>＋ 새 기록</Button>
              </div>
              <div className="mt-4 grid gap-3">
                <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="종목, 셋업, 태그 검색" />
                <div className="flex flex-wrap gap-2">
                  {["전체", ...assetCategories].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategoryFilter(item)}
                      className={`rounded-full px-3 py-1.5 text-xs transition ${categoryFilter === item ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {loadError ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{loadError}</div> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard title="종료 매매" value={stats.total} emoji="📊" />
                <StatCard title="승률" value={`${stats.winRate.toFixed(1)}%`} emoji="🎯" />
                <StatCard title="평균 손익" value={formatSigned(stats.avg)} emoji="💹" />
                <StatCard title="평균 손익비" value={stats.avgRR ? `${stats.avgRR.toFixed(2)} R` : "0 R"} emoji="⚖️" />
                <StatCard title="손실 비율" value={`${stats.lossRate.toFixed(1)}%`} emoji="📉" />
                <StatCard title="누적 손익" value={formatSigned(stats.net)} emoji="📅" />
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-200">자산군별 집계</div>
                <div className="grid gap-2">
                  {categoryStats.map((item) => (
                    <div key={item.category} className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge>{item.category}</Badge>
                        <span className="text-slate-300">{item.count}건</span>
                      </div>
                      <div className="text-right">
                        <div className={item.pnl >= 0 ? "text-cyan-300" : "text-rose-300"}>{formatSigned(item.pnl)}</div>
                        <div className="text-xs text-slate-400">승 {item.wins} / 손 {item.losses}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="max-h-[48vh] space-y-2 overflow-auto pr-1">
                {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">아직 기록이 없어요. 첫 매매일지를 만들어보세요.</div> : null}
                {filtered.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => selectEntry(entry.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === entry.id ? "border-cyan-400 bg-cyan-400/10 text-white shadow-lg shadow-cyan-950/20" : "border-slate-800 bg-slate-900/70 hover:border-slate-600"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{entry.market}</div>
                        <Badge>{entry.category}</Badge>
                      </div>
                      <div className="text-xs text-slate-400">{entry.date}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span>{entry.side}</span>
                      <span>·</span>
                      <span>{entry.setup}</span>
                      <span>·</span>
                      <span>{entry.status}</span>
                      {entry.pnl ? <span className={Number(entry.pnl) >= 0 ? "text-cyan-300" : "text-rose-300"}>· {entry.pnl}%</span> : null}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-slate-400">{entry.thesis || "진입 근거를 적어보세요."}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-cyan-100">TradingView 복기 템플릿</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => deleteEntry(form.id)}>
                    삭제
                  </Button>
                  <Button onClick={saveEntry} disabled={isSavingCloud}>
                    {isSavingCloud ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">TradingView 연결</h3>
                <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
                    <iframe title="TradingView" src={tvEmbedUrl} className="h-[420px] w-full border-0" />
                  </div>
                  <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">현재 심볼</div>
                      <div className="mt-1 text-sm text-cyan-300">{activeSymbol}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">트레이딩뷰 오픈</div>
                      <a href={tvOpenUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-cyan-300 underline underline-offset-4">
                        새 탭에서 열기
                      </a>
                    </div>
                    <div className="text-xs text-slate-400">실시간 주문 연동은 브로커/TradingView 웹훅 서버가 따로 필요해서 여기서는 차트 링크, 심볼 동기화, 복기 중심으로 연결해뒀어.</div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">기본 정보</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => updateForm("date", e.target.value)} /></Field>
                  <Field label="자산군">
                    <select className="input" value={form.category} onChange={(e) => updateForm("category", e.target.value)}>
                      {assetCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="종목"><Input value={form.market} onChange={(e) => updateForm("market", e.target.value)} placeholder="BTCUSDT / 005930 / AAPL" /></Field>
                  <Field label="방향">
                    <select className="input" value={form.side} onChange={(e) => updateForm("side", e.target.value)}>
                      <option value="Long">Long</option>
                      <option value="Short">Short</option>
                    </select>
                  </Field>
                  <Field label="셋업">
                    <select className="input" value={form.setup} onChange={(e) => updateForm("setup", e.target.value)}>
                      <option value="반등매매">반등매매</option>
                      <option value="돌파매매">돌파매매</option>
                      <option value="눌림목">눌림목</option>
                      <option value="추세추종">추세추종</option>
                      <option value="역추세">역추세</option>
                    </select>
                  </Field>
                  <Field label="타임프레임">
                    <select className="input" value={form.timeframe} onChange={(e) => updateForm("timeframe", e.target.value)}>
                      <option value="5M">5M</option>
                      <option value="15M">15M</option>
                      <option value="1H">1H</option>
                      <option value="4H">4H</option>
                      <option value="1D">1D</option>
                    </select>
                  </Field>
                  <Field label="상태">
                    <select className="input" value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                      <option value="대기">대기</option>
                      <option value="진행중">진행중</option>
                      <option value="종료">종료</option>
                    </select>
                  </Field>
                  <Field label="스토캐스틱">
                    <select className="input" value={form.stochastic} onChange={(e) => updateForm("stochastic", e.target.value)}>
                      <option value="과매도">과매도</option>
                      <option value="중립">중립</option>
                      <option value="과매수">과매수</option>
                    </select>
                  </Field>
                  <Field label="시장 상태">
                    <select className="input" value={form.marketCondition} onChange={(e) => updateForm("marketCondition", e.target.value)}>
                      <option value="상승">상승</option>
                      <option value="하락">하락</option>
                      <option value="횡보">횡보</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">가격 / 손익비</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Field label="진입가"><Input value={form.entryPrice} onChange={(e) => updateForm("entryPrice", e.target.value)} /></Field>
                  <Field label="손절가"><Input value={form.stopPrice} onChange={(e) => updateForm("stopPrice", e.target.value)} /></Field>
                  <Field label="목표가"><Input value={form.targetPrice} onChange={(e) => updateForm("targetPrice", e.target.value)} /></Field>
                  <Field label="청산가"><Input value={form.exitPrice} onChange={(e) => updateForm("exitPrice", e.target.value)} /></Field>
                  <Field label="수익률(%)"><Input value={form.pnl} onChange={(e) => updateForm("pnl", e.target.value)} /></Field>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <MetricCard label="리스크" value={form.riskPct ? `${form.riskPct}%` : "-"} tone="rose" />
                  <MetricCard label="리워드" value={form.rewardPct ? `${form.rewardPct}%` : "-"} tone="cyan" />
                  <MetricCard label="손익비(R:R)" value={form.riskReward ? `1 : ${form.riskReward}` : "-"} tone="violet" />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">스크린샷</h3>
                <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
                  <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center hover:border-cyan-400 hover:bg-slate-900">
                    <span className="mb-3 text-3xl">📷</span>
                    <span className="text-sm font-medium text-slate-200">차트 스크린샷 업로드</span>
                    <span className="mt-1 text-xs text-slate-400">로그인 상태면 클라우드 스토리지에 저장돼.</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
                  </label>
                  <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-3">
                    {form.screenshot ? <img src={form.screenshot} alt="trade screenshot" className="h-full max-h-[360px] w-full rounded-2xl object-contain" /> : <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl bg-slate-950/70 text-sm text-slate-400">아직 첨부된 스크린샷이 없습니다.</div>}
                    {fileError ? <div className="mt-3 text-sm text-rose-300">{fileError}</div> : null}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">진입 전 메모</h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="진입 근거"><Textarea rows={5} value={form.thesis} onChange={(e) => updateForm("thesis", e.target.value)} placeholder="예: 스토캐스틱 과매도 + 240MA 근접 + FVG 하단 반응" /></Field>
                  <Field label="체결 메모 / 실행 이유"><Textarea rows={5} value={form.executionNote} onChange={(e) => updateForm("executionNote", e.target.value)} placeholder="예: 진입은 좋았지만 1차 반등에서 확신 부족" /></Field>
                  <Field label="시나리오 A"><Textarea rows={4} value={form.scenarioA} onChange={(e) => updateForm("scenarioA", e.target.value)} placeholder="예: 지지 확인 후 반등 지속" /></Field>
                  <Field label="시나리오 B"><Textarea rows={4} value={form.scenarioB} onChange={(e) => updateForm("scenarioB", e.target.value)} placeholder="예: 저점 스윕 후 재차 회복" /></Field>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">복기</h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label="결과 리뷰"><Textarea rows={5} value={form.resultReview} onChange={(e) => updateForm("resultReview", e.target.value)} /></Field>
                  <Field label="실수"><Textarea rows={5} value={form.mistake} onChange={(e) => updateForm("mistake", e.target.value)} /></Field>
                  <Field label="배운 점"><Textarea rows={4} value={form.lesson} onChange={(e) => updateForm("lesson", e.target.value)} /></Field>
                  <div className="grid gap-3">
                    <Field label="외부 흐름"><Input value={form.externalFlow} onChange={(e) => updateForm("externalFlow", e.target.value)} /></Field>
                    <Field label="TradingView 링크"><Input value={form.tvLink} onChange={(e) => updateForm("tvLink", e.target.value)} placeholder="붙여넣으면 기본 링크 대신 사용" /></Field>
                    <Field label="태그"><Input value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} /></Field>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">월별 / 일별 통계</h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="mb-3 text-sm font-semibold text-slate-200">최근 일별 통계</div><div className="space-y-2">{dailyStats.length === 0 ? <div className="text-sm text-slate-400">종료된 매매가 아직 없습니다.</div> : null}{dailyStats.map((item) => <div key={item.date} className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-3 py-2 text-sm"><div><div className="font-medium text-slate-200">{item.date}</div><div className="text-xs text-slate-400">총 {item.count}건 · 승 {item.win} · 손 {item.loss}</div></div><div className={item.pnl >= 0 ? "text-cyan-300" : "text-rose-300"}>{formatSigned(item.pnl)}</div></div>)}</div></CardContent></Card>
                  <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="mb-3 text-sm font-semibold text-slate-200">월별 통계</div><div className="space-y-2 max-h-[300px] overflow-auto pr-1">{monthlyStats.length === 0 ? <div className="text-sm text-slate-400">종료된 매매가 아직 없습니다.</div> : null}{monthlyStats.map((item) => <div key={item.month} className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-3 py-2 text-sm"><div><div className="font-medium text-slate-200">{item.month}</div><div className="text-xs text-slate-400">총 {item.count}건 · 승 {item.win} · 손 {item.loss}</div></div><div className={item.pnl >= 0 ? "text-cyan-300" : "text-rose-300"}>{formatSigned(item.pnl)}</div></div>)}</div></CardContent></Card>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">TradingView에 붙일 텍스트</h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="mb-2 text-sm font-semibold text-cyan-200">진입 전</div><pre className="whitespace-pre-wrap text-sm text-slate-300">{`[진입 이유]\n- ${form.thesis || ""}\n\n[시장 상태]\n- ${form.category} / ${form.marketCondition} / ${form.stochastic}\n- ${form.externalFlow || ""}\n\n[시나리오]\nA: ${form.scenarioA || ""}\nB: ${form.scenarioB || ""}\n\n[손절]\n- ${form.stopPrice || ""}\n\n[목표 / 손익비]\n- 목표가: ${form.targetPrice || ""}\n- 손익비: ${form.riskReward ? `1:${form.riskReward}` : ""}`}</pre></CardContent></Card>
                  <Card className="border-slate-800 bg-slate-900/60"><CardContent className="p-4"><div className="mb-2 text-sm font-semibold text-cyan-200">청산 후</div><pre className="whitespace-pre-wrap text-sm text-slate-300">{`[결과]\n- ${form.pnl ? `${form.pnl}%` : ""}\n- ${form.resultReview || ""}\n\n[실수]\n- ${form.mistake || ""}\n\n[배운 점]\n- ${form.lesson || ""}`}</pre></CardContent></Card>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-slate-100">검증</h3>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {tests.map((test) => <div key={test.name} className={`rounded-2xl border px-3 py-2 text-sm ${test.ok ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-200" : "border-rose-500/20 bg-rose-500/10 text-rose-200"}`}>{test.ok ? "통과" : "실패"} · {test.name}</div>)}
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function queryStringNormalize(value) {
  return String(value || "").toLowerCase().trim();
}
