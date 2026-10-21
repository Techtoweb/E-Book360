import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  deleteDoc, 
  updateDoc, 
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { Order, PaymentConfig, Coupon, UserProfile, NotificationSettings } from "../types";

export const firebaseConfig = {
  apiKey: "AIzaSyCkeUpChWy8Zk8tPS7YTc33QV3efbhfboM",
  authDomain: "e-book-a0a34.firebaseapp.com",
  projectId: "e-book-a0a34",
  storageBucket: "e-book-a0a34.firebasestorage.app",
  messagingSenderId: "17258279465",
  appId: "1:17258279465:web:f4e7e6de4aae78ae882238",
  measurementId: "G-P8KTVZ5CEH"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics support
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      try {
        getAnalytics(app);
      } catch (e) {
        console.warn("Analytics initialization notice:", e);
      }
    }
  });
}

// ----------------------------------------------------
// Authentication Helpers
// ----------------------------------------------------

const USERS_COLLECTION = "users";

/**
 * Deeply strips undefined values from an object or array to prevent Firestore setDoc errors
 */
export function cleanFirestoreData<T>(data: T): any {
  if (data === undefined) {
    return null;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanObj[key] = cleanFirestoreData(value);
    }
  }
  return cleanObj;
}

export async function saveUserProfile(user: Partial<UserProfile> & { uid: string }): Promise<void> {
  try {
    const userDoc = doc(db, USERS_COLLECTION, user.uid);
    const cleaned = cleanFirestoreData({
      ...user,
      lastLoginAt: new Date().toISOString(),
    });
    await setDoc(userDoc, cleaned, { merge: true });
  } catch (err) {
    console.warn("Error saving user profile to Firestore:", err);
  }
}

// ----------------------------------------------------
// Firestore Security & Permission State Tracking
// ----------------------------------------------------

type PermissionListener = (hasPermissionIssue: boolean) => void;
const permissionListeners = new Set<PermissionListener>();
let hasFirestorePermissionIssue = false;

export function getFirestorePermissionIssue(): boolean {
  return hasFirestorePermissionIssue;
}

export function subscribeToPermissionIssues(listener: PermissionListener): () => void {
  permissionListeners.add(listener);
  listener(hasFirestorePermissionIssue);
  return () => {
    permissionListeners.delete(listener);
  };
}

export function setFirestorePermissionState(hasIssue: boolean) {
  if (hasFirestorePermissionIssue !== hasIssue) {
    hasFirestorePermissionIssue = hasIssue;
    permissionListeners.forEach((l) => l(hasIssue));
  }
}

export const FIRESTORE_RULES_GUIDE = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // 1. App Settings (Branding/Logo, Payment Numbers, Coupons, Notification preferences)
    match /app_settings/{settingId} {
      allow read, write: if true;
    }

    // 2. Orders Collection
    match /orders/{orderId} {
      allow read, write: if true;
    }

    // 3. User Profiles
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'techtowebadmin@gmail.com');
    }

  }
}`;

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userDoc);
    if (snap.exists()) {
      setFirestorePermissionState(false);
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      setFirestorePermissionState(true);
      return null;
    }
    console.warn("Notice reading user profile:", err?.message || err);
    return null;
  }
}

export async function testFirestoreAccess(): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "branding");
    await getDoc(docRef);
    setFirestorePermissionState(false);
    return { success: true };
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      setFirestorePermissionState(true);
      return { success: false, error: 'Permission denied: Firestore security rules are locked.' };
    }
    return { success: false, error: err?.message || 'Connection test failed' };
  }
}

export const ADMIN_EMAIL = "techtowebadmin@gmail.com";

export function checkIsAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  const u = cred.user;
  const userEmail = u.email || email;
  const profile: UserProfile = {
    uid: u.uid,
    email: userEmail,
    displayName: u.displayName || userEmail.split('@')[0],
    phoneNumber: u.phoneNumber || undefined,
    photoURL: u.photoURL || undefined,
    isAdmin: checkIsAdmin(userEmail),
  };
  await saveUserProfile(profile);
  return profile;
}

export async function signupWithEmail(name: string, email: string, pass: string, phone?: string): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const u = cred.user;
  if (name) {
    await updateProfile(u, { displayName: name });
  }
  const userEmail = u.email || email;
  const profile: UserProfile = {
    uid: u.uid,
    email: userEmail,
    displayName: name || userEmail.split('@')[0],
    phoneNumber: phone || undefined,
    createdAt: new Date().toISOString(),
    isAdmin: checkIsAdmin(userEmail),
  };
  await saveUserProfile(profile);
  return profile;
}

export async function loginWithGoogle(): Promise<UserProfile> {
  const cred = await signInWithPopup(auth, googleProvider);
  const u = cred.user;
  const userEmail = u.email || '';
  const profile: UserProfile = {
    uid: u.uid,
    email: userEmail,
    displayName: u.displayName || 'Google User',
    photoURL: u.photoURL || undefined,
    isAdmin: checkIsAdmin(userEmail),
  };
  await saveUserProfile(profile);
  return profile;
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function resetUserPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export function subscribeToAuth(callback: (user: UserProfile | null) => void): () => void {
  return onAuthStateChanged(auth, async (fireUser: User | null) => {
    if (fireUser) {
      const stored = await getUserProfile(fireUser.uid);
      const userEmail = fireUser.email || '';
      const profile: UserProfile = {
        uid: fireUser.uid,
        email: userEmail,
        displayName: stored?.displayName || fireUser.displayName || userEmail.split('@')[0] || 'User',
        phoneNumber: stored?.phoneNumber || fireUser.phoneNumber || undefined,
        photoURL: fireUser.photoURL || undefined,
        isAdmin: checkIsAdmin(userEmail),
      };
      callback(profile);
    } else {
      callback(null);
    }
  });
}

// ----------------------------------------------------
// Firestore Collections & Helpers
// ----------------------------------------------------

const ORDERS_COLLECTION = "orders";
const SETTINGS_COLLECTION = "app_settings";

/**
 * Save new order into Firestore
 */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, order.id);
    const cleaned = cleanFirestoreData({
      ...order,
      _updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, cleaned, { merge: true });
    setFirestorePermissionState(false);
    console.log("Order saved to Firestore successfully:", order.id);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      setFirestorePermissionState(true);
      console.warn("Firestore rules restricted saving order. Please update rules in Firebase Console.");
    } else {
      console.error("Error saving order to Firestore:", error);
    }
    throw error;
  }
}

/**
 * Update order status or fields in Firestore
 */
export async function updateOrderInFirestore(orderId: string, updates: Partial<Order>): Promise<void> {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const cleaned = cleanFirestoreData({
      ...updates,
      _updatedAt: new Date().toISOString(),
    });
    await updateDoc(docRef, cleaned);
    setFirestorePermissionState(false);
    console.log("Order updated in Firestore successfully:", orderId);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    } else {
      console.error("Error updating order in Firestore:", error);
    }
    throw error;
  }
}

/**
 * Delete order from Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await deleteDoc(docRef).catch(() => {});
    
    const snap = await getDocs(collection(db, ORDERS_COLLECTION)).catch(() => null);
    if (snap) {
      const toDelete: Promise<void>[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (d.id === orderId || data.id === orderId || data.orderNumber === orderId) {
          toDelete.push(deleteDoc(d.ref));
        }
      });
      if (toDelete.length > 0) {
        await Promise.all(toDelete);
      }
    }
    setFirestorePermissionState(false);
    console.log("Order deleted from Firestore successfully:", orderId);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    }
    console.error("Error deleting order from Firestore:", error);
  }
}

/**
 * Delete all orders or specific list of orders from Firestore
 */
export async function deleteAllOrdersFromFirestore(orderIds?: string[]): Promise<void> {
  try {
    const snap = await getDocs(collection(db, ORDERS_COLLECTION)).catch(() => null);
    if (!snap) return;
    
    if (orderIds && orderIds.length > 0) {
      const idsSet = new Set(orderIds);
      const deletePromises: Promise<void>[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (idsSet.has(d.id) || (data.id && idsSet.has(data.id)) || (data.orderNumber && idsSet.has(data.orderNumber))) {
          deletePromises.push(deleteDoc(d.ref));
        }
      });
      await Promise.all(deletePromises);
    } else {
      const deletePromises: Promise<void>[] = [];
      snap.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });
      await Promise.all(deletePromises);
    }
    setFirestorePermissionState(false);
    console.log("All requested orders deleted from Firestore successfully");
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    }
    console.error("Error clearing orders from Firestore:", error);
  }
}

/**
 * Listen to live real-time orders from Firestore
 */
export function subscribeToOrders(
  onSuccess: (orders: Order[]) => void, 
  onError?: (err: any) => void
): () => void {
  try {
    const q = query(collection(db, ORDERS_COLLECTION), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setFirestorePermissionState(false);
        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Order;
          list.push({ ...data, id: data.id || docSnap.id });
        });
        onSuccess(list);
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setFirestorePermissionState(true);
          if (onError) onError(error);
          return;
        }

        // If composite index is building or missing, fallback to collection query without sort
        if (error?.code === 'failed-precondition') {
          try {
            const fallbackCol = collection(db, ORDERS_COLLECTION);
            return onSnapshot(
              fallbackCol,
              (snap) => {
                setFirestorePermissionState(false);
                const list: Order[] = [];
                snap.forEach((docSnap) => {
                  const data = docSnap.data() as Order;
                  list.push({ ...data, id: data.id || docSnap.id });
                });
                onSuccess(list);
              },
              (fallbackErr) => {
                if (fallbackErr?.code === 'permission-denied') {
                  setFirestorePermissionState(true);
                }
                if (onError) onError(fallbackErr);
              }
            );
          } catch (fallbackEx) {
            if (onError) onError(fallbackEx);
          }
        } else {
          if (onError) onError(error);
        }
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save payment gateway configs to Firestore
 */
export async function savePaymentConfigsToFirestore(configs: PaymentConfig[]): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "payment_configs");
    const cleaned = cleanFirestoreData({ configs, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleaned, { merge: true });
    setFirestorePermissionState(false);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    }
    console.error("Error saving payment configs to Firestore:", err);
  }
}

/**
 * Subscribe to payment configs in Firestore
 */
export function subscribeToPaymentConfigs(
  onSuccess: (configs: PaymentConfig[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "payment_configs");
    return onSnapshot(
      docRef,
      (docSnap) => {
        setFirestorePermissionState(false);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data?.configs)) {
            onSuccess(data.configs);
          }
        }
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setFirestorePermissionState(true);
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save coupons to Firestore
 */
export async function saveCouponsToFirestore(coupons: Coupon[]): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "coupons");
    const cleaned = cleanFirestoreData({ coupons, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleaned, { merge: true });
    setFirestorePermissionState(false);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    }
    console.error("Error saving coupons to Firestore:", err);
  }
}

/**
 * Subscribe to coupons in Firestore
 */
export function subscribeToCoupons(
  onSuccess: (coupons: Coupon[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "coupons");
    return onSnapshot(
      docRef,
      (docSnap) => {
        setFirestorePermissionState(false);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data?.coupons)) {
            onSuccess(data.coupons);
          }
        }
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setFirestorePermissionState(true);
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save notification settings to Firestore
 */
export async function saveNotificationSettingsToFirestore(settings: NotificationSettings): Promise<void> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "notifications");
    const cleaned = cleanFirestoreData({ ...settings, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleaned, { merge: true });
    setFirestorePermissionState(false);
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    }
    console.error("Error saving notification settings to Firestore:", err);
  }
}

/**
 * Subscribe to notification settings in Firestore
 */
export function subscribeToNotificationSettings(
  onSuccess: (settings: NotificationSettings) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "notifications");
    return onSnapshot(
      docRef,
      (docSnap) => {
        setFirestorePermissionState(false);
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<NotificationSettings>;
          if (data) {
            onSuccess({
              soundEnabled: data.soundEnabled ?? true,
              soundVolume: data.soundVolume ?? 0.8,
              browserNotificationEnabled: data.browserNotificationEnabled ?? true,
              repeatPendingAlert: data.repeatPendingAlert ?? false,
              flashingTabTitle: data.flashingTabTitle ?? true,
            });
          }
        }
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setFirestorePermissionState(true);
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Save site logo to Firestore
 */
export async function saveSiteLogoToFirestore(logoUrl: string): Promise<void> {
  try {
    if (!logoUrl) return;
    const docRef = doc(db, SETTINGS_COLLECTION, "branding");
    const cleaned = cleanFirestoreData({ siteLogo: logoUrl, updatedAt: new Date().toISOString() });
    await setDoc(docRef, cleaned, { merge: true });
    setFirestorePermissionState(false);
    console.log("Site logo saved to Firestore successfully");
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
      setFirestorePermissionState(true);
    }
    console.error("Error saving site logo to Firestore:", err);
    throw err;
  }
}

/**
 * Subscribe to site logo in Firestore
 */
export function subscribeToSiteLogo(
  onSuccess: (logoUrl: string) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, "branding");
    return onSnapshot(
      docRef,
      (docSnap) => {
        setFirestorePermissionState(false);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.siteLogo) {
            onSuccess(data.siteLogo);
          }
        }
      },
      (error) => {
        if (error?.code === 'permission-denied') {
          setFirestorePermissionState(true);
        }
        if (onError) onError(error);
      }
    );
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}
