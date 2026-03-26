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
const storageKey = "trading-journal-a-local";
const firebaseConfigKey = "tv-journal-firebase-config";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
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
    thesis: "",
    note: "",
    review: "",
    screenshot: "",
    tvLink: "",
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
      config.appId
  );
}

function loadFirebaseConfig() {
  try {
    const raw = localStorage.getItem(firebaseConfigKey);
    if (!raw) return createFirebaseConfigForm();
    return createFirebaseConfigForm(JSON.parse(raw));
  } catch {
    return createFirebaseConfigForm();
  }
}

function saveFirebaseConfig(config) {
  localStorage.setItem(firebaseConfigKey, JSON.stringify(config));
}

function safeParseEntries(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toNum(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function calcRate(entryPrice, exitPrice, side) {
  const entry = toNum(entryPrice);
  const exit = toNum(exitPrice);
  if (entry === null || exit === null || entry === 0) return "";
  const raw = side === "Short" ? ((entry - exit) / entry) * 100 : ((exit - entry) / entry) * 100;
  return raw.toFixed(2);
}

function calcRiskReward(entryPrice, stopPrice, targetPrice, side) {
  const entry = toNum(entryPrice);
  const stop = toNum(stopPrice);
  const target = toNum(targetPrice);
  if (entry === null || stop === null || target === null || entry === 0) {
    return { riskPct: "", rewardPct: "", rr: "" };
  }

  const risk = side === "Short" ? ((stop - entry) / entry) * 100 : ((entry - stop) / entry) * 100;
  const reward = side === "Short" ? ((entry - target) / entry) * 100 : ((target - entry) / entry) * 100;

  return {
    riskPct: risk > 0 ? risk.toFixed(2) : "",
    rewardPct: reward > 0 ? reward.toFixed(2) : "",
    rr: risk > 0 && reward > 0 ? (reward / risk).toFixed(2) : "",
  };
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

function formatSigned(value, digits = 2, suffix = "%") {
  const n = Number(value);
  if (!Number.isFinite(n)) return `0${suffix}`;
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}${suffix}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

function normalizeSymbol(raw, category) {
  const text = String(raw || "").trim().toUpperCase().replaceAll(" ", "");
  if (!text) return "BINANCE:BTCUSDT";
  if (text.includes(":")) return text;
  if (category === "국내주식") return `KRX:${text.replace(/\.KS$|\.KQ$/g, "")}`;
  if (category === "해외주식") return `NASDAQ:${text}`;
  return `BINANCE:${text.includes("USDT") ? text : `${text}USDT`}`;
}

function buildTradingViewEmbedUrl(symbol, timeframe) {
  const intervalMap = { "5M": "5", "15M": "15", "1H": "60", "4H": "240", "1D": "D" };
  const interval = intervalMap[timeframe] || "60";
  return `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=${interval}&theme=dark&style=1&timezone=Asia%2FSeoul&withdateranges=1&hide_top_toolbar=0&hide_legend=0&saveimage=1`;
}

function buildTradingViewOpenUrl(symbol) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function getFirebaseServices(config) {
  const app = getApps().length ? getApp() : initializeApp(config);
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

function computeStats(entries) {
  const finished = entries.filter((e) => e.status === "종료" && e.pnl !== "" && Number.isFinite(Number(e.pnl)));
  const wins = finished.filter((e) => Number(e.pnl) > 0);
  const losses = finished.filter((e) => Number(e.pnl) < 0);
  const total = finished.length;
  const net = finished.reduce((sum, e) => sum + Number(e.pnl), 0);
  const rrItems = finished.filter((e) => e.riskReward && Number.isFinite(Number(e.riskReward)));
  return {
    total,
    winRate: total ? (wins.length / total) * 100 : 0,
    avg: total ? net / total : 0,
    net,
    avgRR: rrItems.length ? rrItems.reduce((sum, e) => sum + Number(e.riskReward), 0) / rrItems.length : 0,
  };
}

function queryStringNormalize(value) {
  return String(value || "").toLowerCase().trim();
}

function Card({ children, className = "" }) {
  return <div className={`rounded-[28px] border border-white/6 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}>{children}</div>;
}
function Button({ children, className = "", variant = "primary", ...props }) {
  const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-50";
  const style = variant === "outline" ? "border border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.06]" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-950/30";
  return <button className={`${base} ${style} ${className}`} {...props}>{children}</button>;
}
function Input(props) {
  return <input className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" {...props} />;
}
function Textarea(props) {
  return <textarea className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" {...props} />;
}
function Field({ label, children }) {
  return <label><span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>{children}</label>;
}
function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

function ListItem({ entry, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-3 text-left transition ${selected ? "border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/20" : "border-white/6 bg-black/15 hover:bg-white/[0.04]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-slate-100">{entry.market}</div>
        <div className="text-[11px] text-slate-500">{entry.date}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className="rounded-full bg-white/[0.04] px-2 py-1">{entry.category}</span>
        <span className="rounded-full bg-white/[0.04] px-2 py-1">{entry.side}</span>
        <span className="rounded-full bg-white/[0.04] px-2 py-1">{entry.status}</span>
      </div>
      <div className="mt-2 text-sm text-slate-300">{entry.pnl ? `${entry.pnl}%` : "미청산"}</div>
    </button>
  );
}

function MetricCard({ label, value, tone = "cyan" }) {
  const tones = {
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.cyan}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
function Section({ title, children, action = null }) {
  return (
    <section className="rounded-[26px] border border-white/6 bg-black/15 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-slate-100">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(createDefaultEntry());
  const [queryText, setQueryText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [firebaseConfig, setFirebaseConfig] = useState(createFirebaseConfigForm());
  const [configOpen, setConfigOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState("브라우저 저장 모드");
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loadError, setLoadError] = useState("");
  const unsubscribeRef = useRef(null);
  const authUnsubscribeRef = useRef(null);

  const activeSymbol = useMemo(() => normalizeSymbol(form.market, form.category), [form.market, form.category]);
  const tvEmbedUrl = useMemo(() => buildTradingViewEmbedUrl(activeSymbol, form.timeframe), [activeSymbol, form.timeframe]);
  const tvOpenUrl = useMemo(() => form.tvLink || buildTradingViewOpenUrl(activeSymbol), [form.tvLink, activeSymbol]);
  const stats = useMemo(() => computeStats(entries), [entries]);

  const filteredEntries = useMemo(() => {
    const q = queryStringNormalize(queryText);
    return entries.filter((entry) => {
      const haystack = queryStringNormalize([entry.market, entry.category, entry.setup, entry.tags, entry.thesis, entry.note].join(" "));
      const queryMatch = !q || haystack.includes(q);
      const categoryMatch = categoryFilter === "전체" || entry.category === categoryFilter;
      return queryMatch && categoryMatch;
    });
  }, [entries, queryText, categoryFilter]);

  useEffect(() => {
    setFirebaseConfig(loadFirebaseConfig());
  }, []);

  useEffect(() => {
    const localEntries = safeParseEntries(localStorage.getItem(storageKey) || "[]").map((entry) => recalculateEntry({ ...createDefaultEntry(), ...entry, id: entry.id || createId() }));
    setEntries(localEntries);
    if (localEntries[0]) {
      setSelectedId(localEntries[0].id);
      setForm(localEntries[0]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      setLoadError("로컬 저장에 실패했습니다.");
    }
  }, [entries]);

  useEffect(() => {
    if (authUnsubscribeRef.current) {
      authUnsubscribeRef.current();
      authUnsubscribeRef.current = null;
    }
    if (!isFirebaseConfigReady(firebaseConfig)) {
      setAuthReady(true);
      setUser(null);
      setSyncMessage("브라우저 저장 모드");
      return;
    }
    try {
      const { auth } = getFirebaseServices(firebaseConfig);
      authUnsubscribeRef.current = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setAuthReady(true);
        setSyncMessage(nextUser ? `클라우드 동기화 완료 · ${nextUser.email || nextUser.displayName || "Google User"}` : "Firebase 연결됨 · Google 로그인 대기");
      });
    } catch {
      setAuthReady(true);
      setSyncMessage("Firebase 초기화 실패 · 로컬 저장 모드");
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
      const q = query(collection(db, "users", user.uid, "entries"), orderBy("updatedAt", "desc"));
      unsubscribeRef.current = onSnapshot(q, (snapshot) => {
        const nextEntries = snapshot.docs.map((docItem) => {
          const data = docItem.data();
          return recalculateEntry({ ...createDefaultEntry(), ...data, id: docItem.id });
        });
        setEntries(nextEntries);
        if (selectedId) {
          const selected = nextEntries.find((item) => item.id === selectedId);
          if (selected) setForm(selected);
        }
      });
    } catch {
      setSyncMessage("실시간 동기화 실패 · 로컬 저장 모드");
    }
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user, firebaseConfig, selectedId]);

  function updateForm(key, value) {
    setForm((prev) => recalculateEntry({ ...prev, [key]: value }));
  }

  function handleConfigField(key, value) {
    setFirebaseConfig((prev) => ({ ...prev, [key]: value }));
  }

  function applyFirebaseConfig() {
    saveFirebaseConfig(firebaseConfig);
    setConfigOpen(false);
    setSyncMessage(isFirebaseConfigReady(firebaseConfig) ? "Firebase 설정 저장됨" : "설정이 아직 완전하지 않음");
    window.location.reload();
  }

  async function signInWithGoogle() {
    if (!isFirebaseConfigReady(firebaseConfig)) {
      setConfigOpen(true);
      return;
    }
    try {
      const { auth } = getFirebaseServices(firebaseConfig);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setSyncMessage(`Google 로그인 실패${error?.code ? ` · ${error.code}` : ""}`);
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

  function newEntry() {
    setForm(createDefaultEntry());
    setSelectedId(null);
    setFileError("");
  }

  function selectEntry(id) {
    const found = entries.find((entry) => entry.id === id);
    if (!found) return;
    setForm(found);
    setSelectedId(id);
    setFileError("");
  }

  async function saveEntry() {
    const nextEntry = recalculateEntry(form);
    setForm(nextEntry);

    if (user && isFirebaseConfigReady(firebaseConfig)) {
      try {
        setIsSavingCloud(true);
        const { db } = getFirebaseServices(firebaseConfig);
        await setDoc(doc(db, "users", user.uid, "entries", nextEntry.id), { ...nextEntry, userId: user.uid, updatedAt: serverTimestamp() }, { merge: true });
      } catch {
        setSyncMessage("클라우드 저장 실패 · 로컬 저장으로 유지");
      } finally {
        setIsSavingCloud(false);
      }
    }

    setEntries((prev) => {
      const index = prev.findIndex((entry) => entry.id === nextEntry.id);
      if (index === -1) return [nextEntry, ...prev];
      const clone = [...prev];
      clone[index] = nextEntry;
      return clone;
    });
    setSelectedId(nextEntry.id);
    setSyncMessage(user ? "클라우드에 저장됨" : "브라우저에 저장됨");
  }

  async function deleteEntry(id) {
    if (!id) return;

    if (user && isFirebaseConfigReady(firebaseConfig)) {
      try {
        const { db } = getFirebaseServices(firebaseConfig);
        await deleteDoc(doc(db, "users", user.uid, "entries", id));
      } catch {
        setSyncMessage("클라우드 삭제 실패");
      }
    }

    setEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      const fresh = createDefaultEntry();
      setForm(next[0] || fresh);
      setSelectedId(next[0]?.id || null);
      return next;
    });
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
      setFileError("스크린샷 업로드 실패");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(180deg,#020617_0%,#0b1120_45%,#111827_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-cyan-200">📈 Trading Journal A</h1>
            <p className="text-sm text-slate-400">{syncMessage}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfigOpen((prev) => !prev)}>Firebase 설정</Button>
            {user ? <Button variant="outline" onClick={signOutGoogle}>로그아웃</Button> : <Button onClick={signInWithGoogle} disabled={!authReady}>Google 로그인</Button>}
            <Button onClick={newEntry}>+ 새 기록</Button>
          </div>
        </div>
      </header>

      {configOpen ? (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <Card className="p-4 md:p-5">
            <div className="mb-4 text-lg font-semibold text-violet-200">Firebase 설정</div>
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
              <Button variant="outline" onClick={() => setConfigOpen(false)}>닫기</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-4 p-4 md:p-5 xl:grid-cols-[320px,minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="총 매매" value={stats.total} />
              <StatCard title="승률" value={`${stats.winRate.toFixed(1)}%`} />
              <StatCard title="평균 손익" value={formatSigned(stats.avg)} />
              <StatCard title="평균 RR" value={stats.avgRR ? stats.avgRR.toFixed(2) : "0.00"} />
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold text-slate-200">기록 리스트</div>
            <div className="grid gap-3">
              <Input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="검색" />
              <div className="flex flex-wrap gap-2">
                {["전체", ...assetCategories].map((item) => (
                  <button key={item} type="button" onClick={() => setCategoryFilter(item)} className={`rounded-full px-3 py-1.5 text-xs ${categoryFilter === item ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                    {item}
                  </button>
                ))}
              </div>
              {loadError ? <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{loadError}</div> : null}
              <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
                {filteredEntries.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">기록이 없습니다.</div> : null}
                {filteredEntries.map((entry) => (
                  <ListItem key={entry.id} entry={entry} selected={selectedId === entry.id} onClick={() => selectEntry(entry.id)} />
                ))}
              </div>
            </div>
          </Card>
        </aside>

        <main className="space-y-4 min-w-0">
          <Card className="p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-50">기록 상세 / 입력</div>
                <div className="text-sm text-slate-400">노션 + 트레이딩뷰 느낌의 개인용 저널. 빠르게 기록하고, 나중에 B버전으로 확장 가능한 구조.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => deleteEntry(form.id)} disabled={!form.id}>삭제</Button>
                <Button onClick={saveEntry} disabled={isSavingCloud}>{isSavingCloud ? "저장 중..." : "저장"}</Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),320px]">
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Section title="기본 정보">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => updateForm("date", e.target.value)} /></Field>
                      <Field label="자산군"><select className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none" value={form.category} onChange={(e) => updateForm("category", e.target.value)}>{assetCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
                      <Field label="종목"><Input value={form.market} onChange={(e) => updateForm("market", e.target.value)} placeholder="BTCUSDT / 005930 / AAPL" /></Field>
                      <Field label="방향"><select className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none" value={form.side} onChange={(e) => updateForm("side", e.target.value)}><option value="Long">Long</option><option value="Short">Short</option></select></Field>
                      <Field label="셋업"><Input value={form.setup} onChange={(e) => updateForm("setup", e.target.value)} /></Field>
                      <Field label="타임프레임"><select className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none" value={form.timeframe} onChange={(e) => updateForm("timeframe", e.target.value)}><option value="5M">5M</option><option value="15M">15M</option><option value="1H">1H</option><option value="4H">4H</option><option value="1D">1D</option></select></Field>
                      <Field label="상태"><select className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none" value={form.status} onChange={(e) => updateForm("status", e.target.value)}><option value="대기">대기</option><option value="진행중">진행중</option><option value="종료">종료</option></select></Field>
                      <Field label="태그"><Input value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} placeholder="예: 눌림목, FVG" /></Field>
                    </div>
                  </Section>

                  <Section title="가격 / 계산">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="진입가"><Input value={form.entryPrice} onChange={(e) => updateForm("entryPrice", e.target.value)} /></Field>
                      <Field label="손절가"><Input value={form.stopPrice} onChange={(e) => updateForm("stopPrice", e.target.value)} /></Field>
                      <Field label="목표가"><Input value={form.targetPrice} onChange={(e) => updateForm("targetPrice", e.target.value)} /></Field>
                      <Field label="청산가"><Input value={form.exitPrice} onChange={(e) => updateForm("exitPrice", e.target.value)} /></Field>
                      <Field label="수익률(%)"><Input value={form.pnl} onChange={(e) => updateForm("pnl", e.target.value)} /></Field>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <MetricCard label="리스크" value={form.riskPct ? `${form.riskPct}%` : "-"} tone="rose" />
                      <MetricCard label="리워드" value={form.rewardPct ? `${form.rewardPct}%` : "-"} tone="cyan" />
                      <MetricCard label="RR" value={form.riskReward ? `1:${form.riskReward}` : "-"} tone="violet" />
                    </div>
                  </Section>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
                  <Section title="진입 메모">
                    <div className="grid gap-3">
                      <Field label="진입 근거"><Textarea rows={5} value={form.thesis} onChange={(e) => updateForm("thesis", e.target.value)} placeholder="왜 들어갔는지 적기" /></Field>
                      <Field label="추가 메모"><Textarea rows={5} value={form.note} onChange={(e) => updateForm("note", e.target.value)} placeholder="심리, 시나리오, 외부 변수" /></Field>
                    </div>
                  </Section>

                  <Section title="복기">
                    <Field label="복기 메모"><Textarea rows={11} value={form.review} onChange={(e) => updateForm("review", e.target.value)} placeholder="결과, 실수, 배운 점" /></Field>
                  </Section>
                </div>
              </div>

              <div className="space-y-4">
                <Section title="TradingView">
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                      <iframe title="TradingView" src={tvEmbedUrl} className="h-[260px] w-full border-0" />
                    </div>
                    <Field label="TradingView 링크"><Input value={form.tvLink} onChange={(e) => updateForm("tvLink", e.target.value)} placeholder="붙여넣으면 우선 사용" /></Field>
                    <a href={tvOpenUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-cyan-300 underline underline-offset-4">새 탭에서 TradingView 열기</a>
                  </div>
                </Section>

                <Section title="스크린샷">
                  <div className="space-y-3">
                    <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center">
                      <span className="mb-2 text-3xl">📷</span>
                      <span className="text-sm text-slate-200">차트 스크린샷 업로드</span>
                      <span className="mt-1 text-xs text-slate-400">로그인 상태면 클라우드 저장</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
                    </label>
                    {form.screenshot ? <img src={form.screenshot} alt="trade screenshot" className="max-h-[240px] w-full rounded-2xl object-contain" /> : <div className="rounded-2xl bg-slate-900/60 p-4 text-center text-sm text-slate-400">스크린샷 없음</div>}
                    {fileError ? <div className="text-sm text-rose-300">{fileError}</div> : null}
                  </div>
                </Section>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
