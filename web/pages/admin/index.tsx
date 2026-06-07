import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Role = "ADMIN" | "SUPER_ADMIN" | "TEACHER" | "STUDENT" | "STAFF" | "GUEST";
type PaymentMethod = "CASH" | "UPI" | "WALLET" | "CREDIT" | "CARD" | "OTHER";
type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL";
type OrderStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED" | "REFUNDED";

type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  role: Role;
  email?: string | null;
  phone?: string | null;
};

type Session = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
};

type Category = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  isTodaySpecial?: boolean;
};

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  price: number;
  stockQty: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  isTodaySpecial?: boolean;
  isVeg: boolean;
};

type Order = {
  id: string;
  userId?: string | null;
  orderNumber: string;
  status: OrderStatus;
  serviceLane?: string;
  laneToken?: string | null;
  isPreOrder?: boolean;
  pickupSlotLabel?: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
};

type ManagedUser = {
  id: string;
  name: string;
  phone?: string | null;
  role: "TEACHER" | "STAFF";
  isActive: boolean;
  isApproved: boolean;
  createdAt: string;
};

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  actionUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Backup = {
  id: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

type InvoiceSettings = {
  id: string;
  name: string;
  logo?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceShowLogo: boolean;
  invoiceShowSchoolName: boolean;
  invoiceShowOrderNumber: boolean;
  invoiceShowDate: boolean;
  invoiceShowCashier: boolean;
  invoiceShowPaymentDetails: boolean;
  invoiceShowTaxBreakup: boolean;
  invoiceShowNotes: boolean;
  invoiceFooterNote?: string | null;
};

type View = "dashboard" | "pos" | "orders" | "menu" | "stock" | "reports" | "users" | "banners" | "invoice" | "backups";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const sessionKey = "canteen-web-admin-session";

const statusFlow: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];
const views: Array<{ id: View; label: string; hint: string }> = [
  { id: "dashboard", label: "Dashboard", hint: "Sales, queues, and operations" },
  { id: "pos", label: "POS", hint: "Counter billing and payments" },
  { id: "orders", label: "Orders", hint: "Kitchen queue and payment state" },
  { id: "menu", label: "Menu", hint: "Categories and item setup" },
  { id: "stock", label: "Stock", hint: "Inventory and low-stock list" },
  { id: "reports", label: "Reports", hint: "Graphs and CSV exports" },
  { id: "users", label: "Users", hint: "Teacher and staff access" },
  { id: "banners", label: "Banners", hint: "Student app promotions" },
  { id: "invoice", label: "Invoice", hint: "Receipt logo and fields" },
  { id: "backups", label: "Backups", hint: "Download and restore data" }
];

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export default function AdminWebPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [loginId, setLoginId] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<"TEACHER" | "STAFF">("TEACHER");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [posQuantities, setPosQuantities] = useState<Record<string, number>>({});
  const [posPaymentMethod, setPosPaymentMethod] = useState<PaymentMethod>("CASH");
  const [posPaymentStatus, setPosPaymentStatus] = useState<PaymentStatus>("PAID");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [uploadingInvoiceLogo, setUploadingInvoiceLogo] = useState(false);
  const [posSearch, setPosSearch] = useState("");
  const [posSelectedCategory, setPosSelectedCategory] = useState<string | null>(null);
  const [posFavorites, setPosFavorites] = useState<Set<string>>(new Set());
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  
  // Hold Order feature
  const [heldOrders, setHeldOrders] = useState<Array<{
    quantities: Record<string, number>;
    paymentMethod: PaymentMethod;
    customerPhone: string;
  }>>([]);

  const token = session?.accessToken ?? "";
  const tenantId = session?.user.tenantId ?? "";

  const api = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "x-tenant-id": tenantId } : {}),
        ...(options.headers ?? {})
      }
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((json as { message?: string }).message ?? "Request failed");
    }
    return json as T;
  };

  const loadAll = async () => {
    if (!token || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [orderRes, categoryRes, itemRes, userRes, bannerRes, backupRes, invoiceRes] = await Promise.all([
        api<{ data: Order[] }>("/orders"),
        api<{ data: Category[] }>("/menu/categories"),
        api<{ data: MenuItem[] }>("/menu/items?includeAll=true"),
        api<{ data: ManagedUser[] }>("/users"),
        api<{ data: Banner[] }>("/banners?includeInactive=true"),
        api<{ data: Backup[] }>("/backups/me"),
        api<{ data: InvoiceSettings }>("/tenants/me/invoice-settings")
      ]);
      setOrders(orderRes.data);
      setCategories(categoryRes.data);
      setItems(itemRes.data);
      setUsers(userRes.data);
      setBanners(bannerRes.data);
      setBackups(backupRes.data);
      setInvoiceSettings(invoiceRes.data);
      if (!itemCategoryId && categoryRes.data[0]) {
        setItemCategoryId(categoryRes.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Session;
        if (parsed.user?.tenantId && parsed.accessToken) {
          setSession(parsed);
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!session || activeView !== "pos") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetPosOrder();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        placePosOrder({ preventDefault: () => {} } as FormEvent);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session, activeView, posQuantities]);

  useEffect(() => {
    loadAll().catch(() => undefined);
  }, [token, tenantId]);

  const dashboard = useMemo(() => {
    const today = new Date();
    const todayKey = today.toDateString();
    const month = today.getMonth();
    const year = today.getFullYear();
    const completed = orders.filter((order) => order.status === "COMPLETED");
    const todaySales = completed
      .filter((order) => new Date(order.createdAt).toDateString() === todayKey)
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const monthlySales = completed
      .filter((order) => {
        const created = new Date(order.createdAt);
        return created.getMonth() === month && created.getFullYear() === year;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);
    return {
      todaySales,
      monthlySales,
      pending: orders.filter((order) => ["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(order.status)).length,
      lowStock: items.filter((item) => item.stockQty <= item.lowStockThreshold).length,
      hiddenItems: items.filter((item) => !item.isAvailable).length,
      recent: [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5)
    };
  }, [items, orders]);

  const lowStockItems = useMemo(
    () => items.filter((item) => item.stockQty <= item.lowStockThreshold).sort((a, b) => a.stockQty - b.stockQty),
    [items]
  );

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const isEmail = loginIdentifier.includes("@");
      const tenantInput = loginId.trim();
      let resolvedTenantId = tenantInput;

      const tenantResponse = await fetch(`${apiBaseUrl}/tenants/resolve?code=${encodeURIComponent(tenantInput)}`);
      if (tenantResponse.ok) {
        const tenantJson = (await tenantResponse.json()) as { data?: { id?: string } };
        resolvedTenantId = tenantJson.data?.id ?? tenantInput;
      }

      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: resolvedTenantId,
          password: loginPassword,
          ...(isEmail ? { email: loginIdentifier.trim() } : { phone: loginIdentifier.trim() })
        })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((json as { message?: string }).message ?? "Login failed");
      }
      const nextSession = (json as { data: Session }).data;
      if (nextSession.user.role !== "ADMIN" && nextSession.user.role !== "SUPER_ADMIN") {
        throw new Error("Only admin accounts can open the web admin panel");
      }
      setSession(nextSession);
      localStorage.setItem(sessionKey, JSON.stringify(nextSession));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setConfirmAction({
      title: "Sign out?",
      message: "You will need to sign in again to access the admin panel.",
      onConfirm: () => {
        localStorage.removeItem(sessionKey);
        setSession(null);
        setOrders([]);
        setItems([]);
        setCategories([]);
        setUsers([]);
        setBanners([]);
        setBackups([]);
        setInvoiceSettings(null);
        setPosQuantities({});
        setSidebarOpen(false);
        setConfirmAction(null);
      }
    });
  };

  const mutate = async (message: string, action: () => Promise<void>) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await action();
      await loadAll();
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const createCategory = (event: FormEvent) => {
    event.preventDefault();
    mutate("Category created", async () => {
      await api("/menu/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName, description: categoryDescription })
      });
      setCategoryName("");
      setCategoryDescription("");
    });
  };

  const createItem = (event: FormEvent) => {
    event.preventDefault();
    mutate("Item created", async () => {
      await api("/menu/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: itemCategoryId,
          name: itemName,
          price: Number(itemPrice),
          stockQty: Number(itemStock || 0)
        })
      });
      setItemName("");
      setItemPrice("");
      setItemStock("");
    });
  };

  const createUser = (event: FormEvent) => {
    event.preventDefault();
    mutate("User created", async () => {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ name: userName, phone: userPhone, password: userPassword, role: userRole })
      });
      setUserName("");
      setUserPhone("");
      setUserPassword("");
    });
  };

  const createBanner = (event: FormEvent) => {
    event.preventDefault();
    mutate("Banner created", async () => {
      await api("/banners", {
        method: "POST",
        body: JSON.stringify({ title: bannerTitle, imageUrl: bannerImageUrl })
      });
      setBannerTitle("");
      setBannerImageUrl("");
    });
  };

  const uploadBanner = async (file?: File) => {
    if (!file) return;
    setUploadingBanner(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await api<{ data: { imageUrl: string } }>("/banners/upload-image", {
        method: "POST",
        body: JSON.stringify({ dataUrl })
      });
      setBannerImageUrl(response.data.imageUrl);
      setNotice("Banner image uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingBanner(false);
    }
  };

  const placePosOrder = (event: FormEvent) => {
    event.preventDefault();
    const orderItems = Object.entries(posQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    mutate("POS order created", async () => {
      if (!orderItems.length) {
        throw new Error("Select at least one item before billing");
      }
      if (posPaymentMethod === "WALLET" && !posCustomerPhone.trim()) {
        throw new Error("Customer phone is required for wallet POS payment");
      }

      await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: orderItems,
          paymentMethod: posPaymentMethod,
          paymentStatus: posPaymentStatus,
          ...(posPaymentMethod === "WALLET" ? { customerPhone: posCustomerPhone.trim() } : {})
        })
      });
      setPosQuantities({});
      setPosCustomerPhone("");
    });
  };

  const resetPosOrder = () => {
    setPosQuantities({});
    setPosCustomerPhone("");
    setPosPaymentMethod("CASH");
    setPosPaymentStatus("PAID");
  };

  const toggleFavorite = (itemId: string) => {
    const updated = new Set(posFavorites);
    if (updated.has(itemId)) {
      updated.delete(itemId);
    } else {
      updated.add(itemId);
    }
    setPosFavorites(updated);
  };

  const holdCurrentOrder = () => {
    if (Object.keys(posQuantities).length === 0) {
      alert("Nothing to hold. Add items first.");
      return;
    }
    setHeldOrders((prev) => [
      ...prev,
      {
        quantities: { ...posQuantities },
        paymentMethod: posPaymentMethod,
        customerPhone: posCustomerPhone
      }
    ]);
    resetPosOrder();
    alert(`Order held! (${heldOrders.length + 1} held orders)`);
  };

  const restoreLastHeld = () => {
    if (heldOrders.length === 0) {
      alert("No held orders to restore.");
      return;
    }
    const lastHeld = heldOrders[heldOrders.length - 1];
    setPosQuantities(lastHeld.quantities);
    setPosPaymentMethod(lastHeld.paymentMethod);
    setPosCustomerPhone(lastHeld.customerPhone);
    setHeldOrders((prev) => prev.slice(0, -1));
    alert("Order restored from hold!");
  };

  const updateInvoiceSettings = (patch: Partial<InvoiceSettings>) =>
    mutate("Invoice settings saved", async () => {
      const response = await api<{ data: InvoiceSettings }>("/tenants/me/invoice-settings", {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      setInvoiceSettings(response.data);
    });

  const uploadInvoiceLogo = async (file?: File) => {
    if (!file) return;
    setUploadingInvoiceLogo(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await api<{ data: InvoiceSettings }>("/tenants/me/invoice-logo", {
        method: "POST",
        body: JSON.stringify({ dataUrl })
      });
      setInvoiceSettings(response.data);
      setNotice("Invoice logo uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice logo upload failed");
    } finally {
      setUploadingInvoiceLogo(false);
    }
  };

  const removeInvoiceLogo = () =>
    mutate("Invoice logo removed", async () => {
      const response = await api<{ data: InvoiceSettings }>("/tenants/me/invoice-logo", {
        method: "DELETE"
      });
      setInvoiceSettings(response.data);
    });

  const updateOrderStatus = (order: Order, status: OrderStatus) =>
    mutate("Order updated", async () => {
      await api(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    });

  const updateStock = (item: MenuItem, stockQty: number) =>
    mutate("Stock updated", async () => {
      await api(`/menu/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stockQty })
      });
    });

  const toggleItem = (item: MenuItem) =>
    mutate(item.isAvailable ? "Item hidden" : "Item visible", async () => {
      await api(`/menu/items/${item.id}/toggle`, { method: "PATCH" });
    });

  const toggleSpecial = (item: MenuItem) =>
    mutate("Today special updated", async () => {
      await api(`/menu/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isTodaySpecial: !item.isTodaySpecial })
      });
    });

  const createBackup = () =>
    mutate("Backup created", async () => {
      await api("/backups/me", { method: "POST" });
    });

  const downloadBackup = async (backup: Backup) => {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/backups/me/${backup.id}/download?format=zip`, {
        headers: { Authorization: `Bearer ${token}`, "x-tenant-id": tenantId }
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backup.id.replace(/\.json$/, ".zip");
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  if (!session) {
    return (
      <>
        <Head>
          <title>Canteen Admin Web</title>
        </Head>
        <main className="loginShell">
          <section className="loginPanel">
            <div>
              <p className="eyebrow">Canteen Admin</p>
              <h1>Operations console</h1>
              <p className="muted">Manage orders, menu, stock, users, banners, and backups from a browser.</p>
            </div>
            <form onSubmit={handleLogin} className="form">
              <label>
                School Code or Slug
                <input
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder="Example: SCHVX14S1"
                  required
                />
              </label>
              <label>
                Phone or Email
                <input value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} required />
              </label>
              <label>
                Password
                <input
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type="password"
                  required
                />
              </label>
              {error ? <p className="errorText">{error}</p> : null}
              <button disabled={loading} className="primaryButton">{loading ? "Signing in..." : "Sign in"}</button>
            </form>
          </section>
        </main>
        <style jsx global>{globalCss}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Web | Canteen</title>
      </Head>
      <main className="appShell">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebarHeader">
            <div className="brandBlock">
              <div className="brandMark">C</div>
              <div>
                <p className="brandTitle">Canteen</p>
                <p className="brandSub">Admin web</p>
              </div>
            </div>
            <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
          <nav className="navList">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  setActiveView(view.id);
                  setSidebarOpen(false);
                }}
                className={`navItem ${activeView === view.id ? "active" : ""}`}
              >
                <span>{view.label}</span>
                <small>{view.hint}</small>
              </button>
            ))}
          </nav>
          <button className="ghostButton" onClick={logout}>Logout</button>
        </aside>

        <section className="workArea">
          <header className="topbar">
            <button className="hamburgerMobile" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <span></span>
              <span></span>
              <span></span>
            </button>
            <div>
              <p className="eyebrow">{session.user.role}</p>
              <h1>{views.find((view) => view.id === activeView)?.label}</h1>
            </div>
            <div className="topbarActions">
              <button onClick={loadAll} className="secondaryButton" disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <div className="avatar">{session.user.name.charAt(0).toUpperCase()}</div>
            </div>
          </header>

          {notice ? <div className="notice">{notice}</div> : null}
          {error ? <div className="errorBox">{error}</div> : null}

          {activeView === "dashboard" ? (
            <DashboardView dashboard={dashboard} items={items} setActiveView={setActiveView} updateOrderStatus={updateOrderStatus} />
          ) : null}

          {activeView === "pos" ? (
            <PosView
              items={items}
              categories={categories}
              quantities={posQuantities}
              setQuantities={setPosQuantities}
              paymentMethod={posPaymentMethod}
              setPaymentMethod={setPosPaymentMethod}
              paymentStatus={posPaymentStatus}
              setPaymentStatus={setPosPaymentStatus}
              customerPhone={posCustomerPhone}
              setCustomerPhone={setPosCustomerPhone}
              placeOrder={placePosOrder}
              resetOrder={resetPosOrder}
              loading={loading}
              search={posSearch}
              setSearch={setPosSearch}
              selectedCategory={posSelectedCategory}
              setSelectedCategory={setPosSelectedCategory}
              favorites={posFavorites}
              toggleFavorite={toggleFavorite}
              showOrderHistory={showOrderHistory}
              setShowOrderHistory={setShowOrderHistory}
              heldOrdersCount={heldOrders.length}
              onHold={holdCurrentOrder}
              onRestoreHold={restoreLastHeld}
            />
          ) : null}

          {activeView === "orders" ? (
            <section className="section">
              <SectionHeading title="Orders" meta={`${orders.length} total`} />
              <OrdersTable orders={orders} updateOrderStatus={updateOrderStatus} />
            </section>
          ) : null}

          {activeView === "menu" ? (
            <section className="splitLayout">
              <div className="section">
                <SectionHeading title="Categories" meta={`${categories.length} active`} />
                <form onSubmit={createCategory} className="inlineForm">
                  <input placeholder="Category name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
                  <input placeholder="Description" value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} />
                  <button className="primaryButton">Add</button>
                </form>
                <div className="list">
                  {categories.map((category) => (
                    <div key={category.id} className="rowItem">
                      <strong>{category.name}</strong>
                      <span>{category.description || "No description"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="section">
                <SectionHeading title="Items" meta={`${items.length} shown`} />
                <form onSubmit={createItem} className="formGrid">
                  <input placeholder="Item name" value={itemName} onChange={(event) => setItemName(event.target.value)} required />
                  <input placeholder="Price" type="number" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} required />
                  <input placeholder="Stock" type="number" value={itemStock} onChange={(event) => setItemStock(event.target.value)} />
                  <select value={itemCategoryId} onChange={(event) => setItemCategoryId(event.target.value)} required>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <button className="primaryButton">Add Item</button>
                </form>
                <MenuTable items={items} categories={categories} toggleItem={toggleItem} toggleSpecial={toggleSpecial} />
              </div>
            </section>
          ) : null}

          {activeView === "stock" ? (
            <section className="section">
              <SectionHeading title="Stock" meta={`${lowStockItems.length} low stock`} />
              <StockTable items={items} updateStock={updateStock} />
            </section>
          ) : null}

          {activeView === "reports" ? (
            <ReportsView orders={orders} items={items} setActiveView={setActiveView} />
          ) : null}

          {activeView === "users" ? (
            <section className="splitLayout compact">
              <div className="section">
                <SectionHeading title="Add Teacher/Staff" meta="Admin managed" />
                <form onSubmit={createUser} className="form">
                  <input placeholder="Full name" value={userName} onChange={(event) => setUserName(event.target.value)} required />
                  <input placeholder="Phone" value={userPhone} onChange={(event) => setUserPhone(event.target.value)} required />
                  <input placeholder="Password" type="password" value={userPassword} onChange={(event) => setUserPassword(event.target.value)} required />
                  <select value={userRole} onChange={(event) => setUserRole(event.target.value as "TEACHER" | "STAFF")}>
                    <option value="TEACHER">Teacher</option>
                    <option value="STAFF">Staff</option>
                  </select>
                  <button className="primaryButton">Create User</button>
                </form>
              </div>
              <div className="section">
                <SectionHeading title="Users" meta={`${users.length} managed`} />
                <div className="list">
                  {users.map((user) => (
                    <div key={user.id} className="rowItem userRow">
                      <div>
                        <strong>{user.name}</strong>
                        <span>{user.role} · {user.phone || "No phone"}</span>
                      </div>
                      <span className={`pill ${user.isApproved ? "success" : "warning"}`}>{user.isApproved ? "Approved" : "Pending"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "banners" ? (
            <section className="splitLayout compact">
              <div className="section">
                <SectionHeading title="Create Banner" meta="Student app spotlight" />
                <form onSubmit={createBanner} className="form">
                  <input placeholder="Banner title" value={bannerTitle} onChange={(event) => setBannerTitle(event.target.value)} required />
                  <input placeholder="Image URL" value={bannerImageUrl} onChange={(event) => setBannerImageUrl(event.target.value)} required />
                  <input type="file" accept="image/*" onChange={(event) => uploadBanner(event.target.files?.[0])} />
                  <button className="primaryButton" disabled={uploadingBanner}>{uploadingBanner ? "Uploading..." : "Create Banner"}</button>
                </form>
              </div>
              <div className="section">
                <SectionHeading title="Banners" meta={`${banners.length} total`} />
                <div className="bannerGrid">
                  {banners.map((banner) => (
                    <div key={banner.id} className="bannerItem">
                      <img src={banner.imageUrl} alt={banner.title} />
                      <strong>{banner.title}</strong>
                      <span className={`pill ${banner.isActive ? "success" : "mutedPill"}`}>{banner.isActive ? "Active" : "Hidden"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "invoice" ? (
            <InvoiceSettingsView
              settings={invoiceSettings}
              uploading={uploadingInvoiceLogo}
              onToggle={updateInvoiceSettings}
              onUpload={uploadInvoiceLogo}
              onRemoveLogo={removeInvoiceLogo}
            />
          ) : null}

          {activeView === "backups" ? (
            <section className="section">
              <SectionHeading title="Backups" meta={`${backups.length} files`} />
              <button className="primaryButton narrow" onClick={createBackup}>Create Backup</button>
              <div className="list">
                {backups.map((backup) => (
                  <div key={backup.id} className="rowItem userRow">
                    <div>
                      <strong>{backup.id}</strong>
                      <span>{shortDate(backup.createdAt)} · {(backup.sizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                    <button className="secondaryButton" onClick={() => downloadBackup(backup)}>Download ZIP</button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </main>
      
      {confirmAction && (
        <div className="modalOverlay" onClick={() => setConfirmAction(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h2>{confirmAction.title}</h2>
            <p>{confirmAction.message}</p>
            <div className="modalActions">
              <button className="secondaryButton" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className="primaryButton danger" onClick={() => confirmAction.onConfirm()}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      
      {sidebarOpen && <div className="sidebarBackdrop" onClick={() => setSidebarOpen(false)} />}
      <style jsx global>{globalCss}</style>
    </>
  );
}

function SectionHeading({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="sectionHeading">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

function PosView({
  items,
  categories,
  quantities,
  setQuantities,
  paymentMethod,
  setPaymentMethod,
  paymentStatus,
  setPaymentStatus,
  customerPhone,
  setCustomerPhone,
  placeOrder,
  resetOrder,
  loading,
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  favorites,
  toggleFavorite,
  showOrderHistory,
  setShowOrderHistory,
  heldOrdersCount,
  onHold,
  onRestoreHold
}: {
  items: MenuItem[];
  categories: Category[];
  quantities: Record<string, number>;
  setQuantities: (value: Record<string, number>) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  paymentStatus: PaymentStatus;
  setPaymentStatus: (status: PaymentStatus) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  placeOrder: (event: FormEvent) => void;
  resetOrder: () => void;
  loading: boolean;
  search: string;
  setSearch: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
  favorites: Set<string>;
  toggleFavorite: (itemId: string) => void;
  showOrderHistory: boolean;
  setShowOrderHistory: (show: boolean) => void;
  heldOrdersCount: number;
  onHold: () => void;
  onRestoreHold: () => void;
}) {
  const availableItems = items.filter((item) => item.isAvailable);
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "Uncategorized";
  const setQuantity = (item: MenuItem, quantity: number) => {
    setQuantities({
      ...quantities,
      [item.id]: Math.max(0, Math.min(quantity, item.stockQty))
    });
  };
  const cartLines = Object.entries(quantities)
    .map(([id, quantity]) => ({ item: items.find((entry) => entry.id === id), quantity }))
    .filter((entry): entry is { item: MenuItem; quantity: number } => Boolean(entry.item) && entry.quantity > 0);
  const subtotal = cartLines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const totalQty = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  // Simulated recent orders for demo
  const recentOrders = [
    { id: "1", orderNumber: "ORD-001", total: 250, status: "COMPLETED", time: "2 mins ago" },
    { id: "2", orderNumber: "ORD-002", total: 150, status: "READY", time: "5 mins ago" },
    { id: "3", orderNumber: "ORD-003", total: 320, status: "PREPARING", time: "12 mins ago" }
  ];

  return (
    <section className="posLayout">
      <div className="posItemSection">
        {/* Header with search and category tabs */}
        <div className="posHeader">
          <div className="posSearchBox">
            <span className="searchIcon">🔍</span>
            <input 
              type="text"
              placeholder="Search items, categories..."
              className="posSearchInput"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="categoryTabs">
          <button className={`categoryTab ${!selectedCategory ? "active" : ""}`} onClick={() => setSelectedCategory(null)}>
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`categoryTab ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Favorites section */}
        {favorites.size > 0 && (
          <div className="favoritesSection">
            <h3 className="sectionLabel">⭐ Quick Items</h3>
            <div className="posItemGridCompact">
              {availableItems
                .filter((item) => favorites.has(item.id))
                .map((item) => {
                  const quantity = quantities[item.id] ?? 0;
                  return (
                    <article key={item.id} className={`posCardCompact ${quantity > 0 ? "selected" : ""}`}>
                      <div className="posCardHeader">
                        <strong>{item.name}</strong>
                        <button 
                          className="favoriteBtn active"
                          onClick={() => toggleFavorite(item.id)}
                          title="Remove from favorites"
                        >
                          ⭐
                        </button>
                      </div>
                      <div className="posCardQuick">
                        <span>{money(item.price)}</span>
                        <div className="qtyCompact">
                          <button onClick={() => setQuantity(item, quantity - 1)}>−</button>
                          <span>{quantity}</span>
                          <button onClick={() => setQuantity(item, quantity + 1)}>+</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        )}

        {/* Main items grid */}
        <h3 className="sectionLabel">📦 Menu Items</h3>
        <div className="posItemGrid">
          {availableItems
            .filter(
              (item) =>
                (!selectedCategory || item.categoryId === selectedCategory) &&
                (item.name.toLowerCase().includes(search.toLowerCase()) ||
                  categoryName(item.categoryId).toLowerCase().includes(search.toLowerCase()))
            )
            .map((item) => {
              const quantity = quantities[item.id] ?? 0;
              const isFav = favorites.has(item.id);
              return (
                <article key={item.id} className={`posCard ${quantity > 0 ? "selected" : ""} ${item.isTodaySpecial ? "special" : ""}`}>
                  {item.isTodaySpecial && <span className="specialBadge">Today's Special</span>}
                  <div className="posImage">
                    {item.image ? <img src={item.image} alt={item.name} /> : <span>🍽️</span>}
                  </div>
                  <div className="posCardBody">
                    <div className="posCardTitle">
                      <strong>{item.name}</strong>
                      <button 
                        className={`favoriteBtn ${isFav ? "active" : ""}`}
                        onClick={() => toggleFavorite(item.id)}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                      >
                        {isFav ? "⭐" : "☆"}
                      </button>
                    </div>
                    <span className="categoryLabel">{categoryName(item.categoryId)}</span>
                    {item.isTodaySpecial && <span className="prepTime">⏱️ 8 min prep</span>}
                    <div className="posPriceRow">
                      <b>{money(item.price)}</b>
                      <small>Stock: {item.stockQty}</small>
                    </div>
                    <div className="qtyStepper">
                      <button type="button" onClick={() => setQuantity(item, quantity - 1)}>−</button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(event) => setQuantity(item, Number(event.target.value || 0))}
                      />
                      <button type="button" onClick={() => setQuantity(item, quantity + 1)}>+</button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>

      {/* Checkout Panel */}
      <div className="checkoutSection">
        <form className="checkoutPanel" onSubmit={placeOrder}>
          <div className="checkoutHeader">
            <h2>Order Summary</h2>
            <button type="button" className="orderHistoryBtn" onClick={() => setShowOrderHistory(!showOrderHistory)} title="View recent orders">
              📋
            </button>
          </div>

          {/* Order History */}
          {showOrderHistory && (
            <div className="orderHistoryPanel">
              <h3>Recent Orders</h3>
              <div className="historyList">
                {recentOrders.map((order) => (
                  <div key={order.id} className="historyItem">
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <small>{order.time}</small>
                    </div>
                    <div>
                      <span className={`statusPill ${order.status.toLowerCase()}`}>{order.status}</span>
                      <b>{money(order.total)}</b>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="cartSection">
            <div className="cartMeta">
              <span className="cartCount">{totalQty} item{totalQty !== 1 ? "s" : ""}</span>
            </div>
            <div className="cartLines">
              {cartLines.length ? (
                cartLines.map((line) => (
                  <div key={line.item.id} className="cartLine">
                    <div className="cartLineInfo">
                      <strong>{line.item.name}</strong>
                      <span>{line.quantity} × {money(line.item.price)}</span>
                    </div>
                    <div className="cartLineActions">
                      <b>{money(line.item.price * line.quantity)}</b>
                      <button type="button" className="removeBtn" onClick={() => setQuantity(line.item, 0)}>✕</button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="emptyState">Select items to start billing</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="cartSummary">
            <div className="summaryRow">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="summaryRow">
              <span>Tax (5%)</span>
              <span>{money(subtotal * 0.05)}</span>
            </div>
            <div className="summaryTotal">
              <span>Total</span>
              <strong>{money(subtotal * 1.05)}</strong>
            </div>
          </div>

          {/* Payment Options */}
          <label className="formLabel">
            Payment Type
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="paymentSelect">
              <option value="CASH">💵 Cash</option>
              <option value="UPI">📱 UPI</option>
              <option value="CARD">💳 Card</option>
              <option value="WALLET">👛 Wallet</option>
              <option value="OTHER">❓ Other</option>
            </select>
          </label>

          {paymentMethod === "WALLET" && (
            <label className="formLabel">
              Customer Phone
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Enter phone number" />
            </label>
          )}

          <label className="formLabel">
            Payment Status
            <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)} className="paymentSelect">
              <option value="PAID">✓ Paid</option>
              <option value="UNPAID">✗ Unpaid</option>
              <option value="PARTIAL">⊘ Partial</option>
            </select>
          </label>

          {/* Action Buttons */}
          <div className="checkoutActions">
            {heldOrdersCount > 0 && (
              <button type="button" className="tertiaryButton holdRestoreBtn" onClick={onRestoreHold} title={`Restore 1 of ${heldOrdersCount} held orders`}>
                ↩️ Restore Hold ({heldOrdersCount})
              </button>
            )}
            <button type="button" className="tertiaryButton holdBtn" onClick={onHold} disabled={!cartLines.length} title="Save current order and start a new one">
              ⏸️ Hold Order
            </button>
            <button type="button" className="secondaryButton" onClick={resetOrder}>
              Reset
            </button>
            <button className="primaryButton submitBtn" disabled={loading || !cartLines.length}>
              {loading ? "Processing..." : "Submit Order"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function ReportsView({
  orders,
  items,
  setActiveView
}: {
  orders: Order[];
  items: MenuItem[];
  setActiveView: (view: View) => void;
}) {
  const report = useMemo(() => {
    const now = new Date();
    const todayKey = now.toDateString();
    const month = now.getMonth();
    const year = now.getFullYear();
    const revenueOrders = orders.filter((order) => order.status !== "CANCELLED" && order.status !== "REFUNDED");
    const paidOrders = revenueOrders.filter((order) => order.paymentStatus === "PAID");
    const todayRevenue = paidOrders
      .filter((order) => new Date(order.createdAt).toDateString() === todayKey)
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const monthlyRevenue = paidOrders
      .filter((order) => {
        const created = new Date(order.createdAt);
        return created.getMonth() === month && created.getFullYear() === year;
      })
      .reduce((sum, order) => sum + order.totalAmount, 0);
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const key = date.toDateString();
      return {
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        value: paidOrders
          .filter((order) => new Date(order.createdAt).toDateString() === key)
          .reduce((sum, order) => sum + order.totalAmount, 0)
      };
    });
    const statusData = statusFlow.concat(["CANCELLED", "REFUNDED"] as OrderStatus[]).map((status) => ({
      label: status,
      value: orders.filter((order) => order.status === status).length
    }));
    const paymentData = (["CASH", "UPI", "CARD", "WALLET", "CREDIT", "OTHER"] as PaymentMethod[]).map((method) => ({
      label: method,
      value: revenueOrders.filter((order) => order.paymentMethod === method).length
    }));
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    orders.forEach((order) => {
      order.items.forEach((line) => {
        const current = itemMap.get(line.name) ?? { name: line.name, quantity: 0, revenue: 0 };
        current.quantity += line.quantity;
        current.revenue += line.quantity * line.price;
        itemMap.set(line.name, current);
      });
    });

    return {
      todayRevenue,
      monthlyRevenue,
      paidOrders: paidOrders.length,
      averageOrder: paidOrders.length ? paidOrders.reduce((sum, order) => sum + order.totalAmount, 0) / paidOrders.length : 0,
      lastSevenDays,
      statusData,
      paymentData,
      topItems: Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 6)
    };
  }, [orders]);

  const exportOrders = () => {
    const headers = ["Order", "Date", "Status", "Payment Method", "Payment Status", "Subtotal", "Tax", "Total", "Items"];
    const rows = orders.map((order) => [
      order.orderNumber,
      new Date(order.createdAt).toISOString(),
      order.status,
      order.paymentMethod,
      order.paymentStatus,
      String(order.subtotal),
      String(order.taxAmount),
      String(order.totalAmount),
      order.items.map((item) => `${item.name} x ${item.quantity}`).join("; ")
    ]);
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `canteen-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="section">
      <div className="reportsHeader">
        <SectionHeading title="Reports" meta={`${orders.length} orders tracked`} />
        <div className="buttonGroup">
          <button className="secondaryButton" onClick={() => setActiveView("orders")}>View Orders</button>
          <button className="primaryButton" onClick={exportOrders}>Export CSV</button>
        </div>
      </div>
      <section className="metricGrid">
        <Metric label="Today's Paid Sales" value={money(report.todayRevenue)} tone="green" />
        <Metric label="Monthly Paid Sales" value={money(report.monthlyRevenue)} tone="blue" />
        <Metric label="Paid Orders" value={String(report.paidOrders)} tone="amber" />
        <Metric label="Average Order" value={money(report.averageOrder)} tone="red" />
      </section>
      <section className="reportGrid">
        <div className="chartCard wide">
          <SectionHeading title="7-Day Revenue" meta="Paid orders" />
          <BarChart data={report.lastSevenDays} moneyValues />
        </div>
        <div className="chartCard">
          <SectionHeading title="Payment Mix" meta="By method" />
          <BarChart data={report.paymentData} />
        </div>
        <div className="chartCard">
          <SectionHeading title="Order Status" meta="Queue health" />
          <BarChart data={report.statusData} />
        </div>
        <div className="chartCard">
          <SectionHeading title="Top Items" meta={`${items.length} menu items`} />
          <div className="list">
            {report.topItems.map((item) => (
              <div key={item.name} className="rowItem userRow">
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.quantity} sold</span>
                </div>
                <b>{money(item.revenue)}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function BarChart({ data, moneyValues = false }: { data: Array<{ label: string; value: number }>; moneyValues?: boolean }) {
  const max = Math.max(...data.map((entry) => entry.value), 1);
  return (
    <div className="barChart">
      {data.map((entry) => (
        <div key={entry.label} className="barRow">
          <span>{entry.label}</span>
          <div className="barTrack">
            <div className="barFill" style={{ width: `${Math.max((entry.value / max) * 100, entry.value ? 8 : 0)}%` }} />
          </div>
          <b>{moneyValues ? money(entry.value) : entry.value}</b>
        </div>
      ))}
    </div>
  );
}

const invoiceToggleFields: Array<{ key: keyof InvoiceSettings; label: string; hint: string }> = [
  { key: "invoiceShowLogo", label: "Show logo", hint: "Print the uploaded logo on receipts" },
  { key: "invoiceShowSchoolName", label: "Show school name", hint: "Display tenant/canteen name" },
  { key: "invoiceShowOrderNumber", label: "Show order number", hint: "Useful for reprints and disputes" },
  { key: "invoiceShowDate", label: "Show date", hint: "Receipt timestamp" },
  { key: "invoiceShowCashier", label: "Show cashier", hint: "Admin/cashier identifier" },
  { key: "invoiceShowPaymentDetails", label: "Show payment details", hint: "Method and payment status" },
  { key: "invoiceShowTaxBreakup", label: "Show tax breakup", hint: "Subtotal, tax, and total" },
  { key: "invoiceShowNotes", label: "Show notes", hint: "Kitchen/order notes when available" }
];

function InvoiceSettingsView({
  settings,
  uploading,
  onToggle,
  onUpload,
  onRemoveLogo
}: {
  settings: InvoiceSettings | null;
  uploading: boolean;
  onToggle: (patch: Partial<InvoiceSettings>) => void;
  onUpload: (file?: File) => void;
  onRemoveLogo: () => void;
}) {
  const [footerNote, setFooterNote] = useState("");

  useEffect(() => {
    setFooterNote(settings?.invoiceFooterNote ?? "");
  }, [settings?.invoiceFooterNote]);

  if (!settings) {
    return (
      <section className="section">
        <SectionHeading title="Invoice Settings" meta="Loading" />
        <p className="emptyState">Invoice settings will appear after admin data loads.</p>
      </section>
    );
  }

  return (
    <section className="invoiceLayout">
      <div className="section">
        <SectionHeading title="Invoice Settings" meta="Receipt controls" />
        <div className="invoiceLogoCard">
          <div>
            <strong>Receipt logo</strong>
            <span>PNG, JPG, JPEG, or WEBP. Backend limit is controlled by `INVOICE_LOGO_MAX_BYTES`.</span>
          </div>
          {settings.invoiceLogoUrl ? <img src={settings.invoiceLogoUrl} alt="Invoice logo" /> : <div className="logoPlaceholder">No logo</div>}
          <div className="buttonGroup">
            <label className="fileButton">
              {uploading ? "Uploading..." : "Upload Logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} />
            </label>
            {settings.invoiceLogoUrl ? (
              <button className="secondaryButton" onClick={onRemoveLogo}>Remove</button>
            ) : null}
          </div>
        </div>
        <div className="toggleGrid">
          {invoiceToggleFields.map((field) => {
            const checked = Boolean(settings[field.key]);
            return (
              <button
                key={field.key}
                className={`toggleCard ${checked ? "on" : ""}`}
                onClick={() => onToggle({ [field.key]: !checked } as Partial<InvoiceSettings>)}
              >
                <span>{field.label}</span>
                <small>{field.hint}</small>
                <b>{checked ? "On" : "Off"}</b>
              </button>
            );
          })}
        </div>
        <label>
          Footer Note
          <textarea value={footerNote} onChange={(event) => setFooterNote(event.target.value)} placeholder="Thank you message, support phone, etc." />
        </label>
        <button className="primaryButton narrow" onClick={() => onToggle({ invoiceFooterNote: footerNote })}>Save Footer Note</button>
      </div>
      <div className="invoicePreview">
        <SectionHeading title="Receipt Preview" meta="Live layout" />
        <div className="receiptPaper">
          {settings.invoiceShowLogo && settings.invoiceLogoUrl ? <img src={settings.invoiceLogoUrl} alt="Receipt logo preview" /> : null}
          {settings.invoiceShowSchoolName ? <h3>{settings.name}</h3> : null}
          {settings.invoiceShowOrderNumber ? <p>Order: ORD-2026-0001</p> : null}
          {settings.invoiceShowDate ? <p>Date: Today, 2:30 PM</p> : null}
          {settings.invoiceShowCashier ? <p>Cashier: Admin</p> : null}
          <hr />
          <div className="receiptLine"><span>Veg Sandwich x 2</span><b>{money(70)}</b></div>
          <div className="receiptLine"><span>Cold Coffee x 1</span><b>{money(45)}</b></div>
          {settings.invoiceShowTaxBreakup ? (
            <>
              <div className="receiptLine muted"><span>Subtotal</span><span>{money(115)}</span></div>
              <div className="receiptLine muted"><span>Tax</span><span>{money(5.75)}</span></div>
            </>
          ) : null}
          <div className="receiptLine total"><span>Total</span><b>{money(120.75)}</b></div>
          {settings.invoiceShowPaymentDetails ? <p>Payment: CASH - PAID</p> : null}
          {settings.invoiceShowNotes ? <p>Note: Less spicy</p> : null}
          {settings.invoiceFooterNote ? <footer>{settings.invoiceFooterNote}</footer> : null}
        </div>
      </div>
    </section>
  );
}

function DashboardView({
  dashboard,
  items,
  setActiveView,
  updateOrderStatus
}: {
  dashboard: ReturnType<typeof useDashboardShape>;
  items: MenuItem[];
  setActiveView: (view: View) => void;
  updateOrderStatus: (order: Order, status: OrderStatus) => void;
}) {
  const lowStockItems = items.filter((item) => item.stockQty <= item.lowStockThreshold);
  const availableItems = items.filter((item) => item.isAvailable);
  const itemCount = availableItems.length;
  
  return (
    <>
      {/* Header Section */}
      <div className="dashboardHeader">
        <div>
          <h1>📊 Dashboard</h1>
          <p className="dashboardHeaderSubtitle">Welcome back! Here's your canteen performance today.</p>
        </div>
        <div className="dashboardHeaderActions">
          <button className="primaryButton" onClick={() => setActiveView("pos")}>🚀 New Order</button>
        </div>
      </div>

      {/* Metric Cards */}
      <section className="metricGrid">
        <Metric label="Today's Sales" value={money(dashboard.todaySales)} tone="green" icon="💰" change="+12.5%" />
        <Metric label="Monthly Sales" value={money(dashboard.monthlySales)} tone="blue" icon="📈" change="This month" />
        <Metric label="Active Orders" value={String(dashboard.pending)} tone="amber" icon="⏳" change={`${dashboard.pending} pending`} />
        <Metric label="Menu Items" value={String(itemCount)} tone="purple" icon="📋" change={`${lowStockItems.length} low stock`} />
      </section>

      {/* Quick Actions */}
      <section className="quickActionsGrid">
        <div className="quickActionCard" onClick={() => setActiveView("orders")} style={{ cursor: "pointer" }}>
          <div className="quickActionIcon">📋</div>
          <div className="quickActionContent">
            <strong>View Orders</strong>
            <small>{dashboard.recent.length} recent orders</small>
          </div>
          <div className="quickActionArrow">→</div>
        </div>
        <div className="quickActionCard" onClick={() => setActiveView("menu")} style={{ cursor: "pointer" }}>
          <div className="quickActionIcon">🍽️</div>
          <div className="quickActionContent">
            <strong>Manage Menu</strong>
            <small>{itemCount} items available</small>
          </div>
          <div className="quickActionArrow">→</div>
        </div>
        <div className="quickActionCard" onClick={() => setActiveView("menu")} style={{ cursor: "pointer" }}>
          <div className="quickActionIcon">📦</div>
          <div className="quickActionContent">
            <strong>Stock Status</strong>
            <small>{lowStockItems.length} items low</small>
          </div>
          <div className="quickActionArrow">→</div>
        </div>
        <div className="quickActionCard" onClick={() => setActiveView("reports")} style={{ cursor: "pointer" }}>
          <div className="quickActionIcon">📊</div>
          <div className="quickActionContent">
            <strong>View Reports</strong>
            <small>Sales & analytics</small>
          </div>
          <div className="quickActionArrow">→</div>
        </div>
      </section>

      {/* Main Content */}
      <section className="dashboardSplitLayout">
        {/* Recent Orders */}
        <div className="dashboardSection">
          <div className="sectionHeaderWithAction">
            <SectionHeading title="Recent Orders" meta="Last 5" />
            <button className="textLink" onClick={() => setActiveView("orders")}>View All →</button>
          </div>
          {dashboard.recent.length > 0 ? (
            <>
              <OrdersTable orders={dashboard.recent} updateOrderStatus={updateOrderStatus} compact />
            </>
          ) : (
            <div className="emptyStateCard">
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
              <strong>No orders yet</strong>
              <small>Create your first order from the POS view</small>
            </div>
          )}
        </div>

        {/* Stock Attention */}
        <div className="dashboardSection">
          <div className="sectionHeaderWithAction">
            <SectionHeading title="Stock Attention" meta={`${lowStockItems.length} low`} />
            <button className="textLink" onClick={() => setActiveView("menu")}>Manage Stock →</button>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="stockList">
              {lowStockItems.slice(0, 8).map((item) => (
                <div key={item.id} className="stockCard">
                  <div className="stockCardInfo">
                    <strong>{item.name}</strong>
                    <span className="stockCardMeta">Stock: {item.stockQty} / {item.lowStockThreshold}</span>
                  </div>
                  <div className="stockProgress">
                    <div className="stockProgressBar">
                      <div
                        className="stockProgressFill"
                        style={{
                          width: `${Math.min(100, (item.stockQty / item.lowStockThreshold) * 100)}%`,
                          background: item.stockQty > item.lowStockThreshold * 0.5 ? "#059669" : "#f59e0b"
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyStateCard">
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
              <strong>All items well stocked</strong>
              <small>No items below threshold</small>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function useDashboardShape() {
  return {
    todaySales: 0,
    monthlySales: 0,
    pending: 0,
    lowStock: 0,
    hiddenItems: 0,
    recent: [] as Order[]
  };
}

function Metric({
  label,
  value,
  tone,
  icon,
  change
}: {
  label: string;
  value: string;
  tone: "green" | "blue" | "amber" | "red" | "purple";
  icon?: string;
  change?: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      {icon && <div className="metricIcon">{icon}</div>}
      <div className="metricContent">
        <span className="metricLabel">{label}</span>
        <strong className="metricValue">{value}</strong>
      </div>
      {change && <small className="metricChange">{change}</small>}
    </div>
  );
}

function OrdersTable({
  orders,
  updateOrderStatus,
  compact = false
}: {
  orders: Order[];
  updateOrderStatus: (order: Order, status: OrderStatus) => void;
  compact?: boolean;
}) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Status</th>
            <th>Total</th>
            {!compact ? <th>Payment</th> : null}
            <th>Next</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const currentIndex = statusFlow.indexOf(order.status);
            const nextStatus = statusFlow[currentIndex + 1];
            return (
              <tr key={order.id}>
                <td>
                  <strong>{order.orderNumber}</strong>
                  <small>{shortDate(order.createdAt)} {order.laneToken ? `· ${order.laneToken}` : ""}</small>
                </td>
                <td><span className="pill neutral">{order.status}</span></td>
                <td>{money(order.totalAmount)}</td>
                {!compact ? <td>{order.paymentMethod} · {order.paymentStatus}</td> : null}
                <td>
                  {nextStatus ? (
                    <button className="miniButton" onClick={() => updateOrderStatus(order, nextStatus)}>
                      {nextStatus}
                    </button>
                  ) : (
                    <span className="muted">Done</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MenuTable({
  items,
  categories,
  toggleItem,
  toggleSpecial
}: {
  items: MenuItem[];
  categories: Category[];
  toggleItem: (item: MenuItem) => void;
  toggleSpecial: (item: MenuItem) => void;
}) {
  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "Uncategorized";
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                <small>{item.description || "No description"}</small>
              </td>
              <td>{categoryName(item.categoryId)}</td>
              <td>{money(item.price)}</td>
              <td>{item.stockQty}</td>
              <td className="buttonGroup">
                <button className="miniButton" onClick={() => toggleSpecial(item)}>
                  {item.isTodaySpecial ? "Unfeature" : "Special"}
                </button>
                <button className="miniButton ghost" onClick={() => toggleItem(item)}>
                  {item.isAvailable ? "Hide" : "Show"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StockTable({ items, updateStock }: { items: MenuItem[]; updateStock: (item: MenuItem, stockQty: number) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Current</th>
            <th>Threshold</th>
            <th>New Stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name}</strong>
                <small>{item.stockQty <= item.lowStockThreshold ? "Needs attention" : "Healthy"}</small>
              </td>
              <td>{item.stockQty}</td>
              <td>{item.lowStockThreshold}</td>
              <td className="stockEdit">
                <input
                  value={drafts[item.id] ?? String(item.stockQty)}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  type="number"
                />
                <button className="miniButton" onClick={() => updateStock(item, Number(drafts[item.id] ?? item.stockQty))}>
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const globalCss = `
  :root {
    --bg: #f4f6f8;
    --surface: #ffffff;
    --line: #dfe5eb;
    --text: #111827;
    --muted: #657080;
    --primary: #163a5f;
    --primary-strong: #0d2238;
    --green: #0f8a63;
    --amber: #b76b00;
    --red: #b42318;
    --blue: #2458a8;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: var(--text);
    background: var(--bg);
  }
  button, input, select, textarea { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .62; }
  .loginShell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      linear-gradient(120deg, rgba(22, 58, 95, .09), transparent 35%),
      linear-gradient(180deg, #f8fafc, #edf1f5);
  }
  .loginPanel {
    width: min(980px, 100%);
    display: grid;
    grid-template-columns: 1.1fr .9fr;
    gap: 32px;
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 36px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, .08);
  }
  .loginPanel h1, .topbar h1 {
    margin: 0;
    font-size: 34px;
    letter-spacing: 0;
  }
  .eyebrow {
    margin: 0 0 6px;
    color: var(--primary);
    font-weight: 800;
    text-transform: uppercase;
    font-size: 12px;
  }
  .muted, small {
    color: var(--muted);
  }
  .form, .inlineForm, .formGrid {
    display: grid;
    gap: 12px;
  }
  label {
    display: grid;
    gap: 6px;
    color: #2d3748;
    font-weight: 700;
  }
  input, select, textarea {
    width: 100%;
    border: 1px solid #ccd6e0;
    border-radius: 6px;
    background: #fff;
    color: var(--text);
    padding: 11px 12px;
    outline: none;
  }
  textarea {
    resize: vertical;
    min-height: 96px;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(22, 58, 95, .12);
  }
  .appShell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 280px 1fr;
  }
  .sidebar {
    background: #fbfcfd;
    border-right: 1px solid var(--line);
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 0;
    height: 100vh;
    z-index: 99;
  }
  .sidebarHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .hamburger, .hamburgerMobile {
    display: none;
    flex-direction: column;
    gap: 6px;
    background: transparent;
    border: 0;
    padding: 4px;
    cursor: pointer;
  }
  .hamburger span, .hamburgerMobile span {
    width: 24px;
    height: 2.5px;
    background: var(--text);
    border-radius: 2px;
    transition: all .3s ease;
  }
  .brandBlock {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brandMark, .avatar {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--primary-strong);
    color: white;
    font-weight: 900;
  }
  .brandTitle, .brandSub {
    margin: 0;
  }
  .brandTitle {
    font-weight: 900;
    font-size: 18px;
  }
  .brandSub {
    color: var(--muted);
    font-size: 13px;
  }
  .navList {
    display: grid;
    gap: 6px;
  }
  .navItem {
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 10px 12px;
    display: grid;
    gap: 2px;
    transition: all .2s ease;
  }
  .navItem:hover {
    background: #f0f4f8;
  }
  .navItem span { font-weight: 800; }
  .navItem small { font-size: 12px; }
  .navItem.active {
    background: #e9f0f7;
    border-color: #cddbeb;
    color: var(--primary);
  }
  .workArea {
    min-width: 0;
    padding: 22px;
    overflow-y: auto;
  }
  .topbar {
    min-height: 76px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin-bottom: 18px;
  }
  .topbarActions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .primaryButton, .secondaryButton, .tertiaryButton, .ghostButton, .miniButton {
    border: 0;
    border-radius: 6px;
    padding: 11px 14px;
    font-weight: 800;
    transition: transform .12s ease, background .12s ease;
  }
  .primaryButton {
    background: var(--primary);
    color: white;
  }
  .primaryButton.danger {
    background: var(--red);
  }
  .primaryButton:hover, .secondaryButton:hover, .miniButton:hover { transform: translateY(-1px); }
  .secondaryButton {
    background: #e7edf3;
    color: var(--primary-strong);
  }
  .tertiaryButton {
    background: #f5f3ff;
    color: #7c3aed;
    font-weight: 700;
    border: 1px solid #e9d5ff;
  }
  .tertiaryButton:hover:not(:disabled) {
    background: #ede9fe;
    border-color: #ddd6fe;
  }
  .holdBtn, .holdRestoreBtn {
    font-size: 13px;
  }
  .holdRestoreBtn {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }
  .holdRestoreBtn:hover {
    background: #fcd34d;
  }
  .ghostButton {
    margin-top: auto;
    background: #f0f2f4;
    color: var(--red);
    width: 100%;
  }
  .miniButton {
    padding: 7px 10px;
    background: var(--primary);
    color: white;
    font-size: 12px;
  }
  .miniButton.ghost {
    background: #eef2f5;
    color: var(--text);
  }
  .narrow { width: fit-content; }
  .notice, .errorBox {
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 14px;
    font-weight: 700;
  }
  .notice { background: #e8f7ef; color: var(--green); border: 1px solid #c6ead6; }
  .errorBox, .errorText { color: var(--red); }
  .errorBox { background: #fff1ef; border: 1px solid #ffd0c9; }
  .metricGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }
  .metric {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 18px;
    display: grid;
    gap: 12px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  .metric::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, currentColor, transparent);
  }
  .metric:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.1);
  }
  .metricIcon {
    font-size: 28px;
  }
  .metric.green { color: var(--green); }
  .metric.blue { color: var(--blue); }
  .metric.amber { color: var(--amber); }
  .metric.red { color: var(--red); }
  .metric.purple { color: #7c3aed; }
  .metricLabel { 
    display: block;
    color: var(--muted); 
    font-weight: 700; 
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .metricValue { 
    display: block;
    font-size: 28px; 
    letter-spacing: -1px;
    font-weight: 900;
  }
  .metricChange {
    color: var(--muted);
    font-weight: 600;
    font-size: 12px;
  }
  .dashboardHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    padding: 0;
  }
  .dashboardHeader h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 900;
    letter-spacing: -1px;
  }
  .dashboardHeaderSubtitle {
    margin: 4px 0 0;
    color: var(--muted);
    font-weight: 600;
  }
  .dashboardHeaderActions {
    display: flex;
    gap: 10px;
  }
  .quickActionsGrid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 28px;
  }
  .quickActionCard {
    background: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%);
    border: 1px solid #e9d5ff;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s ease;
  }
  .quickActionCard:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(124, 58, 237, 0.15);
    border-color: #ddd6fe;
  }
  .quickActionIcon {
    font-size: 24px;
    flex-shrink: 0;
  }
  .quickActionContent {
    flex: 1;
    min-width: 0;
  }
  .quickActionContent strong {
    display: block;
    font-size: 14px;
    color: var(--text);
    margin-bottom: 2px;
  }
  .quickActionContent small {
    display: block;
    font-size: 12px;
    color: var(--muted);
  }
  .quickActionArrow {
    font-size: 18px;
    color: #7c3aed;
    font-weight: 700;
  }
  .dashboardSplitLayout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .dashboardSection {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 20px;
    display: grid;
    gap: 14px;
  }
  .sectionHeaderWithAction {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .textLink {
    background: none;
    border: none;
    color: #7c3aed;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
    padding: 0;
    transition: color 0.2s ease;
  }
  .textLink:hover {
    color: #6d28d9;
  }
  .stockList {
    display: grid;
    gap: 12px;
  }
  .stockCard {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    display: grid;
    gap: 8px;
  }
  .stockCardInfo {
    display: grid;
    gap: 2px;
  }
  .stockCard strong {
    font-size: 14px;
    color: var(--text);
  }
  .stockCardMeta {
    display: block;
    font-size: 12px;
    color: var(--muted);
  }
  .stockProgress {
    display: grid;
  }
  .stockProgressBar {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
  }
  .stockProgressFill {
    height: 100%;
    background: #059669;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .emptyStateCard {
    background: #f8fafc;
    border: 1px dashed #cbd5df;
    border-radius: 8px;
    padding: 32px;
    text-align: center;
    display: grid;
    gap: 8px;
    place-items: center;
    color: var(--muted);
  }
  .emptyStateCard strong {
    color: var(--text);
    display: block;
  }
  .emptyStateCard small {
    display: block;
    font-size: 13px;
  }
  .posLayout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 400px;
    gap: 20px;
    align-items: start;
  }
  .posItemSection {
    display: grid;
    gap: 16px;
    min-width: 0;
  }
  .posHeader {
    display: grid;
    gap: 12px;
  }
  .posSearchBox {
    position: relative;
    display: flex;
    align-items: center;
  }
  .searchIcon {
    position: absolute;
    left: 12px;
    font-size: 16px;
    pointer-events: none;
  }
  .posSearchInput {
    width: 100%;
    border: 2px solid #e0e7ff !important;
    border-radius: 10px !important;
    padding: 12px 12px 12px 38px !important;
    font-size: 15px;
    background: linear-gradient(135deg, #f5f7ff, #ffffff) !important;
    transition: all .3s ease;
  }
  .posSearchInput:focus {
    border-color: #7c3aed !important;
    box-shadow: 0 0 0 4px rgba(124, 58, 237, .1) !important;
  }
  .categoryTabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
  }
  .categoryTabs::-webkit-scrollbar {
    height: 4px;
  }
  .categoryTabs::-webkit-scrollbar-track {
    background: #f0f0f0;
    border-radius: 10px;
  }
  .categoryTabs::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  .categoryTab {
    flex-shrink: 0;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all .2s ease;
    white-space: nowrap;
    color: #666;
  }
  .categoryTab:hover {
    border-color: #7c3aed;
    color: #7c3aed;
  }
  .categoryTab.active {
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: white;
    border-color: #7c3aed;
  }
  .sectionLabel {
    margin: 12px 0 8px;
    font-size: 14px;
    font-weight: 800;
    color: #667085;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .favoritesSection {
    background: linear-gradient(135deg, #fef3c7, #fef08a);
    border: 2px solid #fcd34d;
    border-radius: 12px;
    padding: 14px;
  }
  .posItemGridCompact {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .posCardCompact {
    background: white;
    border: 2px solid #f0f0f0;
    border-radius: 10px;
    padding: 10px;
    display: grid;
    gap: 8px;
    cursor: pointer;
    transition: all .2s ease;
  }
  .posCardCompact:hover {
    border-color: #7c3aed;
    box-shadow: 0 4px 12px rgba(124, 58, 237, .1);
  }
  .posCardCompact.selected {
    border-color: #7c3aed;
    background: #f5f3ff;
  }
  .posCardHeader {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 6px;
  }
  .posCardHeader strong {
    font-size: 13px;
    line-height: 1.3;
    flex: 1;
  }
  .favoriteBtn {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    opacity: 0.6;
    transition: all .2s ease;
    flex-shrink: 0;
  }
  .favoriteBtn:hover, .favoriteBtn.active {
    opacity: 1;
    transform: scale(1.2);
  }
  .posCardQuick {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .posCardQuick span {
    font-weight: 800;
    color: #059669;
    font-size: 12px;
  }
  .qtyCompact {
    display: flex;
    gap: 4px;
    align-items: center;
    background: #f3f4f6;
    border-radius: 6px;
    padding: 2px;
  }
  .qtyCompact button {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
    transition: all .2s ease;
  }
  .qtyCompact button:hover {
    background: #7c3aed;
    color: white;
    border-color: #7c3aed;
  }
  .qtyCompact span {
    font-weight: 800;
    font-size: 12px;
    min-width: 20px;
    text-align: center;
  }
  .posItemGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
  }
  .posCard {
    overflow: hidden;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .04);
    cursor: pointer;
    transition: all .3s ease;
    position: relative;
  }
  .posCard:hover {
    transform: translateY(-4px);
    border-color: #7c3aed;
    box-shadow: 0 8px 24px rgba(124, 58, 237, .15);
  }
  .posCard.selected {
    border-color: #7c3aed;
    background: #f5f3ff;
    box-shadow: 0 12px 28px rgba(124, 58, 237, .2);
  }
  .posCard.special {
    border-color: #f59e0b;
  }
  .specialBadge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    z-index: 10;
  }
  .posImage {
    height: 140px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #f0f9ff, #eff6ff);
    color: #94a3b8;
    font-weight: 900;
    font-size: 32px;
    overflow: hidden;
  }
  .posImage img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .posCardBody {
    display: grid;
    gap: 10px;
    padding: 14px;
  }
  .posCardTitle {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 8px;
  }
  .posCardTitle strong {
    display: block;
    font-size: 14px;
    line-height: 1.3;
    flex: 1;
  }
  .categoryLabel {
    color: #7c3aed;
    font-size: 12px;
    font-weight: 700;
    display: block;
    margin-top: -4px;
  }
  .prepTime {
    color: #f59e0b;
    font-size: 12px;
    font-weight: 700;
    display: block;
    margin-top: -2px;
  }
  .posPriceRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid #f0f0f0;
  }
  .posPriceRow b {
    color: #059669;
    font-size: 16px;
  }
  .posPriceRow small {
    color: #999;
    font-size: 11px;
  }
  .qtyStepper {
    display: grid;
    grid-template-columns: 32px 1fr 32px;
    gap: 6px;
  }
  .qtyStepper button {
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    font-weight: 900;
    font-size: 16px;
    transition: all .2s ease;
    cursor: pointer;
  }
  .qtyStepper button:hover {
    border-color: #7c3aed;
    background: #f5f3ff;
    color: #7c3aed;
  }
  .qtyStepper input {
    text-align: center;
    padding: 8px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-weight: 800;
  }
  .checkoutSection {
    display: flex;
    flex-direction: column;
  }
  .checkoutPanel {
    position: sticky;
    top: 20px;
    display: grid;
    gap: 14px;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, .08);
  }
  .checkoutHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 2px solid #f0f0f0;
  }
  .checkoutHeader h2 {
    margin: 0;
    font-size: 18px;
  }
  .orderHistoryBtn {
    background: none;
    border: 2px solid #f0f0f0;
    border-radius: 8px;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    font-size: 16px;
    cursor: pointer;
    transition: all .2s ease;
  }
  .orderHistoryBtn:hover {
    border-color: #7c3aed;
    background: #f5f3ff;
  }
  .orderHistoryPanel {
    background: #f9fafb;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
    margin-top: 4px;
  }
  .orderHistoryPanel h3 {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 800;
    color: #666;
    text-transform: uppercase;
  }
  .historyList {
    display: grid;
    gap: 8px;
  }
  .historyItem {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .historyItem strong {
    display: block;
    font-size: 13px;
  }
  .historyItem small {
    display: block;
    font-size: 11px;
    color: #999;
  }
  .statusPill {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
    margin-right: 8px;
  }
  .statusPill.completed {
    background: #d1fae5;
    color: #065f46;
  }
  .statusPill.ready {
    background: #dbeafe;
    color: #0c4a6e;
  }
  .statusPill.preparing {
    background: #fef08a;
    color: #78350f;
  }
  .cartSection {
    background: #fafafa;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
  }
  .cartMeta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  .cartCount {
    font-size: 12px;
    font-weight: 800;
    color: #666;
    text-transform: uppercase;
  }
  .cartLines {
    display: grid;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }
  .cartLines::-webkit-scrollbar {
    width: 4px;
  }
  .cartLines::-webkit-scrollbar-track {
    background: transparent;
  }
  .cartLines::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
  .cartLine {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
  }
  .cartLineInfo {
    flex: 1;
    min-width: 0;
  }
  .cartLineInfo strong {
    display: block;
    font-size: 13px;
  }
  .cartLineInfo span {
    display: block;
    font-size: 11px;
    color: #999;
  }
  .cartLineActions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cartLineActions b {
    font-size: 13px;
    min-width: 50px;
    text-align: right;
  }
  .removeBtn {
    background: #fee2e2;
    border: none;
    border-radius: 6px;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    color: #dc2626;
    font-weight: 800;
    cursor: pointer;
    transition: all .2s ease;
  }
  .removeBtn:hover {
    background: #fecaca;
  }
  .cartSummary {
    display: grid;
    gap: 8px;
    padding-top: 12px;
    border-top: 2px solid #e5e7eb;
  }
  .summaryRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: #666;
  }
  .summaryTotal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
    border: 2px solid #6ee7b7;
    border-radius: 10px;
    padding: 12px;
    margin-top: 4px;
  }
  .summaryTotal span {
    font-weight: 700;
    color: #065f46;
  }
  .summaryTotal strong {
    font-size: 20px;
    color: #059669;
  }
  .formLabel {
    display: grid;
    gap: 6px;
    color: #2d3748;
    font-weight: 700;
    font-size: 13px;
  }
  .paymentSelect {
    border: 2px solid #e5e7eb !important;
    border-radius: 8px !important;
    padding: 10px 12px !important;
    background: white !important;
    cursor: pointer;
  }
  .checkoutActions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .submitBtn {
    background: linear-gradient(135deg, #7c3aed, #6d28d9) !important;
    font-size: 14px;
    font-weight: 800;
  }
  .submitBtn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(124, 58, 237, .3);
  }
  .emptyState {
    margin: 0;
    color: var(--muted);
    border: 1px dashed #cbd5df;
    border-radius: 10px;
    padding: 14px;
    background: #f8fafc;
  }
  .splitLayout {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr);
    gap: 14px;
  }
  .splitLayout.compact {
    grid-template-columns: 380px minmax(0, 1fr);
  }
  .section {
    background: transparent;
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .sectionHeading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .sectionHeading h2 {
    margin: 0;
    font-size: 22px;
  }
  .sectionHeading span {
    color: var(--muted);
    font-weight: 800;
  }
  .inlineForm {
    grid-template-columns: minmax(150px, 1fr) minmax(180px, 1.5fr) auto;
  }
  .formGrid {
    grid-template-columns: repeat(4, minmax(120px, 1fr)) auto;
  }
  .tableWrap {
    overflow: auto;
    background: white;
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 680px;
  }
  th, td {
    padding: 12px;
    border-bottom: 1px solid #edf1f5;
    text-align: left;
    vertical-align: middle;
  }
  th {
    color: #3c4654;
    font-size: 12px;
    text-transform: uppercase;
    background: #f8fafc;
  }
  td strong, td small {
    display: block;
  }
  .buttonGroup, .stockEdit {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .stockEdit input {
    width: 90px;
    padding: 8px;
  }
  .list {
    display: grid;
    gap: 8px;
  }
  .rowItem {
    background: white;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px;
    display: grid;
    gap: 3px;
    transition: all .2s ease;
  }
  .rowItem:hover {
    border-color: var(--primary);
    box-shadow: 0 4px 12px rgba(22, 58, 95, .08);
  }
  .userRow {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    min-height: 24px;
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 12px;
    font-weight: 900;
  }
  .neutral { color: var(--primary); background: #e9f0f7; }
  .success { color: var(--green); background: #e7f7ee; }
  .warning { color: var(--amber); background: #fff3df; }
  .danger { color: var(--red); background: #fff0ee; }
  .mutedPill { color: var(--muted); background: #edf1f5; }
  .bannerGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }
  .bannerItem {
    background: white;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px;
    display: grid;
    gap: 8px;
    transition: all .2s ease;
  }
  .bannerItem:hover {
    border-color: var(--primary);
    box-shadow: 0 8px 20px rgba(22, 58, 95, .08);
  }
  .bannerItem img {
    width: 100%;
    aspect-ratio: 16 / 7;
    object-fit: cover;
    border-radius: 6px;
    background: #eef2f5;
  }
  .reportsHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
  }
  .reportGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .chartCard {
    display: grid;
    gap: 14px;
    background: white;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 12px 32px rgba(15, 23, 42, .05);
  }
  .chartCard.wide {
    grid-column: 1 / -1;
  }
  .barChart {
    display: grid;
    gap: 10px;
  }
  .barRow {
    display: grid;
    grid-template-columns: 112px minmax(140px, 1fr) 96px;
    align-items: center;
    gap: 10px;
  }
  .barRow span {
    color: #344054;
    font-weight: 800;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .barRow b {
    text-align: right;
    font-size: 13px;
  }
  .barTrack {
    height: 12px;
    overflow: hidden;
    background: #edf2f7;
    border-radius: 999px;
  }
  .barFill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--primary), #3b82f6);
  }
  .invoiceLayout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 16px;
    align-items: start;
  }
  .invoiceLogoCard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 140px;
    gap: 12px;
    align-items: center;
    background: white;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px;
  }
  .invoiceLogoCard span {
    display: block;
    color: var(--muted);
    margin-top: 4px;
    line-height: 1.4;
  }
  .invoiceLogoCard img, .logoPlaceholder {
    width: 140px;
    height: 90px;
    border-radius: 10px;
    object-fit: contain;
    background: #f3f6f9;
    border: 1px solid #e1e7ee;
  }
  .logoPlaceholder {
    display: grid;
    place-items: center;
    color: var(--muted);
    font-weight: 900;
  }
  .fileButton {
    width: fit-content;
    border: 0;
    border-radius: 6px;
    padding: 11px 14px;
    font-weight: 800;
    color: white;
    background: var(--primary);
    cursor: pointer;
  }
  .fileButton input {
    display: none;
  }
  .toggleGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .toggleCard {
    position: relative;
    display: grid;
    gap: 4px;
    min-height: 92px;
    text-align: left;
    background: white;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px 72px 14px 14px;
    transition: all .2s ease;
    cursor: pointer;
  }
  .toggleCard:hover {
    border-color: #a0d1d5;
  }
  .toggleCard.on {
    border-color: #b9e7cd;
    background: #f4fbf7;
  }
  .toggleCard span {
    font-weight: 900;
  }
  .toggleCard small {
    line-height: 1.35;
  }
  .toggleCard b {
    position: absolute;
    right: 14px;
    top: 14px;
    border-radius: 999px;
    padding: 4px 9px;
    background: #edf1f5;
    color: var(--muted);
    font-size: 12px;
  }
  .toggleCard.on b {
    color: var(--green);
    background: #dff7eb;
  }
  .invoicePreview {
    position: sticky;
    top: 18px;
    display: grid;
    gap: 12px;
  }
  .receiptPaper {
    background: white;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 24px 64px rgba(15, 23, 42, .1);
  }
  .receiptPaper img {
    display: block;
    max-width: 110px;
    max-height: 70px;
    object-fit: contain;
    margin: 0 auto 12px;
  }
  .receiptPaper h3 {
    margin: 0 0 8px;
    text-align: center;
  }
  .receiptPaper p {
    margin: 5px 0;
    color: #465160;
    font-size: 13px;
  }
  .receiptPaper hr {
    border: 0;
    border-top: 1px dashed #cbd5df;
    margin: 12px 0;
  }
  .receiptLine {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0;
  }
  .receiptLine.total {
    border-top: 1px solid #edf1f5;
    padding-top: 10px;
    font-size: 18px;
  }
  .receiptPaper footer {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px dashed #cbd5df;
    color: var(--muted);
    text-align: center;
    font-size: 13px;
  }
  .modalOverlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 1000;
    animation: fadeIn .2s ease;
  }
  .modalContent {
    background: white;
    border-radius: 12px;
    padding: 28px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 28px 72px rgba(0, 0, 0, .2);
    animation: slideUp .3s ease;
  }
  .modalContent h2 {
    margin: 0 0 8px;
    font-size: 20px;
  }
  .modalContent p {
    margin: 0 0 20px;
    color: var(--muted);
    line-height: 1.5;
  }
  .modalActions {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 10px;
  }
  .sidebarBackdrop {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 98;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (max-width: 1000px) {
    .appShell { grid-template-columns: 1fr; }
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      transform: translateX(-100%);
      transition: transform .3s ease;
      box-shadow: 2px 0 8px rgba(0, 0, 0, .15);
    }
    .sidebar.open {
      transform: translateX(0);
    }
    .hamburger {
      display: flex;
    }
    .sidebarBackdrop {
      display: block;
    }
    .sidebarBackdrop.hidden {
      display: none;
    }
    .navList { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    .metricGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .quickActionsGrid { grid-template-columns: repeat(2, 1fr); }
    .dashboardSplitLayout { grid-template-columns: 1fr; }
    .splitLayout, .splitLayout.compact, .invoiceLayout { grid-template-columns: 1fr; }
    .posLayout { grid-template-columns: 1fr; gap: 14px; }
    .posItemGrid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
    .checkoutPanel, .invoicePreview { position: static; }
    .formGrid, .inlineForm { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .loginPanel { grid-template-columns: 1fr; padding: 22px; }
    .workArea { padding: 14px; }
    .topbar {
      align-items: center;
      gap: 12px;
      min-height: 60px;
    }
    .topbar > div {
      flex: 1;
      min-width: 0;
    }
    .topbar h1 {
      font-size: 20px;
      margin: 0;
    }
    .hamburgerMobile {
      display: flex;
      order: -1;
    }
    .topbarActions {
      gap: 8px;
    }
    .topbarActions .secondaryButton {
      display: none;
    }
    .metricGrid { grid-template-columns: 1fr; }
    .quickActionsGrid { grid-template-columns: 1fr; }
    .dashboardSplitLayout { grid-template-columns: 1fr; }
    .dashboardHeader { flex-direction: column; align-items: flex-start; gap: 14px; }
    .dashboardHeader h1 { font-size: 24px; }
    .reportGrid, .toggleGrid { grid-template-columns: 1fr; }
    .barRow { grid-template-columns: 70px 1fr 70px; }
    .invoiceLogoCard { grid-template-columns: 1fr; }
    .posItemGrid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .posItemGridCompact { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .posCard, .rowItem { padding: 10px; }
    .qtyStepper button {
      padding: 8px;
      font-size: 14px;
    }
    .checkoutActions {
      grid-template-columns: 1fr;
    }
    .splitLayout.compact {
      grid-template-columns: 1fr;
    }
    .inlineForm {
      grid-template-columns: 1fr;
    }
    .categoryTabs {
      gap: 6px;
    }
    .categoryTab {
      padding: 6px 12px;
      font-size: 12px;
    }
    .checkoutPanel {
      padding: 16px;
    }
  }
`;
