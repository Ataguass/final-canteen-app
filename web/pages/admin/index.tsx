import Head from "next/head";
import { FormEvent, JSX, useEffect, useMemo, useState } from "react";
import * as Recharts from "recharts";
const { AreaChart, Area, BarChart: RBarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = Recharts;

import { initializeApp, getApps } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";

const firebaseConfig = {
  apiKey: "AIzaSyC9_diUOG7TTC54S81pyzeQ2qlVUgHouHc",
  authDomain: "canteen-management-app-5a922.firebaseapp.com",
  projectId: "canteen-management-app-5a922",
  storageBucket: "canteen-management-app-5a922.firebasestorage.app",
  messagingSenderId: "584881360124",
  appId: "1:584881360124:web:1234567890abcdef"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

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

type Tenant = {
  id: string;
  name: string;
  slug: string;
  schoolCode: string;
  createdAt: string;
  users?: Array<{ id: string; name: string; phone: string; isActive: boolean; role?: string }>;
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

type CommunityPost = {
  id: string;
  title: string;
  body: string;
  mediaUrl?: string | null;
  isPinned: boolean;
  isVisible: boolean;
  createdAt: string;
  author?: { name: string; role: string } | null;
};

type WalletUser = {
  id: string;
  name: string;
  phone?: string | null;
  role: string;
  walletBalance: number;
};

type GlobalStats = {
  totalSchools: number;
  totalAdmins: number;
  totalStudents: number;
  totalRevenue: number;
};

type View = "dashboard" | "pos" | "orders" | "menu" | "stock" | "reports" | "users" | "banners" | "invoice" | "backups" | "community" | "wallet" | "qr-codes" | "schools";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const sessionKey = "canteen-web-admin-session";

const statusFlow: OrderStatus[] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED"];
const navIcons: Record<string, JSX.Element> = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  pos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  orders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
  menu: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  stock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  reports: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  banners: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>,
  invoice: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  backups: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  community: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  wallet: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/></svg>,
  "qr-codes": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="7" y="7" width="3" height="3"/><rect x="14" y="7" width="3" height="3"/><rect x="7" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>,
  schools: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
};

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
  { id: "backups", label: "Backups", hint: "Download and restore data" },
  { id: "community", label: "Community", hint: "Announcements and posts" },
  { id: "wallet", label: "Wallets", hint: "Teacher and staff wallet top-up" },
  { id: "qr-codes", label: "QR Codes", hint: "Print table ordering stickers" },
  { id: "schools", label: "Schools", hint: "Manage canteen tenants (Super Admin)" }
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

  // Forgot password state
  const [authMode, setAuthMode] = useState<"LOGIN" | "FORGOT" | "OTP" | "NEW_PASS">("LOGIN");
  const [resetMethod, setResetMethod] = useState<"email" | "phone">("email");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetFirebaseToken, setResetFirebaseToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [walletUsers, setWalletUsers] = useState<WalletUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [schoolSlug, setSchoolSlug] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolAdminName, setSchoolAdminName] = useState("");
  const [schoolAdminPhone, setSchoolAdminPhone] = useState("");
  const [schoolAdminPassword, setSchoolAdminPassword] = useState("");
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

  // Community form
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");

  // Wallet topup form
  const [topupUserId, setTopupUserId] = useState("");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState("");
  const [uploadingCategoryImage, setUploadingCategoryImage] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [uploadingItemImage, setUploadingItemImage] = useState(false);

  // Edit state – categories
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");
  const [editCatImage, setEditCatImage] = useState("");
  const [uploadingEditCatImage, setUploadingEditCatImage] = useState(false);

  // Edit state – items
  const [editingAdmin, setEditingAdmin] = useState<{ id: string, name: string, phone: string, password?: string } | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [editItemStock, setEditItemStock] = useState("");
  const [editItemCategoryId, setEditItemCategoryId] = useState("");
  const [editItemImage, setEditItemImage] = useState("");
  const [uploadingEditItemImage, setUploadingEditItemImage] = useState(false);
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

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    try {
      setLoading(true);
      await api(`/users/admin/${editingAdmin.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingAdmin.name,
          phone: editingAdmin.phone,
          password: editingAdmin.password || undefined
        })
      });
      setNotice("Admin updated successfully");
      setEditingAdmin(null);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update admin");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdminStatus = async (adminId: string, isActive: boolean) => {
    try {
      setLoading(true);
      await api(`/users/admin/${adminId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      });
      setNotice(`Admin ${isActive ? "activated" : "suspended"} successfully`);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle admin status");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!window.confirm("Are you sure you want to delete this admin? This cannot be undone.")) return;
    try {
      setLoading(true);
      await api(`/users/admin/${adminId}`, { method: "DELETE" });
      setNotice("Admin deleted successfully");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete admin");
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    if (!token || !tenantId) return;
    setLoading(true);
    setError("");
    try {
      const [orderRes, categoryRes, itemRes, userRes, bannerRes, backupRes, invoiceRes, communityRes, walletRes, tenantsRes, globalStatsRes] = await Promise.all([
        api<{ data: Order[] }>("/orders"),
        api<{ data: Category[] }>("/menu/categories"),
        api<{ data: MenuItem[] }>("/menu/items?includeAll=true"),
        api<{ data: ManagedUser[] }>("/users"),
        api<{ data: Banner[] }>("/banners?includeInactive=true"),
        api<{ data: Backup[] }>("/backups/me"),
        api<{ data: InvoiceSettings }>("/tenants/me/invoice-settings"),
        api<{ data: CommunityPost[] }>("/community/posts").catch(() => ({ data: [] as CommunityPost[] })),
        api<{ data: WalletUser[] }>("/users/wallets").catch(() => ({ data: [] as WalletUser[] })),
        api<{ data: Tenant[] }>("/tenants").catch(() => ({ data: [] as Tenant[] })),
        session?.user.role === "SUPER_ADMIN" ? api<{ data: GlobalStats }>("/tenants/stats").catch(() => ({ data: null })) : Promise.resolve({ data: null })
      ]);
      setOrders(orderRes.data);
      setCategories(categoryRes.data);
      setItems(itemRes.data);
      setUsers(userRes.data);
      setBanners(bannerRes.data);
      setBackups(backupRes.data);
      setInvoiceSettings(invoiceRes.data);
      setCommunityPosts(communityRes.data);
      setWalletUsers(walletRes.data);
      setTenants(tenantsRes.data);
      setGlobalStats((globalStatsRes as { data: GlobalStats | null }).data);
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
          if (parsed.user.role === "SUPER_ADMIN") {
            setActiveView("dashboard");
          }
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

  // Auto-refresh every 30 seconds when on dashboard
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      loadAll().catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [session]);

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

  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!resetIdentifier) return;
    
    const trimmed = resetIdentifier.trim();
    const isEmail = trimmed.includes("@");
    setResetMethod(isEmail ? "email" : "phone");

    setLoading(true);
    try {
      if (isEmail) {
        await fetch(`${apiBaseUrl}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: trimmed, method: "email" })
        });
        setAuthMode("OTP");
        setNotice("If the email is registered, an OTP has been sent.");
      } else {
        let formattedPhone = trimmed.replace(/\\s+/g, "");
        if (!formattedPhone.startsWith("+")) formattedPhone = `+91${formattedPhone}`;
        
        if (!(window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible"
          });
        }
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, (window as any).recaptchaVerifier);
        setConfirmationResult(confirmation);
        setAuthMode("OTP");
        setNotice("An OTP has been sent to your phone.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    
    if (resetMethod === "phone") {
      if (!confirmationResult) {
        setError("Session missing. Try again.");
        return;
      }
      setLoading(true);
      try {
        const credential = await confirmationResult.confirm(resetOtp);
        if (credential && credential.user) {
          const idToken = await credential.user.getIdToken();
          setResetFirebaseToken(idToken);
          setAuthMode("NEW_PASS");
        }
      } catch (err) {
        setError("Invalid OTP");
      } finally {
        setLoading(false);
      }
    } else {
      setAuthMode("NEW_PASS");
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: resetIdentifier.trim(),
          method: resetMethod,
          token: resetMethod === "phone" ? resetFirebaseToken : resetOtp,
          newPassword
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Reset failed");
      
      setNotice("Password reset successfully. You can now log in.");
      setAuthMode("LOGIN");
      setResetIdentifier("");
      setResetOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const isEmail = loginIdentifier.includes("@");
      const tenantInput = "ataguas";
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
          phone: loginIdentifier.trim(),
          password: loginPassword,
          isAdminLogin: true
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
      if (nextSession.user.role === "SUPER_ADMIN") {
        setActiveView("schools");
      } else {
        setActiveView("dashboard");
      }
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
        setTenants([]);
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
        body: JSON.stringify({ name: categoryName, description: categoryDescription, imageUrl: categoryImageUrl || undefined })
      });
      setCategoryName("");
      setCategoryDescription("");
      setCategoryImageUrl("");
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
          stockQty: Number(itemStock || 0),
          image: itemImageUrl || undefined
        })
      });
      setItemName("");
      setItemPrice("");
      setItemStock("");
      setItemImageUrl("");
    });
  };

  // ── Open edit dialogs ──────────────────────────────────────────────────────
  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description ?? "");
    setEditCatImage(cat.imageUrl ?? "");
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemPrice(String(item.price));
    setEditItemStock(String(item.stockQty));
    setEditItemCategoryId(item.categoryId);
    setEditItemImage(item.image ?? "");
  };

  // ── Save edits ─────────────────────────────────────────────────────────────
  const saveCategory = (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategory) return;
    mutate("Category updated", async () => {
      await api(`/menu/categories/${editingCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editCatName,
          description: editCatDesc || undefined,
          imageUrl: editCatImage || undefined
        })
      });
      setEditingCategory(null);
    });
  };

  const saveItem = (event: FormEvent) => {
    event.preventDefault();
    if (!editingItem) return;
    mutate("Item updated", async () => {
      await api(`/menu/items/${editingItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editItemName,
          price: Number(editItemPrice),
          stockQty: Number(editItemStock || 0),
          categoryId: editItemCategoryId,
          image: editItemImage || undefined
        })
      });
      setEditingItem(null);
    });
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteCategory = (cat: Category) => {
    setConfirmAction({
      title: "Delete Category?",
      message: `"${cat.name}" and all its items will be permanently deleted. This cannot be undone.`,
      onConfirm: () => {
        setConfirmAction(null);
        mutate("Category deleted", () => api(`/menu/categories/${cat.id}`, { method: "DELETE" }));
      }
    });
  };

  const deleteItem = (item: MenuItem) => {
    setConfirmAction({
      title: "Delete Item?",
      message: `"${item.name}" will be permanently deleted.`,
      onConfirm: () => {
        setConfirmAction(null);
        mutate("Item deleted", () => api(`/menu/items/${item.id}`, { method: "DELETE" }));
      }
    });
  };

  // ── Edit-modal image upload ────────────────────────────────────────────────
  const uploadEditCatImage = async (file?: File) => {
    if (!file) return;
    setUploadingEditCatImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api<{ data: { imageUrl: string } }>("/menu/upload-image", {
        method: "POST",
        body: JSON.stringify({ dataUrl, target: "CATEGORY" })
      });
      setEditCatImage(res.data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingEditCatImage(false);
    }
  };

  const uploadEditItemImage = async (file?: File) => {
    if (!file) return;
    setUploadingEditItemImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api<{ data: { imageUrl: string } }>("/menu/upload-image", {
        method: "POST",
        body: JSON.stringify({ dataUrl, target: "ITEM" })
      });
      setEditItemImage(res.data.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingEditItemImage(false);
    }
  };

  const uploadMenuImage = async (file: File | undefined, target: "ITEM" | "CATEGORY") => {
    if (!file) return;
    const setUploading = target === "CATEGORY" ? setUploadingCategoryImage : setUploadingItemImage;
    const setUrl = target === "CATEGORY" ? setCategoryImageUrl : setItemImageUrl;
    setUploading(true);
    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await api<{ data: { imageUrl: string } }>("/menu/upload-image", {
        method: "POST",
        body: JSON.stringify({ dataUrl, target })
      });
      setUrl(response.data.imageUrl);
      setNotice(`${target === "CATEGORY" ? "Category" : "Item"} image uploaded`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
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

  const createSchool = (event: FormEvent) => {
    event.preventDefault();
    mutate("School created", async () => {
      await api("/tenants/dashboard", {
        method: "POST",
        body: JSON.stringify({
          name: schoolName,
          slug: schoolSlug,
          schoolCode: schoolCode || undefined,
          adminName: schoolAdminName,
          adminPhone: schoolAdminPhone,
          adminPassword: schoolAdminPassword
        })
      });
      setSchoolName("");
      setSchoolSlug("");
      setSchoolCode("");
      setSchoolAdminName("");
      setSchoolAdminPhone("");
      setSchoolAdminPassword("");
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

  const restoreBackup = (backup: Backup) => {
    setConfirmAction({
      title: "⚠️ Restore Backup?",
      message: `This will REPLACE all current data (menu, orders, users) with the backup from ${shortDate(backup.createdAt)}. This cannot be undone. Are you sure?`,
      onConfirm: () => {
        setConfirmAction(null);
        mutate("Backup restored successfully", async () => {
          await api("/backups/me/restore", {
            method: "POST",
            body: JSON.stringify({ backupId: backup.id })
          });
        });
      }
    });
  };

  const deleteBackupFile = (backup: Backup) => {
    setConfirmAction({
      title: "Delete Backup?",
      message: `Permanently delete backup from ${shortDate(backup.createdAt)} (${(backup.sizeBytes / 1024).toFixed(1)} KB)? This cannot be undone.`,
      onConfirm: () => {
        setConfirmAction(null);
        mutate("Backup deleted", async () => {
          await api(`/backups/me/${backup.id}`, { method: "DELETE" });
        });
      }
    });
  };

  if (!session) {
    return (
      <>
        <Head>
          <title>Canteen Admin Web</title>
        </Head>
        <main className="loginShell">
          <section className="loginPanel">
            <div className="loginLeftPanel">
              <img src="/canteen_logo_final.png" alt="Canteen Logo" className="loginLogo" />
              <p className="eyebrow">Canteen Admin</p>
              {authMode === "LOGIN" ? (
                <>
                  <h1>Operations console</h1>
                  <p className="muted">Manage orders, menu, stock, users, banners, and backups from a browser.</p>
                </>
              ) : authMode === "FORGOT" ? (
                <>
                  <h1>Reset Password</h1>
                  <p className="muted">Enter your email or phone number to receive a reset code.</p>
                </>
              ) : authMode === "OTP" ? (
                <>
                  <h1>Verify Code</h1>
                  <p className="muted">Enter the 6-digit code sent to {resetIdentifier}.</p>
                </>
              ) : (
                <>
                  <h1>New Password</h1>
                  <p className="muted">Set a new password for your account.</p>
                </>
              )}
            </div>

            {authMode === "LOGIN" && (
              <form onSubmit={handleLogin} className="form">
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
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => { setAuthMode("FORGOT"); setError(""); setNotice(""); }} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 14, cursor: "pointer", padding: 0 }}>Forgot Password?</button>
                </div>
                {error ? <p className="errorText">{error}</p> : null}
                {notice ? <div style={{ color: "green", fontSize: 14, marginTop: 4 }}>{notice}</div> : null}
                <button disabled={loading} className="primaryButton">{loading ? "Signing in..." : "Sign in"}</button>
              </form>
            )}

            {authMode === "FORGOT" && (
              <form onSubmit={handleForgotPassword} className="form">
                <label>
                  Phone or Email
                  <input value={resetIdentifier} onChange={(event) => setResetIdentifier(event.target.value)} required />
                </label>
                {error ? <p className="errorText">{error}</p> : null}
                {notice ? <div style={{ color: "green", fontSize: 14, marginTop: 4 }}>{notice}</div> : null}
                <button disabled={loading} className="primaryButton">{loading ? "Sending..." : "Send Reset Code"}</button>
                <button type="button" onClick={() => { setAuthMode("LOGIN"); setError(""); setNotice(""); }} className="ghostButton" style={{ marginTop: 8, justifyContent: "center" }}>Back to Login</button>
              </form>
            )}

            {authMode === "OTP" && (
              <form onSubmit={handleVerifyOtp} className="form">
                <label>
                  6-Digit OTP
                  <input value={resetOtp} onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required pattern="\d{6}" title="6-digit code" />
                </label>
                {error ? <p className="errorText">{error}</p> : null}
                {notice ? <div style={{ color: "green", fontSize: 14, marginTop: 4 }}>{notice}</div> : null}
                <button disabled={loading} className="primaryButton">{loading ? "Verifying..." : "Verify Code"}</button>
                <button type="button" onClick={() => { setAuthMode("FORGOT"); setError(""); setNotice(""); }} className="ghostButton" style={{ marginTop: 8, justifyContent: "center" }}>Back</button>
              </form>
            )}

            {authMode === "NEW_PASS" && (
              <form onSubmit={handleResetPassword} className="form">
                <label>
                  New Password
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={6} />
                </label>
                <label>
                  Confirm Password
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
                </label>
                {error ? <p className="errorText">{error}</p> : null}
                {notice ? <div style={{ color: "green", fontSize: 14, marginTop: 4 }}>{notice}</div> : null}
                <button disabled={loading} className="primaryButton">{loading ? "Updating..." : "Update Password"}</button>
                <button type="button" onClick={() => { setAuthMode("LOGIN"); setError(""); setNotice(""); }} className="ghostButton" style={{ marginTop: 8, justifyContent: "center" }}>Cancel</button>
              </form>
            )}
            
            <div id="recaptcha-container"></div>
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
      <main className={`appShell ${sidebarCollapsed ? "sidebarCollapsed" : ""}`}>
        <aside className={`sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
          {/* Brand header */}
          <div className="sidebarHeader">
            <div className="brandBlock">
              <div className="brandMark">
                <img src="/canteen_logo_final.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "10px" }} />
              </div>
              {!sidebarCollapsed && (
                <div className="brandText">
                  <p className="brandTitle">Canteen</p>
                  <p className="brandSub">Admin Panel</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="navList">
            {views.filter(view => session?.user.role === "SUPER_ADMIN" ? (view.id === "dashboard" || view.id === "schools") : view.id !== "schools").map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  setActiveView(view.id);
                  setSidebarOpen(false);
                }}
                className={`navItem ${activeView === view.id ? "active" : ""}`}
                title={sidebarCollapsed ? `${view.label} — ${view.hint}` : undefined}
              >
                <span className="navIcon">{navIcons[view.id]}</span>
                {!sidebarCollapsed && (
                  <span className="navText">
                    <span className="navLabel">{view.label}</span>
                    <small className="navHint">{view.hint}</small>
                  </span>
                )}
                {activeView === view.id && !sidebarCollapsed && <span className="navActiveDot" />}
              </button>
            ))}
          </nav>

          {/* Collapse toggle — desktop only */}
          <button
            className="collapseToggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed
                ? <><polyline points="9 18 15 12 9 6"/><polyline points="15 18 21 12 15 6"/></>
                : <><polyline points="15 18 9 12 15 6"/><polyline points="9 18 3 12 9 6"/>
              </>}
            </svg>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>

          {/* Logout */}
          <button className="ghostButton" onClick={logout} title={sidebarCollapsed ? "Logout" : undefined}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </aside>

        <section className="workArea">
          <header className="topbar">
            {/* Mobile hamburger */}
            <button className="hamburgerMobile" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Page title */}
            <div className="topbarTitle">
              <div className="topbarBreadcrumb">{session.user.role}</div>
              <h1>{views.find((view) => view.id === activeView)?.label}</h1>
            </div>

            {/* Actions */}
            <div className="topbarActions">
              <button onClick={loadAll} className="topbarRefreshBtn" disabled={loading} title="Refresh data">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                <span>{loading ? "Syncing..." : "Refresh"}</span>
              </button>
              <div className="topbarUser">
                <div className="avatar">{session.user.name.charAt(0).toUpperCase()}</div>
                <div className="topbarUserInfo">
                  <span className="topbarUserName">{session.user.name}</span>
                  <span className="topbarUserRole">{session.user.role}</span>
                </div>
              </div>
            </div>
          </header>

          {notice ? <div className="notice">{notice}</div> : null}
          {error ? <div className="errorBox">{error}</div> : null}

          {activeView === "dashboard" && session?.user.role !== "SUPER_ADMIN" ? (
            <DashboardView dashboard={dashboard} items={items} orders={orders} setActiveView={setActiveView} updateOrderStatus={updateOrderStatus} />
          ) : null}

          {activeView === "dashboard" && session?.user.role === "SUPER_ADMIN" ? (
            <section className="section">
              <SectionHeading title="Global Overview" meta="Super Admin Dashboard" />
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "var(--surface)", padding: 24, borderRadius: 12, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Total Schools</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text)" }}>{globalStats?.totalSchools || 0}</div>
                </div>
                <div style={{ background: "var(--surface)", padding: 24, borderRadius: 12, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Total Admins</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text)" }}>{globalStats?.totalAdmins || 0}</div>
                </div>
                <div style={{ background: "var(--surface)", padding: 24, borderRadius: 12, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Total Students</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text)" }}>{globalStats?.totalStudents || 0}</div>
                </div>
                <div style={{ background: "var(--surface)", padding: 24, borderRadius: 12, border: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Global Revenue</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--primary)" }}>{money(globalStats?.totalRevenue || 0)}</div>
                </div>
              </div>

              <div className="splitLayout">
                <div className="section">
                  <h3>Recent Schools</h3>
                  <div className="list">
                    {tenants.slice(0, 5).map(t => (
                      <div key={t.id} className="rowItem">
                        <div>
                          <strong>{t.name}</strong>
                          <span>{t.slug} • Admins: {t.users?.length || 0}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{shortDate(t.createdAt)}</div>
                      </div>
                    ))}
                    {tenants.length === 0 && <p className="muted">No schools yet.</p>}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "schools" && session?.user.role === "SUPER_ADMIN" ? (
            <section className="section">
              <SectionHeading title="Schools (Tenants)" meta={`${tenants.length} total`} />
              <div className="splitLayout">
                <div className="section">
                  <h3>Add New School</h3>
                  <form onSubmit={createSchool} className="form">
                    <label className="formLabel">
                      School Name
                      <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required placeholder="e.g. Cambridge High" />
                    </label>
                    <label className="formLabel">
                      School URL Slug
                      <input value={schoolSlug} onChange={(e) => setSchoolSlug(e.target.value)} required placeholder="e.g. cambridge" />
                    </label>
                    <label className="formLabel">
                      School Code (Optional)
                      <input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} placeholder="e.g. CAMB123" />
                    </label>
                    <hr style={{ border: "none", borderTop: "1px dashed var(--line)", margin: "8px 0" }} />
                    <h4>Initial Admin Setup</h4>
                    <label className="formLabel">
                      Admin Name
                      <input value={schoolAdminName} onChange={(e) => setSchoolAdminName(e.target.value)} required placeholder="e.g. John Doe" />
                    </label>
                    <label className="formLabel">
                      Admin Phone
                      <input value={schoolAdminPhone} onChange={(e) => setSchoolAdminPhone(e.target.value)} required placeholder="e.g. 9876543210" />
                    </label>
                    <label className="formLabel">
                      Admin Password
                      <input type="password" value={schoolAdminPassword} onChange={(e) => setSchoolAdminPassword(e.target.value)} required placeholder="Minimum 6 chars" minLength={6} />
                    </label>
                    <button className="primaryButton" style={{ marginTop: 8 }}>Create School</button>
                  </form>
                </div>
                <div className="section">
                  <h3>Existing Schools</h3>
                  <div className="list">
                    {tenants.length === 0 && <p className="muted">No schools found.</p>}
                    {tenants.map(t => (
                      <div key={t.id} className="rowItem">
                        <div>
                          <strong>{t.name}</strong>
                          <span>Slug: {t.slug} • Code: {t.schoolCode || "None"}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {shortDate(t.createdAt)}
                        </div>
                        <div style={{ marginTop: 12 }}>
                          {t.users?.map(admin => (
                            <div key={admin.id} style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--surface)", padding: 8, borderRadius: 6, marginBottom: 4 }}>
                              <div style={{ flex: 1, fontSize: 13 }}>
                                <strong>{admin.name}</strong> ({admin.phone}) 
                                {!admin.isActive && <span style={{ color: "red", marginLeft: 4 }}>[Suspended]</span>}
                              </div>
                              <button className="ghostButton" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setEditingAdmin({ id: admin.id, name: admin.name, phone: admin.phone })}>Edit</button>
                              <button className="ghostButton" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleToggleAdminStatus(admin.id, !admin.isActive)}>{admin.isActive ? "Suspend" : "Activate"}</button>
                              <button className="dangerButton" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleDeleteAdmin(admin.id)}>Delete</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {editingAdmin && (
                <div className="modalOverlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
                  <div className="modalContent" style={{ background: "var(--surface)", padding: 24, borderRadius: 12, width: "100%", maxWidth: 400 }}>
                    <h3>Edit Admin</h3>
                    <form onSubmit={handleUpdateAdmin} className="form">
                      <label className="formLabel">
                        Name
                        <input value={editingAdmin.name} onChange={e => setEditingAdmin({...editingAdmin, name: e.target.value})} required />
                      </label>
                      <label className="formLabel">
                        Phone
                        <input value={editingAdmin.phone} onChange={e => setEditingAdmin({...editingAdmin, phone: e.target.value})} required />
                      </label>
                      <label className="formLabel">
                        New Password (Optional)
                        <input type="password" value={editingAdmin.password || ""} onChange={e => setEditingAdmin({...editingAdmin, password: e.target.value})} placeholder="Leave blank to keep current" minLength={6} />
                      </label>
                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button type="submit" className="primaryButton" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</button>
                        <button type="button" className="ghostButton" onClick={() => setEditingAdmin(null)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </section>
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
              {/* ─ Categories ─ */}
              <div className="section">
                <SectionHeading title="Categories" meta={`${categories.length} active`} />
                <form onSubmit={createCategory} className="menuForm">
                  {/* Image picker */}
                  <div className="imgPickerWrap">
                    <label className="imgPickerLabel" htmlFor="cat-img-input">
                      {categoryImageUrl ? (
                        <img src={categoryImageUrl} alt="Category" className="imgPickerPreview" />
                      ) : (
                        <div className="imgPickerPlaceholder">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <span>{uploadingCategoryImage ? "Uploading..." : "Add Photo"}</span>
                        </div>
                      )}
                      <input
                        id="cat-img-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: "none" }}
                        disabled={uploadingCategoryImage}
                        onChange={(e) => uploadMenuImage(e.target.files?.[0], "CATEGORY")}
                      />
                    </label>
                    {categoryImageUrl && (
                      <button type="button" className="imgPickerRemove" onClick={() => setCategoryImageUrl("")} title="Remove image">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="menuFormFields">
                    <input placeholder="Category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                    <input placeholder="Description (optional)" value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} />
                    <button className="primaryButton" disabled={uploadingCategoryImage}>
                      {uploadingCategoryImage ? "Uploading image..." : "Add Category"}
                    </button>
                  </div>
                </form>
                {/* Category list */}
                <div className="list">
                  {categories.map((category) => (
                    <div key={category.id} className="rowItem categoryRow">
                      <div className="categoryRowThumb">
                        {category.imageUrl
                          ? <img src={category.imageUrl} alt={category.name} />
                          : <div className="categoryRowThumbEmpty"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                        }
                      </div>
                      <div className="categoryRowInfo">
                        <strong>{category.name}</strong>
                        <span>{category.description || "No description"}</span>
                      </div>
                      <div className="rowActions">
                        <button className="miniButton" onClick={() => openEditCategory(category)}>✏️ Edit</button>
                        <button className="miniButton ghost" onClick={() => deleteCategory(category)}>🗑 Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─ Items ─ */}
              <div className="section">
                <SectionHeading title="Items" meta={`${items.length} shown`} />
                <form onSubmit={createItem} className="menuForm">
                  {/* Image picker */}
                  <div className="imgPickerWrap">
                    <label className="imgPickerLabel" htmlFor="item-img-input">
                      {itemImageUrl ? (
                        <img src={itemImageUrl} alt="Item" className="imgPickerPreview" />
                      ) : (
                        <div className="imgPickerPlaceholder">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <span>{uploadingItemImage ? "Uploading..." : "Add Photo"}</span>
                        </div>
                      )}
                      <input
                        id="item-img-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: "none" }}
                        disabled={uploadingItemImage}
                        onChange={(e) => uploadMenuImage(e.target.files?.[0], "ITEM")}
                      />
                    </label>
                    {itemImageUrl && (
                      <button type="button" className="imgPickerRemove" onClick={() => setItemImageUrl("")} title="Remove image">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="menuFormFields">
                    <input placeholder="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <input placeholder="Price (₹)" type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} required />
                      <input placeholder="Stock qty" type="number" value={itemStock} onChange={(e) => setItemStock(e.target.value)} />
                    </div>
                    <select value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)} required>
                      <option value="">Select category</option>
                      {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    <button className="primaryButton" disabled={uploadingItemImage}>
                      {uploadingItemImage ? "Uploading image..." : "Add Item"}
                    </button>
                  </div>
                </form>
                <MenuTable items={items} categories={categories} toggleItem={toggleItem} toggleSpecial={toggleSpecial} onEdit={openEditItem} onDelete={deleteItem} />
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
              <SectionHeading title="Backups" meta={`${backups.length} saved`} />

              {/* How it works banner */}
              <div className="backupInfoBanner">
                <div className="backupInfoIcon">💡</div>
                <div>
                  <strong>How backups work</strong>
                  <p>Backups are saved on the server. Click <b>Create Backup</b> to snapshot all your data. Download a ZIP to keep an offline copy. Click <b>Restore</b> to roll back to any saved point — this replaces all current data.</p>
                </div>
              </div>

              <button className="primaryButton narrow" onClick={createBackup} style={{ alignSelf: "flex-start" }}>
                <span>＋ Create Backup</span>
              </button>

              {backups.length === 0 ? (
                <div className="emptyStateCard">
                  <div style={{ fontSize: "32px" }}>📦</div>
                  <strong>No backups yet</strong>
                  <small>Create your first backup to protect your data</small>
                </div>
              ) : (
                <div className="list">
                  {backups.map((backup) => (
                    <div key={backup.id} className="rowItem backupRow">
                      <div className="backupRowInfo">
                        <div className="backupRowIcon">🗄️</div>
                        <div>
                          <strong>{shortDate(backup.createdAt)}</strong>
                          <span>{backup.id}</span>
                          <small>{(backup.sizeBytes / 1024).toFixed(1)} KB</small>
                        </div>
                      </div>
                      <div className="backupRowActions">
                        <button
                          className="miniButton"
                          onClick={() => restoreBackup(backup)}
                          title="Restore this backup — replaces all current data"
                        >
                          ↩ Restore
                        </button>
                        <button
                          className="secondaryButton"
                          onClick={() => downloadBackup(backup)}
                          title="Download a ZIP copy to your device"
                        >
                          ⬇ Download ZIP
                        </button>
                        <button
                          className="miniButton ghost"
                          onClick={() => deleteBackupFile(backup)}
                          title="Permanently delete this backup from the server"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* ── Community Posts ── */}
          {activeView === "community" ? (
            <section className="splitLayout">
              <div className="section">
                <SectionHeading title="New Post" meta="Announcements" />
                <form className="form" onSubmit={(e) => {
                  e.preventDefault();
                  mutate("Post created", async () => {
                    await api("/community/posts", {
                      method: "POST",
                      body: JSON.stringify({ title: postTitle, body: postBody })
                    });
                    setPostTitle(""); setPostBody("");
                  });
                }}>
                  <input placeholder="Post title" value={postTitle} onChange={(e) => setPostTitle(e.target.value)} required />
                  <textarea placeholder="Post content…" value={postBody} onChange={(e) => setPostBody(e.target.value)} required rows={5} />
                  <button className="primaryButton">Publish Post</button>
                </form>
              </div>
              <div className="section">
                <SectionHeading title="Posts" meta={`${communityPosts.length} total`} />
                <div className="list">
                  {communityPosts.length === 0 && (
                    <div className="emptyStateCard"><div style={{ fontSize: 32 }}>💬</div><strong>No posts yet</strong><small>Create the first announcement</small></div>
                  )}
                  {communityPosts.map((post) => (
                    <div key={post.id} className="rowItem communityRow">
                      <div className="communityRowMeta">
                        {post.isPinned && <span className="badge pinBadge">📌 Pinned</span>}
                        {!post.isVisible && <span className="badge hiddenBadge">Hidden</span>}
                      </div>
                      <strong className="communityRowTitle">{post.title}</strong>
                      <p className="communityRowBody">{post.body.substring(0, 120)}{post.body.length > 120 ? "…" : ""}</p>
                      <div className="rowActions">
                        <button className="miniButton" onClick={() => mutate(post.isPinned ? "Unpinned" : "Pinned", () =>
                          api(`/community/posts/${post.id}/pin`, { method: "PATCH" }))}>
                          {post.isPinned ? "Unpin" : "📌 Pin"}
                        </button>
                        <button className="miniButton ghost" onClick={() => mutate(post.isVisible ? "Hidden" : "Visible", () =>
                          api(`/community/posts/${post.id}/visibility`, { method: "PATCH" }))}>
                          {post.isVisible ? "Hide" : "Show"}
                        </button>
                        <button className="miniButton ghost" onClick={() => setConfirmAction({
                          title: "Delete Post?",
                          message: `"${post.title}" will be permanently deleted.`,
                          onConfirm: () => { setConfirmAction(null); mutate("Post deleted", () => api(`/community/posts/${post.id}`, { method: "DELETE" })); }
                        })}>🗑 Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* ── Wallet Top-up ── */}
          {activeView === "wallet" ? (
            <section className="splitLayout">
              <div className="section">
                <SectionHeading title="Top-up Wallet" meta="Teacher & Staff" />
                <form className="form" onSubmit={(e) => {
                  e.preventDefault();
                  if (!topupUserId) { setError("Select a user"); return; }
                  mutate("Wallet topped up", async () => {
                    await api(`/users/${topupUserId}/wallet-topup`, {
                      method: "PATCH",
                      body: JSON.stringify({ amount: Number(topupAmount), note: topupNote || undefined })
                    });
                    setTopupAmount(""); setTopupNote("");
                  });
                }}>
                  <select value={topupUserId} onChange={(e) => setTopupUserId(e.target.value)} required>
                    <option value="">Select user…</option>
                    {walletUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role}) — ₹{u.walletBalance.toFixed(2)}</option>
                    ))}
                  </select>
                  <input placeholder="Amount (₹)" type="number" min="1" max="50000" value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)} required />
                  <input placeholder="Note (optional)" value={topupNote} onChange={(e) => setTopupNote(e.target.value)} />
                  <button className="primaryButton">Add Balance</button>
                </form>
              </div>
              <div className="section">
                <SectionHeading title="Wallet Balances" meta={`${walletUsers.length} users`} />
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Balance</th></tr></thead>
                    <tbody>
                      {walletUsers.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td><span className="roleBadge">{u.role}</span></td>
                          <td>{u.phone ?? "—"}</td>
                          <td><strong style={{ color: u.walletBalance > 0 ? "#10b981" : "var(--muted)" }}>
                            {money(u.walletBalance)}
                          </strong></td>
                        </tr>
                      ))}
                      {walletUsers.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>No teacher or staff accounts</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {activeView === "qr-codes" ? (
            <QRCodesPanel baseUrl={typeof window !== "undefined" ? window.location.origin : ""} />
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

      {/* ── Edit Category Modal ── */}
      {editingCategory && (
        <div className="modalOverlay" onClick={() => setEditingCategory(null)}>
          <div className="modalContent editModal" onClick={(e) => e.stopPropagation()}>
            <h2>✏️ Edit Category</h2>
            <form onSubmit={saveCategory} className="editModalForm">
              {/* Image picker */}
              <div className="imgPickerWrap">
                <label className="imgPickerLabel" htmlFor="edit-cat-img">
                  {editCatImage
                    ? <img src={editCatImage} alt="Category" className="imgPickerPreview" />
                    : <div className="imgPickerPlaceholder">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>{uploadingEditCatImage ? "Uploading..." : "Change Photo"}</span>
                      </div>
                  }
                  <input id="edit-cat-img" type="file" accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }} disabled={uploadingEditCatImage}
                    onChange={(e) => uploadEditCatImage(e.target.files?.[0])} />
                </label>
                {editCatImage && (
                  <button type="button" className="imgPickerRemove" onClick={() => setEditCatImage("")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
              <input placeholder="Category name" value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)} required />
              <input placeholder="Description (optional)" value={editCatDesc}
                onChange={(e) => setEditCatDesc(e.target.value)} />
              <div className="modalActions">
                <button type="button" className="secondaryButton" onClick={() => setEditingCategory(null)}>Cancel</button>
                <button type="submit" className="primaryButton" disabled={loading || uploadingEditCatImage}>
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Item Modal ── */}
      {editingItem && (
        <div className="modalOverlay" onClick={() => setEditingItem(null)}>
          <div className="modalContent editModal" onClick={(e) => e.stopPropagation()}>
            <h2>✏️ Edit Item</h2>
            <form onSubmit={saveItem} className="editModalForm">
              {/* Image picker */}
              <div className="imgPickerWrap">
                <label className="imgPickerLabel" htmlFor="edit-item-img">
                  {editItemImage
                    ? <img src={editItemImage} alt="Item" className="imgPickerPreview" />
                    : <div className="imgPickerPlaceholder">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>{uploadingEditItemImage ? "Uploading..." : "Change Photo"}</span>
                      </div>
                  }
                  <input id="edit-item-img" type="file" accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }} disabled={uploadingEditItemImage}
                    onChange={(e) => uploadEditItemImage(e.target.files?.[0])} />
                </label>
                {editItemImage && (
                  <button type="button" className="imgPickerRemove" onClick={() => setEditItemImage("")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
              <input placeholder="Item name" value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)} required />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <input placeholder="Price (₹)" type="number" value={editItemPrice}
                  onChange={(e) => setEditItemPrice(e.target.value)} required />
                <input placeholder="Stock qty" type="number" value={editItemStock}
                  onChange={(e) => setEditItemStock(e.target.value)} />
              </div>
              <select value={editItemCategoryId} onChange={(e) => setEditItemCategoryId(e.target.value)} required>
                <option value="">Select category</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <div className="modalActions">
                <button type="button" className="secondaryButton" onClick={() => setEditingItem(null)}>Cancel</button>
                <button type="submit" className="primaryButton" disabled={loading || uploadingEditItemImage}>
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
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
          <SimpleBarChart data={report.lastSevenDays} moneyValues />
        </div>
        <div className="chartCard">
          <SectionHeading title="Payment Mix" meta="By method" />
          <SimpleBarChart data={report.paymentData} />
        </div>
        <div className="chartCard">
          <SectionHeading title="Order Status" meta="Queue health" />
          <SimpleBarChart data={report.statusData} />
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

function SimpleBarChart({ data, moneyValues = false }: { data: Array<{ label: string; value: number }>; moneyValues?: boolean }) {
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
  orders,
  setActiveView,
  updateOrderStatus
}: {
  dashboard: ReturnType<typeof useDashboardShape>;
  items: MenuItem[];
  orders: Order[];
  setActiveView: (view: View) => void;
  updateOrderStatus: (order: Order, status: OrderStatus) => void;
}) {
  const lowStockItems = items.filter((item) => item.stockQty <= item.lowStockThreshold);
  const availableItems = items.filter((item) => item.isAvailable);
  const itemCount = availableItems.length;

  // ── Chart data computations ──────────────────────────────────────────────

  // 7-day revenue area chart
  const sevenDayData = useMemo(() => {
    const days: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const label = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      const dayOrders = orders.filter(
        (o) => new Date(o.createdAt).toDateString() === key && o.status === "COMPLETED"
      );
      days.push({
        date: label,
        revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
        orders: dayOrders.length
      });
    }
    return days;
  }, [orders]);

  // Hourly sales (today) bar chart
  const hourlyData = useMemo(() => {
    const todayKey = new Date().toDateString();
    const buckets: Record<number, number> = {};
    orders
      .filter((o) => new Date(o.createdAt).toDateString() === todayKey && o.status === "COMPLETED")
      .forEach((o) => {
        const h = new Date(o.createdAt).getHours();
        buckets[h] = (buckets[h] || 0) + o.totalAmount;
      });
    return Array.from({ length: 12 }, (_, i) => {
      const h = i + 7; // 7am → 6pm
      const label = h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
      return { hour: label, revenue: buckets[h] || 0 };
    });
  }, [orders]);

  // Order status donut
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    const colors: Record<string, string> = {
      PENDING: "#f79009",
      ACCEPTED: "#2e90fa",
      PREPARING: "#9b59b6",
      READY: "#12b76a",
      COMPLETED: "#6c47ff",
      CANCELLED: "#f04438",
      REFUNDED: "#b42318"
    };
    return Object.entries(counts).map(([status, value]) => ({
      name: status,
      value,
      color: colors[status] || "#aab0c4"
    }));
  }, [orders]);

  // Top selling items (by qty sold from completed orders)
  const topItems = useMemo(() => {
    const qtys: Record<string, number> = {};
    orders
      .filter((o) => o.status === "COMPLETED")
      .forEach((o) => o.items.forEach((i) => { qtys[i.name] = (qtys[i.name] || 0) + i.quantity; }));
    return Object.entries(qtys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty }));
  }, [orders]);

  const CHART_PRIMARY = "#6c47ff";
  const CHART_GREEN   = "#12b76a";

  return (
    <>
      {/* Header */}
      <div className="dashboardHeader">
        <div>
          <h1>📊 Dashboard</h1>
          <p className="dashboardHeaderSubtitle">Live canteen analytics — auto-refreshes every 30 seconds</p>
        </div>
        <div className="dashboardHeaderActions">
          <button className="primaryButton" onClick={() => setActiveView("pos")}>🚀 New Order</button>
        </div>
      </div>

      {/* Metric Cards */}
      <section className="metricGrid">
        <Metric label="Today's Sales"   value={money(dashboard.todaySales)}  tone="green"  icon="💰" change="Completed orders" />
        <Metric label="Monthly Sales"   value={money(dashboard.monthlySales)} tone="blue"   icon="📈" change="This month" />
        <Metric label="Active Orders"   value={String(dashboard.pending)}     tone="amber"  icon="⏳" change="In queue" />
        <Metric label="Menu Items"      value={String(itemCount)}             tone="purple" icon="📋" change={`${lowStockItems.length} low stock`} />
      </section>

      {/* ── ROW 1: 7-Day Revenue + Order Status ── */}
      <section className="chartRow">
        {/* 7-Day Revenue Trend */}
        <div className="chartCard wide">
          <div className="chartCardHeader">
            <div>
              <p className="chartCardLabel">Revenue Trend</p>
              <h3 className="chartCardTitle">Last 7 Days</h3>
            </div>
            <span className="chartBadge green">● Live</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sevenDayData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_PRIMARY} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7a99" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7a99" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} width={52} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1.5px solid #e5e9f2", borderRadius: "10px", fontSize: "13px" }}
                formatter={(v: number) => [`₹${v.toFixed(2)}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke={CHART_PRIMARY} strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: CHART_PRIMARY, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Donut */}
        <div className="chartCard">
          <div className="chartCardHeader">
            <div>
              <p className="chartCardLabel">Order Breakdown</p>
              <h3 className="chartCardTitle">By Status</h3>
            </div>
            <span className="chartBadge purple">Total {orders.length}</span>
          </div>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} dataKey="value" paddingAngle={3}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1.5px solid #e5e9f2", borderRadius: "10px", fontSize: "12px" }}
                    formatter={(v: number, n: string) => [v, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donutLegend">
                {statusData.map((d) => (
                  <div key={d.name} className="donutLegendItem">
                    <span className="donutDot" style={{ background: d.color }} />
                    <span>{d.name}</span>
                    <b>{d.value}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="emptyStateCard"><div style={{ fontSize: "28px" }}>📭</div><small>No order data yet</small></div>
          )}
        </div>
      </section>

      {/* ── ROW 2: Hourly Sales + Top Items ── */}
      <section className="chartRow">
        {/* Hourly Sales Bar */}
        <div className="chartCard">
          <div className="chartCardHeader">
            <div>
              <p className="chartCardLabel">Today's Sales</p>
              <h3 className="chartCardTitle">By Hour</h3>
            </div>
            <span className="chartBadge amber">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RBarChart data={hourlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#6b7a99" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7a99" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} width={46} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1.5px solid #e5e9f2", borderRadius: "10px", fontSize: "12px" }}
                formatter={(v: number) => [`₹${v.toFixed(2)}`, "Revenue"]}
              />
              <Bar dataKey="revenue" fill={CHART_GREEN} radius={[6, 6, 0, 0]} />
            </RBarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Selling Items */}
        <div className="chartCard wide">
          <div className="chartCardHeader">
            <div>
              <p className="chartCardLabel">Best Sellers</p>
              <h3 className="chartCardTitle">Top Items by Qty</h3>
            </div>
            <span className="chartBadge blue">All time</span>
          </div>
          {topItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RBarChart data={topItems} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7a99" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#6b7a99" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1.5px solid #e5e9f2", borderRadius: "10px", fontSize: "12px" }}
                  formatter={(v: number) => [v, "Qty sold"]}
                />
                <Bar dataKey="qty" fill={CHART_PRIMARY} radius={[0, 6, 6, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          ) : (
            <div className="emptyStateCard"><div style={{ fontSize: "28px" }}>📊</div><small>Complete some orders to see top sellers</small></div>
          )}
        </div>
      </section>

      {/* ── ROW 3: Recent Orders + Stock ── */}
      <section className="dashboardSplitLayout">
        <div className="dashboardSection">
          <div className="sectionHeaderWithAction">
            <SectionHeading title="Recent Orders" meta="Last 5" />
            <button className="textLink" onClick={() => setActiveView("orders")}>View All →</button>
          </div>
          {dashboard.recent.length > 0 ? (
            <OrdersTable orders={dashboard.recent} updateOrderStatus={updateOrderStatus} compact />
          ) : (
            <div className="emptyStateCard">
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📭</div>
              <strong>No orders yet</strong>
              <small>Create your first order from the POS view</small>
            </div>
          )}
        </div>

        <div className="dashboardSection">
          <div className="sectionHeaderWithAction">
            <SectionHeading title="Stock Attention" meta={`${lowStockItems.length} low`} />
            <button className="textLink" onClick={() => setActiveView("menu")}>Manage →</button>
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
  toggleSpecial,
  onEdit,
  onDelete,
}: {
  items: MenuItem[];
  categories: Category[];
  toggleItem: (item: MenuItem) => void;
  toggleSpecial: (item: MenuItem) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: "48px" }}></th>
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
                <div className="itemThumb">
                  {item.image
                    ? <img src={item.image} alt={item.name} />
                    : <div className="itemThumbEmpty">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                  }
                </div>
              </td>
              <td>
                <strong>{item.name}</strong>
                <small>{item.description || "No description"}</small>
              </td>
              <td>{getCategoryName(item.categoryId)}</td>
              <td>{money(item.price)}</td>
              <td>{item.stockQty}</td>
              <td className="buttonGroup">
                <button className="miniButton" onClick={() => toggleSpecial(item)}>
                  {item.isTodaySpecial ? "Unfeature" : "Special"}
                </button>
                <button className="miniButton ghost" onClick={() => toggleItem(item)}>
                  {item.isAvailable ? "Hide" : "Show"}
                </button>
                <button className="miniButton" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="miniButton ghost" onClick={() => onDelete(item)}>🗑 Del</button>
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

function QRCodesPanel({ baseUrl }: { baseUrl: string }) {
  const [tableCount, setTableCount] = useState(10);
  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  return (
    <div className="viewContainer qr-panel">
      <div className="viewHeader print-hide">
        <h2 className="viewTitle">QR Codes</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>Tables:</span>
          <input
            type="number"
            min="1"
            max="100"
            value={tableCount}
            onChange={(e) => setTableCount(parseInt(e.target.value) || 1)}
            style={{ width: "80px", padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
          />
          <button className="primaryButton" onClick={() => window.print()}>
            Print QR Codes
          </button>
        </div>
      </div>
      
      <div className="viewBody">
        <p className="muted print-hide" style={{ marginBottom: "20px" }}>Print these QR codes and place them on your tables. Guests scan them to open the ordering app instantly.</p>
        <div className="qr-grid">
          {tables.map(tableId => {
            const url = `${baseUrl}/qr/${tableId}`;
            return (
              <div key={tableId} className="qr-card">
                <div className="qr-code-wrapper">
                  <QRCodeSVG value={url} size={150} level="M" />
                </div>
                <h3>Table {tableId}</h3>
                <span className="muted" style={{ fontSize: 12 }}>Scan to order</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const globalCss = `
  @media print {
    .print-hide, .sidebar, .sidebarNav, .sidebarHeader, .no-print { display: none !important; }
    .appShell { margin: 0 !important; padding: 0 !important; display: block !important; }
    .mainContent { padding: 0 !important; overflow: visible !important; }
    .viewContainer { margin: 0 !important; padding: 0 !important; display: block !important; box-shadow: none !important; border: none !important; }
    .qr-grid { display: flex; flex-wrap: wrap; gap: 40px; justify-content: center; }
    .qr-card { border: 2px dashed #ccc !important; padding: 20px !important; break-inside: avoid; text-align: center; }
    body { background: white !important; color: black !important; }
    .qr-card h3 { color: black !important; margin-top: 10px; font-size: 20px; }
  }

  .qr-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
  }
  .qr-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .qr-code-wrapper {
    background: white;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 16px;
  }

  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  :root {
    --bg: #f0f2f8;
    --surface: #ffffff;
    --surface2: #f8f9fd;
    --line: #e5e9f2;
    --text: #0f1623;
    --muted: #6b7a99;
    --primary: #FF6B35;
    --primary-light: #FFF0EB;
    --primary-dark: #E65A2A;
    --green: #12b76a;
    --green-light: #d1fadf;
    --amber: #f79009;
    --amber-light: #fef3c7;
    --red: #f04438;
    --red-light: #fee4e2;
    --blue: #2e90fa;
    --blue-light: #dbeafe;
    --purple: #9b59b6;
    --purple-light: #f0e6ff;
    --sidebar-w: 240px;
    --topbar-h: 64px;
    --radius: 14px;
    --radius-sm: 8px;
    --shadow: 0 1px 4px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.06);
    --shadow-md: 0 4px 24px rgba(255,107,53,.20), 0 1px 4px rgba(15,23,42,.06);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: var(--text);
    background: var(--bg);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  button, input, select, textarea { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  input, select, textarea {
    background: var(--surface2);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--text);
    width: 100%;
    transition: all .2s cubic-bezier(.4,0,.2,1);
    outline: none;
    font-size: 14.5px;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 4px rgba(255,107,53,.15);
    background: #fff;
  }
  textarea { resize: vertical; min-height: 80px; }
  label { font-size: 13px; font-weight: 600; color: var(--muted); }

  /* ─── LOGIN ─── */
  .loginShell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  }
  .loginPanel {
    width: min(960px, 100%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    background: var(--surface);
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(255,107,53,.15), 0 8px 24px rgba(15,23,42,.08);
  }
  .loginLeftPanel {
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
    padding: 64px 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 16px;
    color: white;
  }
  .loginLogo {
    width: 160px;
    height: 160px;
    margin-bottom: 24px;
    border-radius: 32px;
    object-fit: contain;
    background: white;
    padding: 16px;
    box-shadow: 0 16px 40px rgba(0,0,0,.2);
    transition: transform .3s cubic-bezier(.4,0,.2,1);
  }
  .loginLogo:hover {
    transform: scale(1.05) translateY(-4px);
  }
  .loginLeftPanel .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    opacity: .75;
    color: #94a3b8;
  }
  .loginLeftPanel h1 {
    font-size: 40px;
    font-weight: 900;
    color: white;
    line-height: 1.15;
    letter-spacing: -.02em;
  }
  .loginLeftPanel .muted {
    color: rgba(255,255,255,.7);
    font-size: 15px;
    line-height: 1.6;
    font-weight: 400;
  }
  .loginPanel form, .loginPanel .form {
    padding: 64px 48px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    justify-content: center;
  }
  .loginPanel .form label { display: flex; flex-direction: column; gap: 8px; font-weight: 700; color: #334155; }
  .loginPanel .eyebrow {
    font-size: 11px; font-weight: 800; letter-spacing: .1em;
    text-transform: uppercase; color: var(--primary);
  }
  .loginPanel h1, .topbar h1 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -.02em; }
  .loginPanel .muted { color: var(--muted); font-size: 14px; }
  .errorText { color: var(--red); font-size: 13px; font-weight: 600; }

  /* ─── APP SHELL ─── */
  .appShell {
    display: grid;
    grid-template-columns: var(--sidebar-w) 1fr;
    min-height: 100vh;
    transition: grid-template-columns .25s cubic-bezier(.4,0,.2,1);
  }
  .appShell.sidebarCollapsed {
    grid-template-columns: 60px 1fr;
  }

  /* ─── SIDEBAR ─── */
  .sidebar {
    background: var(--surface);
    border-right: 1.5px solid var(--line);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
    overflow-y: auto;
    z-index: 100;
    width: var(--sidebar-w);
    transition: width .25s cubic-bezier(.4,0,.2,1), transform .25s cubic-bezier(.4,0,.2,1);
    flex-shrink: 0;
  }
  .sidebar.collapsed {
    width: 60px;
    overflow: visible;
  }
  .sidebar.collapsed .navList { padding: 12px 6px; }
  .sidebarHeader {
    display: flex;
    align-items: center;
    padding: 18px 12px 14px;
    border-bottom: 1.5px solid var(--line);
    min-height: 68px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .brandBlock {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
  }
  .brandMark {
    width: 36px;
    height: 36px;
    background: white;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 18px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(255,107,53,.25);
  }
  .brandText { overflow: hidden; white-space: nowrap; }
  .brandTitle { font-size: 15px; font-weight: 800; color: var(--text); letter-spacing: -.01em; display: block; }
  .brandSub { font-size: 11px; color: var(--muted); font-weight: 500; display: block; }
  .navList {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 8px;
    overflow: hidden;
  }
  .navItem {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px 10px;
    border-radius: 10px;
    background: none;
    border: none;
    text-align: left;
    width: 100%;
    color: var(--muted);
    transition: background .15s, color .15s;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
  }
  .navIcon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .navText {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    min-width: 0;
  }
  .navLabel { font-size: 13.5px; font-weight: 600; display: block; }
  .navHint { font-size: 11px; opacity: .7; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .navActiveDot {
    width: 6px; height: 6px;
    background: var(--primary);
    border-radius: 50%;
    margin-left: auto;
    flex-shrink: 0;
  }
  .navItem:hover { background: var(--surface2); color: var(--text); }
  .navItem.active {
    background: var(--primary-light);
    color: var(--primary);
  }
  .navItem.active .navLabel { font-weight: 700; }
  /* Tooltip for collapsed sidebar items */
  .sidebar.collapsed .navItem { justify-content: center; padding: 11px 0; }
  .sidebar.collapsed .navItem::after {
    content: attr(title);
    position: absolute;
    left: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    background: #1a1e2e;
    color: white;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity .15s;
    z-index: 200;
    box-shadow: 0 4px 16px rgba(15,23,42,.2);
  }
  .sidebar.collapsed .navItem:hover::after { opacity: 1; }
  /* Collapse toggle button */
  .collapseToggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 8px 4px;
    padding: 9px 10px;
    background: none;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 600;
    transition: all .15s;
    white-space: nowrap;
    overflow: hidden;
    width: calc(100% - 16px);
  }
  .collapseToggle:hover { background: var(--surface2); border-color: var(--primary); color: var(--primary); }
  .sidebar.collapsed .collapseToggle { justify-content: center; padding: 9px 0; width: calc(100% - 12px); margin: 4px 6px; }
  /* Logout button */
  .ghostButton {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 8px 14px;
    padding: 9px 10px;
    background: none;
    border: 1.5px solid var(--line);
    border-radius: 10px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    transition: all .15s;
    white-space: nowrap;
    overflow: hidden;
    width: calc(100% - 16px);
  }
  .ghostButton:hover { background: #fff0ee; border-color: var(--red); color: var(--red); }
  .sidebar.collapsed .ghostButton { justify-content: center; padding: 9px 0; width: calc(100% - 12px); margin: 4px 6px 14px; }
  .hamburgerMobile {
    display: none;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1.5px solid var(--line);
    border-radius: 8px;
    padding: 8px;
    color: var(--muted);
    transition: background .15s;
    flex-shrink: 0;
  }
  .hamburgerMobile:hover { background: var(--surface2); }
  .sidebarBackdrop {
    position: fixed; inset: 0;
    background: rgba(15,23,42,.4);
    z-index: 99;
    backdrop-filter: blur(2px);
  }

  /* ─── WORK AREA ─── */
  .workArea {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    overflow: hidden;
  }

  /* ─── TOPBAR ─── */
  .topbar {
    height: var(--topbar-h);
    background: var(--surface);
    border-bottom: 1.5px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .topbarTitle { flex: 1; min-width: 0; }
  .topbarBreadcrumb { font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 1px; }
  .topbar h1 { font-size: 20px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .topbarActions { display: flex; align-items: center; gap: 12px; }
  .topbarRefreshBtn {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 14px;
    background: var(--surface2);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    transition: all .15s;
    white-space: nowrap;
  }
  .topbarRefreshBtn:hover:not(:disabled) { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
  .topbarUser { display: flex; align-items: center; gap: 10px; cursor: default; }
  .topbarUserInfo { display: flex; flex-direction: column; gap: 1px; }
  .topbarUserName { font-size: 13px; font-weight: 700; color: var(--text); line-height: 1; }
  .topbarUserRole { font-size: 11px; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: .05em; }
  .avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #FF6B35;
    color: white;
    font-weight: 800;
    font-size: 14px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(255,107,53,.3);
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* ─── BUTTONS ─── */
  .primaryButton {
    background: #FF6B35;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 24px;
    font-weight: 800;
    font-size: 14.5px;
    transition: all .2s cubic-bezier(.4,0,.2,1);
    box-shadow: 0 4px 12px rgba(255,107,53,.3);
    white-space: nowrap;
  }
  .primaryButton:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255,107,53,.4);
  }
  .primaryButton.danger { background: linear-gradient(135deg, #f04438, #c9291e); box-shadow: 0 4px 12px rgba(240,68,56,.3); }
  .primaryButton.narrow { padding: 8px 16px; font-size: 13px; }
  .secondaryButton {
    background: var(--surface);
    color: var(--text);
    border: 1.5px solid var(--line);
    border-radius: 10px;
    padding: 9px 16px;
    font-weight: 600;
    font-size: 13px;
    transition: all .15s;
    white-space: nowrap;
  }
  .secondaryButton:hover:not(:disabled) { background: var(--surface2); border-color: #c0cadb; }
  .tertiaryButton {
    background: var(--primary-light);
    color: var(--primary);
    border: none;
    border-radius: 10px;
    padding: 9px 16px;
    font-weight: 700;
    font-size: 13px;
    transition: all .15s;
  }
  .holdBtn { background: #fffbeb; color: #92400e; }
  .holdRestoreBtn { background: #ecfdf5; color: #065f46; }
  .miniButton {
    background: var(--primary-light);
    color: var(--primary);
    border: none;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 700;
    transition: background .15s;
    white-space: nowrap;
  }
  .miniButton:hover { background: #d8d0ff; }
  .miniButton.ghost { background: var(--surface2); color: var(--muted); }
  .miniButton.ghost:hover { background: var(--line); color: var(--text); }
  .textLink {
    background: none; border: none;
    color: var(--primary); font-weight: 700; font-size: 13px;
    padding: 4px 0; transition: opacity .15s;
  }
  .textLink:hover { opacity: .75; }
  .fileButton {
    display: inline-block;
    background: var(--primary-light);
    color: var(--primary);
    border-radius: 10px;
    padding: 9px 16px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: background .15s;
  }
  .fileButton input[type=file] { display: none; }
  .fileButton:hover { background: #d8d0ff; }
  .buttonGroup { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .submitBtn { width: 100%; padding: 13px; font-size: 15px; font-weight: 800; border-radius: 12px; }

  /* ─── NOTICES ─── */
  .notice {
    background: var(--green-light);
    color: #065f46;
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    font-weight: 600;
    font-size: 13px;
    margin: 16px 24px 0;
    border-left: 3px solid var(--green);
  }
  .errorBox {
    background: var(--red-light);
    color: #9b1c1c;
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    font-weight: 600;
    font-size: 13px;
    margin: 16px 24px 0;
    border-left: 3px solid var(--red);
  }

  /* ─── CHART CARDS ─── */
  .chartRow {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 0 24px 16px;
  }
  .chartRow .chartCard.wide { grid-column: span 1; }
  .chartCard {
    background: var(--surface);
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    padding: 20px;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .chartCard.wide { grid-column: span 1; }
  .chartCardHeader {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .chartCardLabel { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 2px; }
  .chartCardTitle { font-size: 16px; font-weight: 800; color: var(--text); letter-spacing: -.02em; }
  .chartBadge {
    font-size: 11px; font-weight: 700;
    padding: 3px 10px; border-radius: 99px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .chartBadge.green  { background: var(--green-light);  color: #065f46; }
  .chartBadge.blue   { background: var(--blue-light);   color: #1e3a8a; }
  .chartBadge.amber  { background: var(--amber-light);  color: #92400e; }
  .chartBadge.purple { background: var(--primary-light); color: var(--primary); }
  /* Donut legend */
  .donutLegend { display: flex; flex-wrap: wrap; gap: 6px 14px; padding-top: 4px; }
  .donutLegendItem { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--text); }
  .donutDot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .donutLegendItem b { color: var(--muted); font-weight: 700; margin-left: 2px; }

  /* Dashboard header */
  .dashboardHeader {
    display: flex; align-items: center; justify-content: space-between;
    padding: 24px 24px 12px; gap: 16px;
  }
  .dashboardHeader h1 { font-size: 22px; font-weight: 900; letter-spacing: -.02em; }
  .dashboardHeaderSubtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .dashboardHeaderActions { display: flex; gap: 10px; }

  /* ─── SECTION / LAYOUT ─── */
  .section { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

  .splitLayout {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 20px;
    padding: 24px;
    align-items: start;
  }
  .splitLayout.compact { grid-template-columns: 1fr 1.2fr; }
  .invoiceLayout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 24px; align-items: start; }
  .sectionHeading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .sectionHeading h2 { font-size: 17px; font-weight: 800; letter-spacing: -.02em; }
  .sectionHeading span { font-size: 12px; font-weight: 600; color: var(--muted); background: var(--surface2); padding: 3px 10px; border-radius: 99px; border: 1px solid var(--line); }

  /* ─── MENU FORM (with image picker) ─── */
  .menuForm {
    display: flex;
    flex-direction: row;
    gap: 14px;
    align-items: flex-start;
    background: var(--surface2);
    border: 1.5px solid var(--line);
    border-radius: var(--radius);
    padding: 16px;
  }
  .menuFormFields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  /* Image picker */
  .imgPickerWrap {
    position: relative;
    flex-shrink: 0;
  }
  .imgPickerLabel {
    display: block;
    width: 90px;
    height: 90px;
    border-radius: 12px;
    border: 2px dashed var(--line);
    cursor: pointer;
    overflow: hidden;
    transition: border-color .15s, background .15s;
    background: var(--surface);
  }
  .imgPickerLabel:hover { border-color: var(--primary); background: var(--primary-light); }
  .imgPickerPlaceholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--muted);
  }
  .imgPickerPlaceholder span { font-size: 10.5px; font-weight: 600; text-align: center; line-height: 1.2; }
  .imgPickerPreview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .imgPickerRemove {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--red);
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: transform .15s, background .15s;
    box-shadow: 0 2px 6px rgba(240,68,56,.4);
    z-index: 2;
  }
  .imgPickerRemove:hover { transform: scale(1.15); background: #c9291e; }

  /* Category row with thumbnail */
  .categoryRow { display: flex; align-items: center; gap: 12px; }
  .categoryRowInfo { flex: 1; min-width: 0; }
  .rowActions { display: flex; gap: 6px; flex-shrink: 0; }
  .categoryRowThumb {
    width: 42px; height: 42px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--surface2);
    border: 1.5px solid var(--line);
  }
  .categoryRowThumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .categoryRowThumbEmpty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--muted);
  }
  .categoryRowInfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .categoryRowInfo strong { font-size: 13.5px; font-weight: 700; color: var(--text); }
  .categoryRowInfo span { font-size: 12px; color: var(--muted); }

  /* Item thumbnail in table */
  .itemThumb {
    width: 38px; height: 38px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface2);
    border: 1.5px solid var(--line);
    flex-shrink: 0;
  }
  .itemThumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .itemThumbEmpty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: var(--muted);
  }


  /* ─── METRIC CARDS ─── */
  .metricGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 24px 24px 0; }
  .metric {
    background: var(--surface);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow);
    border: 1.5px solid var(--line);
    transition: transform .2s, box-shadow .2s;
    position: relative;
    overflow: hidden;
  }
  .metric:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .metric::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .metric.green::before { background: linear-gradient(90deg, #12b76a, #059669); }
  .metric.blue::before { background: linear-gradient(90deg, #2e90fa, #1d4ed8); }
  .metric.amber::before { background: linear-gradient(90deg, #f79009, #d97706); }
  .metric.purple::before { background: linear-gradient(90deg, #6c47ff, #4f2fe0); }
  .metric.red::before { background: linear-gradient(90deg, #f04438, #c9291e); }
  .metricIcon {
    width: 40px; height: 40px;
    border-radius: 10px;
    display: grid; place-items: center;
    font-size: 20px;
    flex-shrink: 0;
  }
  .metric.green .metricIcon { background: var(--green-light); }
  .metric.blue .metricIcon { background: var(--blue-light); }
  .metric.amber .metricIcon { background: var(--amber-light); }
  .metric.purple .metricIcon { background: var(--purple-light); }
  .metric.red .metricIcon { background: var(--red-light); }
  .metricContent { display: flex; flex-direction: column; gap: 3px; }
  .metricLabel { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .metricValue { font-size: 24px; font-weight: 900; letter-spacing: -.03em; color: var(--text); line-height: 1.1; }
  .metricChange { font-size: 12px; font-weight: 600; color: var(--green); }
  .metric.amber .metricChange { color: var(--amber); }
  .metric.purple .metricChange { color: var(--primary); }

  /* ─── DASHBOARD ─── */
  .dashboardHeader {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 28px 24px 0;
    flex-wrap: wrap;
  }
  .dashboardHeader h1 { font-size: 28px; font-weight: 900; letter-spacing: -.03em; }
  .dashboardHeaderSubtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }
  .dashboardHeaderActions { display: flex; gap: 10px; }
  .dashboardSplitLayout { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; padding: 16px 24px 24px; }
  .dashboardSection {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--line);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: var(--shadow);
  }
  .sectionHeaderWithAction { display: flex; align-items: center; justify-content: space-between; }

  /* ─── QUICK ACTIONS ─── */
  .quickActionsGrid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; padding: 16px 24px 0; }
  .quickActionCard {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--line);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: var(--shadow);
    transition: all .2s;
  }
  .quickActionCard:hover { border-color: var(--primary); box-shadow: 0 4px 20px rgba(255,107,53,.15); transform: translateY(-1px); }
  .quickActionIcon { font-size: 22px; flex-shrink: 0; width: 40px; height: 40px; display: grid; place-items: center; background: var(--primary-light); border-radius: 10px; }
  .quickActionContent { flex: 1; min-width: 0; }
  .quickActionContent strong { display: block; font-size: 13px; font-weight: 700; }
  .quickActionContent small { color: var(--muted); font-size: 12px; }
  .quickActionArrow { color: var(--muted); font-size: 16px; }

  /* ─── STOCK CARDS ─── */
  .stockList { display: flex; flex-direction: column; gap: 10px; }
  .stockCard { display: flex; flex-direction: column; gap: 6px; padding: 12px; background: var(--surface2); border-radius: var(--radius-sm); border: 1px solid var(--line); }
  .stockCardInfo { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .stockCardInfo strong { font-size: 13px; font-weight: 700; }
  .stockCardMeta { font-size: 12px; color: var(--muted); }
  .stockProgress { }
  .stockProgressBar { height: 6px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .stockProgressFill { height: 100%; border-radius: 99px; transition: width .4s; }

  /* ─── EMPTY STATES ─── */
  .emptyState { color: var(--muted); font-size: 13px; text-align: center; padding: 24px 0; font-style: italic; }
  .emptyStateCard {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; padding: 32px;
    background: var(--surface2); border-radius: var(--radius); border: 2px dashed var(--line);
    text-align: center;
  }
  .emptyStateCard strong { font-size: 15px; font-weight: 700; }
  .emptyStateCard small { color: var(--muted); font-size: 13px; }

  /* ─── COMMUNITY ─── */
  .communityRow { display: flex; flex-direction: column; gap: 6px; }
  .communityRowMeta { display: flex; gap: 6px; }
  .communityRowTitle { font-size: 15px; font-weight: 700; }
  .communityRowBody { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .pinBadge { background: rgba(245,158,11,.12); color: #d97706; border: 1px solid rgba(245,158,11,.25); }
  .hiddenBadge { background: rgba(100,116,139,.15); color: var(--muted); border: 1px solid var(--line); }

  /* ─── WALLET ─── */
  .roleBadge { background: var(--surface2); border: 1px solid var(--line); color: var(--text); border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }

  /* ─── TABLES ─── */
  .tableWrap {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--line);
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  table { width: 100%; border-collapse: collapse; }
  thead { background: var(--surface2); border-bottom: 1.5px solid var(--line); }
  th { padding: 11px 16px; text-align: left; font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
  td { padding: 13px 16px; border-bottom: 1px solid var(--line); font-size: 13.5px; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .12s; }
  tbody tr:hover { background: var(--surface2); }
  td strong { display: block; font-weight: 700; font-size: 13.5px; }
  td small { display: block; color: var(--muted); font-size: 11.5px; margin-top: 1px; }
  .stockEdit { display: flex; gap: 8px; align-items: center; }
  .stockEdit input { width: 80px; }

  /* ─── STATUS PILLS ─── */
  .pill {
    display: inline-flex; align-items: center;
    min-height: 22px; border-radius: 99px;
    padding: 2px 10px; font-size: 11.5px; font-weight: 700;
    white-space: nowrap; letter-spacing: .02em;
  }
  .neutral { color: var(--primary); background: var(--primary-light); }
  .success { color: #065f46; background: var(--green-light); }
  .warning { color: #92400e; background: var(--amber-light); }
  .danger { color: #9b1c1c; background: var(--red-light); }
  .mutedPill { color: var(--muted); background: var(--surface2); }

  /* ─── FORMS ─── */
  .form { display: flex; flex-direction: column; gap: 12px; }
  .formGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .formGrid button, .formGrid select { grid-column: 1 / -1; }
  .inlineForm { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
  .formLabel { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--muted); }

  /* ─── LIST ROWS ─── */
  .list { display: flex; flex-direction: column; gap: 8px; }
  .rowItem {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 16px; background: var(--surface); border: 1.5px solid var(--line);
    border-radius: var(--radius-sm); transition: border-color .15s;
  }
  .rowItem:hover { border-color: #c0cadb; }
  .userRow div { display: flex; flex-direction: column; gap: 2px; }
  .userRow strong { font-size: 13.5px; font-weight: 700; }
  .userRow span { font-size: 12px; color: var(--muted); }

  /* ─── POS LAYOUT ─── */
  .posLayout { display: grid; grid-template-columns: 1fr 360px; height: calc(100vh - var(--topbar-h)); }
  .posItemSection { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; background: var(--bg); }
  .posHeader { display: flex; gap: 10px; align-items: center; }
  .posSearchBox {
    flex: 1; display: flex; align-items: center; gap: 10px;
    background: var(--surface); border: 1.5px solid var(--line); border-radius: 10px;
    padding: 0 14px; transition: border-color .15s;
  }
  .posSearchBox:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(255,107,53,.15); }
  .posSearchInput { flex: 1; border: none; background: none; padding: 10px 0; outline: none; font-size: 14px; }
  .searchIcon { color: var(--muted); font-size: 15px; }
  .categoryTabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .categoryTab {
    padding: 7px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;
    background: var(--surface); border: 1.5px solid var(--line); color: var(--muted);
    transition: all .15s; white-space: nowrap;
  }
  .categoryTab.active, .categoryTab:hover { background: var(--primary); border-color: var(--primary); color: white; }
  .sectionLabel { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .favoritesSection { display: flex; flex-direction: column; gap: 10px; }
  .posItemGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .posItemGridCompact { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .posCard {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--line);
    overflow: hidden;
    transition: all .2s;
    display: flex; flex-direction: column;
    box-shadow: var(--shadow);
    position: relative;
  }
  .posCard:hover { border-color: var(--primary); box-shadow: 0 4px 20px rgba(255,107,53,.20); transform: translateY(-2px); }
  .posCard.selected { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(255,107,53,.35); }
  .posCard.special { border-color: var(--amber); }
  .specialBadge { position: absolute; top: 8px; left: 8px; background: var(--amber); color: white; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 99px; text-transform: uppercase; letter-spacing: .06em; }
  .posImage { height: 90px; background: var(--surface2); display: grid; place-items: center; font-size: 36px; overflow: hidden; }
  .posImage img { width: 100%; height: 100%; object-fit: cover; }
  .posCardBody { padding: 10px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .posCardTitle { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
  .posCardTitle strong { font-size: 13px; font-weight: 700; line-height: 1.3; }
  .categoryLabel { font-size: 11px; color: var(--muted); font-weight: 500; }
  .prepTime { font-size: 11px; color: var(--amber); font-weight: 600; }
  .posPriceRow { display: flex; justify-content: space-between; align-items: center; }
  .posPriceRow b { font-size: 14px; font-weight: 800; color: var(--primary); }
  .posPriceRow small { font-size: 11px; color: var(--muted); }
  .favoriteBtn { background: none; border: none; font-size: 14px; padding: 2px; line-height: 1; transition: transform .15s; }
  .favoriteBtn:hover { transform: scale(1.3); }
  .posCardCompact {
    background: var(--surface); border-radius: var(--radius-sm);
    border: 1.5px solid var(--line); padding: 10px;
    transition: border-color .15s;
  }
  .posCardCompact.selected { border-color: var(--primary); background: var(--primary-light); }
  .posCardHeader { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
  .posCardHeader strong { font-size: 12.5px; font-weight: 700; }
  .posCardQuick { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; }
  .qtyCompact { display: flex; align-items: center; gap: 6px; }
  .qtyCompact button { width: 22px; height: 22px; border-radius: 6px; background: var(--primary-light); color: var(--primary); border: none; font-weight: 800; font-size: 14px; display: grid; place-items: center; }
  .qtyCompact span { font-size: 13px; font-weight: 700; min-width: 18px; text-align: center; }
  .qtyStepper { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
  .qtyStepper button {
    width: 28px; height: 28px; border-radius: 8px;
    background: var(--primary-light); color: var(--primary);
    border: none; font-weight: 800; font-size: 16px;
    display: grid; place-items: center; flex-shrink: 0;
    transition: background .12s;
  }
  .qtyStepper button:hover { background: #ffd2c2; }
  .qtyStepper input { width: 44px; text-align: center; padding: 6px 4px; font-size: 14px; font-weight: 700; }

  /* ─── CHECKOUT ─── */
  .checkoutSection {
    border-left: 1.5px solid var(--line);
    background: var(--surface);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .checkoutPanel { display: flex; flex-direction: column; gap: 14px; padding: 20px; height: 100%; }
  .checkoutHeader { display: flex; justify-content: space-between; align-items: center; }
  .checkoutHeader h2 { font-size: 17px; font-weight: 800; letter-spacing: -.02em; }
  .orderHistoryBtn { background: var(--surface2); border: 1.5px solid var(--line); border-radius: 8px; padding: 6px 10px; font-size: 16px; }
  .orderHistoryPanel { background: var(--surface2); border: 1.5px solid var(--line); border-radius: var(--radius-sm); padding: 12px; }
  .orderHistoryPanel h3 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 8px; }
  .historyList { display: flex; flex-direction: column; gap: 8px; }
  .historyItem { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: white; border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
  .historyItem strong { display: block; font-size: 13px; }
  .historyItem small { color: var(--muted); font-size: 12px; }
  .cartSection { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
  .cartMeta { display: flex; align-items: center; gap: 8px; }
  .cartCount { font-size: 13px; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 3px 10px; border-radius: 99px; }
  .cartLines { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .cartLine { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px; }
  .cartLineInfo { flex: 1; min-width: 0; }
  .cartLineInfo strong { display: block; font-size: 13px; font-weight: 700; }
  .cartLineInfo span { font-size: 12px; color: var(--muted); }
  .cartLineActions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .cartLineActions b { font-size: 13px; font-weight: 800; white-space: nowrap; }
  .removeBtn { width: 22px; height: 22px; border-radius: 6px; background: var(--red-light); border: none; display: grid; place-items: center; color: var(--red); font-weight: 800; font-size: 12px; transition: background .12s; }
  .removeBtn:hover { background: #fecaca; }
  .cartSummary { display: flex; flex-direction: column; gap: 8px; padding-top: 12px; border-top: 2px solid var(--line); }
  .summaryRow { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); }
  .summaryTotal { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; padding-top: 8px; border-top: 1px solid var(--line); }
  .paymentSelect { }
  .checkoutActions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .checkoutActions .submitBtn { grid-column: 1 / -1; }

  /* ─── CHARTS (Bar) ─── */
  .barChart { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .barRow { display: grid; grid-template-columns: 80px 1fr 90px; gap: 10px; align-items: center; font-size: 12.5px; }
  .barRow span { text-align: right; color: var(--muted); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .barTrack { height: 8px; background: var(--surface2); border-radius: 99px; overflow: hidden; }
  .barFill { height: 100%; background: #FF6B35; border-radius: 99px; transition: width .5s; }
  .barRow b { font-size: 12px; font-weight: 700; white-space: nowrap; }

  /* ─── REPORTS ─── */
  .reportsHeader { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
  .reportGrid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 4px; }
  .chartCard {
    background: var(--surface);
    border-radius: var(--radius);
    border: 1.5px solid var(--line);
    padding: 20px;
    display: flex; flex-direction: column; gap: 16px;
    box-shadow: var(--shadow);
  }
  .chartCard.wide { grid-column: 1 / -1; }
  .toggleGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .toggleCard {
    background: var(--surface2); border: 1.5px solid var(--line);
    border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 3px;
    text-align: left; transition: all .15s;
  }
  .toggleCard span { font-size: 13px; font-weight: 700; }
  .toggleCard small { font-size: 11.5px; color: var(--muted); }
  .toggleCard b { font-size: 12px; font-weight: 800; color: var(--muted); margin-top: 4px; }
  .toggleCard.on { background: var(--primary-light); border-color: var(--primary); }
  .toggleCard.on b { color: var(--primary); }
  .toggleCard.on span { color: var(--primary); }

  /* ─── BANNERS ─── */
  .bannerGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 12px; }
  .bannerItem {
    background: var(--surface); border: 1.5px solid var(--line); border-radius: var(--radius);
    padding: 12px; display: flex; flex-direction: column; gap: 8px;
    transition: all .2s; box-shadow: var(--shadow);
  }
  .bannerItem:hover { border-color: var(--primary); box-shadow: var(--shadow-md); }
  .bannerItem img { width: 100%; aspect-ratio: 16/7; object-fit: cover; border-radius: var(--radius-sm); background: var(--surface2); }

  /* ─── INVOICE ─── */
  .invoiceLogoCard { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; align-items: center; background: var(--surface2); border: 1.5px solid var(--line); border-radius: var(--radius-sm); padding: 16px; }
  .invoiceLogoCard img { height: 56px; max-width: 120px; border-radius: 6px; object-fit: contain; flex-shrink: 0; }
  .logoPlaceholder { width: 60px; height: 60px; background: var(--line); border-radius: 6px; display: grid; place-items: center; font-size: 11px; color: var(--muted); text-align: center; padding: 8px; }
  .invoicePreview { }
  .receiptPaper { background: white; border: 1.5px solid var(--line); border-radius: var(--radius); padding: 24px; font-size: 13px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
  .receiptPaper img { display: block; max-height: 72px; max-width: 160px; width: auto; height: auto; object-fit: contain; margin: 0 auto 4px; }
  .receiptPaper h3 { text-align: center; font-size: 16px; font-weight: 800; color: #111; }
  .receiptPaper p { color: var(--muted); font-size: 12px; }
  .receiptLine { display: flex; justify-content: space-between; font-size: 13px; }
  .receiptLine.muted span { color: var(--muted); }
  .receiptLine.total { font-size: 15px; font-weight: 800; border-top: 1px solid var(--line); padding-top: 8px; margin-top: 4px; }
  .receiptPaper footer { color: var(--muted); font-size: 11.5px; text-align: center; border-top: 1px dashed var(--line); padding-top: 8px; margin-top: 4px; }

  /* ─── MODAL ─── */
  .modalOverlay {
    position: fixed; inset: 0;
    background: rgba(15,23,42,.45);
    display: grid; place-items: center;
    z-index: 999;
    backdrop-filter: blur(4px);
  }
  .modalContent {
    background: var(--surface);
    border-radius: 20px;
    padding: 32px;
    width: min(440px, 90vw);
    box-shadow: 0 32px 80px rgba(15,23,42,.2);
    display: flex; flex-direction: column; gap: 16px;
    animation: modalIn .2s cubic-bezier(.4,0,.2,1);
    border: 1.5px solid var(--line);
  }
  @keyframes modalIn { from { opacity: 0; transform: scale(.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .modalContent h2 { font-size: 20px; font-weight: 800; letter-spacing: -.02em; }
  .modalContent p { color: var(--muted); font-size: 14px; line-height: 1.6; }
  .modalActions { display: flex; gap: 10px; justify-content: flex-end; }
  .editModal { width: min(500px, 92vw) !important; }
  .editModalForm { display: flex; flex-direction: column; gap: 12px; }
  .editModalForm input, .editModalForm select { background: var(--surface2); border: 1.5px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; color: var(--text); outline: none; }
  .editModalForm input:focus, .editModalForm select:focus { border-color: var(--accent); }

  /* ─── STATUS PILLS (detailed) ─── */
  .statusPill { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700; }
  .statusPill.pending { background: var(--amber-light); color: #92400e; }
  .statusPill.preparing { background: var(--blue-light); color: #1e3a8a; }
  .statusPill.ready { background: var(--green-light); color: #065f46; }
  .statusPill.completed { background: var(--surface2); color: var(--muted); }
  .statusPill.cancelled, .statusPill.refunded { background: var(--red-light); color: #9b1c1c; }

  /* ─── RESPONSIVE ─── */
  @media (max-width: 900px) {
    .sidebar {
      position: fixed; inset: 0 auto 0 0;
      width: var(--sidebar-w) !important;
      transform: translateX(-100%);
      box-shadow: 4px 0 32px rgba(15,23,42,.12);
      overflow-y: auto;
    }
    .sidebar.open { transform: translateX(0); }
    .sidebar.collapsed { width: var(--sidebar-w) !important; }
    .sidebar.collapsed .navText { display: flex !important; }
    .sidebar.collapsed .brandText { display: block !important; }
    .sidebar.collapsed .collapseToggle { display: none; }
    .sidebar.collapsed .navItem { justify-content: flex-start !important; padding: 10px 10px !important; }
    .sidebar.collapsed .ghostButton { justify-content: flex-start !important; width: calc(100% - 16px) !important; margin: 4px 8px 14px !important; }
    .appShell, .appShell.sidebarCollapsed { grid-template-columns: 1fr; }
    .collapseToggle { display: none; }
    .hamburgerMobile { display: flex; }
    .metricGrid { grid-template-columns: 1fr 1fr; }
    .quickActionsGrid { grid-template-columns: 1fr 1fr; }
    .dashboardSplitLayout { grid-template-columns: 1fr; }
    .dashboardHeader { flex-direction: column; align-items: flex-start; gap: 12px; }
    .chartRow { grid-template-columns: 1fr; }
    .posLayout { grid-template-columns: 1fr; height: auto; }
    .checkoutSection { border-left: none; border-top: 1.5px solid var(--line); max-height: 55vh; }
    .splitLayout, .splitLayout.compact, .invoiceLayout { grid-template-columns: 1fr; }
    .reportGrid { grid-template-columns: 1fr; }
    .loginPanel { grid-template-columns: 1fr; }
    .loginPanel > div:first-child { padding: 32px 28px 24px; }
    .topbar h1 { font-size: 17px; }
    .topbarUserInfo { display: none; }
    .checkoutActions { grid-template-columns: 1fr; }
    .inlineForm { grid-template-columns: 1fr; }
    .posItemGrid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  }
  @media (max-width: 600px) {
    .metricGrid { grid-template-columns: 1fr; }
    .quickActionsGrid { grid-template-columns: 1fr; }
    .toggleGrid { grid-template-columns: 1fr; }
    .formGrid { grid-template-columns: 1fr; }
    .formGrid button, .formGrid select { grid-column: auto; }
    .topbarRefreshBtn span { display: none; }
  }
`;

