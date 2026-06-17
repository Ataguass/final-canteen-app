import Head from "next/head";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  note?: string | null;
};

type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  serviceLane?: string;
  laneToken?: string | null;
  isPreOrder?: boolean;
  pickupSlotLabel?: string | null;
  createdAt: string;
  items: OrderItem[];
};

type Session = {
  accessToken: string;
  tenantId: string;
  userName: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const KDS_SESSION_KEY = "kds_session_v1";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const POLL_INTERVAL = 8_000; // 8 second live refresh
const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY"];

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  PENDING:   "ACCEPTED",
  ACCEPTED:  "PREPARING",
  PREPARING: "READY",
  READY:     "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:   "NEW",
  ACCEPTED:  "ACCEPTED",
  PREPARING: "COOKING",
  READY:     "READY",
  COMPLETED: "DONE",
  CANCELLED: "CANCELLED",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:   "#f59e0b",
  ACCEPTED:  "#3b82f6",
  PREPARING: "#8b5cf6",
  READY:     "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
};

const BUMP_LABEL: Record<OrderStatus, string> = {
  PENDING:   "Accept",
  ACCEPTED:  "Start Cooking",
  PREPARING: "Mark Ready",
  READY:     "Complete",
  COMPLETED: "",
  CANCELLED: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function elapsed(createdAt: string): string {
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function urgencyClass(createdAt: string, status: OrderStatus): string {
  if (status === "READY") return "card-ready";
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
  if (mins > 15) return "card-overdue";
  if (mins > 8)  return "card-urgent";
  return "";
}

function isTeacherLane(order: Order) {
  return order.serviceLane === "TEACHER_PRIORITY";
}

// ─── API client ──────────────────────────────────────────────────────────────
async function apiRequest<T>(
  path: string,
  session: Session,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      "x-tenant-id": session.tenantId,
      ...(options.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Request failed");
  return json as T;
}

// ─── ElapsedTimer: re-renders every second ────────────────────────────────────
function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="elapsed">{elapsed(createdAt)}</span>;
}

// ─── OrderCard ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onBump,
  bumping,
}: {
  order: Order;
  onBump: (order: Order) => void;
  bumping: boolean;
}) {
  const next = STATUS_FLOW[order.status];
  const bumpLabel = BUMP_LABEL[order.status];
  const urgent = urgencyClass(order.createdAt, order.status);
  const teacher = isTeacherLane(order);

  return (
    <article className={`order-card ${urgent} ${teacher ? "card-teacher" : ""}`}>
      {/* Card header */}
      <div className="card-header">
        <div className="card-header-left">
          {teacher && <span className="lane-badge teacher">⭐ PRIORITY</span>}
          {order.isPreOrder && <span className="lane-badge preorder">📅 PRE-ORDER</span>}
          <span className="order-number">{order.orderNumber}</span>
        </div>
        <div className="card-header-right">
          <span
            className="status-pill"
            style={{ background: STATUS_COLOR[order.status] }}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </div>
      </div>

      {/* Pickup slot if pre-order */}
      {order.pickupSlotLabel && (
        <div className="pickup-slot">
          🕐 Pickup: <strong>{order.pickupSlotLabel}</strong>
        </div>
      )}

      {/* Items */}
      <ul className="item-list">
        {order.items.map((item) => (
          <li key={item.id} className="item-row">
            <span className="item-qty">{item.quantity}×</span>
            <span className="item-name">{item.name}</span>
            {item.note && <span className="item-note">({item.note})</span>}
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="card-footer">
        <ElapsedTimer createdAt={order.createdAt} />
        {next && (
          <button
            className={`bump-btn ${order.status === "PREPARING" ? "bump-ready" : order.status === "READY" ? "bump-complete" : ""}`}
            onClick={() => onBump(order)}
            disabled={bumping}
          >
            {bumping ? "…" : `${bumpLabel} →`}
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function KdsColumn({
  status,
  orders,
  onBump,
  bumpingId,
}: {
  status: OrderStatus;
  orders: Order[];
  onBump: (order: Order) => void;
  bumpingId: string | null;
}) {
  const color = STATUS_COLOR[status];
  return (
    <div className="kds-column">
      <div className="column-header" style={{ borderTopColor: color }}>
        <span className="column-title" style={{ color }}>
          {STATUS_LABEL[status]}
        </span>
        <span className="column-count" style={{ background: color }}>
          {orders.length}
        </span>
      </div>
      <div className="column-body">
        {orders.length === 0 ? (
          <div className="empty-col">All clear</div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onBump={onBump}
              bumping={bumpingId === order.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({
  onLogin,
  error,
  loading,
}: {
  onLogin: (schoolCode: string, phone: string, password: string) => void;
  error: string;
  loading: boolean;
}) {
  const [sc, setSc] = useState("");
  const [ph, setPh] = useState("");
  const [pw, setPw] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(sc.trim(), ph.trim(), pw);
  };

  return (
    <div className="login-shell">
      <div className="login-box">
        <div className="login-logo">🍽️</div>
        <h1 className="login-title">Kitchen Display</h1>
        <p className="login-sub">Sign in with your admin account</p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit} className="login-form">
          <input
            placeholder="School Code"
            value={sc}
            onChange={(e) => setSc(e.target.value)}
            required
            autoComplete="off"
          />
          <input
            placeholder="Phone or Email"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main KDS Page ────────────────────────────────────────────────────────────
export default function KdsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [ticker, setTicker] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KDS_SESSION_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {
      localStorage.removeItem(KDS_SESSION_KEY);
    }
  }, []);

  // Clock tick for header time display
  useEffect(() => {
    const id = setInterval(() => setTicker((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Load active orders
  const fetchOrders = useCallback(async (sess: Session) => {
    try {
      const res = await apiRequest<{ data: Order[] }>("/orders", sess);
      const active = res.data.filter((o) => ACTIVE_STATUSES.includes(o.status));
      // Sort: teacher priority lane first, then by createdAt asc
      active.sort((a, b) => {
        const aT = isTeacherLane(a) ? 0 : 1;
        const bT = isTeacherLane(b) ? 0 : 1;
        if (aT !== bT) return aT - bT;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setOrders(active);
      setLastSync(new Date());
    } catch {
      // Silently fail on poll errors
    }
  }, []);

  // Start/stop polling
  useEffect(() => {
    if (!session) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    fetchOrders(session);
    pollRef.current = setInterval(() => fetchOrders(session), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session, fetchOrders]);

  // Login handler
  const handleLogin = async (schoolCode: string, phone: string, password: string) => {
    setLoginLoading(true);
    setLoginError("");
    try {
      // 1. Resolve tenant
      const trRes = await fetch(`${API_BASE}/tenants/resolve?code=${encodeURIComponent(schoolCode)}`);
      const trJson = await trRes.json().catch(() => ({})) as { data?: { id?: string } };
      const tenantId = trJson.data?.id ?? schoolCode;

      // 2. Login
      const isEmail = phone.includes("@");
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          password,
          ...(isEmail ? { email: phone } : { phone }),
        }),
      });
      const loginJson = await loginRes.json().catch(() => ({})) as {
        data?: { accessToken?: string; user?: { name?: string; role?: string; tenantId?: string } };
        message?: string;
      };
      if (!loginRes.ok) throw new Error(loginJson.message ?? "Login failed");

      const role = loginJson.data?.user?.role ?? "";
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        throw new Error("Only admin accounts can access the Kitchen Display");
      }

      const sess: Session = {
        accessToken: loginJson.data!.accessToken!,
        tenantId: loginJson.data!.user!.tenantId!,
        userName: loginJson.data!.user!.name ?? "Admin",
      };
      localStorage.setItem(KDS_SESSION_KEY, JSON.stringify(sess));
      setSession(sess);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  // Bump order to next status
  const handleBump = async (order: Order) => {
    if (!session) return;
    const next = STATUS_FLOW[order.status];
    if (!next) return;
    setBumpingId(order.id);
    try {
      await apiRequest(`/orders/${order.id}/status`, session, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      await fetchOrders(session);
    } catch {
      // Ignore
    } finally {
      setBumpingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(KDS_SESSION_KEY);
    setSession(null);
    setOrders([]);
  };

  // ── Render: Login ────────────────────────────────────────────────────────
  if (!session) {
    return (
      <>
        <Head><title>Kitchen Display System</title></Head>
        <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />
        <style>{css}</style>
      </>
    );
  }

  // Group orders by status column order
  const grouped: Record<OrderStatus, Order[]> = {
    PENDING:   orders.filter((o) => o.status === "PENDING"),
    ACCEPTED:  orders.filter((o) => o.status === "ACCEPTED"),
    PREPARING: orders.filter((o) => o.status === "PREPARING"),
    READY:     orders.filter((o) => o.status === "READY"),
    COMPLETED: [],
    CANCELLED: [],
  };

  const totalActive = orders.length;
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  // ── Render: KDS Board ────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>KDS — Kitchen Display</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="kds-shell">
        {/* Top bar */}
        <header className="kds-topbar">
          <div className="kds-topbar-left">
            <span className="kds-logo">🍽️</span>
            <div>
              <span className="kds-title">Kitchen Display</span>
              <span className="kds-subtitle">{session.userName}</span>
            </div>
          </div>
          <div className="kds-topbar-center">
            <span className="kds-time">{timeStr}</span>
            <span className="kds-date">{dateStr}</span>
          </div>
          <div className="kds-topbar-right">
            <div className="kds-stats">
              <div className="kds-stat">
                <span className="kds-stat-val">{totalActive}</span>
                <span className="kds-stat-lbl">Active</span>
              </div>
              <div className="kds-stat">
                <span className="kds-stat-val">{grouped.PENDING.length}</span>
                <span className="kds-stat-lbl">New</span>
              </div>
              <div className="kds-stat">
                <span className="kds-stat-val">{grouped.READY.length}</span>
                <span className="kds-stat-lbl">Ready</span>
              </div>
            </div>
            {lastSync && (
              <span className="kds-sync">
                ● Synced {lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </span>
            )}
            <button className="kds-logout-btn" onClick={handleLogout}>Sign Out</button>
          </div>
        </header>

        {/* Legend */}
        <div className="kds-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b" }} />New Orders</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: "#3b82f6" }} />Accepted</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: "#8b5cf6" }} />Cooking</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: "#10b981" }} />Ready for Pickup</span>
          <span className="legend-sep" />
          <span className="legend-item"><span className="legend-dot" style={{ background: "#f59e0b", boxShadow: "0 0 0 2px #451a03" }} />⭐ Teacher Priority</span>
          <span className="legend-item urgent-legend">🔴 &gt;8 min overdue</span>
        </div>

        {/* Board */}
        <main className="kds-board">
          {(["PENDING", "ACCEPTED", "PREPARING", "READY"] as OrderStatus[]).map((status) => (
            <KdsColumn
              key={status}
              status={status}
              orders={grouped[status]}
              onBump={handleBump}
              bumpingId={bumpingId}
            />
          ))}
        </main>

        {/* No orders overlay */}
        {totalActive === 0 && (
          <div className="kds-idle">
            <div className="kds-idle-icon">✅</div>
            <h2>Kitchen Clear</h2>
            <p>No active orders — waiting for new orders…</p>
            <p className="kds-idle-sync">Auto-refreshes every {POLL_INTERVAL / 1000}s</p>
          </div>
        )}
      </div>

      <style>{css}</style>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0f1117;
    --surface:  #1a1d27;
    --surface2: #22263a;
    --border:   #2e3347;
    --text:     #f1f5f9;
    --muted:    #7c869a;
    --radius:   12px;
    --topbar-h: 64px;
    --legend-h: 36px;
  }

  html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--text);
    font-family: 'Inter', system-ui, sans-serif; }

  /* ── Login ── */
  .login-shell {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 60% 40%, #1e1b4b 0%, #0f1117 70%);
  }
  .login-box {
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 48px 44px; width: 360px; text-align: center;
    box-shadow: 0 24px 64px rgba(0,0,0,.6);
  }
  .login-logo { font-size: 48px; margin-bottom: 16px; }
  .login-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 6px; }
  .login-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }
  .login-error {
    background: rgba(239,68,68,.12); border: 1px solid #ef4444;
    border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #fca5a5;
    margin-bottom: 18px; text-align: left;
  }
  .login-form { display: flex; flex-direction: column; gap: 12px; }
  .login-form input {
    background: var(--surface2); border: 1.5px solid var(--border); border-radius: 10px;
    padding: 12px 14px; font-size: 15px; color: var(--text); outline: none;
    transition: border-color .15s;
  }
  .login-form input:focus { border-color: #6c47ff; }
  .login-form button {
    background: linear-gradient(135deg, #6c47ff, #4f2fe0); color: #fff; border: none;
    border-radius: 10px; padding: 13px; font-size: 15px; font-weight: 700;
    cursor: pointer; margin-top: 6px; transition: opacity .15s;
  }
  .login-form button:hover:not(:disabled) { opacity: .88; }
  .login-form button:disabled { opacity: .5; cursor: default; }

  /* ── Shell ── */
  .kds-shell {
    display: grid;
    grid-template-rows: var(--topbar-h) var(--legend-h) 1fr;
    height: 100vh; overflow: hidden;
  }

  /* ── Topbar ── */
  .kds-topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 0 20px; height: var(--topbar-h);
  }
  .kds-topbar-left { display: flex; align-items: center; gap: 12px; }
  .kds-logo { font-size: 26px; }
  .kds-title { display: block; font-size: 16px; font-weight: 800; letter-spacing: -.01em; }
  .kds-subtitle { display: block; font-size: 11px; color: var(--muted); font-weight: 500; }
  .kds-topbar-center { display: flex; flex-direction: column; align-items: center; }
  .kds-time { font-size: 26px; font-weight: 900; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .kds-date { font-size: 11px; color: var(--muted); font-weight: 500; }
  .kds-topbar-right { display: flex; align-items: center; gap: 16px; }
  .kds-stats { display: flex; gap: 14px; }
  .kds-stat { display: flex; flex-direction: column; align-items: center; }
  .kds-stat-val { font-size: 20px; font-weight: 900; line-height: 1; }
  .kds-stat-lbl { font-size: 10px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
  .kds-sync { font-size: 11px; color: #10b981; font-weight: 600; }
  .kds-logout-btn {
    background: none; border: 1.5px solid var(--border); color: var(--muted);
    border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all .15s;
  }
  .kds-logout-btn:hover { border-color: #ef4444; color: #ef4444; }

  /* ── Legend ── */
  .kds-legend {
    display: flex; align-items: center; gap: 16px; padding: 0 20px;
    background: var(--surface2); border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--muted); font-weight: 600; overflow-x: auto;
  }
  .legend-item { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .legend-sep { flex: 1; }
  .urgent-legend { color: #ef4444; }

  /* ── Board ── */
  .kds-board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    overflow: hidden;
    height: 100%;
  }

  /* ── Column ── */
  .kds-column {
    display: flex; flex-direction: column;
    border-right: 1px solid var(--border);
    overflow: hidden;
  }
  .kds-column:last-child { border-right: none; }
  .column-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: var(--surface);
    border-top: 3px solid transparent;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .column-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
  .column-count {
    min-width: 24px; height: 24px; border-radius: 99px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 900; color: #fff; padding: 0 6px;
  }
  .column-body {
    flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;
    background: var(--bg);
  }
  .column-body::-webkit-scrollbar { width: 4px; }
  .column-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  .empty-col {
    text-align: center; color: var(--muted); font-size: 13px; font-weight: 600;
    padding: 32px 0; opacity: .5;
  }

  /* ── Order Card ── */
  .order-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
    display: flex; flex-direction: column; gap: 10px;
    transition: border-color .2s, box-shadow .2s;
    position: relative;
  }
  .order-card:hover { border-color: #3e4562; }

  /* Urgency */
  .card-urgent { border-color: #f59e0b !important; box-shadow: 0 0 0 1px rgba(245,158,11,.2); }
  .card-overdue { border-color: #ef4444 !important; box-shadow: 0 0 0 2px rgba(239,68,68,.25); animation: pulse-red 1.5s ease-in-out infinite; }
  .card-ready { border-color: #10b981 !important; box-shadow: 0 0 12px rgba(16,185,129,.2); }
  .card-teacher { border-left: 4px solid #f59e0b; }

  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 2px rgba(239,68,68,.25); }
    50%       { box-shadow: 0 0 0 4px rgba(239,68,68,.45); }
  }

  /* Card Header */
  .card-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .card-header-left { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .order-number { font-size: 15px; font-weight: 900; letter-spacing: -.01em; }
  .lane-badge {
    font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .lane-badge.teacher { background: rgba(245,158,11,.15); color: #f59e0b; border: 1px solid rgba(245,158,11,.3); }
  .lane-badge.preorder { background: rgba(139,92,246,.15); color: #a78bfa; border: 1px solid rgba(139,92,246,.3); }
  .status-pill {
    font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 99px;
    text-transform: uppercase; letter-spacing: .06em; color: #fff;
  }

  /* Pickup slot */
  .pickup-slot {
    font-size: 12px; color: #a78bfa; background: rgba(139,92,246,.08);
    border: 1px solid rgba(139,92,246,.2); border-radius: 8px; padding: 6px 10px;
  }

  /* Items */
  .item-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .item-row { display: flex; align-items: baseline; gap: 8px; font-size: 14px; }
  .item-qty {
    background: var(--surface2); color: var(--text); font-weight: 800;
    min-width: 28px; text-align: center; border-radius: 6px; padding: 2px 5px;
    font-size: 13px; flex-shrink: 0;
  }
  .item-name { font-weight: 600; flex: 1; }
  .item-note { font-size: 12px; color: var(--muted); font-style: italic; }

  /* Footer */
  .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
  .elapsed { font-size: 12px; color: var(--muted); font-weight: 700; font-variant-numeric: tabular-nums; }

  /* Bump button */
  .bump-btn {
    background: #1e3a5f; color: #60a5fa; border: 1.5px solid #2563eb;
    border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 800;
    cursor: pointer; transition: all .15s; white-space: nowrap;
  }
  .bump-btn:hover:not(:disabled) { background: #2563eb; color: #fff; }
  .bump-btn:disabled { opacity: .4; cursor: default; }
  .bump-btn.bump-ready { background: #14532d; color: #4ade80; border-color: #16a34a; }
  .bump-btn.bump-ready:hover:not(:disabled) { background: #16a34a; color: #fff; }
  .bump-btn.bump-complete { background: #374151; color: #9ca3af; border-color: #6b7280; }
  .bump-btn.bump-complete:hover:not(:disabled) { background: #4b5563; color: #fff; }

  /* ── Idle overlay ── */
  .kds-idle {
    position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    background: rgba(15,17,23,.92); z-index: 10; pointer-events: none;
  }
  .kds-idle-icon { font-size: 72px; animation: float 3s ease-in-out infinite; }
  .kds-idle h2 { font-size: 28px; font-weight: 900; color: #10b981; }
  .kds-idle p { font-size: 16px; color: var(--muted); }
  .kds-idle-sync { font-size: 13px; color: #374151; }
  @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
`;
