import React, { useState, useEffect } from 'react';
import { UserMenu } from './UserMenu';
import { Screen, Order, OrderStatus, Notification, NotificationType, Message, ServicePackage, ServiceAddon, TeamMember, ToastType } from '../types';
import { FloatingChatButton } from './FloatingChatButton';
import { ChatModal } from './ChatModal';
import { SupportChatClient } from './SupportChatClient';
import { useSupportUnread } from '../hooks/useSupportUnread';
import { OrderChat } from './OrderChat';
import { useRef } from 'react';
import { triggerNativeHaptic } from '../utils/native';
import { LocationService } from '../services/LocationService';
import { addLoyaltyPoints } from './LoyaltyProgram';
import { PhotoCapture } from './PhotoCapture/PhotoCapture';
import { WasherSettings } from './Settings/WasherSettings';
import { ConfirmationModal } from './ConfirmationModal';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { i18n } from '../services/i18n';
import { parseSafeDate } from '../utils/dateUtils';
import { AvailableOrders } from './washer/AvailableOrders';
import { calculateOrderFinancials } from '../utils/financialCalculations';

interface WasherProps {
  screen: Screen;
  navigate: (screen: Screen) => void;
  orders: Order[];
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  currentWasherId: string;
  currentWasher: TeamMember;
  updateWasherProfile: (updates: Partial<TeamMember>) => void;
  supportPhone: string;
  notifications: Notification[];
  addNotification: (userId: string, title: string, message: string, type: NotificationType, linkTo?: Screen, relatedId?: string) => void;
  logout: () => void;
  messages: Message[];
  sendMessage: (senderId: string, receiverId: string, orderId: string, content: string, type?: 'text' | 'image') => Promise<any>;
  markMessagesAsRead: (orderId: string, userId: string) => Promise<void>;
  packages: ServicePackage[];
  addons: ServiceAddon[];
  openSupport?: () => void;
  grabOrder: (orderId: string, washerId: string, washerName: string, washerAvatar?: string) => Promise<string>;
  dropOrder: (orderId: string, washerId: string) => Promise<void>;
  showToast: (message: string, type?: ToastType) => void;
  initialOrderId?: string | null;
  isGoogleMapsLoaded?: boolean;
  supportUnreadCount?: number;
}

const WasherContent: React.FC<WasherProps> = ({ screen, navigate, orders, updateOrder, currentWasherId, currentWasher, updateWasherProfile, supportPhone, notifications, addNotification, logout, messages, sendMessage, markMessagesAsRead, packages, addons, openSupport, grabOrder, dropOrder, showToast, initialOrderId, isGoogleMapsLoaded, supportUnreadCount }) => {
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);

  // --- Image Compression Function ---
  // --- Image Compression Function ---
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Calculate new dimensions (max 1200px width/height)
          let width = img.width;
          let height = img.height;
          const maxSize = 1200;

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with 0.7 quality (good balance)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- Native Camera Bridge ---
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress image before storing
        const compressedUrl = await compressImage(file);

        if (cameraMode === 'before' && currentSlot) {
          // Store before photo in temporary state
          setBeforePhotos((prev: any) => ({ ...prev, [currentSlot]: compressedUrl }));
          setCurrentSlot('');
        } else if (cameraMode === 'after' && currentSlot) {
          setTempPhotos((prev: any) => ({ ...prev, [currentSlot]: compressedUrl }));
          setCurrentSlot('');
        }
      } catch (error) {
        console.error('Error compressing image:', error);
      }
    }
  };

  const triggerCamera = (mode: 'before' | 'after', slot?: string) => {
    setCameraMode(mode);
    if (slot) setCurrentSlot(slot);
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100);
  };

  const [selectedJob, setSelectedJob] = useState<Order | null>(null);

  // --- DEEP LINKING ---
  useEffect(() => {
    if (initialOrderId) {
      const order = orders.find(o => o.id === initialOrderId);
      if (order) {
        console.log('🔗 Deep Link: Selecting order', initialOrderId);
        setSelectedJob(order);
      }
    }
  }, [initialOrderId, orders]);

  // --- REAL-TIME PROTECTION ---
  useEffect(() => {
    if (selectedJob && screen === Screen.WASHER_JOB_DETAILS) {
      const liveOrder = orders.find(o => o.id === selectedJob.id);

      if (!liveOrder) {
        showToast('This order has been removed.', 'error');
        navigate(Screen.WASHER_ORDER_QUEUE);
        return;
      }

      if (liveOrder.status === 'Cancelled' && selectedJob.status !== 'Cancelled') {
        showToast('Sorry, the client cancelled this order.', 'info');
        navigate(Screen.WASHER_ORDER_QUEUE);
        return;
      }

      if (liveOrder.washerId && liveOrder.washerId !== currentWasherId && !selectedJob.washerId) {
        showToast('Sorry, another washer already took this order.', 'warning');
        navigate(Screen.WASHER_ORDER_QUEUE);
        return;
      }

      if (JSON.stringify(liveOrder) !== JSON.stringify(selectedJob)) {
        setSelectedJob(liveOrder);
      }
    }
  }, [orders, selectedJob, currentWasherId, screen]);

  const [showETAModal, setShowETAModal] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState('15');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatManuallyClosed, setChatManuallyClosed] = useState(false);

  // Notification states
  const [previousOrderCount, setPreviousOrderCount] = useState(0);
  const [notifiedOrders, setNotifiedOrders] = useState<Set<string>>(new Set());

  // Delete Account State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Support Chat Real-time Notifications removed as per request
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'primary'
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      type
    });
  };

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  // --- ORDER AGGREGATIONS ---
  const myJobs = orders.filter(o => o.washerId === currentWasherId);
  const activeJobs = myJobs.filter(o => ['Assigned', 'En Route', 'Arrived', 'In Progress'].includes(o.status));
  const completedJobs = myJobs.filter(o => o.status === 'Completed');

  // Global Fees State
  const [globalFees, setGlobalFees] = useState<{ name: string, percentage: number }[]>([]);
  // Per-Vehicle Service Configuration State
  const [vehicleConfigs, setVehicleConfigs] = useState<any[]>([]);

  // Fetch Global Fees
  useEffect(() => {
    const fetchFees = async () => {
      try {
        const docRef = doc(db, 'settings', 'financials');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().globalFees) {
          setGlobalFees(docSnap.data().globalFees);
        }
      } catch (e) {
        console.error("Error loading global fees:", e);
      }
    };
    fetchFees();
  }, []);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Navigation Component ---
  const ModernNav = () => (
    <nav
      className="absolute bottom-0 w-full bg-slate-900/80 backdrop-blur-xl border-t border-white/10 px-4 flex justify-around shadow-2xl z-20"
      style={{ paddingBottom: 'calc(var(--sab, 0px) + 8px)', paddingTop: '8px' }}
    >
      <button onClick={() => { triggerNativeHaptic(5); navigate(Screen.WASHER_DASHBOARD); }} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${screen === Screen.WASHER_DASHBOARD ? 'text-primary' : 'text-slate-400'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${screen === Screen.WASHER_DASHBOARD ? 'bg-primary/20 border border-primary/30' : 'bg-white/5 hover:bg-white/10'}`}>
          <span className="material-symbols-outlined text-lg">dashboard</span>
        </div>
        <span className={`text-[10px] ${screen === Screen.WASHER_DASHBOARD ? 'font-bold' : ''}`}>{i18n.t('dashboard') || 'Dashboard'}</span>
      </button>
      <button onClick={() => { triggerNativeHaptic(5); navigate(Screen.WASHER_JOBS); }} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${screen === Screen.WASHER_JOBS ? 'text-primary' : 'text-slate-400'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${screen === Screen.WASHER_JOBS ? 'bg-primary/20 border border-primary/30' : 'bg-white/5 hover:bg-white/10'}`}>
          <span className="material-symbols-outlined text-lg">work</span>
        </div>
        <span className={`text-[10px] ${screen === Screen.WASHER_JOBS ? 'font-bold' : ''}`}>{i18n.t('my_jobs')}</span>
      </button>
      <button onClick={() => { triggerNativeHaptic(5); navigate(Screen.WASHER_EARNINGS); }} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${screen === Screen.WASHER_EARNINGS ? 'text-primary' : 'text-slate-400'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${screen === Screen.WASHER_EARNINGS ? 'bg-primary/20 border border-primary/30' : 'bg-white/5 hover:bg-white/10'}`}>
          <span className="material-symbols-outlined text-lg">payments</span>
        </div>
        <span className={`text-[10px] ${screen === Screen.WASHER_EARNINGS ? 'font-bold' : ''}`}>{i18n.t('earnings')}</span>
      </button>
      <button onClick={() => { triggerNativeHaptic(5); navigate(Screen.WASHER_PROFILE); }} className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${screen === Screen.WASHER_PROFILE ? 'text-primary' : 'text-slate-400'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${screen === Screen.WASHER_PROFILE ? 'bg-primary/20 border border-primary/30' : 'bg-white/5 hover:bg-white/10'}`}>
          <span className="material-symbols-outlined text-lg">person</span>
        </div>
        <span className={`text-[10px] ${screen === Screen.WASHER_PROFILE ? 'font-bold' : ''}`}>{i18n.t('profile')}</span>
      </button>
    </nav>
  );

  const handleGrabOrder = async (orderId: string) => {
    try {
      // Use the transactional grabOrder
      await grabOrder(
        orderId,
        currentWasherId,
        currentWasher?.name || 'Washer',
        currentWasher?.avatar
      );

      // Navigate to job details
      const updatedOrder = orders.find(o => o.id === orderId);
      if (updatedOrder) {
        setSelectedJob({
          ...updatedOrder,
          status: 'Assigned',
          washerId: currentWasherId,
          washerName: currentWasher?.name
        });
      }
      navigate(Screen.WASHER_JOB_DETAILS);

      // Show success message
      showToast('Order Assigned! You have successfully grabbed the order', 'success');
    } catch (error: any) {
      console.error('Error grabbing order:', error);
      if (error.message === 'Order already taken') {
        showToast('Sorry, another washer already took this order.', 'error');
        // If they were on details, go back
        if (screen === Screen.WASHER_JOB_DETAILS) {
          navigate(Screen.WASHER_ORDER_QUEUE);
        }
      } else {
        showToast('Could not grab order. Please try again.', 'error');
      }
    }
  };

  const handleDropOrder = async (orderId: string) => {
    showConfirm(
      'Drop Order',
      'Are you sure you want to drop this order? You will be penalized 0.5 stars from your rating.',
      async () => {
        try {
          triggerNativeHaptic();
          await dropOrder(orderId, currentWasherId);
          showToast('Order dropped. 0.5 star penalty applied.', 'info');
          navigate(Screen.WASHER_JOBS);
        } catch (error: any) {
          console.error('Error dropping order:', error);
          showToast(error.message || 'Failed to drop order.', 'error');
        }
      },
      'danger'
    );
  };

  // Real-time notification system for new orders

  useEffect(() => {
    const myOrders = orders.filter(o => o.washerId === currentWasherId);
    const newOrders = myOrders.filter(o =>
      o.status === 'Assigned' && !notifiedOrders.has(o.id)
    );

    // Notify about new orders
    if (newOrders.length > 0) {
      newOrders.forEach(order => {
        console.log('🔔 NEW ORDER ASSIGNED:', order.id, order.service);

        // Play notification sound
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77eafTRALUKfj8LZjHAU4ktjyzHksBSR3x/DdkEAKFF606+uoVRQKRp/g8r5sIQYsgc7y2Yk2CBlou+3mn00QC1Cn4/C2YxwFOJLY8sx5LAUkd8fw3ZBBChRetevrqFUUCkaf4PK+bCEGLIHO8tmJNggZaLvt5p9NEAtQp+PwtmMcBTiS2PLMeSwFJHfH8N2QQQoUXrXr66hVFApGn+DyvmwhBiyBzvLZiTYIGWi77eafTRALUKfj8LZjHAU4ktjyzHksBSR3x/DdkEEKFF616+uoVRQKRp/g8r5sIQYsgc7y2Yk2CBlou+3mn00QC1Cn4/C2YxwFOJLY8sx5LAUkd8fw3ZBBChRetevrqFUUCkaf4PK+bCEGLIHO8tmJNggZaLvt5p9NEAtQp+PwtmMcBTiS2PLMeSwFJHfH8N2QQQoUXrXr66hVFApGn+DyvmwhBiyBzvLZiTYIGWi77eafTRALUKfj8LZjHAU4ktjyzHksBSR3x/DdkEEKFF616+uoVRQKRp/g8r5sIQYsgc7y2Yk2CBlou+3mn00QC1Cn4/C2Yx');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {
          console.log('Audio creation failed:', e);
        }

        // Show toast notification
        if (typeof window !== 'undefined' && (window as any).showToast) {
          (window as any).showToast(`🚗 New Order: ${order.service} - ${order.vehicle}`, 'success');
        }
      });

      // Mark as notified
      setNotifiedOrders(prev => {
        const newSet = new Set(prev);
        newOrders.forEach(o => newSet.add(o.id));
        return newSet;
      });
    }

    setPreviousOrderCount(myOrders.length);
  }, [orders, currentWasherId, notifiedOrders]);


  // Photo Workflow State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'before' | 'after'>('before');
  const [currentSlot, setCurrentSlot] = useState<string>(''); // For 'after' specific slots
  const [tempPhotos, setTempPhotos] = useState<any>({}); // Staging area for photos
  const [beforePhotos, setBeforePhotos] = useState<any>({}); // Before photos staging
  const [arrivedAt, setArrivedAt] = useState<number | null>(null); // Track arrival time
  const [showBeforePhotosModal, setShowBeforePhotosModal] = useState(false);

  // Chat Logic for Washer
  const activeJob = orders.find(o => o.washerId === currentWasherId && ['Assigned', 'En Route', 'Arrived', 'In Progress'].includes(o.status));
  const activeChatMessages = activeJob ? messages.filter(m => m.orderId === activeJob.id).sort((a, b) => a.timestamp - b.timestamp) : [];
  const chatUnreadCount = activeChatMessages.filter(m => m.receiverId === currentWasherId && !m.read).length;

  const handleSendMessage = (content: string) => {
    if (!activeJob) return;
    sendMessage(currentWasherId, activeJob.clientId || '', activeJob.id, content, 'text');
  };

  const unreadCount = notifications.filter(n => !n.read && n.userId === currentWasherId).length;

  // Track unread count increases to reset manual close flag (using ref to avoid loops)
  const prevUnreadCountRef = useRef(chatUnreadCount);
  useEffect(() => {
    if (chatUnreadCount > prevUnreadCountRef.current) {
      setChatManuallyClosed(false);
    }
    prevUnreadCountRef.current = chatUnreadCount;
  }, [chatUnreadCount]);

  // Auto-open chat on new message (only if not manually closed)
  useEffect(() => {
    if (chatUnreadCount > 0 && !showChat && !chatManuallyClosed) {
      // Check if the last message is from the client (not self)
      const lastMsg = activeChatMessages[activeChatMessages.length - 1];
      if (lastMsg && lastMsg.senderId !== currentWasherId) {
        setShowChat(true);
        triggerNativeHaptic();
      }
    }
  }, [chatUnreadCount, activeChatMessages.length, showChat, chatManuallyClosed, currentWasherId]);

  // Mark active chat messages as read automatically
  useEffect(() => {
    if (showChat && activeJob && chatUnreadCount > 0) {
      markMessagesAsRead(activeJob.id, currentWasherId);
    }
  }, [showChat, activeJob?.id, chatUnreadCount, currentWasherId, markMessagesAsRead]);

  // --- LOCATION TRACKING REMOVED ---
  // Tracking is now handled globally by LocationTracker component in App.tsx
  // This avoids redundant WatchPosition instances and permission conflicts.

  const handleEnRouteClick = async () => {
    if (!selectedJob) return;

    triggerNativeHaptic();

    let calculatedETA = '15'; // Default fallback

    // Try to calculate real ETA from Google Maps
    if (selectedJob?.location?.lat && selectedJob?.location?.lng) {
      try {
        const currentLoc = await LocationService.getCurrentLocation();
        const { duration } = await LocationService.getRouteETA(
          currentLoc.latitude,
          currentLoc.longitude,
          selectedJob.location.lat,
          selectedJob.location.lng
        );
        calculatedETA = duration.toString();
        console.log('📍 Calculated ETA from Google Maps:', calculatedETA, 'minutes');
      } catch (error) {
        console.warn('⚠️ Failed to calculate ETA, using default:', error);
      }
    }

    // Update order with calculated ETA
    console.log('🚗 Setting order to En Route:', selectedJob.id, 'ETA:', calculatedETA);
    updateOrder(selectedJob.id, {
      status: 'En Route',
      estimatedArrival: `${calculatedETA} min`
    });
    console.log('✅ Order status updated to En Route');

    // Start real-time location tracking is handled automatically by LocationTracker 
    // when the status changes to 'En Route'. Manual call removed to avoid redundancy.

    triggerNativeHaptic();
    // navigate(Screen.WASHER_JOBS); // Removed navigation to stay on details
  };

  // Old manual ETA submit function - no longer needed but keeping for reference
  const handleETASubmit = async () => {
    if (selectedJob && etaMinutes) {
      console.log('🚗 Setting order to En Route:', selectedJob.id, 'ETA:', etaMinutes);
      updateOrder(selectedJob.id, {
        status: 'En Route',
        estimatedArrival: `${etaMinutes} min`
      });
      console.log('✅ Order status updated to En Route');

      // Start real-time location tracking is handled automatically by LocationTracker

      setShowETAModal(false);
      setEtaMinutes('15');
      triggerNativeHaptic(40);
      navigate(Screen.WASHER_JOBS);
    } else {
      console.error('❌ Cannot submit ETA - missing selectedJob or etaMinutes');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // 1. Mark as read
    try {
      if (!notification.read) {
        // Assume markNotificationRead is available or use updateDoc directly
        await updateDoc(doc(db, 'notifications', notification.id), { read: true });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }

    // 2. Navigation logic
    if (notification.relatedId && notification.linkTo) {
      if (notification.linkTo === Screen.WASHER_JOB_DETAILS) {
        const orderId = notification.relatedId;
        const targetOrder = orders.find(o => o.id === orderId);

        if (targetOrder) {
          // Check if order is already assigned to someone else
          if (targetOrder.washerId && targetOrder.washerId !== currentWasherId) {
            showToast('Sorry, this order has already been assigned to another washer.', 'warning');
            navigate(Screen.WASHER_ORDER_QUEUE);
          } else {
            setSelectedJob(targetOrder);
            navigate(Screen.WASHER_JOB_DETAILS);
          }
        } else {
          // If order not found in current list, maybe it was deleted or just not loaded
          showToast('Sorry, this order is no longer available.', 'error');
          navigate(Screen.WASHER_ORDER_QUEUE);
        }
      } else {
        // Generic navigation for other notification types
        navigate(notification.linkTo as Screen);
      }
    }

    setShowNotifications(false);
  };

  const NotificationList = () => (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-end p-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
      <div className="bg-surface-dark w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden mt-16 flex flex-col">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
          <h3 className="font-bold text-lg">Notifications</h3>
          <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {notifications.filter(n => n.userId === currentWasherId || n.userId === 'washer-broadcast').length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications
              .filter(n => n.userId === currentWasherId || n.userId === 'washer-broadcast')
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!notification.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notification.type === 'success' ? 'bg-green-500/20 text-green-500' :
                      notification.type === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                        notification.type === 'error' ? 'bg-red-500/20 text-red-500' :
                          'bg-blue-500/20 text-blue-500'
                      }`}>
                      <span className="material-symbols-outlined text-xl">
                        {notification.type === 'success' ? 'check_circle' :
                          notification.type === 'warning' ? 'warning' :
                            notification.type === 'error' ? 'error' : 'info'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-bold text-sm mb-1 ${!notification.read ? 'text-white' : 'text-slate-300'}`}>{notification.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-2">{notification.message}</p>
                      <p className="text-[10px] text-slate-500">{new Date(notification.timestamp).toLocaleString()}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );


  // --- JOB SUMMARY / WAIT FOR CLIENT LOGIC ---
  const activeCompletedJob = orders.find(o =>
    o.washerId === currentWasherId &&
    o.status === 'Completed' &&
    o.completedAt &&
    (Date.now() - o.completedAt < 10 * 60 * 1000) && // Less than 10 mins ago
    !o.clientRating // Client hasn't rated yet
  );

  if (activeCompletedJob) {
    const financials = calculateOrderFinancials(activeCompletedJob, globalFees);

    return (
      <div className="flex flex-col h-full bg-background-dark p-6 overflow-hidden relative">
        {/* Background Ambience */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-500/10 rounded-full blur-xl"></div>
            <div className="relative w-24 h-24 rounded-full bg-surface-dark border-2 border-green-500/50 flex items-center justify-center shadow-lg shadow-green-500/20">
              <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
            </div>
          </div>

          <h1 className="text-3xl font-black mb-1 text-white text-center uppercase tracking-tighter">{i18n.t('excellent_work') || 'Excellent Work!'}</h1>
          <p className="text-slate-400 text-sm mb-8 text-center max-w-xs">{i18n.t('service_completed_success') || 'Service completed successfully.'}</p>

          {/* Earnings Summary Card */}
          <div className="bg-surface-dark border border-white/10 rounded-3xl p-6 w-full max-w-sm mb-8 shadow-2xl backdrop-blur-md">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center">{i18n.t('earnings_summary') || 'Earnings Summary'}</h4>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">{i18n.t('service_total_gross') || 'Service Total (Gross)'}</span>
                <span className="text-white font-bold">${financials.clientTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-red-400">{i18n.t('app_commission') || 'App Commission'}</span>
                <span className="text-red-400">-${financials.totalFees.toFixed(2)}</span>
              </div>

              {financials.tipAmount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-400">{i18n.t('tips_100_yours') || 'Tips (100% yours)'}</span>
                  <span className="text-green-400">+${financials.tipAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-white/10 pt-4 mt-2 flex justify-between items-center">
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{i18n.t('your_net') || 'Net Payout'}</span>
                <span className="font-black text-3xl text-primary">${financials.washerGrossEarnings.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm" style={{ paddingBottom: 'var(--sab, 0px)' }}>
            <button
              onClick={() => {
                triggerNativeHaptic();
                navigate(Screen.WASHER_JOBS);
              }}
              className="w-full py-5 rounded-2xl font-black bg-primary text-white hover:bg-primary-dark transition-all shadow-blue-lg flex items-center justify-center gap-3 hover:scale-[1.02]"
            >
              <span className="uppercase tracking-widest">{i18n.t('next') || 'Next'}</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>

            <p className="text-center text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
              Order #{activeCompletedJob.id}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- BUSINESS LOGIC HELPERS ---
  const availableJobs = orders.filter(o => !o.washerId && o.status === 'Pending');

  // Calculate earnings summary for dashboard
  const calculateQuickStats = () => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    const day = currentWeekStart.getDay() || 7;
    if (day !== 1) currentWeekStart.setHours(-24 * (day - 1));
    currentWeekStart.setHours(0, 0, 0, 0);

    const weekJobsForStats = completedJobs.filter(job => {
      const jobDate = job.completedAt ? new Date(job.completedAt) : new Date(job.date);
      return jobDate >= currentWeekStart;
    });

    const totalFeePercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);

    const weekEarningsNum = weekJobsForStats.reduce((acc, job) => {
      let jobGross = job.price || 0;
      if (job.vehicleConfigs) {
        jobGross = job.vehicleConfigs.reduce((g, c) => {
          const pkg = packages.find(p => p.id === c.packageId);
          let itemGross = pkg?.price?.[c.vehicleType] || 0;
          if (c.addonIds) {
            c.addonIds.forEach(aId => {
              const add = addons.find(a => a.id === aId);
              itemGross += add?.price?.[c.vehicleType] || 0;
            });
          }
          return g + itemGross;
        }, 0);
      }
      return acc + (jobGross * (1 - totalFeePercent / 100));
    }, 0);

    return { weekEarnings: weekEarningsNum };
  };

  const { weekEarnings } = calculateQuickStats();

  let content = null;

  if (screen === Screen.WASHER_DASHBOARD) {
    content = (
      <React.Fragment>
        <div
          className="flex flex-col h-full bg-background-dark text-white relative washer-dash-container"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {showNotifications && <NotificationList />}

          <div className="flex-1 overflow-y-auto washer-scroll-area relative z-10 px-4 pt-6">
            {/* Dashboard Header - Client Style */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <p className="text-slate-400 text-sm">{i18n.t('hello') || 'Hello'},</p>
                <h1 className="text-2xl font-bold">{currentWasher?.name?.split(' ')[0] || 'Washer'}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <span className="material-symbols-outlined text-amber-500 text-xs filled">star</span>
                    <span className="text-xs font-bold text-amber-500">
                      {typeof currentWasher?.rating === 'number' ? currentWasher.rating.toFixed(1) : '5.0'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                    {currentWasher?.completedJobs || 0} {i18n.t('jobs') || 'jobs'}
                  </span>
                  <div className="flex items-center gap-1 ml-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${currentWasher?.status === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {currentWasher?.status === 'Active' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              <UserMenu
                onLogout={logout}
                user={{
                  id: currentWasherId,
                  name: currentWasher?.name || 'Washer',
                  email: (currentWasher as any)?.email || '',
                  avatar: currentWasher?.avatar || '',
                  role: 'washer'
                } as any}
              />
            </div>

            {/* Quick Stats - Client Style Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div
                onClick={() => {
                  triggerNativeHaptic();
                  navigate(Screen.WASHER_JOBS);
                }}
                className="bg-surface-dark border border-white/5 p-5 rounded-2xl hover:border-primary/50 transition-all text-left group shadow-lg hover:shadow-primary/5 active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-blue-400">pending_actions</span>
                </div>
                <p className="text-3xl font-black text-white mb-1">{activeJobs.length}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{i18n.t('active_jobs') || 'Active Jobs'}</p>
              </div>

              <div
                onClick={() => {
                  triggerNativeHaptic();
                  navigate(Screen.WASHER_EARNINGS);
                }}
                className="bg-surface-dark border border-white/5 p-5 rounded-2xl hover:border-emerald-500/50 transition-all text-left group shadow-lg hover:shadow-emerald-500/5 active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-emerald-400">payments</span>
                </div>
                <p className="text-3xl font-black text-white mb-1">${weekEarnings.toFixed(0)}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{i18n.t('this_week')}</p>
              </div>
            </div>

            {/* Active Jobs Preview */}
            {activeJobs.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">{i18n.t('active_flow') || 'Active Flow'}</h2>
                  <button
                    onClick={() => navigate(Screen.WASHER_JOBS)}
                    className="text-primary text-xs font-bold uppercase tracking-widest"
                  >
                    {i18n.t('view_all') || 'View All'}
                  </button>
                </div>
                <div className="space-y-4">
                  {activeJobs.slice(0, 2).map(job => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJob(job);
                        navigate(Screen.WASHER_JOB_DETAILS);
                      }}
                      className="w-full bg-surface-dark border border-white/5 p-5 rounded-2xl hover:border-primary/50 transition-all text-left group shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-xl">directions_run</span>
                          </div>
                          <div>
                            <p className="font-bold text-white group-hover:text-primary transition-colors">{job.clientName}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{job.vehicle}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${job.status === 'In Progress' ? 'bg-primary/20 text-primary border border-primary/30' :
                          job.status === 'Arrived' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                          {job.status === 'Assigned' ? i18n.t('assigned') : job.status === 'En Route' ? i18n.t('en_route') : job.status === 'Arrived' ? i18n.t('arrived') : job.status === 'In Progress' ? i18n.t('in_progress') : job.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        <span className="truncate">{job.address}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Action - Search for Orders */}
            <div className="mb-8">
              <button
                onClick={() => {
                  triggerNativeHaptic();
                  navigate(Screen.WASHER_ORDER_QUEUE);
                }}
                className="w-full py-5 px-6 rounded-2xl flex items-center justify-between group relative overflow-hidden transition-all active:scale-[0.98]"
                style={{ backgroundColor: '#3b82f6' }}
              >
                {/* Glossy Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50 group-hover:translate-x-full transition-transform duration-700"></div>

                <div className="flex items-center gap-4 relative z-10 text-white">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
                    <span className="material-symbols-outlined text-3xl">search</span>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-xl leading-none mb-1">{i18n.t('search_orders') || 'Search Orders'}</p>
                    <p className="text-white/80 text-sm font-medium">{availableJobs.length} {i18n.t('waiting') || 'waiting'}</p>
                  </div>
                </div>
                <div className="relative z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white">chevron_right</span>
                </div>
              </button>
            </div>

            {/* Empty State */}
            {activeJobs.length === 0 && (
              <div className="bg-surface-dark/50 border border-dashed border-white/10 rounded-3xl p-10 text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-5xl text-slate-600">dashboard_customize</span>
                </div>
                <h3 className="text-xl font-black text-white mb-2">{i18n.t('no_active_jobs')}</h3>
                <p className="text-slate-500 text-sm max-w-[200px] mx-auto leading-relaxed">{i18n.t('no_assigned_jobs')}</p>
              </div>
            )}

          </div>
          <ModernNav />
        </div>
      </React.Fragment>
    );
  } else if (screen === Screen.WASHER_ORDER_QUEUE) {
    content = (
      <AvailableOrders
        orders={orders}
        navigate={(screen: Screen, orderId?: string) => {
          if (orderId) {
            setSelectedJob(orders.find(o => o.id === orderId) || null);
          }
          navigate(screen);
        }}
        onGrabOrder={handleGrabOrder}
        initialOrderId={initialOrderId}
        washerRating={typeof currentWasher?.rating === 'number' ? currentWasher.rating : 5.0}
      />
    );
  } else if (screen === Screen.WASHER_JOBS) {
    content = (
      <React.Fragment>
        <div
          className="flex flex-col h-full bg-background-dark text-white relative washer-dash-container"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Animated Background - Client Style */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>

          {/* Header - Simple and Clean */}
          <header className="px-6 py-6 border-b border-white/5 bg-background-dark/50 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black">{i18n.t('my_jobs')}</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{i18n.t('my_jobs_desc')}</p>
            </div>
            <UserMenu
              onLogout={logout}
              user={{
                id: currentWasherId,
                name: currentWasher?.name || 'Washer',
                email: (currentWasher as any)?.email || '',
                avatar: currentWasher?.avatar || '',
                role: 'washer'
              } as any}
            />
          </header>

          <div className="flex-1 overflow-y-auto relative z-10 px-4 pt-6 washer-scroll-area">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">pending_actions</span>
                </div>
                <div>
                  <p className="text-xl font-black">{activeJobs.length}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{i18n.t('active_jobs') || 'Active'}</p>
                </div>
              </div>
              <div className="bg-surface-dark/50 rounded-2xl p-4 border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-400">task_alt</span>
                </div>
                <div>
                  <p className="text-xl font-black">{completedJobs.length}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{i18n.t('completed') || 'Done'}</p>
                </div>
              </div>
            </div>

            {/* Active Jobs Section */}
            {activeJobs.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  {i18n.t('active_jobs') || 'Active Flows'}
                </h2>
                <div className="space-y-4">
                  {activeJobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJob(job);
                        navigate(Screen.WASHER_JOB_DETAILS);
                      }}
                      className="w-full bg-surface-dark border border-white/5 p-5 rounded-3xl hover:border-primary/50 transition-all text-left group shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-black text-lg text-white group-hover:text-primary transition-colors">{job.clientName}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{job.vehicle}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${job.status === 'In Progress' ? 'bg-primary/20 text-primary border border-primary/30' :
                          job.status === 'Arrived' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                          {job.status === 'Assigned' ? i18n.t('assigned') : job.status === 'En Route' ? i18n.t('en_route') : job.status === 'Arrived' ? i18n.t('arrived') : job.status === 'In Progress' ? i18n.t('in_progress') : job.status}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-sm">local_car_wash</span>
                          </div>
                          <span className="font-medium">{job.service}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-sm">location_on</span>
                          </div>
                          <span className="truncate font-medium">{job.address}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Jobs Section */}
            {completedJobs.length > 0 && (
              <div>
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                  {i18n.t('completed_jobs') || 'History'}
                </h2>
                <div className="space-y-3">
                  {completedJobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => {
                        setSelectedJob(job);
                        navigate(Screen.WASHER_JOB_DETAILS);
                      }}
                      className="w-full bg-surface-dark/40 border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-all text-left opacity-70 hover:opacity-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-500 text-lg">check_circle</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-200">{job.clientName}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{job.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-white text-lg">${job.price.toFixed(2)}</p>
                          <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{i18n.t('completed')}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {myJobs.length === 0 && (
              <div className="bg-surface-dark/30 border border-dashed border-white/10 rounded-3xl p-12 text-center mt-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-slate-600">work_outline</span>
                </div>
                <h3 className="text-lg font-black text-white mb-2">{i18n.t('no_active_jobs') || 'No Jobs Yet'}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{i18n.t('no_assigned_jobs') || 'You have no assigned jobs at the moment.'}</p>
              </div>
            )}
          </div>
          <ModernNav />
        </div>
      </React.Fragment>
    );
  } else if (screen === Screen.WASHER_JOB_DETAILS && selectedJob) {
    const isActiveJob = ['Assigned', 'En Route', 'Arrived', 'In Progress'].includes(selectedJob.status);


    content = (
      <React.Fragment>
        <div
          className="flex flex-col h-full bg-[#0A0A0B] text-white relative"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Ambient glow */}
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

          {/* ── HEADER ── */}
          <header className="px-6 py-5 flex items-center justify-between border-b border-white/[0.04] bg-[#0A0A0B]/90 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(Screen.WASHER_JOBS)}
                className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">arrow_back_ios_new</span>
              </button>
              <div>
                <p className="text-[9px] uppercase font-bold tracking-[0.25em] text-slate-500">Order Summary</p>
                <p className="text-base font-semibold tracking-tight">#{selectedJob.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
              selectedJob.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' :
              selectedJob.status === 'Arrived'     ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              selectedJob.status === 'En Route'    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              selectedJob.status === 'Completed'   ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                     'bg-white/5 text-slate-400 border-white/10'
            }`}>
              {selectedJob.status}
            </div>
          </header>

          {/* ── SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">

            {/* Client + Chat */}
            <div className="p-8 pb-6 border-b border-white/[0.04]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em] mb-1">Client</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">{selectedJob.clientName}</h2>
                  <p className="text-slate-500 text-sm mt-1">{selectedJob.date} · {selectedJob.time}</p>
                </div>
                {isActiveJob && (
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg relative"
                  >
                    <span className="material-symbols-outlined text-xl filled">chat</span>
                    {chatUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-white text-[10px] font-bold flex items-center justify-center">{chatUnreadCount}</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="px-8 py-6 border-b border-white/[0.04]">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-slate-500 mt-0.5">location_on</span>
                <div className="flex-1">
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.15em] mb-1">Service Location</p>
                  <p className="text-white text-sm font-normal leading-relaxed mb-3">{selectedJob.address}</p>
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.location?.lat},${selectedJob.location?.lng}`, '_blank')}
                    className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/5 border border-white/8 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-primary transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">directions</span>
                    Navigate
                  </button>
                </div>
              </div>
            </div>

            {/* Vehicle + Services */}
            <div className="px-8 py-6 border-b border-white/[0.04]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-slate-500 text-sm">directions_car</span>
                <h3 className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-500">Vehicle & Services</h3>
              </div>
              {selectedJob.vehicleConfigs && selectedJob.vehicleConfigs.length > 0 ? (
                selectedJob.vehicleConfigs.map((config: any, idx: number) => {
                  const pkg = packages.find(p => p.id === config.packageId);
                  const vType = config.vehicleType || 'sedan';
                  let vehiclePrice = pkg?.price?.[vType] || 0;
                  const vehicleAddons = (config.addonIds || []).map((aid: string) => addons.find((a: any) => a.id === aid)).filter(Boolean);
                  const addonsTotal = vehicleAddons.reduce((s: number, a: any) => s + (a.price?.[vType] || 0), 0);
                  return (
                    <div key={idx} className="mb-3 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-white">{config.vehicleModel || selectedJob.vehicle}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{pkg?.name || 'Standard Wash'} · <span className="uppercase text-[10px]">{vType}</span></p>
                        </div>
                        <p className="font-semibold text-white">${(vehiclePrice + addonsTotal).toFixed(2)}</p>
                      </div>
                      {vehicleAddons.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1">
                          {vehicleAddons.map((a: any) => (
                            <div key={a.id} className="flex justify-between text-[12px] text-slate-500">
                              <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-600 inline-block"/>  {a.name}</span>
                              <span>+${(a.price?.[vType] || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold text-white">{selectedJob.vehicle}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{selectedJob.service}</p>
                    </div>
                    <p className="font-semibold text-white">${selectedJob.price.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Earnings summary (always visible for washer) */}
            <div className="px-8 py-6 border-b border-white/[0.04]">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-slate-500 text-sm">account_balance_wallet</span>
                <h3 className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-500">Your Earnings</h3>
              </div>
              {(() => {
                const base = selectedJob.price || 0;
                const totalFeePercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);
                const fees = (base * totalFeePercent) / 100;
                const tip = selectedJob.tip || 0;
                const net = base - fees + tip;
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Service Total</span>
                      <span className="text-white font-medium">${base.toFixed(2)}</span>
                    </div>
                    {globalFees.map((fee, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-500">{fee.name} ({fee.percentage}%)</span>
                        <span className="text-red-400/80">-${((base * fee.percentage) / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    {tip > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-400">Tip</span>
                        <span className="text-emerald-400">+${tip.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-white/[0.06] pt-3 flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Net Payout</span>
                      <span className="text-2xl font-bold text-primary">${net.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="p-8">
              <div className="bg-white/[0.02] rounded-[2.5rem] p-4 border border-white/[0.05] space-y-3">

                {/* ASSIGNED → EN ROUTE */}
                {selectedJob.status === 'Assigned' && (
                  <button
                    onClick={handleEnRouteClick}
                    className="w-full py-5 rounded-[2rem] font-bold text-[11px] uppercase tracking-[0.2em] bg-primary text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3"
                  >
                    <span className="material-symbols-outlined text-lg">directions_car</span>
                    {i18n.t('im_en_route') || "I'M EN ROUTE"}
                  </button>
                )}

                {/* EN ROUTE → ARRIVED */}
                {selectedJob.status === 'En Route' && (
                  <button
                    onClick={() => { triggerNativeHaptic(); updateOrder(selectedJob.id, { status: 'Arrived', arrivedAt: Date.now() }); setArrivedAt(Date.now()); }}
                    className="w-full py-5 rounded-[2rem] font-bold text-[11px] uppercase tracking-[0.2em] bg-blue-600 text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3"
                  >
                    <span className="material-symbols-outlined text-lg">location_on</span>
                    {i18n.t('i_have_arrived') || "I HAVE ARRIVED"}
                  </button>
                )}

                {/* ARRIVED → START WASH */}
                {selectedJob.status === 'Arrived' && (
                  <div className="space-y-3">
                    <div className={`py-3 rounded-[2rem] flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest border ${selectedJob.clientAuthorized ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' : 'bg-amber-500/5 border-amber-500/15 text-amber-400'}`}>
                      <span className={`material-symbols-outlined text-sm ${selectedJob.clientAuthorized ? '' : 'animate-spin'}`}>{selectedJob.clientAuthorized ? 'verified_user' : 'pending'}</span>
                      {selectedJob.clientAuthorized ? 'Client Authorized' : 'Waiting for Authorization'}
                    </div>
                    <button
                      onClick={() => { triggerNativeHaptic(); setBeforePhotos({}); setShowBeforePhotosModal(true); }}
                      disabled={!selectedJob.clientAuthorized}
                      className={`w-full py-5 rounded-[2rem] font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${selectedJob.clientAuthorized ? 'bg-white text-black shadow-xl active:scale-[0.98]' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}
                    >
                      <span className="material-symbols-outlined text-lg">camera_alt</span>
                      {i18n.t('start_wash_photos') || 'Take Photos & Start'}
                    </button>
                    <button
                      onClick={() => showConfirm('Client No Show', 'Mark order as "No Show"?', () => { updateOrder(selectedJob.id, { status: 'Cancelled', cancelReason: 'Client No Show' }); navigate(Screen.WASHER_JOBS); }, 'danger')}
                      className="w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-red-500/40 hover:text-red-500 transition-colors"
                    >
                      {i18n.t('client_no_show') || 'Client No Show'}
                    </button>
                  </div>
                )}

                {/* IN PROGRESS → FINISH */}
                {selectedJob.status === 'In Progress' && (
                  <div className="space-y-4">
                    <div className="py-2 flex items-center justify-center gap-2 text-primary text-[10px] font-bold uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      Washing in Progress
                    </div>
                    <button
                      onClick={() => { triggerNativeHaptic(); setCameraMode('after'); setTempPhotos({}); setShowCamera(true); }}
                      className="w-full py-6 rounded-[2rem] font-bold text-[11px] uppercase tracking-[0.3em] bg-white text-black active:scale-[0.98] transition-all shadow-2xl flex items-center justify-center gap-3"
                    >
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                      {i18n.t('finish_wash') || 'FINISH WASH'}
                    </button>
                  </div>
                )}

                {/* COMPLETED */}
                {selectedJob.status === 'Completed' && (
                  <div className="space-y-4 py-2 text-center">
                    <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                      <span className="material-symbols-outlined text-emerald-400 text-3xl filled">check_circle</span>
                    </div>
                    <p className="text-xl font-semibold tracking-tight">{i18n.t('wash_finished') || 'Wash Finished!'}</p>
                    <button
                      onClick={() => { triggerNativeHaptic(); navigate(Screen.WASHER_JOBS); }}
                      className="w-full py-5 rounded-[2rem] font-bold text-[11px] uppercase tracking-[0.25em] bg-white text-black active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                      {i18n.t('back_to_home') || 'Back to Jobs'}
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>
                  </div>
                )}

                {/* DROP ORDER BUTTON */}
                {['Assigned', 'En Route', 'Arrived'].includes(selectedJob.status) && (
                  <button
                    onClick={() => handleDropOrder(selectedJob.id)}
                    className="w-full py-4 rounded-[2rem] font-bold text-[11px] uppercase tracking-[0.25em] bg-red-950/20 text-red-500 hover:bg-red-950/40 border border-red-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-4"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                    Drop Order (-0.5 Rating Penalty)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  } else if (screen === Screen.WASHER_EARNINGS) {
    // completedJobs defined in outer scope

    // Calculate totals (New Logic: Price - Global Fees)
    const calculateEarnings = (jobs: Order[]) => {
      // Calculate total fee percentage
      const totalFeePercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);

      return jobs.reduce((acc, job) => {
        let jobGross = 0;

        // Calculate Gross per item (Vehicle + Addons)
        if (job.vehicleConfigs && job.vehicleConfigs.length > 0) {
          job.vehicleConfigs.forEach((config: any) => {
            // Package Price
            const pkg = packages.find((p: ServicePackage) => p.id === config.packageId);
            if (pkg && config.vehicleType) {
              jobGross += (pkg.price?.[config.vehicleType] || 0);
            }
            // Addons Price
            if (config.addonIds) {
              config.addonIds.forEach((addonId: string) => {
                const addon = addons.find((a: ServiceAddon) => a.id === addonId);
                if (addon) {
                  jobGross += (addon.price?.[config.vehicleType] || 0);
                }
              });
            }
          });
        } else {
          // Fallback for legacy
          jobGross += (job.price || 0);
        }

        // Apply Fees
        const jobFees = (jobGross * totalFeePercent) / 100;
        const jobNet = jobGross - jobFees;
        // const tip = job.tip || 0; // TIPS REMOVED

        acc.gross += jobGross;
        acc.fees += jobFees;
        acc.netService += jobNet;
        acc.tips += 0;
        acc.totalNet += jobNet;
        return acc;
      }, { gross: 0, fees: 0, netService: 0, tips: 0, totalNet: 0 });
    };

    const totalStats = calculateEarnings(completedJobs);

    // Get current date with time reset to start of day
    const now = new Date();

    // Calculate start of week (Monday)
    const currentWeekStart = new Date(now);
    const day = currentWeekStart.getDay() || 7; // Mon=1 ... Sun=7
    if (day !== 1) {
      currentWeekStart.setHours(-24 * (day - 1));
    }
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYearStart = new Date(now.getFullYear(), 0, 1);

    const getJobDate = (job: Order) => {
      if (job.completedAt) return new Date(job.completedAt);
      const d = new Date(job.date);
      return isNaN(d.getTime()) ? new Date() : d; // Fallback for 'ASAP'
    };

    // Filter by time periods
    const weekStats = calculateEarnings(completedJobs.filter(job => getJobDate(job) >= currentWeekStart));
    const monthStats = calculateEarnings(completedJobs.filter(job => getJobDate(job) >= currentMonthStart));
    const yearStats = calculateEarnings(completedJobs.filter(job => getJobDate(job) >= currentYearStart));

    // Compatibility variables for UI
    const totalEarnings = totalStats.totalNet;
    const totalTips = totalStats.tips;
    const weekEarnings = weekStats.totalNet;
    const monthEarnings = monthStats.totalNet;
    const yearEarnings = yearStats.totalNet;

    // Group jobs by day of week for current week
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekJobs = completedJobs.filter(job => getJobDate(job) >= currentWeekStart);
    const monthJobs = completedJobs.filter(job => getJobDate(job) >= currentMonthStart); // Keep for consistency if needed
    const yearJobs = completedJobs.filter(job => getJobDate(job) >= currentYearStart);

    const dailyEarnings = daysOfWeek.map((day, index) => {
      // Adjusted index for Monday start (0=Mon, ... 6=Sun)
      // getDay(): 0=Sun, 1=Mon...
      // Map getDay() to 0-6 index where 0 is Mon: (day + 6) % 7
      const dayJobs = weekJobs.filter(job => {
        const d = getJobDate(job).getDay();
        const adjustedDay = (d + 6) % 7;
        return adjustedDay === index;
      });
      const stats = calculateEarnings(dayJobs);
      return { day, earnings: stats.totalNet, count: dayJobs.length };
    });

    content = (
      <React.Fragment>
        <div className="flex flex-col h-full bg-background-dark text-white relative washer-dash-container">
          <header className="flex items-center px-4 py-4 border-b border-white/5">
            <button onClick={() => navigate(Screen.WASHER_JOBS)}><span className="material-symbols-outlined">arrow_back_ios_new</span></button>
            <h1 className="flex-1 text-center font-bold text-lg mr-6">{i18n.t('earnings')}</h1>
          </header>

          <div className="flex-1 overflow-y-auto p-4 washer-scroll-area">
            {/* Total Earnings Card */}
            <div className="bg-surface-dark border border-white/10 rounded-2xl p-6 mb-6 shadow-xl">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-2">{i18n.t('total_net_earnings')}</p>
              <p className="text-5xl font-bold text-white mb-4 tracking-tighter">${totalEarnings.toFixed(2)}</p>

              <div className="bg-black/30 rounded-xl p-4 space-y-2 text-sm border border-white/5">
                <div className="flex justify-between text-slate-400">
                  <span>{i18n.t('gross_value')}</span>
                  <span>${totalStats.gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-500/80">
                  <span>{i18n.t('app_commission_deductions')}</span>
                  <span>-${totalStats.fees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-500/80">
                  <span>{i18n.t('tips_100_yours')}</span>
                  <span>+${totalStats.tips.toFixed(2)}</span>
                </div>
                <div className="border-t border-white/5 my-2 pt-2"></div>
                <div className="flex justify-between font-bold text-lg text-white">
                  <span>{i18n.t('your_net_payout')}</span>
                  <span className="text-green-500">${totalStats.totalNet.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Period Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-surface-dark rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 mb-1">{i18n.t('this_week')}</p>
                <p className="text-xl font-bold text-primary">${weekEarnings.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">{weekJobs.length} {i18n.t('jobs')}</p>
              </div>
              <div className="bg-surface-dark rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 mb-1">{i18n.t('this_month')}</p>
                <p className="text-xl font-bold text-primary">${monthEarnings.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">{monthJobs.length} {i18n.t('jobs')}</p>
              </div>
              <div className="bg-surface-dark rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-400 mb-1">{i18n.t('this_year')}</p>
                <p className="text-xl font-bold text-primary">${yearEarnings.toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">{yearJobs.length} {i18n.t('jobs')}</p>
              </div>
            </div>

            {/* Daily Breakdown - Current Week */}
            <div className="bg-surface-dark rounded-xl p-4 border border-white/5 mb-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_view_week</span>
                {i18n.t('weekly_breakdown') || 'Weekly Breakdown'}
              </h3>
              <div className="space-y-2">
                {dailyEarnings.map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`text-sm font-bold w-8 ${day.count > 0 ? 'text-primary' : 'text-slate-600'}`}>{day.day}</span>
                      <div className="flex-1 bg-black/30 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${weekEarnings > 0 ? (day.earnings / weekEarnings) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className={`text-sm font-bold ${day.count > 0 ? 'text-white' : 'text-slate-600'}`}>
                        ${day.earnings.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">{day.count} jobs</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Jobs (Filtered to Current Week) */}
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              {i18n.t('this_weeks_jobs') || "This Week's Jobs"}
            </h3>
            <div className="space-y-3">
              {weekJobs.length === 0 ? (
                <p className="text-slate-500 text-center py-4 italic">No jobs completed this week yet.</p>
              ) : (
                weekJobs.sort((a, b) => getJobDate(b).getTime() - getJobDate(a).getTime()).map((job: Order) => {
                  // Calculate detailed breakdown for this job
                  const totalFeePercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);
                  const basePrice = job.price || 0;
                  const tip = job.tip || 0;
                  const asapFee = (job.time === 'ASAP' || job.date === 'ASAP') ? 10 : 0;
                  const fees = (basePrice * totalFeePercent) / 100;
                  const netEarnings = basePrice - fees + tip;

                  return (
                    <div key={job.id} className="bg-surface-dark rounded-xl p-4 border border-white/5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold">{job.vehicle || 'Vehicle'}</p>
                          <p className="text-sm text-slate-400">{job.service}</p>
                          {job.addons && job.addons.length > 0 && (
                            <p className="text-xs text-slate-500 mt-1">+ {job.addons.join(', ')}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-400">${netEarnings.toFixed(2)}</p>
                          <p className="text-xs text-slate-500">Net Earnings</p>
                        </div>
                      </div>

                      {/* Financial Breakdown */}
                      <div className="bg-black/30 rounded-lg p-3 space-y-1 text-xs mb-2">
                        <div className="flex justify-between text-slate-300">
                          <span>{i18n.t('base_price') || 'Base Price'}</span>
                          <span>${basePrice.toFixed(2)}</span>
                        </div>
                        {asapFee > 0 && (
                          <div className="flex justify-between text-amber-400">
                            <span>{i18n.t('asap_fee') || 'ASAP Fee'}</span>
                            <span>+${asapFee.toFixed(2)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-red-400">
                          <span>Fees ({totalFeePercent}%)</span>
                          <span>-${fees.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-white/10 pt-1 mt-1 flex justify-between text-white font-bold">
                          <span>{i18n.t('your_net') || 'Your Net'}</span>
                          <span className="text-primary">${netEarnings.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {getJobDate(job).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {getJobDate(job).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {job.rating && (
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-yellow-400 filled">star</span>
                            <span>{job.rating}.0</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <ModernNav />
        </div>
      </React.Fragment>
    );
  } else if (screen === Screen.WASHER_PROFILE) {
    content = (
      <React.Fragment>

        <div className="flex flex-col h-full bg-background-dark text-white relative washer-dash-container">
          <header className="flex items-center px-4 py-4 border-b border-white/5">
            <button onClick={() => navigate(Screen.WASHER_JOBS)}><span className="material-symbols-outlined">arrow_back_ios_new</span></button>
            <h1 className="flex-1 text-center font-bold text-lg mr-6">Profile</h1>
          </header>

          <div className="flex-1 overflow-y-auto p-4 washer-scroll-area">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-5xl text-primary">person</span>
              </div>
              <h2 className="text-xl font-bold">{currentWasher?.name || 'Washer'}</h2>
              <p className="text-sm text-slate-400">Washer</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate(Screen.WASHER_SETTINGS)}
                className="w-full bg-surface-dark rounded-xl p-4 border border-white/5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">settings</span>
                  <span>Settings</span>
                </div>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
              <button
                onClick={() => setShowHelpModal(true)}
                className="w-full bg-surface-dark rounded-xl p-4 border border-white/5 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">help</span>
                  <span>{i18n.t('help_support')}</span>
                </div>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
              <button
                onClick={() => {
                  console.log('👤 WasherProfile: Logout button clicked');
                  showConfirm(
                    'Logout',
                    'Are you sure you want to logout?',
                    () => {
                      console.log('🚪 WasherProfile: Logout CONFIRMED');
                      logout();
                    },
                    'danger'
                  );
                }}
                className="w-full bg-surface-dark rounded-xl p-4 border border-white/5 text-left flex items-center justify-between hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-red-500">logout</span>
                  <span className="text-red-500">Logout</span>
                </div>
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
            </div>
          </div>
          <ModernNav />
        </div>
      </React.Fragment>
    );
  } else if (screen === Screen.WASHER_SETTINGS) {
    content = (
      <React.Fragment>
        <div className="flex flex-col h-full bg-background-dark text-white relative washer-dash-container">
          <header className="flex items-center px-4 py-4 border-b border-white/5">
            <button onClick={() => navigate(Screen.WASHER_PROFILE)}>
              <span className="material-symbols-outlined">arrow_back_ios_new</span>
            </button>
            <h1 className="flex-1 text-center font-bold text-lg mr-6">Settings</h1>
          </header>
          <div className="flex-1 overflow-y-auto washer-scroll-area">
            <WasherSettings
              currentUser={currentWasher}
              navigate={navigate}
              updateUserProfile={async (userId, updates) => {
                await updateWasherProfile(updates);
              }}
              logout={logout}
              showToast={(message) => {
                console.log(message);
              }}
              openSupport={openSupport}
            />
          </div>
          <ModernNav />
        </div>
      </React.Fragment>
    );
  }

  const activeJobForChat = selectedJob && ['Assigned', 'En Route', 'Arrived', 'In Progress'].includes(selectedJob.status) ? selectedJob : activeJobs[0] || null;

  return (
    <React.Fragment>
      {content}

      {/* Before Photos Modal */}
      {showBeforePhotosModal && selectedJob && (
        <PhotoCapture
          mode="before"
          orderId={selectedJob.id}
          onPhotosComplete={(photos) => {
            updateOrder(selectedJob.id, {
              status: 'In Progress',
              inProgressAt: Date.now(),
              photos: { ...selectedJob.photos, before: photos }
            });
            setShowBeforePhotosModal(false);
            setBeforePhotos({});
          }}
          onCancel={() => setShowBeforePhotosModal(false)}
        />
      )}

      {/* After Photos Modal */}
      {showCamera && cameraMode === 'after' && selectedJob && (
        <PhotoCapture
          mode="after"
          orderId={selectedJob.id}
          onPhotosComplete={(photos) => {
            updateOrder(selectedJob.id, {
              status: 'Completed',
              completedAt: Date.now(),
              photos: { ...selectedJob.photos, after: photos },
              waitingForClient: true,
              tip: 0 // PAYMENT: Tips removed
            });

            if (selectedJob.clientId) {
              addLoyaltyPoints(selectedJob.clientId).catch(err => {
                console.error('Error adding loyalty points:', err);
              });
            }

            LocationService.stopTracking();
            setShowCamera(false);
            setTempPhotos({});
            triggerNativeHaptic(100); // Success pulse
          }}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* ETA Modal */}
      {showETAModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-dark w-full max-w-xs rounded-2xl p-6 border border-white/10 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">{i18n.t('arrival_estimate') || 'Arrival Estimate'}</h3>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['5', '10', '15', '20'].map(min => (
                <button key={min} onClick={() => setEtaMinutes(min)} className={`py-2 rounded-lg border ${etaMinutes === min ? 'bg-primary border-primary text-white' : 'border-white/10'}`}>{min}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowETAModal(false)} className="flex-1 py-3 text-slate-400">Cancel</button>
              <button onClick={handleETASubmit} className="flex-1 py-3 bg-primary rounded-xl font-bold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Support Chat Client Modal */}
      {isSupportChatOpen && (
        <SupportChatClient
          currentUser={{
            id: currentWasherId,
            name: currentWasher?.name || 'Washer',
            email: currentWasher?.email || '',
            avatar: currentWasher?.avatar
          } as any}
          onClose={() => setIsSupportChatOpen(false)}
        />
      )}

      {/* Client Chat Modal */}
      {showChat && activeJobForChat && (
        <OrderChat
          orderId={activeJobForChat.id}
          currentUserId={currentWasherId}
          currentUserName={currentWasher?.name || 'Washer'}
          otherUserId={activeJobForChat.clientId || ''}
          otherUserName={activeJobForChat.clientName || 'Client'}
          messages={messages}
          sendMessage={sendMessage as any}
          isOpen={showChat}
          onClose={() => { setShowChat(false); setChatManuallyClosed(true); }}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
        type={confirmModal.type}
      />
    </React.Fragment>
  );
};


export const WasherScreens: React.FC<WasherProps> = (props) => {
  const { currentWasherId } = props;

  // Support Chat Real-time Notifications
  const { unreadCount: supportUnreadCount } = useSupportUnread(currentWasherId);

  return (
    <div className="relative h-full">
      <WasherContent
        {...props}
        supportUnreadCount={supportUnreadCount}
      />
    </div>
  );
};
