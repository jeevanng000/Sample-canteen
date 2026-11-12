import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCollegeEmail,
  evaluateQuietSlotDiscounts,
  calculateRushMeter,
  computeAuthoritativeOrderSnapshot,
  calculateStartCookingUrgency,
  isOrderExpiredNoShow,
  reconcileOrdersWithCashfree,
  calculateOrderEtaAndProgress,
  resolvePortalFromPath,
  buildPortalRelativeUrl,
  buildPortalShareUrl,
  canUserAccessPortal,
  buildProfileOrderHistory,
  evaluatePeakHourAlertBanner,
  resolveEffectiveTheme,
  DEFAULT_KITCHEN_CREDENTIALS,
  DEFAULT_ADMIN_CREDENTIALS,
  buildCustomerDirectoryDetails,
  type MenuItem,
  type SlotInfo,
  type CanteenOrder,
} from './canteenLogic';

test('college email validation enforces campus domain or bootstrapped admin', () => {
  assert.equal(isValidCollegeEmail('arjun@snpsu.edu.in'), true);
  assert.equal(isValidCollegeEmail('priya@sapthagiri.edu.in'), true);
  assert.equal(isValidCollegeEmail('jeevankingdimpu@gmail.com'), true);
  assert.equal(isValidCollegeEmail('randomuser@gmail.com'), false);
});

test('quiet-slot discount applies ₹3 only when an upcoming slot is >= 75% full and target slot is <= 25% full', () => {
  const slotsWithPeak = [
    { slotId: 's1', bookedCount: 3, capacity: 4 }, // 75% full -> triggers quiet-slot discount
    { slotId: 's2', bookedCount: 1, capacity: 4 }, // 25% full -> gets discount
    { slotId: 's3', bookedCount: 2, capacity: 4 }, // 50% full -> no discount
  ];
  const discounts = evaluateQuietSlotDiscounts(slotsWithPeak, 3);
  assert.equal(discounts.s1, 0);
  assert.equal(discounts.s2, 3);
  assert.equal(discounts.s3, 0);

  const slotsWithoutPeak = [
    { slotId: 's1', bookedCount: 2, capacity: 4 }, // 50%
    { slotId: 's2', bookedCount: 0, capacity: 4 }, // 0%
  ];
  const noDiscounts = evaluateQuietSlotDiscounts(slotsWithoutPeak, 3);
  assert.equal(noDiscounts.s2, 0);
});

test('rush meter classifies Calm, Busy, and Packed from next 3 slots', () => {
  const makeSlot = (id: string, booked: number, cap: number): SlotInfo => ({
    slotId: id,
    dateStr: '2026-10-23',
    timeStr: '12:00',
    label: '12:00 PM',
    bookedCount: booked,
    capacity: cap,
    isFull: booked >= cap,
    isPastCutoff: false,
    loadRatio: booked / cap,
    qualifiesForQuietDiscount: false,
    discountAmount: 0,
  });

  const calm = calculateRushMeter([makeSlot('1', 1, 4), makeSlot('2', 1, 4), makeSlot('3', 0, 4)]);
  assert.equal(calm.level, 'Calm');

  const busy = calculateRushMeter([makeSlot('1', 2, 4), makeSlot('2', 2, 4), makeSlot('3', 2, 4)]);
  assert.equal(busy.level, 'Busy');

  const packed = calculateRushMeter([makeSlot('1', 4, 4), makeSlot('2', 3, 4), makeSlot('3', 3, 4)]);
  assert.equal(packed.level, 'Packed');
});

test('authoritative order snapshot uses menu prices, skips sold out items, and caps quantity at 9', () => {
  const menu: MenuItem[] = [
    {
      id: 'dosa',
      name: 'Masala Dosa',
      price: 55,
      category: 'Dosa & Idli',
      photo: '',
      isVeg: true,
      description: 'Crispy dosa',
      prepTimeMinutes: 8,
      available: true,
    },
    {
      id: 'biryani',
      name: 'Veg Biryani',
      price: 90,
      category: 'Rice & Meals',
      photo: '',
      isVeg: true,
      description: 'Biryani',
      prepTimeMinutes: 15,
      available: false, // sold out!
    },
  ];

  const snapshot = computeAuthoritativeOrderSnapshot({ dosa: 12, biryani: 2 }, menu, 3);
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].quantity, 9); // capped at 9
  assert.equal(snapshot.subtotal, 55 * 9);
  assert.equal(snapshot.discount, 3);
  assert.equal(snapshot.totalAmount, 55 * 9 - 3);
  assert.deepEqual(snapshot.skippedSoldOutNames, ['Veg Biryani']);
});

test('kitchen start cooking countdown classifies green, amber, and red urgency accurately', () => {
  const fakeNow = new Date('2026-10-23T12:00:00');
  // Ready by 12:30, prep time 10m -> Start cooking at 12:20 (20 mins away -> green)
  const green = calculateStartCookingUrgency('12:30', 10, fakeNow);
  assert.equal(green.urgency, 'green');
  assert.equal(green.minutesUntilStart, 20);

  // Ready by 12:15, prep time 12m -> Start cooking at 12:03 (3 mins away -> amber)
  const amber = calculateStartCookingUrgency('12:15', 12, fakeNow);
  assert.equal(amber.urgency, 'amber');

  // Ready by 12:10, prep time 15m -> Start cooking at 11:55 (-5 mins -> red)
  const red = calculateStartCookingUrgency('12:10', 15, fakeNow);
  assert.equal(red.urgency, 'red');
});

test('no-show expiration triggers after configured minutes in ready state', () => {
  const readyAt = 1_000_000;
  assert.equal(
    isOrderExpiredNoShow({ status: 'ready', readyAtMs: readyAt }, 20, readyAt + 19 * 60 * 1000),
    false
  );
  assert.equal(
    isOrderExpiredNoShow({ status: 'ready', readyAtMs: readyAt }, 20, readyAt + 20 * 60 * 1000),
    true
  );
});

test('Cashfree daily reconciliation detects matched, amount mismatch, and missing records', () => {
  const baseOrder: CanteenOrder = {
    id: 'ord_101',
    userId: 'u1',
    userEmail: 'student@iit.ac.in',
    userName: 'Student',
    studentStaffId: 'CS21B01',
    tokenNumber: 101,
    dateStr: '2026-10-23',
    orderType: 'takeaway',
    tableNumber: '',
    slotTime: '12:20',
    slotId: '2026-10-23_12:20',
    items: [],
    subtotal: 60,
    discount: 0,
    totalAmount: 60,
    status: 'collected',
    paymentMode: 'test',
    paymentId: 'cf_pay_101',
    refundStatus: 'none',
    maxPrepTimeMinutes: 8,
    createdAtMs: 1000,
    updatedAtMs: 1000,
  };

  const rows = reconcileOrdersWithCashfree(
    [
      baseOrder,
      { ...baseOrder, id: 'ord_102', tokenNumber: 102, totalAmount: 85 },
      { ...baseOrder, id: 'ord_103', tokenNumber: 103, totalAmount: 40 },
    ],
    [
      {
        cfPaymentId: 'cf_pay_101',
        orderId: 'ord_101',
        tokenNumber: 101,
        customerEmail: 'student@iit.ac.in',
        capturedAmount: 60,
        paymentStatus: 'SUCCESS',
        refundedAmount: 0,
        capturedAt: '2026-10-23T12:00:00Z',
      },
      {
        cfPaymentId: 'cf_pay_102',
        orderId: 'ord_102',
        tokenNumber: 102,
        customerEmail: 'student@iit.ac.in',
        capturedAmount: 88, // mismatch!
        paymentStatus: 'SUCCESS',
        refundedAmount: 0,
        capturedAt: '2026-10-23T12:05:00Z',
      },
    ]
  );

  assert.equal(rows.find((r) => r.orderId === 'ord_101')?.reconciliationStatus, 'MATCHED');
  assert.equal(rows.find((r) => r.orderId === 'ord_102')?.reconciliationStatus, 'AMOUNT_MISMATCH');
  assert.equal(rows.find((r) => r.orderId === 'ord_103')?.reconciliationStatus, 'MISSING_IN_CASHFREE');
});

test('delivery-style ETA and 0-100% progress bar transitions from about to be accepted -> accepted -> preparing -> prepared', () => {
  const now = new Date('2026-10-23T12:00:00');
  const nowMs = now.getTime();

  const justPlaced = calculateOrderEtaAndProgress(
    {
      status: 'placed',
      slotTime: '12:10',
      maxPrepTimeMinutes: 8,
      createdAtMs: nowMs - 15_000,
      updatedAtMs: nowMs - 15_000,
    },
    now
  );
  assert.equal(justPlaced.stageKey, 'about_to_accept');
  assert.ok(justPlaced.progressPercent >= 12 && justPlaced.progressPercent <= 28);
  assert.equal(justPlaced.etaMinutes, 10);

  const acceptedPlaced = calculateOrderEtaAndProgress(
    {
      status: 'placed',
      slotTime: '12:10',
      maxPrepTimeMinutes: 8,
      createdAtMs: nowMs - 180_000,
      updatedAtMs: nowMs - 180_000,
    },
    now
  );
  assert.equal(acceptedPlaced.stageKey, 'accepted');
  assert.ok(acceptedPlaced.progressPercent >= 32 && acceptedPlaced.progressPercent <= 48);

  const preparing = calculateOrderEtaAndProgress(
    {
      status: 'preparing',
      slotTime: '12:10',
      maxPrepTimeMinutes: 8,
      createdAtMs: nowMs - 240_000,
      updatedAtMs: nowMs - 120_000,
    },
    now
  );
  assert.equal(preparing.stageKey, 'preparing');
  assert.ok(preparing.progressPercent >= 58 && preparing.progressPercent <= 92);

  const prepared = calculateOrderEtaAndProgress(
    {
      status: 'ready',
      slotTime: '12:10',
      maxPrepTimeMinutes: 8,
      createdAtMs: nowMs - 400_000,
      updatedAtMs: nowMs - 10_000,
    },
    now
  );
  assert.equal(prepared.stageKey, 'prepared');
  assert.equal(prepared.progressPercent, 100);
  assert.equal(prepared.etaMinutes, 0);
});

test('3-website portal routing and strict role isolation separates Ordering, Kitchen, and Payment/Admin websites', () => {
  assert.equal(resolvePortalFromPath('/', ''), 'order');
  assert.equal(resolvePortalFromPath('/order', ''), 'order');
  assert.equal(resolvePortalFromPath('/', '?portal=order'), 'order');
  assert.equal(resolvePortalFromPath('/', '', '#/order'), 'order');
  assert.equal(resolvePortalFromPath('/kitchen', ''), 'kitchen');
  assert.equal(resolvePortalFromPath('/', '?portal=kitchen'), 'kitchen');
  assert.equal(resolvePortalFromPath('/', '', '#/kitchen'), 'kitchen');
  assert.equal(resolvePortalFromPath('/', '', '#kitchen'), 'kitchen');
  assert.equal(resolvePortalFromPath('/admin', ''), 'admin');
  assert.equal(resolvePortalFromPath('/payments', ''), 'admin');
  assert.equal(resolvePortalFromPath('/', '?portal=admin'), 'admin');
  assert.equal(resolvePortalFromPath('/', '', '#/admin'), 'admin');
  assert.equal(resolvePortalFromPath('/', '', '#admin'), 'admin');

  assert.equal(buildPortalRelativeUrl('order'), '/');
  assert.equal(buildPortalRelativeUrl('kitchen'), '/?portal=kitchen');
  assert.equal(buildPortalRelativeUrl('admin'), '/?portal=admin');
  assert.equal(
    buildPortalShareUrl('https://ais-dev-example.run.app/', 'kitchen'),
    'https://ais-dev-example.run.app/?portal=kitchen'
  );
  assert.equal(
    buildPortalShareUrl('https://ais-dev-example.run.app', 'admin'),
    'https://ais-dev-example.run.app/?portal=admin'
  );

  // Ordering site: accessible to customer
  assert.equal(canUserAccessPortal('order', 'customer'), true);
  // Kitchen site: blocks customer, allows kitchen and admin
  assert.equal(canUserAccessPortal('kitchen', 'customer'), false);
  assert.equal(canUserAccessPortal('kitchen', 'kitchen'), true);
  assert.equal(canUserAccessPortal('kitchen', 'admin'), true);
  // Payment & Admin site: blocks customer and kitchen, allows admin only
  assert.equal(canUserAccessPortal('admin', 'customer'), false);
  assert.equal(canUserAccessPortal('admin', 'kitchen'), false);
  assert.equal(canUserAccessPortal('admin', 'admin'), true);
});

test('Student Profile Order History evaluates live stock and skips sold-out items when determining reorder availability', () => {
  const sampleMenu: MenuItem[] = [
    {
      id: 'item_idli',
      name: 'Mallige Steamed Idli (3 Pcs)',
      price: 35,
      category: 'Dosa & Idli',
      photo: '',
      isVeg: true,
      description: '',
      prepTimeMinutes: 5,
      available: true,
    },
    {
      id: 'item_bonda',
      name: 'Mysore Masala Bonda (4 Pcs)',
      price: 35,
      category: 'Snacks & Vada',
      photo: '',
      isVeg: true,
      description: '',
      prepTimeMinutes: 8,
      available: false, // sold out!
    },
  ];

  const pastOrder: CanteenOrder = {
    id: 'ord_103',
    userId: 'u1',
    userEmail: 'ananya.r@snpsu.edu.in',
    userName: 'Ananya Krishnan',
    studentStaffId: 'CS23B018',
    tokenNumber: 103,
    dateStr: '2026-10-23',
    orderType: 'takeaway',
    tableNumber: '',
    slotTime: '12:20',
    slotId: '2026-10-23_12:20',
    items: [
      { itemId: 'item_idli', name: 'Mallige Steamed Idli (3 Pcs)', price: 35, quantity: 2, isVeg: true, prepTimeMinutes: 5 },
      { itemId: 'item_bonda', name: 'Mysore Masala Bonda (4 Pcs)', price: 35, quantity: 1, isVeg: true, prepTimeMinutes: 8 },
    ],
    subtotal: 105,
    discount: 3,
    totalAmount: 102,
    status: 'collected',
    paymentMode: 'test',
    paymentId: 'cf_103',
    refundStatus: 'none',
    maxPrepTimeMinutes: 8,
    createdAtMs: 2000,
    updatedAtMs: 3000,
  };

  const history = buildProfileOrderHistory([pastOrder], sampleMenu);
  assert.equal(history.length, 1);
  assert.equal(history[0].availableItemCount, 1);
  assert.deepEqual(history[0].soldOutItemNames, ['Mysore Masala Bonda (4 Pcs)']);
  assert.equal(history[0].canReorder, true);
});

test('Dynamic Peak Hour Alert Banner detects >=75% peak slots and recommends <=25% quiet slots with discount', () => {
  const sampleSlots: SlotInfo[] = [
    {
      slotId: 's_peak',
      dateStr: '2026-03-31',
      timeStr: '10:00',
      label: '10:00 AM',
      bookedCount: 3,
      capacity: 4,
      isFull: false,
      isPastCutoff: false,
      loadRatio: 0.75,
      qualifiesForQuietDiscount: false,
      discountAmount: 0,
    },
    {
      slotId: 's_quiet',
      dateStr: '2026-03-31',
      timeStr: '10:20',
      label: '10:20 AM',
      bookedCount: 0,
      capacity: 4,
      isFull: false,
      isPastCutoff: false,
      loadRatio: 0,
      qualifiesForQuietDiscount: true,
      discountAmount: 3,
    },
  ];

  const banner = evaluatePeakHourAlertBanner(sampleSlots, 3);
  assert.equal(banner.isPeakDetected, true);
  assert.equal(banner.discountAmount, 3);
  assert.equal(banner.recommendedSlot?.slotId, 's_quiet');
  assert.ok(banner.headline.includes('10:00 AM is 75% full'));
  assert.ok(banner.headline.includes('₹3 Off'));
});

test('system/light/dark theme resolution, unique staff credentials, and customer directory details work accurately', () => {
  assert.equal(resolveEffectiveTheme('system', false), 'light');
  assert.equal(resolveEffectiveTheme('system', true), 'dark');
  assert.equal(resolveEffectiveTheme('light', true), 'light');
  assert.equal(resolveEffectiveTheme('dark', false), 'dark');

  assert.equal(DEFAULT_KITCHEN_CREDENTIALS.staffId, 'SAP-KIT-101');
  assert.equal(DEFAULT_KITCHEN_CREDENTIALS.uniqueId, 'SAP-KIT-101');
  assert.equal(DEFAULT_KITCHEN_CREDENTIALS.password, 'SaptienKitchen@2026');
  assert.equal(DEFAULT_ADMIN_CREDENTIALS.staffId, 'SAP-ADM-001');
  assert.equal(DEFAULT_ADMIN_CREDENTIALS.uniqueId, 'SAP-ADM-001');
  assert.equal(DEFAULT_ADMIN_CREDENTIALS.password, 'SaptienAdmin#2026');

  const details = buildCustomerDirectoryDetails(
    [
      {
        uid: 'u1',
        email: 'ananya.r@snpsu.edu.in',
        fullName: 'Ananya Krishnan',
        studentStaffId: 'CS23B018',
        role: 'customer',
      },
    ],
    [
      {
        id: 'ord_101',
        userId: 'u1',
        userEmail: 'ananya.r@snpsu.edu.in',
        userName: 'Ananya Krishnan',
        studentStaffId: 'CS23B018',
        tokenNumber: 101,
        dateStr: '2026-10-23',
        orderType: 'dine_in',
        tableNumber: 'T-04',
        slotTime: '12:10',
        slotId: '2026-10-23_12:10',
        items: [],
        subtotal: 75,
        discount: 3,
        totalAmount: 72,
        status: 'placed',
        paymentMode: 'test',
        paymentId: 'cf_101',
        refundStatus: 'none',
        maxPrepTimeMinutes: 8,
        createdAtMs: 5000,
        updatedAtMs: 5000,
      },
    ]
  );

  assert.equal(details.length, 1);
  assert.equal(details[0].totalOrdersCount, 1);
  assert.equal(details[0].totalSpent, 72);
  assert.equal(details[0].totalDiscountSaved, 3);
  assert.equal(details[0].lastOrderToken, 101);
});

test('filterAndSortMenuItems and computeCategorySalesBreakdown accurately filter, sort, and aggregate real menu and order data', async () => {
  const { filterAndSortMenuItems, computeCategorySalesBreakdown } = await import('./canteenLogic');

  const sampleMenu: MenuItem[] = [
    {
      id: 'dosa',
      name: 'Ghee Roast Masala Dosa',
      price: 55,
      category: 'Dosa & Idli',
      photo: '',
      isVeg: true,
      description: 'Crispy dosa',
      prepTimeMinutes: 8,
      available: true,
    },
    {
      id: 'coffee',
      name: 'Degree Filter Coffee',
      price: 20,
      category: 'Beverages',
      photo: '',
      isVeg: true,
      description: 'Brass davara coffee',
      prepTimeMinutes: 4,
      available: true,
    },
    {
      id: 'chicken',
      name: 'Chettinad Chicken Biryani',
      price: 110,
      category: 'Rice & Meals',
      photo: '',
      isVeg: false,
      description: 'Spicy biryani',
      prepTimeMinutes: 15,
      available: false,
    },
  ];

  const vegUnder60 = filterAndSortMenuItems(sampleMenu, {
    category: 'All',
    dietFilter: 'veg',
    searchQuery: '',
    maxPrice: 60,
    maxPrepTime: 10,
    onlyAvailable: true,
    sortBy: 'price_asc',
  });
  assert.equal(vegUnder60.length, 2);
  assert.equal(vegUnder60[0].id, 'coffee');
  assert.equal(vegUnder60[1].id, 'dosa');

  const breakdown = computeCategorySalesBreakdown(
    [
      {
        id: 'o1',
        userId: 'u1',
        userEmail: 's@snpsu.edu.in',
        userName: 'Student',
        studentStaffId: 'CS1',
        tokenNumber: 105,
        dateStr: '2026-10-23',
        orderType: 'takeaway',
        tableNumber: '',
        slotTime: '12:10',
        slotId: '2026-10-23_12:10',
        items: [
          { itemId: 'dosa', name: 'Ghee Roast Masala Dosa', price: 55, quantity: 2, isVeg: true, prepTimeMinutes: 8 },
          { itemId: 'coffee', name: 'Degree Filter Coffee', price: 20, quantity: 1, isVeg: true, prepTimeMinutes: 4 },
        ],
        subtotal: 130,
        discount: 3,
        totalAmount: 127,
        status: 'collected',
        paymentMode: 'test',
        paymentId: 'cf_105',
        refundStatus: 'none',
        maxPrepTimeMinutes: 8,
        createdAtMs: 1000,
        updatedAtMs: 2000,
      },
    ],
    sampleMenu
  );

  const dosaCat = breakdown.find((b) => b.category === 'Dosa & Idli');
  const bevCat = breakdown.find((b) => b.category === 'Beverages');
  assert.equal(dosaCat?.portionsSold, 2);
  assert.equal(dosaCat?.revenue, 110);
  assert.equal(dosaCat?.totalItems, 1);
  assert.equal(dosaCat?.inStockItems, 1);
  assert.equal(bevCat?.portionsSold, 1);
  assert.equal(bevCat?.revenue, 20);
});

import {
  evaluateOrderRateLimit,
  generateGstTaxBill,
  PROTOTYPE_PORTALS,
  PROTOTYPE_UNIFIED_MODE,
} from './canteenLogic';

test('2026 Kitchen-Accepted Physical GST Tax Invoice & Token Bill generates accurate 2.5% CGST + 2.5% SGST and token metadata', () => {
  assert.equal(PROTOTYPE_UNIFIED_MODE, true);
  assert.equal(PROTOTYPE_PORTALS.length, 3);
  assert.deepEqual(
    PROTOTYPE_PORTALS.map((p) => p.id),
    ['order', 'kitchen', 'admin']
  );

  const placedOrder: CanteenOrder = {
    id: 'ord_2026_108',
    userId: 'u_student_1',
    userEmail: 'ananya.r@snpsu.edu.in',
    userName: 'Ananya Krishnan',
    studentStaffId: 'CS23B018',
    tokenNumber: 108,
    dateStr: '2026-11-11',
    orderType: 'dine_in',
    tableNumber: 'T-04',
    slotTime: '12:30',
    slotId: '2026-11-11_12:30',
    items: [
      {
        itemId: 'item_masala_dosa',
        name: 'Ghee Roast Masala Dosa',
        price: 55,
        quantity: 2,
        isVeg: true,
        prepTimeMinutes: 8,
      },
      {
        itemId: 'item_filter_coffee',
        name: 'Kumbakonam Degree Filter Coffee',
        price: 20,
        quantity: 1,
        isVeg: true,
        prepTimeMinutes: 4,
      },
    ],
    subtotal: 130,
    discount: 3,
    totalAmount: 127,
    status: 'placed',
    paymentMode: 'test',
    paymentId: 'cf_pay_108',
    refundStatus: 'none',
    maxPrepTimeMinutes: 8,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  };

  // While status is 'placed', physical GST token bill awaits kitchen acceptance
  const pendingBill = generateGstTaxBill(placedOrder);
  assert.equal(pendingBill.isIssued, false);
  assert.equal(pendingBill.lifecycleStageLabel, 'PENDING KITCHEN ACCEPTANCE');
  assert.equal(pendingBill.tokenNumber, 108);
  assert.equal(pendingBill.tokenDisplay, '#108');

  // Once kitchen accepts the order (transitions to 'preparing'), physical GST bill is issued
  const acceptedBill = generateGstTaxBill({
    ...placedOrder,
    status: 'preparing',
    updatedAtMs: 1700000060000,
  });
  assert.equal(acceptedBill.isIssued, true);
  assert.equal(acceptedBill.lifecycleStageLabel, 'KITCHEN ACCEPTED · PREPARING');
  assert.equal(acceptedBill.invoiceNumber, 'INV-20261111-0108');
  assert.equal(acceptedBill.kotNumber, 'KOT-1111-108');
  assert.equal(acceptedBill.gstin, '33AABCM2026C1Z8');
  assert.equal(acceptedBill.sacCode, '996331');
  assert.equal(acceptedBill.totalQuantity, 3);
  assert.equal(acceptedBill.itemsGrossSubtotal, 130);
  assert.equal(acceptedBill.discountAmount, 3);
  assert.equal(acceptedBill.grandTotalPaid, 127);

  // Verify exact 5% GST split (2.5% CGST + 2.5% SGST) and zero paisa drift
  const recomputedTotal = Number(
    (acceptedBill.taxableAmount + acceptedBill.cgstAmount + acceptedBill.sgstAmount).toFixed(2)
  );
  assert.equal(recomputedTotal, acceptedBill.grandTotalPaid);
  assert.equal(acceptedBill.cgstRatePercent, 2.5);
  assert.equal(acceptedBill.sgstRatePercent, 2.5);
  assert.equal(acceptedBill.barcodeBars.length, 28);
});

test('customizable Per-Hour (60m) and Per-30-Minute (30m) order rate limit enforces 30 orders/hr default and calculates remaining capacity', () => {
  const nowMs = 1_800_000_000_000;

  // 1. Zero orders initially -> 0 / 30 in 1 Hour
  const zeroStatus = evaluateOrderRateLimit([], { rateLimitWindowMinutes: 60, maxOrdersPerWindow: 30 }, nowMs);
  assert.equal(zeroStatus.ordersInWindow, 0);
  assert.equal(zeroStatus.maxOrders, 30);
  assert.equal(zeroStatus.remainingOrders, 30);
  assert.equal(zeroStatus.isLimitReached, false);
  assert.equal(zeroStatus.windowLabel, '1 Hour');

  // 2. 30 active orders within the last 60 minutes -> limit reached
  const thirtyOrders = Array.from({ length: 30 }, (_, idx) => ({
    status: 'placed' as const,
    createdAtMs: nowMs - (idx + 1) * 60_000, // 1 to 30 mins ago
  }));
  const fullHourly = evaluateOrderRateLimit(
    thirtyOrders,
    { rateLimitWindowMinutes: 60, maxOrdersPerWindow: 30 },
    nowMs
  );
  assert.equal(fullHourly.ordersInWindow, 30);
  assert.equal(fullHourly.remainingOrders, 0);
  assert.equal(fullHourly.isLimitReached, true);
  assert.ok(fullHourly.minutesUntilNextSlotFrees >= 1);

  // 3. Cancelled/expired orders or orders older than the window do NOT count against the cap
  const mixedOrders = [
    { status: 'placed' as const, createdAtMs: nowMs - 10 * 60_000 }, // counts (10m ago)
    { status: 'preparing' as const, createdAtMs: nowMs - 20 * 60_000 }, // counts (20m ago)
    { status: 'cancelled' as const, createdAtMs: nowMs - 5 * 60_000 }, // ignored (cancelled)
    { status: 'placed' as const, createdAtMs: nowMs - 45 * 60_000 }, // ignored in 30m window!
  ];
  const halfHourStatus = evaluateOrderRateLimit(
    mixedOrders,
    { rateLimitWindowMinutes: 30, maxOrdersPerWindow: 15 },
    nowMs
  );
  assert.equal(halfHourStatus.windowMinutes, 30);
  assert.equal(halfHourStatus.windowLabel, '30 Minutes');
  assert.equal(halfHourStatus.ordersInWindow, 2);
  assert.equal(halfHourStatus.remainingOrders, 13);
  assert.equal(halfHourStatus.isLimitReached, false);
});

test('Simple local Bengaluru seed menu includes everyday canteen dishes across all 4 categories without hotel brand names', async () => {
  const { SEED_SOUTH_INDIAN_MENU } = await import('../data/seedMenu');
  assert.ok(SEED_SOUTH_INDIAN_MENU.length >= 10);
  const names = SEED_SOUTH_INDIAN_MENU.map((m) => m.name);
  assert.ok(names.includes('Benne Masala Dosa'));
  assert.ok(names.includes('Thatte Idli with Benne & Podi'));
  assert.ok(names.includes('Akki Rotti & Kempu Chutney'));
  assert.ok(names.includes('Bisi Bele Bath & Kara Boondi'));
  assert.ok(names.includes('Donne Chicken Biryani'));
  assert.ok(names.includes('Filter Kaapi'));
  // Ensure no copied hotel names remain
  for (const name of names) {
    assert.equal(/CTR|Bidadi|VV Puram|Chikmagalur|Gandhinagar|Military/i.test(name), false);
  }
});

test('Browser Push Notification triggers strictly on preparing -> ready transition and formats token payload accurately', async () => {
  const {
    shouldTriggerOrderReadyPushNotification,
    buildOrderReadyPushPayload,
  } = await import('./canteenLogic');

  assert.equal(shouldTriggerOrderReadyPushNotification('preparing', 'ready'), true);
  assert.equal(shouldTriggerOrderReadyPushNotification('placed', 'preparing'), false);
  assert.equal(shouldTriggerOrderReadyPushNotification('ready', 'ready'), false);
  assert.equal(shouldTriggerOrderReadyPushNotification('ready', 'collected'), false);
  assert.equal(shouldTriggerOrderReadyPushNotification(undefined, 'ready'), false);

  const payload = buildOrderReadyPushPayload({
    id: 'ord_push_109',
    tokenNumber: 109,
    orderType: 'takeaway',
    tableNumber: '',
    slotTime: '12:20',
    items: [
      { itemId: 'item_masala_dosa', name: 'Benne Masala Dosa', price: 55, quantity: 2, isVeg: true, prepTimeMinutes: 8 },
      { itemId: 'item_filter_coffee', name: 'Filter Kaapi', price: 20, quantity: 1, isVeg: true, prepTimeMinutes: 4 },
    ],
  });

  assert.ok(payload.title.includes('Order Ready for Collection!'));
  assert.ok(payload.title.includes('Token #109'));
  assert.ok(payload.body.includes('2× Benne Masala Dosa'));
  assert.ok(payload.body.includes('1× Filter Kaapi'));
  assert.ok(payload.body.includes('Counter Pickup'));
  assert.equal(payload.tag, 'saptien-order-ready-ord_push_109');
});

test('Menu items resolve subtle Vegan, High Protein, or Spicy dietary badges and support dietary search', async () => {
  const { SEED_SOUTH_INDIAN_MENU } = await import('../data/seedMenu');
  const { resolveMenuItemDietaryBadge, filterAndSortMenuItems } = await import('./canteenLogic');

  const badges = SEED_SOUTH_INDIAN_MENU.map((item) => resolveMenuItemDietaryBadge(item));
  // Every item resolves to one of the 3 allowed dietary badges
  for (const badge of badges) {
    assert.ok(badge === 'Vegan' || badge === 'High Protein' || badge === 'Spicy');
  }
  // Ensure all 3 badge types are represented across the menu
  assert.ok(badges.includes('Vegan'));
  assert.ok(badges.includes('High Protein'));
  assert.ok(badges.includes('Spicy'));

  // Searching by badge keyword filters accurately
  const veganItems = filterAndSortMenuItems(SEED_SOUTH_INDIAN_MENU, {
    category: 'All',
    dietFilter: 'all',
    searchQuery: 'Vegan',
  });
  assert.ok(veganItems.length >= 2);
  assert.ok(veganItems.every((item) => resolveMenuItemDietaryBadge(item) === 'Vegan'));
});

test('Classroom Student-Only QR URL locks portal routing strictly to Student Ordering and generates valid ISO QR matrix', async () => {
  const {
    isStudentOnlyMode,
    buildStudentOnlyClassroomUrl,
    resolvePortalFromPath,
  } = await import('./canteenLogic');
  const { generateQrCodeMatrix } = await import('./qrCode');

  assert.equal(isStudentOnlyMode('?studentOnly=1'), true);
  assert.equal(isStudentOnlyMode('?mode=student'), true);
  assert.equal(isStudentOnlyMode('?portal=kitchen'), false);

  // Even if someone appends portal=kitchen or /admin while studentOnly=1 is active, it locks to 'order'
  assert.equal(resolvePortalFromPath('/kitchen', '?portal=kitchen&studentOnly=1'), 'order');
  assert.equal(resolvePortalFromPath('/admin', '?portal=admin&studentOnly=1'), 'order');

  const classroomUrl = buildStudentOnlyClassroomUrl(
    'https://ais-dev-fhyiowbxmdbhjsxaduccsa-763214530749.asia-northeast1.run.app'
  );
  assert.equal(
    classroomUrl,
    'https://ais-pre-fhyiowbxmdbhjsxaduccsa-763214530749.asia-northeast1.run.app/?studentOnly=1'
  );

  const matrix = generateQrCodeMatrix(classroomUrl);
  assert.ok(matrix.length >= 21);
  assert.equal(matrix.length, matrix[0].length);
  // Top-left finder pattern corner and center (3,3) must be dark (true)
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[3][3], true);
  assert.equal(matrix[0][matrix.length - 1], true);
  assert.equal(matrix[matrix.length - 1][0], true);
});
