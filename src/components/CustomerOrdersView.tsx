import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import {
  calculateOrderEtaAndProgress,
  formatTime12Hour,
  generateGstTaxBill,
  type CanteenOrder,
} from '../utils/canteenLogic';
import { PhysicalGstBillModal } from './PhysicalGstBillModal';

interface CustomerOrdersViewProps {
  onNavigateToMenu: () => void;
}

type OrderFilterTab = 'all' | 'active' | 'completed' | 'exception';

const DELIVERY_STAGE_LABELS = [
  'About to be accepted',
  'Order accepted',
  'Preparing',
  'Prepared',
];

export const CustomerOrdersView: React.FC<CustomerOrdersViewProps> = ({ onNavigateToMenu }) => {
  const {
    myOrders,
    settings,
    readyBannerOrder,
    dismissReadyBanner,
    cancelCustomerOrder,
    orderAgainFromPastOrder,
    stepActiveOrderDemoStage,
    pushPermission,
    pushAlertsEnabled,
    enableBrowserPushNotifications,
    togglePushAlertsEnabled,
    sendTestOrderReadyPush,
  } = useCanteen();

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderFilterTab>('all');
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [selectedBillOrderId, setSelectedBillOrderId] = useState<string | null>(null);

  const anyReadyOrders = myOrders.filter((o) => o.status === 'ready');

  const orderSummary = useMemo(() => {
    const activeCount = myOrders.filter(
      (o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready'
    ).length;
    const completedCount = myOrders.filter((o) => o.status === 'collected').length;
    const exceptionCount = myOrders.filter(
      (o) => o.status === 'cancelled' || o.status === 'rejected' || o.status === 'no_show'
    ).length;
    const validOrders = myOrders.filter(
      (o) => o.status !== 'cancelled' && o.status !== 'rejected'
    );
    const totalSpent = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalSaved = validOrders.reduce((sum, o) => sum + (o.discount || 0), 0);

    return {
      activeCount,
      completedCount,
      exceptionCount,
      totalSpent,
      totalSaved,
    };
  }, [myOrders]);

  const filteredOrders = useMemo(() => {
    return myOrders.filter((o) => {
      if (statusFilter === 'active') {
        return o.status === 'placed' || o.status === 'preparing' || o.status === 'ready';
      }
      if (statusFilter === 'completed') {
        return o.status === 'collected';
      }
      if (statusFilter === 'exception') {
        return o.status === 'cancelled' || o.status === 'rejected' || o.status === 'no_show';
      }
      return true;
    });
  }, [myOrders, statusFilter]);

  const handleCancelOrder = async (order: CanteenOrder) => {
    setCancellingId(order.id);
    setActionFeedback(null);
    try {
      await cancelCustomerOrder(order.id);
      setActionFeedback(
        `Token #${order.tokenNumber} cancelled. Automatic Cashfree refund of ₹${order.totalAmount} processed.`
      );
    } catch (err: unknown) {
      setActionFeedback(err instanceof Error ? err.message : 'Could not cancel order.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleOrderAgain = (order: CanteenOrder) => {
    const { addedCount, skippedNames } = orderAgainFromPastOrder(order);
    if (addedCount === 0) {
      setActionFeedback(
        `Could not re-order Token #${order.tokenNumber}: all items (${skippedNames.join(', ')}) are currently sold out.`
      );
      return;
    }
    if (skippedNames.length > 0) {
      setActionFeedback(
        `Added ${addedCount} available item(s) to cart. Skipped sold-out item(s): ${skippedNames.join(', ')}.`
      );
    }
    onNavigateToMenu();
  };

  const handleEnablePush = async () => {
    const perm = await enableBrowserPushNotifications();
    if (perm === 'granted') {
      setActionFeedback(
        'Browser Push Notifications enabled! You will be alerted immediately when your order moves from Preparing to Ready.'
      );
    } else if (perm === 'denied') {
      setActionFeedback(
        'Browser notification permission is blocked in your browser settings. In-app sound & banner alerts remain active.'
      );
    } else {
      setActionFeedback(
        'Ready Push Alerts enabled! You will receive a sound + banner alert (and OS push notification when permitted) as soon as Kitchen marks your order Ready.'
      );
    }
  };

  const handleTestReadyPush = async () => {
    await sendTestOrderReadyPush();
    setActionFeedback(
      'Sent a test "Order Ready for Collection" browser push notification + audio chime!'
    );
  };

  return (
    <div className="space-y-6 pb-36">
      {/* Big "Your order is ready" Banner */}
      {(readyBannerOrder || anyReadyOrders.length > 0) && (
        <div
          role="alert"
          className="rounded-3xl border-2 border-emerald-600 bg-emerald-950 p-6 text-white shadow-lg"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950">
                <BellRing className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide text-emerald-300">
                  Counter Pickup Alert · Push Notification Triggered
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-bold text-white">
                  Your order is ready!
                </h2>
                <p className="mt-1 text-xs text-emerald-100">
                  Please show Token{' '}
                  <span className="font-mono font-bold text-amber-300">
                    #{(readyBannerOrder || anyReadyOrders[0]).tokenNumber}
                  </span>{' '}
                  at the Saptien pickup counter within 20 minutes to avoid automatic no-show expiry.
                </p>
              </div>
            </div>
            {readyBannerOrder && (
              <button
                type="button"
                onClick={dismissReadyBanner}
                className="min-h-[44px] rounded-xl bg-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/25 cursor-pointer whitespace-nowrap"
              >
                Dismiss Alert
              </button>
            )}
          </div>
        </div>
      )}

      {/* Browser Push Notification Control Card (Preparing -> Ready Alert) */}
      <section
        aria-label="Browser Push Notification Settings"
        className="mac-glass-card flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:rounded-3xl sm:px-5"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              pushAlertsEnabled
                ? 'bg-emerald-500/20 text-emerald-700'
                : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            {pushAlertsEnabled ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-sm font-bold text-slate-900">
                Browser Push Notification (Preparing &rarr; Ready)
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  pushPermission === 'granted' && pushAlertsEnabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : pushAlertsEnabled
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pushPermission === 'granted' && pushAlertsEnabled
                  ? 'Browser Push Active'
                  : pushAlertsEnabled
                    ? 'Ready Alert Armed'
                    : 'Muted'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Automatically sends a browser push notification &amp; sound chime the moment Kitchen marks your order <strong>Ready</strong> for collection.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pushPermission === 'default' && (
            <button
              type="button"
              onClick={() => void handleEnablePush()}
              className="mac-pill-active min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Allow Browser Push
            </button>
          )}
          <button
            type="button"
            onClick={() => togglePushAlertsEnabled(!pushAlertsEnabled)}
            className="mac-pill-inactive min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            {pushAlertsEnabled ? 'Mute Alerts' : 'Unmute Alerts'}
          </button>
          <button
            type="button"
            onClick={() => void handleTestReadyPush()}
            className="mac-pill-inactive min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-700 cursor-pointer whitespace-nowrap"
          >
            Test Ready Push
          </button>
        </div>
      </section>

      {actionFeedback && (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-2xs"
        >
          {actionFeedback}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            My Canteen Orders
          </h1>
          <p className="text-xs text-slate-500">
            Live ETA &amp; 0–100% progress · About to be accepted → Order accepted → Preparing → Prepared
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToMenu}
          className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap"
        >
          + New Pre-Order
        </button>
      </div>

      {/* Personal Order Summary Metrics & Interactive Filter Bar */}
      {myOrders.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Total Tokens</p>
              <p className="mt-0.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {myOrders.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Active In Kitchen</p>
              <p className="mt-0.5 font-mono text-xl font-bold text-amber-600 tabular-nums">
                {orderSummary.activeCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Net Spend</p>
              <p className="mt-0.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
                ₹{orderSummary.totalSpent}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Campus Offer Saved</p>
              <p className="mt-0.5 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                ₹{orderSummary.totalSaved}
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Filter my orders by status"
            className="flex items-center gap-2 overflow-x-auto pb-1"
          >
            {(
              [
                { id: 'all', label: `All Orders (${myOrders.length})` },
                { id: 'active', label: `Active (${orderSummary.activeCount})` },
                { id: 'completed', label: `Collected (${orderSummary.completedCount})` },
                { id: 'exception', label: `Refunded / Expired (${orderSummary.exceptionCount})` },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[40px] rounded-xl border px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    active ? 'mac-pill-active' : 'mac-pill-inactive'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {myOrders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            No orders placed yet
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Pick your favorite South Indian tiffin items and place an instant campus pre-order.
          </p>
          <button
            type="button"
            onClick={onNavigateToMenu}
            className="mt-5 min-h-[44px] rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            Browse Menu
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="font-display text-base font-bold text-slate-900">
            No orders match this status filter
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="mt-3 min-h-[40px] rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Show All Orders
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const etaInfo = calculateOrderEtaAndProgress(order);
            const isTerminalException =
              order.status === 'cancelled' ||
              order.status === 'rejected' ||
              order.status === 'no_show';
            const isReceiptOpen = expandedReceiptId === order.id;

            return (
              <article
                key={order.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                {/* Header Row: Token Number + Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-16 items-center justify-center rounded-2xl bg-slate-900 font-mono text-lg font-bold text-amber-400 tabular-nums">
                      #{order.tokenNumber}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-900">
                          {order.orderType === 'dine_in'
                            ? `Dine-in${order.tableNumber ? ` (${order.tableNumber})` : ''}`
                            : 'Takeaway'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700 tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          Ready by {formatTime12Hour(order.slotTime)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{order.dateStr}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        Order ID: {order.id} · Payment: {order.paymentId}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      ₹{order.totalAmount}
                    </p>
                    {order.discount > 0 && (
                      <p className="font-mono text-[11px] font-semibold text-emerald-700">
                        Includes ₹{order.discount} quiet-slot discount
                      </p>
                    )}
                  </div>
                </div>

                {/* Delivery-App Style Live ETA Header & 0-100% Full-Filling Bar */}
                <div className="mt-5">
                  {isTerminalException ? (
                    <div className="flex flex-col justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-red-900">
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>
                          Status:{' '}
                          {order.status === 'cancelled'
                            ? 'Cancelled by Customer'
                            : order.status === 'rejected'
                              ? 'Rejected by Kitchen'
                              : 'Expired (No-Show after 20m in Ready — No Refund)'}
                        </span>
                      </div>
                      {order.refundStatus === 'processed' && (
                        <span className="font-mono text-xs font-semibold text-emerald-800">
                          Cashfree Refund Processed ({order.refundId})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-display text-sm font-bold text-slate-900">
                            {etaInfo.stageTitle}
                          </p>
                          <p className="text-xs text-slate-500">{etaInfo.nextStepLabel}</p>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold text-amber-800 tabular-nums">
                            {etaInfo.etaLabel}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {etaInfo.progressPercent}%
                          </span>
                        </div>
                      </div>

                      {/* 0 to 100% Full-Filling Bar */}
                      <div
                        role="progressbar"
                        aria-label={`Token #${order.tokenNumber} preparation progress`}
                        aria-valuenow={etaInfo.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200"
                      >
                        <div
                          className={`progress-bar-shimmer h-full rounded-full transition-all duration-700 ease-out ${
                            etaInfo.progressPercent === 100
                              ? 'bg-emerald-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${etaInfo.progressPercent}%` }}
                        />
                      </div>

                      {/* 4 Delivery Milestones */}
                      <div className="mt-2.5 grid grid-cols-4 gap-2">
                        {DELIVERY_STAGE_LABELS.map((label, idx) => {
                          const completed = idx <= etaInfo.activeStepIndex;
                          const current = idx === etaInfo.activeStepIndex;
                          return (
                            <div
                              key={label}
                              className={`flex items-center gap-1 text-xs ${
                                idx === 3 ? 'justify-end text-right' : ''
                              }`}
                            >
                              {completed && (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              )}
                              <span
                                className={
                                  current
                                    ? 'font-bold text-slate-900'
                                    : completed
                                      ? 'font-semibold text-emerald-800'
                                      : 'text-slate-400'
                                }
                              >
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Snapshot Items List */}
                <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
                  <div className="space-y-1.5">
                    {order.items.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex items-center justify-between text-xs text-slate-700"
                      >
                        <span>
                          <strong className="font-mono tabular-nums">{item.quantity}×</strong>{' '}
                          {item.name}
                        </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isReceiptOpen && (() => {
                    const gstBill = generateGstTaxBill(order);
                    return (
                      <div className="mt-3 border-t border-slate-200 pt-2.5 text-[11px] text-slate-600 space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span>Items Gross Value</span>
                          <span className="tabular-nums">₹{order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Campus Price Offer Discount</span>
                          <span className="tabular-nums">-₹{order.discount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxable Value (Excl. 5% GST)</span>
                          <span className="tabular-nums">₹{gstBill.taxableAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>CGST (2.5%) + SGST (2.5%)</span>
                          <span className="tabular-nums">
                            ₹{gstBill.cgstAmount.toFixed(2)} + ₹{gstBill.sgstAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>Grand Total Paid ({order.paymentMode.toUpperCase()})</span>
                          <span className="tabular-nums">₹{order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 pt-1">
                          <span>Invoice / Pickup PIN</span>
                          <span>
                            {gstBill.invoiceNumber} · {gstBill.pickupVerificationCode}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Action Footer: GST Bill & Token Slip, Cancel (only while placed), Next Stage preview & Order Again */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedReceiptId((prev) => (prev === order.id ? null : order.id))
                      }
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                    >
                      <Receipt className="h-3.5 w-3.5 text-amber-600" />
                      <span>{isReceiptOpen ? 'Hide GST Breakdown' : 'GST Breakdown'}</span>
                      {isReceiptOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <span aria-hidden="true">·</span>
                    {order.status === 'placed' ? (
                      <span>Physical GST Token Bill prints automatically once Kitchen accepts</span>
                    ) : order.refundStatus === 'processed' ? (
                      <span className="font-medium text-emerald-700">
                        Refunded ₹{order.totalAmount} via Cashfree API ({order.refundId})
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-700">
                        Kitchen Accepted · Physical GST Token #{order.tokenNumber} Issued
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isTerminalException && (
                      <button
                        type="button"
                        onClick={() => setSelectedBillOrderId(order.id)}
                        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
                          order.status === 'preparing' ||
                          order.status === 'ready' ||
                          order.status === 'collected'
                            ? 'mac-pill-active'
                            : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>
                          {order.status === 'placed'
                            ? 'Preview GST Token Slip'
                            : `Print GST Bill & Token #${order.tokenNumber}`}
                        </span>
                      </button>
                    )}

                    {settings.testMode &&
                      (order.status === 'placed' ||
                        order.status === 'preparing' ||
                        order.status === 'ready') && (
                        <button
                          type="button"
                          onClick={() => {
                            const wasPlaced = order.status === 'placed';
                            const elapsedSec = (Date.now() - order.createdAtMs) / 1000;
                            stepActiveOrderDemoStage(order.id);
                            if (wasPlaced && elapsedSec >= 90) {
                              setSelectedBillOrderId(order.id);
                            }
                          }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                        >
                          <span>Simulate Next Stage →</span>
                        </button>
                      )}

                    {order.status === 'placed' && (
                      <button
                        type="button"
                        disabled={cancellingId === order.id}
                        onClick={() => handleCancelOrder(order)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>
                          {cancellingId === order.id
                            ? 'Refunding...'
                            : 'Cancel & Refund'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOrderAgain(order)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                      <span>Order Again</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Physical 80mm Thermal GST Bill & Student Collection Token Modal */}
      <PhysicalGstBillModal
        order={myOrders.find((o) => o.id === selectedBillOrderId) || null}
        onClose={() => setSelectedBillOrderId(null)}
        contextLabel="Student Copy · 80mm GST Tax Invoice & Counter Collection Token"
      />
    </div>
  );
};

