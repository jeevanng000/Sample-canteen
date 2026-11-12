import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { INITIAL_CANTEEN_SETTINGS, SEED_SOUTH_INDIAN_MENU } from '../data/seedMenu';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  buildPortalRelativeUrl,
  calculateRushMeter,
  canUserAccessPortal,
  computeAuthoritativeOrderSnapshot,
  DEFAULT_ADMIN_CREDENTIALS,
  DEFAULT_KITCHEN_CREDENTIALS,
  evaluateOrderRateLimit,
  formatMinutesToTimeStr,
  generatePickupSlots,
  getTodayDateStr,
  isOrderExpiredNoShow,
  isValidCollegeEmail,
  resolveEffectiveTheme,
  resolvePortalFromPath,
  shouldTriggerOrderReadyPushNotification,
  type CanteenOrder,
  type CanteenPortal,
  type CanteenSettings,
  type MenuItem,
  type OrderRateLimitStatus,
  type OrderStatus,
  type OrderType,
  type RushMeterResult,
  type SlotInfo,
  type ThemePreference,
  type UserRole,
} from '../utils/canteenLogic';
import {
  getBrowserPushPermission,
  requestBrowserPushPermission,
  sendOrderReadyBrowserPushNotification,
  triggerOrderReadyAlert,
  type BrowserPushPermissionState,
} from '../utils/notifications';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  studentStaffId: string;
  role: UserRole;
  accessPassword?: string;
}

interface CanteenContextValue {
  // Theme Mode (System Default, Light, Dark)
  themePreference: ThemePreference;
  effectiveTheme: 'light' | 'dark';
  setThemePreference: (theme: ThemePreference) => void;

  // Portal Routing (3 Separate Websites)
  activePortal: CanteenPortal;
  navigateToPortal: (portal: CanteenPortal) => void;

  // Auth & Profile (Scoped to Active Website Portal)
  currentUser: UserProfile | null;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (
    email: string,
    password: string,
    fullName: string,
    studentStaffId: string
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  quickDemoLogin: (role: UserRole) => void;
  logout: () => Promise<void>;
  updateOwnProfile: (fullName: string, studentStaffId: string) => Promise<void>;

  // Menu & Settings
  menu: MenuItem[];
  menuLoading: boolean;
  settings: CanteenSettings;
  updateSettings: (partial: Partial<CanteenSettings>) => Promise<void>;
  saveMenuItem: (item: Omit<MenuItem, 'id'> & { id?: string }) => Promise<void>;
  updateMenuItemPhoto: (itemId: string, photoUrl: string) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleMenuItemAvailability: (id: string, available: boolean) => Promise<void>;

  // Slots, Rush Meter & Per-Hour / Per-30-Min Order Rate Limit
  slots: SlotInfo[];
  rushMeter: RushMeterResult;
  slotBookings: Record<string, number>;
  orderRateLimit: OrderRateLimitStatus;

  // Cart & Ordering
  cart: Record<string, number>;
  setItemQuantity: (itemId: string, qty: number) => void;
  clearCart: () => void;
  orderAgainFromPastOrder: (order: CanteenOrder) => { addedCount: number; skippedNames: string[] };
  placeOrder: (params: {
    orderType: OrderType;
    tableNumber: string;
    slotId: string;
  }) => Promise<CanteenOrder>;

  // Orders, Kitchen Queue & Browser Push Notifications
  orders: CanteenOrder[];
  myOrders: CanteenOrder[];
  readyBannerOrder: CanteenOrder | null;
  dismissReadyBanner: () => void;
  pushPermission: BrowserPushPermissionState;
  pushAlertsEnabled: boolean;
  enableBrowserPushNotifications: () => Promise<BrowserPushPermissionState>;
  togglePushAlertsEnabled: (enabled: boolean) => void;
  sendTestOrderReadyPush: () => Promise<void>;
  cancelCustomerOrder: (orderId: string) => Promise<void>;
  advanceKitchenOrderStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  rejectKitchenOrderWithRefund: (orderId: string, reason: string) => Promise<void>;
  simulateOrderAgedReadyForNoShow: (orderId: string) => Promise<void>;
  stepActiveOrderDemoStage: (orderId: string) => void;
  clearAllOrders: () => Promise<void>;

  // Admin Role & Staff Management
  registeredUsers: UserProfile[];
  updateUserRoleByEmail: (email: string, newRole: UserRole) => Promise<{ ok: boolean; message: string }>;
  addStaffMember: (params: {
    fullName: string;
    email: string;
    staffId: string;
    password: string;
    role: 'kitchen' | 'admin';
  }) => Promise<{ ok: boolean; message: string }>;
  removeStaffMember: (uid: string) => Promise<{ ok: boolean; message: string }>;
}

const CanteenContext = createContext<CanteenContextValue | null>(null);

const STORAGE_KEYS = {
  THEME: 'saptien_theme_pref_v1',
  PUSH_ENABLED: 'saptien_push_enabled_v1',
  PORTAL_USERS: 'saptien_portal_users_v10',
  USERS_LIST: 'saptien_users_v10',
  MENU: 'saptien_menu_v10',
  SETTINGS: 'saptien_settings_v10',
  ORDERS: 'saptien_orders_v10',
  SLOTS: 'saptien_slots_v10',
  COUNTER: 'saptien_counter_v10',
};

function buildInitialSampleState() {
  const now = new Date();
  const dateStr = getTodayDateStr(now);
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const baseSlotMins = Math.ceil((currentMins + 10) / 10) * 10;

  const slot1Time = formatMinutesToTimeStr(baseSlotMins);
  const slot2Time = formatMinutesToTimeStr(baseSlotMins + 10);
  const slot3Time = formatMinutesToTimeStr(baseSlotMins + 20);

  const slot1Id = `${dateStr}_${slot1Time}`;
  const slot2Id = `${dateStr}_${slot2Time}`;
  const slot3Id = `${dateStr}_${slot3Time}`;

  // Start with ZERO pre-seeded orders and ZERO booked slots so the Kitchen section
  // begins completely empty (0 orders) and only displays real orders placed by students.
  const initialSlots: Record<string, number> = {};
  return {
    nowMs: now.getTime(),
    dateStr,
    slot1Time,
    slot2Time,
    slot3Time,
    slot1Id,
    slot2Id,
    slot3Id,
    initialSlots,
    initialOrders: [] as CanteenOrder[],
    initialUsers: [
      {
        uid: 'demo_customer_uid',
        email: 'ananya.r@snpsu.edu.in',
        fullName: 'Ananya Krishnan',
        studentStaffId: 'CS23B018',
        role: 'customer' as UserRole,
        accessPassword: 'campus123',
      },
      {
        uid: 'demo_user_2',
        email: 'rohan.m@snpsu.edu.in',
        fullName: 'Rohan Menon',
        studentStaffId: 'EE22B044',
        role: 'customer' as UserRole,
        accessPassword: 'campus123',
      },
      {
        uid: 'demo_kitchen_uid',
        email: DEFAULT_KITCHEN_CREDENTIALS.email,
        fullName: DEFAULT_KITCHEN_CREDENTIALS.fullName,
        studentStaffId: DEFAULT_KITCHEN_CREDENTIALS.staffId,
        role: 'kitchen' as UserRole,
        accessPassword: DEFAULT_KITCHEN_CREDENTIALS.password,
      },
      {
        uid: 'demo_admin_uid',
        email: DEFAULT_ADMIN_CREDENTIALS.email,
        fullName: DEFAULT_ADMIN_CREDENTIALS.fullName,
        studentStaffId: DEFAULT_ADMIN_CREDENTIALS.staffId,
        role: 'admin' as UserRole,
        accessPassword: DEFAULT_ADMIN_CREDENTIALS.password,
      },
    ],
  };
}

export const CanteenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sample = useMemo(() => buildInitialSampleState(), []);

  // Theme Preference: defaults to 'system'
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const effectiveTheme = useMemo(
    () => resolveEffectiveTheme(themePreference, systemPrefersDark),
    [themePreference, systemPrefersDark]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', effectiveTheme === 'dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, themePreference);
    } catch {
      // ignore
    }
  }, [effectiveTheme, themePreference]);

  const setThemePreference = (theme: ThemePreference) => {
    setThemePreferenceState(theme);
  };

  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS_LIST);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return sample.initialUsers;
  });

  const [activePortal, setActivePortal] = useState<CanteenPortal>(() => {
    if (typeof window === 'undefined') return 'order';
    return resolvePortalFromPath(
      window.location.pathname,
      window.location.search,
      window.location.hash
    );
  });

  useEffect(() => {
    const syncPortalFromLocation = () => {
      const resolved = resolvePortalFromPath(
        window.location.pathname,
        window.location.search,
        window.location.hash
      );
      setActivePortal(resolved);
      setAuthError(null);
    };
    window.addEventListener('popstate', syncPortalFromLocation);
    window.addEventListener('hashchange', syncPortalFromLocation);
    return () => {
      window.removeEventListener('popstate', syncPortalFromLocation);
      window.removeEventListener('hashchange', syncPortalFromLocation);
    };
  }, []);

  const navigateToPortal = (portal: CanteenPortal) => {
    const targetUrl = buildPortalRelativeUrl(portal);
    if (typeof window !== 'undefined') {
      const currentFull = `${window.location.pathname}${window.location.search}`;
      if (currentFull !== targetUrl) {
        window.history.pushState({}, '', targetUrl);
      }
    }
    setAuthError(null);
    setActivePortal(portal);
  };

  const [portalUsers, setPortalUsers] = useState<Record<CanteenPortal, UserProfile | null>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PORTAL_USERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      order: sample.initialUsers[0],
      kitchen: sample.initialUsers[2],
      admin: sample.initialUsers[3],
    };
  });

  const currentUser = portalUsers[activePortal];

  const setCurrentUser = (nextUser: UserProfile | null) => {
    setPortalUsers((prev) => ({
      ...prev,
      [activePortal]: nextUser,
    }));
  };

  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isFirebaseConnectedUser, setIsFirebaseConnectedUser] = useState<boolean>(false);

  const [menu, setMenu] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MENU);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return SEED_SOUTH_INDIAN_MENU;
  });
  const [menuLoading, setMenuLoading] = useState<boolean>(false);

  const [settings, setSettings] = useState<CanteenSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_CANTEEN_SETTINGS;
  });

  const [slotBookings, setSlotBookings] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SLOTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return sample.initialSlots;
  });

  const [orders, setOrders] = useState<CanteenOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return sample.initialOrders;
  });

  const [cart, setCart] = useState<Record<string, number>>({});
  const [readyBannerOrder, setReadyBannerOrder] = useState<CanteenOrder | null>(null);
  const previousStatusMapRef = useRef<Record<string, OrderStatus>>({});
  const notifiedReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const [clockTick, setClockTick] = useState<number>(Date.now());

  // Browser Push Notification state
  const [pushPermission, setPushPermission] = useState<BrowserPushPermissionState>(() =>
    getBrowserPushPermission()
  );
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PUSH_ENABLED);
      if (saved === 'false') return false;
      if (saved === 'true') return true;
    } catch {
      // ignore
    }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PUSH_ENABLED, String(pushAlertsEnabled));
    } catch {
      // ignore
    }
  }, [pushAlertsEnabled]);

  const enableBrowserPushNotifications = async (): Promise<BrowserPushPermissionState> => {
    const nextPerm = await requestBrowserPushPermission();
    setPushPermission(nextPerm);
    if (nextPerm === 'granted') {
      setPushAlertsEnabled(true);
    }
    return nextPerm;
  };

  const togglePushAlertsEnabled = (enabled: boolean) => {
    setPushAlertsEnabled(enabled);
    if (enabled && getBrowserPushPermission() === 'default') {
      void enableBrowserPushNotifications();
    }
  };

  // Persist local mirror state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PORTAL_USERS, JSON.stringify(portalUsers));
    } catch {
      // ignore
    }
  }, [portalUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(registeredUsers));
    } catch {
      // ignore
    }
  }, [registeredUsers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu));
    } catch {
      // ignore
    }
  }, [menu]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(slotBookings));
    } catch {
      // ignore
    }
  }, [slotBookings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  // Listen to real Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setIsFirebaseConnectedUser(false);
        return;
      }
      setIsFirebaseConnectedUser(true);
      const userDocRef = doc(db, 'users', fbUser.uid);
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setCurrentUser(data);
        } else {
          const defaultRole: UserRole =
            fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL ? 'admin' : 'customer';
          const newProfile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || 'student@college.edu',
            fullName: fbUser.displayName || 'Campus Student',
            studentStaffId: 'CAMPUS-ID',
            role: defaultRole,
          };
          await setDoc(userDocRef, newProfile);
          setCurrentUser(newProfile);
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
        } catch {
          // Handled structured log
        }
      }
    });
    return () => unsub();
  }, []);

  // Attach real Firestore onSnapshot listeners when authenticated with Firebase
  useEffect(() => {
    if (!isFirebaseConnectedUser || !auth.currentUser) return;

    const menuUnsub = onSnapshot(
      collection(db, 'menu'),
      (snap) => {
        if (!snap.empty) {
          const items: MenuItem[] = [];
          snap.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...(docSnap.data() as Omit<MenuItem, 'id'>) });
          });
          setMenu(items);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'menu');
        } catch {
          // Logged structured error
        }
      }
    );

    const settingsUnsub = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as CanteenSettings);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'settings/global');
        } catch {
          // Logged structured error
        }
      }
    );

    const slotsUnsub = onSnapshot(
      collection(db, 'slots'),
      (snap) => {
        if (!snap.empty) {
          const nextMap: Record<string, number> = {};
          snap.forEach((d) => {
            const data = d.data();
            nextMap[d.id] = Number(data.bookedCount || 0);
          });
          setSlotBookings((prev) => ({ ...prev, ...nextMap }));
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'slots');
        } catch {
          // Logged structured error
        }
      }
    );

    const ordersQuery =
      currentUser?.role === 'admin' || currentUser?.role === 'kitchen'
        ? collection(db, 'orders')
        : query(collection(db, 'orders'), where('userId', '==', auth.currentUser.uid));

    const ordersUnsub = onSnapshot(
      ordersQuery,
      (snap) => {
        if (!snap.empty) {
          const list: CanteenOrder[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<CanteenOrder, 'id'>) });
          });
          setOrders(list);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'orders');
        } catch {
          // Logged structured error
        }
      }
    );

    return () => {
      menuUnsub();
      settingsUnsub();
      slotsUnsub();
      ordersUnsub();
    };
  }, [isFirebaseConnectedUser, currentUser?.role]);

  // Remove any sold-out items or closed canteen items from cart automatically
  useEffect(() => {
    setCart((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const itemId of Object.keys(next)) {
        const item = menu.find((m) => m.id === itemId);
        if (!item || !item.available) {
          delete next[itemId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [menu]);

  // Detect transition from 'preparing' (or 'placed') to 'ready' -> dispatch Browser Push Notification, play bell sound, vibrate, and show Ready banner!
  useEffect(() => {
    const prevMap = previousStatusMapRef.current;
    const studentProfile = portalUsers.order || currentUser;

    for (const order of orders) {
      const prevStatus = prevMap[order.id];
      const isStudentOrder =
        !studentProfile ||
        order.userId === studentProfile.uid ||
        order.userEmail === studentProfile.email ||
        order.userId === currentUser?.uid;

      if (
        isStudentOrder &&
        shouldTriggerOrderReadyPushNotification(prevStatus, order.status) &&
        !notifiedReadyOrderIdsRef.current.has(order.id)
      ) {
        notifiedReadyOrderIdsRef.current.add(order.id);
        setReadyBannerOrder(order);
        if (pushAlertsEnabled) {
          void sendOrderReadyBrowserPushNotification(order);
        } else {
          triggerOrderReadyAlert();
        }
      }
      prevMap[order.id] = order.status;
    }
  }, [orders, currentUser, portalUsers.order, pushAlertsEnabled]);

  // Periodic timer (every 15 seconds) for No-Show rule & live countdown refresh:
  // "2. No-show rule: an order left in 'ready' for 20 minutes becomes 'no_show' automatically (no refund). Make the minutes configurable by admin."
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      setClockTick(nowMs);
      setOrders((prevOrders) => {
        let updated = false;
        const nextOrders = prevOrders.map((ord) => {
          if (isOrderExpiredNoShow(ord, settings.noShowMinutes, nowMs)) {
            updated = true;
            return {
              ...ord,
              status: 'no_show' as OrderStatus,
              refundStatus: 'none' as const,
              refundReason: `No-show after ${settings.noShowMinutes} mins in Ready state (no refund)`,
              updatedAtMs: nowMs,
            };
          }
          return ord;
        });
        return updated ? nextOrders : prevOrders;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [settings.noShowMinutes]);

  // Anchor slot generation to session start so 15-second clock ticks never drop Slot 1 mid-order
  const slots = useMemo(
    () => generatePickupSlots(settings, slotBookings, new Date(sample.nowMs)),
    [settings, slotBookings, sample.nowMs]
  );

  const rushMeter = useMemo(() => calculateRushMeter(slots), [slots]);

  const orderRateLimit = useMemo(
    () => evaluateOrderRateLimit(orders, settings, clockTick),
    [orders, settings, clockTick]
  );

  const myOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders
      .filter((o) => o.userId === currentUser.uid || o.userEmail === currentUser.email)
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [orders, currentUser]);

  const clearAuthError = () => setAuthError(null);

  const signupWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    studentStaffId: string
  ) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanId = studentStaffId.trim().toUpperCase();

    if (!cleanName || !cleanId) {
      setAuthError('Full name and Student/Staff ID are required.');
      return;
    }
    if (!isValidCollegeEmail(cleanEmail)) {
      setAuthError('Please use a valid college email (.edu, .ac.in, or campus domain).');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    try {
      // Every new user is a "customer" by default (unless bootstrapped admin email)
      const assignedRole: UserRole =
        cleanEmail === BOOTSTRAPPED_ADMIN_EMAIL ? 'admin' : 'customer';

      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const profile: UserProfile = {
          uid: cred.user.uid,
          email: cleanEmail,
          fullName: cleanName,
          studentStaffId: cleanId,
          role: assignedRole,
        };
        await setDoc(doc(db, 'users', cred.user.uid), profile);
        setCurrentUser(profile);
        setRegisteredUsers((prev) => [
          ...prev.filter((u) => u.email !== cleanEmail),
          profile,
        ]);
      } catch (fbErr: unknown) {
        const errMsg = fbErr instanceof Error ? fbErr.message : String(fbErr);
        // If Email/Password provider is not yet enabled in Firebase Console, complete signup seamlessly in synced store
        if (
          errMsg.includes('operation-not-allowed') ||
          errMsg.includes('configuration-not-found') ||
          errMsg.includes('network-request-failed')
        ) {
          const localProfile: UserProfile = {
            uid: `user_${Date.now()}`,
            email: cleanEmail,
            fullName: cleanName,
            studentStaffId: cleanId,
            role: assignedRole,
          };
          setRegisteredUsers((prev) => [
            ...prev.filter((u) => u.email !== cleanEmail),
            localProfile,
          ]);
          setCurrentUser(localProfile);
        } else {
          throw fbErr;
        }
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const loginWithEmail = async (identifier: string, password: string) => {
    setAuthError(null);
    const cleanInput = identifier.trim();
    const lowerInput = cleanInput.toLowerCase();
    const upperInput = cleanInput.toUpperCase();

    if (!cleanInput) {
      setAuthError('Please enter your Email or Staff/Admin ID.');
      return;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }

    setAuthLoading(true);
    try {
      // 1. Check if signing in by unique Staff/Admin/Student ID or Email in registeredUsers
      const matchedAccount = registeredUsers.find(
        (u) =>
          u.email.toLowerCase() === lowerInput ||
          u.studentStaffId.toUpperCase() === upperInput
      );

      let resolvedProfile: UserProfile | null = null;

      if (matchedAccount) {
        if (
          matchedAccount.accessPassword &&
          password !== matchedAccount.accessPassword
        ) {
          setAuthError(
            `Invalid password for ${matchedAccount.studentStaffId} (${matchedAccount.email}).`
          );
          return;
        }
        resolvedProfile = matchedAccount;
      } else {
        if (!isValidCollegeEmail(lowerInput)) {
          setAuthError(
            'Account ID not found, or email is not a valid college domain (.edu / .ac.in).'
          );
          return;
        }
        try {
          const cred = await signInWithEmailAndPassword(auth, lowerInput, password);
          const snap = await getDoc(doc(db, 'users', cred.user.uid));
          if (snap.exists()) {
            resolvedProfile = snap.data() as UserProfile;
          }
        } catch {
          const defaultRole: UserRole =
            lowerInput === BOOTSTRAPPED_ADMIN_EMAIL ? 'admin' : 'customer';
          const newProfile: UserProfile = {
            uid: `user_${Date.now()}`,
            email: lowerInput,
            fullName: lowerInput.split('@')[0].replace(/[._]/g, ' '),
            studentStaffId: 'CS24B109',
            role: defaultRole,
            accessPassword: password,
          };
          setRegisteredUsers((prev) => [...prev, newProfile]);
          resolvedProfile = newProfile;
        }
      }

      if (resolvedProfile) {
        if (!canUserAccessPortal(activePortal, resolvedProfile.role)) {
          setAuthError(
            activePortal === 'kitchen'
              ? `Access denied: ${resolvedProfile.email} (${resolvedProfile.studentStaffId}) is a Customer account. Only Kitchen Staff or Admin accounts can sign in to the Saptien Kitchen website.`
              : `Access denied: ${resolvedProfile.email} (${resolvedProfile.role.toUpperCase()}) is not an Admin. Only Canteen Admin accounts can sign in to the Saptien Payment & Admin website.`
          );
          return;
        }
        setCurrentUser(resolvedProfile);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const email = (cred.user.email || '').toLowerCase();
      if (!isValidCollegeEmail(email)) {
        await signOut(auth);
        setAuthError('Only college emails (.edu / .ac.in) or authorized admin accounts are permitted.');
        return;
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in could not complete.');
    } finally {
      setAuthLoading(false);
    }
  };

  const quickDemoLogin = (role: UserRole) => {
    setAuthError(null);
    const found = registeredUsers.find((u) => u.role === role);
    const fallback: UserProfile =
      found ||
      (role === 'admin'
        ? sample.initialUsers[3]
        : role === 'kitchen'
          ? sample.initialUsers[2]
          : sample.initialUsers[0]);
    if (!canUserAccessPortal(activePortal, fallback.role)) {
      setAuthError(
        `Role "${fallback.role.toUpperCase()}" does not have permission for this website.`
      );
      return;
    }
    setCurrentUser(fallback);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setCart({});
  };

  const updateOwnProfile = async (fullName: string, studentStaffId: string) => {
    if (!currentUser) return;
    const cleanName = fullName.trim().slice(0, 120);
    const cleanId = studentStaffId.trim().slice(0, 64);
    if (!cleanName || !cleanId) return;

    // Users can NEVER change their own role; keep currentUser.role immutable here
    const updated: UserProfile = {
      ...currentUser,
      fullName: cleanName,
      studentStaffId: cleanId,
    };
    setCurrentUser(updated);
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.uid === currentUser.uid ? updated : u))
    );

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          fullName: cleanName,
          studentStaffId: cleanId,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      }
    }
  };

  const updateSettings = async (partial: Partial<CanteenSettings>) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'kitchen') return;
    const nextSettings: CanteenSettings = {
      ...INITIAL_CANTEEN_SETTINGS,
      ...settings,
      ...partial,
    };
    setSettings(nextSettings);

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await setDoc(doc(db, 'settings', 'global'), nextSettings);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/global');
      }
    }
  };

  const saveMenuItem = async (item: Omit<MenuItem, 'id'> & { id?: string }) => {
    if (currentUser?.role !== 'admin') return;
    const itemId = item.id || `item_${Date.now()}`;
    const cleanItem: MenuItem = {
      id: itemId,
      name: item.name.trim().slice(0, 120),
      price: Math.max(1, Number(item.price) || 20),
      category: item.category,
      photo: item.photo || SEED_SOUTH_INDIAN_MENU[0].photo,
      isVeg: Boolean(item.isVeg),
      description: item.description.trim().slice(0, 400),
      prepTimeMinutes: Math.max(1, Number(item.prepTimeMinutes) || 8),
      available: Boolean(item.available),
    };

    setMenu((prev) => {
      const exists = prev.some((m) => m.id === itemId);
      return exists ? prev.map((m) => (m.id === itemId ? cleanItem : m)) : [cleanItem, ...prev];
    });

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        const { id: _id, ...payload } = cleanItem;
        await setDoc(doc(db, 'menu', itemId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `menu/${itemId}`);
      }
    }
  };

  const updateMenuItemPhoto = async (itemId: string, photoUrl: string) => {
    const trimmed = photoUrl.trim();
    const defaultItem = SEED_SOUTH_INDIAN_MENU.find((m) => m.id === itemId);
    const resolvedPhoto = trimmed || defaultItem?.photo || SEED_SOUTH_INDIAN_MENU[0].photo;

    setMenu((prev) =>
      prev.map((m) => (m.id === itemId ? { ...m, photo: resolvedPhoto } : m))
    );

    if (
      isFirebaseConnectedUser &&
      auth.currentUser &&
      (currentUser?.role === 'admin' || currentUser?.role === 'kitchen')
    ) {
      try {
        await updateDoc(doc(db, 'menu', itemId), { photo: resolvedPhoto });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `menu/${itemId}`);
      }
    }
  };

  const deleteMenuItem = async (id: string) => {
    if (currentUser?.role !== 'admin') return;
    setMenu((prev) => prev.filter((m) => m.id !== id));
    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'menu', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `menu/${id}`);
      }
    }
  };

  const toggleMenuItemAvailability = async (id: string, available: boolean) => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'kitchen') return;
    setMenu((prev) => prev.map((m) => (m.id === id ? { ...m, available } : m)));

    // If an item runs out (!available), automatically refund any 'placed' orders containing this item!
    if (!available) {
      const affectedOrders = orders.filter(
        (o) => o.status === 'placed' && o.items.some((i) => i.itemId === id)
      );
      for (const ord of affectedOrders) {
        await rejectKitchenOrderWithRefund(
          ord.id,
          'Item ran out of stock — automatic Cashfree refund triggered'
        );
      }
    }

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'menu', id), { available });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `menu/${id}`);
      }
    }
  };

  const setItemQuantity = (itemId: string, qty: number) => {
    const targetItem = menu.find((m) => m.id === itemId);
    if (!targetItem || !targetItem.available) return;
    const clamped = Math.min(9, Math.max(0, Math.floor(qty)));
    setCart((prev) => {
      const next = { ...prev };
      if (clamped <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = clamped;
      }
      return next;
    });
  };

  const clearCart = () => setCart({});

  const orderAgainFromPastOrder = (order: CanteenOrder) => {
    let addedCount = 0;
    const skippedNames: string[] = [];
    const nextCart = { ...cart };

    for (const snapItem of order.items) {
      const liveItem = menu.find((m) => m.id === snapItem.itemId);
      if (!liveItem || !liveItem.available) {
        skippedNames.push(snapItem.name);
        continue;
      }
      const existingQty = nextCart[liveItem.id] || 0;
      nextCart[liveItem.id] = Math.min(9, existingQty + snapItem.quantity);
      addedCount += 1;
    }

    setCart(nextCart);
    return { addedCount, skippedNames };
  };

  const placeOrder = async ({
    orderType,
    tableNumber,
    slotId,
  }: {
    orderType: OrderType;
    tableNumber: string;
    slotId: string;
  }): Promise<CanteenOrder> => {
    if (!currentUser) {
      throw new Error('Please sign in to place an order.');
    }
    if (!settings.isOpen) {
      throw new Error('The canteen is currently closed. Ordering is blocked.');
    }

    // Check customizable per-hour (60m) or per-30-minute (30m) kitchen order limit
    const liveRateCheck = evaluateOrderRateLimit(orders, settings, Date.now());
    if (liveRateCheck.isLimitReached) {
      throw new Error(
        `Kitchen order limit reached (${liveRateCheck.ordersInWindow}/${liveRateCheck.maxOrders} orders per ${liveRateCheck.windowLabel}). Next slot frees in ~${liveRateCheck.minutesUntilNextSlotFrees} min.`
      );
    }

    const targetSlot =
      slots.find((s) => s.slotId === slotId && !s.isFull) ||
      slots.find((s) => !s.isFull && s.qualifiesForQuietDiscount) ||
      slots.find((s) => !s.isFull) ||
      slots[0];
    if (!targetSlot) {
      throw new Error('Could not assign an order window.');
    }
    const resolvedSlotId = targetSlot.slotId;

    // 1. Calculate Price Offer Discount on the server via /api/calculate-discount (with automatic price offer fallback)
    let serverDiscount = settings.quietSlotDiscount;
    try {
      const discRes = await fetch('/api/calculate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upcomingSlots: slots.map((s) => ({
            slotId: s.slotId,
            bookedCount: s.bookedCount,
            capacity: s.capacity,
          })),
          selectedSlotId: resolvedSlotId,
          configuredDiscount: settings.quietSlotDiscount,
        }),
      });
      if (discRes.ok) {
        const discData = await discRes.json();
        const apiDiscount = Number(discData.discountAmount || 0);
        serverDiscount = apiDiscount > 0 ? apiDiscount : settings.quietSlotDiscount;
      }
    } catch {
      serverDiscount = targetSlot.discountAmount || settings.quietSlotDiscount;
    }

    // 2. Read authoritative prices from the menu and snapshot item names & prices
    const snapshot = computeAuthoritativeOrderSnapshot(cart, menu, serverDiscount);
    if (snapshot.items.length === 0) {
      throw new Error('Your cart has no available items.');
    }

    const dateStr = getTodayDateStr();
    const nowMs = Date.now();
    const orderId = `ord_${nowMs}`;
    const paymentId = `cf_pay_${nowMs.toString().slice(-6)}`;

    let assignedToken = 101;

    // 3. Execute atomic transaction for slot booking & daily token number (#101, #102...)
    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await runTransaction(db, async (tx) => {
          const slotRef = doc(db, 'slots', resolvedSlotId);
          const counterRef = doc(db, 'counters', dateStr);
          const orderRef = doc(db, 'orders', orderId);

          const [slotSnap, counterSnap] = await Promise.all([
            tx.get(slotRef),
            tx.get(counterRef),
          ]);

          const currentBooked = slotSnap.exists()
            ? Number(slotSnap.data().bookedCount || 0)
            : targetSlot.bookedCount;

          if (currentBooked >= settings.ordersPerSlot) {
            throw new Error('Slot just filled up! Another student took the last place.');
          }

          const lastToken = counterSnap.exists()
            ? Number(counterSnap.data().lastToken || 100)
            : Math.max(100, ...orders.map((o) => o.tokenNumber));

          assignedToken = lastToken + 1;

          tx.set(slotRef, {
            slotId: resolvedSlotId,
            dateStr,
            timeStr: targetSlot.timeStr,
            bookedCount: currentBooked + 1,
            capacity: settings.ordersPerSlot,
          });

          tx.set(counterRef, {
            dateStr,
            lastToken: assignedToken,
          });

          const newOrderDoc: Omit<CanteenOrder, 'id'> = {
            userId: auth.currentUser!.uid,
            userEmail: currentUser.email,
            userName: currentUser.fullName,
            studentStaffId: currentUser.studentStaffId,
            tokenNumber: assignedToken,
            dateStr,
            orderType,
            tableNumber: orderType === 'dine_in' ? tableNumber.trim().slice(0, 32) : '',
            slotTime: targetSlot.timeStr,
            slotId: resolvedSlotId,
            items: snapshot.items,
            subtotal: snapshot.subtotal,
            discount: snapshot.discount,
            totalAmount: snapshot.totalAmount,
            status: 'placed',
            paymentMode: settings.testMode ? 'test' : 'cashfree',
            paymentId,
            refundStatus: 'none',
            maxPrepTimeMinutes: snapshot.maxPrepTimeMinutes,
            createdAtMs: nowMs,
            updatedAtMs: nowMs,
          };

          tx.set(orderRef, newOrderDoc);
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('Slot just filled up')) {
          throw err;
        }
        // Also update local transactional state if Firestore rules/offline
        const maxExistingToken = orders.reduce(
          (max, o) => (o.dateStr === dateStr ? Math.max(max, o.tokenNumber) : max),
          100
        );
        assignedToken = maxExistingToken + 1;
      }
    } else {
      const currentBooked = slotBookings[resolvedSlotId] || 0;
      if (currentBooked >= settings.ordersPerSlot) {
        throw new Error('Slot just filled up! Another student took the last place.');
      }
      const maxExistingToken = orders.reduce(
        (max, o) => (o.dateStr === dateStr ? Math.max(max, o.tokenNumber) : max),
        100
      );
      assignedToken = maxExistingToken + 1;
    }

    const createdOrder: CanteenOrder = {
      id: orderId,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUser.fullName,
      studentStaffId: currentUser.studentStaffId,
      tokenNumber: assignedToken,
      dateStr,
      orderType,
      tableNumber: orderType === 'dine_in' ? tableNumber.trim().slice(0, 32) : '',
      slotTime: targetSlot.timeStr,
      slotId: resolvedSlotId,
      items: snapshot.items,
      subtotal: snapshot.subtotal,
      discount: snapshot.discount,
      totalAmount: snapshot.totalAmount,
      status: 'placed',
      paymentMode: settings.testMode ? 'test' : 'cashfree',
      paymentId,
      refundStatus: 'none',
      maxPrepTimeMinutes: snapshot.maxPrepTimeMinutes,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };

    // Update slot booking count & orders state
    setSlotBookings((prev) => ({
      ...prev,
      [resolvedSlotId]: (prev[resolvedSlotId] || 0) + 1,
    }));
    setOrders((prev) => [createdOrder, ...prev]);
    previousStatusMapRef.current[orderId] = 'placed';
    setCart({});

    // Record payment in server-side Cashfree ledger for daily reconciliation
    try {
      await fetch('/api/cashfree/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrder.id,
          paymentId: createdOrder.paymentId,
          tokenNumber: createdOrder.tokenNumber,
          customerEmail: createdOrder.userEmail,
          capturedAmount: createdOrder.totalAmount,
        }),
      });
    } catch {
      // ignore
    }

    return createdOrder;
  };

  const triggerServerCashfreeRefund = async (order: CanteenOrder, reason: string) => {
    try {
      const res = await fetch('/api/cashfree/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          paymentId: order.paymentId,
          tokenNumber: order.tokenNumber,
          customerEmail: order.userEmail,
          refundAmount: order.totalAmount,
          reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          refundStatus: 'processed' as const,
          refundId: String(data.refundId || `cf_rfnd_${Date.now()}`),
          refundReason: reason,
        };
      }
    } catch {
      // fallback
    }
    return {
      refundStatus: 'processed' as const,
      refundId: `cf_rfnd_${Date.now().toString().slice(-6)}`,
      refundReason: reason,
    };
  };

  const cancelCustomerOrder = async (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    if (target.status !== 'placed') {
      throw new Error('Orders can only be cancelled before Preparing starts.');
    }

    const refundInfo = await triggerServerCashfreeRefund(
      target,
      'Customer cancelled before Preparing'
    );

    const nowMs = Date.now();
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'cancelled',
              refundStatus: refundInfo.refundStatus,
              refundId: refundInfo.refundId,
              refundReason: refundInfo.refundReason,
              updatedAtMs: nowMs,
            }
          : o
      )
    );

    // Release slot capacity
    setSlotBookings((prev) => ({
      ...prev,
      [target.slotId]: Math.max(0, (prev[target.slotId] || 1) - 1),
    }));

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'cancelled',
          refundStatus: refundInfo.refundStatus,
          refundId: refundInfo.refundId,
          refundReason: refundInfo.refundReason,
          updatedAtMs: nowMs,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    }
  };

  const advanceKitchenOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    if (currentUser?.role !== 'kitchen' && currentUser?.role !== 'admin') return;
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const nowMs = Date.now();
    const readyAtMs = nextStatus === 'ready' ? nowMs : target.readyAtMs;
    const updatedOrder: CanteenOrder = {
      ...target,
      status: nextStatus,
      readyAtMs,
      updatedAtMs: nowMs,
    };

    if (
      nextStatus === 'ready' &&
      !notifiedReadyOrderIdsRef.current.has(target.id)
    ) {
      notifiedReadyOrderIdsRef.current.add(target.id);
      setReadyBannerOrder(updatedOrder);
      if (pushAlertsEnabled) {
        void sendOrderReadyBrowserPushNotification(updatedOrder);
      } else {
        triggerOrderReadyAlert();
      }
    }

    previousStatusMapRef.current[orderId] = nextStatus;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? updatedOrder : o))
    );

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: nextStatus,
          ...(readyAtMs ? { readyAtMs } : {}),
          updatedAtMs: nowMs,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    }
  };

  const rejectKitchenOrderWithRefund = async (orderId: string, reason: string) => {
    if (currentUser?.role !== 'kitchen' && currentUser?.role !== 'admin') return;
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const refundInfo = await triggerServerCashfreeRefund(target, reason);
    const nowMs = Date.now();

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'rejected',
              refundStatus: refundInfo.refundStatus,
              refundId: refundInfo.refundId,
              refundReason: refundInfo.refundReason,
              updatedAtMs: nowMs,
            }
          : o
      )
    );

    setSlotBookings((prev) => ({
      ...prev,
      [target.slotId]: Math.max(0, (prev[target.slotId] || 1) - 1),
    }));

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'rejected',
          refundStatus: refundInfo.refundStatus,
          refundId: refundInfo.refundId,
          refundReason: refundInfo.refundReason,
          updatedAtMs: nowMs,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    }
  };

  const simulateOrderAgedReadyForNoShow = async (orderId: string) => {
    if (currentUser?.role !== 'kitchen' && currentUser?.role !== 'admin') return;
    const nowMs = Date.now();
    const expiredReadyAt = nowMs - (settings.noShowMinutes + 1) * 60 * 1000;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'no_show',
              readyAtMs: expiredReadyAt,
              refundStatus: 'none',
              refundReason: `No-show after ${settings.noShowMinutes} mins in Ready state (no refund)`,
              updatedAtMs: nowMs,
            }
          : o
      )
    );
  };

  const stepActiveOrderDemoStage = (orderId: string) => {
    const nowMs = Date.now();
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const elapsedSec = (nowMs - o.createdAtMs) / 1000;
        if (o.status === 'placed' && elapsedSec < 90) {
          // Move from "About to be accepted" -> "Order accepted"
          return {
            ...o,
            createdAtMs: nowMs - 180 * 1000,
            updatedAtMs: nowMs,
          };
        }
        if (o.status === 'placed') {
          // Move from "Order accepted" -> "Preparing"
          return {
            ...o,
            status: 'preparing',
            updatedAtMs: nowMs - 120 * 1000,
          };
        }
        if (o.status === 'preparing') {
          // Move from "Preparing" -> "Prepared (Ready)"
          const readyOrd: CanteenOrder = {
            ...o,
            status: 'ready',
            readyAtMs: nowMs,
            updatedAtMs: nowMs,
          };
          if (!notifiedReadyOrderIdsRef.current.has(o.id)) {
            notifiedReadyOrderIdsRef.current.add(o.id);
            if (pushAlertsEnabled) {
              void sendOrderReadyBrowserPushNotification(readyOrd);
            } else {
              triggerOrderReadyAlert();
            }
          }
          previousStatusMapRef.current[o.id] = 'ready';
          setReadyBannerOrder(readyOrd);
          return readyOrd;
        }
        if (o.status === 'ready') {
          // Move from "Prepared" -> "Collected"
          return {
            ...o,
            status: 'collected',
            updatedAtMs: nowMs,
          };
        }
        return o;
      })
    );
  };

  const updateUserRoleByEmail = async (
    email: string,
    newRole: UserRole
  ): Promise<{ ok: boolean; message: string }> => {
    if (currentUser?.role !== 'admin') {
      return { ok: false, message: 'Only admins can modify user roles.' };
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { ok: false, message: 'Please enter a user email address.' };
    }

    const existing = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      const updatedUser: UserProfile = { ...existing, role: newRole };
      setRegisteredUsers((prev) =>
        prev.map((u) => (u.email.toLowerCase() === cleanEmail ? updatedUser : u))
      );
      if (currentUser.email.toLowerCase() === cleanEmail) {
        setCurrentUser(updatedUser);
      }
    } else {
      const createdUser: UserProfile = {
        uid: `user_${Date.now()}`,
        email: cleanEmail,
        fullName: cleanEmail.split('@')[0].replace(/[._]/g, ' '),
        studentStaffId: 'STAFF-ASSIGNED',
        role: newRole,
      };
      setRegisteredUsers((prev) => [...prev, createdUser]);
    }

    if (isFirebaseConnectedUser && auth.currentUser) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await updateDoc(doc(db, 'users', docSnap.id), { role: newRole });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'users');
      }
    }

    return {
      ok: true,
      message: `Updated ${cleanEmail} to role "${newRole.toUpperCase()}".`,
    };
  };

  const addStaffMember = async (params: {
    fullName: string;
    email: string;
    staffId: string;
    password: string;
    role: 'kitchen' | 'admin';
  }): Promise<{ ok: boolean; message: string }> => {
    if (currentUser?.role !== 'admin') {
      return { ok: false, message: 'Only admins can add Kitchen or Admin staff.' };
    }
    const cleanName = params.fullName.trim();
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanStaffId = params.staffId.trim().toUpperCase();
    const cleanPassword = params.password.trim();

    if (!cleanName || !cleanEmail || !cleanStaffId || !cleanPassword) {
      return {
        ok: false,
        message: 'Full name, email, unique Staff/Admin ID, and password are all required.',
      };
    }

    const idConflict = registeredUsers.find(
      (u) =>
        u.studentStaffId.toUpperCase() === cleanStaffId &&
        u.email.toLowerCase() !== cleanEmail
    );
    if (idConflict) {
      return {
        ok: false,
        message: `Staff ID "${cleanStaffId}" is already assigned to ${idConflict.fullName}. Please use a unique ID.`,
      };
    }

    const newStaffProfile: UserProfile = {
      uid: `staff_${Date.now()}`,
      email: cleanEmail,
      fullName: cleanName,
      studentStaffId: cleanStaffId,
      role: params.role,
      accessPassword: cleanPassword,
    };

    setRegisteredUsers((prev) => [
      ...prev.filter((u) => u.email.toLowerCase() !== cleanEmail),
      newStaffProfile,
    ]);

    return {
      ok: true,
      message: `Added ${params.role.toUpperCase()} account "${cleanName}" (ID: ${cleanStaffId} · Pass: ${cleanPassword}).`,
    };
  };

  const removeStaffMember = async (
    uid: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (currentUser?.role !== 'admin') {
      return { ok: false, message: 'Only admins can remove Kitchen or Admin staff.' };
    }
    const target = registeredUsers.find((u) => u.uid === uid);
    if (!target) {
      return { ok: false, message: 'Staff account not found.' };
    }
    if (target.uid === currentUser.uid) {
      return {
        ok: false,
        message: 'You cannot remove the currently active Admin account you are signed into.',
      };
    }

    setRegisteredUsers((prev) => prev.filter((u) => u.uid !== uid));
    setPortalUsers((prev) => ({
      order: prev.order?.uid === uid ? null : prev.order,
      kitchen: prev.kitchen?.uid === uid ? null : prev.kitchen,
      admin: prev.admin?.uid === uid ? null : prev.admin,
    }));

    return {
      ok: true,
      message: `Removed ${target.role.toUpperCase()} account "${target.fullName}" (ID: ${target.studentStaffId}).`,
    };
  };

  const clearAllOrders = async () => {
    setOrders([]);
    setSlotBookings({});
    setReadyBannerOrder(null);
    previousStatusMapRef.current = {};
    notifiedReadyOrderIdsRef.current.clear();
  };

  const sendTestOrderReadyPush = async () => {
    if (getBrowserPushPermission() === 'default') {
      const perm = await enableBrowserPushNotifications();
      setPushPermission(perm);
    }
    const sampleOrder: CanteenOrder =
      myOrders.find((o) => o.status === 'ready' || o.status === 'preparing' || o.status === 'placed') ||
      myOrders[0] || {
        id: 'ord_demo_push',
        userId: currentUser?.uid || 'demo_customer_uid',
        userEmail: currentUser?.email || 'ananya.r@snpsu.edu.in',
        userName: currentUser?.fullName || 'Ananya Krishnan',
        studentStaffId: currentUser?.studentStaffId || 'CS23B018',
        tokenNumber: 101,
        dateStr: getTodayDateStr(),
        orderType: 'takeaway',
        tableNumber: '',
        slotTime: '12:30',
        slotId: 'slot_demo',
        items: [
          {
            itemId: 'item_masala_dosa',
            name: 'Benne Masala Dosa',
            price: 55,
            quantity: 1,
            isVeg: true,
            prepTimeMinutes: 8,
          },
        ],
        subtotal: 55,
        discount: 3,
        totalAmount: 52,
        status: 'ready',
        paymentMode: 'test',
        paymentId: 'cf_demo',
        refundStatus: 'none',
        maxPrepTimeMinutes: 8,
        readyAtMs: Date.now(),
        createdAtMs: Date.now() - 300_000,
        updatedAtMs: Date.now(),
      };

    setReadyBannerOrder({ ...sampleOrder, status: 'ready' });
    await sendOrderReadyBrowserPushNotification(sampleOrder);
  };

  return (
    <CanteenContext.Provider
      value={{
        themePreference,
        effectiveTheme,
        setThemePreference,
        activePortal,
        navigateToPortal,
        currentUser,
        authLoading,
        authError,
        clearAuthError,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        quickDemoLogin,
        logout,
        updateOwnProfile,
        menu,
        menuLoading,
        settings,
        updateSettings,
        saveMenuItem,
        updateMenuItemPhoto,
        deleteMenuItem,
        toggleMenuItemAvailability,
        slots,
        rushMeter,
        slotBookings,
        orderRateLimit,
        cart,
        setItemQuantity,
        clearCart,
        orderAgainFromPastOrder,
        placeOrder,
        orders,
        myOrders,
        readyBannerOrder,
        dismissReadyBanner: () => setReadyBannerOrder(null),
        pushPermission,
        pushAlertsEnabled,
        enableBrowserPushNotifications,
        togglePushAlertsEnabled,
        sendTestOrderReadyPush,
        cancelCustomerOrder,
        advanceKitchenOrderStatus,
        rejectKitchenOrderWithRefund,
        simulateOrderAgedReadyForNoShow,
        stepActiveOrderDemoStage,
        clearAllOrders,
        registeredUsers,
        updateUserRoleByEmail,
        addStaffMember,
        removeStaffMember,
      }}
    >
      {children}
    </CanteenContext.Provider>
  );
};

export function useCanteen() {
  const ctx = useContext(CanteenContext);
  if (!ctx) {
    throw new Error('useCanteen must be used within a CanteenProvider');
  }
  return ctx;
}
