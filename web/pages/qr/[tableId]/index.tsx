import { useRouter } from "next/router";
import Head from "next/head";
import { useEffect, useState, useMemo, useCallback, FormEvent } from "react";

/* ──────────────────────── Types ──────────────────────── */
type Tenant = { id: string; name: string; slug: string; logo?: string | null };
type Category = { id: string; name: string; imageUrl?: string | null; description?: string | null };
type MenuItem = {
  id: string; categoryId: string; name: string; price: number;
  description?: string | null; image?: string | null; isVeg?: boolean;
  isTodaySpecial?: boolean; stockQty: number;
};
type CartItem = { item: MenuItem; qty: number; note: string };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const money = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

/* ──────────────────────── Page ──────────────────────── */
export default function QrTablePage() {
  const { query, isReady } = useRouter();
  const tableId = String(query.tableId ?? "");
  const schoolCode = String(query.school ?? query.code ?? "").toUpperCase();

  /* ── state ── */
  const [phase, setPhase] = useState<"resolve" | "menu" | "cart" | "login" | "confirm">("resolve");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState(schoolCode);

  // login
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [tenantIdHeader, setTenantIdHeader] = useState("");
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; total: number } | null>(null);

  /* ── resolve tenant ── */
  const resolveTenant = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/tenants/resolve?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.message || "School not found");
      setTenant(json.data);
      setTenantIdHeader(json.data.id);
      // load menu
      const [catRes, itemRes] = await Promise.all([
        fetch(`${API}/menu/public/categories?tenantId=${json.data.id}`).then(r => r.json()),
        fetch(`${API}/menu/public/items?tenantId=${json.data.id}`).then(r => r.json())
      ]);
      setCategories(catRes.data ?? []);
      setItems(itemRes.data ?? []);
      setPhase("menu");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && schoolCode) resolveTenant(schoolCode);
  }, [isReady, schoolCode, resolveTenant]);

  /* ── cart helpers ── */
  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.item.price * c.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1, note: "" }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => c.item.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));
  };
  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.item.id !== id));

  /* ── filtered items ── */
  const visibleItems = useMemo(() => {
    let filtered = items.filter(i => i.stockQty > 0);
    if (activeCat) filtered = filtered.filter(i => i.categoryId === activeCat);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(i => i.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [items, activeCat, search]);

  const specials = useMemo(() => items.filter(i => i.isTodaySpecial && i.stockQty > 0), [items]);

  /* ── login & place order ── */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantIdHeader },
        body: JSON.stringify({ phone, password })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Login failed");
      setToken(json.data.accessToken);
      // now place the order
      await placeOrder(json.data.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async (accessToken: string) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "x-tenant-id": tenantIdHeader
        },
        body: JSON.stringify({
          items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty, note: c.note || undefined })),
          paymentMethod: "CASH",
          paymentStatus: "PENDING"
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Order failed");
      setOrderResult({ orderNumber: json.data.orderNumber, total: json.data.totalAmount });
      setCart([]);
      setPhase("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  };

  /* ── resolve phase ── */
  if (phase === "resolve" && !loading) {
    return (
      <>
        <Head><title>QR Table Order</title></Head>
        <div className="qrPage">
          <div className="resolveCard">
            <div className="resolveIcon">🏫</div>
            <h1>Scan & Order</h1>
            <p>Enter your school code to browse the menu</p>
            <form onSubmit={(e) => { e.preventDefault(); resolveTenant(codeInput); }}>
              <input
                placeholder="School Code (e.g. KARIMCG)"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                required
                autoFocus
              />
              <button type="submit" disabled={loading}>
                {loading ? "Loading..." : "Browse Menu →"}
              </button>
            </form>
            {error && <div className="errorBanner">{error}</div>}
            <p className="tableHint">Table: <strong>{tableId}</strong></p>
          </div>
        </div>
        <style jsx global>{css}</style>
      </>
    );
  }

  /* ── order confirmation ── */
  if (phase === "confirm" && orderResult) {
    return (
      <>
        <Head><title>Order Placed!</title></Head>
        <div className="qrPage">
          <div className="confirmCard">
            <div className="confirmIcon">✅</div>
            <h1>Order Placed!</h1>
            <div className="confirmDetail">
              <span>Order #</span><strong>{orderResult.orderNumber}</strong>
            </div>
            <div className="confirmDetail">
              <span>Total</span><strong>{money(orderResult.total)}</strong>
            </div>
            <div className="confirmDetail">
              <span>Table</span><strong>{tableId}</strong>
            </div>
            <p className="confirmHint">Your order has been sent to the kitchen. Please wait at your table.</p>
            <button onClick={() => { setPhase("menu"); setOrderResult(null); }}>
              Order More →
            </button>
          </div>
        </div>
        <style jsx global>{css}</style>
      </>
    );
  }

  /* ── login phase ── */
  if (phase === "login") {
    return (
      <>
        <Head><title>Login to Order — {tenant?.name ?? ""}</title></Head>
        <div className="qrPage">
          <div className="resolveCard">
            <div className="resolveIcon">🔐</div>
            <h1>Login to Place Order</h1>
            <p>You have {cartCount} item{cartCount !== 1 ? "s" : ""} ({money(cartTotal)}) in your cart</p>
            <form onSubmit={handleLogin}>
              <input placeholder="Phone number" type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} required autoFocus />
              <input placeholder="Password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
              <button type="submit" disabled={loading}>
                {loading ? "Placing Order..." : `Login & Place Order — ${money(cartTotal)}`}
              </button>
            </form>
            {error && <div className="errorBanner">{error}</div>}
            <button className="backLink" onClick={() => setPhase("cart")}>← Back to Cart</button>
          </div>
        </div>
        <style jsx global>{css}</style>
      </>
    );
  }

  /* ── cart phase ── */
  if (phase === "cart") {
    return (
      <>
        <Head><title>Your Cart — {tenant?.name ?? ""}</title></Head>
        <div className="qrPage">
          <header className="menuHeader">
            <button className="backBtn" onClick={() => setPhase("menu")}>← Menu</button>
            <h2>Your Cart</h2>
          </header>
          <div className="cartBody">
            {cart.length === 0 ? (
              <div className="emptyCart">
                <div style={{ fontSize: 40 }}>🛒</div>
                <p>Your cart is empty</p>
                <button onClick={() => setPhase("menu")}>Browse Menu</button>
              </div>
            ) : (
              <>
                {cart.map(c => (
                  <div key={c.item.id} className="cartRow">
                    <div className="cartRowLeft">
                      {c.item.image && <img src={c.item.image} alt={c.item.name} className="cartThumb" />}
                      <div>
                        <strong>{c.item.name}</strong>
                        <span className="cartPrice">{money(c.item.price)}</span>
                      </div>
                    </div>
                    <div className="cartRowRight">
                      <div className="qtyControl">
                        <button onClick={() => updateQty(c.item.id, -1)}>−</button>
                        <span>{c.qty}</span>
                        <button onClick={() => updateQty(c.item.id, 1)}>+</button>
                      </div>
                      <strong className="cartSubtotal">{money(c.item.price * c.qty)}</strong>
                      <button className="removeBtn" onClick={() => removeFromCart(c.item.id)}>✕</button>
                    </div>
                  </div>
                ))}
                <div className="cartSummary">
                  <div className="cartSummaryRow"><span>Items</span><span>{cartCount}</span></div>
                  <div className="cartSummaryRow total"><span>Total</span><strong>{money(cartTotal)}</strong></div>
                </div>
                {error && <div className="errorBanner">{error}</div>}
                <button className="orderBtn" onClick={() => {
                  if (token) { placeOrder(token); }
                  else { setPhase("login"); }
                }}>
                  {token ? `Place Order — ${money(cartTotal)}` : `Login & Order — ${money(cartTotal)}`}
                </button>
              </>
            )}
          </div>
        </div>
        <style jsx global>{css}</style>
      </>
    );
  }

  /* ── menu phase ── */
  return (
    <>
      <Head><title>{tenant?.name ?? "Menu"} — Table {tableId}</title></Head>
      <div className="qrPage">
        <header className="menuHeader">
          <div className="menuHeaderTop">
            <div className="brandBlock">
              {tenant?.logo && <img src={tenant.logo} alt="" className="brandLogo" />}
              <div>
                <h1 className="brandName">{tenant?.name ?? "Canteen"}</h1>
                <span className="tableBadge">Table {tableId}</span>
              </div>
            </div>
          </div>
          <input className="searchBar" placeholder="Search menu…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </header>

        {/* category tabs */}
        <nav className="catTabs">
          <button className={!activeCat ? "active" : ""} onClick={() => setActiveCat(null)}>All</button>
          {categories.map(c => (
            <button key={c.id} className={activeCat === c.id ? "active" : ""} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </button>
          ))}
        </nav>

        {/* today's specials */}
        {!activeCat && !search && specials.length > 0 && (
          <section className="specialsSection">
            <h3>🔥 Today's Specials</h3>
            <div className="specialsRow">
              {specials.map(item => {
                const inCart = cart.find(c => c.item.id === item.id);
                return (
                  <div key={item.id} className="specialCard">
                    {item.image && <img src={item.image} alt={item.name} />}
                    <div className="specialInfo">
                      <strong>{item.name}</strong>
                      <span>{money(item.price)}</span>
                    </div>
                    {inCart ? (
                      <div className="qtyControl compact">
                        <button onClick={() => updateQty(item.id, -1)}>−</button>
                        <span>{inCart.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)}>+</button>
                      </div>
                    ) : (
                      <button className="addBtn" onClick={() => addToCart(item)}>+ Add</button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* items grid */}
        <section className="menuGrid">
          {visibleItems.length === 0 && (
            <div className="emptyMenu">
              <div style={{ fontSize: 36 }}>🍽️</div>
              <p>No items found</p>
            </div>
          )}
          {visibleItems.map(item => {
            const inCart = cart.find(c => c.item.id === item.id);
            return (
              <div key={item.id} className="menuCard">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="menuCardImg" />
                ) : (
                  <div className="menuCardImgEmpty">🍽️</div>
                )}
                <div className="menuCardBody">
                  <div className="menuCardHead">
                    {item.isVeg !== undefined && (
                      <span className={`vegBadge ${item.isVeg ? "veg" : "nonveg"}`}>
                        {item.isVeg ? "🟢" : "🔴"}
                      </span>
                    )}
                    <strong>{item.name}</strong>
                  </div>
                  {item.description && <p className="menuCardDesc">{item.description}</p>}
                  <div className="menuCardFooter">
                    <span className="menuPrice">{money(item.price)}</span>
                    {inCart ? (
                      <div className="qtyControl compact">
                        <button onClick={() => updateQty(item.id, -1)}>−</button>
                        <span>{inCart.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)}>+</button>
                      </div>
                    ) : (
                      <button className="addBtn" onClick={() => addToCart(item)}>+ Add</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* floating cart bar */}
        {cartCount > 0 && (
          <div className="floatingCart" onClick={() => setPhase("cart")}>
            <span>{cartCount} item{cartCount !== 1 ? "s" : ""}</span>
            <strong>View Cart — {money(cartTotal)}</strong>
            <span>→</span>
          </div>
        )}

        {loading && <div className="loadingOverlay"><div className="spinner" /></div>}
      </div>
      <style jsx global>{css}</style>
    </>
  );
}

/* ──────────────────────── CSS ──────────────────────── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
body { background: #0f172a; color: #f8fafc; min-height: 100dvh; }

:root {
  --bg: #0f172a;
  --surface: #1e293b;
  --surface2: #334155;
  --accent: #f97316;
  --accent2: #fb923c;
  --text: #f8fafc;
  --muted: #94a3b8;
  --line: rgba(148,163,184,.18);
  --radius: 16px;
  --radius-sm: 10px;
  --shadow: 0 4px 24px rgba(0,0,0,.25);
}

.qrPage { max-width: 480px; margin: 0 auto; min-height: 100dvh; padding-bottom: 80px; position: relative; }

/* ── Resolve / Login Card ── */
.resolveCard, .confirmCard {
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  text-align: center; padding: 48px 24px;
  min-height: 100dvh; justify-content: center;
}
.resolveIcon, .confirmIcon { font-size: 56px; margin-bottom: 8px; }
.resolveCard h1, .confirmCard h1 { font-size: 28px; font-weight: 900; letter-spacing: -.03em; }
.resolveCard p, .confirmCard p { color: var(--muted); font-size: 14px; line-height: 1.5; max-width: 300px; }
.resolveCard form, .confirmCard form { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 12px; }
.resolveCard input, .resolveCard select {
  background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--radius-sm);
  padding: 14px 16px; font-size: 16px; color: var(--text); outline: none; text-align: center;
  font-weight: 600; letter-spacing: .06em;
}
.resolveCard input:focus { border-color: var(--accent); }
.resolveCard button[type="submit"], .confirmCard button {
  background: linear-gradient(135deg, var(--accent), #ea580c);
  color: white; font-weight: 800; font-size: 16px;
  border: none; border-radius: var(--radius-sm); padding: 14px; cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}
.resolveCard button[type="submit"]:hover, .confirmCard button:hover {
  transform: translateY(-1px); box-shadow: 0 8px 32px rgba(249,115,22,.35);
}
.tableHint { font-size: 12px; color: var(--muted); margin-top: 12px; }
.backLink {
  background: none; border: none; color: var(--accent); cursor: pointer; font-size: 14px; font-weight: 600;
  padding: 8px; margin-top: 8px;
}
.errorBanner {
  background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3);
  color: #fca5a5; padding: 10px 16px; border-radius: var(--radius-sm); font-size: 13px; width: 100%;
}

/* ── Confirm ── */
.confirmDetail {
  display: flex; justify-content: space-between; width: 100%; max-width: 260px;
  padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 15px;
}
.confirmDetail span { color: var(--muted); }
.confirmHint { color: var(--muted); font-size: 13px; margin-top: 16px; }

/* ── Menu Header ── */
.menuHeader { padding: 16px 16px 0; }
.menuHeaderTop { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.brandBlock { display: flex; align-items: center; gap: 12px; }
.brandLogo { width: 40px; height: 40px; border-radius: 10px; object-fit: contain; background: var(--surface); }
.brandName { font-size: 20px; font-weight: 900; letter-spacing: -.02em; }
.tableBadge {
  background: var(--accent); color: white; font-size: 11px; font-weight: 800;
  padding: 2px 8px; border-radius: 6px; letter-spacing: .04em;
}
.searchBar {
  width: 100%; background: var(--surface); border: 1.5px solid var(--line);
  border-radius: var(--radius-sm); padding: 12px 16px; font-size: 14px;
  color: var(--text); outline: none;
}
.searchBar:focus { border-color: var(--accent); }
.backBtn {
  background: none; border: none; color: var(--accent); cursor: pointer;
  font-size: 14px; font-weight: 700; padding: 0;
}

/* ── Category tabs ── */
.catTabs {
  display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto;
  scrollbar-width: none; -ms-overflow-style: none;
}
.catTabs::-webkit-scrollbar { display: none; }
.catTabs button {
  flex-shrink: 0; background: var(--surface); border: 1.5px solid var(--line);
  color: var(--muted); padding: 8px 16px; border-radius: 99px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all .2s;
}
.catTabs button.active {
  background: var(--accent); border-color: var(--accent); color: white;
}

/* ── Specials ── */
.specialsSection { padding: 0 16px; margin-bottom: 8px; }
.specialsSection h3 { font-size: 16px; font-weight: 800; margin-bottom: 10px; }
.specialsRow { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; }
.specialsRow::-webkit-scrollbar { display: none; }
.specialCard {
  flex-shrink: 0; width: 160px; background: var(--surface); border-radius: var(--radius);
  border: 1.5px solid var(--line); overflow: hidden;
  display: flex; flex-direction: column;
}
.specialCard img { width: 100%; height: 100px; object-fit: cover; }
.specialInfo { padding: 10px 12px 6px; display: flex; flex-direction: column; gap: 2px; }
.specialInfo strong { font-size: 13px; font-weight: 700; }
.specialInfo span { font-size: 13px; color: var(--accent); font-weight: 800; }
.specialCard .addBtn, .specialCard .qtyControl { margin: 0 12px 10px; }

/* ── Menu Grid ── */
.menuGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 8px 16px; }
.emptyMenu { grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--muted); }
.emptyMenu p { margin-top: 8px; }

.menuCard {
  background: var(--surface); border-radius: var(--radius); border: 1.5px solid var(--line);
  overflow: hidden; display: flex; flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}
.menuCard:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.menuCardImg { width: 100%; height: 110px; object-fit: cover; }
.menuCardImgEmpty {
  width: 100%; height: 110px; background: var(--surface2);
  display: grid; place-items: center; font-size: 32px;
}
.menuCardBody { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.menuCardHead { display: flex; align-items: center; gap: 4px; }
.menuCardHead strong { font-size: 13px; font-weight: 700; line-height: 1.3; }
.vegBadge { font-size: 10px; }
.menuCardDesc { font-size: 11px; color: var(--muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.menuCardFooter { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.menuPrice { font-size: 15px; font-weight: 900; color: var(--accent); }

/* ── Add / Qty buttons ── */
.addBtn {
  background: linear-gradient(135deg, var(--accent), #ea580c);
  color: white; border: none; border-radius: 8px; padding: 6px 14px;
  font-size: 12px; font-weight: 800; cursor: pointer;
  transition: transform .15s;
}
.addBtn:hover { transform: scale(1.04); }
.qtyControl {
  display: flex; align-items: center; gap: 0;
  border: 1.5px solid var(--accent); border-radius: 8px; overflow: hidden;
}
.qtyControl button {
  background: var(--accent); color: white; border: none;
  width: 28px; height: 28px; font-size: 16px; font-weight: 800; cursor: pointer;
}
.qtyControl span { width: 28px; text-align: center; font-size: 13px; font-weight: 800; }
.qtyControl.compact button { width: 26px; height: 26px; font-size: 14px; }
.qtyControl.compact span { width: 24px; font-size: 12px; }

/* ── Floating Cart ── */
.floatingCart {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  width: min(440px, calc(100% - 32px));
  background: linear-gradient(135deg, var(--accent), #ea580c);
  color: white; padding: 14px 20px;
  border-radius: 16px; box-shadow: 0 12px 40px rgba(249,115,22,.4);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 15px; font-weight: 700; cursor: pointer;
  transition: transform .2s;
  z-index: 100;
}
.floatingCart:hover { transform: translateX(-50%) translateY(-2px); }

/* ── Cart Page ── */
.cartBody { padding: 16px; }
.emptyCart { text-align: center; padding: 48px 16px; color: var(--muted); }
.emptyCart p { margin: 8px 0 16px; }
.emptyCart button { background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); padding: 12px 20px; font-weight: 700; cursor: pointer; }
.cartRow {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 0; border-bottom: 1px solid var(--line);
}
.cartRowLeft { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.cartRowLeft strong { font-size: 14px; display: block; }
.cartRowLeft .cartPrice { font-size: 12px; color: var(--muted); }
.cartThumb { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
.cartRowRight { display: flex; align-items: center; gap: 10px; }
.cartSubtotal { font-size: 14px; color: var(--accent); min-width: 50px; text-align: right; }
.removeBtn {
  background: none; border: none; color: var(--muted); font-size: 16px; cursor: pointer;
  padding: 4px; transition: color .15s;
}
.removeBtn:hover { color: #ef4444; }
.cartSummary {
  margin-top: 16px; padding: 16px; background: var(--surface);
  border-radius: var(--radius); border: 1.5px solid var(--line);
}
.cartSummaryRow { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: var(--muted); }
.cartSummaryRow.total { font-size: 18px; color: var(--text); border-top: 1px solid var(--line); padding-top: 12px; margin-top: 6px; }
.orderBtn {
  width: 100%; margin-top: 16px;
  background: linear-gradient(135deg, var(--accent), #ea580c);
  color: white; border: none; border-radius: var(--radius-sm); padding: 16px;
  font-size: 16px; font-weight: 800; cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}
.orderBtn:hover { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(249,115,22,.35); }

/* ── Loading ── */
.loadingOverlay {
  position: fixed; inset: 0; background: rgba(15,23,42,.7); display: grid; place-items: center; z-index: 200;
}
.spinner {
  width: 36px; height: 36px; border: 3px solid var(--line); border-top-color: var(--accent);
  border-radius: 50%; animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
`;
