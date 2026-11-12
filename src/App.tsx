/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BellRing,
  ChefHat,
  ClipboardList,
  Layers,
  LogOut,
  Monitor,
  Moon,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Sun,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { CanteenProvider, useCanteen } from './services/canteenContext';
import {
  buildOrderReadyPushPayload,
  canUserAccessPortal,
  isStudentOnlyMode,
  PROTOTYPE_PORTALS,
  PROTOTYPE_UNIFIED_MODE,
  type CanteenPortal,
  type ThemePreference,
} from './utils/canteenLogic';
import { AuthScreen } from './components/AuthScreen';
import { CustomerMenuView } from './components/CustomerMenuView';
import { CustomerOrdersView } from './components/CustomerOrdersView';
import { CustomerProfileView } from './components/CustomerProfileView';
import { KitchenQueueView } from './components/KitchenQueueView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { FirebaseGuideModal } from './components/FirebaseGuideModal';
import { ClassroomQrModal } from './components/ClassroomQrModal';
import { LiveOrderBottomTracker } from './components/LiveOrderBottomTracker';

type CustomerTab = 'menu' | 'orders' | 'profile';

/**
 * 3-Websites-in-1 Prototype Switcher Bar:
 * Gives instant 1-tap switching across:
 *   1. Student Ordering (/)
 *   2. Kitchen KDS & Bill Printer (/?portal=kitchen)
 *   3. Payment & Admin Console (/?portal=admin)
 * Hidden automatically when opened via the Classroom Student-Only QR Code (`/?studentOnly=1`).
 */
const PrototypeUnifiedSwitcherBar: React.FC<{
  hiddenInStudentOnlyMode: boolean;
  onOpenClassQr: () => void;
}> = ({ hiddenInStudentOnlyMode, onOpenClassQr }) => {
  const { activePortal, navigateToPortal, orders, orderRateLimit } = useCanteen();

  if (!PROTOTYPE_UNIFIED_MODE || hiddenInStudentOnlyMode) return null;

  const placedCount = orders.filter((o) => o.status === 'placed').length;
  const activeKitchenCount = orders.filter(
    (o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready'
  ).length;

  const handlePortalSwitch = (portalId: CanteenPortal) => {
    navigateToPortal(portalId);
  };

  return (
    <div
      role="navigation"
      aria-label="3-in-1 Prototype Website Switcher"
      className="mac-dock-bar px-2.5 py-1.5 text-white sm:px-6 sm:py-2 lg:px-8"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 overflow-x-auto">
        <div className="hidden items-center gap-2 text-xs md:flex shrink-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-300 uppercase">
            <Layers className="h-3 w-3" />
            3-in-1 Prototype
          </span>
          <span className="hidden text-slate-300 lg:inline">
            Limit:{' '}
            <strong className="font-mono text-amber-300 tabular-nums">
              {orderRateLimit.ordersInWindow}/{orderRateLimit.maxOrders} per {orderRateLimit.shortWindowLabel}
            </strong>
          </span>
          <button
            type="button"
            onClick={onOpenClassQr}
            className="inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/30 cursor-pointer whitespace-nowrap"
          >
            <QrCode className="h-3 w-3" />
            <span>Class QR (Student-Only)</span>
          </button>
        </div>

        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:items-center">
          {PROTOTYPE_PORTALS.map((portal) => {
            const active = activePortal === portal.id;
            const Icon =
              portal.id === 'order'
                ? ShoppingBag
                : portal.id === 'kitchen'
                  ? ChefHat
                  : ShieldCheck;

            const shortMobileLabel =
              portal.id === 'order'
                ? '1. Order'
                : portal.id === 'kitchen'
                  ? '2. Kitchen'
                  : '3. Admin';

            return (
              <button
                key={portal.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => handlePortalSwitch(portal.id)}
                className={`inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  active
                    ? 'mac-pill-active'
                    : 'border border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="sm:hidden">{shortMobileLabel}</span>
                <span className="hidden sm:inline">
                  {portal.stepNumber}. {portal.label}
                </span>
                {portal.id === 'kitchen' && activeKitchenCount > 0 && (
                  <span
                    className={`rounded-md px-1.5 py-0.2 font-mono text-[10px] font-bold tabular-nums ${
                      active
                        ? 'bg-slate-950 text-amber-300'
                        : placedCount > 0
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {activeKitchenCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Standalone Light / Dark / System Theme Switcher (Default: System)
 */
export const ThemeModeControl: React.FC = () => {
  const { themePreference, setThemePreference } = useCanteen();

  const themeOptions: {
    id: ThemePreference;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'system', label: 'System', icon: Monitor },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
  ];

  return (
    <div
      role="group"
      aria-label="Theme mode"
      className="mac-pill-inactive inline-flex items-center gap-0.5 rounded-2xl p-1"
    >
      {themeOptions.map((opt) => {
        const Icon = opt.icon;
        const active = themePreference === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => setThemePreference(opt.id)}
            className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
              active
                ? 'mac-pill-active'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <Icon className="h-3 w-3" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * WEBSITE 1: Student & Faculty Ordering Website (/ or /order)
 */
const StudentOrderingWebsite: React.FC<{
  onOpenGuide: () => void;
  onOpenClassQr: () => void;
  isUrlStudentOnly: boolean;
  isStudentOnlyPreview: boolean;
  onExitStudentOnlyPreview: () => void;
}> = ({
  onOpenGuide,
  onOpenClassQr,
  isUrlStudentOnly,
  isStudentOnlyPreview,
  onExitStudentOnlyPreview,
}) => {
  const { myOrders, readyBannerOrder, dismissReadyBanner } = useCanteen();
  const [customerTab, setCustomerTab] = useState<CustomerTab>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (h === 'orders') return 'orders';
      if (h === 'profile') return 'profile';
    }
    return 'menu';
  });

  const selectTab = (tab: CustomerTab) => {
    setCustomerTab(tab);
    if (typeof window !== 'undefined') {
      const nextHash = `#${tab}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
      }
    }
  };

  const readyCustomerCount = myOrders.filter((o) => o.status === 'ready').length;
  const readyPushPayload = readyBannerOrder
    ? buildOrderReadyPushPayload(readyBannerOrder)
    : null;

  return (
    <div className="ios-ambient-canvas min-h-screen text-slate-900">
      {/* Top Bar Contract: 3 Zones */}
      <header className="mac-glass-bar sticky top-0 z-30 flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#menu"
          onClick={(e) => {
            e.preventDefault();
            selectTab('menu');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Saptien <span className="hidden text-xs font-semibold text-amber-600 sm:inline">· SAPTHAGIRI NPS UNIVERSITY</span>
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Customer ordering navigation"
          className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex"
        >
          <button
            type="button"
            aria-current={customerTab === 'menu' ? 'page' : undefined}
            onClick={() => selectTab('menu')}
            className={`min-h-[36px] border-b-2 px-1 py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              customerTab === 'menu'
                ? 'border-amber-500 font-bold text-slate-900'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Menu
          </button>
          <button
            type="button"
            aria-current={customerTab === 'orders' ? 'page' : undefined}
            onClick={() => selectTab('orders')}
            className={`min-h-[36px] border-b-2 px-1 py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              customerTab === 'orders'
                ? 'border-amber-500 font-bold text-slate-900'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            My Orders ({myOrders.length})
          </button>
          <button
            type="button"
            aria-current={customerTab === 'profile' ? 'page' : undefined}
            onClick={() => selectTab('profile')}
            className={`min-h-[36px] border-b-2 px-1 py-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              customerTab === 'profile'
                ? 'border-amber-500 font-bold text-slate-900'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Profile
          </button>
        </nav>

        {/* Zone 3: Theme Mode + Class QR Code / Setup Guide */}
        <div className="flex items-center gap-2 shrink-0">
          {isStudentOnlyPreview && !isUrlStudentOnly && (
            <button
              type="button"
              onClick={onExitStudentOnlyPreview}
              className="mac-pill-active inline-flex min-h-[32px] items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold cursor-pointer whitespace-nowrap"
            >
              <span>Exit Student-Only Preview</span>
            </button>
          )}
          <ThemeModeControl />
          {!isUrlStudentOnly && (
            <button
              type="button"
              onClick={onOpenClassQr}
              aria-label="Open Classroom Student-Only QR Code"
              className="mac-pill-inactive inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5 text-amber-600" />
              <span>Class QR</span>
            </button>
          )}
          {!isUrlStudentOnly && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="mac-pill-inactive hidden min-h-[34px] rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer lg:inline-flex lg:items-center"
            >
              Setup Guide
            </button>
          )}
        </div>
      </header>

      {/* Global iOS-Style Push Notification Banner when an order transitions from 'preparing' -> 'ready' */}
      {readyBannerOrder && readyPushPayload && customerTab !== 'orders' && (
        <div
          role="alert"
          aria-live="assertive"
          className="mx-auto max-w-2xl px-4 pt-3"
        >
          <div className="mac-glass-card flex items-center justify-between gap-3 rounded-2xl border-2 border-emerald-500/70 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {readyPushPayload.title}
                </p>
                <p className="text-xs text-slate-600 line-clamp-1">
                  {readyPushPayload.body}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => selectTab('orders')}
                className="mac-pill-active min-h-[34px] rounded-xl px-3 py-1 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                View Token #{readyBannerOrder.tokenNumber}
              </button>
              <button
                type="button"
                onClick={dismissReadyBanner}
                aria-label="Dismiss push notification banner"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery-App Style Live Order ETA & 0-100% Full-Filling Bar (Inline, never blocks Menu or Cart) */}
      <LiveOrderBottomTracker onOpenOrders={() => selectTab('orders')} />

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div key={customerTab} className="animate-view-enter">
          {customerTab === 'menu' && (
            <CustomerMenuView onOrderPlaced={() => selectTab('orders')} />
          )}
          {customerTab === 'orders' && (
            <CustomerOrdersView onNavigateToMenu={() => selectTab('menu')} />
          )}
          {customerTab === 'profile' && (
            <CustomerProfileView
              onOpenGuide={onOpenGuide}
              onNavigateToMenu={() => selectTab('menu')}
            />
          )}
        </div>
      </main>

      {/* Fixed Bottom Navigation Bar — Strictly 3 Customer Tabs (Menu, Orders, Profile) */}
      <nav
        aria-label="Mobile customer navigation"
        className="ios-bottom-tabbar fixed right-0 bottom-0 left-0 z-40 px-2 py-1 md:hidden"
      >
        <div className="grid h-13 grid-cols-3 items-center gap-1.5">
          <button
            type="button"
            onClick={() => selectTab('menu')}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl cursor-pointer ${
              customerTab === 'menu' ? 'mac-pill-active' : 'text-slate-500'
            }`}
          >
            <UtensilsCrossed className="h-4 w-4" />
            <span className="mt-0.5 text-[10px] tracking-tight whitespace-nowrap">Menu</span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('orders')}
            className={`relative flex min-h-[44px] flex-col items-center justify-center rounded-xl cursor-pointer ${
              customerTab === 'orders' ? 'mac-pill-active' : 'text-slate-500'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span className="mt-0.5 text-[10px] tracking-tight whitespace-nowrap">
              Orders{readyCustomerCount > 0 ? ' (!)' : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectTab('profile')}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl cursor-pointer ${
              customerTab === 'profile' ? 'mac-pill-active' : 'text-slate-500'
            }`}
          >
            <User className="h-4 w-4" />
            <span className="mt-0.5 text-[10px] tracking-tight whitespace-nowrap">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

/**
 * WEBSITE 2: Standalone Kitchen Website (/kitchen)
 * Accessible strictly to Kitchen Staff and Admins.
 */
const KitchenPortalWebsite: React.FC<{ onOpenGuide: () => void }> = ({ onOpenGuide }) => {
  const { currentUser, logout } = useCanteen();

  return (
    <div className="ios-ambient-canvas min-h-screen text-slate-900">
      <header className="mac-glass-bar sticky top-0 z-30 flex h-14 items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <a
          href="/?portal=kitchen"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Saptien Kitchen <span className="hidden text-xs font-semibold text-amber-600 sm:inline">· SAPTHAGIRI NPS UNIVERSITY</span>
        </a>

        <div className="hidden items-center gap-3 text-xs font-medium text-slate-600 lg:flex">
          <span>
            Kitchen Staff: <strong className="text-slate-900">{currentUser?.fullName}</strong> ·{' '}
            <span className="font-mono tabular-nums">{currentUser?.studentStaffId}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeModeControl />
          <button
            type="button"
            onClick={onOpenGuide}
            className="hidden min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer sm:inline-flex sm:items-center"
          >
            Setup Guide
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="animate-view-enter mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <KitchenQueueView />
      </main>
    </div>
  );
};

/**
 * WEBSITE 3: Standalone Payment Checking & Admin Website (/admin)
 * Accessible strictly to Canteen Administrators.
 */
const AdminAndPaymentWebsite: React.FC<{ onOpenGuide: () => void }> = ({ onOpenGuide }) => {
  const { currentUser, logout } = useCanteen();

  return (
    <div className="ios-ambient-canvas min-h-screen text-slate-900">
      <header className="mac-glass-bar sticky top-0 z-30 flex h-14 items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <a
          href="/?portal=admin"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Saptien Payment &amp; Admin <span className="hidden text-xs font-semibold text-amber-600 sm:inline">· SAPTHAGIRI NPS UNIVERSITY</span>
        </a>

        <div className="hidden items-center gap-3 text-xs font-medium text-slate-600 lg:flex">
          <span>
            Administrator: <strong className="text-slate-900">{currentUser?.fullName}</strong> ·{' '}
            <span className="font-mono">{currentUser?.email}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeModeControl />
          <button
            type="button"
            onClick={onOpenGuide}
            className="hidden min-h-[36px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer sm:inline-flex sm:items-center"
          >
            Setup Guide
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="animate-view-enter mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <AdminDashboardView />
      </main>
    </div>
  );
};

const MainShell: React.FC = () => {
  const { activePortal, currentUser, navigateToPortal } = useCanteen();
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isClassQrOpen, setIsClassQrOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('qr') === '1';
  });

  const [isUrlStudentOnly, setIsUrlStudentOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isStudentOnlyMode(window.location.search, window.location.hash);
  });

  const [isStudentOnlyPreview, setIsStudentOnlyPreview] = useState<boolean>(false);

  useEffect(() => {
    const syncStudentOnly = () => {
      const next = isStudentOnlyMode(window.location.search, window.location.hash);
      setIsUrlStudentOnly(next);
      if (next && activePortal !== 'order') {
        navigateToPortal('order');
      }
    };
    window.addEventListener('popstate', syncStudentOnly);
    window.addEventListener('hashchange', syncStudentOnly);
    return () => {
      window.removeEventListener('popstate', syncStudentOnly);
      window.removeEventListener('hashchange', syncStudentOnly);
    };
  }, [activePortal, navigateToPortal]);

  const studentOnlyLocked = isUrlStudentOnly || isStudentOnlyPreview;
  const effectivePortal: CanteenPortal = studentOnlyLocked ? 'order' : activePortal;

  const isAuthorizedForCurrentWebsite =
    currentUser !== null && canUserAccessPortal(effectivePortal, currentUser.role);

  const handleToggleStudentOnlyPreview = (nextVal: boolean) => {
    setIsStudentOnlyPreview(nextVal);
    if (nextVal && activePortal !== 'order') {
      navigateToPortal('order');
    }
  };

  return (
    <div>
      <PrototypeUnifiedSwitcherBar
        hiddenInStudentOnlyMode={studentOnlyLocked}
        onOpenClassQr={() => setIsClassQrOpen(true)}
      />
      {!isAuthorizedForCurrentWebsite ? (
        <AuthScreen onOpenGuide={() => setIsGuideOpen(true)} />
      ) : effectivePortal === 'kitchen' ? (
        <KitchenPortalWebsite onOpenGuide={() => setIsGuideOpen(true)} />
      ) : effectivePortal === 'admin' ? (
        <AdminAndPaymentWebsite onOpenGuide={() => setIsGuideOpen(true)} />
      ) : (
        <StudentOrderingWebsite
          onOpenGuide={() => setIsGuideOpen(true)}
          onOpenClassQr={() => setIsClassQrOpen(true)}
          isUrlStudentOnly={isUrlStudentOnly}
          isStudentOnlyPreview={isStudentOnlyPreview}
          onExitStudentOnlyPreview={() => setIsStudentOnlyPreview(false)}
        />
      )}

      <ClassroomQrModal
        isOpen={isClassQrOpen}
        onClose={() => setIsClassQrOpen(false)}
        isStudentOnlyPreview={isStudentOnlyPreview}
        onToggleStudentOnlyPreview={handleToggleStudentOnlyPreview}
      />

      <FirebaseGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <CanteenProvider>
      <MainShell />
    </CanteenProvider>
  );
}


