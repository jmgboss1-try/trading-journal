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
const settingsKey = "tv-journal-settings";

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
    timeframe: "1H",
    strategy: "반등매매",
    entryPrice: "",
    stopPrice: "",
    targetPrice: "",
    exitPrice: "",
    leverage: "",
    entryAmount: "",
    realizedPnlAmount: "",
    pnl: "",
    riskReward: "",
    riskPct: "",
    rewardPct: "",
    status: "대기",
    stochasticState: "중립",
    rsiState: "없음",
    maState: "혼조",
    analysisMemo: "",
    thesis: "",
    review: "",
    screenshot: "",
    tags: "",
    updatedAt: Date.now(),
  };
}

function createSettingsForm(initial = {}) {
  return {
    startingCapital: initial.startingCapital || "10000",
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

function loadSettings() {
  try {
    const raw = localStorage.getItem(settingsKey);
    if (!raw) return createSettingsForm();
    return createSettingsForm(JSON.parse(raw));
  } catch {
    return createSettingsForm();
  }
}

function saveSettings(settings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
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

function formatCalendarPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "";
  return `${num > 0 ? "+" : ""}${num.toFixed(1)}%`;
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "";
  return `${num > 0 ? "+" : ""}${num.toLocaleString()}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
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
  const total = finished.length;
  const net = finished.reduce((sum, e) => sum + Number(e.pnl), 0);
  const rrItems = finished.filter((e) => e.riskReward && Number.isFinite(Number(e.riskReward)));
  return {
    total,
    winRate: total ? (wins.length / total) * 100 : 0,
    avg: total ? net / total : 0,
    avgRR: rrItems.length ? rrItems.reduce((sum, e) => sum + Number(e.riskReward), 0) / rrItems.length : 0,
  };
}

function buildMonthlyCalendarData(entries, year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  const byDate = {};

  entries.forEach((entry) => {
    if (entry.status !== "종료") return;
    const key = String(entry.date || "").trim();
    const pnlPct = Number(entry.pnl);
    const pnlAmount = Number(entry.realizedPnlAmount);
    if (!key) return;
    if (!byDate[key]) byDate[key] = { percent: 0, amount: 0 };
    if (Number.isFinite(pnlPct)) byDate[key].percent += pnlPct;
    if (Number.isFinite(pnlAmount)) byDate[key].amount += pnlAmount;
  });

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);

  for (let day = 1; day <= lastDate; day += 1) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayData = byDate[key] || { percent: 0, amount: 0 };
    cells.push({ day, key, percent: dayData.percent, amount: dayData.amount });
  }

  return cells;
}

function queryStringNormalize(value) {
  return String(value || "").toLowerCase().trim();
}

function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function Button({ children, variant = "primary", className = "", ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

function Input(props) {
  return <input className="control" {...props} />;
}

function Select(props) {
  return <select className="control" {...props} />;
}

function Textarea(props) {
  return <textarea className="control textarea" {...props} />;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, tone = "cyan" }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="section-card">
      <div className="section-title">{title}</div>
      {children}
    </section>
  );
}

function ListItem({ entry, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`list-item ${selected ? "list-item-selected" : ""}`}>
      <div className="list-item-top">
        <div className="list-item-market">{entry.market}</div>
        <div className="list-item-date">{entry.date}</div>
      </div>
      <div className="list-item-badges">
        <span className="badge">{entry.category}</span>
        <span className="badge">{entry.side}</span>
        <span className="badge">{entry.status}</span>
      </div>
      <div className="list-item-pnl">
        {entry.realizedPnlAmount ? `${formatMoney(entry.realizedPnlAmount)} / ` : ""}
        {entry.pnl ? `${entry.pnl}%` : "미청산"}
      </div>
    </button>
  );
}

function CalendarGrid({ cells, selectedDate, onSelectDate, viewMode }) {
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div>
      <div className="calendar-weekdays">
        {weekDays.map((day, index) => (
          <div key={`${day}-${index}`} className="calendar-weekday">{day}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((cell, index) => {
          if (!cell) return <div key={`blank-${index}`} className="calendar-empty" />;
          const tone = cell.amount > 0 || cell.percent > 0 ? "calendar-profit" : cell.amount < 0 || cell.percent < 0 ? "calendar-loss" : "";
          const selected = selectedDate === cell.key ? "calendar-selected" : "";
          return (
            <button key={cell.key} type="button" onClick={() => onSelectDate(cell.key)} className={`calendar-cell ${tone} ${selected}`}>
              <div className="calendar-day">{cell.day}</div>
              {viewMode === "amount" ? (
                <>
                  <div className="calendar-amount">{formatMoney(cell.amount)}</div>
                  <div className="calendar-pnl">{formatCalendarPercent(cell.percent)}</div>
                </>
              ) : (
                <>
                  <div className="calendar-amount">{formatCalendarPercent(cell.percent)}</div>
                  <div className="calendar-pnl">{formatMoney(cell.amount)}</div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(createDefaultEntry());
  const [queryText, setQueryText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [firebaseConfig, setFirebaseConfig] = useState(createFirebaseConfigForm());
  const [settings, setSettings] = useState(createSettingsForm());
  const [configOpen, setConfigOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState("브라우저 저장 모드");
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loadError, setLoadError] = useState("");
  const unsubscribeRef = useRef(null);
  const authUnsubscribeRef = useRef(null);

  const stats = useMemo(() => computeStats(entries), [entries]);
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [calendarViewMode, setCalendarViewMode] = useState("amount");

  const calendarCells = useMemo(() => buildMonthlyCalendarData(entries, calendarYear, calendarMonth), [entries, calendarYear, calendarMonth]);
  const selectedDateEntries = useMemo(
    () => entries.filter((entry) => entry.date === selectedDate).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [entries, selectedDate]
  );

  const monthlySummary = useMemo(() => {
    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-`;
    const monthEntries = entries.filter((entry) => entry.status === "종료" && String(entry.date || "").startsWith(monthPrefix));
    const totalAmount = monthEntries.reduce((sum, entry) => {
      const num = Number(entry.realizedPnlAmount);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    const totalPercent = monthEntries.reduce((sum, entry) => {
      const num = Number(entry.pnl);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    const startingCapital = Number(settings.startingCapital);
    const safeStartingCapital = Number.isFinite(startingCapital) ? startingCapital : 0;
    const endingCapital = safeStartingCapital + totalAmount;
    const equityRate = safeStartingCapital > 0 ? (totalAmount / safeStartingCapital) * 100 : 0;
    return {
      count: monthEntries.length,
      totalAmount,
      totalPercent,
      startingCapital: safeStartingCapital,
      endingCapital,
      equityRate,
    };
  }, [entries, calendarYear, calendarMonth, settings.startingCapital]);
    const totalAmount = monthEntries.reduce((sum, entry) => {
      const num = Number(entry.realizedPnlAmount);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    const totalPercent = monthEntries.reduce((sum, entry) => {
      const num = Number(entry.pnl);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);
    return {
      count: monthEntries.length,
      totalAmount,
      totalPercent,
    };
  }, [entries, calendarYear, calendarMonth]);

  const filteredEntries = useMemo(() => {
    const q = queryStringNormalize(queryText);
    return entries.filter((entry) => {
      const haystack = queryStringNormalize([entry.market, entry.category, entry.strategy, entry.tags, entry.thesis, entry.review].join(" "));
      const queryMatch = !q || haystack.includes(q);
      const categoryMatch = categoryFilter === "전체" || entry.category === categoryFilter;
      return queryMatch && categoryMatch;
    });
  }, [entries, queryText, categoryFilter]);

  useEffect(() => {
    setFirebaseConfig(loadFirebaseConfig());
    setSettings(loadSettings());
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
      return undefined;
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
    if (!user || !isFirebaseConfigReady(firebaseConfig)) return undefined;

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

  function handleSettingsField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }));
  }

  function applyFirebaseConfig() {
    saveFirebaseConfig(firebaseConfig);
    saveSettings(settings);
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
    const fresh = createDefaultEntry();
    setForm(fresh);
    setSelectedId(null);
    setFileError("");
  }

  function selectEntry(id) {
    const found = entries.find((entry) => entry.id === id);
    if (!found) return;
    setForm(found);
    setSelectedId(id);
    setSelectedDate(found.date || getToday());
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
    setSelectedDate(nextEntry.date);
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

  function goPrevMonth() {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  }

  function goNextMonth() {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; min-height: 100%; }
        body {
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #e2e8f0;
          background: radial-gradient(circle at top, rgba(34,211,238,0.12), transparent 26%), linear-gradient(180deg, #020617 0%, #0b1120 44%, #111827 100%);
        }
        a { color: inherit; }
        .app-shell { min-height: 100vh; }
        .topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(2,6,23,0.8);
          backdrop-filter: blur(18px);
        }
        .topbar-inner, .page {
          max-width: 1280px;
          margin: 0 auto;
        }
        .topbar-inner {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }
        .brand-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 700;
          letter-spacing: -0.04em;
          color: #e0f2fe;
        }
        .brand-sub {
          margin-top: 8px;
          font-size: 14px;
          color: #94a3b8;
        }
        .topbar-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .page {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          padding: 18px 16px 32px;
        }
        .card {
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.04);
          border-radius: 28px;
          box-shadow: 0 18px 60px rgba(0,0,0,0.32);
          backdrop-filter: blur(18px);
        }
        .sidebar { display: grid; gap: 16px; }
        .sidebar, .content { min-width: 0; }
        .card-pad { padding: 16px; }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .stat-card {
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.18);
          padding: 16px;
        }
        .stat-title {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }
        .stat-value {
          margin-top: 8px;
          font-size: 24px;
          font-weight: 700;
          color: #f8fafc;
        }
        .btn {
          appearance: none;
          border: 0;
          border-radius: 18px;
          cursor: pointer;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 600;
          transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
        }
        .btn:hover { transform: translateY(-1px); }
        .btn:disabled { opacity: 0.5; cursor: default; transform: none; }
        .btn-primary { background: #22d3ee; color: #04111f; box-shadow: 0 10px 30px rgba(34, 211, 238, 0.2); }
        .btn-outline { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; }
        .list-title, .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 12px;
        }
        .list-controls { display: grid; gap: 12px; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #cbd5e1;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
        }
        .chip-active { background: #22d3ee; color: #04111f; border-color: transparent; }
        .list-scroll {
          display: grid;
          gap: 10px;
          max-height: 52vh;
          overflow: auto;
          padding-right: 4px;
        }
        .list-item {
          width: 100%;
          text-align: left;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.14);
          color: inherit;
          padding: 14px;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
        }
        .list-item:hover { transform: translateY(-1px); background: rgba(255,255,255,0.05); }
        .list-item-selected { border-color: rgba(34, 211, 238, 0.5); background: rgba(34, 211, 238, 0.1); box-shadow: 0 12px 32px rgba(8, 47, 73, 0.35); }
        .list-item-top { display: flex; justify-content: space-between; gap: 8px; }
        .list-item-market { font-size: 16px; font-weight: 700; color: #f8fafc; }
        .list-item-date { font-size: 12px; color: #64748b; }
        .list-item-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .badge { border-radius: 999px; padding: 5px 9px; font-size: 11px; color: #94a3b8; background: rgba(255,255,255,0.05); }
        .list-item-pnl { margin-top: 10px; font-size: 13px; color: #cbd5e1; }
        .empty-box {
          border: 1px dashed rgba(255,255,255,0.14);
          border-radius: 18px;
          padding: 16px;
          color: #94a3b8;
          font-size: 14px;
          text-align: center;
        }
        .muted-box { border-radius: 18px; background: rgba(245, 158, 11, 0.12); color: #fcd34d; padding: 12px 14px; font-size: 14px; }
        .content-card { padding: 16px; }
        .content-head { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
        .content-title { font-size: 28px; line-height: 1.05; letter-spacing: -0.04em; font-weight: 700; color: #f8fafc; }
        .content-sub { margin-top: 8px; color: #94a3b8; font-size: 14px; }
        .content-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .main-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
        .left-stack, .right-stack { display: grid; gap: 16px; min-width: 0; }
        .two-col { display: grid; gap: 16px; grid-template-columns: 1fr; }
        .section-card {
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.16);
          padding: 14px;
        }
        .form-grid { display: grid; gap: 10px; grid-template-columns: 1fr; }
        .field { display: block; }
        .field-label { display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600; color: #cbd5e1; }
        .control {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(2, 6, 23, 0.55);
          color: #f8fafc;
          padding: 10px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .control:focus { border-color: rgba(34, 211, 238, 0.8); box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.18); background: rgba(2, 6, 23, 0.72); }
        .control[type="date"] { cursor: pointer; }
        .control::placeholder { color: #64748b; }
        .textarea { min-height: 112px; resize: vertical; }
        .metrics-grid { display: grid; gap: 12px; grid-template-columns: 1fr; margin-top: 12px; }
        .metric-card {
          min-width: 0;
          border-radius: 18px;
          padding: 10px 10px 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }
        .metric-cyan { background: rgba(34,211,238,0.08); border-color: rgba(34,211,238,0.16); }
        .metric-rose { background: rgba(244,63,94,0.08); border-color: rgba(244,63,94,0.16); }
        .metric-violet { background: rgba(168,85,247,0.08); border-color: rgba(168,85,247,0.16); }
        .metric-label { font-size: 10px; color: #94a3b8; line-height: 1.15; }
        .metric-value { margin-top: 6px; font-size: 14px; line-height: 1.1; font-weight: 700; color: #f8fafc; white-space: nowrap; }
        .upload-box {
          min-height: 150px;
          border-radius: 18px;
          border: 1px dashed rgba(255,255,255,0.16);
          background: rgba(2,6,23,0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          cursor: pointer;
          padding: 14px;
          color: #cbd5e1;
        }
        .upload-emoji { font-size: 28px; margin-bottom: 8px; }
        .upload-sub { margin-top: 4px; font-size: 12px; color: #94a3b8; }
        .screenshot { width: 100%; max-height: 260px; object-fit: contain; border-radius: 18px; display: block; margin-top: 12px; }
        .file-error { margin-top: 10px; color: #fda4af; font-size: 13px; }
        .config-card { padding: 18px; margin: 18px auto 0; max-width: 1280px; }
        .config-title { font-size: 20px; font-weight: 700; color: #ddd6fe; margin-bottom: 14px; }
        .config-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
        .config-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
        .calendar-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .calendar-title-wrap { display: flex; flex-direction: column; gap: 4px; }
        .calendar-month { font-size: 15px; font-weight: 700; color: #f8fafc; }
        .calendar-sub { font-size: 11px; color: #94a3b8; }
        .calendar-nav { display: flex; gap: 8px; }
        .toggle-group {
          display: inline-flex;
          gap: 6px;
          padding: 4px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          margin-top: 8px;
        }
        .toggle-chip {
          border: 0;
          background: transparent;
          color: #94a3b8;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .toggle-chip-active {
          background: #22d3ee;
          color: #04111f;
        }
        .month-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 10px 0 12px;
        }
        .month-box {
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.04);
          padding: 10px;
        }
        .month-box-label {
          font-size: 10px;
          color: #94a3b8;
          line-height: 1.2;
        }
        .month-box-value {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.15;
          word-break: break-word;
        }
        .icon-btn {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #e2e8f0;
          cursor: pointer;
        }
        .calendar-weekdays, .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
        }
        .calendar-weekday { text-align: center; font-size: 10px; color: #64748b; padding-bottom: 2px; }
        .calendar-empty { min-height: 62px; }
        .calendar-cell {
          min-height: 62px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(2,6,23,0.36);
          color: #e2e8f0;
          padding: 6px 5px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: left;
          cursor: pointer;
        }
        .calendar-profit { background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.24); }
        .calendar-loss { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.24); }
        .calendar-selected { box-shadow: 0 0 0 2px rgba(34,211,238,0.45) inset; }
        .calendar-day { font-size: 11px; color: #cbd5e1; }
        .calendar-amount {
          font-size: 10px;
          line-height: 1.05;
          font-weight: 700;
          text-align: right;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .calendar-pnl { font-size: 9px; line-height: 1.05; color: #cbd5e1; text-align: right; white-space: nowrap; }
        .daily-list { display: grid; gap: 10px; margin-top: 14px; }
        .daily-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .daily-left { min-width: 0; }
        .daily-market { font-size: 13px; font-weight: 700; color: #f8fafc; }
        .daily-meta { margin-top: 3px; font-size: 11px; color: #94a3b8; }
        .daily-pnl { font-size: 13px; font-weight: 700; text-align: right; }
        .positive { color: #4ade80; }
        .negative { color: #f87171; }

        @media (min-width: 720px) {
          .month-summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .topbar-inner { flex-direction: row; align-items: center; justify-content: space-between; }
          .content-head { flex-direction: row; align-items: center; justify-content: space-between; }
          .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .metrics-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .config-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (min-width: 1100px) {
          .page { grid-template-columns: 320px minmax(0, 1fr); }
          .sidebar { position: sticky; top: 96px; align-self: start; }
          .main-grid { grid-template-columns: minmax(0, 1fr) 360px; }
        }

        @media (min-width: 1320px) {
          .config-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
      `}</style>

      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div>
              <h1 className="brand-title">📈 Trading Journal A</h1>
              <div className="brand-sub">{syncMessage}</div>
            </div>
            <div className="topbar-actions">
              <Button variant="outline" onClick={() => setConfigOpen((prev) => !prev)}>Firebase 설정</Button>
              {user ? <Button variant="outline" onClick={signOutGoogle}>로그아웃</Button> : <Button onClick={signInWithGoogle} disabled={!authReady}>Google 로그인</Button>}
              <Button onClick={newEntry}>+ 새 기록</Button>
            </div>
          </div>
        </header>

        {configOpen ? (
          <div className="config-card">
            <Card className="card-pad">
              <div className="config-title">Firebase 설정</div>
              <div className="config-grid">
                <Field label="시작 자산"><Input value={settings.startingCapital} onChange={(e) => handleSettingsField("startingCapital", e.target.value)} placeholder="예: 10000" /></Field>
                <Field label="apiKey"><Input value={firebaseConfig.apiKey} onChange={(e) => handleConfigField("apiKey", e.target.value)} /></Field>
                <Field label="authDomain"><Input value={firebaseConfig.authDomain} onChange={(e) => handleConfigField("authDomain", e.target.value)} /></Field>
                <Field label="projectId"><Input value={firebaseConfig.projectId} onChange={(e) => handleConfigField("projectId", e.target.value)} /></Field>
                <Field label="storageBucket"><Input value={firebaseConfig.storageBucket} onChange={(e) => handleConfigField("storageBucket", e.target.value)} /></Field>
                <Field label="messagingSenderId"><Input value={firebaseConfig.messagingSenderId} onChange={(e) => handleConfigField("messagingSenderId", e.target.value)} /></Field>
                <Field label="appId"><Input value={firebaseConfig.appId} onChange={(e) => handleConfigField("appId", e.target.value)} /></Field>
              </div>
              <div className="config-actions">
                <Button onClick={applyFirebaseConfig}>설정 저장</Button>
                <Button variant="outline" onClick={() => setConfigOpen(false)}>닫기</Button>
              </div>
            </Card>
          </div>
        ) : null}

        <div className="page">
          <aside className="sidebar">
            <Card className="card-pad">
              <div className="stats-grid">
                <StatCard title="총 매매" value={stats.total} />
                <StatCard title="승률" value={`${stats.winRate.toFixed(1)}%`} />
                <StatCard title="평균 손익" value={formatSigned(stats.avg)} />
                <StatCard title="평균 RR" value={stats.avgRR ? stats.avgRR.toFixed(2) : "0.00"} />
              </div>
            </Card>

            <Card className="card-pad">
              <div className="list-title">기록 리스트</div>
              <div className="list-controls">
                <Input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="검색" />
                <div className="chips">
                  {["전체", ...assetCategories].map((item) => (
                    <button key={item} type="button" onClick={() => setCategoryFilter(item)} className={`chip ${categoryFilter === item ? "chip-active" : ""}`}>
                      {item}
                    </button>
                  ))}
                </div>
                {loadError ? <div className="muted-box">{loadError}</div> : null}
                <div className="list-scroll">
                  {filteredEntries.length === 0 ? <div className="empty-box">기록이 없습니다.</div> : null}
                  {filteredEntries.map((entry) => (
                    <ListItem key={entry.id} entry={entry} selected={selectedId === entry.id} onClick={() => selectEntry(entry.id)} />
                  ))}
                </div>
              </div>
            </Card>
          </aside>

          <main className="content">
            <Card className="content-card">
              <div className="content-head">
                <div>
                  <div className="content-title">기록 상세 / 입력</div>
                  <div className="content-sub">노션 느낌의 개인용 저널. 빠르게 기록하고, 날짜별 손익 흐름을 한눈에 보는 구조.</div>
                </div>
                <div className="content-actions">
                  <Button variant="outline" onClick={() => deleteEntry(form.id)} disabled={!form.id}>삭제</Button>
                  <Button onClick={saveEntry} disabled={isSavingCloud}>{isSavingCloud ? "저장 중..." : "저장"}</Button>
                </div>
              </div>

              <div className="main-grid">
                <div className="left-stack">
                  <div className="two-col">
                    <Section title="BTC 기본 정보">
                      <div className="form-grid">
                        <Field label="종목"><Input value={form.market} onChange={(e) => updateForm("market", e.target.value)} placeholder="BTCUSDT / ETHUSDT" /></Field>
                        <Field label="방향"><Select value={form.side} onChange={(e) => updateForm("side", e.target.value)}><option value="Long">Long</option><option value="Short">Short</option></Select></Field>
                        <Field label="타임프레임"><Select value={form.timeframe} onChange={(e) => updateForm("timeframe", e.target.value)}><option value="5M">5M</option><option value="15M">15M</option><option value="1H">1H</option><option value="4H">4H</option><option value="1D">1D</option></Select></Field>
                        <Field label="전략"><Select value={form.strategy} onChange={(e) => updateForm("strategy", e.target.value)}><option value="반등매매">반등매매</option><option value="돌파매매">돌파매매</option><option value="추세추종">추세추종</option><option value="눌림목">눌림목</option><option value="스캘프">스캘프</option><option value="기타">기타</option></Select></Field>
                        <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => updateForm("date", e.target.value)} /></Field>
                        <Field label="상태"><Select value={form.status} onChange={(e) => updateForm("status", e.target.value)}><option value="대기">대기</option><option value="진행중">진행중</option><option value="종료">종료</option></Select></Field>
                      </div>
                    </Section>

                    <Section title="BTC 포지션">
                      <div className="form-grid">
                        <Field label="진입가"><Input value={form.entryPrice} onChange={(e) => updateForm("entryPrice", e.target.value)} /></Field>
                        <Field label="손절가"><Input value={form.stopPrice} onChange={(e) => updateForm("stopPrice", e.target.value)} /></Field>
                        <Field label="목표가"><Input value={form.targetPrice} onChange={(e) => updateForm("targetPrice", e.target.value)} /></Field>
                        <Field label="청산가"><Input value={form.exitPrice} onChange={(e) => updateForm("exitPrice", e.target.value)} /></Field>
                        <Field label="레버리지"><Input value={form.leverage} onChange={(e) => updateForm("leverage", e.target.value)} placeholder="예: 5x" /></Field>
                        <Field label="진입 금액"><Input value={form.entryAmount} onChange={(e) => updateForm("entryAmount", e.target.value)} placeholder="예: 500" /></Field>
                        <Field label="실현 손익금"><Input value={form.realizedPnlAmount} onChange={(e) => updateForm("realizedPnlAmount", e.target.value)} placeholder="예: 84" /></Field>
                        <Field label="태그"><Input value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} placeholder="예: FVG, sweep" /></Field>
                      </div>
                      <div className="metrics-grid">
                        <MetricCard label="리스크" value={form.riskPct ? `${form.riskPct}%` : "-"} tone="rose" />
                        <MetricCard label="리워드" value={form.rewardPct ? `${form.rewardPct}%` : "-"} tone="cyan" />
                        <MetricCard label="RR" value={form.riskReward ? `1:${form.riskReward}` : "-"} tone="violet" />
                      </div>
                    </Section>
                  </div>

                  <div className="two-col">
                    <Section title="BTC 분석">
                      <div className="form-grid">
                        <Field label="스토캐스틱 상태"><Select value={form.stochasticState} onChange={(e) => updateForm("stochasticState", e.target.value)}><option value="과매도">과매도</option><option value="중립">중립</option><option value="과매수">과매수</option></Select></Field>
                        <Field label="RSI 상태"><Select value={form.rsiState} onChange={(e) => updateForm("rsiState", e.target.value)}><option value="없음">없음</option><option value="상승 다이버전스">상승 다이버전스</option><option value="하락 다이버전스">하락 다이버전스</option><option value="히든 상승 다이버전스">히든 상승 다이버전스</option><option value="히든 하락 다이버전스">히든 하락 다이버전스</option><option value="과매도">과매도</option><option value="과매수">과매수</option></Select></Field>
                        <Field label="이평선 상태"><Select value={form.maState} onChange={(e) => updateForm("maState", e.target.value)}><option value="상승 정배열">상승 정배열</option><option value="하락 역배열">하락 역배열</option><option value="혼조">혼조</option><option value="지지 받는 중">지지 받는 중</option><option value="저항 받는 중">저항 받는 중</option><option value="돌파 직전">돌파 직전</option></Select></Field>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <Field label="분석 메모"><Textarea rows={8} value={form.analysisMemo} onChange={(e) => updateForm("analysisMemo", e.target.value)} placeholder="지지/저항, 구조, 다이버전스 해석 등을 기록" /></Field>
                      </div>
                    </Section>

                    <Section title="기록">
                      <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                        <Field label="진입 근거"><Textarea rows={5} value={form.thesis} onChange={(e) => updateForm("thesis", e.target.value)} placeholder="왜 들어갔는지, 어떤 근거였는지 기록" /></Field>
                        <Field label="복기 메모"><Textarea rows={9} value={form.review} onChange={(e) => updateForm("review", e.target.value)} placeholder="결과, 실수, 배운 점" /></Field>
                      </div>
                    </Section>
                  </div>
                </div>

                <div className="right-stack">
                  <Section title="월별 대시보드">
                    <div className="calendar-head">
                      <div className="calendar-title-wrap">
                        <div className="calendar-month">{`${calendarYear}.${String(calendarMonth + 1).padStart(2, "0")}`}</div>
                        <div className="calendar-sub">날짜별 종료 매매 손익</div>
                        <div className="toggle-group">
                          <button type="button" className={`toggle-chip ${calendarViewMode === "amount" ? "toggle-chip-active" : ""}`} onClick={() => setCalendarViewMode("amount")}>금액</button>
                          <button type="button" className={`toggle-chip ${calendarViewMode === "percent" ? "toggle-chip-active" : ""}`} onClick={() => setCalendarViewMode("percent")}>퍼센트</button>
                        </div>
                      </div>
                      <div className="calendar-nav">
                        <button type="button" className="icon-btn" onClick={goPrevMonth}>‹</button>
                        <button type="button" className="icon-btn" onClick={goNextMonth}>›</button>
                      </div>
                    </div>

                    <div className="month-summary">
                      <div className="month-box">
                        <div className="month-box-label">시작 자산</div>
                        <div className="month-box-value">{monthlySummary.startingCapital ? formatMoney(monthlySummary.startingCapital) : "0"}</div>
                      </div>
                      <div className="month-box">
                        <div className="month-box-label">종료 자산</div>
                        <div className={`month-box-value ${monthlySummary.endingCapital >= monthlySummary.startingCapital ? "positive" : "negative"}`}>{monthlySummary.endingCapital ? formatMoney(monthlySummary.endingCapital) : "0"}</div>
                      </div>
                      <div className="month-box">
                        <div className="month-box-label">월 손익금</div>
                        <div className={`month-box-value ${monthlySummary.totalAmount >= 0 ? "positive" : "negative"}`}>{monthlySummary.totalAmount ? formatMoney(monthlySummary.totalAmount) : "0"}</div>
                      </div>
                      <div className="month-box">
                        <div className="month-box-label">월 자산 수익률</div>
                        <div className={`month-box-value ${monthlySummary.equityRate >= 0 ? "positive" : "negative"}`}>{monthlySummary.equityRate ? formatCalendarPercent(monthlySummary.equityRate) : "0%"}</div>
                      </div>
                    </div>

                    <CalendarGrid cells={calendarCells} selectedDate={selectedDate} onSelectDate={setSelectedDate} viewMode={calendarViewMode} />

                    <div className="daily-list">
                      {selectedDateEntries.length === 0 ? (
                        <div className="empty-box">선택한 날짜의 기록이 없습니다.</div>
                      ) : (
                        selectedDateEntries.map((entry) => (
                          <div key={entry.id} className="daily-row">
                            <div className="daily-left">
                              <div className="daily-market">{entry.market}</div>
                              <div className="daily-meta">{entry.side} · {entry.status}</div>
                            </div>
                            <div className={`daily-pnl ${Number(entry.realizedPnlAmount || entry.pnl) >= 0 ? "positive" : "negative"}`}>
                              <div>{entry.realizedPnlAmount ? formatMoney(entry.realizedPnlAmount) : "-"}</div>
                              <div style={{ fontSize: 11, opacity: 0.9 }}>{entry.pnl ? `${Number(entry.pnl) > 0 ? "+" : ""}${entry.pnl}%` : "미청산"}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Section>

                  <Section title="스크린샷">
                    <label className="upload-box">
                      <div className="upload-emoji">📷</div>
                      <div>차트 스크린샷 업로드</div>
                      <div className="upload-sub">로그인 상태면 클라우드 저장</div>
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleScreenshotChange} />
                    </label>
                    {form.screenshot ? <img src={form.screenshot} alt="trade screenshot" className="screenshot" /> : <div className="empty-box" style={{ marginTop: 12 }}>스크린샷 없음</div>}
                    {fileError ? <div className="file-error">{fileError}</div> : null}
                  </Section>
                </div>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </>
  );
}
