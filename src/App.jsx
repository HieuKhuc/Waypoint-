import { useState, useEffect, useCallback } from "react";
import { Plus, X, MapPin, Navigation2, Check, Trash2, Loader2, AlertTriangle, Clock, Mail, Copy } from "lucide-react";

const INK = "#22283B";
const PAPER = "#F2EDE1";
const RULE = "#CBBFA0";
const VERIFIED = "#2F6D4F";
const MISS = "#A83232";
const GOLD = "#8A6423";
const UPCOMING_Y = "#E8590C";

function toRad(d) { return (d * Math.PI) / 180; }
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getCurrentCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Your browser can't share location."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

function todayStr() {
  return toDateStr(new Date());
}
function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function monthGrid(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const start = new Date(year, month, 1 - startWeekday);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ dateStr: toDateStr(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}
function weekGrid(anchorDateStr) {
  const anchor = new Date(anchorDateStr + "T00:00:00");
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ dateStr: toDateStr(d), day: d.getDate(), inMonth: true });
  }
  return cells;
}
function monthOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function shiftDateStr(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}
function rangeFor(option, todayStrVal) {
  if (option === "thisWeek") {
    const cells = weekGrid(todayStrVal);
    return { start: cells[0].dateStr, end: cells[6].dateStr, label: "This week" };
  }
  if (option === "lastWeek") {
    const cells = weekGrid(shiftDateStr(todayStrVal, -7));
    return { start: cells[0].dateStr, end: cells[6].dateStr, label: "Last week" };
  }
  if (option === "thisMonth") {
    const m = monthOf(todayStrVal);
    return {
      start: toDateStr(m),
      end: toDateStr(new Date(m.getFullYear(), m.getMonth() + 1, 0)),
      label: m.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  }
  const m = monthOf(todayStrVal);
  const prevM = new Date(m.getFullYear(), m.getMonth() - 1, 1);
  return {
    start: toDateStr(prevM),
    end: toDateStr(new Date(prevM.getFullYear(), prevM.getMonth() + 1, 0)),
    label: prevM.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}
function buildSummaryText(entries, range, categoryFilter) {
  const items = entries
    .filter((e) => e.date >= range.start && e.date <= range.end)
    .filter((e) => categoryFilter === "all" || e.category === categoryFilter)
    .sort((a, b) => (a.date === b.date ? (a.time || "").localeCompare(b.time || "") : a.date.localeCompare(b.date)));
  const scopeLabel = categoryFilter === "all" ? "" : ` \u2014 ${categoryFilter}`;
  if (items.length === 0) return `No appointments or tasks logged for ${range.label}${scopeLabel}.`;
  let text = `${range.label}${scopeLabel} (${fmtDate(range.start)} \u2013 ${fmtDate(range.end)})\n`;
  let lastDate = null;
  items.forEach((e) => {
    if (e.date !== lastDate) {
      text += `\n${fmtDate(e.date)}\n`;
      lastDate = e.date;
    }
    const kindLabel = e.kind === "appointment" ? "Appointment" : "Task";
    const timeLabel = e.time ? fmtTime(e.time) : "";
    text += `- [${kindLabel}] ${e.title}${timeLabel ? " at " + timeLabel : ""}\n`;
    if (e.address) text += `  Location: ${e.address}\n`;
  });
  return text.trim();
}
const MILES_TO_METERS = 1609.34;
function milesToMeters(mi) { return Math.round(Number(mi) * MILES_TO_METERS); }
function metersToMiles(m) { return (m / MILES_TO_METERS).toFixed(2); }

const PERIOD_C = "#8B3A55";
const FERTILE_C = "#3A6B7A";
const PMS_C = "#B8863B";

function daysBetween(aStr, bStr) {
  const a = new Date(aStr + "T00:00:00");
  const b = new Date(bStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function predictedCycleLength(settings) {
  const hist = settings.history || [];
  if (hist.length >= 2) {
    const gaps = [];
    for (let i = 1; i < hist.length; i++) gaps.push(daysBetween(hist[i - 1], hist[i]));
    return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }
  return Number(settings.cycleLengthEstimate) || 28;
}

function segmentFor(dateStr, settings) {
  const hist = (settings.history || []).slice().sort();
  const avgLen = predictedCycleLength(settings);
  if (hist.length === 0) return null;

  if (dateStr < hist[0]) {
    let anchor = hist[0];
    while (dateStr < anchor) {
      const d = new Date(anchor + "T00:00:00");
      d.setDate(d.getDate() - avgLen);
      anchor = toDateStr(d);
    }
    return { segStart: anchor, segLen: avgLen, isPredicted: true };
  }

  for (let i = hist.length - 1; i >= 0; i--) {
    if (dateStr >= hist[i]) {
      if (i < hist.length - 1) {
        return { segStart: hist[i], segLen: daysBetween(hist[i], hist[i + 1]), isPredicted: false };
      }
      let anchor = hist[i];
      while (daysBetween(anchor, dateStr) >= avgLen) {
        const d = new Date(anchor + "T00:00:00");
        d.setDate(d.getDate() + avgLen);
        anchor = toDateStr(d);
      }
      return { segStart: anchor, segLen: avgLen, isPredicted: true };
    }
  }
  return null;
}

function cyclePhase(dateStr, settings) {
  if (!settings || settings.mode === "off" || !(settings.history && settings.history.length)) return null;
  const seg = segmentFor(dateStr, settings);
  if (!seg) return null;
  const periodLen = Number(settings.periodLength) || 5;
  const cycleDay = daysBetween(seg.segStart, dateStr);
  if (cycleDay < periodLen) return { type: "period", cycleDay, isPredicted: seg.isPredicted };
  const ovulationDay = seg.segLen - 14;
  if (ovulationDay >= 0 && Math.abs(cycleDay - ovulationDay) <= 2) return { type: "fertile", cycleDay, isPredicted: seg.isPredicted };
  if (cycleDay >= seg.segLen - 5) return { type: "pms", cycleDay, isPredicted: seg.isPredicted };
  return { type: null, cycleDay, isPredicted: seg.isPredicted };
}

function nextPeriodInfo(settings, today) {
  const hist = (settings.history || []).slice().sort();
  const avgLen = predictedCycleLength(settings);
  if (hist.length === 0) return { daysUntil: null, date: null };
  let anchor = hist[hist.length - 1];
  while (anchor <= today) {
    const d = new Date(anchor + "T00:00:00");
    d.setDate(d.getDate() + avgLen);
    anchor = toDateStr(d);
  }
  return { daysUntil: daysBetween(today, anchor), date: anchor };
}

const emptyCycle = { mode: "off", periodLength: 5, cycleLengthEstimate: 28, history: [] };

const QUIPS = {
  yes: [
    "Look at you, adulting champion! 🏆",
    "Nailed it. Gold star for you. ⭐",
    "Achievement unlocked: Being a Functional Human.",
    "Somewhere, your to-do list is smiling.",
    "10/10, no notes.",
    "Future you says thanks.",
    "Chef's kiss. 👨‍🍳💋",
    "You absolute legend.",
  ],
  no: [
    "It happens to the best of us. Onward!",
    "Tomorrow's problem now. Deal.",
    "No judgment here. Okay, maybe a little. 😏",
    "The task fairy will get to it eventually... right?",
    "Well, there's always next time.",
    "Adulting: 0, You: still trying.",
    "Bold strategy. Let's see how it plays out.",
    "It's not procrastination, it's strategic delay.",
  ],
  depYes: [
    "Vroom vroom, hero. 🚗",
    "Godspeed, traveler.",
    "On the road again!",
    "May all traffic lights be ever in your favor.",
    "You're basically an Olympic sprinter now.",
    "Look at you, being early-ish.",
    "Wheels up. Let's gooo.",
  ],
  depNo: [
    "Tick tock, better get a move on!",
    "The clock is judging you.",
    "Time waits for no one, but maybe wait for you?",
    "This is your sign to put on shoes.",
    "Fashionably late is still a strategy, right?",
    "Somewhere, your GPS is sighing.",
    "Still here? Bold choice.",
  ],
};
const quipCounters = { yes: 0, no: 0, depYes: 0, depNo: 0 };
function nextQuip(key) {
  const list = QUIPS[key];
  const text = list[quipCounters[key] % list.length];
  quipCounters[key]++;
  return text;
}

function addInterval(dateStr, repeat, i, interval) {
  if (i === 0 || repeat === "none") return dateStr;
  const step = (Number(interval) || 1) * i;
  const d = new Date(dateStr + "T00:00:00");
  if (repeat === "daily") d.setDate(d.getDate() + step);
  else if (repeat === "weekly") d.setDate(d.getDate() + step * 7);
  else if (repeat === "monthly") d.setMonth(d.getMonth() + step);
  return toDateStr(d);
}
const emptyForm = { title: "", kind: "appointment", category: "personal", date: todayStr(), time: "09:00", address: "", lat: null, lng: null, radius: 5, repeat: "none", repeatInterval: 1, repeatMode: "count", repeatCount: 4, travelMinutes: "" };

// localStorage shim mimicking the window.storage(key, shared) API used inside Claude.
// Swap this out for a real backend later if you want data to sync across devices.
const storage = {
  async get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v == null ? null : { key, value: v };
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (e) { return null; }
  },
};

export default function FieldLog() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoNote, setGeoNote] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayStr());
  const [viewMode, setViewMode] = useState("month");
  const [kindFilter, setKindFilter] = useState("all");
  const [cycle, setCycle] = useState(emptyCycle);
  const [cycleForm, setCycleForm] = useState(emptyCycle);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [seriesMeta, setSeriesMeta] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [summaryRange, setSummaryRange] = useState("thisWeek");
  const [summaryCategory, setSummaryCategory] = useState("all");
  const [summaryEmail, setSummaryEmail] = useState("");
  const [copyNote, setCopyNote] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("entries");
        if (r && r.value) setEntries(JSON.parse(r.value));
      } catch (e) { /* no saved entries yet */ }
      try {
        const rc = await storage.get("cycleSettings");
        if (rc && rc.value) {
          let parsed = JSON.parse(rc.value);
          if (!parsed.history) {
            parsed = {
              mode: parsed.mode || "off",
              periodLength: parsed.periodLength || 5,
              cycleLengthEstimate: parsed.cycleLength || 28,
              history: parsed.lastStart ? [parsed.lastStart] : [],
            };
          }
          setCycle(parsed);
          setCycleForm(parsed);
        }
      } catch (e) { /* no cycle settings yet */ }
      try {
        const rs = await storage.get("seriesMeta");
        if (rs && rs.value) setSeriesMeta(JSON.parse(rs.value));
      } catch (e) { /* no series metadata yet */ }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((next) => {
    setEntries(next);
    storage.set("entries", JSON.stringify(next)).catch(() => {});
  }, []);

  const saveSeriesMeta = useCallback((next) => {
    setSeriesMeta(next);
    storage.set("seriesMeta", JSON.stringify(next)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const ids = Object.keys(seriesMeta);
    if (ids.length === 0) return;
    const horizon = shiftDate(todayStr(), 180);
    let addedEntries = [];
    let metaChanged = false;
    const nextMeta = { ...seriesMeta };
    ids.forEach((sid) => {
      const meta = seriesMeta[sid];
      if (!meta) return;
      let through = meta.generatedThrough;
      let lastDate = addInterval(meta.anchorDate, meta.repeat, through, meta.interval);
      let guard = 0;
      while (lastDate < horizon && guard < 60) {
        through += 1;
        const d = addInterval(meta.anchorDate, meta.repeat, through, meta.interval);
        addedEntries.push({
          id: uid(), title: meta.title, kind: meta.kind, category: meta.category || "personal", date: d, time: meta.time,
          address: meta.address, lat: meta.lat, lng: meta.lng, radius: meta.radius,
          travelMinutes: meta.travelMinutes, completionAnswer: null, departureAnswer: null, checkin: null, seriesId: sid,
        });
        lastDate = d;
        guard++;
        metaChanged = true;
      }
      if (guard > 0) nextMeta[sid] = { ...meta, generatedThrough: through };
    });
    if (addedEntries.length > 0) persist([...entries, ...addedEntries]);
    if (metaChanged) saveSeriesMeta(nextMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function saveCycle() {
    const next = {
      ...cycleForm,
      cycleLengthEstimate: Number(cycleForm.cycleLengthEstimate) || 28,
      periodLength: Number(cycleForm.periodLength) || 5,
      history: (cycleForm.history || []).slice().sort(),
    };
    setCycle(next);
    storage.set("cycleSettings", JSON.stringify(next)).catch(() => {});
    setShowCycleForm(false);
  }

  function turnOffCycle() {
    const next = { ...cycle, mode: "off" };
    setCycle(next);
    setCycleForm(next);
    storage.set("cycleSettings", JSON.stringify(next)).catch(() => {});
    setShowCycleForm(false);
  }

  function resetForm() { setForm(emptyForm); setGeoNote(null); setShowForm(false); }

  function addEntry() {
    if (!form.title.trim() || !form.date) return;
    if (form.kind === "appointment" && form.travelMinutes === "") return;
    const seriesId = form.repeat !== "none" ? uid() : null;
    const indefinite = form.repeat !== "none" && form.repeatMode === "indefinite";
    const count = form.repeat === "none" ? 1 : indefinite ? 12 : Math.max(1, Math.min(52, Number(form.repeatCount) || 1));
    const newEntries = [];
    const travelMinutes = form.kind === "appointment" && form.travelMinutes !== "" ? Number(form.travelMinutes) : null;
    const radius = milesToMeters(form.radius) || milesToMeters(5);
    for (let i = 0; i < count; i++) {
      newEntries.push({
        id: uid(),
        title: form.title.trim(),
        kind: form.kind,
        category: form.category,
        date: addInterval(form.date, form.repeat, i, form.repeatInterval),
        time: form.time || "",
        address: form.address.trim(),
        lat: form.lat,
        lng: form.lng,
        radius,
        travelMinutes,
        completionAnswer: null,
        departureAnswer: null,
        checkin: null,
        seriesId,
      });
    }
    if (indefinite) {
      const meta = {
        anchorDate: form.date, repeat: form.repeat, interval: Number(form.repeatInterval) || 1,
        title: form.title.trim(), kind: form.kind, category: form.category, time: form.time || "", address: form.address.trim(),
        lat: form.lat, lng: form.lng, radius, travelMinutes, generatedThrough: count - 1,
      };
      saveSeriesMeta({ ...seriesMeta, [seriesId]: meta });
    }
    persist([...entries, ...newEntries]);
    resetForm();
  }

  function removeEntry(id) { persist(entries.filter((e) => e.id !== id)); }

  function removeFutureSeries(seriesId, fromDate) {
    persist(entries.filter((e) => !(e.seriesId === seriesId && e.date >= fromDate)));
    if (seriesMeta[seriesId]) {
      const next = { ...seriesMeta };
      delete next[seriesId];
      saveSeriesMeta(next);
    }
  }

  function setCompletion(id, answer) {
    const quip = answer === "yes" ? nextQuip("yes") : answer === "no" ? nextQuip("no") : null;
    persist(entries.map((e) => (e.id === id ? { ...e, completionAnswer: answer, completionQuip: quip } : e)));
  }

  function setDeparture(id, answer) {
    const quip = answer === "yes" ? nextQuip("depYes") : answer === "no" ? nextQuip("depNo") : null;
    persist(entries.map((e) => (e.id === id ? { ...e, departureAnswer: answer, departureQuip: quip } : e)));
  }

  function rescheduleEntry(id, newDate, newTime) {
    persist(entries.map((e) => (e.id === id
      ? { ...e, date: newDate, time: newTime ?? e.time, completionAnswer: null, checkin: null, departureAnswer: null }
      : e)));
  }

  async function pinCurrentLocation() {
    setGeoBusy(true); setGeoNote(null);
    try {
      const { lat, lng } = await getCurrentCoords();
      setForm((f) => ({ ...f, lat, lng }));
      setGeoNote({ ok: true, text: "Pinned to where you're standing now." });
    } catch (e) {
      setGeoNote({ ok: false, text: e.message });
    }
    setGeoBusy(false);
  }

  function shiftDate(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return toDateStr(d);
  }
  function goPrev() {
    if (viewMode === "month") {
      const d = new Date(selectedDay + "T00:00:00");
      setSelectedDay(toDateStr(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
    } else if (viewMode === "week") setSelectedDay((d) => shiftDate(d, -7));
    else setSelectedDay((d) => shiftDate(d, -1));
  }
  function goNext() {
    if (viewMode === "month") {
      const d = new Date(selectedDay + "T00:00:00");
      setSelectedDay(toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 1)));
    } else if (viewMode === "week") setSelectedDay((d) => shiftDate(d, 7));
    else setSelectedDay((d) => shiftDate(d, 1));
  }
  function jumpToToday() { setSelectedDay(todayStr()); }

  async function checkIn(entry) {
    setCheckingId(entry.id);
    try {
      const { lat, lng } = await getCurrentCoords();
      if (entry.lat == null) {
        const updated = { ...entry, lat, lng, checkin: { status: "logged", distance: 0, at: new Date().toISOString() } };
        persist(entries.map((e) => (e.id === entry.id ? updated : e)));
      } else {
        const dist = Math.round(distanceMeters(lat, lng, entry.lat, entry.lng));
        const status = dist <= entry.radius ? "verified" : "away";
        const updated = { ...entry, checkin: { status, distance: dist, at: new Date().toISOString() } };
        persist(entries.map((e) => (e.id === entry.id ? updated : e)));
      }
    } catch (e) {
      persist(entries.map((e) => (e.id === entry.id ? { ...e, checkin: { status: "error", message: e.message, at: new Date().toISOString() } } : e)));
    }
    setCheckingId(null);
  }

  const now = new Date();
  const today = todayStr();
  const filteredEntries = kindFilter === "all" ? entries : entries.filter((e) => e.kind === kindFilter);
  const withDue = filteredEntries.map((e) => ({ ...e, dueAt: new Date(`${e.date}T${e.time || "00:00"}`) }));

  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: INK, fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif", overscrollBehaviorY: "contain" }}>
      <style>{`
        @keyframes stampIn { 0% { opacity:0; transform: scale(2.2) rotate(-8deg); } 60% { opacity:1; transform: scale(0.92) rotate(-8deg); } 100% { opacity:1; transform: scale(1) rotate(-8deg); } }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        .stamp { animation: stampIn 380ms ease-out; }
        .ui { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        input, select, textarea { font-family: inherit; font-size: 16px; }
        ::placeholder { color: #9A8F73; }
        * { -webkit-tap-highlight-color: transparent; }
        button, a { -webkit-touch-callout: none; touch-action: manipulation; user-select: none; }
        button:active { transform: scale(0.96); }
        button:disabled:active { transform: none; }
        html { overscroll-behavior-y: contain; }
        body { overscroll-behavior-y: contain; -webkit-font-smoothing: antialiased; }
        input, textarea { user-select: text; -webkit-user-select: text; }
        .fab:active { transform: scale(0.92); }
        .sheet-backdrop { animation: backdropIn 180ms ease-out; }
        .sheet { animation: sheetUp 260ms cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 18px calc(100px + env(safe-area-inset-bottom))" }}>
        <header style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h1 style={{ fontSize: 26, letterSpacing: 0.5, margin: 0 }}>Waypoint</h1>
            <span className="mono ui" style={{ fontSize: 12, color: GOLD }}>{fmtDate(today)}</span>
          </div>
        </header>

        <CyclePanel
          cycle={cycle}
          cycleForm={cycleForm}
          setCycleForm={setCycleForm}
          showForm={showCycleForm}
          setShowForm={setShowCycleForm}
          onSave={saveCycle}
          onTurnOff={turnOffCycle}
          today={today}
        />

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {[{ k: "day", label: "Day" }, { k: "week", label: "Week" }, { k: "month", label: "Month" }].map((o) => (
            <button key={o.k} className="ui" onClick={() => setViewMode(o.k)}
              style={{ flex: 1, padding: "7px 0", borderRadius: 5, fontSize: 12.5, border: `1px solid ${INK}`, cursor: "pointer", background: viewMode === o.k ? INK : "white", color: viewMode === o.k ? PAPER : INK }}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[{ k: "all", label: "All" }, { k: "appointment", label: "Appointments" }, { k: "task", label: "Tasks" }].map((o) => (
            <button key={o.k} className="ui" onClick={() => setKindFilter(o.k)}
              style={{ flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 11.5, border: `1px solid ${RULE}`, cursor: "pointer", background: kindFilter === o.k ? GOLD : "white", color: kindFilter === o.k ? PAPER : "#5C5442" }}>
              {o.label}
            </button>
          ))}
        </div>

        <CalendarGrid
          viewMode={viewMode}
          anchorDate={selectedDay}
          entries={filteredEntries}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onPrev={goPrev}
          onNext={goNext}
          onToday={jumpToToday}
          cycle={cycle}
        />

        {(() => {
          const dayItems = withDue.filter((e) => e.date === selectedDay).sort((a, b) => a.dueAt - b.dueAt);
          const label = selectedDay === today ? "Today" : fmtDate(selectedDay);
          return dayItems.length > 0 ? (
            <Section title={label} items={dayItems} now={now} checkingId={checkingId} onCheckIn={checkIn} onSetCompletion={setCompletion} onSetDeparture={setDeparture} onReschedule={rescheduleEntry} onRemove={removeEntry} onRemoveSeries={removeFutureSeries} />
          ) : (
            <p className="ui" style={{ fontSize: 12.5, color: "#8A8168", margin: "0 0 20px" }}>
              Nothing logged for {label.toLowerCase() === "today" ? "today" : label}.
            </p>
          );
        })()}

        {selectedDay === today && (() => {
          const upcomingItems = withDue.filter((e) => e.date > today && !e.seriesId).sort((a, b) => a.dueAt - b.dueAt).slice(0, 10);
          return upcomingItems.length > 0 ? (
            <div style={{ background: `${UPCOMING_Y}1A`, border: `1px solid ${UPCOMING_Y}`, borderRadius: 8, padding: "12px 14px 4px" }}>
              <Section title="Upcoming" items={upcomingItems} now={now} checkingId={checkingId} onCheckIn={checkIn} onSetCompletion={setCompletion} onSetDeparture={setDeparture} onReschedule={rescheduleEntry} onRemove={removeEntry} onRemoveSeries={removeFutureSeries} showDate />
            </div>
          ) : null;
        })()}

        <SummaryPanel
          show={showSummary}
          setShow={setShowSummary}
          range={summaryRange}
          setRange={setSummaryRange}
          category={summaryCategory}
          setCategory={setSummaryCategory}
          email={summaryEmail}
          setEmail={setSummaryEmail}
          entries={entries}
          today={today}
          copyNote={copyNote}
          setCopyNote={setCopyNote}
        />

        {showForm && (
          <div className="sheet-backdrop" onClick={() => setShowForm(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(34,40,59,0.45)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div className="sheet ui" onClick={(e) => e.stopPropagation()}
              style={{
                background: PAPER, width: "100%", maxWidth: 560, borderTopLeftRadius: 18, borderTopRightRadius: 18,
                maxHeight: "88vh", overflowY: "auto", boxShadow: "0 -10px 34px rgba(0,0,0,0.28)",
                padding: "10px 18px calc(28px + env(safe-area-inset-bottom))", boxSizing: "border-box",
              }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: RULE, margin: "6px auto 14px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>New entry</span>
                <button onClick={() => setShowForm(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#8A8168" }}>
                  <X size={18} />
                </button>
              </div>
            <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>What is it</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder=""
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, marginBottom: 12, fontSize: 14, background: "white" }}
            />

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["appointment", "task"].map((k) => (
                <button
                  key={k}
                  onClick={() => setForm((f) => ({ ...f, kind: k }))}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 5, fontSize: 13, textTransform: "capitalize",
                    border: `1px solid ${INK}`, cursor: "pointer",
                    background: form.kind === k ? INK : "white", color: form.kind === k ? PAPER : INK,
                  }}
                >{k}</button>
              ))}
            </div>

            <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Personal or business?</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["personal", "business"].map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 5, fontSize: 13, textTransform: "capitalize",
                    border: `1px solid ${GOLD}`, cursor: "pointer",
                    background: form.category === c ? GOLD : "white", color: form.category === c ? PAPER : GOLD,
                  }}
                >{c}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 13, background: "white" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Time</label>
                <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 13, background: "white" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Repeat</label>
            <div style={{ display: "flex", gap: 6, marginBottom: form.repeat !== "none" ? 8 : 12 }}>
              {[{ k: "none", label: "Never" }, { k: "daily", label: "Daily" }, { k: "weekly", label: "Weekly" }, { k: "monthly", label: "Monthly" }].map((o) => (
                <button key={o.k} onClick={() => setForm((f) => ({ ...f, repeat: o.k }))}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 12, border: `1px solid ${INK}`, cursor: "pointer", background: form.repeat === o.k ? INK : "white", color: form.repeat === o.k ? PAPER : INK }}>
                  {o.label}
                </button>
              ))}
            </div>
            {form.repeat !== "none" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>
                  Every how many {form.repeat === "daily" ? "days" : form.repeat === "weekly" ? "weeks" : "months"}
                </label>
                <input type="number" min="1" max="12" value={form.repeatInterval}
                  onChange={(e) => setForm((f) => ({ ...f, repeatInterval: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, marginBottom: 10, fontSize: 13, background: "white" }} />

                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Ends</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[{ k: "count", label: "After a number of times" }, { k: "indefinite", label: "Indefinitely" }].map((o) => (
                    <button key={o.k} onClick={() => setForm((f) => ({ ...f, repeatMode: o.k }))}
                      style={{ flex: 1, padding: "6px 4px", borderRadius: 5, fontSize: 11.5, border: `1px solid ${INK}`, cursor: "pointer", background: form.repeatMode === o.k ? INK : "white", color: form.repeatMode === o.k ? PAPER : INK }}>
                      {o.label}
                    </button>
                  ))}
                </div>

                {form.repeatMode === "count" ? (
                  <>
                    <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Number of occurrences (including this one)</label>
                    <input type="number" min="2" max="52" value={form.repeatCount}
                      onChange={(e) => setForm((f) => ({ ...f, repeatCount: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 13, background: "white" }} />
                  </>
                ) : (
                  <p className="ui" style={{ fontSize: 11.5, color: "#8A8168" }}>
                    It'll keep generating new occurrences automatically each time you open the app, so it never runs out. Use "Remove this and future repeats" on any entry to stop it.
                  </p>
                )}
              </div>
            )}

            {form.kind === "appointment" && (
              <>
                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Address or business (a note for you — not looked up)</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="123 Main St, Springfield"
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, marginBottom: 10, fontSize: 14, background: "white" }}
                />

                <button onClick={pinCurrentLocation} disabled={geoBusy}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px 0", borderRadius: 5, border: `1px solid ${INK}`, background: "white", fontSize: 13, cursor: "pointer", opacity: geoBusy ? 0.6 : 1, marginBottom: 8 }}>
                  <Navigation2 size={14} /> I'm there now — pin my location
                </button>
                <p className="ui" style={{ fontSize: 11.5, color: "#8A8168", marginBottom: 10 }}>
                  Not there yet? Skip this — when it's time, tap "Check in" on the entry and it'll record your location then.
                </p>

                {geoNote && (
                  <p className="mono" style={{ fontSize: 11.5, color: geoNote.ok ? VERIFIED : MISS, marginBottom: 8 }}>{geoNote.text}</p>
                )}
                {form.lat != null && (
                  <p className="mono" style={{ fontSize: 11.5, color: "#5C5442", marginBottom: 8 }}>
                    Pinned {form.lat.toFixed(5)}, {form.lng.toFixed(5)} — verifying within {form.radius} mi
                  </p>
                )}

                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Check-in radius (miles)</label>
                <input type="number" min="0.05" max="50" step="0.1" value={form.radius}
                  onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, marginBottom: 12, fontSize: 13, background: "white" }} />

                <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Travel time to get there (minutes) *</label>
                <input type="number" min="0" max="600" required placeholder="e.g. 45" value={form.travelMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, travelMinutes: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: `1px solid ${form.travelMinutes === "" ? MISS : RULE}`, borderRadius: 5, marginBottom: 6, fontSize: 13, background: "white" }} />
                <p className="ui" style={{ fontSize: 11, color: form.travelMinutes === "" ? MISS : "#8A8168", marginBottom: 12 }}>
                  Required — we'll ask whether you've left once it's that many minutes before the appointment.
                </p>
              </>
            )}

            <button onClick={addEntry} disabled={!form.title.trim() || (form.kind === "appointment" && form.travelMinutes === "")}
              style={{ width: "100%", padding: "10px 0", borderRadius: 5, border: "none", background: form.title.trim() ? INK : "#B9B09A", color: PAPER, fontSize: 14, fontWeight: 600, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>
              Save entry
            </button>
            </div>
          </div>
        )}

        {loaded && entries.length === 0 && (
          <p className="ui" style={{ fontSize: 14, color: "#5C5442", textAlign: "center", padding: "30px 10px", border: `1px dashed ${RULE}`, borderRadius: 8 }}>
            No entries yet. Log where you need to be, and confirm you got there.
          </p>
        )}
      </div>

      {!showForm && (
        <button
          className="fab"
          onClick={() => setShowForm(true)}
          aria-label="Log a new entry"
          style={{
            position: "fixed", right: 20, bottom: "calc(20px + env(safe-area-inset-bottom))",
            width: 58, height: 58, borderRadius: "50%", background: INK, color: PAPER,
            border: "none", boxShadow: "0 6px 18px rgba(34,40,59,0.35)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30,
            transition: "transform 120ms ease",
          }}
        >
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}

function CalendarGrid({ viewMode, anchorDate, entries, today, selectedDay, onSelectDay, onPrev, onNext, onToday, cycle }) {
  const byDate = {};
  entries.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
  const cycleOn = cycle && cycle.mode !== "off";

  function dotColor(dateStr) {
    const items = byDate[dateStr];
    if (!items || items.length === 0) return null;
    const isPastDay = dateStr < today;
    const unanswered = items.some((e) => e.completionAnswer !== "yes" && e.completionAnswer !== "no");
    if (isPastDay && unanswered) return MISS;
    if (items.every((e) => e.completionAnswer === "yes")) return VERIFIED;
    return GOLD;
  }
  function phaseColor(dateStr) {
    if (!cycleOn) return null;
    const p = cyclePhase(dateStr, cycle);
    if (!p || !p.type) return null;
    if (p.type === "period") return PERIOD_C;
    if (p.type === "fertile") return FERTILE_C;
    if (p.type === "pms") return PMS_C;
    return null;
  }

  let headerLabel;
  if (viewMode === "month") {
    headerLabel = monthOf(anchorDate).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } else if (viewMode === "week") {
    const wk = weekGrid(anchorDate);
    const startD = new Date(wk[0].dateStr + "T00:00:00");
    const endD = new Date(wk[6].dateStr + "T00:00:00");
    const sameMonth = startD.getMonth() === endD.getMonth();
    headerLabel = sameMonth
      ? `${startD.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${endD.toLocaleDateString(undefined, { day: "numeric", year: "numeric" })}`
      : `${startD.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${endD.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  } else {
    headerLabel = new Date(anchorDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  const cells = viewMode === "month" ? monthGrid(monthOf(anchorDate)) : viewMode === "week" ? weekGrid(anchorDate) : null;

  return (
    <div className="ui" style={{ border: `1px solid ${RULE}`, borderRadius: 8, padding: "12px 10px", marginBottom: 18, background: "#FBF8F0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: cells ? 10 : 4 }}>
        <button onClick={onPrev} aria-label="Previous" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: INK, padding: "0 8px" }}>‹</button>
        <button onClick={onToday} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: INK, textAlign: "center" }}>
          {headerLabel}
        </button>
        <button onClick={onNext} aria-label="Next" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: INK, padding: "0 8px" }}>›</button>
      </div>

      {cells && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {weekdays.map((w, i) => (
              <div key={i} className="mono" style={{ textAlign: "center", fontSize: 10.5, color: "#8A8168", padding: "2px 0" }}>{w}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((c) => {
              const isSelected = c.dateStr === selectedDay;
              const isToday = c.dateStr === today;
              const dot = dotColor(c.dateStr);
              const band = phaseColor(c.dateStr);
              return (
                <button
                  key={c.dateStr}
                  onClick={() => onSelectDay(c.dateStr)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    aspectRatio: "1", borderRadius: 6, cursor: "pointer", border: isToday && !isSelected ? `1px solid ${GOLD}` : "1px solid transparent",
                    background: isSelected ? INK : band ? `${band}22` : "transparent",
                    color: isSelected ? PAPER : c.inMonth ? INK : "#C9BFA8",
                    fontSize: 12.5, padding: 2, position: "relative",
                  }}
                >
                  <span>{c.day}</span>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot || "transparent", marginTop: 2 }} />
                  {band && (
                    <span style={{ position: "absolute", bottom: 2, left: "20%", right: "20%", height: 2, borderRadius: 2, background: band }} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {cycleOn && (
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <LegendDot color={PERIOD_C} label="Period" />
          <LegendDot color={FERTILE_C} label="Fertile" />
          <LegendDot color={PMS_C} label="PMS window" />
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#5C5442" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function SummaryPanel({ show, setShow, range, setRange, category, setCategory, email, setEmail, entries, today, copyNote, setCopyNote }) {
  if (!show) {
    return (
      <button className="ui" onClick={() => setShow(true)}
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: GOLD, background: "none", border: `1px dashed ${RULE}`, borderRadius: 999, padding: "8px 14px", cursor: "pointer", width: "100%", marginBottom: 16, textAlign: "left" }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: GOLD, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mail size={10} color={PAPER} />
        </span>
        Email a summary
      </button>
    );
  }

  const rangeInfo = rangeFor(range, today);
  const text = buildSummaryText(entries, rangeInfo, category);
  const subject = `${rangeInfo.label} \u2013 appointments & tasks`;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const mailtoUrl = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote("Copied!");
    } catch (e) {
      setCopyNote("Couldn't copy — select the text above manually.");
    }
    setTimeout(() => setCopyNote(null), 2500);
  }

  return (
    <div className="ui" style={{ border: `1px solid ${RULE}`, borderRadius: 8, padding: 16, marginBottom: 16, background: "#FBF8F0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Email a summary</span>
        <button onClick={() => setShow(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#8A8168" }}>
          <X size={15} />
        </button>
      </div>

      <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Range</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { k: "lastWeek", label: "Last week" },
          { k: "thisWeek", label: "This week" },
          { k: "thisMonth", label: "This month" },
          { k: "lastMonth", label: "Last month" },
        ].map((o) => (
          <button key={o.k} onClick={() => setRange(o.k)}
            style={{ flex: "1 1 45%", padding: "6px 4px", borderRadius: 5, fontSize: 12, border: `1px solid ${INK}`, cursor: "pointer", background: range === o.k ? INK : "white", color: range === o.k ? PAPER : INK }}>
            {o.label}
          </button>
        ))}
      </div>

      <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Include</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { k: "all", label: "All" },
          { k: "personal", label: "Personal" },
          { k: "business", label: "Business" },
        ].map((o) => (
          <button key={o.k} onClick={() => setCategory(o.k)}
            style={{ flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 12, border: `1px solid ${GOLD}`, cursor: "pointer", background: category === o.k ? GOLD : "white", color: category === o.k ? PAPER : GOLD }}>
            {o.label}
          </button>
        ))}
      </div>

      <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Send to *</label>
      <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", border: `1px solid ${email.trim() && !emailValid ? MISS : RULE}`, borderRadius: 5, marginBottom: 4, fontSize: 13, background: "white" }} />
      <p className="ui" style={{ fontSize: 11, color: !email.trim() ? MISS : !emailValid ? MISS : "#8A8168", marginBottom: 12 }}>
        {!email.trim() ? "Required — enter where this should be sent." : !emailValid ? "That doesn't look like a valid email yet." : "Looks good."}
      </p>

      <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Preview</label>
      <textarea readOnly value={text} rows={8}
        className="mono"
        style={{ width: "100%", padding: 8, border: `1px solid ${RULE}`, borderRadius: 5, marginBottom: 10, fontSize: 11.5, background: "white", resize: "vertical", boxSizing: "border-box" }} />

      <div style={{ display: "flex", gap: 8 }}>
        {emailValid ? (
          <a href={mailtoUrl}
            className="ui" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 5, border: "none", background: INK, color: PAPER, fontSize: 13, textDecoration: "none", cursor: "pointer" }}>
            <Mail size={14} /> Open in Mail
          </a>
        ) : (
          <span className="ui" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 5, border: "none", background: "#C9BFA8", color: PAPER, fontSize: 13, cursor: "not-allowed" }}>
            <Mail size={14} /> Open in Mail
          </span>
        )}
        <button onClick={copyText} disabled={!emailValid}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 5, border: `1px solid ${emailValid ? INK : RULE}`, background: "white", color: emailValid ? INK : "#B9B09A", fontSize: 13, cursor: emailValid ? "pointer" : "not-allowed" }}>
          <Copy size={14} /> Copy
        </button>
      </div>
      {copyNote && <p className="ui" style={{ fontSize: 11.5, color: VERIFIED, marginTop: 6 }}>{copyNote}</p>}
      <p className="ui" style={{ fontSize: 11, color: "#8A8168", marginTop: 8 }}>
        "Open in Mail" launches your device's email app with this filled in — nothing is sent from here directly. If your list is long, some mail apps truncate long links, so Copy is the safer bet.
      </p>
    </div>
  );
}

function CyclePanel({ cycle, cycleForm, setCycleForm, showForm, setShowForm, onSave, onTurnOff, today }) {
  const on = cycle && cycle.mode !== "off";
  const [newLogDate, setNewLogDate] = useState(today);

  if (!on && !showForm) {
    return (
      <button className="ui" onClick={() => { setCycleForm(cycle.mode === "off" ? emptyCycle : cycle); setShowForm(true); }}
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: GOLD, background: "none", border: `1px dashed ${RULE}`, borderRadius: 999, padding: "8px 14px", cursor: "pointer", width: "100%", marginBottom: 18, textAlign: "left" }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", background: PMS_C, flexShrink: 0 }} />
        Track a cycle (yours or a partner's)
      </button>
    );
  }

  function addLog() {
    if (!newLogDate) return;
    const hist = Array.from(new Set([...(cycleForm.history || []), newLogDate])).sort();
    setCycleForm((f) => ({ ...f, history: hist }));
  }
  function removeLog(dateStr) {
    setCycleForm((f) => ({ ...f, history: (f.history || []).filter((d) => d !== dateStr) }));
  }

  if (showForm) {
    const hist = (cycleForm.history || []).slice().sort().reverse();
    const avgPreview = predictedCycleLength(cycleForm);
    return (
      <div className="ui" style={{ border: `1px solid ${RULE}`, borderRadius: 8, padding: 16, marginBottom: 18, background: "#FBF8F0" }}>
        <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 6 }}>Whose cycle?</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[{ k: "self", label: "My own" }, { k: "partner", label: "A partner's" }].map((o) => (
            <button key={o.k} onClick={() => setCycleForm((f) => ({ ...f, mode: o.k }))}
              style={{ flex: 1, padding: "7px 0", borderRadius: 5, fontSize: 13, border: `1px solid ${INK}`, cursor: "pointer", background: cycleForm.mode === o.k ? INK : "white", color: cycleForm.mode === o.k ? PAPER : INK }}>
              {o.label}
            </button>
          ))}
        </div>

        <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>
          Log a period start ({cycleForm.mode === "partner" ? "their" : "your"} actual dates)
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input type="date" value={newLogDate} onChange={(e) => setNewLogDate(e.target.value)}
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 13, background: "white" }} />
          <button onClick={addLog} style={{ padding: "8px 14px", borderRadius: 5, border: `1px solid ${INK}`, background: "white", fontSize: 12.5, cursor: "pointer" }}>Add</button>
        </div>
        <p className="ui" style={{ fontSize: 11, color: "#8A8168", marginBottom: 10 }}>
          Add one entry per actual cycle. Each stays on record — logging a new one doesn't erase past months, it just sharpens future predictions.
        </p>

        {hist.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {hist.slice(0, 6).map((d) => (
              <div key={d} className="mono" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${RULE}` }}>
                <span>{fmtDate(d)}</span>
                <button onClick={() => removeLog(d)} aria-label="Remove this log" style={{ background: "none", border: "none", cursor: "pointer", color: MISS, fontSize: 11 }}>remove</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>
              {(cycleForm.history || []).length >= 2 ? "Predicted cycle length" : "Estimated cycle length"}
            </label>
            {(cycleForm.history || []).length >= 2 ? (
              <p className="mono" style={{ fontSize: 13, margin: "8px 0", color: "#5C5442" }}>{avgPreview} days (from your logs)</p>
            ) : (
              <input type="number" min="15" max="60" value={cycleForm.cycleLengthEstimate}
                onChange={(e) => setCycleForm((f) => ({ ...f, cycleLengthEstimate: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 13, background: "white" }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, color: GOLD, marginBottom: 4 }}>Period length (days)</label>
            <input type="number" min="1" max="14" value={cycleForm.periodLength}
              onChange={(e) => setCycleForm((f) => ({ ...f, periodLength: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 13, background: "white" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onSave} style={{ flex: 1, padding: "9px 0", borderRadius: 5, border: "none", background: INK, color: PAPER, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Save</button>
          {on && <button onClick={onTurnOff} style={{ padding: "9px 14px", borderRadius: 5, border: `1px solid ${MISS}`, color: MISS, background: "white", fontSize: 13, cursor: "pointer" }}>Turn off</button>}
          <button onClick={() => setShowForm(false)} style={{ padding: "9px 14px", borderRadius: 5, border: `1px solid ${RULE}`, color: "#5C5442", background: "white", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    );
  }

  const info = nextPeriodInfo(cycle, today);
  const phase = cyclePhase(today, cycle);
  const who = cycle.mode === "partner" ? "Partner" : "You";
  const phaseLabel = phase?.type === "period" ? "Period" : phase?.type === "fertile" ? "Fertile window" : phase?.type === "pms" ? "PMS window" : "Regular phase";
  const tip = phase?.type === "pms"
    ? (cycle.mode === "partner" ? "Hormonal shifts here can affect mood for some people — a good stretch to bring extra patience and support." : "You may feel more sensitive than usual around now — a good stretch for extra self-care.")
    : phase?.type === "period"
    ? (cycle.mode === "partner" ? "Cramps or fatigue are common now — small comforts go a long way." : "Take it easy if you need to.")
    : null;

  return (
    <div className="ui" style={{ border: `1px solid ${RULE}`, borderRadius: 8, padding: "12px 14px", marginBottom: 18, background: "#FBF8F0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{who} — {phaseLabel}</span>
        <button onClick={() => { setCycleForm(cycle); setShowForm(true); }} style={{ fontSize: 11.5, color: GOLD, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Edit</button>
      </div>
      {info.date ? (
        <p className="mono" style={{ fontSize: 11.5, color: "#5C5442", margin: "4px 0 0" }}>
          Next period in {info.daysUntil} day{info.daysUntil === 1 ? "" : "s"} (around {fmtDate(info.date)})
        </p>
      ) : (
        <p className="mono" style={{ fontSize: 11.5, color: "#8A8168", margin: "4px 0 0" }}>Log a period start date to begin predicting.</p>
      )}
      {tip && <p style={{ fontSize: 12, color: PMS_C, marginTop: 6 }}>{tip}</p>}
    </div>
  );
}

function Section({ title, items, now, checkingId, onCheckIn, onSetCompletion, onSetDeparture, onReschedule, onRemove, onRemoveSeries, showDate }) {
  if (items.length === 0) return null;
  const dramatic = title === "Upcoming";
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 className="ui" style={{
        fontSize: dramatic ? 16 : 12,
        fontWeight: dramatic ? 900 : 400,
        letterSpacing: dramatic ? 0.8 : 1.2,
        textTransform: "uppercase",
        color: dramatic ? UPCOMING_Y : GOLD,
        borderBottom: `${dramatic ? 2 : 1}px solid ${dramatic ? UPCOMING_Y : RULE}`,
        paddingBottom: 6, marginBottom: 4,
      }}>
        {title}
      </h2>
      {items.map((e) => <Row key={e.id} entry={e} now={now} checking={checkingId === e.id} onCheckIn={onCheckIn} onSetCompletion={onSetCompletion} onSetDeparture={onSetDeparture} onReschedule={onReschedule} onRemove={onRemove} onRemoveSeries={onRemoveSeries} showDate={showDate} />)}
    </div>
  );
}

function Row({ entry, now, checking, onCheckIn, onSetCompletion, onSetDeparture, onReschedule, onRemove, onRemoveSeries, showDate }) {
  const isPast = entry.dueAt < now;
  const answered = entry.completionAnswer === "yes" || entry.completionAnswer === "no";
  const isDone = entry.completionAnswer === "yes";
  const flaggedIncomplete = isPast && !answered;
  const missedOrIncomplete = flaggedIncomplete || entry.completionAnswer === "no";
  const isUpcoming = entry.dueAt > now;
  const statusColor = isUpcoming ? UPCOMING_Y : VERIFIED;
  const [showReschedule, setShowReschedule] = useState(false);
  const [rDate, setRDate] = useState(entry.date);
  const [rTime, setRTime] = useState(entry.time || "09:00");

  const travelMs = entry.kind === "appointment" && entry.travelMinutes ? Number(entry.travelMinutes) * 60000 : null;
  const departureWindowOpen = travelMs != null && now >= new Date(entry.dueAt.getTime() - travelMs) && now < entry.dueAt;
  const departureAnswered = entry.departureAnswer === "yes" || entry.departureAnswer === "no";
  const canAnswerCompletion = entry.kind === "task" ? true : !isUpcoming;

  function confirmReschedule() {
    onReschedule(entry.id, rDate, entry.kind === "appointment" ? rTime : entry.time);
    setShowReschedule(false);
  }

  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 10px", margin: "0 -10px", borderBottom: `1px solid ${RULE}`, borderLeft: `4px solid ${statusColor}`, background: `${statusColor}26`, alignItems: "flex-start" }}>
      <div style={{ paddingTop: 2 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          border: `1.5px solid ${entry.completionAnswer === "yes" ? VERIFIED : entry.completionAnswer === "no" ? MISS : INK}`,
          background: entry.completionAnswer === "yes" ? VERIFIED : entry.completionAnswer === "no" ? MISS : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {entry.completionAnswer === "yes" && <Check size={13} color={PAPER} />}
          {entry.completionAnswer === "no" && <X size={13} color={PAPER} />}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span className="ui" style={{ fontSize: 15, fontWeight: 600, textDecoration: isDone ? "line-through" : "none", color: isDone ? "#8A8168" : INK }}>
            {entry.title}
          </span>
          <button onClick={() => onRemove(entry.id)} aria-label="Remove entry" style={{ background: "none", border: "none", cursor: "pointer", color: "#B9B09A", flexShrink: 0 }}>
            <Trash2 size={14} />
          </button>
        </div>
        <div className="ui mono" style={{ fontSize: 12, color: "#5C5442", display: "flex", gap: 10, flexWrap: "wrap", marginTop: 2, alignItems: "center" }}>
          {showDate && <span style={{ fontWeight: 700 }}>{fmtDate(entry.date)}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} />{fmtTime(entry.time)}</span>
          {entry.address && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{entry.address}</span>}
          {entry.category && <span style={{ fontSize: 10.5, color: "#8A8168", border: `1px solid ${RULE}`, borderRadius: 3, padding: "1px 5px", textTransform: "capitalize" }}>{entry.category}</span>}
          {entry.seriesId && <span style={{ fontSize: 10.5, color: "#8A8168", border: `1px solid ${RULE}`, borderRadius: 3, padding: "1px 5px" }}>repeats</span>}
        </div>
        {entry.seriesId && (
          <button onClick={() => onRemoveSeries(entry.seriesId, entry.date)}
            className="ui" style={{ fontSize: 11, color: MISS, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4, textDecoration: "underline" }}>
            Remove this and future repeats
          </button>
        )}

        {flaggedIncomplete && (
          <span className="ui" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: MISS, marginTop: 6, fontWeight: 700 }}>
            <AlertTriangle size={11} /> OVERDUE — needs an answer below
          </span>
        )}

        {departureWindowOpen && !departureAnswered && (
          <div className="ui" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: PMS_C, fontWeight: 700 }}>Time to head out — have you left?</span>
            <button onClick={() => onSetDeparture(entry.id, "yes")}
              style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: `1.5px solid ${VERIFIED}`, color: VERIFIED, background: "white", cursor: "pointer" }}>
              Yes
            </button>
            <button onClick={() => onSetDeparture(entry.id, "no")}
              style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: `1.5px solid ${MISS}`, color: MISS, background: "white", cursor: "pointer" }}>
              Not yet
            </button>
          </div>
        )}
        {departureAnswered && !isPast && (
          <p className="ui" style={{ fontSize: 11.5, marginTop: 6, color: entry.departureAnswer === "yes" ? VERIFIED : MISS }}>
            <span style={{ fontWeight: 700 }}>{entry.departureAnswer === "yes" ? "On the way" : "Not left yet"}</span>
            {entry.departureQuip && <span style={{ fontStyle: "italic", fontWeight: 400 }}> — {entry.departureQuip}</span>}
          </p>
        )}

        {canAnswerCompletion && (
          <div className="ui" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            {!answered ? (
              <>
                <span style={{ fontSize: 12.5, color: "#5C5442" }}>Completed this?</span>
                <button onClick={() => onSetCompletion(entry.id, "yes")}
                  style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: `1.5px solid ${VERIFIED}`, color: VERIFIED, background: "white", cursor: "pointer" }}>
                  Yes
                </button>
                <button onClick={() => onSetCompletion(entry.id, "no")}
                  style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 5, border: `1.5px solid ${MISS}`, color: MISS, background: "white", cursor: "pointer" }}>
                  No
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, fontWeight: 700, color: isDone ? VERIFIED : MISS }}>
                  {isDone ? "Completed" : "Not completed"}
                </span>
                {entry.completionQuip && (
                  <span className="ui" style={{ fontSize: 11.5, fontStyle: "italic", color: "#5C5442" }}>{entry.completionQuip}</span>
                )}
                <button onClick={() => onSetCompletion(entry.id, null)}
                  style={{ fontSize: 11.5, color: GOLD, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  change
                </button>
              </>
            )}
          </div>
        )}

        {missedOrIncomplete && !showReschedule && (
          <button onClick={() => setShowReschedule(true)} className="ui"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8, padding: "5px 12px", borderRadius: 5, border: `1px solid ${GOLD}`, color: GOLD, background: "white", cursor: "pointer" }}>
            <Clock size={12} /> {entry.kind === "task" ? "Push to another day?" : "Missed it — reschedule?"}
          </button>
        )}
        {missedOrIncomplete && showReschedule && (
          <div className="ui" style={{ marginTop: 8, padding: 10, border: `1px solid ${RULE}`, borderRadius: 6, background: "white" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)}
                style={{ flex: 1, padding: "6px 8px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 12.5 }} />
              {entry.kind === "appointment" && (
                <input type="time" value={rTime} onChange={(e) => setRTime(e.target.value)}
                  style={{ flex: 1, padding: "6px 8px", border: `1px solid ${RULE}`, borderRadius: 5, fontSize: 12.5 }} />
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmReschedule}
                style={{ flex: 1, padding: "6px 0", borderRadius: 5, border: "none", background: INK, color: PAPER, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                Move it
              </button>
              <button onClick={() => setShowReschedule(false)}
                style={{ padding: "6px 12px", borderRadius: 5, border: `1px solid ${RULE}`, color: "#5C5442", background: "white", fontSize: 12.5, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {entry.kind === "appointment" && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onCheckIn(entry)} disabled={checking}
              className="ui"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "6px 12px", borderRadius: 5, border: `1px solid ${INK}`, background: "white", cursor: checking ? "default" : "pointer", opacity: checking ? 0.6 : 1 }}>
              {checking ? <Loader2 size={13} /> : <Navigation2 size={13} />} {entry.checkin ? "Check in again" : "Check in here"}
            </button>
            {entry.checkin?.status === "verified" && (
              <div className="stamp ui" style={{ display: "inline-block", marginTop: 8, color: VERIFIED, border: `2px solid ${VERIFIED}`, borderRadius: 4, padding: "3px 10px", transform: "rotate(-6deg)", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
                ON SITE · {metersToMiles(entry.checkin.distance)} mi
              </div>
            )}
            {entry.checkin?.status === "away" && (
              <div className="stamp ui" style={{ display: "inline-block", marginTop: 8, color: MISS, border: `2px solid ${MISS}`, borderRadius: 4, padding: "3px 10px", transform: "rotate(-6deg)", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
                NOT HERE · {metersToMiles(entry.checkin.distance)} mi away
              </div>
            )}
            {entry.checkin?.status === "logged" && (
              <div className="stamp ui" style={{ display: "inline-block", marginTop: 8, color: GOLD, border: `2px solid ${GOLD}`, borderRadius: 4, padding: "3px 10px", transform: "rotate(-6deg)", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
                LOGGED HERE
              </div>
            )}
            {entry.checkin?.status === "error" && (
              <p className="ui" style={{ fontSize: 11.5, color: MISS, marginTop: 6 }}>{entry.checkin.message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
