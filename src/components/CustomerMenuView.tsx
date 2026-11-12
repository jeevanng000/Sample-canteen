import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Camera,
  Check,
  Clock,
  Flame,
  ImagePlus,
  Leaf,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import { SEED_SOUTH_INDIAN_MENU } from '../data/seedMenu';
import {
  computeAuthoritativeOrderSnapshot,
  filterAndSortMenuItems,
  resolveMenuItemDietaryBadge,
  type MenuItem,
  type OrderType,
} from '../utils/canteenLogic';

interface CustomerMenuViewProps {
  onOrderPlaced: () => void;
}

const CATEGORIES: Array<'All' | MenuItem['category']> = [
  'All',
  'Dosa & Idli',
  'Rice & Meals',
  'Snacks & Vada',
  'Beverages',
];

export const CustomerMenuView: React.FC<CustomerMenuViewProps> = ({ onOrderPlaced }) => {
  const {
    menu,
    menuLoading,
    settings,
    slots,
    orderRateLimit,
    cart,
    setItemQuantity,
    clearCart,
    placeOrder,
    updateMenuItemPhoto,
    pushPermission,
    pushAlertsEnabled,
    enableBrowserPushNotifications,
    togglePushAlertsEnabled,
  } = useCanteen();

  const [selectedCategory, setSelectedCategory] = useState<'All' | MenuItem['category']>('All');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non_veg'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Side Cart Bubble Drawer State (never forces the user to scroll down)
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [tableNumber, setTableNumber] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showOfferToast, setShowOfferToast] = useState<boolean>(true);

  // Dish Picture Editor Modal State
  const [editingPhotoItem, setEditingPhotoItem] = useState<MenuItem | null>(null);
  const [customPhotoInput, setCustomPhotoInput] = useState<string>('');
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // Automatically assign an open slot behind the scenes for token generation
  useEffect(() => {
    const preferredSlot =
      slots.find((s) => !s.isFull && s.qualifiesForQuietDiscount) ||
      slots.find((s) => !s.isFull) ||
      slots[0];
    if (preferredSlot && preferredSlot.slotId !== selectedSlotId) {
      setSelectedSlotId(preferredSlot.slotId);
    }
  }, [slots, selectedSlotId]);

  const filteredMenu = useMemo(
    () =>
      filterAndSortMenuItems(menu, {
        category: selectedCategory,
        dietFilter,
        searchQuery,
        maxPrice: 1000,
        maxPrepTime: 120,
        onlyAvailable: false,
        sortBy: 'featured',
      }),
    [menu, selectedCategory, dietFilter, searchQuery]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: menu.length };
    for (const item of menu) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [menu]);

  const cartSummary = useMemo(
    () =>
      computeAuthoritativeOrderSnapshot(
        cart,
        menu,
        settings.quietSlotDiscount
      ),
    [cart, menu, settings.quietSlotDiscount]
  );

  const totalCartItems = useMemo(
    () => cartSummary.items.reduce((sum, item) => sum + item.quantity, 0),
    [cartSummary.items]
  );

  const resetFilters = () => {
    setSelectedCategory('All');
    setDietFilter('all');
    setSearchQuery('');
  };

  const openPhotoEditor = (item: MenuItem) => {
    setEditingPhotoItem(item);
    setCustomPhotoInput(item.photo.startsWith('data:image/svg') ? '' : item.photo);
    setPhotoUploadError(null);
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setPhotoUploadError('Please choose an image smaller than 2.5 MB.');
      return;
    }
    setPhotoUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomPhotoInput(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhotoItem) return;
    await updateMenuItemPhoto(editingPhotoItem.id, customPhotoInput);
    setEditingPhotoItem(null);
  };

  const handleResetPhotoToDefault = async () => {
    if (!editingPhotoItem) return;
    const seedDefault = SEED_SOUTH_INDIAN_MENU.find((m) => m.id === editingPhotoItem.id);
    if (seedDefault) {
      await updateMenuItemPhoto(editingPhotoItem.id, seedDefault.photo);
    }
    setEditingPhotoItem(null);
  };

  const executeOrderPlacement = async () => {
    setCheckoutError(null);
    if (!settings.isOpen) {
      setCheckoutError('Canteen is closed right now. Please order during opening hours.');
      setIsCartDrawerOpen(true);
      return;
    }
    if (orderRateLimit.isLimitReached) {
      setCheckoutError(
        `Kitchen is full for this ${orderRateLimit.windowLabel} (${orderRateLimit.ordersInWindow}/${orderRateLimit.maxOrders} orders). Next slot opens in ~${orderRateLimit.minutesUntilNextSlotFrees} min.`
      );
      setIsCartDrawerOpen(true);
      return;
    }

    const fallbackSlotId =
      selectedSlotId ||
      slots.find((s) => !s.isFull)?.slotId ||
      slots[0]?.slotId ||
      'slot_auto';

    setPlacingOrder(true);
    try {
      await placeOrder({
        orderType,
        tableNumber,
        slotId: fallbackSlotId,
      });
      setIsCartDrawerOpen(false);
      onOrderPlaced();
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not place order.');
      setIsCartDrawerOpen(true);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeOrderPlacement();
  };

  const handlePushPillClick = async () => {
    if (pushPermission === 'default') {
      await enableBrowserPushNotifications();
      return;
    }
    togglePushAlertsEnabled(!pushAlertsEnabled);
  };

  return (
    <div className="space-y-4 pb-24 pr-0 sm:pr-4">
      {/* 1. Compact, Phone-Friendly Canteen Header + Price Offer Banner */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="mac-glass-card flex flex-col justify-between rounded-2xl p-4 sm:rounded-3xl sm:p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${
                  settings.isOpen
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    settings.isOpen ? 'bg-emerald-600' : 'bg-red-600'
                  }`}
                />
                {settings.isOpen ? 'Open Now' : 'Closed'}
              </span>
              <span className="text-slate-500">
                {settings.openTime} – {settings.closeTime}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                8–12 mins
              </span>
            </div>

            {/* 1-Tap Browser Push Alert Status / Enable Pill */}
            <button
              type="button"
              onClick={() => void handlePushPillClick()}
              title="Browser push notification when order status changes from Preparing to Ready"
              className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer transition ${
                pushAlertsEnabled
                  ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                  : 'mac-pill-inactive text-slate-600'
              }`}
            >
              {pushAlertsEnabled ? (
                <>
                  <Bell className="h-3 w-3 text-emerald-600" />
                  <span>
                    {pushPermission === 'default'
                      ? 'Enable Ready Push Alerts'
                      : 'Ready Push Alerts: ON'}
                  </span>
                </>
              ) : (
                <>
                  <BellOff className="h-3 w-3 text-slate-400" />
                  <span>Push Alerts: Muted</span>
                </>
              )}
            </button>
          </div>

          <h1 className="mt-1.5 font-display text-xl font-bold text-slate-900 sm:text-2xl">
            Saptien · Local Bengaluru Campus Menu
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
            SAPTHAGIRI NPS UNIVERSITY (Bengaluru) — Simple everyday canteen tiffin &amp; meals. Tap <strong className="font-bold text-emerald-700">ADD +</strong>, pay from the <strong className="font-bold text-emerald-700">Side Cart Bubble</strong>, and get a browser push alert when Ready!
          </p>
        </div>

        {/* Simple Price Offer Card */}
        <div className="flex lg:col-span-5">
          {showOfferToast ? (
            <aside
              role="status"
              aria-live="polite"
              aria-label="Campus Price Offer Notification"
              className="mac-glass-card flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 sm:rounded-3xl sm:px-5 sm:py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950">
                  <Sparkles className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Campus Price Offer
                  </span>
                  <p className="font-display text-sm sm:text-base font-bold text-slate-900">
                    Flat ₹{settings.quietSlotDiscount} OFF Every Order
                  </p>
                  <p className="text-xs text-slate-600">
                    {totalCartItems > 0
                      ? `₹${cartSummary.discount} saved! Pay ₹${cartSummary.totalAmount} using the side bubble.`
                      : `Applied automatically when you add items.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfferToast(false)}
                aria-label="Dismiss price offer notification"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </aside>
          ) : (
            <div className="mac-glass-card flex w-full items-center justify-between rounded-2xl px-4 py-3.5 sm:rounded-3xl sm:px-5">
              <div>
                <p className="font-display text-sm font-bold text-slate-900">
                  Flat ₹{settings.quietSlotDiscount} OFF Active
                </p>
                <p className="text-xs text-slate-500">Applied automatically</p>
              </div>
              <button
                type="button"
                onClick={() => setShowOfferToast(true)}
                className="mac-pill-inactive min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
              >
                Show Offer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Closed or Kitchen Rate-Limit Reached Alerts */}
      {!settings.isOpen && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p>Canteen is currently closed</p>
            <p className="text-xs font-normal text-red-700">
              Ordering is available during canteen hours ({settings.openTime} – {settings.closeTime}).
            </p>
          </div>
        </div>
      )}

      {settings.isOpen && orderRateLimit.isLimitReached && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p>
              Kitchen is at full capacity ({orderRateLimit.ordersInWindow}/{orderRateLimit.maxOrders} orders in {orderRateLimit.windowLabel})
            </p>
            <p className="text-xs font-normal text-amber-800">
              Please wait ~{orderRateLimit.minutesUntilNextSlotFrees} min for the next order window to open.
            </p>
          </div>
        </div>
      )}

      {/* 2. Simple Search + Veg / Non-Veg Toggle + Large Category Buttons */}
      <section className="space-y-2.5" aria-label="Menu search and categories">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <label htmlFor="menu-search" className="sr-only">
              Search menu items
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="menu-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Benne Dosa, Thatte Idli, Kaapi, Donne Biryani..."
              className="min-h-[44px] w-full rounded-2xl border border-white/80 pr-9 pl-10 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Simple Veg / Non-Veg Toggle */}
          <div
            role="group"
            aria-label="Dietary preference filter"
            className="mac-pill-inactive grid grid-cols-3 sm:inline-flex rounded-2xl p-1"
          >
            <button
              type="button"
              aria-pressed={dietFilter === 'all'}
              onClick={() => setDietFilter('all')}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap ${
                dietFilter === 'all'
                  ? 'mac-pill-active'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>All</span>
            </button>
            <button
              type="button"
              aria-pressed={dietFilter === 'veg'}
              onClick={() => setDietFilter('veg')}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap ${
                dietFilter === 'veg'
                  ? 'mac-pill-active'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-xs border border-emerald-700 bg-emerald-600"
              />
              <span>Pure Veg</span>
            </button>
            <button
              type="button"
              aria-pressed={dietFilter === 'non_veg'}
              onClick={() => setDietFilter('non_veg')}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap ${
                dietFilter === 'non_veg'
                  ? 'mac-pill-active'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-xs border border-red-700 bg-red-600"
              />
              <span>Non-Veg</span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div
          role="tablist"
          aria-label="Menu categories"
          className="flex items-center gap-2 overflow-x-auto pb-1"
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            const count = categoryCounts[category] ?? 0;
            return (
              <button
                key={category}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap shrink-0 ${
                  active ? 'mac-pill-active' : 'mac-pill-inactive'
                }`}
              >
                <span>{category}</span>
                <span className="font-mono text-xs opacity-75 tabular-nums">({count})</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Full-Width Swiggy / Zomato Menu Cards (No Bottom Cart Forcing User to Scroll Down!) */}
      <div>
        {menuLoading ? (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white p-4"
              />
            ))}
          </div>
        ) : filteredMenu.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <Utensils className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 font-display text-lg font-bold text-slate-900">
              No dishes found
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Try clearing your search or choosing &ldquo;All&rdquo; categories.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 min-h-[44px] rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              Show All Dishes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {filteredMenu.map((item) => {
              const qty = cart[item.id] || 0;
              const isSoldOut = !item.available;
              const dietaryBadge = resolveMenuItemDietaryBadge(item);

              const badgeStyleClass =
                dietaryBadge === 'Vegan'
                  ? 'dietary-badge-vegan'
                  : dietaryBadge === 'High Protein'
                    ? 'dietary-badge-protein'
                    : 'dietary-badge-spicy';

              const BadgeIcon =
                dietaryBadge === 'Vegan'
                  ? Leaf
                  : dietaryBadge === 'High Protein'
                    ? Zap
                    : Flame;

              return (
                <article
                  key={item.id}
                  className={`mac-glass-card flex items-start justify-between gap-3 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 ${
                    isSoldOut ? 'opacity-65' : ''
                  }`}
                >
                  {/* Left Side: Veg/Non-Veg Symbol + Subtle Dietary Badge, Large Dish Title, Bold Price, Short Description */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        aria-label={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border-2 ${
                          item.isVeg ? 'border-emerald-600' : 'border-red-600'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            item.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        />
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          item.isVeg ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {item.isVeg ? 'Veg' : 'Non-Veg'}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 tabular-nums">
                        <Clock className="h-3 w-3" />
                        {item.prepTimeMinutes}m
                      </span>
                      <span
                        aria-label={`Dietary badge: ${dietaryBadge}`}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-tight leading-none whitespace-nowrap ${badgeStyleClass}`}
                      >
                        <BadgeIcon className="h-2.5 w-2.5 shrink-0" />
                        <span>{dietaryBadge}</span>
                      </span>
                    </div>

                    <h3 className="mt-1 font-display text-base sm:text-lg font-bold leading-snug text-slate-900">
                      {item.name}
                    </h3>

                    <p className="mt-0.5 font-mono text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
                      ₹{item.price}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>

                  {/* Right Side: Square Dish Photo + Edit Pic Button + Overlapping ADD / - 1 + */}
                  <div className="relative flex w-28 sm:w-30 shrink-0 flex-col items-center pb-2">
                    <div className="relative h-26 w-28 sm:h-28 sm:w-30 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
                      <img
                        src={item.photo}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className={`h-full w-full object-cover ${
                          isSoldOut ? 'grayscale' : ''
                        }`}
                      />

                      {/* Quick 1-Tap "Edit Pic" Button on Top-Right of Dish Photo */}
                      <button
                        type="button"
                        onClick={() => openPhotoEditor(item)}
                        title={`Edit picture for ${item.name}`}
                        aria-label={`Edit picture for ${item.name}`}
                        className="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/75 text-white shadow-xs hover:bg-slate-950 cursor-pointer"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>

                      {isSoldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65">
                          <span className="rounded-lg bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Swiggy / Zomato Overlapping ADD or - 1 + Stepper */}
                    <div className="-mt-3.5 z-10 w-24 sm:w-26">
                      {isSoldOut ? (
                        <div className="flex min-h-[38px] w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-2 py-1 text-center text-xs font-bold text-slate-500">
                          Sold Out
                        </div>
                      ) : qty === 0 ? (
                        <button
                          type="button"
                          disabled={!settings.isOpen}
                          onClick={() => setItemQuantity(item.id, 1)}
                          aria-label={`Add ${item.name} to cart`}
                          className="swiggy-add-btn flex min-h-[40px] w-full items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-extrabold tracking-wide disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                          <span>ADD</span>
                          <Plus className="h-4 w-4 stroke-[2.8]" />
                        </button>
                      ) : (
                        <div className="flex min-h-[40px] w-full items-center justify-between rounded-xl bg-emerald-600 px-1 py-1 text-white shadow-md">
                          <button
                            type="button"
                            onClick={() => setItemQuantity(item.id, qty - 1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <Minus className="h-4 w-4 stroke-[2.8]" />
                          </button>
                          <span className="font-mono text-sm sm:text-base font-extrabold tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            disabled={qty >= 9}
                            onClick={() => setItemQuantity(item.id, qty + 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-4 w-4 stroke-[2.8]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. FLOATING SIDE CART BUBBLE (Docked on bottom-left on phone so right-side ADD/+/- buttons are never covered!) */}
      <aside
        aria-label="Floating Side Cart Bubble"
        className="fixed bottom-16 left-3 z-40 flex items-center gap-2 sm:right-5 sm:bottom-6 sm:left-auto sm:flex-col sm:items-end"
      >
        <button
          type="button"
          onClick={() => setIsCartDrawerOpen(true)}
          aria-label={
            totalCartItems > 0
              ? `Open Cart Bubble: ${totalCartItems} items, ₹${cartSummary.totalAmount}`
              : 'Open Cart Bubble (0 items)'
          }
          className={`group relative flex items-center gap-2.5 rounded-full px-4 py-2.5 text-left transition-transform sm:flex-col sm:justify-center sm:rounded-3xl sm:px-4 sm:py-3 sm:text-center cursor-pointer ${
            totalCartItems > 0 ? 'side-cart-bubble' : 'side-cart-bubble-empty'
          }`}
        >
          {/* Item Count Badge */}
          <span
            className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 font-mono text-xs font-extrabold shadow-xs tabular-nums sm:absolute sm:-top-2 sm:-left-2 sm:h-7 sm:min-w-[28px] ${
              totalCartItems > 0
                ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                : 'bg-slate-700 text-slate-200'
            }`}
          >
            {totalCartItems}
          </span>

          <ShoppingBag className="h-5 w-5 shrink-0 stroke-[2.2] sm:h-6 sm:w-6" />
          <div className="leading-tight">
            <span className="block font-display text-xs font-extrabold tracking-tight">
              {totalCartItems > 0 ? `₹${cartSummary.totalAmount}` : 'Cart'}
            </span>
            {totalCartItems > 0 && (
              <span className="block text-[10px] font-bold text-emerald-100">
                View Cart &rarr;
              </span>
            )}
          </div>
        </button>

        {/* Direct 1-Tap Pay Pill next to / under the Side Cart Bubble when items are added */}
        {totalCartItems > 0 && (
          <button
            type="button"
            disabled={!settings.isOpen || orderRateLimit.isLimitReached || placingOrder}
            onClick={() => void executeOrderPlacement()}
            className="mac-pill-active flex min-h-[42px] items-center justify-center gap-1 rounded-full px-4 py-2 text-xs font-extrabold shadow-lg sm:min-h-[38px] sm:rounded-2xl sm:px-3.5 sm:py-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>
              {placingOrder
                ? 'Paying...'
                : settings.testMode
                  ? `Pay (test) · ₹${cartSummary.totalAmount}`
                  : `Pay · ₹${cartSummary.totalAmount}`}
            </span>
          </button>
        )}
      </aside>

      {/* 5. SLIDE-OVER / POPOVER CART DRAWER (Opens from the Side Bubble without scrolling) */}
      {isCartDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Your Food Cart Drawer"
          onClick={() => setIsCartDrawerOpen(false)}
        >
          <div
            className="ios-glass-drawer animate-drawer-up flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Your Food Cart ({totalCartItems})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {totalCartItems > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCartDrawerOpen(false)}
                  aria-label="Close cart drawer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {cartSummary.items.length === 0 ? (
                <div className="py-10 text-center">
                  <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 font-display text-base font-bold text-slate-800">
                    Your cart is empty
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Tap <strong className="text-emerald-700">ADD +</strong> on any dish to add it here.
                  </p>
                </div>
              ) : (
                <form id="side-cart-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div className="space-y-2.5">
                    {cartSummary.items.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                                item.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                              }`}
                            />
                            <p className="truncate text-sm font-bold text-slate-900">
                              {item.name}
                            </p>
                          </div>
                          <p className="mt-0.5 pl-4 font-mono text-xs text-slate-500 tabular-nums">
                            ₹{item.price} each
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="inline-flex h-9 items-center rounded-xl border border-emerald-600 bg-white px-1">
                            <button
                              type="button"
                              onClick={() => setItemQuantity(item.itemId, item.quantity - 1)}
                              aria-label={`Remove one ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono text-sm font-extrabold text-slate-900 tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.quantity >= 9}
                              onClick={() => setItemQuantity(item.itemId, item.quantity + 1)}
                              aria-label={`Add one more ${item.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <span className="w-12 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                            ₹{item.price * item.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Takeaway vs Dine-In */}
                  <div className="border-t border-slate-200 pt-3.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Order Preference
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-pressed={orderType === 'takeaway'}
                        onClick={() => setOrderType('takeaway')}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold cursor-pointer ${
                          orderType === 'takeaway'
                            ? 'mac-pill-active'
                            : 'mac-pill-inactive'
                        }`}
                      >
                        {orderType === 'takeaway' && <Check className="h-4 w-4 stroke-[2.5]" />}
                        <span>Takeaway</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={orderType === 'dine_in'}
                        onClick={() => setOrderType('dine_in')}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold cursor-pointer ${
                          orderType === 'dine_in'
                            ? 'mac-pill-active'
                            : 'mac-pill-inactive'
                        }`}
                      >
                        {orderType === 'dine_in' && <Check className="h-4 w-4 stroke-[2.5]" />}
                        <span>Dine-in</span>
                      </button>
                    </div>

                    {orderType === 'dine_in' && (
                      <div className="mt-2.5">
                        <label
                          htmlFor="dine-in-table"
                          className="block text-xs font-semibold text-slate-600"
                        >
                          Table Number (Optional)
                        </label>
                        <input
                          id="dine-in-table"
                          type="text"
                          maxLength={16}
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="e.g. Table 4"
                          className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>

                  {/* Simple Bill Summary */}
                  <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Item Total</span>
                      <span className="font-mono font-semibold tabular-nums">
                        ₹{cartSummary.subtotal}
                      </span>
                    </div>
                    {cartSummary.discount > 0 && (
                      <div className="flex justify-between font-semibold text-emerald-700">
                        <span>Campus Offer Discount</span>
                        <span className="font-mono font-bold tabular-nums">
                          -₹{cartSummary.discount}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-slate-900">
                      <span>To Pay</span>
                      <span className="font-mono text-lg tabular-nums">
                        ₹{cartSummary.totalAmount}
                      </span>
                    </div>
                  </div>

                  {checkoutError && (
                    <p role="alert" className="text-xs font-semibold text-red-600">
                      {checkoutError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      !settings.isOpen ||
                      orderRateLimit.isLimitReached ||
                      placingOrder ||
                      cartSummary.items.length === 0
                    }
                    className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-extrabold text-white shadow-md transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 cursor-pointer"
                  >
                    <span>
                      {placingOrder
                        ? 'Placing Order...'
                        : orderRateLimit.isLimitReached
                          ? `Kitchen Full (${orderRateLimit.ordersInWindow}/${orderRateLimit.maxOrders})`
                          : settings.testMode
                            ? `Pay (test) · ₹${cartSummary.totalAmount}`
                            : `Pay · ₹${cartSummary.totalAmount}`}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. EDIT ITEM PICTURE MODAL (Upload Photo, Paste Image URL, or Choose Preset) */}
      {editingPhotoItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit picture for ${editingPhotoItem.name}`}
          onClick={() => setEditingPhotoItem(null)}
        >
          <div
            className="ios-glass-drawer animate-drawer-up w-full max-w-md overflow-hidden rounded-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Edit Dish Picture
                </h3>
                <p className="text-xs text-slate-500">{editingPhotoItem.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhotoItem(null)}
                aria-label="Close picture editor"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePhoto} className="mt-4 space-y-4">
              {/* Live Thumbnail Preview */}
              <div className="flex items-center gap-4">
                <img
                  src={customPhotoInput.trim() || editingPhotoItem.photo}
                  alt={editingPhotoItem.name}
                  referrerPolicy="no-referrer"
                  className="h-24 w-24 shrink-0 rounded-2xl border border-slate-200 bg-slate-900 object-cover"
                />
                <div className="flex-1 space-y-2">
                  <label className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">
                    <ImagePlus className="h-4 w-4 text-emerald-600" />
                    <span>Upload Photo from Device</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleResetPhotoToDefault()}
                    className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset to Default Illustration</span>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="dish-photo-url"
                  className="block text-xs font-bold text-slate-700"
                >
                  Or Paste Image URL
                </label>
                <input
                  id="dish-photo-url"
                  type="url"
                  value={customPhotoInput.startsWith('data:') ? '' : customPhotoInput}
                  onChange={(e) => setCustomPhotoInput(e.target.value)}
                  placeholder="https://example.com/my-dish-photo.jpg"
                  className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Quick Built-in Dish Illustration Picker */}
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Or Pick a Dish Illustration Preset
                </p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {SEED_SOUTH_INDIAN_MENU.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCustomPhotoInput(preset.photo)}
                      title={preset.name}
                      className="overflow-hidden rounded-xl border-2 border-slate-200 hover:border-amber-500 cursor-pointer"
                    >
                      <img
                        src={preset.photo}
                        alt={preset.name}
                        className="h-12 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {photoUploadError && (
                <p className="text-xs font-semibold text-red-600">{photoUploadError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPhotoItem(null)}
                  className="min-h-[42px] rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="mac-pill-active min-h-[42px] rounded-xl px-5 py-2 text-xs font-extrabold cursor-pointer"
                >
                  Save Picture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
