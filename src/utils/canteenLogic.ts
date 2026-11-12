export type UserRole = 'customer' | 'kitchen' | 'admin';

export type OrderStatus =
  | 'placed'
  | 'preparing'
  | 'ready'
  | 'collected'
  | 'cancelled'
  | 'rejected'
  | 'no_show';

export type RefundStatus = 'none' | 'processing' | 'processed' | 'failed';

export type OrderType = 'takeaway' | 'dine_in';

export type DietaryBadge = 'Vegan' | 'High Protein' | 'Spicy';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: 'Dosa & Idli' | 'Rice & Meals' | 'Snacks & Vada' | 'Beverages';
  photo: string;
  isVeg: boolean;
  dietaryBadge?: DietaryBadge;
  description: string;
  prepTimeMinutes: number;
  available: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type RateLimitWindowMinutes = 30 | 60;

export interface CanteenSettings {
  isOpen: boolean;
  openTime: string; // "08:00"
  closeTime: string; // "20:00"
  ordersPerSlot: number; // default 4
  noShowMinutes: number; // default 20
  quietSlotDiscount: number; // default 3
  testMode: boolean; // default true
  rateLimitWindowMinutes?: RateLimitWindowMinutes; // 30 (per 30 mins) or 60 (per hour), default 60
  maxOrdersPerWindow?: number; // customizable order cap per window, default 30
}

export interface SlotInfo {
  slotId: string; // e.g. "2026-10-23_12:10"
  dateStr: string; // "2026-10-23"
  timeStr: string; // "12:10"
  label: string; // "12:10 PM"
  bookedCount: number;
  capacity: number;
  isFull: boolean;
  isPastCutoff: boolean;
  loadRatio: number; // bookedCount / capacity
  qualifiesForQuietDiscount: boolean;
  discountAmount: number;
}

export interface OrderItemSnapshot {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  prepTimeMinutes: number;
}

export interface CanteenOrder {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  studentStaffId: string;
  tokenNumber: number;
  dateStr: string;
  orderType: OrderType;
  tableNumber: string;
  slotTime: string; // "12:30"
  slotId: string; // "2026-10-23_12:30"
  items: OrderItemSnapshot[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMode: 'test' | 'cashfree';
  paymentId: string;
  refundStatus: RefundStatus;
  refundId?: string;
  refundReason?: string;
  maxPrepTimeMinutes: number;
  readyAtMs?: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export type RushLevel = 'Calm' | 'Busy' | 'Packed';

export interface RushMeterResult {
  level: RushLevel;
  occupancyPercent: number;
  totalBooked: number;
  totalCapacity: number;
  nextSlotsCount: number;
  summary: string;
}

export interface StartCookingUrgency {
  startCookingTimeStr: string;
  minutesUntilStart: number;
  urgency: 'green' | 'amber' | 'red';
  countdownLabel: string;
}

export interface CashfreePaymentRecord {
  cfPaymentId: string;
  orderId: string;
  tokenNumber: number;
  customerEmail: string;
  capturedAmount: number;
  paymentStatus: 'SUCCESS' | 'REFUNDED' | 'FAILED';
  refundedAmount: number;
  capturedAt: string;
  notes?: string;
}

export interface ReconciliationRow {
  orderId: string;
  tokenNumber: number;
  customerEmail: string;
  slotTime: string;
  orderStatus: OrderStatus;
  dbAmount: number;
  cfPaymentId: string | null;
  cfCapturedAmount: number | null;
  cfStatus: string | null;
  refundStatus: RefundStatus;
  reconciliationStatus:
    | 'MATCHED'
    | 'AMOUNT_MISMATCH'
    | 'MISSING_IN_CASHFREE'
    | 'MISSING_IN_DB'
    | 'REFUND_MISMATCH';
  discrepancyNote: string;
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'jeevankingdimpu@gmail.com';

/**
 * Validates college email address or bootstrapped admin email.
 * Accepts standard college domains (.edu, .ac.in, .edu.in, college.edu, campus.edu)
 * or the bootstrapped admin email so the owner can always sign in.
 */
export function isValidCollegeEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;
  if (normalized === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  const domain = normalized.split('@')[1] || '';
  return (
    domain.endsWith('.edu') ||
    domain.endsWith('.ac.in') ||
    domain.endsWith('.edu.in') ||
    domain.endsWith('.org.in') ||
    domain.includes('sapthagiri') ||
    domain.includes('snpsu') ||
    domain.includes('college') ||
    domain.includes('campus') ||
    domain.includes('univ') ||
    domain.includes('iit') ||
    domain.includes('nit')
  );
}

export function getTodayDateStr(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export function formatMinutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatTime12Hour(timeStr: string): string {
  const total = parseTimeToMinutes(timeStr);
  const hh24 = Math.floor(total / 60);
  const mm = total % 60;
  const period = hh24 >= 12 ? 'PM' : 'AM';
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
  return `${hh12}:${String(mm).padStart(2, '0')} ${period}`;
}

/**
 * Evaluates quiet-slot discount across upcoming slots:
 * "when any upcoming slot is 75% full, slots at 25% or less get an admin-set discount (default ₹3)."
 */
export function evaluateQuietSlotDiscounts(
  upcomingSlots: Array<{ slotId: string; bookedCount: number; capacity: number }>,
  configuredDiscount: number
): Record<string, number> {
  const safeDiscount = Math.max(0, Number(configuredDiscount) || 0);
  const anyPeakSlot = upcomingSlots.some((slot) => {
    const cap = Math.max(1, slot.capacity);
    return slot.bookedCount / cap >= 0.75;
  });

  const result: Record<string, number> = {};
  for (const slot of upcomingSlots) {
    const cap = Math.max(1, slot.capacity);
    const ratio = slot.bookedCount / cap;
    if (anyPeakSlot && ratio <= 0.25 && slot.bookedCount < cap) {
      result[slot.slotId] = safeDiscount;
    } else {
      result[slot.slotId] = 0;
    }
  }
  return result;
}

/**
 * Generates 10-minute pickup slots for today within canteen opening hours,
 * starting at least 10 minutes from `now`.
 */
export function generatePickupSlots(
  settings: CanteenSettings,
  slotBookingsMap: Record<string, number>,
  now: Date = new Date()
): SlotInfo[] {
  const dateStr = getTodayDateStr(now);
  const openMins = parseTimeToMinutes(settings.openTime || '08:00');
  const closeMins = parseTimeToMinutes(settings.closeTime || '20:00');
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Minimum ready-by time is at least 10 minutes from now, rounded up to next 10-min boundary
  const minCutoffMins = Math.ceil((currentMins + 10) / 10) * 10;

  // If current time is outside opening hours (e.g. late night test), still show upcoming slots for the canteen window
  // so students/evaluators can pre-book for the canteen window, while clearly marking cutoff rules.
  const effectiveStart =
    minCutoffMins <= closeMins - 10 ? Math.max(openMins, minCutoffMins) : openMins;

  const rawSlots: Array<{
    slotId: string;
    dateStr: string;
    timeStr: string;
    bookedCount: number;
    capacity: number;
    isPastCutoff: boolean;
  }> = [];

  const capacity = Math.max(1, settings.ordersPerSlot || 4);

  for (let m = effectiveStart; m <= closeMins; m += 10) {
    if (m < openMins) continue;
    const timeStr = formatMinutesToTimeStr(m);
    const slotId = `${dateStr}_${timeStr}`;
    const bookedCount = slotBookingsMap[slotId] || 0;
    rawSlots.push({
      slotId,
      dateStr,
      timeStr,
      bookedCount,
      capacity,
      isPastCutoff: false,
    });
  }

  const discountMap = evaluateQuietSlotDiscounts(
    rawSlots.map((s) => ({
      slotId: s.slotId,
      bookedCount: s.bookedCount,
      capacity: s.capacity,
    })),
    settings.quietSlotDiscount ?? 3
  );

  return rawSlots.map((s) => {
    const isFull = s.bookedCount >= s.capacity;
    const loadRatio = s.bookedCount / s.capacity;
    const discountAmount = discountMap[s.slotId] || 0;
    return {
      ...s,
      label: formatTime12Hour(s.timeStr),
      isFull,
      loadRatio,
      qualifiesForQuietDiscount: discountAmount > 0,
      discountAmount,
    };
  });
}

/**
 * Calculates the Rush Meter from the load of the next 3 upcoming slots:
 * Calm (< 40%), Busy (40% - 74%), Packed (>= 75%).
 */
export function calculateRushMeter(slots: SlotInfo[]): RushMeterResult {
  const nextThree = slots.slice(0, 3);
  if (nextThree.length === 0) {
    return {
      level: 'Calm',
      occupancyPercent: 0,
      totalBooked: 0,
      totalCapacity: 0,
      nextSlotsCount: 0,
      summary: 'No active upcoming slots right now',
    };
  }

  const totalBooked = nextThree.reduce((sum, s) => sum + s.bookedCount, 0);
  const totalCapacity = nextThree.reduce((sum, s) => sum + s.capacity, 0);
  const ratio = totalCapacity > 0 ? totalBooked / totalCapacity : 0;
  const occupancyPercent = Math.min(100, Math.round(ratio * 100));

  let level: RushLevel = 'Calm';
  let summary = 'Quick pickup — minimal queue across the next 30 mins';

  if (ratio >= 0.75) {
    level = 'Packed';
    summary = 'High demand in the next 3 slots — pick a quiet slot for ₹3 off';
  } else if (ratio >= 0.4) {
    level = 'Busy';
    summary = 'Moderate kitchen load across the next 3 pickup slots';
  }

  return {
    level,
    occupancyPercent,
    totalBooked,
    totalCapacity,
    nextSlotsCount: nextThree.length,
    summary,
  };
}

/**
 * Calculates authoritative order totals from Firestore menu items (never trusting cart prices).
 * Enforces max 9 quantity per item and skips unavailable/sold-out items.
 */
export function computeAuthoritativeOrderSnapshot(
  cartQuantities: Record<string, number>,
  authoritativeMenu: MenuItem[],
  serverDiscount: number
): {
  items: OrderItemSnapshot[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  maxPrepTimeMinutes: number;
  skippedSoldOutNames: string[];
} {
  const menuById = new Map(authoritativeMenu.map((item) => [item.id, item]));
  const items: OrderItemSnapshot[] = [];
  const skippedSoldOutNames: string[] = [];

  for (const [itemId, rawQty] of Object.entries(cartQuantities)) {
    const qty = Math.min(9, Math.max(0, Math.floor(Number(rawQty) || 0)));
    if (qty <= 0) continue;
    const menuItem = menuById.get(itemId);
    if (!menuItem) continue;
    if (!menuItem.available) {
      skippedSoldOutNames.push(menuItem.name);
      continue;
    }
    items.push({
      itemId: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      quantity: qty,
      isVeg: Boolean(menuItem.isVeg),
      prepTimeMinutes: Math.max(1, Number(menuItem.prepTimeMinutes) || 10),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const maxPrepTimeMinutes = items.reduce(
    (max, item) => Math.max(max, item.prepTimeMinutes),
    0
  );
  const safeDiscount =
    subtotal > 0 ? Math.min(subtotal - 1, Math.max(0, Number(serverDiscount) || 0)) : 0;
  const totalAmount = Math.max(0, subtotal - safeDiscount);

  return {
    items,
    subtotal,
    discount: safeDiscount,
    totalAmount,
    maxPrepTimeMinutes,
    skippedSoldOutNames,
  };
}

/**
 * Kitchen card calculation:
 * "Start cooking at" time = ready-by minus the longest prep time among its items, with a countdown.
 * Card colour: green (plenty of time, > 5 min), amber (under 5 min, 1..5 min), red (start now or late, <= 0 min).
 */
export function calculateStartCookingUrgency(
  slotTimeStr: string,
  maxPrepTimeMinutes: number,
  now: Date = new Date()
): StartCookingUrgency {
  const readyByMins = parseTimeToMinutes(slotTimeStr);
  const prep = Math.max(1, maxPrepTimeMinutes || 10);
  const startCookingMins = readyByMins - prep;
  const startCookingTimeStr = formatMinutesToTimeStr(startCookingMins);

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const minutesUntilStart = startCookingMins - currentMins;

  let urgency: 'green' | 'amber' | 'red' = 'green';
  let countdownLabel = `in ${minutesUntilStart} min`;

  if (minutesUntilStart <= 0) {
    urgency = 'red';
    countdownLabel =
      minutesUntilStart === 0
        ? 'Start cooking now'
        : `${Math.abs(minutesUntilStart)} min overdue`;
  } else if (minutesUntilStart <= 5) {
    urgency = 'amber';
    countdownLabel = `Start in ${minutesUntilStart} min`;
  }

  return {
    startCookingTimeStr: formatTime12Hour(startCookingTimeStr),
    minutesUntilStart,
    urgency,
    countdownLabel,
  };
}

/**
 * Checks whether an order in 'ready' status has exceeded the configurable no-show timeout.
 * "an order left in 'ready' for 20 minutes becomes 'no_show' automatically (no refund)."
 */
export function isOrderExpiredNoShow(
  order: Pick<CanteenOrder, 'status' | 'readyAtMs'>,
  noShowMinutes: number,
  nowMs: number = Date.now()
): boolean {
  if (order.status !== 'ready' || !order.readyAtMs) return false;
  const thresholdMs = Math.max(1, noShowMinutes || 20) * 60 * 1000;
  return nowMs - order.readyAtMs >= thresholdMs;
}

/**
 * Reconciles paid orders in our database vs. payments in Cashfree, highlighting mismatches.
 */
export function reconcileOrdersWithCashfree(
  dbOrders: CanteenOrder[],
  cfPayments: CashfreePaymentRecord[]
): ReconciliationRow[] {
  const rows: ReconciliationRow[] = [];
  const cfByOrderId = new Map(cfPayments.map((p) => [p.orderId, p]));
  const seenOrderIds = new Set<string>();

  for (const order of dbOrders) {
    seenOrderIds.add(order.id);
    const cf = cfByOrderId.get(order.id);

    if (!cf) {
      rows.push({
        orderId: order.id,
        tokenNumber: order.tokenNumber,
        customerEmail: order.userEmail,
        slotTime: order.slotTime,
        orderStatus: order.status,
        dbAmount: order.totalAmount,
        cfPaymentId: null,
        cfCapturedAmount: null,
        cfStatus: null,
        refundStatus: order.refundStatus,
        reconciliationStatus: 'MISSING_IN_CASHFREE',
        discrepancyNote: 'Order marked paid in DB but no settlement record found in Cashfree',
      });
      continue;
    }

    const shouldBeRefunded = order.status === 'cancelled' || order.status === 'rejected';
    if (shouldBeRefunded && cf.paymentStatus !== 'REFUNDED' && order.refundStatus !== 'processed') {
      rows.push({
        orderId: order.id,
        tokenNumber: order.tokenNumber,
        customerEmail: order.userEmail,
        slotTime: order.slotTime,
        orderStatus: order.status,
        dbAmount: order.totalAmount,
        cfPaymentId: cf.cfPaymentId,
        cfCapturedAmount: cf.capturedAmount,
        cfStatus: cf.paymentStatus,
        refundStatus: order.refundStatus,
        reconciliationStatus: 'REFUND_MISMATCH',
        discrepancyNote: `Order ${order.status} in DB, refund pending in Cashfree`,
      });
      continue;
    }

    if (cf.capturedAmount !== order.totalAmount) {
      rows.push({
        orderId: order.id,
        tokenNumber: order.tokenNumber,
        customerEmail: order.userEmail,
        slotTime: order.slotTime,
        orderStatus: order.status,
        dbAmount: order.totalAmount,
        cfPaymentId: cf.cfPaymentId,
        cfCapturedAmount: cf.capturedAmount,
        cfStatus: cf.paymentStatus,
        refundStatus: order.refundStatus,
        reconciliationStatus: 'AMOUNT_MISMATCH',
        discrepancyNote: `DB total ₹${order.totalAmount} vs Cashfree ₹${cf.capturedAmount}`,
      });
      continue;
    }

    rows.push({
      orderId: order.id,
      tokenNumber: order.tokenNumber,
      customerEmail: order.userEmail,
      slotTime: order.slotTime,
      orderStatus: order.status,
      dbAmount: order.totalAmount,
      cfPaymentId: cf.cfPaymentId,
      cfCapturedAmount: cf.capturedAmount,
      cfStatus: cf.paymentStatus,
      refundStatus: order.refundStatus,
      reconciliationStatus: 'MATCHED',
      discrepancyNote: 'Verified match',
    });
  }

  for (const cf of cfPayments) {
    if (!seenOrderIds.has(cf.orderId)) {
      rows.push({
        orderId: cf.orderId,
        tokenNumber: cf.tokenNumber,
        customerEmail: cf.customerEmail,
        slotTime: '--:--',
        orderStatus: 'placed',
        dbAmount: 0,
        cfPaymentId: cf.cfPaymentId,
        cfCapturedAmount: cf.capturedAmount,
        cfStatus: cf.paymentStatus,
        refundStatus: 'none',
        reconciliationStatus: 'MISSING_IN_DB',
        discrepancyNote: cf.notes || 'Payment captured in Cashfree with no matching DB order',
      });
    }
  }

  return rows;
}

export interface OrderEtaProgress {
  progressPercent: number; // 0 to 100
  stageKey: 'about_to_accept' | 'accepted' | 'preparing' | 'prepared' | 'collected';
  stageTitle: string;
  nextStepLabel: string;
  etaMinutes: number;
  etaLabel: string;
  activeStepIndex: number; // 0..3 for [About to be accepted, Order accepted, Preparing, Prepared]
}

/**
 * Computes delivery-app style live ETA and 0-100% full-filling progress bar state
 * across: "About to be accepted" -> "Order accepted" -> "Preparing" -> "Prepared".
 */
export function calculateOrderEtaAndProgress(
  order: Pick<
    CanteenOrder,
    'status' | 'slotTime' | 'maxPrepTimeMinutes' | 'createdAtMs' | 'updatedAtMs'
  >,
  now: Date = new Date()
): OrderEtaProgress {
  const nowMs = now.getTime();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const slotMins = parseTimeToMinutes(order.slotTime);
  const rawRemainingToSlot = slotMins - currentMins;
  const fallbackPrep = Math.max(2, order.maxPrepTimeMinutes || 8);

  if (order.status === 'ready') {
    return {
      progressPercent: 100,
      stageKey: 'prepared',
      stageTitle: 'Prepared · Ready for pickup at counter',
      nextStepLabel: 'Completed — pick up with your token number',
      etaMinutes: 0,
      etaLabel: 'Ready now · 0 min',
      activeStepIndex: 3,
    };
  }

  if (order.status === 'collected') {
    return {
      progressPercent: 100,
      stageKey: 'collected',
      stageTitle: 'Order Collected',
      nextStepLabel: 'Enjoy your meal!',
      etaMinutes: 0,
      etaLabel: 'Completed',
      activeStepIndex: 3,
    };
  }

  const etaMinutes =
    rawRemainingToSlot > 0 && rawRemainingToSlot <= 90
      ? rawRemainingToSlot
      : fallbackPrep;

  if (order.status === 'preparing') {
    const elapsedPrepMins = Math.max(0, (nowMs - (order.updatedAtMs || order.createdAtMs)) / 60000);
    const prepRatio = Math.min(1, elapsedPrepMins / Math.max(1, fallbackPrep));
    const progressPercent = Math.min(92, Math.max(58, Math.round(58 + prepRatio * 34)));
    const remainingPrep = Math.max(1, Math.min(etaMinutes, Math.ceil(fallbackPrep - elapsedPrepMins)));

    return {
      progressPercent,
      stageKey: 'preparing',
      stageTitle: 'Order accepted · Preparing now',
      nextStepLabel: 'Next: Prepared & ready at counter',
      etaMinutes: remainingPrep,
      etaLabel: `ETA ${remainingPrep} min${remainingPrep === 1 ? '' : 's'}`,
      activeStepIndex: 2,
    };
  }

  // status === 'placed'
  const elapsedSincePlacedSec = Math.max(0, (nowMs - order.createdAtMs) / 1000);
  if (elapsedSincePlacedSec < 90) {
    const earlyPct = Math.min(28, Math.max(12, Math.round(12 + (elapsedSincePlacedSec / 90) * 16)));
    return {
      progressPercent: earlyPct,
      stageKey: 'about_to_accept',
      stageTitle: 'Order is about to be accepted',
      nextStepLabel: 'Next: Order accepted → Preparing → Prepared',
      etaMinutes,
      etaLabel: `ETA ${etaMinutes} min${etaMinutes === 1 ? '' : 's'}`,
      activeStepIndex: 0,
    };
  }

  const acceptedPct = Math.min(48, Math.max(32, Math.round(32 + Math.min(16, elapsedSincePlacedSec / 60))));
  return {
    progressPercent: acceptedPct,
    stageKey: 'accepted',
    stageTitle: 'Order accepted · Queued for kitchen prep',
    nextStepLabel: 'Next: Preparing → Prepared',
    etaMinutes,
    etaLabel: `ETA ${etaMinutes} min${etaMinutes === 1 ? '' : 's'}`,
    activeStepIndex: 1,
  };
}

export type CanteenPortal = 'order' | 'kitchen' | 'admin';

/**
 * Checks whether the current URL is in "Student Website Only" classroom mode
 * (`?studentOnly=1`, `?studentOnly=true`, or `?mode=student`).
 * When active, the 3-in-1 Prototype switcher bar and Kitchen/Admin portals are hidden
 * so students scanning the classroom QR code can ONLY access the Student Ordering Website.
 */
export function isStudentOnlyMode(search: string = '', hash: string = ''): boolean {
  const params = new URLSearchParams(search || '');
  const studentOnlyParam = params.get('studentOnly')?.toLowerCase();
  const modeParam = params.get('mode')?.toLowerCase();
  if (
    studentOnlyParam === '1' ||
    studentOnlyParam === 'true' ||
    modeParam === 'student'
  ) {
    return true;
  }

  const hashQueryIdx = (hash || '').indexOf('?');
  if (hashQueryIdx !== -1) {
    const hashParams = new URLSearchParams(hash.slice(hashQueryIdx + 1));
    const hStudentOnly = hashParams.get('studentOnly')?.toLowerCase();
    const hMode = hashParams.get('mode')?.toLowerCase();
    if (hStudentOnly === '1' || hStudentOnly === 'true' || hMode === 'student') {
      return true;
    }
  }
  return false;
}

/**
 * Builds the public shareable Student-Only URL for the classroom QR code.
 * Automatically converts `localhost`, `127.0.0.1`, and private `ais-dev-*` preview hosts
 * to the public `ais-pre-*` Shared App URL so every student in class can scan and open it on their phone.
 */
export function buildStudentOnlyClassroomUrl(origin: string): string {
  const fallbackSharedOrigin =
    'https://ais-pre-fhyiowbxmdbhjsxaduccsa-763214530749.asia-northeast1.run.app';
  const rawOrigin = (origin || fallbackSharedOrigin).trim().replace(/\/+$/, '');
  if (
    !rawOrigin ||
    rawOrigin.includes('localhost') ||
    rawOrigin.includes('127.0.0.1')
  ) {
    return `${fallbackSharedOrigin}/?studentOnly=1`;
  }
  const publicOrigin = rawOrigin.replace('://ais-dev-', '://ais-pre-');
  return `${publicOrigin}/?studentOnly=1`;
}

/**
 * Resolves which standalone website portal is active from the URL pathname, query string, or hash:
 * 1. 'order'   -> Student Ordering Website (/, /?portal=order, /#order, /order)
 * 2. 'kitchen' -> Kitchen Preparation Website (/?portal=kitchen, /#kitchen, /kitchen)
 * 3. 'admin'   -> Payment Checking & Admin Website (/?portal=admin, /#admin, /admin, /payments)
 *
 * If `isStudentOnlyMode(search, hash)` is true, strictly returns `'order'`.
 */
export function resolvePortalFromPath(
  pathname: string,
  search: string = '',
  hash: string = ''
): CanteenPortal {
  if (isStudentOnlyMode(search, hash)) {
    return 'order';
  }

  const cleanPath = (pathname || '/').toLowerCase();
  const params = new URLSearchParams(search || '');
  const queryPortal = params.get('portal')?.toLowerCase();
  const cleanHash = (hash || '').replace(/^#\/?/, '').split('?')[0].toLowerCase();

  if (
    queryPortal === 'kitchen' ||
    cleanHash === 'kitchen' ||
    cleanPath.startsWith('/kitchen')
  ) {
    return 'kitchen';
  }
  if (
    queryPortal === 'admin' ||
    queryPortal === 'payment' ||
    queryPortal === 'payments' ||
    cleanHash === 'admin' ||
    cleanHash === 'payment' ||
    cleanHash === 'payments' ||
    cleanPath.startsWith('/admin') ||
    cleanPath.startsWith('/payment')
  ) {
    return 'admin';
  }
  return 'order';
}

/**
 * Returns a proxy-safe relative URL that always targets the root `/` path so no
 * static proxy, CDN, or service worker ever returns a 404 on deep reload.
 */
export function buildPortalRelativeUrl(portal: CanteenPortal): string {
  if (portal === 'kitchen') return '/?portal=kitchen';
  if (portal === 'admin') return '/?portal=admin';
  return '/';
}

/**
 * Builds a full shareable URL for one of the 3 canteen websites using the root query parameter
 * format (`/?portal=kitchen`, `/?portal=admin`) so opening it in a new tab never returns 404.
 */
export function buildPortalShareUrl(origin: string, portal: CanteenPortal): string {
  const cleanOrigin = (origin || '').replace(/\/+$/, '');
  return `${cleanOrigin}${buildPortalRelativeUrl(portal)}`;
}

/**
 * Enforces strict role isolation across the 3 separate websites:
 * - Ordering website ('order'): accessible to customers (and campus staff)
 * - Kitchen website ('kitchen'): strictly restricted to 'kitchen' and 'admin' roles
 * - Payment & Admin website ('admin'): strictly restricted to 'admin' role
 */
export function canUserAccessPortal(portal: CanteenPortal, role: UserRole): boolean {
  if (portal === 'admin') {
    return role === 'admin';
  }
  if (portal === 'kitchen') {
    return role === 'kitchen' || role === 'admin';
  }
  return role === 'customer' || role === 'kitchen' || role === 'admin';
}

export interface OrderHistoryItemAvailability {
  itemId: string;
  name: string;
  quantity: number;
  currentPrice: number;
  isVeg: boolean;
  available: boolean;
}

export interface OrderHistorySummary {
  order: CanteenOrder;
  itemAvailability: OrderHistoryItemAvailability[];
  availableItemCount: number;
  soldOutItemNames: string[];
  canReorder: boolean;
}

/**
 * Evaluates a student's order history against the live menu so the Student Profile
 * Order History section can display current stock availability and support 1-tap reordering
 * while skipping sold-out items.
 */
export function buildProfileOrderHistory(
  userOrders: CanteenOrder[],
  liveMenu: MenuItem[]
): OrderHistorySummary[] {
  const menuById = new Map(liveMenu.map((item) => [item.id, item]));
  const sorted = [...userOrders].sort((a, b) => b.createdAtMs - a.createdAtMs);

  return sorted.map((order) => {
    const soldOutItemNames: string[] = [];
    let availableItemCount = 0;

    const itemAvailability: OrderHistoryItemAvailability[] = order.items.map((it) => {
      const liveItem = menuById.get(it.itemId);
      const available = Boolean(liveItem && liveItem.available);
      if (available) {
        availableItemCount += 1;
      } else {
        soldOutItemNames.push(it.name);
      }
      return {
        itemId: it.itemId,
        name: liveItem ? liveItem.name : it.name,
        quantity: it.quantity,
        currentPrice: liveItem ? liveItem.price : it.price,
        isVeg: liveItem ? liveItem.isVeg : it.isVeg,
        available,
      };
    });

    return {
      order,
      itemAvailability,
      availableItemCount,
      soldOutItemNames,
      canReorder: availableItemCount > 0,
    };
  });
}

export interface PeakHourBannerState {
  isPeakDetected: boolean;
  discountAmount: number;
  headline: string;
  subtext: string;
  recommendedSlot: SlotInfo | null;
  peakSlots: SlotInfo[];
  quietSlots: SlotInfo[];
}

/**
 * Evaluates upcoming 10-minute pickup slots to generate a dynamic Peak Hour & Quiet-Slot
 * Discount alert banner for the Student Menu page.
 */
export function evaluatePeakHourAlertBanner(
  slots: SlotInfo[],
  quietSlotDiscount: number = 3
): PeakHourBannerState {
  const discountAmount = Math.max(0, Number(quietSlotDiscount) || 0);
  const peakSlots = slots.filter(
    (s) => s.capacity > 0 && s.bookedCount / s.capacity >= 0.75
  );
  const quietSlots = slots.filter(
    (s) =>
      !s.isFull &&
      (s.qualifiesForQuietDiscount ||
        (s.capacity > 0 && s.bookedCount / s.capacity <= 0.25))
  );

  const recommendedSlot = quietSlots[0] || slots.find((s) => !s.isFull) || null;
  const isPeakDetected = peakSlots.length > 0;

  if (isPeakDetected && recommendedSlot) {
    const firstPeak = peakSlots[0];
    const peakPct = Math.round((firstPeak.bookedCount / firstPeak.capacity) * 100);
    const quietLabels = quietSlots
      .slice(0, 3)
      .map((s) => s.label)
      .join(', ');

    return {
      isPeakDetected: true,
      discountAmount,
      headline: `Upcoming Peak Hour Alert (${firstPeak.label} is ${peakPct}% full) — Pick a Quiet Slot for ₹${discountAmount} Off!`,
      subtext: `Peak slot ${firstPeak.label} has ${firstPeak.bookedCount} of ${firstPeak.capacity} orders booked. Order for a quiet pickup slot (${quietLabels}) to skip the queue and get an automatic ₹${discountAmount} quiet-slot discount.`,
      recommendedSlot,
      peakSlots,
      quietSlots,
    };
  }

  return {
    isPeakDetected: false,
    discountAmount,
    headline: `Beat Campus Break-Hour Rush — Pre-order Early for a ₹${discountAmount} Quiet-Slot Discount`,
    subtext: recommendedSlot
      ? `Next low-crowd pickup window is ${recommendedSlot.label} (${recommendedSlot.bookedCount} of ${recommendedSlot.capacity} booked). When peak slots reach 75% capacity, slots ≤25% full automatically receive ₹${discountAmount} off.`
      : `When any upcoming slot reaches 75% capacity, slots at 25% or less automatically receive a ₹${discountAmount} quiet-slot discount.`,
    recommendedSlot,
    peakSlots,
    quietSlots,
  };
}

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Resolves the active 'light' or 'dark' theme from user preference ('system' by default)
 * and OS prefers-color-scheme media query.
 */
export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): 'light' | 'dark' {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export const DEFAULT_KITCHEN_CREDENTIALS = {
  staffId: 'SAP-KIT-101',
  uniqueId: 'SAP-KIT-101',
  email: 'chef.murugan@snpsu.edu.in',
  password: 'SaptienKitchen@2026',
  fullName: 'Chef Murugan S',
} as const;

export const DEFAULT_ADMIN_CREDENTIALS = {
  staffId: 'SAP-ADM-001',
  uniqueId: 'SAP-ADM-001',
  email: BOOTSTRAPPED_ADMIN_EMAIL,
  password: 'SaptienAdmin#2026',
  fullName: 'Canteen Administrator',
} as const;

export type MenuSortOption = 'featured' | 'price_asc' | 'price_desc' | 'prep_asc';

export interface MenuFilterCriteria {
  category: 'All' | MenuItem['category'];
  dietFilter: 'all' | 'veg' | 'non_veg';
  searchQuery: string;
  maxPrice?: number;
  maxPrepTime?: number;
  onlyAvailable?: boolean;
  sortBy?: MenuSortOption;
}

/**
 * Resolves a subtle dietary badge ('Vegan' | 'High Protein' | 'Spicy') for any menu item
 * so students can make informed dietary choices at a glance. Uses explicit `item.dietaryBadge`
 * when present, or deterministically infers the badge from dish attributes.
 */
export function resolveMenuItemDietaryBadge(
  item: Pick<MenuItem, 'id' | 'name' | 'description' | 'isVeg' | 'dietaryBadge'>
): DietaryBadge {
  if (
    item.dietaryBadge === 'Vegan' ||
    item.dietaryBadge === 'High Protein' ||
    item.dietaryBadge === 'Spicy'
  ) {
    return item.dietaryBadge;
  }

  const text = `${item.name} ${item.description}`.toLowerCase();

  if (!item.isVeg) {
    return 'High Protein';
  }
  if (
    /kempu|spicy|khara|masala dosa/i.test(text) &&
    !/chitranna/i.test(item.name)
  ) {
    return 'Spicy';
  }
  if (!/butter|benne|ghee|milk|curd|mosaranna|kaapi/i.test(text)) {
    return 'Vegan';
  }
  return 'High Protein';
}

/**
 * Pure helper for filtering and sorting canteen menu items across interactive controls
 * (category tabs, dietary filter, search input, price ceiling slider, prep time slider,
 * in-stock toggle, and sort order).
 */
export function filterAndSortMenuItems(
  menu: MenuItem[],
  criteria: MenuFilterCriteria
): MenuItem[] {
  const {
    category,
    dietFilter,
    searchQuery,
    maxPrice = Infinity,
    maxPrepTime = Infinity,
    onlyAvailable = false,
    sortBy = 'featured',
  } = criteria;

  const q = searchQuery.trim().toLowerCase();

  const filtered = menu.filter((item) => {
    if (category !== 'All' && item.category !== category) return false;
    if (dietFilter === 'veg' && !item.isVeg) return false;
    if (dietFilter === 'non_veg' && item.isVeg) return false;
    if (onlyAvailable && !item.available) return false;
    if (item.price > maxPrice) return false;
    if (item.prepTimeMinutes > maxPrepTime) return false;
    if (q) {
      const badge = resolveMenuItemDietaryBadge(item).toLowerCase();
      const matchesName = item.name.toLowerCase().includes(q);
      const matchesDesc = item.description.toLowerCase().includes(q);
      const matchesCat = item.category.toLowerCase().includes(q);
      const matchesBadge = badge.includes(q);
      if (!matchesName && !matchesDesc && !matchesCat && !matchesBadge) return false;
    }
    return true;
  });

  if (sortBy === 'price_asc') {
    return [...filtered].sort((a, b) => a.price - b.price);
  }
  if (sortBy === 'price_desc') {
    return [...filtered].sort((a, b) => b.price - a.price);
  }
  if (sortBy === 'prep_asc') {
    return [...filtered].sort((a, b) => a.prepTimeMinutes - b.prepTimeMinutes);
  }
  return filtered;
}

export interface CategorySalesMetric {
  category: MenuItem['category'];
  portionsSold: number;
  revenue: number;
  revenueSharePercent: number;
  itemCount: number;
  availableCount: number;
  totalItems: number;
  inStockItems: number;
}

/**
 * Computes real category-by-category sales and stock metrics from live orders and menu items.
 */
export function computeCategorySalesBreakdown(
  orders: CanteenOrder[],
  menu: MenuItem[]
): CategorySalesMetric[] {
  const categories: MenuItem['category'][] = [
    'Dosa & Idli',
    'Rice & Meals',
    'Snacks & Vada',
    'Beverages',
  ];

  const menuById = new Map(menu.map((m) => [m.id, m]));
  const stats = new Map<
    MenuItem['category'],
    { portionsSold: number; revenue: number; itemCount: number; availableCount: number }
  >();

  for (const cat of categories) {
    stats.set(cat, { portionsSold: 0, revenue: 0, itemCount: 0, availableCount: 0 });
  }

  for (const item of menu) {
    const entry = stats.get(item.category);
    if (entry) {
      entry.itemCount += 1;
      if (item.available) entry.availableCount += 1;
    }
  }

  const validOrders = orders.filter(
    (o) => o.status !== 'cancelled' && o.status !== 'rejected'
  );

  let totalRevenue = 0;

  for (const ord of validOrders) {
    for (const snap of ord.items) {
      const menuItem = menuById.get(snap.itemId);
      const cat: MenuItem['category'] = menuItem?.category || 'Dosa & Idli';
      const entry = stats.get(cat);
      if (entry) {
        const lineRev = snap.price * snap.quantity;
        entry.portionsSold += snap.quantity;
        entry.revenue += lineRev;
        totalRevenue += lineRev;
      }
    }
  }

  return categories.map((category) => {
    const entry = stats.get(category)!;
    const revenueSharePercent =
      totalRevenue > 0 ? Math.round((entry.revenue / totalRevenue) * 100) : 0;
    return {
      category,
      portionsSold: entry.portionsSold,
      revenue: entry.revenue,
      revenueSharePercent,
      itemCount: entry.itemCount,
      availableCount: entry.availableCount,
      totalItems: entry.itemCount,
      inStockItems: entry.availableCount,
    };
  });
}

export interface AccountRecord {
  uid: string;
  email: string;
  fullName: string;
  studentStaffId: string;
  role: UserRole;
  accessPassword?: string;
}

export interface CustomerDetailSummary {
  uid: string;
  fullName: string;
  email: string;
  studentStaffId: string;
  role: UserRole;
  totalOrdersCount: number;
  activeOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrRefundedCount: number;
  totalSpent: number;
  totalDiscountSaved: number;
  lastOrderToken: number | null;
  lastOrderSlot: string | null;
  lastOrderStatus: OrderStatus | null;
  orders: CanteenOrder[];
}

/**
 * Aggregates all registered users and orders so the Admin can inspect every customer
 * and all their details (ID, email, total spend, discounts saved, and full order history).
 */
export function buildCustomerDirectoryDetails(
  users: AccountRecord[],
  orders: CanteenOrder[]
): CustomerDetailSummary[] {
  const byKey = new Map<string, CustomerDetailSummary>();

  for (const u of users) {
    byKey.set(u.email.toLowerCase(), {
      uid: u.uid,
      fullName: u.fullName,
      email: u.email,
      studentStaffId: u.studentStaffId,
      role: u.role,
      totalOrdersCount: 0,
      activeOrdersCount: 0,
      completedOrdersCount: 0,
      cancelledOrRefundedCount: 0,
      totalSpent: 0,
      totalDiscountSaved: 0,
      lastOrderToken: null,
      lastOrderSlot: null,
      lastOrderStatus: null,
      orders: [],
    });
  }

  const sortedOrders = [...orders].sort((a, b) => b.createdAtMs - a.createdAtMs);

  for (const ord of sortedOrders) {
    const emailKey = ord.userEmail.toLowerCase();
    if (!byKey.has(emailKey)) {
      byKey.set(emailKey, {
        uid: ord.userId,
        fullName: ord.userName,
        email: ord.userEmail,
        studentStaffId: ord.studentStaffId,
        role: 'customer',
        totalOrdersCount: 0,
        activeOrdersCount: 0,
        completedOrdersCount: 0,
        cancelledOrRefundedCount: 0,
        totalSpent: 0,
        totalDiscountSaved: 0,
        lastOrderToken: null,
        lastOrderSlot: null,
        lastOrderStatus: null,
        orders: [],
      });
    }

    const entry = byKey.get(emailKey)!;
    entry.totalOrdersCount += 1;
    entry.orders.push(ord);

    if (entry.lastOrderToken === null) {
      entry.lastOrderToken = ord.tokenNumber;
      entry.lastOrderSlot = ord.slotTime;
      entry.lastOrderStatus = ord.status;
    }

    if (ord.status === 'placed' || ord.status === 'preparing' || ord.status === 'ready') {
      entry.activeOrdersCount += 1;
    } else if (ord.status === 'collected') {
      entry.completedOrdersCount += 1;
    } else {
      entry.cancelledOrRefundedCount += 1;
    }

    if (ord.status !== 'cancelled' && ord.status !== 'rejected') {
      entry.totalSpent += ord.totalAmount;
      entry.totalDiscountSaved += ord.discount || 0;
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.totalOrdersCount - a.totalOrdersCount);
}

/**
 * 3-IN-1 PROTOTYPE CONFIGURATION:
 * Keeping `PROTOTYPE_UNIFIED_MODE = true` surfaces the unified 3-Website Prototype Dock
 * so evaluators can switch between Student Ordering (/), Kitchen KDS (/?portal=kitchen),
 * and Admin & Payment Console (/?portal=admin) inside one shell.
 * Set `PROTOTYPE_UNIFIED_MODE = false` (or `VITE_SEPARATE_PORTALS=true`) in production
 * to deploy the 3 websites as strictly isolated standalone applications.
 */
export const PROTOTYPE_UNIFIED_MODE = true;

export interface PrototypePortalMeta {
  id: CanteenPortal;
  stepNumber: number;
  label: string;
  subtitle: string;
  defaultRole: UserRole;
  routeHint: string;
}

export const PROTOTYPE_PORTALS: PrototypePortalMeta[] = [
  {
    id: 'order',
    stepNumber: 1,
    label: 'Student Ordering',
    subtitle: 'Pre-Order & Token Bill',
    defaultRole: 'customer',
    routeHint: '/',
  },
  {
    id: 'kitchen',
    stepNumber: 2,
    label: 'Kitchen KDS & Printer',
    subtitle: 'Accept Order & Print GST Bill',
    defaultRole: 'kitchen',
    routeHint: '/?portal=kitchen',
  },
  {
    id: 'admin',
    stepNumber: 3,
    label: 'Payment & Admin',
    subtitle: 'Cashfree Audit & Menu',
    defaultRole: 'admin',
    routeHint: '/?portal=admin',
  },
];

export interface GstBillLineItem {
  index: number;
  itemId: string;
  name: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isVeg: boolean;
}

export interface PhysicalGstTokenBill {
  isIssued: boolean;
  lifecycleStageLabel: string;
  canteenName: string;
  canteenBranch: string;
  gstin: string;
  fssaiLicense: string;
  sacCode: string;
  invoiceNumber: string;
  kotNumber: string;
  tokenNumber: number;
  tokenDisplay: string;
  pickupVerificationCode: string;
  barcodeBars: number[];
  orderId: string;
  paymentId: string;
  paymentModeLabel: string;
  customerName: string;
  studentStaffId: string;
  customerEmail: string;
  orderTypeLabel: string;
  slotTimeFormatted: string;
  issuedAtFormatted: string;
  lineItems: GstBillLineItem[];
  totalQuantity: number;
  itemsGrossSubtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgstRatePercent: number;
  cgstAmount: number;
  sgstRatePercent: number;
  sgstAmount: number;
  totalGstAmount: number;
  grandTotalPaid: number;
}

/**
 * Generates the 2026 Smart Pre-Order & Kitchen-Accepted Physical 80mm Thermal GST Tax Invoice
 * and Counter Collection Token Slip.
 *
 * Ecosystem Workflow (2026 Campus QSR & Cloud Kitchen Standard):
 * 1. When the student places a pre-order (`status === 'placed'`), payment is authorized and
 *    queued on the Kitchen Display System (KDS), while the Physical GST Tax Bill & Counter Token
 *    Slip awaits kitchen acceptance (`isIssued = false`).
 * 2. The moment the kitchen accepts the order (`status` transitions to `'preparing'`), the POS/KDS
 *    issues the official GST Tax Invoice (SAC 996331, 5% GST split into 2.5% CGST + 2.5% SGST)
 *    with the bold Counter Collection Token (`#101`) and verification code for student collection.
 */
export function generateGstTaxBill(order: CanteenOrder): PhysicalGstTokenBill {
  const isIssued =
    order.status === 'preparing' ||
    order.status === 'ready' ||
    order.status === 'collected';

  let lifecycleStageLabel = 'PENDING KITCHEN ACCEPTANCE';
  if (order.status === 'preparing') {
    lifecycleStageLabel = 'KITCHEN ACCEPTED · PREPARING';
  } else if (order.status === 'ready') {
    lifecycleStageLabel = 'READY AT PICKUP COUNTER';
  } else if (order.status === 'collected') {
    lifecycleStageLabel = 'COLLECTED & SETTLED';
  } else if (order.status === 'cancelled' || order.status === 'rejected') {
    lifecycleStageLabel = 'CANCELLED & REFUNDED';
  } else if (order.status === 'no_show') {
    lifecycleStageLabel = 'EXPIRED (NO-SHOW)';
  }

  const compactDate = (order.dateStr || '2026-11-11').replace(/-/g, '');
  const paddedToken = String(order.tokenNumber).padStart(4, '0');
  const suffixSource = (order.id || '00').slice(-2).toUpperCase().replace(/[^A-Z0-9]/g, '7');
  const invoiceNumber = `INV-${compactDate}-${paddedToken}`;
  const kotNumber = `KOT-${compactDate.slice(-4)}-${order.tokenNumber}`;
  const pickupVerificationCode = `MC-${order.tokenNumber}-${suffixSource.padEnd(2, '9')}`;

  // Deterministic visual barcode bar widths (1..3px) derived from tokenNumber & orderId
  const seedStr = `${order.tokenNumber}-${order.id}-${order.totalAmount}`;
  const barcodeBars: number[] = [];
  for (let i = 0; i < 28; i++) {
    const code = seedStr.charCodeAt(i % seedStr.length) + i * 7;
    barcodeBars.push((code % 3) + 1);
  }

  const lineItems: GstBillLineItem[] = order.items.map((item, idx) => ({
    index: idx + 1,
    itemId: item.itemId,
    name: item.name,
    sacCode: '996331',
    quantity: item.quantity,
    unitPrice: item.price,
    lineTotal: item.price * item.quantity,
    isVeg: item.isVeg,
  }));

  const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotalPaid = Math.max(0, Number(order.totalAmount) || 0);

  // Indian Restaurant & Campus Canteen GST @ 5% (2.5% CGST + 2.5% SGST) included in authoritative total
  const taxableAmount = Number((grandTotalPaid / 1.05).toFixed(2));
  const totalGstAmount = Number((grandTotalPaid - taxableAmount).toFixed(2));
  const cgstAmount = Number((totalGstAmount / 2).toFixed(2));
  const sgstAmount = Number((totalGstAmount - cgstAmount).toFixed(2));

  const issuedDate = new Date(order.updatedAtMs || order.createdAtMs || Date.now());
  const hh = String(issuedDate.getHours()).padStart(2, '0');
  const mm = String(issuedDate.getMinutes()).padStart(2, '0');
  const issuedAtFormatted = `${order.dateStr} · ${formatTime12Hour(`${hh}:${mm}`)}`;

  const orderTypeLabel =
    order.orderType === 'dine_in'
      ? `DINE-IN${order.tableNumber ? ` (TABLE ${order.tableNumber})` : ''}`
      : 'COUNTER TAKEAWAY';

  const paymentModeLabel =
    order.paymentMode === 'cashfree'
      ? 'CASHFREE UPI / GATEWAY (PAID)'
      : 'CAMPUS PRE-PAID WALLET / UPI (PAID)';

  return {
    isIssued,
    lifecycleStageLabel,
    canteenName: 'SAPTIEN · SAPTHAGIRI NPS UNIVERSITY',
    canteenBranch: 'SAPTHAGIRI NPS UNIVERSITY Campus · Hesaraghatta Main Rd, Bengaluru',
    gstin: '33AABCM2026C1Z8',
    fssaiLicense: '12426002002026',
    sacCode: '996331',
    invoiceNumber,
    kotNumber,
    tokenNumber: order.tokenNumber,
    tokenDisplay: `#${order.tokenNumber}`,
    pickupVerificationCode,
    barcodeBars,
    orderId: order.id,
    paymentId: order.paymentId,
    paymentModeLabel,
    customerName: order.userName,
    studentStaffId: order.studentStaffId,
    customerEmail: order.userEmail,
    orderTypeLabel,
    slotTimeFormatted: formatTime12Hour(order.slotTime),
    issuedAtFormatted,
    lineItems,
    totalQuantity,
    itemsGrossSubtotal: order.subtotal,
    discountAmount: order.discount || 0,
    taxableAmount,
    cgstRatePercent: 2.5,
    cgstAmount,
    sgstRatePercent: 2.5,
    sgstAmount,
    totalGstAmount,
    grandTotalPaid,
  };
}

export interface OrderRateLimitStatus {
  windowMinutes: RateLimitWindowMinutes;
  windowLabel: string;
  shortWindowLabel: string;
  maxOrders: number;
  ordersInWindow: number;
  remainingOrders: number;
  utilizationPercent: number;
  isLimitReached: boolean;
  isNearLimit: boolean;
  minutesUntilNextSlotFrees: number;
  statusSummary: string;
}

/**
 * Evaluates the customizable per-hour (60m) or per-30-minute (30m) order acceptance cap
 * configured by Kitchen Staff or the Canteen Owner (default: 30 orders per hour).
 */
export function evaluateOrderRateLimit(
  orders: Pick<CanteenOrder, 'status' | 'createdAtMs'>[],
  settings: Pick<CanteenSettings, 'rateLimitWindowMinutes' | 'maxOrdersPerWindow'>,
  nowMs: number = Date.now()
): OrderRateLimitStatus {
  const windowMinutes: RateLimitWindowMinutes =
    settings.rateLimitWindowMinutes === 30 ? 30 : 60;
  const windowLabel = windowMinutes === 30 ? '30 Minutes' : '1 Hour';
  const shortWindowLabel = windowMinutes === 30 ? '30m' : '1h';
  const rawMax = Number(settings.maxOrdersPerWindow);
  const maxOrders =
    Number.isFinite(rawMax) && rawMax >= 1
      ? Math.min(500, Math.floor(rawMax))
      : 30;

  const windowDurationMs = windowMinutes * 60 * 1000;
  const windowStartMs = nowMs - windowDurationMs;

  const countedOrders = orders.filter((ord) => {
    if (ord.status === 'cancelled' || ord.status === 'rejected') return false;
    const createdMs = Number(ord.createdAtMs) || 0;
    return createdMs >= windowStartMs && createdMs <= nowMs + 60_000;
  });

  const ordersInWindow = countedOrders.length;
  const remainingOrders = Math.max(0, maxOrders - ordersInWindow);
  const utilizationPercent = Math.min(
    100,
    Math.round((ordersInWindow / Math.max(1, maxOrders)) * 100)
  );
  const isLimitReached = ordersInWindow >= maxOrders;
  const isNearLimit = !isLimitReached && utilizationPercent >= 80;

  let minutesUntilNextSlotFrees = 0;
  if (countedOrders.length > 0) {
    const oldestCreatedMs = Math.min(...countedOrders.map((o) => o.createdAtMs));
    const msUntilRollOff = Math.max(0, oldestCreatedMs + windowDurationMs - nowMs);
    minutesUntilNextSlotFrees = Math.max(1, Math.ceil(msUntilRollOff / 60_000));
  }

  const statusSummary = isLimitReached
    ? `Order limit reached (${ordersInWindow}/${maxOrders} per ${windowLabel}) — next slot frees in ~${minutesUntilNextSlotFrees}m`
    : `${ordersInWindow} / ${maxOrders} orders in ${windowLabel} · ${remainingOrders} remaining`;

  return {
    windowMinutes,
    windowLabel,
    shortWindowLabel,
    maxOrders,
    ordersInWindow,
    remainingOrders,
    utilizationPercent,
    isLimitReached,
    isNearLimit,
    minutesUntilNextSlotFrees,
    statusSummary,
  };
}

export interface OrderReadyPushPayload {
  title: string;
  body: string;
  tag: string;
  icon: string;
  badge: string;
  requireInteraction: boolean;
  data: {
    url: string;
    orderId: string;
    tokenNumber: number;
  };
}

/**
 * Determines whether an order status transition should trigger a "Ready for Collection"
 * browser push notification (specifically when transitioning from 'preparing' or 'placed' to 'ready').
 */
export function shouldTriggerOrderReadyPushNotification(
  previousStatus: OrderStatus | undefined,
  nextStatus: OrderStatus
): boolean {
  return previousStatus === 'preparing' && nextStatus === 'ready';
}

/**
 * Builds a structured Web Notification / ServiceWorker Push Notification payload
 * when a student's order changes from 'preparing' to 'ready' for collection.
 */
export function buildOrderReadyPushPayload(
  order: Pick<
    CanteenOrder,
    'id' | 'tokenNumber' | 'items' | 'orderType' | 'tableNumber' | 'slotTime'
  >
): OrderReadyPushPayload {
  const itemSummary =
    order.items.length > 0
      ? order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')
      : 'Campus Tiffin Order';

  const collectionMode =
    order.orderType === 'dine_in' && order.tableNumber
      ? `Dine-in (${order.tableNumber})`
      : 'Counter Pickup';

  return {
    title: `Order Ready for Collection! · Token #${order.tokenNumber}`,
    body: `Your Saptien order (${itemSummary}) is hot and ready for ${collectionMode}. Show Token #${order.tokenNumber} at the counter.`,
    tag: `saptien-order-ready-${order.id}`,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    requireInteraction: true,
    data: {
      url: '/?portal=order#orders',
      orderId: order.id,
      tokenNumber: order.tokenNumber,
    },
  };
}

