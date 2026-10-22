import React, { useState, useEffect } from 'react';
import { 
  X, FileText, Upload, DollarSign, Settings, ShoppingBag, 
  Check, Trash2, Plus, Tag, Shield, Smartphone, RefreshCw, 
  ExternalLink, Eye, ArrowUpRight, CheckCircle2, AlertCircle, 
  Clock, XCircle, Copy, Search, CheckCheck, Lock, Bell, Volume2, VolumeX, Radio,
  Image as ImageIcon, Sparkles
} from 'lucide-react';
import { PaymentConfig, Order, Coupon, UserProfile, NotificationSettings } from '../types';
import { BOOK_DETAILS, DEFAULT_NOTIFICATION_SETTINGS } from '../data/bookData';
import { 
  ADMIN_EMAIL, 
  deleteOrderFromFirestore, 
  deleteAllOrdersFromFirestore, 
  saveNotificationSettingsToFirestore, 
  saveSiteLogoToFirestore,
  FIRESTORE_RULES_GUIDE,
  firebaseConfig,
  testFirestoreAccess
} from '../lib/firebase';
import { playNewOrderSound, requestBrowserNotificationPermission, showOrderDesktopNotification } from '../lib/notificationSound';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onUpdateOrders: (orders: Order[]) => void;
  onDeleteSingleOrder?: (orderId: string) => void;
  onClearAllOrders?: (orderIds?: string[]) => void;
  paymentConfigs: PaymentConfig[];
  onUpdatePaymentConfigs: (configs: PaymentConfig[]) => void;
  coupons: Coupon[];
  onUpdateCoupons: (coupons: Coupon[]) => void;
  customPdfName: string | null;
  onUploadCustomPdf: (name: string, dataUrl: string) => void;
  onRemoveCustomPdf: () => void;
  currentUser?: UserProfile | null;
  notificationSettings?: NotificationSettings;
  onUpdateNotificationSettings?: (settings: NotificationSettings) => void;
  siteLogo?: string;
  onUpdateSiteLogo?: (logoUrl: string) => void;
  hasPermissionIssue?: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  orders,
  onUpdateOrders,
  onDeleteSingleOrder,
  onClearAllOrders,
  paymentConfigs,
  onUpdatePaymentConfigs,
  coupons,
  onUpdateCoupons,
  customPdfName,
  onUploadCustomPdf,
  onRemoveCustomPdf,
  currentUser,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  onUpdateNotificationSettings,
  siteLogo,
  onUpdateSiteLogo,
  hasPermissionIssue = false,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'pdf' | 'payments' | 'coupons' | 'notifications' | 'branding' | 'database'>('orders');
  const [searchOrder, setSearchOrder] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // In-App Delete Confirmation Modals (Never rely on browser confirm() in iframe)
  const [deleteModalOrder, setDeleteModalOrder] = useState<Order | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showClearRejectedModal, setShowClearRejectedModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local state for payment configs editing
  const [editableConfigs, setEditableConfigs] = useState<PaymentConfig[]>(paymentConfigs);
  const [savedConfigsNotice, setSavedConfigsNotice] = useState(false);

  // Notification and Sound Settings State
  const [soundEnabled, setSoundEnabled] = useState(notificationSettings.soundEnabled ?? true);
  const [soundVolume, setSoundVolume] = useState(notificationSettings.soundVolume ?? 0.8);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(notificationSettings.browserNotificationEnabled ?? true);
  const [repeatPendingAlert, setRepeatPendingAlert] = useState(notificationSettings.repeatPendingAlert ?? false);
  const [flashingTabTitle, setFlashingTabTitle] = useState(notificationSettings.flashingTabTitle ?? true);
  const [savedNotificationNotice, setSavedNotificationNotice] = useState(false);
  const [browserPermissionStatus, setBrowserPermissionStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // Logo & Branding Settings State
  const [currentLogo, setCurrentLogo] = useState<string>(siteLogo || '');
  const [logoUrlInput, setLogoUrlInput] = useState<string>('');
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [logoSaveNotice, setLogoSaveNotice] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploadedDimensions, setUploadedDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (siteLogo) {
      setCurrentLogo(siteLogo);
    }
  }, [siteLogo]);

  // Database & Security Rules State
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedRulesGuide, setCopiedRulesGuide] = useState(false);

  const handleTestFirestore = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await testFirestoreAccess();
      if (res.success) {
        setDbTestResult({ success: true, message: 'অভিনন্দন! Firestore ডেটাবেজ সফলভাবে কানেক্টেড এবং পারমিশন ঠিক আছে।' });
      } else {
        setDbTestResult({ success: false, message: `সমস্যা: ${res.error || 'Permission Denied'} - অনুগ্রহ করে Firebase Console এ গিয়ে Rules আপডেট করুন।` });
      }
    } catch (e: any) {
      setDbTestResult({ success: false, message: `এরর: ${e?.message || 'কানেকশন ব্যর্থ হয়েছে'}` });
    } finally {
      setIsTestingDb(false);
    }
  };

  useEffect(() => {
    if (siteLogo) {
      setCurrentLogo(siteLogo);
    }
  }, [siteLogo]);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);
    setIsProcessingLogo(true);

    if (!file.type.startsWith('image/')) {
      setLogoError('অনুগ্রহ করে একটি সঠিক ইমেজ ফাইল (.png, .jpg, .webp, .svg) নির্বাচন করুন।');
      setIsProcessingLogo(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        setIsProcessingLogo(false);
        return;
      }

      // If SVG vector, verify reasonable size and preserve
      if (file.type.includes('svg')) {
        if (rawDataUrl.length > 500000) {
          setLogoError('SVG ফাইলের সাইজ অনেক বড়। ৫০০KB এর নিচের ফাইল আপলোড করুন।');
          setIsProcessingLogo(false);
          return;
        }
        setCurrentLogo(rawDataUrl);
        setUploadedDimensions({ width: 300, height: 80 });
        setIsProcessingLogo(false);
        return;
      }

      // For raster images (PNG, JPG, WebP), scale & compress via canvas so it fits perfectly in Firestore
      const img = new Image();
      img.onload = () => {
        setUploadedDimensions({ width: img.width, height: img.height });

        const MAX_W = 600;
        const MAX_H = 180;
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > MAX_W || targetHeight > MAX_H) {
          const ratio = Math.min(MAX_W / targetWidth, MAX_H / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Use PNG to preserve transparency, but fallback to WebP/JPEG if PNG is unexpectedly large
          let compressed = canvas.toDataURL('image/png');
          if (compressed.length > 400000) {
            compressed = canvas.toDataURL('image/webp', 0.9) || canvas.toDataURL('image/jpeg', 0.88);
          }
          setCurrentLogo(compressed);
          if (onUpdateSiteLogo) {
            onUpdateSiteLogo(compressed);
          }
          try {
            localStorage.setItem('ecom360_site_logo', compressed);
          } catch {}
          fetch('/api/save-logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteLogo: compressed }),
          }).catch((err) => console.warn('API save-logo notice:', err));
          saveSiteLogoToFirestore(compressed).catch((err) => console.warn('Cloud sync notice:', err));
          setLogoSaveNotice(true);
          setTimeout(() => setLogoSaveNotice(false), 3000);
        } else {
          setCurrentLogo(rawDataUrl);
          if (onUpdateSiteLogo) {
            onUpdateSiteLogo(rawDataUrl);
          }
          try {
            localStorage.setItem('ecom360_site_logo', rawDataUrl);
          } catch {}
          fetch('/api/save-logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteLogo: rawDataUrl }),
          }).catch((err) => console.warn('API save-logo notice:', err));
          saveSiteLogoToFirestore(rawDataUrl).catch((err) => console.warn('Cloud sync notice:', err));
          setLogoSaveNotice(true);
          setTimeout(() => setLogoSaveNotice(false), 3000);
        }
        setIsProcessingLogo(false);
      };
      img.onerror = () => {
        setLogoError('ছবিটি লোড করতে সমস্যা হয়েছে। অন্য একটি ছবি নির্বাচন করুন।');
        setIsProcessingLogo(false);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrlLogo = () => {
    if (!logoUrlInput.trim()) return;
    setLogoError(null);
    setIsProcessingLogo(true);
    const testImg = new Image();
    testImg.onload = () => {
      const url = logoUrlInput.trim();
      setCurrentLogo(url);
      setUploadedDimensions({ width: testImg.width, height: testImg.height });
      if (onUpdateSiteLogo) {
        onUpdateSiteLogo(url);
      }
      try {
        localStorage.setItem('ecom360_site_logo', url);
      } catch {}
      fetch('/api/save-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteLogo: url }),
      }).catch((err) => console.warn('API save-logo notice:', err));
      saveSiteLogoToFirestore(url).catch((err) => console.warn('Cloud sync notice:', err));
      setLogoSaveNotice(true);
      setTimeout(() => setLogoSaveNotice(false), 3000);
      setIsProcessingLogo(false);
    };
    testImg.onerror = () => {
      setLogoError('ইমেজ লিংকটি লোড করা সম্ভব হয়নি। লিংকটি সঠিক কিনা চেক করুন।');
      setIsProcessingLogo(false);
    };
    testImg.src = logoUrlInput.trim();
  };

  const handleSaveLogo = async () => {
    setIsProcessingLogo(true);
    setLogoError(null);
    try {
      if (currentLogo.length > 950000) {
        setLogoError('লোগো ফাইলের সাইজ অনেক বড় (১MB এর বেশি)। অনুগ্রহ করে ছোট সাইজের ছবি আপলোড করুন।');
        setIsProcessingLogo(false);
        return;
      }
      if (onUpdateSiteLogo) {
        onUpdateSiteLogo(currentLogo);
      }
      try {
        if (currentLogo) {
          localStorage.setItem('ecom360_site_logo', currentLogo);
        } else {
          localStorage.removeItem('ecom360_site_logo');
        }
      } catch {}

      // Persist to backend server & project files
      fetch('/api/save-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteLogo: currentLogo }),
      }).catch((e) => console.warn('API save-logo notice:', e));

      await saveSiteLogoToFirestore(currentLogo);
      setLogoSaveNotice(true);
      setTimeout(() => setLogoSaveNotice(false), 3000);
    } catch (err: any) {
      console.warn('Notice saving logo:', err?.message || err);
      setLogoSaveNotice(true);
      setTimeout(() => setLogoSaveNotice(false), 3000);
    } finally {
      setIsProcessingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    setIsProcessingLogo(true);
    try {
      setCurrentLogo('');
      setLogoUrlInput('');
      setUploadedDimensions(null);
      if (onUpdateSiteLogo) {
        onUpdateSiteLogo('');
      }
      try {
        localStorage.removeItem('ecom360_site_logo');
      } catch {}
      fetch('/api/save-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteLogo: '' }),
      }).catch((e) => console.warn('API save-logo notice:', e));
      await saveSiteLogoToFirestore('');
      setLogoSaveNotice(true);
      setTimeout(() => setLogoSaveNotice(false), 3000);
    } catch (err: any) {
      console.warn('Notice resetting logo:', err?.message || err);
    } finally {
      setIsProcessingLogo(false);
    }
  };

  // Manual Add Order Modal / Form State
  const [showAddOrderForm, setShowAddOrderForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualTrxId, setManualTrxId] = useState('');
  const [manualGateway, setManualGateway] = useState<any>('bkash');
  const [manualAmount, setManualAmount] = useState('99');

  // New Coupon form
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponAmount, setNewCouponAmount] = useState('');
  const [newCouponDesc, setNewCouponDesc] = useState('');

  if (!isOpen) return null;

  const isStrictAdmin = currentUser?.isAdmin && currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // If user is not techtowebadmin@gmail.com, completely block and deny access
  if (!isStrictAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md font-['Hind_Siliguri',sans-serif]">
        <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">অননুমোদিত অ্যাক্সেস (Access Denied)</h3>
          <p className="text-xs sm:text-sm text-slate-300 mb-6">
            অ্যাডমিন প্যানেল শুধুমাত্র প্রধান এডমিন ইমেইল (<strong className="text-amber-300">{ADMIN_EMAIL}</strong>) এর জন্য সংরক্ষিত। আপনি এই প্যানেল দেখার অনুমতিপ্রাপ্ত নন।
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            ফিরে যান
          </button>
        </div>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setActionNotice('অনুগ্রহ করে একটি সঠিক .pdf ফাইল নির্বাচন করুন।');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUploadCustomPdf(file.name, dataUrl);
      setIsUploading(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentConfigs = () => {
    onUpdatePaymentConfigs(editableConfigs);
    setSavedConfigsNotice(true);
    setTimeout(() => setSavedConfigsNotice(false), 2500);
  };

  const handleConfigChange = (index: number, field: keyof PaymentConfig, value: string) => {
    const updated = [...editableConfigs];
    updated[index] = { ...updated[index], [field]: value };
    setEditableConfigs(updated);
  };

  // Order Actions: Approve / Reject / Delete
  const handleApproveOrder = (orderId: string) => {
    const updated = orders.map(o => {
      if (o.id === orderId || o.orderNumber === orderId) {
        return {
          ...o,
          status: 'completed' as const,
          approvedAt: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: true }) + ', ' + new Date().toLocaleDateString('bn-BD'),
          notes: 'এডমিন কর্তৃক পেমেন্ট যাচাই ও অনুমোদন সম্পন্ন'
        };
      }
      return o;
    });
    onUpdateOrders(updated);
    setActionNotice('অর্ডারটি সফলভাবে অনুমোদন (Approve) করা হয়েছে! গ্রাহক এখন ই-বুক পড়তে পারবেন।');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleRejectOrder = (orderId: string) => {
    const updated = orders.map(o => {
      if (o.id === orderId || o.orderNumber === orderId) {
        return {
          ...o,
          status: 'rejected' as const,
          notes: 'পেমেন্ট সঠিক না হওয়ায় বাতিল করা হয়েছে'
        };
      }
      return o;
    });
    onUpdateOrders(updated);
    setActionNotice('অর্ডারটি বাতিল (Reject) করা হয়েছে।');
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Trigger In-App Delete Modals
  const handleDeleteOrder = (order: Order) => {
    setDeleteModalOrder(order);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!deleteModalOrder) return;
    const target = deleteModalOrder;
    setIsDeleting(true);
    try {
      if (onDeleteSingleOrder) {
        onDeleteSingleOrder(target.id);
      } else {
        const updated = orders.filter(o => o.id !== target.id && o.orderNumber !== target.id);
        onUpdateOrders(updated);
        await deleteOrderFromFirestore(target.id);
      }
      setActionNotice(`অর্ডারটি (${target.orderNumber || target.id}) সফলভাবে মুছে ফেলা হয়েছে।`);
    } catch (err) {
      console.warn('Delete single order error:', err);
    } finally {
      setIsDeleting(false);
      setDeleteModalOrder(null);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleClearAllOrdersClick = () => {
    if (orders.length === 0) {
      setActionNotice('মুছে ফেলার মতো কোনো অর্ডার নেই।');
      setTimeout(() => setActionNotice(null), 2000);
      return;
    }
    setShowClearAllModal(true);
  };

  const handleConfirmClearAll = async () => {
    setIsDeleting(true);
    try {
      if (onClearAllOrders) {
        await onClearAllOrders();
      } else {
        onUpdateOrders([]);
        await deleteAllOrdersFromFirestore();
      }
      setActionNotice('সকল অর্ডার সফলভাবে ডাটাবেজ থেকে মুছে ফেলা হয়েছে!');
    } catch (err) {
      console.warn('Clear all orders error:', err);
    } finally {
      setIsDeleting(false);
      setShowClearAllModal(false);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleClearRejectedOrdersClick = () => {
    const rejected = orders.filter(o => o.status === 'rejected');
    if (rejected.length === 0) {
      setActionNotice('কোনো বাতিলকৃত অর্ডার নেই।');
      setTimeout(() => setActionNotice(null), 2000);
      return;
    }
    setShowClearRejectedModal(true);
  };

  const handleConfirmClearRejected = async () => {
    const rejected = orders.filter(o => o.status === 'rejected');
    if (rejected.length === 0) {
      setShowClearRejectedModal(false);
      return;
    }
    const rejectedIds = rejected.map(r => r.id);
    setIsDeleting(true);
    try {
      if (onClearAllOrders) {
        await onClearAllOrders(rejectedIds);
      } else {
        const updated = orders.filter(o => o.status !== 'rejected');
        onUpdateOrders(updated);
        await deleteAllOrdersFromFirestore(rejectedIds);
      }
      setActionNotice('সকল বাতিলকৃত অর্ডার মুছে ফেলা হয়েছে।');
    } catch (err) {
      console.warn('Clear rejected error:', err);
    } finally {
      setIsDeleting(false);
      setShowClearRejectedModal(false);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleCopyTrx = (trx: string) => {
    navigator.clipboard.writeText(trx);
    setCopiedTrxId(trx);
    setTimeout(() => setCopiedTrxId(null), 2000);
  };

  // Manual Order Creation
  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone.trim()) return;

    const accessCode = `EC360-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: orderId,
      customerName: manualName.trim() || 'ম্যানুয়াল গ্রাহক',
      customerPhone: manualPhone.trim(),
      customerEmail: `${manualPhone.trim()}@reader.ecom360.com`,
      gateway: manualGateway,
      trxId: manualTrxId.trim().toUpperCase() || 'MANUAL-DIRECT',
      amount: parseInt(manualAmount, 10) || 99,
      discount: 0,
      createdAt: 'এখন',
      approvedAt: 'এখন',
      status: 'completed',
      accessCode: accessCode,
      isAutoVerified: false,
      notes: 'এডমিন কর্তৃক সরাসরি যুক্ত ও অনুমোদিত'
    };

    onUpdateOrders([newOrder, ...orders]);
    setShowAddOrderForm(false);
    setManualName('');
    setManualPhone('');
    setManualTrxId('');
    setActionNotice('ম্যানুয়াল গ্রাহকের নাম্বার সফলভাবে যুক্ত ও অ্যাপ্রুভ করা হয়েছে!');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleAddCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim() || !newCouponAmount.trim()) return;

    const newCoupon: Coupon = {
      code: newCouponCode.trim().toUpperCase(),
      discountAmount: parseInt(newCouponAmount, 10) || 50,
      description: newCouponDesc.trim() || 'বিশেষ ছাড়',
      isActive: true,
    };

    onUpdateCoupons([...coupons, newCoupon]);
    setNewCouponCode('');
    setNewCouponAmount('');
    setNewCouponDesc('');
  };

  const handleDeleteCoupon = (code: string) => {
    onUpdateCoupons(coupons.filter(c => c.code !== code));
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const approvedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const rejectedOrdersCount = orders.filter(o => o.status === 'rejected').length;

  const filteredOrders = orders.filter(o => {
    const matchesQuery = 
      o.customerPhone.includes(searchOrder) ||
      o.customerName.toLowerCase().includes(searchOrder.toLowerCase()) ||
      o.trxId.toLowerCase().includes(searchOrder.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(searchOrder.toLowerCase());

    if (!matchesQuery) return false;
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  const totalSalesRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md font-['Hind_Siliguri',sans-serif]">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  ই-কমার্স ৩৬০° অ্যাডমিন ও অর্ডার ভেরিফিকেশন প্যানেল
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  সুপার অ্যাডমিন
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Firebase Firestore Connected
                </span>
              </div>
              <p className="text-xs text-slate-400">
                পেমেন্ট ও TrxID যাচাই করে অনুমোদন (Approve) করুন, পিডিএফ ও পেমেন্ট নাম্বার ম্যানেজ করুন
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 gap-2 overflow-x-auto text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'orders' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>অর্ডার ও পেমেন্ট অনুমোদন</span>
            {pendingOrdersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black animate-pulse">
                {pendingOrdersCount} অপেক্ষমান
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'payments' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>বিকাশ / নগদ নাম্বার পরিবর্তন</span>
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'pdf' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>পিডিএফ আপলোড ও DRM রিডার</span>
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'coupons' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>ডিসকাউন্ট কুপন ({coupons.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'notifications' ? 'border-amber-500 text-amber-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>লাইভ অ্যালার্ট ও সাউন্ড</span>
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'branding' ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-purple-400" />
            <span>লোগো ও ব্র্যান্ডিং</span>
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'database' 
                ? 'border-emerald-500 text-emerald-400 font-bold' 
                : hasPermissionIssue 
                  ? 'border-amber-500 text-amber-300 font-semibold' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className={`w-4 h-4 ${hasPermissionIssue ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>Firebase ডাটাবেজ ও Rules</span>
            {hasPermissionIssue && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse">
                ফিক্স প্রয়োজন
              </span>
            )}
          </button>
        </div>

        {/* Global Permission Warning Banner when Firestore Rules are Locked */}
        {hasPermissionIssue && (
          <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-amber-100 flex items-center gap-2">
                  <span>Firebase Rules লক রয়েছে (Permission Denied)</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">e-book-a0a34</span>
                </p>
                <p className="text-amber-300/90 text-[11px] mt-0.5">
                  Firestore ডেটাবেজে সিকিউরিটি রুলস আপডেট করতে হবে যাতে লাইভ অর্ডার ও লোগো ক্লাউডে সিঙ্ক হতে পারে।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(FIRESTORE_RULES_GUIDE);
                  setActionNotice('Firestore Rules কোড ক্লিপবোর্ডে কপি হয়েছে!');
                  setTimeout(() => setActionNotice(null), 3000);
                }}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>১-ক্লিকে Rules কপি</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <span>ফিক্স গাইড</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Action Notice Toast */}
        {actionNotice && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 text-center font-bold flex items-center justify-center gap-2">
            <CheckCheck className="w-4 h-4" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          
          {/* TAB 1: ORDERS & APPROVAL WORKFLOW */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-300 font-medium">অপেক্ষমান অর্ডার</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-amber-400 font-mono mt-1">{pendingOrdersCount} টি</p>
                  <span className="text-[10px] text-amber-400/80">যাচাই ও অনুমোদন প্রয়োজন</span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-300 font-medium">অনুমোদিত (পেইড)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{approvedOrdersCount} টি</p>
                  <span className="text-[10px] text-emerald-400/80">বই পড়তে পারছে</span>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-300 font-medium">মোট বিক্রয় রাজস্ব</span>
                    <DollarSign className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-2xl font-black text-blue-400 font-mono mt-1">৳{totalSalesRevenue}</p>
                  <span className="text-[10px] text-blue-400/80">অনুমোদিত অর্ডার থেকে</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">বাতিলকৃত অর্ডার</span>
                    <XCircle className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-2xl font-black text-slate-400 font-mono mt-1">{rejectedOrdersCount} টি</p>
                  <span className="text-[10px] text-slate-500">অকার্যকর TrxID</span>
                </div>
              </div>

              {/* Pending Orders Action Banner if any pending */}
              {pendingOrdersCount > 0 && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 animate-spin" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-300">
                        {pendingOrdersCount} টি নতুন পেমেন্ট ভেরিফিকেশনের জন্য অপেক্ষমান আছে!
                      </h4>
                      <p className="text-xs text-slate-300">
                        গ্রাহকের TrxID আপনার বিকাশ/নগদ অ্যাপ বা মেসেজে চেক করে নিচে থাকা <strong>"অনুমোদন করুন (Approve)"</strong> বাটনে ক্লিক করুন।
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 transition-colors cursor-pointer"
                  >
                    শুধুমাত্র পেন্ডিং দেখুন
                  </button>
                </div>
              )}

              {/* Filters & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="মোবাইল নাম্বার, নাম, TrxID বা অর্ডার নং দিয়ে খুঁজুন..."
                    value={searchOrder}
                    onChange={(e) => setSearchOrder(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    সবগুলো ({orders.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      statusFilter === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    <span>অপেক্ষমান</span>
                    <span className="bg-slate-900/50 text-white px-1.5 py-0.2 rounded-full text-[10px]">{pendingOrdersCount}</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    অনুমোদিত ({approvedOrdersCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'rejected' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    বাতিল ({rejectedOrdersCount})
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Add Manual Order Button */}
                  <button
                    onClick={() => setShowAddOrderForm(!showAddOrderForm)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ম্যানুয়াল নাম্বার যোগ করুন</span>
                  </button>

                  {/* Clear Rejected Orders */}
                  {rejectedOrdersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearRejectedOrdersClick}
                      className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-rose-800/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      title="সকল বাতিলকৃত অর্ডার মুছে ফেলুন"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>বাতিল অর্ডার মুছুন ({rejectedOrdersCount})</span>
                    </button>
                  )}

                  {/* Clear All Orders Button */}
                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllOrdersClick}
                      className="px-3 py-2 rounded-xl bg-red-900/30 hover:bg-red-800/50 text-red-300 hover:text-white text-xs font-bold border border-red-700/50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      title="ডাটাবেজ থেকে সমস্ত অর্ডার মুছে ফ্রেশ শুরু করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>সব অর্ডার মুছুন</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Manual Add Order Form */}
              {showAddOrderForm && (
                <form onSubmit={handleCreateManualOrder} className="p-4 rounded-xl bg-slate-950 border border-blue-500/40 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      সরাসরি কাস্টমার এক্সেস প্রদান (অ্যাডমিন অ্যাপ্রুভাল)
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddOrderForm(false)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      বন্ধ করুন
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">কাস্টমার নাম</label>
                      <input
                        type="text"
                        placeholder="নাম"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">মোবাইল নাম্বার <span className="text-red-400">*</span></label>
                      <input
                        type="tel"
                        required
                        placeholder="01XXXXXXXXX"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">মেথড ও TrxID</label>
                      <input
                        type="text"
                        placeholder="TrxID (ঐচ্ছিক)"
                        value={manualTrxId}
                        onChange={(e) => setManualTrxId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 mb-1 block">পরিশোধিত মূল্য</label>
                      <input
                        type="number"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    অর্ডার যোগ করে সরাসরি অ্যাপ্রুভ করুন
                  </button>
                </form>
              )}

              {/* Orders List Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3">অর্ডার ও তারিখ</th>
                        <th className="p-3">গ্রাহকের বিবরণ</th>
                        <th className="p-3">পেমেন্ট মেথড</th>
                        <th className="p-3">TrxID (কপি বাটন)</th>
                        <th className="p-3">মূল্য</th>
                        <th className="p-3">বর্তমান স্ট্যাটাস</th>
                        <th className="p-3 text-center">অ্যাকশন (অনুমোদন / বাতিল)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            কোনো অর্ডার খুঁজে পাওয়া যায়নি।
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => {
                          const isPending = order.status === 'pending';
                          const isCompleted = order.status === 'completed';
                          const isRejected = order.status === 'rejected';

                          return (
                            <tr 
                              key={order.id} 
                              className={`transition-colors ${
                                isPending 
                                  ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-4 border-amber-500' 
                                  : 'hover:bg-slate-900/50'
                              }`}
                            >
                              {/* Order number & date */}
                              <td className="p-3">
                                <p className="font-mono font-bold text-white">{order.orderNumber}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{order.createdAt}</p>
                              </td>

                              {/* Customer info */}
                              <td className="p-3">
                                <p className="font-semibold text-white">{order.customerName}</p>
                                <p className="text-xs text-blue-400 font-mono font-bold">{order.customerPhone}</p>
                                <p className="text-[10px] text-slate-400">{order.customerEmail}</p>
                              </td>

                              {/* Gateway */}
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-xs uppercase font-bold text-blue-300">
                                  {order.gateway}
                                </span>
                              </td>

                              {/* TrxID with copy button */}
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-extrabold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                                    {order.trxId}
                                  </span>
                                  <button
                                    onClick={() => handleCopyTrx(order.trxId)}
                                    title="TrxID কপি করুন"
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    {copiedTrxId === order.trxId ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              {/* Amount */}
                              <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                                ৳{order.amount}
                              </td>

                              {/* Status Badge */}
                              <td className="p-3">
                                {isPending ? (
                                  <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-extrabold border border-amber-500/40 flex items-center gap-1 w-fit animate-pulse">
                                    <Clock className="w-3 h-3" />
                                    <span>অপেক্ষমান</span>
                                  </span>
                                ) : isCompleted ? (
                                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-extrabold border border-emerald-500/40 flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>অনুমোদিত</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-[11px] font-extrabold border border-red-500/40 flex items-center gap-1 w-fit">
                                    <XCircle className="w-3 h-3" />
                                    <span>বাতিল</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {isPending ? (
                                    <>
                                      {/* Approve Button */}
                                      <button
                                        onClick={() => handleApproveOrder(order.id)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
                                        title="পেমেন্ট যাচাই হয়েছে, অনুমোদন করুন যাতে গ্রাহক বই পড়তে পারে"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>অনুমোদন করুন (Approve)</span>
                                      </button>

                                      {/* Reject Button */}
                                      <button
                                        onClick={() => handleRejectOrder(order.id)}
                                        className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/30 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                        title="পেমেন্ট পাওয়া যায়নি বা ভুল TrxID"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>বাতিল</span>
                                      </button>
                                    </>
                                  ) : isCompleted ? (
                                    <>
                                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                                        কি: <span className="text-blue-400">{order.accessCode}</span>
                                      </span>
                                      <button
                                        onClick={() => handleRejectOrder(order.id)}
                                        className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="অনুমোদন বাতিল করুন"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleApproveOrder(order.id)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors cursor-pointer"
                                    >
                                      পুনরায় অনুমোদন
                                    </button>
                                  )}

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrder(order)}
                                    className="p-1.5 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-colors cursor-pointer ml-1 flex items-center gap-1 text-[11px]"
                                    title="অর্ডার রেকর্ড ডাটাবেজ থেকে স্থায়ীভাবে ডিলিট করুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="hidden xl:inline">মুছুন</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: PAYMENT NUMBERS (bKash/Nagad/Rocket/Upay) */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-white">মোবাইল ব্যাংকিং একাউন্ট কনফিগারেশন</h4>
                  <p className="text-xs text-slate-400">গ্রাহকরা চেকআউট পেজে এই নাম্বারগুলো দেখতে পাবেন</p>
                </div>
                <button
                  onClick={handleSavePaymentConfigs}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>পরিবর্তন সংরক্ষণ করুন</span>
                </button>
              </div>

              {savedConfigsNotice && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>পেমেন্ট নাম্বারসমূহ সফলভাবে সেভ করা হয়েছে!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editableConfigs.map((cfg, index) => (
                  <div key={cfg.gateway} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-extrabold text-sm" style={{ color: cfg.color }}>
                        {cfg.nameBn} ({cfg.name})
                      </span>
                      <select
                        value={cfg.type}
                        onChange={(e) => handleConfigChange(index, 'type', e.target.value as any)}
                        className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                      >
                        <option value="Personal">Personal (ব্যক্তিগত)</option>
                        <option value="Merchant">Merchant (মার্চেন্ট)</option>
                        <option value="Agent">Agent (এজেন্ট)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">একাউন্ট নাম্বার</label>
                      <input
                        type="text"
                        value={cfg.number}
                        onChange={(e) => handleConfigChange(index, 'number', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PDF UPLOAD & DRM SECURITY */}
          {activeTab === 'pdf' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-300 text-sm">অনলাইন অনলি DRM সিকিউরিটি সিস্টেম</h4>
                  <p className="leading-relaxed">
                    আপনার আপলোড করা পিডিএফ ফাইলটি সম্পূর্ণ সুরক্ষিত থাকবে। কোনো ইউজার ব্রাউজারের কোনো লিংক থেকে এটি সরাসরি ডাউনলোড বা কপি করতে পারবে না। কাস্টমারের অনুমোদিত নাম ও ফোন নাম্বার দিয়ে ডায়নামিক ওয়াটারমার্ক সহ ক্যানভাসে রেন্ডার হবে।
                  </p>
                </div>
              </div>

              {/* Upload Box */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-950/60 transition-colors text-center">
                <input
                  type="file"
                  id="pdfUploadInput"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label 
                  htmlFor="pdfUploadInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h5 className="font-bold text-base text-white">নতুন পিডিএফ ফাইল আপলোড করতে ক্লিক করুন</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      সর্বোচ্চ সাইজ: ৫০MB (.pdf ফাইল ফরম্যাট)
                    </p>
                  </div>
                  <span className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors">
                    পিডিএফ ফাইল সিলেক্ট করুন
                  </span>
                </label>
              </div>

              {/* Current PDF Status */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-400">বর্তমান সক্রিয় ই-বুক কন্টেন্ট:</p>
                    <p className="font-bold text-sm text-white">
                      {customPdfName || 'বিল্ট-ইন ১০টি অধ্যায়ের ইন্টারঅ্যাক্টিভ ই-কমার্স ৩৬০° মাস্টারবুক (২৪৬ পৃষ্ঠা)'}
                    </p>
                  </div>
                </div>
                {customPdfName && (
                  <button
                    onClick={onRemoveCustomPdf}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>রিমুভ করুন</span>
                  </button>
                )}
              </div>

              {uploadSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>পিডিএফ সফলভাবে আপলোড ও অনলাইন রিডারের সাথে যুক্ত হয়েছে!</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COUPONS */}
          {activeTab === 'coupons' && (
            <div className="space-y-6">
              {/* Add Coupon Form */}
              <form onSubmit={handleAddCoupon} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>নতুন ডিসকাউন্ট কুপন যুক্ত করুন</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">কুপন কোড (যেমন: VIP100)</label>
                    <input
                      type="text"
                      placeholder="CODE"
                      value={newCouponCode}
                      onChange={(e) => setNewCouponCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono uppercase focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">ছাড়ের পরিমাণ (টাকা)</label>
                    <input
                      type="number"
                      placeholder="100"
                      value={newCouponAmount}
                      onChange={(e) => setNewCouponAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">বিবরণ</label>
                    <input
                      type="text"
                      placeholder="লঞ্চিং ডিসকাউন্ট"
                      value={newCouponDesc}
                      onChange={(e) => setNewCouponDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  কুপন সেভ করুন
                </button>
              </form>

              {/* Active Coupons List */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-300">সক্রিয় কুপনসমূহ:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coupons.map((c) => (
                    <div key={c.code} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-xs">
                          {c.code}
                        </span>
                        <p className="text-xs text-slate-300 mt-1">{c.description} - <span className="font-bold text-emerald-400">৳{c.discountAmount} ছাড়</span></p>
                      </div>
                      <button
                        onClick={() => handleDeleteCoupon(c.code)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LIVE SOUND & BROWSER ALERT NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">লাইভ সাউন্ড ও ব্রাউজার নোটিফিকেশন সিস্টেম</h3>
                    <p className="text-xs text-slate-400">নতুন অর্ডার আসার সাথে সাথে আপনার ডিভাইসে রিয়েল-টাইম ক্যাশিয়ার বেল সাউন্ড ও পুশ অ্যালার্ট বাজবে</p>
                  </div>
                </div>

                {savedNotificationNotice && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>নোটিফিকেশন সেটিংস সফলভাবে আপডেট ও ডাটাবেজে সংরক্ষিত হয়েছে!</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Sound Control Card */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-200">নতুন অর্ডার সাউন্ড অ্যালার্ট (Cashier Bell Chime)</h4>
                          <p className="text-[11px] text-slate-400">যেকোনো ক্রেতা অর্ডার সাবমিট করলেই রিয়েল-টাইমে সুন্দর ক্যাশিয়ার বেল অডিও বাজবে</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={soundEnabled}
                          onChange={(e) => setSoundEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {soundEnabled && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-4">
                        <span className="text-xs text-slate-400 shrink-0">সাউন্ড ভলিউম:</span>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={soundVolume}
                          onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <span className="text-xs font-mono text-amber-400 shrink-0 font-bold">{Math.round(soundVolume * 100)}%</span>
                        <button
                          type="button"
                          onClick={() => playNewOrderSound(soundVolume)}
                          className="py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>টেস্ট সাউন্ড</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Browser Desktop Push Notification Card */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                          <Radio className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-200">ব্রাউজার ডেস্কটপ নোটিফিকেশন</h4>
                          <p className="text-[11px] text-slate-400">আপনি অন্য ট্যাবে থাকলেও স্ক্রিনের কোণায় নতুন অর্ডারের পপআপ নোটিফিকেশন আসবে</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={browserNotificationEnabled}
                          onChange={(e) => setBrowserNotificationEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>পারমিশন স্ট্যাটাস:</span>
                        <span className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                          browserPermissionStatus === 'granted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {browserPermissionStatus === 'granted' ? 'অনুমোদিত (Active)' : 'অনুমতি প্রয়োজন'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {browserPermissionStatus !== 'granted' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const perm = await requestBrowserNotificationPermission();
                              setBrowserPermissionStatus(perm);
                            }}
                            className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            অনুমতি দিন (Allow Notification)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            showOrderDesktopNotification({
                              id: 'test-order-' + Date.now(),
                              orderNumber: 'TEST-' + Math.floor(1000 + Math.random() * 9000),
                              customerName: 'টেস্ট কাস্টমার',
                              customerPhone: '01711223344',
                              customerEmail: 'test@example.com',
                              gateway: 'bkash',
                              trxId: '8N7X6Y9Z',
                              amount: 99,
                              discount: 0,
                              isAutoVerified: false,
                              status: 'pending',
                              createdAt: new Date().toLocaleTimeString('bn-BD'),
                              accessCode: 'TEST99'
                            }, () => setActiveTab('orders'));
                          }}
                          className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          টেস্ট নোটিফিকেশন পাঠান
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tab Title Alert & Flashing */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={flashingTabTitle}
                        onChange={(e) => setFlashingTabTitle(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">ব্রাউজার ট্যাব টাইটেল ফ্ল্যাশিং অ্যালার্ট (Flashing Tab Title)</span>
                        <p className="text-[11px] text-slate-400">পেন্ডিং অর্ডার থাকলে ব্রাউজার ট্যাবের টাইটেল <strong className="text-amber-300">"(১) 🔔 নতুন অর্ডার এসেছে!"</strong> হয়ে ফ্ল্যাশ করবে।</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer select-none pt-2 border-t border-slate-800/80">
                      <input
                        type="checkbox"
                        checked={repeatPendingAlert}
                        onChange={(e) => setRepeatPendingAlert(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">পেন্ডিং অর্ডার রিমাইন্ডার সাউন্ড (Repeat Alert)</span>
                        <p className="text-[11px] text-slate-400">যতক্ষণ না পেন্ডিং অর্ডারটি অ্যাপ্রুভ বা রিজেক্ট করা হচ্ছে, প্রতি ২ মিনিট পর মৃদু রিমাইন্ডার বিপ হবে।</p>
                      </div>
                    </label>
                  </div>

                  {/* Live Status Info Banner */}
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-slate-300 space-y-2">
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> নোটিফিকেশন সিস্টেম এখন সরাসরি সক্রিয়
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      ক্রেতাকে আর কোনো WhatsApp মেসেজ পাঠাতে বা বাড়তি বাটন ক্লিক করতে হবে না। ক্রেতা অর্ডার সাবমিট করার সাথে সাথেই আপনার অ্যাডমিন প্যানেল রিয়েলটাইমে ডিটেক্ট করবে এবং উচ্চ-মানের অডিও ও পুশ অ্যালার্ট দিয়ে আপনাকে অবগত করবে।
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const newSettings: NotificationSettings = {
                          soundEnabled,
                          soundVolume,
                          browserNotificationEnabled,
                          repeatPendingAlert,
                          flashingTabTitle,
                        };
                        if (onUpdateNotificationSettings) {
                          onUpdateNotificationSettings(newSettings);
                        }
                        await saveNotificationSettingsToFirestore(newSettings);
                        setSavedNotificationNotice(true);
                        setTimeout(() => setSavedNotificationNotice(false), 3000);
                      }}
                      className="w-full py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>নোটিফিকেশন ও অ্যালার্ট সেটিংস সেভ করুন</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: BRANDING & LOGO UPLOAD */}
          {activeTab === 'branding' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">ওয়েবসাইট লোগো আপলোড ও ইউনিফর্ম সাইজ কন্ট্রোল</h3>
                    <p className="text-xs text-slate-400">
                      আপনার নিজস্ব লোগো আপলোড করুন। যেকোনো সাইজ (Wide, Square, 4K) হলেও ওয়েবসাইটে এর উচ্চতা ও সাইজ সর্বদা একই ও নিখুঁত থাকবে।
                    </p>
                  </div>
                </div>

                {logoSaveNotice && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>নতুন লোগো সফলভাবে আপডেট ও ক্লাউড ডাটাবেজে সংরক্ষিত হয়েছে!</span>
                  </div>
                )}

                {logoError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{logoError}</span>
                  </div>
                )}

                {/* Live Preview Card */}
                <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <Eye className="w-4 h-4 text-purple-400" />
                      <span>ওয়েবসাইটে লাইভ সাইজ প্রিভিউ (Live Uniform Preview)</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
                      উচ্চতা লকড (৪০-৪৮px ফিক্সড)
                    </span>
                  </div>

                  {/* 1. Header Navbar Mockup */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 block">১. টপ নেভিগেশন বারে যেমন দেখাবে:</span>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 overflow-hidden">
                      <div className="flex items-center h-12 sm:h-14 max-w-[200px] sm:max-w-[280px] shrink-0 overflow-hidden px-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                        {currentLogo ? (
                          <img 
                            src={currentLogo} 
                            alt="Logo Preview Header" 
                            className="h-10 sm:h-12 max-h-10 sm:max-h-12 w-auto max-w-full object-contain object-left drop-shadow-md select-none"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">360°</div>
                            <span className="text-xs font-bold text-white">E-Commerce 360°</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 opacity-50 pointer-events-none">
                        <div className="hidden sm:block px-3 py-1.5 rounded-lg bg-blue-600/30 text-blue-300 text-[11px] font-bold">লগইন</div>
                        <div className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[11px] font-bold">বইটি কিনুন</div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Footer Mockup */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-400 block">২. ফুটার ব্র্যান্ডিং এরিয়ায় যেমন দেখাবে:</span>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center overflow-hidden">
                      <div className="flex items-center h-12 sm:h-14 max-w-[220px] sm:max-w-[280px] shrink-0 overflow-hidden px-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
                        {currentLogo ? (
                          <img 
                            src={currentLogo} 
                            alt="Logo Preview Footer" 
                            className="h-10 sm:h-12 max-h-10 sm:max-h-12 w-auto max-w-full object-contain object-left drop-shadow-md select-none"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">360°</div>
                            <span className="text-xs font-bold text-white">E-Commerce 360°</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Uniform Scaling Guarantee Box */}
                  <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-800/40 text-xs text-slate-300 space-y-1.5">
                    <p className="font-bold text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> ইউনিফর্ম সাইজ গ্যারান্টি:
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      আপনি <strong>বর্গাকার (Square যেমন 500x500px)</strong>, <strong>লম্বা আয়তাকার (Wide Banner যেমন 1200x300px)</strong> অথবা যেকোনো বড় সাইজের ছবি আপলোড করুন না কেন, ওয়েবসাইটের হেডারে ও ফুটারে এর আকার সর্বদা একই (৪০ থেকে ৪৮ পিক্সেল উচ্চতায়) থাকবে এবং লেআউট কোনোভাবেই ভাঙবে না।
                    </p>
                    {uploadedDimensions && (
                      <p className="text-[10px] font-mono text-purple-300 pt-1 border-t border-purple-900/50">
                        মূল ছবির সাইজ: {uploadedDimensions.width} × {uploadedDimensions.height} px • ডিসপ্লে সাইজ: ফিক্সড ৪০-৪৮px উচ্চতায় সমন্বিত
                      </p>
                    )}
                  </div>
                </div>

                {/* Upload Section */}
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <label className="text-xs font-bold text-slate-200 block">
                    নতুন লোগো ছবি আপলোড করুন (Upload Logo Image):
                  </label>
                  
                  <label className="relative border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors bg-slate-950/60 group">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                      disabled={isProcessingLogo}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-200">
                        {isProcessingLogo ? 'ছবি প্রসেসিং হচ্ছে...' : 'লোগো ফাইল নির্বাচন করতে এখানে ক্লিক করুন'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        সাপোর্টেড ফরম্যাট: PNG, JPG, WebP, SVG (স্বচ্ছ ব্যাকগ্রাউন্ডের জন্য PNG বা SVG সেরা)
                      </p>
                    </div>
                  </label>

                  {/* Or URL Input */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <label className="text-xs font-semibold text-slate-300 block">
                      অথবা অনলাইন ইমেজ লিংক (URL) দিন:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrlLogo}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        প্রিভিউ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveLogo}
                    disabled={isProcessingLogo}
                    className="flex-1 py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isProcessingLogo ? 'সংরক্ষণ হচ্ছে...' : 'নতুন লোগো সেভ করুন (Save to Website)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetLogo}
                    disabled={isProcessingLogo}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    title="আপলোড করা লোগো মুছে ফেলুন"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>লোগো ক্লিয়ার করুন</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: FIREBASE DATABASE & SECURITY RULES */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              
              {/* Connection Status Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${hasPermissionIssue ? 'bg-amber-500/15 border-amber-500/30' : 'bg-emerald-500/15 border-emerald-500/30'}`}>
                      <Shield className={`w-5 h-5 ${hasPermissionIssue ? 'text-amber-400' : 'text-emerald-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Firebase Firestore সংযোগ ও স্ট্যাটাস</h3>
                      <p className="text-xs text-slate-400">লাইভ ডাটাবেজ সিকিউরিটি ও সিঙ্ক্রোনাইজেশন সেটিংস</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">স্ট্যাটাস:</span>
                    {hasPermissionIssue ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Permission Denied (Rules Locked)</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>কানেক্টেড ও সচল</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Firebase Project ID:</span>
                    <span className="font-mono font-bold text-blue-400 text-sm">{firebaseConfig.projectId}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Auth Domain:</span>
                    <span className="font-mono text-slate-300">{firebaseConfig.authDomain}</span>
                  </div>
                </div>

                {/* Test Connection Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTestFirestore}
                    disabled={isTestingDb}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                    <span>{isTestingDb ? 'টেস্ট করা হচ্ছে...' : 'কানেকশন ও Rules টেস্ট করুন'}</span>
                  </button>

                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-blue-900/30"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Firebase Console এ Rules পেজ খুলুন</span>
                  </a>
                </div>

                {dbTestResult && (
                  <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    dbTestResult.success 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    {dbTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{dbTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* How to Fix Step-by-Step Guide */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-amber-400 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>"Missing or insufficient permissions" এরর কিভাবে ঠিক করবেন?</span>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">১</span>
                    <div>
                      <p className="font-semibold text-white">Firebase Console খুলুন:</p>
                      <p className="text-slate-400 mt-0.5">
                        ওপরের <span className="text-blue-400 font-mono">Firebase Console এ Rules পেজ খুলুন</span> বাটনে ক্লিক করে আপনার <span className="font-mono text-amber-300">{firebaseConfig.projectId}</span> প্রজেক্টের Firestore Database এর <strong>Rules</strong> ট্যাবে যান।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">২</span>
                    <div>
                      <p className="font-semibold text-white">নিচের রুলস কোডটি কপি করে পেস্ট করুন:</p>
                      <p className="text-slate-400 mt-0.5">
                        নিচে দেওয়া কোড ব্লকের <span className="text-emerald-400 font-semibold">"কোড কপি করুন"</span> বাটনে চাপ দিন এবং কনসোলের এডিটরে থাকা আগের লেখা মুছে এই কোড পেস্ট করুন।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-xs">৩</span>
                    <div>
                      <p className="font-semibold text-white">"Publish" বাটনে ক্লিক করুন:</p>
                      <p className="text-slate-400 mt-0.5">
                        Firebase Console এর ওপরের ডানপাশের নীল <strong>Publish</strong> বাটনে চাপ দিন। ২ সেকেন্ডের মধ্যে পারমিশন এরর বন্ধ হয়ে ওয়েবসাইট সম্পূর্ণ লাইভ সিঙ্কে চলে আসবে!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready-to-copy Firestore Rules Snippet */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">firestore.rules (রেডি কোড)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(FIRESTORE_RULES_GUIDE);
                      setCopiedRulesGuide(true);
                      setActionNotice('Firestore Rules কোড ক্লিপবোর্ডে কপি হয়েছে!');
                      setTimeout(() => setCopiedRulesGuide(false), 3000);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-900/30"
                  >
                    {copiedRulesGuide ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRulesGuide ? 'কপি হয়েছে!' : 'কোড কপি করুন'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] sm:text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  <pre className="whitespace-pre">{FIRESTORE_RULES_GUIDE}</pre>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ========================================================= */}
      {/* IN-APP CONFIRMATION MODALS (100% Reliable In All Browsers) */}
      {/* ========================================================= */}

      {/* 1. Single Order Delete Modal */}
      {deleteModalOrder && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400 pb-2 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">এই অর্ডারটি মুছে ফেলতে চান?</h3>
                <p className="text-xs text-slate-400">অর্ডার রেকর্ডটি ক্লাউড ডাটাবেজ থেকে স্থায়ীভাবে মুছে যাবে</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">অর্ডার নাম্বার:</span>
                <span className="font-mono font-bold text-white">#{deleteModalOrder.orderNumber || deleteModalOrder.id.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">গ্রাহকের নাম:</span>
                <span className="font-semibold text-white">{deleteModalOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">মোবাইল নাম্বার:</span>
                <span className="font-mono text-white">{deleteModalOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TrxID:</span>
                <span className="font-mono font-bold text-emerald-400">{deleteModalOrder.trxId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">টাকার পরিমাণ:</span>
                <span className="font-bold text-amber-400">৳{deleteModalOrder.amount}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteSingle}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, সম্পূর্ণ মুছে ফেলুন'}</span>
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalOrder(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Clear All Orders Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400 pb-2 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">সকল অর্ডার মুছে ফেলতে চান?</h3>
                <p className="text-xs text-slate-400">মোট {orders.length} টি অর্ডার রেকর্ড সম্পূর্ণ মুছে যাবে</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-red-950/30 p-3 rounded-xl border border-red-800/40">
              ⚠️ সতর্কবার্তা: এটি করলে আপনার ডাটাবেজের সমস্ত টেস্ট বা পূর্ববর্তী অর্ডার মুছে অ্যাডমিন প্যানেল একদম ফ্রেশ ও খালি হয়ে যাবে।
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmClearAll}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'সব মোছা হচ্ছে...' : `হ্যাঁ, সব (${orders.length}টি) অর্ডার মুছুন`}</span>
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowClearAllModal(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Clear Rejected Orders Modal */}
      {showClearRejectedModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400 pb-2 border-b border-slate-800">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">বাতিলকৃত অর্ডার মুছে ফেলা</h3>
                <p className="text-xs text-slate-400">সকল বাতিল (Rejected) অর্ডার ডাটাবেজ থেকে ক্লিন হবে</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              মোট {rejectedOrdersCount} টি বাতিলকৃত অর্ডার ডাটাবেজ থেকে সম্পূর্ণ মুছে ফেলা হবে।
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmClearRejected}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, বাতিলগুলো মুছুন'}</span>
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowClearRejectedModal(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
