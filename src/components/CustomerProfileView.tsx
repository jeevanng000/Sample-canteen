import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Lock,
  LogOut,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import {
  buildProfileOrderHistory,
  formatTime12Hour,
  type CanteenOrder,
} from '../utils/canteenLogic';
import { PWAInstallButton } from './PWAInstallButton';

interface CustomerProfileViewProps {
  onOpenGuide: () => void;
  onNavigateToMenu?: () => void;
}

export const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
  onOpenGuide,
  onNavigateToMenu,
}) => {
  const {
    currentUser,
    myOrders,
    menu,
    cart,
    updateOwnProfile,
    orderAgainFromPastOrder,
    logout,
  } = useCanteen();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [studentStaffId, setStudentStaffId] = useState(currentUser?.studentStaffId || '');
  const [savedNotice, setSavedNotice] = useState(false);
  const [reorderFeedback, setReorderFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const orderHistory = useMemo(
    () => buildProfileOrderHistory(myOrders, menu),
    [myOrders, menu]
  );

  const totalCartItems = useMemo(
    () => (Object.values(cart) as number[]).reduce((sum, q) => sum + q, 0),
    [cart]
  );

  if (!currentUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOwnProfile(fullName, studentStaffId);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleReorderFavoriteMeal = (order: CanteenOrder, goToCheckoutImmediately = false) => {
    const { addedCount, skippedNames } = orderAgainFromPastOrder(order);
    if (addedCount === 0) {
      setReorderFeedback({
        type: 'error',
        message: `Cannot reorder Token #${order.tokenNumber}: all items (${skippedNames.join(', ')}) are currently Sold Out.`,
      });
      return;
    }

    const skipNote =
      skippedNames.length > 0
        ? ` Skipped currently sold-out item(s): ${skippedNames.join(', ')}.`
        : '';

    setReorderFeedback({
      type: 'success',
      message: `Added ${addedCount} available item(s) from Token #${order.tokenNumber} to your cart!${skipNote}`,
    });

    if (goToCheckoutImmediately && onNavigateToMenu) {
      onNavigateToMenu();
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-32">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Campus Profile &amp; Order History
          </h1>
          <p className="text-xs text-slate-500">
            Manage your student/staff identification and reorder favorite past canteen meals
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="h-4 w-4 text-amber-600" />
            <span>Firebase &amp; Admin Guide</span>
          </button>
        </div>
      </div>

      {/* Main Profile Card */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-medium text-slate-500">Signed in as</p>
            <h2 className="mt-0.5 font-display text-xl font-bold text-slate-900">
              {currentUser.fullName}
            </h2>
            <p className="font-mono text-xs text-slate-600">
              {currentUser.email} · ID: {currentUser.studentStaffId}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-800">
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <span>Role: {currentUser.role.toUpperCase()} (Read-Only)</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="profile-fullname"
                className="block text-xs font-semibold text-slate-700"
              >
                Full Name
              </label>
              <input
                id="profile-fullname"
                type="text"
                required
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label
                htmlFor="profile-id"
                className="block text-xs font-semibold text-slate-700"
              >
                Student / Staff ID
              </label>
              <input
                id="profile-id"
                type="text"
                required
                maxLength={64}
                value={studentStaffId}
                onChange={(e) => setStudentStaffId(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Account Role (Protected by Firestore Security Rules)
            </label>
            <input
              type="text"
              disabled
              value={`${currentUser.role.toUpperCase()} — Users cannot modify their own role; only Admin can reassign roles`}
              className="mt-1.5 min-h-[44px] w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Save Profile Changes</span>
            </button>

            {savedNotice && (
              <span role="status" className="text-xs font-semibold text-emerald-700">
                Profile updated successfully!
              </span>
            )}
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">
            Signed into <strong>Saptien · SAPTHAGIRI NPS UNIVERSITY</strong>
          </p>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out of Ordering Website</span>
          </button>
        </div>
      </section>

      {/* Order History & Favorite Meals Reorder Section */}
      <section
        aria-label="Order History"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <h2 className="font-display text-xl font-bold text-slate-900">
                Order History
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Reorder your favorite past canteen meals in one tap · Sold-out items are automatically skipped
            </p>
          </div>

          {totalCartItems > 0 && onNavigateToMenu && (
            <button
              type="button"
              onClick={onNavigateToMenu}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>View Cart ({totalCartItems}) &amp; Checkout</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {reorderFeedback && (
          <div
            role="status"
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-semibold ${
              reorderFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <span>{reorderFeedback.message}</span>
            {reorderFeedback.type === 'success' && onNavigateToMenu && (
              <button
                type="button"
                onClick={onNavigateToMenu}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <span>Go to Menu &amp; Cart</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {orderHistory.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-10 text-center">
            <ShoppingBag className="mx-auto h-9 w-9 text-slate-400" />
            <h3 className="mt-3 font-display text-base font-bold text-slate-900">
              No past orders in your history yet
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Once you place a canteen pre-order, your favorite meals will appear here for instant 1-tap reordering.
            </p>
            {onNavigateToMenu && (
              <button
                type="button"
                onClick={onNavigateToMenu}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                <span>Browse Canteen Menu</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {orderHistory.map((entry) => {
              const { order, itemAvailability, soldOutItemNames, canReorder } = entry;
              return (
                <article
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-14 items-center justify-center rounded-xl bg-slate-900 font-mono text-sm font-bold text-amber-400 tabular-nums">
                        #{order.tokenNumber}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-bold text-slate-900">
                            {order.orderType === 'dine_in' ? 'Dine-in' : 'Takeaway'}
                            {order.orderType === 'dine_in' && order.tableNumber
                              ? ` · Table ${order.tableNumber}`
                              : ''}
                          </span>
                          <span className="rounded-lg bg-slate-200/80 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-700">
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                          {order.dateStr} · Pickup Slot {formatTime12Hour(order.slotTime)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        ₹{order.totalAmount}
                      </p>
                      {order.discount > 0 && (
                        <p className="font-mono text-[11px] font-semibold text-emerald-700 tabular-nums">
                          Saved ₹{order.discount} Quiet-Slot
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meal Items with Live Stock Status */}
                  <div className="mt-3.5 space-y-2">
                    {itemAvailability.map((item) => (
                      <div
                        key={item.itemId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2 text-xs border border-slate-100"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-xs ${
                              item.isVeg ? 'bg-emerald-600' : 'bg-red-600'
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={`truncate font-semibold ${
                              item.available ? 'text-slate-900' : 'text-slate-400 line-through'
                            }`}
                          >
                            <strong className="font-mono tabular-nums">{item.quantity}×</strong>{' '}
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-slate-600 tabular-nums">
                            ₹{item.currentPrice * item.quantity}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                              item.available
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.available ? 'In Stock' : 'Sold Out'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer with Sold-Out Warning (if any) and Reorder Action Buttons */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="text-xs text-slate-500">
                      {soldOutItemNames.length > 0 ? (
                        <span className="font-medium text-amber-800">
                          Note: {soldOutItemNames.join(', ')} will be skipped (Sold Out)
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-800">
                          All items in stock for immediate reorder
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!canReorder}
                        onClick={() => handleReorderFavoriteMeal(order, false)}
                        aria-label={`Reorder Token #${order.tokenNumber}`}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                        <span>Reorder Meal</span>
                      </button>

                      {onNavigateToMenu && canReorder && (
                        <button
                          type="button"
                          onClick={() => handleReorderFavoriteMeal(order, true)}
                          aria-label={`Reorder Token #${order.tokenNumber} and checkout`}
                          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                        >
                          <span>Reorder &amp; Checkout</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
