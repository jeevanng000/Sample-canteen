import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChefHat,
  GraduationCap,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UtensilsCrossed,
} from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import {
  DEFAULT_ADMIN_CREDENTIALS,
  DEFAULT_KITCHEN_CREDENTIALS,
  type ThemePreference,
} from '../utils/canteenLogic';

interface AuthScreenProps {
  onOpenGuide: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onOpenGuide }) => {
  const {
    activePortal,
    loginWithEmail,
    signupWithEmail,
    loginWithGoogle,
    quickDemoLogin,
    authLoading,
    authError,
    clearAuthError,
    themePreference,
    setThemePreference,
  } = useCanteen();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('ananya.r@snpsu.edu.in');
  const [password, setPassword] = useState('campus123');
  const [fullName, setFullName] = useState('Ananya Krishnan');
  const [studentStaffId, setStudentStaffId] = useState('CS23B018');

  useEffect(() => {
    setMode('login');
    if (activePortal === 'kitchen') {
      setEmail(DEFAULT_KITCHEN_CREDENTIALS.staffId);
      setPassword(DEFAULT_KITCHEN_CREDENTIALS.password);
    } else if (activePortal === 'admin') {
      setEmail(DEFAULT_ADMIN_CREDENTIALS.staffId);
      setPassword(DEFAULT_ADMIN_CREDENTIALS.password);
    } else {
      setEmail('ananya.r@snpsu.edu.in');
      setPassword('campus123');
    }
  }, [activePortal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activePortal !== 'order' || mode === 'login') {
      await loginWithEmail(email, password);
    } else {
      await signupWithEmail(email, password, fullName, studentStaffId);
    }
  };

  const portalMeta =
    activePortal === 'kitchen'
      ? {
          badge: 'SAPTHAGIRI NPS UNIVERSITY · Kitchen Portal',
          brand: 'Saptien Kitchen',
          headline: 'Live kitchen preparation queue, countdown timers & stock control.',
          subtext:
            'Restricted to authorized Kitchen Staff and Canteen Administrators at SAPTHAGIRI NPS UNIVERSITY.',
          formTitle: 'Kitchen Staff Sign In',
          formSubtext: 'Enter your authorized kitchen staff ID or email to open the live order queue.',
          submitLabel: 'Sign In to Kitchen Website',
          demoRole: 'kitchen' as const,
          demoLabel: 'Quick Kitchen Staff Login (Chef Murugan)',
          Icon: ChefHat,
        }
      : activePortal === 'admin'
        ? {
            badge: 'SAPTHAGIRI NPS UNIVERSITY · Admin Portal',
            brand: 'Saptien Payment & Admin',
            headline: 'Daily Cashfree payment reconciliation, sales analytics & menu control.',
            subtext:
              'Strictly restricted to Canteen Administrators. Verify Cashfree gateway settlements against database orders and manage SAPTHAGIRI NPS UNIVERSITY campus operations.',
            formTitle: 'Administrator Sign In',
            formSubtext: 'Enter your administrator credentials to access payment checking & admin tools.',
            submitLabel: 'Sign In to Payment & Admin Website',
            demoRole: 'admin' as const,
            demoLabel: 'Quick Admin & Payment Login',
            Icon: ShieldCheck,
          }
        : {
            badge: 'SAPTHAGIRI NPS UNIVERSITY · Student & Faculty Portal',
            brand: 'Saptien',
            headline: 'Skip the break-hour queue. Pre-order fresh Namma Bengaluru tiffin.',
            subtext:
              'Official campus pre-ordering for SAPTHAGIRI NPS UNIVERSITY (Bengaluru) students and faculty with automatic ₹3 discount and live token tracking.',
            formTitle: mode === 'login' ? 'Sign in with SAPTHAGIRI NPS UNIVERSITY Email' : 'Create Campus Account',
            formSubtext:
              mode === 'login'
                ? 'Enter your SAPTHAGIRI NPS UNIVERSITY email (@snpsu.edu.in) and password to pre-order.'
                : 'All new accounts are created with the Customer role by default.',
            submitLabel: mode === 'login' ? 'Log In to Ordering Website' : 'Sign Up as Customer',
            demoRole: 'customer' as const,
            demoLabel: 'Quick Student Demo Login (Ananya)',
            Icon: UtensilsCrossed,
          };

  const PortalIcon = portalMeta.Icon;

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
    <div className="ios-ambient-canvas min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-end">
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
                  className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left Column: Dedicated Website Identity */}
          <div className="flex flex-col justify-between rounded-3xl bg-slate-900 p-8 text-white lg:col-span-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-1 font-mono text-[11px] font-semibold text-amber-400">
                <span>{portalMeta.badge}</span>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-slate-950">
                  <PortalIcon className="h-6 w-6" />
                </div>
                <span className="font-display text-xl font-bold tracking-tight">
                  {portalMeta.brand}
                </span>
              </div>

              <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                {portalMeta.headline}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                {portalMeta.subtext}
              </p>

              <div className="mt-8 space-y-3 border-t border-slate-800 pt-6 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Website Isolation</span>
                  <span className="font-mono text-amber-400">
                    {activePortal === 'order'
                      ? 'Customer Ordering Only'
                      : activePortal === 'kitchen'
                        ? 'Kitchen Staff & Admin Only'
                        : 'Canteen Admin Only'}
                  </span>
                </div>
                {activePortal === 'kitchen' && (
                  <div className="flex items-center justify-between">
                    <span>Default Kitchen ID &amp; Pass</span>
                    <span className="font-mono text-emerald-400">
                      {DEFAULT_KITCHEN_CREDENTIALS.staffId} · {DEFAULT_KITCHEN_CREDENTIALS.password}
                    </span>
                  </div>
                )}
                {activePortal === 'admin' && (
                  <div className="flex items-center justify-between">
                    <span>Default Admin ID &amp; Pass</span>
                    <span className="font-mono text-emerald-400">
                      {DEFAULT_ADMIN_CREDENTIALS.staffId} · {DEFAULT_ADMIN_CREDENTIALS.password}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Slot &amp; Payment Protection</span>
                  <span className="font-mono text-sky-400">Atomic Transactions &amp; Cashfree</span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-6">
              <p className="text-xs font-semibold text-slate-400">
                One-Tap Authorized Demo Access for this Website
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => quickDemoLogin(portalMeta.demoRole)}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  {activePortal === 'order' ? (
                    <GraduationCap className="h-4 w-4" />
                  ) : activePortal === 'kitchen' ? (
                    <ChefHat className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span>{portalMeta.demoLabel}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Portal-Specific Login / Signup Form */}
          <div className="mac-glass-card flex flex-col justify-between rounded-3xl p-6 sm:p-8 lg:col-span-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                {activePortal === 'order' ? (
                  <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                    <button
                      type="button"
                      aria-pressed={mode === 'login'}
                      onClick={() => {
                        setMode('login');
                        clearAuthError();
                      }}
                      className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        mode === 'login'
                          ? 'mac-pill-active'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Log In
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === 'signup'}
                      onClick={() => {
                        setMode('signup');
                        clearAuthError();
                      }}
                      className={`min-h-[40px] rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        mode === 'signup'
                          ? 'mac-pill-active'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>
                ) : (
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 font-mono text-xs font-semibold text-slate-700">
                    Authorized Staff Login Only
                  </span>
                )}

                <button
                  type="button"
                  onClick={onOpenGuide}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                  <span>Firebase Guide</span>
                </button>
              </div>

              <h2 className="mt-6 font-display text-2xl font-bold text-slate-900">
                {portalMeta.formTitle}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{portalMeta.formSubtext}</p>

              {authError && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {activePortal === 'order' && mode === 'signup' && (
                  <>
                    <div>
                      <label
                        htmlFor="signup-fullname"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Full Name
                      </label>
                      <input
                        id="signup-fullname"
                        type="text"
                        required
                        maxLength={120}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ananya Krishnan"
                        className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="signup-id"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Student / Staff ID
                      </label>
                      <input
                        id="signup-id"
                        type="text"
                        required
                        maxLength={64}
                        value={studentStaffId}
                        onChange={(e) => setStudentStaffId(e.target.value)}
                        placeholder="e.g. CS23B018 or STAFF-104"
                        className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {activePortal === 'order'
                      ? 'SAPTHAGIRI NPS UNIVERSITY Email (or Student ID)'
                      : activePortal === 'kitchen'
                        ? 'Kitchen Staff ID (SAP-KIT-101) or Staff Email'
                        : 'Admin ID (SAP-ADM-001) or Admin Email'}
                  </label>
                  <input
                    id="auth-email"
                    type={activePortal === 'order' && mode === 'signup' ? 'email' : 'text'}
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      activePortal === 'kitchen'
                        ? 'SAP-KIT-101 or chef.murugan@snpsu.edu.in'
                        : activePortal === 'admin'
                          ? 'SAP-ADM-001 or admin email'
                          : 'student@snpsu.edu.in'
                    }
                    className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? 'Please wait...' : portalMeta.submitLabel}
                </button>
              </form>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={authLoading}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <span>Sign in with Google ({activePortal === 'order' ? 'College Email' : 'Authorized Staff Email'})</span>
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Each website enforces strict role-based access control.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
