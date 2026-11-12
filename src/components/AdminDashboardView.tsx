import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  Utensils,
} from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import { LAST_7_DAYS_SALES_SEED, SEED_SOUTH_INDIAN_MENU } from '../data/seedMenu';
import {
  buildCustomerDirectoryDetails,
  buildPortalShareUrl,
  computeCategorySalesBreakdown,
  DEFAULT_ADMIN_CREDENTIALS,
  DEFAULT_KITCHEN_CREDENTIALS,
  formatTime12Hour,
  type MenuItem,
  type ReconciliationRow,
  type UserRole,
} from '../utils/canteenLogic';

type AdminTab = 'analytics' | 'menu' | 'settings' | 'roles' | 'reconciliation';

const PUBLIC_ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://ais-dev-fhyiowbxmdbhjsxaduccsa-763214530749.asia-northeast1.run.app';

export const AdminDashboardView: React.FC = () => {
  const {
    currentUser,
    navigateToPortal,
    menu,
    settings,
    orders,
    slots,
    registeredUsers,
    updateSettings,
    saveMenuItem,
    deleteMenuItem,
    toggleMenuItemAvailability,
    updateUserRoleByEmail,
    addStaffMember,
    removeStaffMember,
    orderRateLimit,
    clearAllOrders,
  } = useCanteen();

  const [activeTab, setActiveTab] = useState<AdminTab>('reconciliation');

  // Menu Item Form State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('50');
  const [itemCategory, setItemCategory] = useState<MenuItem['category']>('Dosa & Idli');
  const [itemPhoto, setItemPhoto] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemPrepTime, setItemPrepTime] = useState('8');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemDesc, setItemDesc] = useState('');
  const [menuBanner, setMenuBanner] = useState<string | null>(null);

  // Role & Staff Manager State
  const [roleEmail, setRoleEmail] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>('kitchen');
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  // New Kitchen/Admin Account Creation State
  const [staffFullName, setStaffFullName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffUniqueId, setStaffUniqueId] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'kitchen' | 'admin'>('kitchen');
  const [customerSearch, setCustomerSearch] = useState('');

  // Reconciliation State
  const [reconciliationRows, setReconciliationRows] = useState<ReconciliationRow[]>([]);
  const [reconcileSummary, setReconcileSummary] = useState<{
    totalChecked: number;
    matchedCount: number;
    mismatchCount: number;
    dbTotalRevenue: number;
    cfTotalCaptured: number;
  } | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [simulateDiscrepancies, setSimulateDiscrepancies] = useState(true);
  const [reconcileFilter, setReconcileFilter] = useState<'all' | 'matched' | 'mismatch'>('all');
  const [reconcileSearch, setReconcileSearch] = useState('');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(LAST_7_DAYS_SALES_SEED.length - 1);

  // Restrict to admin role only
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="mt-3 font-display text-xl font-bold text-red-950">
          Admin Access Only
        </h2>
        <p className="mt-1 text-xs text-red-700">
          Only Canteen Administrators can access menu management, slot settings, analytics, and Cashfree reconciliation.
        </p>
      </div>
    );
  }

  // Run server-side Cashfree reconciliation when tab opens or orders change
  useEffect(() => {
    let active = true;
    async function runReconciliation() {
      setReconcileLoading(true);
      try {
        const res = await fetch('/api/cashfree/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dbOrders: orders,
            includeSimulatedDiscrepancies: simulateDiscrepancies,
          }),
        });
        if (res.ok && active) {
          const data = await res.json();
          setReconciliationRows(data.rows || []);
          setReconcileSummary(data.summary || null);
        }
      } catch {
        // ignore
      } finally {
        if (active) setReconcileLoading(false);
      }
    }
    runReconciliation();
    return () => {
      active = false;
    };
  }, [orders, simulateDiscrepancies, activeTab]);

  // Analytics Computations
  const analyticsData = useMemo(() => {
    const validOrders = orders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'rejected'
    );
    const todayRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const refundedOrders = orders.filter((o) => o.refundStatus === 'processed');

    // Best Sellers
    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const ord of validOrders) {
      for (const it of ord.items) {
        if (!itemCounts[it.itemId]) {
          itemCounts[it.itemId] = { name: it.name, qty: 0, revenue: 0 };
        }
        itemCounts[it.itemId].qty += it.quantity;
        itemCounts[it.itemId].revenue += it.price * it.quantity;
      }
    }
    const bestSellers = Object.values(itemCounts).sort((a, b) => b.qty - a.qty);

    // Last 7 days with today's live total
    const sevenDays = LAST_7_DAYS_SALES_SEED.map((d, idx) =>
      idx === LAST_7_DAYS_SALES_SEED.length - 1
        ? {
            ...d,
            orders: d.orders + validOrders.length,
            revenue: d.revenue + todayRevenue,
          }
        : d
    );

    const categoryBreakdown = computeCategorySalesBreakdown(orders, menu);

    return {
      todayOrdersCount: orders.length,
      validOrdersCount: validOrders.length,
      todayRevenue,
      refundedCount: refundedOrders.length,
      bestSellers,
      sevenDays,
      categoryBreakdown,
    };
  }, [orders, menu]);

  const filteredReconciliationRows = useMemo(() => {
    return reconciliationRows.filter((row) => {
      if (reconcileFilter === 'matched' && row.reconciliationStatus !== 'MATCHED') return false;
      if (reconcileFilter === 'mismatch' && row.reconciliationStatus === 'MATCHED') return false;
      if (reconcileSearch.trim()) {
        const q = reconcileSearch.trim().toLowerCase();
        const matchToken = String(row.tokenNumber).includes(q);
        const matchOrder = row.orderId.toLowerCase().includes(q);
        const matchEmail = row.customerEmail.toLowerCase().includes(q);
        if (!matchToken && !matchOrder && !matchEmail) return false;
      }
      return true;
    });
  }, [reconciliationRows, reconcileFilter, reconcileSearch]);

  const startEditMenuItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemPrice(String(item.price));
    setItemCategory(item.category);
    setItemPhoto(item.photo);
    setItemIsVeg(item.isVeg);
    setItemPrepTime(String(item.prepTimeMinutes));
    setItemAvailable(item.available);
    setItemDesc(item.description);
    setActiveTab('menu');
  };

  const resetMenuForm = () => {
    setEditingItemId(null);
    setItemName('');
    setItemPrice('50');
    setItemCategory('Dosa & Idli');
    setItemPhoto('');
    setItemIsVeg(true);
    setItemPrepTime('8');
    setItemAvailable(true);
    setItemDesc('');
  };

  const handleSaveMenuForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    await saveMenuItem({
      id: editingItemId || undefined,
      name: itemName,
      price: Number(itemPrice) || 40,
      category: itemCategory,
      photo: itemPhoto.trim() || SEED_SOUTH_INDIAN_MENU[0].photo,
      isVeg: itemIsVeg,
      description: itemDesc || 'Freshly prepared in the campus canteen.',
      prepTimeMinutes: Number(itemPrepTime) || 8,
      available: itemAvailable,
    });
    setMenuBanner(
      editingItemId
        ? `Updated "${itemName}" in the menu.`
        : `Added "${itemName}" to the menu.`
    );
    resetMenuForm();
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await updateUserRoleByEmail(roleEmail, targetRole);
    setRoleMessage(res.message);
    if (res.ok) setRoleEmail('');
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addStaffMember({
      fullName: staffFullName,
      email: staffEmail,
      staffId: staffUniqueId,
      password: staffPassword,
      role: staffRole,
    });
    setRoleMessage(res.message);
    if (res.ok) {
      setStaffFullName('');
      setStaffEmail('');
      setStaffUniqueId('');
      setStaffPassword('');
    }
  };

  const handleRemoveStaffClick = async (uid: string) => {
    const res = await removeStaffMember(uid);
    setRoleMessage(res.message);
  };

  const staffUsers = useMemo(
    () => registeredUsers.filter((u) => u.role === 'kitchen' || u.role === 'admin'),
    [registeredUsers]
  );

  const customerDirectory = useMemo(() => {
    const allCustomers = buildCustomerDirectoryDetails(registeredUsers, orders);
    if (!customerSearch.trim()) return allCustomers;
    const q = customerSearch.trim().toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.studentStaffId.toLowerCase().includes(q)
    );
  }, [registeredUsers, orders, customerSearch]);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Header & Quick Canteen Open/Closed Switch */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Saptien Payment Checking &amp; Admin Console
          </h1>
          <p className="text-xs text-slate-500">
            SAPTHAGIRI NPS UNIVERSITY (/admin) · Cashfree Payment Reconciliation, Analytics, Menu, Slots, Staff &amp; Customer Directory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => updateSettings({ isOpen: !settings.isOpen })}
            className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              settings.isOpen
                ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            Canteen Status: {settings.isOpen ? 'OPEN (Tap to Close)' : 'CLOSED (Tap to Open)'}
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex items-center gap-2 overflow-x-auto pb-1"
      >
        {[
          { id: 'reconciliation', label: 'Payment Checking (Cashfree)', icon: FileSpreadsheet },
          { id: 'analytics', label: 'Analytics & Sales', icon: BarChart3 },
          { id: 'menu', label: 'Menu & Stock', icon: Utensils },
          { id: 'settings', label: 'Slots & Rules', icon: Settings },
          { id: 'roles', label: 'Staff & Customers', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                active ? 'mac-pill-active' : 'mac-pill-inactive'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ANALYTICS & SALES */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Today&apos;s Orders</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {analyticsData.todayOrdersCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {analyticsData.validOrdersCount} active/completed · {analyticsData.refundedCount} refunded
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Today&apos;s Net Sales</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                ₹{analyticsData.todayRevenue}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Authoritative menu pricing
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Quiet-Slot Discount</p>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-600 tabular-nums">
                ₹{settings.quietSlotDiscount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Server-calculated when peak ≥75%
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">No-Show Timeout</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {settings.noShowMinutes}m
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Auto-expires uncollected Ready orders
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Orders Per Pickup Slot Chart */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <h2 className="font-display text-base font-bold text-slate-900">
                Orders Per 10-Minute Pickup Slot
              </h2>
              <p className="text-xs text-slate-500">
                Live slot capacity utilization (Capacity: {settings.ordersPerSlot} orders per slot)
              </p>

              <div className="mt-5 space-y-3">
                {slots.slice(0, 6).map((slot) => {
                  const pct = Math.min(100, Math.round((slot.bookedCount / slot.capacity) * 100));
                  return (
                    <div key={slot.slotId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-800 tabular-nums">
                          {slot.label}
                        </span>
                        <span className="font-mono text-slate-600 tabular-nums">
                          {slot.bookedCount} / {slot.capacity} booked ({pct}%)
                          {slot.qualifiesForQuietDiscount ? ` · Quiet Slot (-₹${slot.discountAmount})` : ''}
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 75
                              ? 'bg-red-600'
                              : pct >= 50
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Best Sellers Ranking */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-5">
              <h2 className="font-display text-base font-bold text-slate-900">
                Today&apos;s Best Sellers
              </h2>
              <p className="text-xs text-slate-500">
                Ranked by portion quantity ordered today
              </p>

              <div className="mt-4 divide-y divide-slate-100">
                {analyticsData.bestSellers.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500">No items ordered yet today.</p>
                ) : (
                  analyticsData.bestSellers.map((item, idx) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between py-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-400 tabular-nums">
                          0{idx + 1}.
                        </span>
                        <span className="font-semibold text-slate-900">{item.name}</span>
                      </div>
                      <div className="font-mono text-slate-700 tabular-nums">
                        <strong>{item.qty} sold</strong> · ₹{item.revenue}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Category Revenue & Menu Stock Breakdown */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Category Revenue &amp; Live Stock Distribution
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time revenue share, portions sold, and active dish availability across all 4 South Indian kitchen stations
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {analyticsData.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-slate-900">
                        {cat.category}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-700 tabular-nums">
                        {cat.revenueSharePercent}% share
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums">
                      ₹{cat.revenue}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                      {cat.portionsSold} portions sold · {cat.inStockItems}/{cat.totalItems} in stock
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${Math.max(6, cat.revenueSharePercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Interactive Last 7 Days of Sales Chart */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Interactive 7-Day Canteen Sales Explorer
                </h2>
                <p className="text-xs text-slate-500">
                  Click any day bar below to inspect daily revenue, fulfilled orders, and average order value
                </p>
              </div>
              {analyticsData.sevenDays[selectedDayIdx] && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-xs">
                  <span className="font-bold text-slate-900">
                    {analyticsData.sevenDays[selectedDayIdx].day} ({analyticsData.sevenDays[selectedDayIdx].date})
                  </span>
                  <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    ₹{analyticsData.sevenDays[selectedDayIdx].revenue}
                  </span>
                  <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                  <span className="font-mono text-slate-700 tabular-nums">
                    {analyticsData.sevenDays[selectedDayIdx].orders} orders (Avg ₹
                    {Math.round(
                      analyticsData.sevenDays[selectedDayIdx].revenue /
                        Math.max(1, analyticsData.sevenDays[selectedDayIdx].orders)
                    )}
                    /order)
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-7">
              {analyticsData.sevenDays.map((day, idx) => {
                const maxRev = Math.max(7000, ...analyticsData.sevenDays.map((d) => d.revenue));
                const heightPct = Math.min(100, Math.max(15, Math.round((day.revenue / maxRev) * 100)));
                const isSelected = selectedDayIdx === idx;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    aria-pressed={isSelected}
                    className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-slate-900 bg-amber-50/50 ring-2 ring-amber-500/40'
                        : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex h-28 w-full items-end justify-center pb-2">
                      <div
                        className={`w-full max-w-[36px] rounded-t-xl transition-all duration-300 ${
                          isSelected ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <div className="w-full border-t border-slate-200 pt-2 text-center">
                      <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                        ₹{day.revenue}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {day.orders} orders
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-700">
                        {day.day}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: MENU & STOCK CRUD */}
      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Add / Edit Item Form */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <h2 className="font-display text-base font-bold text-slate-900">
              {editingItemId ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h2>
            <p className="text-xs text-slate-500">
              Changes sync immediately to the student menu and Firestore
            </p>

            {menuBanner && (
              <div
                role="status"
                className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900"
              >
                {menuBanner}
              </div>
            )}

            <form onSubmit={handleSaveMenuForm} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="item-name" className="block text-xs font-semibold text-slate-700">
                  Dish Name
                </label>
                <input
                  id="item-name"
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Rava Onion Masala Dosa"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-price" className="block text-xs font-semibold text-slate-700">
                    Price (₹)
                  </label>
                  <input
                    id="item-price"
                    type="number"
                    min={1}
                    max={2000}
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="item-prep" className="block text-xs font-semibold text-slate-700">
                    Prep Time (mins)
                  </label>
                  <input
                    id="item-prep"
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={itemPrepTime}
                    onChange={(e) => setItemPrepTime(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-category" className="block text-xs font-semibold text-slate-700">
                    Category
                  </label>
                  <select
                    id="item-category"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value as MenuItem['category'])}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    <option value="Dosa & Idli">Dosa &amp; Idli</option>
                    <option value="Rice & Meals">Rice &amp; Meals</option>
                    <option value="Snacks & Vada">Snacks &amp; Vada</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Dietary Type
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(true)}
                      className={`min-h-[44px] rounded-xl border text-xs font-semibold cursor-pointer ${
                        itemIsVeg
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(false)}
                      className={`min-h-[44px] rounded-xl border text-xs font-semibold cursor-pointer ${
                        !itemIsVeg
                          ? 'border-red-700 bg-red-700 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="item-desc" className="block text-xs font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  id="item-desc"
                  rows={2}
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Describe ingredients and accompaniments..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs font-semibold text-slate-700">
                  Available for Ordering
                </span>
                <input
                  type="checkbox"
                  checked={itemAvailable}
                  onChange={(e) => setItemAvailable(e.target.checked)}
                  className="h-5 w-5 accent-slate-900"
                  aria-label="Available for ordering"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingItemId ? 'Update Dish' : 'Add Dish to Menu'}</span>
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={resetMenuForm}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Existing Menu List */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <h2 className="font-display text-base font-bold text-slate-900">
              Canteen Menu Items ({menu.length})
            </h2>
            <p className="text-xs text-slate-500">
              Tap Edit to modify details or toggle stock availability
            </p>

            <div className="mt-4 divide-y divide-slate-100">
              {menu.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold ${
                          item.isVeg ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        [{item.isVeg ? 'VEG' : 'NON-VEG'}]
                      </span>
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        ₹{item.price}
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-500">
                      {item.category} · {item.prepTimeMinutes}m prep
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleMenuItemAvailability(item.id, !item.available)}
                      className={`min-h-[38px] rounded-xl px-3 py-1.5 font-semibold cursor-pointer ${
                        item.available
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {item.available ? 'Available' : 'Sold Out'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditMenuItem(item)}
                      aria-label={`Edit ${item.name}`}
                      className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMenuItem(item.id)}
                      aria-label={`Delete ${item.name}`}
                      className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: SLOTS, HOURS, NO-SHOW & QUIET-SLOT DISCOUNT SETTINGS */}
      {activeTab === 'settings' && (
        <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Canteen Hours, Slot Capacity &amp; Pricing Rules
          </h2>
          <p className="text-xs text-slate-500">
            Configure opening hours, 10-minute slot capacity, automatic no-show expiry, and server-side quiet-slot discounts
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="open-time" className="block text-xs font-semibold text-slate-700">
                Opening Time (24h)
              </label>
              <input
                id="open-time"
                type="time"
                value={settings.openTime}
                onChange={(e) => updateSettings({ openTime: e.target.value })}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="close-time" className="block text-xs font-semibold text-slate-700">
                Closing Time (24h)
              </label>
              <input
                id="close-time"
                type="time"
                value={settings.closeTime}
                onChange={(e) => updateSettings({ closeTime: e.target.value })}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="slot-cap" className="block text-xs font-semibold text-slate-700">
                Max Orders Per 10-Min Slot
              </label>
              <input
                id="slot-cap"
                type="number"
                min={1}
                max={50}
                value={settings.ordersPerSlot}
                onChange={(e) =>
                  updateSettings({ ordersPerSlot: Math.max(1, Number(e.target.value) || 4) })
                }
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="noshow-mins" className="block text-xs font-semibold text-slate-700">
                No-Show Auto-Expiry (Minutes in Ready)
              </label>
              <input
                id="noshow-mins"
                type="number"
                min={1}
                max={120}
                value={settings.noShowMinutes}
                onChange={(e) =>
                  updateSettings({ noShowMinutes: Math.max(1, Number(e.target.value) || 20) })
                }
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="quiet-disc" className="block text-xs font-semibold text-slate-700">
                Quiet-Slot Discount Amount (₹)
              </label>
              <input
                id="quiet-disc"
                type="number"
                min={0}
                max={100}
                value={settings.quietSlotDiscount}
                onChange={(e) =>
                  updateSettings({ quietSlotDiscount: Math.max(0, Number(e.target.value) || 0) })
                }
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => updateSettings({ testMode: !settings.testMode })}
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                TEST_MODE Flag: {settings.testMode ? 'ON (Test Pay)' : 'OFF (Live Cashfree)'}
              </button>
            </div>
          </div>

          {/* Customizable Per-Hour (60m) or Per-30-Min (30m) Order Cap for Canteen Owner */}
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Canteen Order Rate Limit (Per-Hour / Per-30-Minute Cap)
                </h3>
                <p className="text-xs text-slate-600">
                  Restrict total incoming student orders per hour or per 30 minutes (Default: 30 orders / hour). Synchronized live with Kitchen KDS.
                </p>
              </div>
              <span className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-mono text-xs font-bold text-amber-800">
                Live: {orderRateLimit.ordersInWindow} / {orderRateLimit.maxOrders} ({orderRateLimit.shortWindowLabel})
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Rate Limit Time Window
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ rateLimitWindowMinutes: 60 })}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                      (settings.rateLimitWindowMinutes ?? 60) === 60
                        ? 'border-slate-900 bg-slate-900 text-amber-300 shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Per 1 Hour (60m)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ rateLimitWindowMinutes: 30 })}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                      settings.rateLimitWindowMinutes === 30
                        ? 'border-slate-900 bg-slate-900 text-amber-300 shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Per 30 Mins (30m)
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="admin-max-orders-window" className="block text-xs font-semibold text-slate-700">
                  Max Orders Allowed ({orderRateLimit.windowLabel})
                </label>
                <input
                  id="admin-max-orders-window"
                  type="number"
                  min={1}
                  max={500}
                  value={settings.maxOrdersPerWindow ?? 30}
                  onChange={(e) =>
                    updateSettings({
                      maxOrdersPerWindow: Math.max(1, Math.min(500, Number(e.target.value) || 30)),
                    })
                  }
                  className="mt-1.5 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '15 / 30m', win: 30 as const, max: 15 },
                  { label: '30 / 1h (Default)', win: 60 as const, max: 30 },
                  { label: '45 / 1h', win: 60 as const, max: 45 },
                  { label: '60 / 1h', win: 60 as const, max: 60 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      updateSettings({
                        rateLimitWindowMinutes: preset.win,
                        maxOrdersPerWindow: preset.max,
                      })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {orders.length > 0 && (
                <button
                  type="button"
                  onClick={() => void clearAllOrders()}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  Clear All Kitchen Orders (0)
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: STAFF ACCOUNTS, WEBSITE LINKS & CUSTOMER DIRECTORY */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* 1. Separate Website Links & Default Unique Access Credentials */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  3 Separate Website Links &amp; Unique Staff Credentials
                </h2>
                <p className="text-xs text-slate-500">
                  Share each dedicated URL with the corresponding campus group. Kitchen and Admin portals require unique ID + Password login.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Website 1: Student Ordering */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase text-amber-700">
                      1. Student Ordering Website
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <p className="mt-1.5 break-all font-mono text-xs font-semibold text-slate-900">
                    {buildPortalShareUrl(PUBLIC_ORIGIN, 'order')}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-600">
                    Access: All SAPTHAGIRI NPS UNIVERSITY students &amp; faculty (<code className="font-mono">@snpsu.edu.in</code>)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToPortal('order')}
                  className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Ordering Website</span>
                </button>
              </div>

              {/* Website 2: Kitchen Portal */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase text-emerald-700">
                      2. Kitchen Website
                    </span>
                    <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <p className="mt-1.5 break-all font-mono text-xs font-semibold text-slate-900">
                    {buildPortalShareUrl(PUBLIC_ORIGIN, 'kitchen')}
                  </p>
                  <div className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-700">
                    <p>
                      Unique Kitchen ID: <strong>{DEFAULT_KITCHEN_CREDENTIALS.uniqueId}</strong>
                    </p>
                    <p>
                      Kitchen Password: <strong>{DEFAULT_KITCHEN_CREDENTIALS.password}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToPortal('kitchen')}
                  className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Kitchen Website</span>
                </button>
              </div>

              {/* Website 3: Payment Checking & Admin */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase text-sky-700">
                      3. Payment &amp; Admin Website
                    </span>
                    <KeyRound className="h-3.5 w-3.5 text-sky-600" />
                  </div>
                  <p className="mt-1.5 break-all font-mono text-xs font-semibold text-slate-900">
                    {buildPortalShareUrl(PUBLIC_ORIGIN, 'admin')}
                  </p>
                  <div className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-700">
                    <p>
                      Unique Admin ID: <strong>{DEFAULT_ADMIN_CREDENTIALS.uniqueId}</strong>
                    </p>
                    <p>
                      Admin Password: <strong>{DEFAULT_ADMIN_CREDENTIALS.password}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToPortal('admin')}
                  className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Admin Website</span>
                </button>
              </div>
            </div>
          </section>

          {roleMessage && (
            <div
              role="status"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-950"
            >
              {roleMessage}
            </div>
          )}

          {/* 2. Add or Remove Kitchen & Admin Accounts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Add New Kitchen or Admin Account Form */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-slate-900" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Add Kitchen or Admin Account
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Create a new Kitchen or Admin account with its own unique Staff/Admin ID and password
              </p>

              <form onSubmit={handleAddStaffSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label htmlFor="staff-name" className="block text-xs font-semibold text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="staff-name"
                    type="text"
                    required
                    value={staffFullName}
                    onChange={(e) => setStaffFullName(e.target.value)}
                    placeholder="e.g. Chef Senthil Kumar"
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="staff-email" className="block text-xs font-semibold text-slate-700">
                    Email Address
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="chef.senthil@snpsu.edu.in"
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="staff-id" className="block text-xs font-semibold text-slate-700">
                      Unique Staff / Admin ID
                    </label>
                    <input
                      id="staff-id"
                      type="text"
                      required
                      value={staffUniqueId}
                      onChange={(e) => setStaffUniqueId(e.target.value)}
                      placeholder="SAP-KIT-102"
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="staff-pass" className="block text-xs font-semibold text-slate-700">
                      Unique Password
                    </label>
                    <input
                      id="staff-pass"
                      type="text"
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="KitchenPass@2026"
                      className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="staff-role-select" className="block text-xs font-semibold text-slate-700">
                    Account Role
                  </label>
                  <select
                    id="staff-role-select"
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as 'kitchen' | 'admin')}
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900"
                  >
                    <option value="kitchen">Kitchen Staff (/kitchen)</option>
                    <option value="admin">Canteen Admin (/admin)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add {staffRole === 'kitchen' ? 'Kitchen' : 'Admin'} Account</span>
                </button>
              </form>

              {/* Quick Promote Existing Email */}
              <form onSubmit={handleRoleSubmit} className="mt-6 border-t border-slate-200 pt-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-800">
                  Or Change Existing Account Role by Email
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    id="role-email"
                    type="email"
                    required
                    aria-label="User Email Address"
                    value={roleEmail}
                    onChange={(e) => setRoleEmail(e.target.value)}
                    placeholder="student@snpsu.edu.in"
                    className="min-h-[40px] w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                  />
                  <select
                    id="role-select"
                    aria-label="Target Role"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as UserRole)}
                    className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                  >
                    <option value="kitchen">Kitchen Staff (kitchen)</option>
                    <option value="admin">Canteen Admin (admin)</option>
                    <option value="customer">Customer / Student (customer)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  Update Role by Email
                </button>
              </form>
            </section>

            {/* Active Kitchen & Admin Staff Roster (with Remove button) */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <h2 className="font-display text-base font-bold text-slate-900">
                Active Kitchen &amp; Admin Staff Accounts ({staffUsers.length})
              </h2>
              <p className="text-xs text-slate-500">
                Manage authorized Kitchen and Admin personnel. Removing a staff account revokes portal access immediately.
              </p>

              <div className="mt-4 divide-y divide-slate-100">
                {staffUsers.length === 0 ? (
                  <p className="py-6 text-xs text-slate-500">
                    No kitchen or admin staff accounts found.
                  </p>
                ) : (
                  staffUsers.map((u) => {
                    const isSelf = currentUser?.uid === u.uid;
                    return (
                      <div
                        key={u.uid}
                        className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900">{u.fullName}</span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                              ID: {u.studentStaffId}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-sky-100 text-sky-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                          <p className="font-mono text-slate-500">
                            {u.email}
                            {u.accessPassword ? ` · Pass: ${u.accessPassword}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateUserRoleByEmail(
                                u.email,
                                u.role === 'kitchen' ? 'admin' : 'kitchen'
                              )
                            }
                            className="min-h-[36px] rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Switch to {u.role === 'kitchen' ? 'Admin' : 'Kitchen'}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleRemoveStaffClick(u.uid)}
                            aria-label={`Remove ${u.fullName}`}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{isSelf ? 'Current Admin' : 'Remove'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* 3. Complete Customer Directory & All Customer Details */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Customers &amp; Complete Order Details ({customerDirectory.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Full student/faculty profile details, roll/staff ID, college email, total spend, and itemized order history
                </p>
              </div>

              <div className="w-full sm:w-72">
                <input
                  type="search"
                  aria-label="Search customers by name, ID or email"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search name, roll ID, or email..."
                  className="min-h-[40px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {customerDirectory.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No matching customers found.
                </p>
              ) : (
                customerDirectory.map((cust) => (
                  <div
                    key={cust.uid}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-bold text-slate-900">
                            {cust.fullName}
                          </h3>
                          <span className="rounded-lg bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                            ID: {cust.studentStaffId}
                          </span>
                          <span className="font-mono text-xs text-slate-600">
                            {cust.email}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Account UID: <span className="font-mono">{cust.uid}</span>
                          {cust.lastOrderToken !== null
                            ? ` · Latest Token #${cust.lastOrderToken} (${cust.lastOrderStatus?.toUpperCase()})`
                            : ' · No orders placed yet'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-right">
                          <p className="text-[10px] font-semibold uppercase text-slate-400">
                            Orders
                          </p>
                          <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                            {cust.totalOrdersCount} total ({cust.activeOrdersCount} active · {cust.completedOrdersCount} done)
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-right">
                          <p className="text-[10px] font-semibold uppercase text-slate-400">
                            Total Spend
                          </p>
                          <p className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                            ₹{cust.totalSpent}
                            {cust.totalDiscountSaved > 0
                              ? ` (Saved ₹${cust.totalDiscountSaved})`
                              : ''}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => updateUserRoleByEmail(cust.email, 'kitchen')}
                          className="min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          Promote to Kitchen
                        </button>
                      </div>
                    </div>

                    {/* Customer's Itemized Orders */}
                    {cust.orders.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Customer Order History ({cust.orders.length})
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {cust.orders.map((ord) => (
                            <div
                              key={ord.id}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-mono font-bold text-slate-900">
                                  Token #{ord.tokenNumber} · {ord.status.toUpperCase()}
                                </p>
                                <p className="truncate text-[11px] text-slate-600">
                                  {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                                </p>
                                <p className="font-mono text-[10px] text-slate-400">
                                  Slot {formatTime12Hour(ord.slotTime)} · {ord.orderType}
                                  {ord.tableNumber ? ` (Table ${ord.tableNumber})` : ''}
                                </p>
                              </div>
                              <div className="text-right font-mono shrink-0">
                                <p className="font-bold text-slate-900 tabular-nums">
                                  ₹{ord.totalAmount}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {ord.refundStatus !== 'none'
                                    ? 'Auto Refunded'
                                    : ord.paymentMode === 'cashfree'
                                    ? 'Paid · Cashfree'
                                    : 'Paid · Test'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: DAILY CASHFREE RECONCILIATION */}
      {activeTab === 'reconciliation' && (
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Daily Cashfree Payment &amp; Settlement Reconciliation
              </h2>
              <p className="text-xs text-slate-500">
                Server-side comparison of paid Firestore orders vs. Cashfree gateway captures &amp; refunds
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSimulateDiscrepancies((prev) => !prev)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>
                  {simulateDiscrepancies
                    ? 'Showing Sample Gateway Mismatches'
                    : 'Strict Live Ledger Only'}
                </span>
              </button>
            </div>
          </div>

          {reconcileSummary && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">Records Checked</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {reconcileSummary.totalChecked}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3.5">
                <p className="text-xs text-emerald-800">Verified Matched</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-900 tabular-nums">
                  {reconcileSummary.matchedCount}
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 p-3.5">
                <p className="text-xs text-red-800">Mismatches Highlighted</p>
                <p className="mt-1 font-mono text-xl font-bold text-red-900 tabular-nums">
                  {reconcileSummary.mismatchCount}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-xs text-slate-500">DB vs Cashfree Net</p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                  ₹{reconcileSummary.dbTotalRevenue} vs ₹{reconcileSummary.cfTotalCaptured}
                </p>
              </div>
            </div>
          )}

          {/* Interactive Filter & Audit Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: `All Records (${reconciliationRows.length})` },
                  {
                    id: 'matched',
                    label: `Matched (${reconciliationRows.filter((r) => r.reconciliationStatus === 'MATCHED').length})`,
                  },
                  {
                    id: 'mismatch',
                    label: `Mismatches Only (${reconciliationRows.filter((r) => r.reconciliationStatus !== 'MATCHED').length})`,
                  },
                ] as const
              ).map((pill) => {
                const active = reconcileFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setReconcileFilter(pill.id)}
                    className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      active ? 'mac-pill-active' : 'mac-pill-inactive'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="search"
                aria-label="Filter reconciliation rows by token, order ID, or student email"
                value={reconcileSearch}
                onChange={(e) => setReconcileSearch(e.target.value)}
                placeholder="Search Token #, Order ID, or Email..."
                className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {reconcileLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Reconciling database orders with Cashfree gateway...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-semibold">Token &amp; Order ID</th>
                    <th className="px-4 py-3 font-semibold">Student Email</th>
                    <th className="px-4 py-3 font-semibold">Slot</th>
                    <th className="px-4 py-3 text-right font-semibold">DB Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Cashfree Amount</th>
                    <th className="px-4 py-3 font-semibold">Reconciliation Status</th>
                    <th className="py-3 pl-4 font-semibold">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReconciliationRows.map((row) => {
                    const isMismatch = row.reconciliationStatus !== 'MATCHED';
                    return (
                      <tr
                        key={row.orderId}
                        className={isMismatch ? 'bg-red-50/70' : 'hover:bg-slate-50'}
                      >
                        <td className="py-3.5 pr-4 font-mono font-bold text-slate-900 tabular-nums">
                          #{row.tokenNumber} · {row.orderId}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{row.customerEmail}</td>
                        <td className="px-4 py-3.5 font-mono text-slate-600 tabular-nums">
                          {row.slotTime !== '--:--' ? formatTime12Hour(row.slotTime) : '--:--'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ₹{row.dbAmount}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {row.cfCapturedAmount !== null ? `₹${row.cfCapturedAmount}` : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-xs font-bold ${
                              isMismatch ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            {isMismatch ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                            {row.reconciliationStatus}
                          </span>
                        </td>
                        <td className="py-3.5 pl-4 text-slate-600">{row.discrepancyNote}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
