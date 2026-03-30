import React, { useState, useMemo } from "react";

export default function App() {
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(2);
  const [settings, setSettings] = useState({ startingCapital: 10000 });

  // 날짜별 선택
  const selectedDateEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === selectedDate)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [entries, selectedDate]
  );

  // 월 요약
  const monthlySummary = useMemo(() => {
    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-`;

    const monthEntries = entries.filter(
      (entry) =>
        entry.status === "종료" &&
        String(entry.date || "").startsWith(monthPrefix)
    );

    const totalAmount = monthEntries.reduce((sum, entry) => {
      const num = Number(entry.realizedPnlAmount);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);

    const totalPercent = monthEntries.reduce((sum, entry) => {
      const num = Number(entry.pnl);
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);

    const startingCapital = Number(settings.startingCapital);
    const safeStartingCapital = Number.isFinite(startingCapital)
      ? startingCapital
      : 0;

    const endingCapital = safeStartingCapital + totalAmount;

    const equityRate =
      safeStartingCapital > 0
        ? (totalAmount / safeStartingCapital) * 100
        : 0;

    return {
      count: monthEntries.length,
      totalAmount,
      totalPercent,
      startingCapital: safeStartingCapital,
      endingCapital,
      equityRate,
    };
  }, [entries, calendarYear, calendarMonth, settings.startingCapital]);

  // 필터
  const filteredEntries = useMemo(() => {
    return entries;
  }, [entries]);

  return (
    <div style={{ padding: 20, color: "white", background: "#0b1220", minHeight: "100vh" }}>
      <h1>Trading Journal</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="number"
          placeholder="시작 자산"
          value={settings.startingCapital}
          onChange={(e) =>
            setSettings({ ...settings, startingCapital: e.target.value })
          }
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2>월 요약</h2>
        <p>총 거래: {monthlySummary.count}</p>
        <p>총 수익금: {monthlySummary.totalAmount}</p>
        <p>총 수익률: {monthlySummary.totalPercent}%</p>
        <p>시작 자산: {monthlySummary.startingCapital}</p>
        <p>종료 자산: {monthlySummary.endingCapital}</p>
        <p>자산 변화율: {monthlySummary.equityRate.toFixed(2)}%</p>
      </div>

      <div>
        <h2>선택 날짜 기록</h2>
        {selectedDateEntries.map((e, i) => (
          <div key={i}>
            {e.symbol} / {e.pnl}% / {e.realizedPnlAmount}
          </div>
        ))}
      </div>
    </div>
  );
}
