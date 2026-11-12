import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Timer,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import {
  calculateStartCookingUrgency,
  formatTime12Hour,
  generateGstTaxBill,
  parseTimeToMinutes,
  type CanteenOrder,
  type RateLimitWindowMinutes,
} from '../utils/canteenLogic';
import { PhysicalGstBillModal } from './PhysicalGstBillModal';

type UrgencyFilter = 'all' | 'red' | 'amber' | 'green' | 'ready';

export const KitchenQueueView: React.FC = () => {
  const {
    currentUser,
    navigateToPortal,
    orders,
    menu,
    settings,
    orderRateLimit,
    updateSettings,
    advanceKitchenOrderStatus,
    rejectKitchenOrderWithRefund,
    simulateOrderAgedReadyForNoShow,
    toggleMenuItemAvailability,
    clearAllOrders,
  } = useCanteen();

  const [filterTab, setFilterTab] = useState<'active' | 'completed'>('active');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [queueSearch, setQueueSearch] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [printedBillOrderId, setPrintedBillOrderId] = useState<string | null>(null);

  // Restrict access to kitchen and admin roles only
  if (!currentUser || (currentUser.role !== 'kitchen' && currentUser.role !== 'admin')) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="mt-3 font-display text-xl font-bold text-red-950">
          Kitchen Access Restricted
        </h2>
        <p className="mt-1 text-xs text-red-700">
          This live order preparation queue is accessible to Kitchen Staff and Canteen Admins only.
        </p>
      </div>
    );
  }

  // Sort live queue by ready-by time (slotTime ascending, then tokenNumber ascending)
  const activeOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready')
      .sort((a, b) => {
        const diff = parseTimeToMinutes(a.slotTime) - parseTimeToMinutes(b.slotTime);
        return diff !== 0 ? diff : a.tokenNumber - b.tokenNumber;
      });
  }, [orders]);

  // Compute urgency counts for live visualization
  const urgencyBreakdown = useMemo(() => {
    let red = 0;
    let amber = 0;
    let green = 0;
    let ready = 0;
    for (const order of activeOrders) {
      if (order.status === 'ready') {
        ready += 1;
      } else {
        const u = calculateStartCookingUrgency(order.slotTime, order.maxPrepTimeMinutes).urgency;
        if (u === 'red') red += 1;
        else if (u === 'amber') amber += 1;
        else green += 1;
      }
    }
    return { red, amber, green, ready, total: activeOrders.length };
  }, [activeOrders]);

  const displayedActiveOrders = useMemo(() => {
    return activeOrders.filter((order) => {
      if (urgencyFilter === 'ready') {
        if (order.status !== 'ready') return false;
      } else if (urgencyFilter !== 'all') {
        if (order.status === 'ready') return false;
        const u = calculateStartCookingUrgency(order.slotTime, order.maxPrepTimeMinutes).urgency;
        if (u !== urgencyFilter) return false;
      }
      if (queueSearch.trim()) {
        const q = queueSearch.trim().toLowerCase();
        const matchesToken = String(order.tokenNumber).includes(q);
        const matchesUser =
          order.userName.toLowerCase().includes(q) ||
          order.studentStaffId.toLowerCase().includes(q);
        const matchesDish = order.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesToken && !matchesUser && !matchesDish) return false;
      }
      return true;
    });
  }, [activeOrders, urgencyFilter, queueSearch]);

  const completedOrders = useMemo(() => {
    return orders
      .filter(
        (o) =>
          o.status === 'collected' ||
          o.status === 'cancelled' ||
          o.status === 'rejected' ||
          o.status === 'no_show'
      )
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [orders]);

  const handleAcceptAndPrintBill = async (order: CanteenOrder) => {
    await advanceKitchenOrderStatus(order.id, 'preparing');
    const bill = generateGstTaxBill({ ...order, status: 'preparing' });
    setPrintedBillOrderId(order.id);
    setFeedbackBanner(
      `Order #${order.tokenNumber} accepted! Generated 80mm Physical GST Tax Invoice (${bill.invoiceNumber}) & Counter Collection Token #${order.tokenNumber} for student pickup.`
    );
  };

  const handleReject = async (orderId: string, tokenNumber: number) => {
    await rejectKitchenOrderWithRefund(
      orderId,
      'Rejected by kitchen — automatic Cashfree refund issued'
    );
    setFeedbackBanner(
      `Order #${tokenNumber} rejected. Server-side Cashfree refund processed automatically.`
    );
  };

  const handleStockToggle = async (itemId: string, itemName: string, nextAvailable: boolean) => {
    await toggleMenuItemAvailability(itemId, nextAvailable);
    setFeedbackBanner(
      nextAvailable
        ? `${itemName} marked back in stock.`
        : `${itemName} marked Sold Out. Any unstarted 'placed' orders with this item were automatically refunded via Cashfree.`
    );
  };

  const handleRateWindowChange = async (windowMinutes: RateLimitWindowMinutes) => {
    await updateSettings({ rateLimitWindowMinutes: windowMinutes });
    setFeedbackBanner(
      `Kitchen order window updated to Per ${windowMinutes === 30 ? '30 Minutes' : '1 Hour'} (max ${orderRateLimit.maxOrders} orders).`
    );
  };

  const handleMaxOrdersChange = async (nextMax: number) => {
    const clamped = Math.min(500, Math.max(1, Math.floor(nextMax)));
    await updateSettings({ maxOrdersPerWindow: clamped });
  };

  const applyRatePreset = async (windowMinutes: RateLimitWindowMinutes, maxOrders: number) => {
    await updateSettings({
      rateLimitWindowMinutes: windowMinutes,
      maxOrdersPerWindow: maxOrders,
    });
    setFeedbackBanner(
      `Applied preset: Max ${maxOrders} orders per ${windowMinutes === 30 ? '30 Minutes' : '1 Hour'}.`
    );
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-amber-600" />
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Live Kitchen Preparation Queue
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Zero pre-seeded orders · Only real student orders appear here sorted by Ready-by pickup slot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {orders.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                await clearAllOrders();
                setFeedbackBanner('Cleared all orders — Kitchen queue reset to 0 orders.');
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Reset Queue (0)</span>
            </button>
          )}

          <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              aria-pressed={filterTab === 'active'}
              onClick={() => setFilterTab('active')}
              className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                filterTab === 'active'
                  ? 'mac-pill-active'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Queue ({activeOrders.length})
            </button>
            <button
              type="button"
              aria-pressed={filterTab === 'completed'}
              onClick={() => setFilterTab('completed')}
              className={`min-h-[40px] rounded-xl px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                filterTab === 'completed'
                  ? 'mac-pill-active'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              History &amp; Refunds ({completedOrders.length})
            </button>
          </div>
        </div>
      </div>

      {/* Kitchen-Friendly Customizable Per-Hour / Per-30-Minute Order Acceptance Limit Controller */}
      <section
        aria-label="Kitchen Order Rate Limit Controller"
        className="mac-glass-card rounded-3xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-amber-600" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Customizable Kitchen Order Limit (Per-Hour / Per-30-Min Cap)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Restrict how many orders the kitchen accepts per 1 Hour or per 30 Minutes (default: 30 orders/hour). Fully customizable by Kitchen Staff &amp; Canteen Owner.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Window Selector: Per 1 Hour vs Per 30 Minutes */}
            <div
              role="group"
              aria-label="Order rate limit window"
              className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1"
            >
              <button
                type="button"
                aria-pressed={orderRateLimit.windowMinutes === 60}
                onClick={() => handleRateWindowChange(60)}
                className={`min-h-[36px] rounded-xl px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  orderRateLimit.windowMinutes === 60
                    ? 'mac-pill-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per 1 Hour (60m)
              </button>
              <button
                type="button"
                aria-pressed={orderRateLimit.windowMinutes === 30}
                onClick={() => handleRateWindowChange(30)}
                className={`min-h-[36px] rounded-xl px-3 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  orderRateLimit.windowMinutes === 30
                    ? 'mac-pill-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Per 30 Minutes (30m)
              </button>
            </div>
          </div>
        </div>

        {/* Customizer Controls Row: Steppers + Slider + Quick Presets */}
        <div className="grid grid-cols-1 gap-4 pt-1 lg:grid-cols-12 lg:items-center">
          {/* Left: Stepper + Direct Input */}
          <div className="flex flex-wrap items-center gap-2.5 lg:col-span-5">
            <span className="text-xs font-semibold text-slate-700">
              Max Orders / {orderRateLimit.windowLabel}:
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => handleMaxOrdersChange(orderRateLimit.maxOrders - 5)}
                aria-label="Decrease order limit by 5"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                aria-label="Maximum orders per window"
                min={1}
                max={500}
                value={orderRateLimit.maxOrders}
                onChange={(e) => handleMaxOrdersChange(Number(e.target.value) || 30)}
                className="h-9 w-16 rounded-xl border border-slate-200 bg-white text-center font-mono text-sm font-bold text-slate-900 tabular-nums"
              />
              <button
                type="button"
                onClick={() => handleMaxOrdersChange(orderRateLimit.maxOrders + 5)}
                aria-label="Increase order limit by 5"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Middle: Range Slider */}
          <div className="lg:col-span-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Adjust Capacity Slider</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {orderRateLimit.maxOrders} orders / {orderRateLimit.shortWindowLabel}
              </span>
            </div>
            <input
              type="range"
              aria-label="Slide to customize kitchen order cap"
              min={1}
              max={120}
              step={1}
              value={Math.min(120, orderRateLimit.maxOrders)}
              onChange={(e) => handleMaxOrdersChange(Number(e.target.value))}
              className="mt-1.5 w-full"
            />
          </div>

          {/* Right: 1-Tap Kitchen Presets */}
          <div className="flex flex-wrap items-center gap-1.5 lg:col-span-3 lg:justify-end">
            {(
              [
                { w: 30 as const, max: 15, label: '15 / 30m' },
                { w: 60 as const, max: 30, label: '30 / 1h (Default)' },
                { w: 60 as const, max: 45, label: '45 / 1h' },
                { w: 60 as const, max: 60, label: '60 / 1h' },
              ]
            ).map((preset) => {
              const isSelected =
                orderRateLimit.windowMinutes === preset.w &&
                orderRateLimit.maxOrders === preset.max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyRatePreset(preset.w, preset.max)}
                  className={`min-h-[34px] rounded-xl border px-2.5 py-1 font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    isSelected ? 'mac-pill-active' : 'mac-pill-inactive'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Utilization Meter */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              {orderRateLimit.statusSummary}
            </span>
            <span
              className={`font-mono font-bold tabular-nums ${
                orderRateLimit.isLimitReached
                  ? 'text-red-700'
                  : orderRateLimit.isNearLimit
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              {orderRateLimit.utilizationPercent}% of {orderRateLimit.windowLabel} cap used
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                orderRateLimit.isLimitReached
                  ? 'bg-red-600'
                  : orderRateLimit.isNearLimit
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.max(3, orderRateLimit.utilizationPercent)}%` }}
            />
          </div>
        </div>
      </section>

      {feedbackBanner && (
        <div
          role="status"
          className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-950"
        >
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-bold text-emerald-800 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live Kitchen Station Load Visualization & Interactive Urgency Filters */}
      {filterTab === 'active' && (
        <div className="mac-glass-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Real-Time Station Urgency Distribution
              </h2>
              <p className="text-xs text-slate-500">
                Click any urgency bucket below to isolate tickets or search by token / dish
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Filter kitchen queue by token or dish"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search Token # or Dish..."
                className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Stacked Proportion Bar */}
          {urgencyBreakdown.total > 0 && (
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 flex">
              {urgencyBreakdown.red > 0 && (
                <div
                  style={{ width: `${(urgencyBreakdown.red / urgencyBreakdown.total) * 100}%` }}
                  className="bg-red-600 transition-all duration-300"
                  title={`Urgent: ${urgencyBreakdown.red}`}
                />
              )}
              {urgencyBreakdown.amber > 0 && (
                <div
                  style={{ width: `${(urgencyBreakdown.amber / urgencyBreakdown.total) * 100}%` }}
                  className="bg-amber-500 transition-all duration-300"
                  title={`Approaching: ${urgencyBreakdown.amber}`}
                />
              )}
              {urgencyBreakdown.green > 0 && (
                <div
                  style={{ width: `${(urgencyBreakdown.green / urgencyBreakdown.total) * 100}%` }}
                  className="bg-emerald-500 transition-all duration-300"
                  title={`On Schedule: ${urgencyBreakdown.green}`}
                />
              )}
              {urgencyBreakdown.ready > 0 && (
                <div
                  style={{ width: `${(urgencyBreakdown.ready / urgencyBreakdown.total) * 100}%` }}
                  className="bg-sky-600 transition-all duration-300"
                  title={`Ready at Counter: ${urgencyBreakdown.ready}`}
                />
              )}
            </div>
          )}

          {/* Interactive Urgency Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `All Active (${urgencyBreakdown.total})` },
                { id: 'red', label: `Red · Cook Now (${urgencyBreakdown.red})` },
                { id: 'amber', label: `Amber · ≤5m (${urgencyBreakdown.amber})` },
                { id: 'green', label: `Green · >5m (${urgencyBreakdown.green})` },
                { id: 'ready', label: `Ready at Counter (${urgencyBreakdown.ready})` },
              ] as const
            ).map((pill) => {
              const active = urgencyFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setUrgencyFilter(pill.id)}
                  className={`min-h-[38px] rounded-xl border px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    active ? 'mac-pill-active' : 'mac-pill-inactive'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filterTab === 'active' ? (
        displayedActiveOrders.length === 0 ? (
          <div className="mac-glass-card rounded-3xl p-12 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              {activeOrders.length === 0
                ? 'Zero orders in kitchen queue — Ready for incoming student orders!'
                : 'No tickets match your current urgency/search filter'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {activeOrders.length === 0
                ? 'When you place an order on the Student Ordering screen, it appears here immediately so the kitchen can accept it and print the GST Token Bill.'
                : 'Reset the filter above to view all active kitchen tokens.'}
            </p>
            {activeOrders.length === 0 ? (
              <button
                type="button"
                onClick={() => navigateToPortal('order')}
                className="mac-pill-active mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Go to 1. Student Ordering to Place an Order</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setUrgencyFilter('all');
                  setQueueSearch('');
                }}
                className="mt-4 min-h-[40px] rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Show All Active Tickets ({activeOrders.length})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {displayedActiveOrders.map((order) => {
              const urgencyInfo = calculateStartCookingUrgency(
                order.slotTime,
                order.maxPrepTimeMinutes
              );

              const cardStyle =
                order.status === 'ready'
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : urgencyInfo.urgency === 'red'
                    ? 'border-red-300 bg-red-50/60'
                    : urgencyInfo.urgency === 'amber'
                      ? 'border-amber-300 bg-amber-50/60'
                      : 'border-emerald-200 bg-emerald-50/30';

              const badgeText =
                order.status === 'ready'
                  ? 'Ready at Counter — Awaiting Pickup'
                  : urgencyInfo.urgency === 'red'
                    ? `Urgent · ${urgencyInfo.countdownLabel}`
                    : urgencyInfo.urgency === 'amber'
                      ? `Approaching · ${urgencyInfo.countdownLabel}`
                      : `On Schedule · ${urgencyInfo.countdownLabel}`;


              return (
                <article
                  key={order.id}
                  className={`flex flex-col justify-between rounded-3xl border-2 p-5 shadow-xs ${cardStyle}`}
                >
                  <div>
                    {/* Top Row: Token, Order Type, Table Number, Ready-By */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-16 items-center justify-center rounded-2xl bg-slate-900 font-mono text-lg font-bold text-amber-400 tabular-nums">
                          #{order.tokenNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                            <span>
                              {order.orderType === 'dine_in' ? 'Dine-in' : 'Takeaway'}
                            </span>
                            {order.orderType === 'dine_in' && order.tableNumber && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-amber-800">
                                  Table {order.tableNumber}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            {order.userName} ({order.studentStaffId})
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] font-semibold text-slate-500">Ready-by</p>
                        <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                          {formatTime12Hour(order.slotTime)}
                        </p>
                      </div>
                    </div>

                    {/* Start Cooking At & Countdown Strip */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/90 px-3.5 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <Timer className="h-4 w-4 text-amber-600" />
                        <span>
                          Start cooking at{' '}
                          <strong className="font-mono tabular-nums">
                            {urgencyInfo.startCookingTimeStr}
                          </strong>{' '}
                          (max prep {order.maxPrepTimeMinutes}m)
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold tabular-nums ${
                          urgencyInfo.urgency === 'red'
                            ? 'text-red-700'
                            : urgencyInfo.urgency === 'amber'
                              ? 'text-amber-800'
                              : 'text-emerald-800'
                        }`}
                      >
                        {badgeText}
                      </span>
                    </div>

                    {/* Items to Prepare */}
                    <div className="mt-3.5 space-y-2 rounded-2xl bg-white p-3.5">
                      {order.items.map((item) => (
                        <div
                          key={item.itemId}
                          className="flex items-center justify-between text-sm font-semibold text-slate-900"
                        >
                          <span>
                            <strong className="font-mono text-amber-700 tabular-nums">
                              {item.quantity}×
                            </strong>{' '}
                            {item.name}
                          </span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            {item.prepTimeMinutes}m prep
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kitchen Workflow Buttons: Accept & Print GST Bill -> Mark ready -> Hand over */}
                  <div className="mt-4 space-y-2 pt-2">
                    {order.status === 'placed' && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptAndPrintBill(order)}
                          className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                        >
                          <Printer className="h-4 w-4 text-amber-400" />
                          <span>Accept &amp; Print GST Bill</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(order.id, order.tokenNumber)}
                          className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Reject &amp; Refund</span>
                        </button>
                      </div>
                    )}

                    {order.status === 'preparing' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => advanceKitchenOrderStatus(order.id, 'ready')}
                            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 cursor-pointer"
                          >
                            <Bell className="h-4 w-4" />
                            <span>Mark Ready</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(order.id, order.tokenNumber)}
                            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>Item Ran Out (Refund)</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPrintedBillOrderId(order.id)}
                          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5 text-amber-600" />
                          <span>View / Reprint Physical GST Bill &amp; Token #{order.tokenNumber}</span>
                        </button>
                      </div>
                    )}

                    {order.status === 'ready' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => advanceKitchenOrderStatus(order.id, 'collected')}
                            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span>Verify Token &amp; Hand Over</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => simulateOrderAgedReadyForNoShow(order.id)}
                            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Clock className="h-4 w-4 text-amber-600" />
                            <span>Mark No-Show ({settings.noShowMinutes}m+)</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPrintedBillOrderId(order.id)}
                          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5 text-amber-600" />
                          <span>View / Reprint Physical GST Bill &amp; Token #{order.tokenNumber}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {completedOrders.map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  #{order.tokenNumber}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                  <p className="text-slate-500">
                    {order.userName} · Slot {formatTime12Hour(order.slotTime)} · Status:{' '}
                    <strong className="uppercase">{order.status}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {order.status === 'collected' && (
                  <button
                    type="button"
                    onClick={() => setPrintedBillOrderId(order.id)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-amber-600" />
                    <span>GST Bill</span>
                  </button>
                )}
                <div className="text-right">
                  <p className="font-mono font-bold text-slate-900 tabular-nums">
                    ₹{order.totalAmount}
                  </p>
                  {order.refundStatus === 'processed' && (
                    <p className="font-mono text-[11px] font-semibold text-emerald-700">
                      Refunded ({order.refundId})
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Kitchen Stock Toggle Bar (Auto-Refunds unstarted orders if an item runs out) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="font-display text-base font-bold text-slate-900">
          Quick Kitchen Stock Switchboard
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Marking an item Sold Out immediately prevents new orders and triggers automatic server-side Cashfree refunds on any unstarted &apos;placed&apos; orders containing that item.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs"
            >
              <span className="truncate font-semibold text-slate-800">{item.name}</span>
              <button
                type="button"
                onClick={() => handleStockToggle(item.id, item.name, !item.available)}
                className={`min-h-[38px] rounded-xl px-3 py-1.5 font-semibold transition cursor-pointer whitespace-nowrap ${
                  item.available
                    ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                    : 'bg-red-100 text-red-900 hover:bg-red-200'
                }`}
              >
                {item.available ? 'In Stock' : 'Sold Out'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Physical 80mm Thermal GST Bill & Counter Token Modal */}
      <PhysicalGstBillModal
        order={orders.find((o) => o.id === printedBillOrderId) || null}
        onClose={() => setPrintedBillOrderId(null)}
        contextLabel="Kitchen KDS · Printed 80mm GST Bill & Student Collection Token"
      />
    </div>
  );
};
