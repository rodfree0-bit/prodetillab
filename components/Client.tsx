import React, { useState, useEffect, useRef } from 'react';
import { i18n } from '../services/i18n';
import { ConfirmationModal } from './ConfirmationModal';
import { ServiceCatalogModal } from './client/ServiceCatalogModal';
import { UserMenu } from './UserMenu';
import { Screen, Order, OrderStatus, ServicePackage, ServiceAddon, VehicleType, ClientUser, Notification, NotificationType, Message, IssueReport, SavedVehicle } from '../types';
import { AddVehicleModal } from './AddVehicleModal';
import { useToast } from './Toast';
import { FloatingChatButton } from './FloatingChatButton';
import { PaymentModal } from './PaymentModal';
import { TrackingUI } from './TrackingUI';
import { NotificationService } from '../services/NotificationService';
import { LiveMap } from './LiveMap';
import { ChatModal } from './ChatModal';
import { TrackingMap } from './TrackingMap';
import { OrderChat } from './OrderChat';
import { isWithinServiceArea, mockGeocodeZip, calculateLocationSurcharges } from '../utils/location';
import { triggerNativeHaptic, showNativeToast, requestNativeLocation } from '../utils/native';
import { AddressAutocomplete } from './AddressAutocomplete';
import { formatPhoneNumber, parseDurationToMinutes } from '../utils/formatters';
import { SupportChat } from './SupportChat';
import { Skeleton } from './AnimationComponents';
import { SupportChatClient } from './SupportChatClient';
import { CONDITION_QUESTIONS } from '../data/conditionQuestions';
import { db, auth, storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, setDoc, Timestamp, addDoc, arrayUnion } from 'firebase/firestore';
import { useSupportUnread } from '../hooks/useSupportUnread';
import { LoadingSpinner } from './LoadingSpinner';
import { DeleteAccountModal } from './DeleteAccountModal';
import { LegalModal } from './LegalComponents';
import { authService, UserProfile } from '../services/authService';

// Import new screen components
import { VehicleSelectionScreen } from './client/VehicleSelectionScreen';
import { ServiceSelectionScreen } from './client/ServiceSelectionScreen';
import { DateTimeSelectionScreen } from './client/DateTimeSelectionScreen';
import { AddressSelectionScreen } from './client/AddressSelectionScreen';
import { OrderConfirmationScreen } from './client/OrderConfirmationScreen';
import { PaymentMethodsScreen } from './client/PaymentMethodsScreen';
import { LoyaltyProgram } from './LoyaltyProgram';
import { StripeService } from '../services/StripeService';


interface ClientProps {
  screen: Screen;
  navigate: (screen: Screen) => void;
  orders: Order[];
  user: ClientUser;
  packages: ServicePackage[];
  packagesError: string | null;
  addons: ServiceAddon[];
  team: import('../types').TeamMember[];
  vehicleTypes: any[]; // VehicleTypeConfig[] | any[]
  createOrder: (data: Partial<Order>) => Promise<string>;
  updateOrder: (id: string, data: Partial<Order>) => Promise<void>;
  cancelOrder: (id: string, applyFee?: boolean) => Promise<void>;
  newOrderDraft: Partial<Order>;
  setNewOrderDraft: (data: Partial<Order>) => void;
  notifications: Notification[];
  addNotification: (userId: string, title: string, message: string, type: NotificationType, linkTo?: Screen, relatedId?: string) => void;
  messages: Message[];
  sendMessage: (senderId: string, receiverId: string, orderId: string, content: string, type?: 'text' | 'image') => Promise<any>;
  markMessagesAsRead: (orderId: string, userId: string) => Promise<void>;
  createIssue: (issueData: Omit<IssueReport, 'id' | 'timestamp' | 'status'>) => void;
  updateProfile: (updates: any, isSilent?: boolean) => Promise<void>;
  logout: () => void;
  submitOrderRating: (orderId: string, ratingData: { clientRating: number, clientReview: string, tip: number, washerId: string }) => Promise<void>;
  serviceArea: any;
  globalFees: { name: string, percentage: number }[];
  discounts: import('../types').Discount[];
  targetOrderId?: string | null;
  isGoogleMapsLoaded?: boolean;
}

const ClientContent: React.FC<ClientProps> = (props) => {
  // Destructure scalar props that don't need array normalization
  const {
    screen, navigate, user, packagesError,
    createOrder, updateOrder, cancelOrder, newOrderDraft, setNewOrderDraft,
    addNotification, sendMessage, markMessagesAsRead, createIssue, updateProfile, logout,
    submitOrderRating, serviceArea, targetOrderId, isGoogleMapsLoaded
  } = props;

  // --- STABILITY & NORMALIZATION BLOCK (v3.4 FINAL) ---
  // Shadow incoming array props with safe versions using the ORIGINAL names.
  // This makes the entire 2800+ line file stable without manual renaming.
  const orders = Array.isArray(props.orders) ? props.orders : [];
  const packages = Array.isArray(props.packages) ? props.packages : [];
  const addons = Array.isArray(props.addons) ? props.addons : [];
  const team = Array.isArray(props.team) ? props.team : [];
  const vehicleTypes = Array.isArray(props.vehicleTypes) ? props.vehicleTypes : [];
  const notifications = Array.isArray(props.notifications) ? props.notifications : [];
  const messages = Array.isArray(props.messages) ? props.messages : [];
  const globalFees = Array.isArray(props.globalFees) ? props.globalFees : [];
  const discounts = Array.isArray(props.discounts) ? props.discounts : [];

  // Shadow user sub-arrays with safe versions
  const vehicles = user?.savedVehicles || [];
  // Note: cards and addresses are handled as state below to support Stripe/Local updates

  // --- 1. CORE NAVIGATION & VIEWING STATE ---
  const [orderToView, setOrderToView] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // --- 2. RATING & FEEDBACK STATE ---
  const [recentlyRatedOrders, setRecentlyRatedOrders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('recently_rated_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [currentRating, setCurrentRating] = useState(0);
  const [clientReviewText, setClientReviewText] = useState('');
  const [currentTip, setCurrentTip] = useState(0);

  // --- 3. UI VISIBILITY STATE ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showOrderChat, setShowOrderChat] = useState(false);
  const [chatManuallyClosed, setChatManuallyClosed] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [showCustomTipInput, setShowCustomTipInput] = useState(false);
  const [customTip, setCustomTip] = useState('');
  const [selectedTipPct, setSelectedTipPct] = useState<number | null>(null);

  // Derived tracking order
  const activeTrackingOrder = orders.find(o => o.id === trackingOrderId);

  // Deep Linking logic
  useEffect(() => {
    if (targetOrderId && orders.length > 0) {
      const order = orders.find(o => o.id === targetOrderId);
      if (order) {
        console.log('🔗 Client Deep Link: Viewing order', targetOrderId);
        setViewingOrder(order);
      }
    }
  }, [targetOrderId, orders]);

  // --- 4. REAL-TIME SYNC FOR VIEWED ORDER ---
  // Ensure that if the order in the list updates (e.g. status change), 
  // the order being viewed in the detail/rating screen also updates.
  useEffect(() => {
    if (viewingOrder?.id) {
      const updatedOrder = orders.find(o => o.id === viewingOrder.id);
      if (updatedOrder && JSON.stringify(updatedOrder) !== JSON.stringify(viewingOrder)) {
        console.log('🔄 Syncing viewingOrder with live data update', updatedOrder.id);
        setViewingOrder(updatedOrder);
      }
    }
  }, [orders, viewingOrder?.id]);

  // Confirmation Modal State
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

  // Delete Account State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);


  // --- VIRTUAL GUEST GUARD ---
  const handleGuestAction = (actionCallback: () => void) => {
    if ((user as any).isGuest) {
      showToast('Account Required: Please sign in or create an account to use this feature.', 'warning');
      navigate(Screen.LOGIN);
    } else {
      actionCallback();
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await authService.deleteAccount();
      // The authService handles redirect, but we can ensure visual feedback
      showToast('Account deleted', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error deleting account', 'error');
      throw error; // Propagate to modal
    }
  };

  // Monitor Viewed Order for Real-Time Status Changes
  useEffect(() => {
    if (orderToView) {
      const liveOrder = (orders || []).find(o => o.id === orderToView.id);

      if (!liveOrder) {
        setOrderToView(null);
        return;
      }

      if (liveOrder.status === 'Cancelled' && orderToView.status !== 'Cancelled') {
        showNativeToast('Your order has been cancelled.');
      }

      if (JSON.stringify(liveOrder) !== JSON.stringify(orderToView)) {
        setOrderToView(liveOrder);
      }
    }
  }, [orders, orderToView]);

  const [activeTab, setActiveTab] = useState<'services' | 'reviews' | 'portfolio'>('services');

  // Draggable Floating Action Button
  const DraggableFab = ({ onClick, unreadCount }: { onClick: () => void, unreadCount: number }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Handle Dragging
    useEffect(() => {
      const handleMove = (e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        // Calculate new position
        let newX = clientX - startPos.x;
        let newY = clientY - startPos.y;

        // Boundaries
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        newX = Math.max(10, Math.min(newX, maxX));
        newY = Math.max(10, Math.min(newY, maxY));

        setPosition({ x: newX, y: newY });
      };

      const handleUp = () => {
        setIsDragging(false);
      };

      if (isDragging) {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleUp);
      }

      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
      };
    }, [isDragging, startPos]);

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
      // Prevent default to stop scrolling/selection on touch
      // e.preventDefault(); // CAREFUL: This might block click if not handled correctly.
      // Better relies on a small threshold for click vs drag, or simply:

      // Only start drag if it's the left button for mouse
      if ('button' in e && (e as React.MouseEvent).button !== 0) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      setStartPos({ x: clientX - position.x, y: clientY - position.y });
      setIsDragging(true);
    };

    // We need to differentiate between a Drag and a Click
    // Simple heuristic: if we moved significantly, it's a drag.
    // But since we update position live, `onClick` might fire after mouseup.
    // We can track total movement distance.
    const [hasMoved, setHasMoved] = useState(false);
    useEffect(() => {
      if (isDragging) setHasMoved(true);
      else {
        // Reset hasMoved after a short delay to allow onClick to check it?
        // Actually, better to check on MouseUp/Click event if we moved.
        setTimeout(() => setHasMoved(false), 100);
      }
    }, [isDragging]);

    return (
      <button
        ref={buttonRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        onClick={(e) => {
          if (!hasMoved) onClick();
        }}
        style={{
          left: position.x,
          top: position.y,
          touchAction: 'none' // Important for preventing scroll while dragging
        }}
        className={`fixed z - 50 w - 14 h - 14 rounded - full bg - primary text - black shadow - lg flex items - center justify - center transition - transform active: scale - 95 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} `}
      >
        <span className="material-symbols-outlined text-2xl">chat</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-background-dark">
            {unreadCount}
          </span>
        )}
      </button>
    );
  };

  // Removed duplicate ClientScreens definition
  console.log('🎬 ClientScreens RENDERED - user.savedCards:', user?.savedCards);

  // Log user data on mount - BUILD v3.5 FINAL
  useEffect(() => {
    if (user) {
      console.log('👤 USER DATA:', {
        id: user.id || 'no-id',
        name: user.name || 'no-name',
        email: user.email || 'no-email',
        savedCards: user.savedCards || [],
        savedVehicles: user.savedVehicles?.length || 0,
        savedAddresses: user.savedAddresses?.length || 0
      });
    }
  }, [user]);

  const { showToast } = useToast();
  // State for CLIENT_VEHICLE screen (Hoisted to fix React Error #310)
  const [tempSelectedVehicles, setTempSelectedVehicles] = useState<string[]>([]);

  // State for CLIENT_DATE_TIME screen
  const [selectedOption, setSelectedOption] = useState<'asap' | 'scheduled'>('scheduled');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // States for Rescheduling Orders
  const [reschedulingOrder, setReschedulingOrder] = useState<Order | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');

  // State for CLIENT_ADDRESS screen
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Derived state
  console.log('🚗 DEBUG savedVehicles:', {
    type: typeof user.savedVehicles,
    isArray: Array.isArray(user.savedVehicles),
    value: user.savedVehicles,
    length: user.savedVehicles?.length
  });

  // Handler for confirming order
  const handleConfirmOrder = async (finalTotal: number, discount?: import('../types').Discount | null) => {
    console.log('📝 ===== CONFIRMING ORDER WITH STRIPE =====');
    console.log('💰 Final Total to Authorize:', finalTotal);
    if (discount) console.log('🎫 Discount Applied:', discount.code);
    setIsProcessingOrder(true);

    try {
      // 1. Generate the final Order ID immediately
      const docId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)} `;

      // Calculate discount amount for storage
      let discountAmount = 0;
      let totalServiceDuration = 0;

      if (vehicleConfigs || packages) {
        (vehicleConfigs || []).forEach(config => {
          const pkg = (packages || []).find(p => p.id === config.packageId);
          if (pkg?.duration) {
            totalServiceDuration += parseDurationToMinutes(pkg.duration);
          }
          if (config.addonIds && Array.isArray(config.addonIds)) {
            config.addonIds.forEach(aId => {
              const add = (addons || []).find(a => a.id === aId);
              if (add?.duration) {
                totalServiceDuration += parseDurationToMinutes(add.duration);
              }
            });
          }
        });
      }

      if (discount) {
        const subtotalBeforeDiscount = (vehicleConfigs || []).reduce((acc, config) => {
          const pkg = (packages || []).find(p => p.id === config.packageId);
          const vehicle = (vehicles || []).find(v => v.id === config.vehicleId);
          return acc + (pkg?.price?.[vehicle?.type as any] || 0);
        }, 0);

        if (discount.type === 'percentage') {
          discountAmount = (subtotalBeforeDiscount * discount.value) / 100;
        } else {
          discountAmount = discount.value;
        }
      }

      // 2. Prepare order data
      const todayISO = new Date().toISOString().split('T')[0];
      const numVehicles = (vehicleConfigs || []).length;
      const surcharges = calculateLocationSurcharges(
        selectedAddress,
        selectedLocation,
        serviceArea,
        numVehicles
      );

      const orderData: any = {
        id: docId,
        clientId: user.id,
        clientName: user.name,
        vehicleConfigs: vehicleConfigs || [],
        // Legacy fields for backward compatibility
        vehicle: (vehicleConfigs || []).length > 0 ? (vehicleConfigs || [])[0].vehicleModel : '',
        vehicleType: (vehicleConfigs || []).length > 0 ? (vehicleConfigs || [])[0].vehicleType : 'sedan',
        service: (packages || []).find(p => p.id === (vehicleConfigs || [])[0]?.packageId)?.name || '',
        date: selectedOption === 'asap' ? todayISO : selectedDate,
        time: selectedOption === 'asap' ? 'Wash Now' : selectedTime,
        address: selectedAddress,
        location: selectedLocation,
        createdAt: Timestamp.now(),
        price: finalTotal,
        basePrice: finalTotal + discountAmount,
        discountAmount: discountAmount,
        discountId: discount?.id || null,
        discountCode: discount?.code || null,
        totalServiceDuration,
        status: 'Pending' as OrderStatus,
        paymentStatus: 'Pending',
        paymentMethod: selectedPaymentType === 'card' ? 'stripe' : 'cash',
        wealthyAreaPremium: surcharges.wealthyAreaPremium,
        distanceSurcharge: surcharges.distanceSurcharge,
        distanceMiles: surcharges.distanceMiles
      };

      console.log('📦 Saving initial order to Firestore:', docId);
      await setDoc(doc(db, 'orders', docId), orderData);

      // 3. ENFORCE AUTHORIZATION (HOLD) FOR CARD PAYMENTS
      if (orderData.paymentMethod === 'stripe') {
        if (finalTotal > 0) {
          if (!selectedCard) {
            showToast('Please select a payment card first', 'warning');
            navigate(Screen.CLIENT_PAYMENT_METHODS);
            setIsProcessingOrder(false);
            return;
          }

          console.log('💳 Initiating Stripe Authorization Hold...');
          try {
            // Verify funds by placing a hold (will be captured upon completion)
            const authResult = await StripeService.authorizePayment(finalTotal, selectedCard, docId);
            
            // After successful auth, update the doc with payment details
            await updateDoc(doc(db, 'orders', docId), {
              paymentIntentId: authResult,
              paymentStatus: 'Authorized',
              stripePaymentMethodId: selectedCard
            });
            
            orderData.paymentIntentId = authResult;
            orderData.paymentStatus = 'Authorized';
            orderData.stripePaymentMethodId = selectedCard;
          } catch (authError: any) {
            console.error('❌ Stripe Authorization Failed:', authError);
            // If auth fails, we should probably mark the order as Failed or delete it
            await updateDoc(doc(db, 'orders', docId), {
              status: 'Cancelled',
              paymentStatus: 'Failed',
              error: authError.message
            });
            showToast(`Payment Declined: Please try another card or check your funds`, 'error');
            setIsProcessingOrder(false);
            return; // Stop if hold fails
          }
        } else {
          // It's a free order (100% discount)
          console.log('🎁 Free order detected, skipping Stripe authorization');
          await updateDoc(doc(db, 'orders', docId), {
            paymentStatus: 'Paid',
            paymentMethod: 'reward'
          });
          orderData.paymentStatus = 'Paid';
          orderData.paymentMethod = 'reward';
        }
      }

      // 3. ENFORCE USAGE LIMITS & TRACKING
      if (discount && discount.id) {
        console.log('🎫 Updating discount usage tracking for:', discount.id);
        const discountRef = doc(db, 'discounts', discount.id);
        
        const updateData: any = {
          usageCount: increment(1)
        };

        if (discount.singleUsePerClient) {
          updateData.usedBy = arrayUnion(user.id);
        }

        await updateDoc(discountRef, updateData);
      }

      // 4. Native Feedback
      triggerNativeHaptic(70);
      setNewOrderDraft({}); // Clear draft
      showToast('Order created successfully!', 'success');
      navigate(Screen.CLIENT_HOME);
    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      showToast(error.message || 'Error processing order', 'error');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // --- PERSISTENCE: SYNC HANDLED ORDERS ---
  useEffect(() => {
    localStorage.setItem('recently_rated_orders', JSON.stringify(recentlyRatedOrders));
  }, [recentlyRatedOrders]);

  // --- RATING NAVIGATION LOGIC ---
  const orderToRate = (orders || []).find(o => {
    if (o.status !== 'Completed' || o.clientRating || o.rating || recentlyRatedOrders.includes(o.id)) return false;
    const isDebt = o.paymentStatus === 'Failed';
    const isCompletedRecently = o.completedAt && (Date.now() - o.completedAt < 30 * 60 * 1000);
    const isDebtStillValid = isDebt && o.completedAt && (Date.now() - o.completedAt < 48 * 60 * 60 * 1000);
    return isCompletedRecently || isDebtStillValid;
  });

  useEffect(() => {
    if (orderToRate && screen === Screen.CLIENT_HOME) {
      console.log("🚀 Persistence: Auto-navigating to rating screen for order:", orderToRate.id);
      setViewingOrder(orderToRate);
      navigate(Screen.CLIENT_RATING);
    }
  }, [orderToRate, screen, navigate]);

  /* Redirection Guard removed to allow viewing rated orders from history */

  // --- AUTO-CLOSE LOGIC DISABLED ---
  const processedOrdersRef = useRef<Set<string>>(new Set());
  /* Logic disabled per user request */

  const [weather, setWeather] = useState<{ temp: number; description: string; icon: string; recommendation: string } | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await import('../services/WeatherService').then(m => m.WeatherService.getCurrentWeather(0, 0));
        setWeather(data);
      } catch (e) {
        console.error("Failed to load weather", e);
      }
    };
    fetchWeather();
  }, []);

  // --- AUTO-RECOVERY REMOVED (As requested by user to prevent restoration of deleted vehicles) ---

  // Placeholder for state moved to top
  /* UI Visibility states moved to consolidated section at line 120 */

  // Saved Vehicles State
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showServicesCatalog, setShowServicesCatalog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<SavedVehicle | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [successfullyCancelledIds, setSuccessfullyCancelledIds] = useState<string[]>([]);
  const [optimisticOrders, setOptimisticOrders] = useState<Order[]>([]);

  // Cleanup optimistic orders when they appear in real Firestore data
  useEffect(() => {
    if (optimisticOrders.length > 0) {
      const realOrderIds = new Set(orders.map(o => o.id));
      const remainingOptimistic = optimisticOrders.filter(oo => !realOrderIds.has(oo.id));

      if (remainingOptimistic.length !== optimisticOrders.length) {
        setOptimisticOrders(remainingOptimistic);
      }
    }
  }, [orders, optimisticOrders]);

  // Calculate unread messages count for the client
  const messageUnreadCount = (messages || []).filter(m => m.receiverId === user.id && !m.read).length;

  // Reset manually closed flag ONLY if a new message arrives (using ref to avoid loops)
  const prevClientUnreadCountRef = useRef(messageUnreadCount);
  useEffect(() => {
    if (messageUnreadCount > prevClientUnreadCountRef.current) {
      setChatManuallyClosed(false);
    }
    prevClientUnreadCountRef.current = messageUnreadCount;
  }, [messageUnreadCount]);

  // Consolidated Auto-open Chat Logic for Client
  useEffect(() => {
    if (messages.length === 0) return;

    // Auto-open if there are unread messages, chat is not manually closed, and not already open
    if (messageUnreadCount > 0 && !showOrderChat && !chatManuallyClosed) {
      // Find the most recent unread message to identify the order
      const lastUnread = [...messages].reverse().find(m => m.receiverId === user.id && !m.read);

      if (lastUnread) {
        const order = orders.find(o => o.id === lastUnread.orderId);
        // Only auto-open for active orders
        if (order && ['Assigned', 'En Route', 'Arrived', 'In Progress'].includes(order.status)) {
          console.log("📨 Auto-opening chat for order:", order.id);
          setViewingOrder(order);
          setShowOrderChat(true);
          triggerNativeHaptic();
        }
      }
    }
  }, [showOrderChat, chatManuallyClosed, user.id, orders, messageUnreadCount, (messages || []).length]);

  // Mark messages as read when chat is open
  useEffect(() => {
    // Find the order currently being viewed in chat
    const activeOrderInChat = orders.find(o => o.id === viewingOrder?.id);
    // Count unread messages for this specific order and current user
    const chatUnreadCount = activeOrderInChat
      ? (messages || []).filter(m => m.orderId === activeOrderInChat.id && m.receiverId === user.id && !m.read).length
      : 0;

    if (showOrderChat && activeOrderInChat && chatUnreadCount > 0) {
      markMessagesAsRead(activeOrderInChat.id, user.id);
    }
  }, [showOrderChat, viewingOrder?.id, messages, user.id, markMessagesAsRead, orders]);

  const handleEditVehicle = (vehicle: SavedVehicle) => {
    setEditingVehicle(vehicle);
    setShowAddVehicleModal(true);
  };

  const handleAddSavedVehicle = async (vehicleData: { make: string; model: string; year: string; color: string; plate?: string; type: VehicleType }, image: string | null) => {
    try {
      console.log('🚗 Starting vehicle save process...');

      // Prepare vehicle data
      const vehicleMake = String(vehicleData.make || '');
      const vehicleModel = String(vehicleData.model || '');
      const vehicleYear = String(vehicleData.year || '');
      const vehicleColor = String(vehicleData.color || '');
      const vehiclePlate = String(vehicleData.plate || '');
      const vehicleType = String(vehicleData.type || 'sedan');

      // Upload image to Firebase Storage if provided
      let imageUrl: string | null = (editingVehicle?.image) || null; // Fallback to existing if not changed

      console.log('📸 Processing vehicle image. Incoming image value:', image ? (image.startsWith('http') ? 'URL' : 'DataURI') : 'NULL');

      if (image) {
        if (image.startsWith('http')) {
          // It's already a URL, keep it
          console.log('🔗 Keeping existing image URL:', image.substring(0, 50) + '...');
          imageUrl = image;
        } else if (image.startsWith('data:image')) {
          // It's a base64 string (or new file), upload it
          try {
            console.log('📸 NEW IMAGE DETECTED (base64). Starting upload...');
            const vehicleId = editingVehicle?.id || `v_${Date.now()} `;

            const storagePath = `vehicles / ${user.id}/${vehicleId}.jpg`;
            console.log('📂 Storage Path:', storagePath);

            const storageRef = ref(storage, storagePath);

            // Upload base64 image
            console.log('⌛ Uploading string...');
            const uploadResult = await uploadString(storageRef, image, 'data_url');
            console.log('📤 Upload complete. Metadata:', uploadResult.metadata.fullPath);

            // Get download URL
            imageUrl = await getDownloadURL(storageRef);
            console.log('✅ Download URL obtained:', imageUrl);
          } catch (uploadError) {
            console.error('❌ Error during Firebase Storage operation:', uploadError);
            showToast('Warning: Image upload failed, saving vehicle with old/no image', 'warning');
          }
        } else {
          console.warn('⚠️ Image format not recognized (not http and not data:image). Skipping upload.');
        }
      } else {
        console.log('ℹ️ No image provided to save process');
      }

      let allVehicles = [];

      if (editingVehicle) {
        // UPDATE EXISTING VEHICLE
        console.log('🔄 Updating existing vehicle:', editingVehicle.id);

        allVehicles = (user.savedVehicles || []).map(v => {
          if (v.id === editingVehicle.id) {
            return {
              ...v,
              make: vehicleMake,
              model: vehicleModel,
              year: vehicleYear,
              color: vehicleColor,
              plate: vehiclePlate,
              type: vehicleType,
              image: imageUrl || v.image // Keep old image if new upload failed
            };
          }
          return v;
        });

      } else {
        // CREATE NEW VEHICLE
        const vehicleId = `v_${Date.now()}`;
        const existingVehicles = user.savedVehicles || [];
        const isFirstVehicle = existingVehicles.length === 0;

        // DEFENSIVE CHECK: If we have orders but NO vehicles, it's highly suspicious that the profile is stale.
        if (isFirstVehicle && (orders || []).length > 0) {
          console.warn('⚠️ DEFENSIVE: User has orders but 0 saved vehicles. Profile might be stale.');
        }

        const newVehicle = {
          id: vehicleId,
          make: vehicleMake,
          model: vehicleModel,
          year: vehicleYear,
          color: vehicleColor,
          plate: vehiclePlate,
          type: vehicleType,
          isDefault: isFirstVehicle,
          image: imageUrl
        };

        console.log('📦 New vehicle:', newVehicle);
        allVehicles = [...existingVehicles, newVehicle];
      }

      console.log('📤 Sending to Firestore (without base64):', allVehicles.map(v => ({ ...v, image: v.image ? 'URL' : null })));

      // Update directly
      console.log('🔄 Calling updateProfile with savedVehicles...');

      // OPTIMISTIC UPDATE: Update local user state immediately to verify UI responsiveness
      // We rely on the parent (App.tsx) listener to confirm, but this helps debugging.

      await updateProfile({ savedVehicles: allVehicles });

      console.log('✅ SUCCESS!');
      showToast(editingVehicle ? 'Vehicle updated successfully!' : 'Vehicle added successfully!', 'success');
      setShowAddVehicleModal(false);
      setEditingVehicle(null); // Reset editing state

    } catch (error) {
      console.error('❌ FAILED to save vehicle:', error);
      showToast(`Error saving vehicle: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteSavedVehicle = async (vehicleId: string) => {
    showConfirm(
      'Delete Vehicle',
      'Are you sure you want to remove this vehicle?',
      async () => {
        try {
          console.log(`🗑️ Deleting vehicle ${vehicleId}...`);
          const updatedVehicles = (user.savedVehicles || []).filter(v => v.id !== vehicleId);

          if (updatedVehicles.length === (user.savedVehicles || []).length) {
            console.warn('⚠️ Vehicle ID not found in list, nothing to delete.');
          }

          await updateProfile({ savedVehicles: updatedVehicles });
          console.log('✅ Vehicle deleted successfully in Firestore');
          showToast('Vehicle removed', 'success');
        } catch (error) {
          console.error('❌ Error deleting vehicle:', error);
          showToast(`Failed to delete vehicle: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      },
      'danger'
    );
  };




  // Duplicate handleSubmitRating removed. Unified logic in Screen.CLIENT_RATING block.

  // Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<Partial<Order> | null>(null);

  // Cards state — loaded from Stripe on mount, using user profile as initial cache
  const validSavedCards = (user?.savedCards || []).filter(c => c.id.startsWith('pm_') || c.id.startsWith('card_'));
  const [cards, setCards] = useState<any[]>(validSavedCards || []);
  const [selectedCard, setSelectedCard] = useState<string>(validSavedCards?.[0]?.id || '');
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<'card' | 'cash' | null>(null);
  const [previousPaymentScreen, setPreviousPaymentScreen] = useState<Screen | null>(null);

  // --- NAVIGATION TRACKING FOR PAYMENT FLOW ---
  const prevScreenRef = useRef<Screen>(screen);
  useEffect(() => {
    // When entering Payment Methods, record where we came from
    if (screen === Screen.CLIENT_PAYMENT_METHODS) {
      console.log('💳 Navigation: Entered Payment Methods from:', prevScreenRef.current);
      setPreviousPaymentScreen(prevScreenRef.current);
    }
    // Update ref for next transition
    if (screen !== prevScreenRef.current) {
      prevScreenRef.current = screen;
    }
  }, [screen]);

  const fetchStripeCards = async () => {
    try {
      console.log('💳 Fetching cards from Stripe...');
      const stripeCards = await StripeService.listPaymentMethods();
      setCards(stripeCards);

      // SYNC: Update Firestore profile with the valid cards from Stripe
      // This ensures that Android/iOS/Web all see the same valid "cache" 
      // and invalid local IDs are permanently removed from the DB.
      if (user.id) {
        console.log('🔄 Syncing Stripe cards to Firestore User Profile...');
        updateProfile({ savedCards: stripeCards }, true).catch(err =>
          console.warn('⚠️ Failed to sync cards to profile (non-critical):', err)
        );
      }

      // Select first card if none selected
      if (stripeCards.length > 0 && !selectedCard) {
        setSelectedCard(stripeCards[0].id);
      }
    } catch (err) {
      console.warn('Could not fetch Stripe cards:', err);
    }
  };

  useEffect(() => {
    if (user?.id && !user?.isGuest) fetchStripeCards();
  }, [user?.id]);

  const handleAddCardSuccess = () => {
    fetchStripeCards();
    showToast('Card saved successfully! 💳', 'success');
    setShowAddCardForm(false);
    setShowPaymentModal(false);
  };

  const handleDeleteCard = async (id: string) => {
    const cardToDelete = cards.find(c => c.id === id);
    const last4 = cardToDelete?.last4 || '';

    showConfirm(
      'Delete Card',
      `Are you sure you want to delete the card ending in ${last4}?`,
      async () => {
        try {
          console.log(`🗑️ Deleting card ${id}...`);
          showToast('Deleting card...', 'info');
          await StripeService.deletePaymentMethod(id);

          // 1. Update local state immediately
          const updatedCards = cards.filter(c => c.id !== id);
          setCards(updatedCards);
          if (selectedCard === id) {
            setSelectedCard('');
          }

          // 2. IMPORTANT: Sync to Firestore IMMEDIATELY with the filtered list
          // This prevents a slow fetchStripeCards from bringing back the old list
          if (user.id) {
            console.log('🔄 Manually syncing filtered cards to Firestore...');
            await updateProfile({ savedCards: updatedCards });
          }

          showToast('Card removed', 'success');

          // 3. Delay the Stripe fetch to allow indices to update
          // This prevents "zombie" cards appearing if Stripe's list API is slightly behind
          setTimeout(() => {
            fetchStripeCards();
          }, 2000);
        } catch (error: any) {
          console.error('Error removing card:', error);
          showToast(error.message || 'Failed to remove card', 'error');
        }
      },
      'danger'
    );
  };

  const handleReorder = (order: Order) => {
    // 1. Try to reconstruct configs
    let configs = order.vehicleConfigs;

    if (!configs || configs.length === 0) {
      const pkg = packages.find(p => p.name === order.service);
      // Try to match vehicle string "Toyota Camry" to saved vehicle
      const vehicle = vehicles.find(v => v.model === order.vehicle) || vehicles[0];

      if (vehicle && pkg) {
        configs = [{
          vehicleId: vehicle.id,
          vehicleModel: vehicle.model,
          vehicleType: vehicle.type, // Added to match interface
          packageId: pkg.id,
          addonIds: []
        }];
      } else {
        showToast('Cannot reorder this item automatically. Please start a new booking.', 'warning');
        navigate(Screen.CLIENT_VEHICLE);
        return;
      }
    }

    // 2. Set Draft & navigate
    // We assume setVehicleConfigs and setSelectedVehicleIds are in scope (top-level)
    try {
      setVehicleConfigs(configs);
      setSelectedVehicleIds(configs.map(c => c.vehicleId));
    } catch (e) {
      console.warn('State setters error', e);
    }

    setNewOrderDraft({
      ...newOrderDraft,
      vehicleConfigs: configs,
      service: order.service,
      price: order.price
    });

    navigate(Screen.CLIENT_SERVICE_SELECT);
  };



  const unreadCount = (notifications || []).filter(n => !n.read && n.userId === user.id).length;

  // Get active order for chat context
  const activeOrder = (orders || []).find(o => ['Assigned', 'En Route', 'Arrived', 'In Progress'].includes(o.status));
  const activeChatMessages = activeOrder ? (messages || []).filter(m => m.orderId === activeOrder.id) : [];

  // Chat Unread Count (Specific to Chat Messages, not generic notifications if separated, but here we used notifications for messages too)
  // Let's filter notifications for "New Message" related to this order or just use unreadCount for simplicity as per request
  const chatUnreadCount = (notifications || []).filter(n => !n.read && n.userId === user.id && n.title === 'New Message').length;


  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatMessage.trim() || !activeOrder || !activeOrder.washerId) return;

    sendMessage(user.id, activeOrder.washerId, activeOrder.id, chatMessage);
    setChatMessage('');
  };

  // Status Change Notifications
  const prevStatusRef = useRef<Record<string, import('../types').OrderStatus>>({});

  useEffect(() => {
    const activeOrders = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled');

    activeOrders.forEach(order => {
      const prev = prevStatusRef.current[order.id];
      if (prev && prev !== order.status) {
        if (order.status === 'Assigned') {
          showToast(`Washer assigned! ${order.washerName || 'Your washer'} is on the way.`, 'success');
          addNotification(user.id, 'Washer Assigned', `${order.washerName || 'A washer'} has accepted your request.`, 'success', Screen.CLIENT_HOME);
        } else if (order.status === 'En Route') {
          showToast(`Washer is en route!`, 'info');
          addNotification(user.id, 'Washer En Route', `${order.washerName || 'Washer'} is driving to your location.`, 'info', Screen.CLIENT_HOME);
        } else if (order.status === 'Arrived') {
          showToast(`Washer has arrived!`, 'success');
          addNotification(user.id, 'Washer Arrived', 'Please meet the washer or unlock your car.', 'success', Screen.CLIENT_HOME);
        } else if (order.status === 'In Progress') {
          showToast(`Cleaning started!`, 'info');
          addNotification(user.id, 'Cleaning Started', 'The washer has started working on your vehicle.', 'info', Screen.CLIENT_HOME);
        }
      }
      prevStatusRef.current[order.id] = order.status;
    });
  }, [orders, user.id, addNotification, showToast]);

  // Support Chat Component

  const NotificationList = () => (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center md:justify-end md:p-4" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
      <div className="bg-surface-dark w-full h-full md:w-96 md:h-auto md:max-h-[80vh] md:rounded-2xl border-0 md:border border-white/10 shadow-2xl overflow-hidden md:mt-16 flex flex-col mt-4">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
          <h3 className="font-bold text-lg">Notifications</h3>
          <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {((notifications || []).filter(n => n.userId === user.id)).length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.filter(n => n.userId === user.id).map(notification => (
              <div key={notification.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!notification.read ? 'bg-primary/5' : ''}`}>
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

  // ... inside ClientScreens return
  // I need to find where to insert the bell icon. It should be in the header.


  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [profileImage, setProfileImage] = useState(user.avatar || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&q=80');
  const profileInputRef = useRef<HTMLInputElement>(null);

  // Garage State
  const [garageTab, setGarageTab] = useState<'vehicles' | 'addresses'>('vehicles');
  const [addresses, setAddresses] = useState<any[]>([]);

  // Load saved addresses from user profile
  // Load saved addresses from user profile
  // Load saved addresses from user profile
  useEffect(() => {
    // 1. If we have saved addresses in the profile, use them.
    if (user.savedAddresses && user.savedAddresses.length > 0) {
      console.log('📍 Client: Loaded saved addresses from profile', user.savedAddresses);
      setAddresses(user.savedAddresses);
    }
    // 2. If NO saved addresses, but we have a legacy/profile address, MIGRATE IT.
    else if (user.address && user.address.trim() !== '') {
      console.log('📍 Client: No saved addresses found, migrating profile address...');

      const migratedAddress = {
        id: `a_migrated_${Date.now()}`,
        label: 'Home', // Default label
        address: user.address,
        lat: user.addressLat || 0,
        lng: user.addressLng || 0,
        icon: 'home'
      };

      const newAddresses = [migratedAddress];
      setAddresses(newAddresses);

      // Persist this migration immediately so it doesn't happen every time
      updateProfile({ savedAddresses: newAddresses }).catch(err => {
        console.warn('⚠️ Client: Failed to persist migrated address', err);
      });
    }
    // 3. Otherwise, empty list (no more "123 Main St" placeholder)
    else {
      console.log('📍 Client: No addresses found. List is empty.');
      setAddresses([]);
    }
  }, [user.savedAddresses, user.address]); // Add user.address to dependency to trigger migration

  // Add Vehicle/Address Modal State
  // showAddVehicleModal is defined above (line 152)
  const [newVehicle, setNewVehicle] = useState({ make: '', model: '', year: '', color: '', plate: '', type: 'Sedan' as VehicleType });
  const [newVehicleImage, setNewVehicleImage] = useState<string | null>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);

  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address: '', lat: 0, lng: 0 });
  const [isLocating, setIsLocating] = useState(false);

  const handleUseCurrentLocation = () => {
    setIsLocating(true);

    // 1. Try Native Android Bridge
    if (typeof window !== 'undefined' && window.Android?.requestLocation) {
      // Define global callback if not exists
      window.onLocationReceived = (latitude: number, longitude: number) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          setIsLocating(false);
          if (status === 'OK' && results && results[0]) {
            setNewAddress(prev => ({ 
              ...prev, 
              address: results[0].formatted_address,
              lat: latitude,
              lng: longitude
            }));
          } else {
            showToast('Could not find address from location.', 'error');
          }
        });
      };
      window.Android.requestLocation();
      return;
    }

    // 2. Fallback to Web API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        // Use Google Maps Geocoding API to get address
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          setIsLocating(false);
          if (status === 'OK' && results && results[0]) {
            setNewAddress(prev => ({ 
              ...prev, 
              address: results[0].formatted_address,
              lat: latitude,
              lng: longitude
            }));
          } else {
            showToast('Could not find address from location.', 'error');
          }
        });
      }, (error) => {
        setIsLocating(false);
        showToast('Error getting location: ' + error.message, 'error');
      });
    } else {
      setIsLocating(false);
      showToast('Geolocation is not supported by this browser.', 'error');
    }
  };

  // Claim/Support State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimDescription, setClaimDescription] = useState('');
  const [claimImage, setClaimImage] = useState<string | null>(null);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  // Per-Vehicle Service Configuration State
  const [currentVehicleIndex, setCurrentVehicleIndex] = useState(0);
  const [vehicleConfigs, setVehicleConfigs] = useState<Array<{
    vehicleId: string;
    vehicleModel: string;
    vehicleType: VehicleType;
    packageId: string;
    addonIds: string[];
  }>>([]);

  // Date/Time Selection State


  // Profile Edit State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    photo: user.avatar || '/default-avatar.png',
    address: user.address || ''
  });

  // Support Chat Real-time Notifications removed as per request

  // Sync with User Prop
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        photo: user.avatar || prev.photo
      }));
    }
  }, [user]);

  // Vehicle State and Logic



  const handleClaimImageUpload = async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Allow Gallery for clients
        width: 1024
      });

      if (image.dataUrl) {
        setClaimImage(image.dataUrl);
      }
    } catch (error: any) {
      console.error('Error taking claim photo:', error);
    }
  };

  const submitClaim = () => {
    if (!claimDescription.trim()) {
      showToast('Please describe the issue.', 'warning');
      return;
    }

    createIssue({
      clientId: user.id,
      clientName: user.name || 'Client',
      clientEmail: user.email,
      subject: 'Issue reported from Client App',
      description: claimDescription,
      image: claimImage || undefined,
      orderId: activeOrder?.id
    });

    showToast('Report submitted! Our support team will contact you.', 'success');
    setShowClaimModal(false);
    setClaimDescription('');
    setClaimImage(null);
  };




  const handleSaveProfile = async () => {
    try {
      // Geocode address if provided
      let addressData: any = {};
      if (profileData.address && profileData.address.trim()) {
        try {
          const geocoder = new google.maps.Geocoder();
          const result = await new Promise<{ formatted_address: string, lat: number, lng: number }>((resolve, reject) => {
            geocoder.geocode({ address: profileData.address }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                resolve({
                  formatted_address: results[0].formatted_address,
                  lat: location.lat(),
                  lng: location.lng()
                });
              } else {
                reject(new Error('Address validation failed'));
              }
            });
          });

          addressData = {
            address: result.formatted_address,
            addressLat: result.lat,
            addressLng: result.lng
          };
        } catch (geoError) {
          showToast('Could not validate address. Please check and try again.', 'error');
          return;
        }
      }

      await updateProfile({
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        avatar: profileData.photo,
        ...addressData
      });
      showToast('Profile updated successfully!', 'success');
      setShowEditProfileModal(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Failed to update profile', 'error');
    }
  };



  // Simulate Tracking Updates
  const [eta, setEta] = useState(15);
  useEffect(() => {
    if (activeTrackingOrder && activeTrackingOrder.status === 'In Progress') {
      const interval = setInterval(() => {
        setEta((prev) => (prev > 1 ? prev - 1 : 1));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTrackingOrder]);

  const handleProfileImageChange = async () => {
    // 1. Try Capacitor Camera first (Mobile)
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        width: 800
      });

      if (image.dataUrl) {
        processUploadedPhoto(image.dataUrl);
        return;
      }
    } catch (error: any) {
      console.log('Capacitor camera not available or cancelled, trying file input:', error.message);
    }

    // 2. Fallback to hidden file input (Web)
    if (profileInputRef.current) {
      profileInputRef.current.click();
    }
  };

  const processUploadedPhoto = async (dataUrl: string) => {
    try {
      showToast(i18n.t('updating_photo'), 'info');

      // Upload to Firebase Storage
      const storageRef = ref(storage, `avatars/${user.id}/profile.jpg`);
      await uploadString(storageRef, dataUrl, 'data_url');

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update local state
      setProfileImage(downloadURL);
      setProfileData({ ...profileData, photo: downloadURL });

      // Save to Firestore permanently
      await updateProfile({ avatar: downloadURL });

      showToast(i18n.t('photo_updated'), 'success');
    } catch (error) {
      console.error('Error processing photo:', error);
      showToast(i18n.t('photo_upload_failed'), 'error');
    }
  };

  const handleFilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          processUploadedPhoto(event.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleVehicleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewVehicleImage(URL.createObjectURL(e.target.files[0]));
    }
  };



  const handleAddAddress = async (addrData: { label: string, address: string, lat: number, lng: number }) => {
    if (!addrData.label || !addrData.address) {
      showToast('Please provide a label and address', 'warning');
      return false;
    }

    const newAddr = {
      id: `a${Date.now()}`,
      label: addrData.label,
      address: addrData.address,
      lat: addrData.lat,
      lng: addrData.lng,
      icon: addrData.label.toLowerCase().includes('home') ? 'home' :
        addrData.label.toLowerCase().includes('work') ? 'work' : 'location_on'
    };

    const updatedAddresses = [...(user.savedAddresses || []), newAddr];

    try {
      // 1. Update Firestore
      await updateProfile({ savedAddresses: updatedAddresses });
      
      // 2. Update local state immediately for UI response
      setAddresses(updatedAddresses);
      
      // 3. Reset and close modal
      setNewAddress({ label: '', address: '', lat: 0, lng: 0 });
      setShowAddAddressModal(false);
      
      showToast(i18n.t('address_saved'), 'success');
      return true;
    } catch (error) {
      console.error('Error saving address:', error);
      showToast(i18n.t('address_sync_failed'), 'error');
      return false;
    }
  };

  const handleDeleteAddress = async (id: string) => {
    showConfirm(
      i18n.t('delete_address'),
      i18n.t('delete_address_confirm'),
      async () => {
        const updatedAddresses = addresses.filter(a => a.id !== id);
        setAddresses(updatedAddresses);

        try {
          await updateProfile({ savedAddresses: updatedAddresses });
          showToast(i18n.t('address_deleted'), 'success');
        } catch (error) {
          console.error('Error deleting address', error);
          showToast(i18n.t('address_delete_failed'), 'error');
        }
      },
      'danger'
    );
  };



  const handleCancelClick = (orderId: string) => {
    showConfirm(
      i18n.t('cancellation_policy'),
      i18n.t('cancel_fee_warning'),
      () => cancelOrder(orderId),
      'danger'
    );
  };

  const handleSaveClientEdit = () => {
    if (editingOrder) {
      updateOrder(editingOrder.id, {
        date: editingOrder.date,
        time: editingOrder.time,
        address: editingOrder.address
      });
      setEditingOrder(null);
    }
  };

  const handleSelectPackage = (pkg: ServicePackage) => {
    const type = newOrderDraft.vehicleType || 'Sedan';
    const price = pkg.price[type];
    setNewOrderDraft({ service: pkg.name, price: price, addons: [] });
  };

  const handleToggleAddon = (name: string, price: number) => {
    const currentAddons = newOrderDraft.addons || [];
    let newAddons = currentAddons.includes(name) ? currentAddons.filter(a => a !== name) : [...currentAddons, name];
    let newPrice = (newOrderDraft.price || 0) + (currentAddons.includes(name) ? -price : price);
    setNewOrderDraft({ addons: newAddons, price: newPrice });
  };

  const BottomNav = () => (
    <div className="bg-background-dark/95 backdrop-blur-xl border-t border-white/5 p-2 z-20" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {[
          { icon: 'home', label: 'Home', action: () => navigate(Screen.CLIENT_HOME), active: screen === Screen.CLIENT_HOME },
          { icon: 'history', label: 'History', action: () => handleGuestAction(() => navigate(Screen.CLIENT_BOOKINGS)), active: screen === Screen.CLIENT_BOOKINGS || screen === Screen.CLIENT_RATING },
          { icon: 'directions_car', label: 'Garage', action: () => handleGuestAction(() => navigate(Screen.CLIENT_GARAGE)), active: screen === Screen.CLIENT_GARAGE },
          { icon: 'person', label: 'Profile', action: () => navigate(Screen.CLIENT_PROFILE), active: screen === Screen.CLIENT_PROFILE },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 relative group w-16 ${item.active
              ? 'text-primary'
              : 'text-slate-500 hover:text-slate-300'
              }`}
          >
            {/* Active Indicator Bar */}
            {item.active && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-lg shadow-lg shadow-primary/20"></div>
            )}

            {/* Icon */}
            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${item.active
              ? 'bg-primary/20'
              : 'bg-transparent group-hover:bg-white/5'
              }`}>
              <span className={`material-symbols-outlined text-2xl transition-all duration-300 ${item.active
                ? 'filled text-primary'
                : 'text-slate-500 group-hover:text-slate-300'
                }`}>
                {item.icon}
              </span>
            </div>

            {/* Label */}
            <span className={`text-[10px] font-bold relative z-10 transition-all duration-300`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderGlobalModals = () => (
    <>
      <AddVehicleModal
        isOpen={showAddVehicleModal}
        onClose={() => {
          setShowAddVehicleModal(false);
          setEditingVehicle(null); // Clear editing state on close
        }}
        onSave={(data, image) => handleAddSavedVehicle(data, image)}
        onDelete={() => {
          if (editingVehicle) {
            handleDeleteSavedVehicle(editingVehicle.id);
            setShowAddVehicleModal(false);
            setEditingVehicle(null);
          }
        }}
        vehicleTypes={vehicleTypes}
        initialVehicle={editingVehicle}
      />

      {/* Notifications Modal */}
      {showNotifications && <NotificationList />}

      {/* Chat Modal for specific order */}
      {showOrderChat && viewingOrder && (
        <OrderChat
          orderId={viewingOrder.id}
          currentUserId={user.id}
          currentUserName={user.name}
          otherUserId={viewingOrder.washerId!}
          otherUserName={viewingOrder.washerName || 'Washer'}
          messages={messages}
          sendMessage={sendMessage as any}
          isOpen={showOrderChat}
          onClose={() => {
            setShowOrderChat(false);
            setChatManuallyClosed(true);
          }}
        />
      )}

      {/* Support Chat Modal */}
      {showSupportChat && (
        <SupportChatClient
          currentUser={user}
          onClose={() => setShowSupportChat(false)}
        />
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6">
            <h3 className="font-bold text-lg mb-4">{i18n.t('edit_order')}</h3>
            <div className="space-y-3">
              <input type="text" value={editingOrder.date} onChange={(e) => setEditingOrder({ ...editingOrder, date: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" />
              <input type="text" value={editingOrder.time} onChange={(e) => setEditingOrder({ ...editingOrder, time: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" />
              <input type="text" value={editingOrder.address} onChange={(e) => setEditingOrder({ ...editingOrder, address: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditingOrder(null)} className="flex-1 py-2 rounded-lg bg-white/10">{i18n.t('cancel')}</button>
              <button onClick={handleSaveClientEdit} className="flex-1 py-2 rounded-lg bg-primary">{i18n.t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {activeTrackingOrder && (
        <TrackingUI
          activeTrackingOrder={activeTrackingOrder}
          user={user}
          setTrackingOrderId={setTrackingOrderId}
          setShowOrderChat={setShowOrderChat}
          showOrderChat={showOrderChat}
          messages={messages}
          sendMessage={sendMessage}
          updateOrder={updateOrder}
          showNativeToast={showNativeToast}
          submitOrderRating={submitOrderRating}
          navigate={navigate as any}
          packages={packages}
          addons={addons}
          isGoogleMapsLoaded={isGoogleMapsLoaded}
          createIssue={createIssue}
        />
      )}

      {/* Services Catalog Modal */}
      <ServiceCatalogModal
        isOpen={showServicesCatalog}
        onClose={() => setShowServicesCatalog(false)}
        packages={packages}
        addons={addons}
      />

      {/* Reschedule Modal */}
      {reschedulingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => {
                triggerNativeHaptic();
                setReschedulingOrder(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h3 className="font-bold text-xl mb-1 text-white">Reschedule Order</h3>
            <p className="text-sm text-slate-400 mb-6">
              Choose a new date and time. Your 10% discount is already applied (new price: ${reschedulingOrder.price}).
            </p>

            {/* Custom 14-Day Calendar inside Modal */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Select Date</label>
              <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide -mx-2 px-2 snap-x">
                {(() => {
                  const availableDays = [];
                  const today = new Date();
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  
                  for (let i = 0; i < 14; i++) {
                    const date = new Date(today);
                    date.setDate(today.getDate() + i);
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    const localDateString = `${year}-${month}-${day}`;
                    
                    availableDays.push({
                      date: localDateString,
                      dayName: dayNames[date.getDay()],
                      dayNumber: date.getDate(),
                      month: monthNames[date.getMonth()],
                      isToday: i === 0
                    });
                  }
                  
                  return availableDays.map(day => (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => {
                        triggerNativeHaptic();
                        setRescheduleDate(day.date);
                        setRescheduleTime(''); // Reset time when date changes
                      }}
                      className={`min-w-[70px] p-3 rounded-xl border-2 transition-all flex flex-col items-center snap-start ${
                        rescheduleDate === day.date
                          ? 'border-primary bg-primary/20 shadow-blue'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 mb-1">{day.dayName}</span>
                      <span className="text-lg font-bold">{day.dayNumber}</span>
                      <span className="text-[9px] text-slate-500 uppercase">{day.month}</span>
                      {day.isToday && (
                        <span className="text-[9px] text-primary font-bold mt-1">TODAY</span>
                      )}
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Time Slots Selection inside Modal */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Select Time</label>
              {rescheduleDate ? (
                (() => {
                  const slots = [];
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  
                  const todayYear = now.getFullYear();
                  const todayMonth = (now.getMonth() + 1).toString().padStart(2, '0');
                  const todayDay = now.getDate().toString().padStart(2, '0');
                  const todayLocalString = `${todayYear}-${todayMonth}-${todayDay}`;
                  
                  const isTodaySelected = rescheduleDate === todayLocalString;
                  let startHour = 7;
                  
                  if (isTodaySelected) {
                    startHour = currentHour + 1;
                    if (currentMinute > 30) {
                      startHour += 1;
                    }
                  }
                  
                  for (let hour = startHour; hour <= 17; hour++) {
                    const timeSlot00 = `${hour.toString().padStart(2, '0')}:00`;
                    const timeSlot30 = `${hour.toString().padStart(2, '0')}:30`;
                    slots.push(timeSlot00);
                    if (hour < 17) {
                      slots.push(timeSlot30);
                    }
                  }
                  
                  if (slots.length > 0) {
                    return (
                      <div className="max-h-[180px] overflow-y-auto pr-1">
                        <div className="grid grid-cols-3 gap-2">
                          {slots.map(time => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => {
                                triggerNativeHaptic();
                                setRescheduleTime(time);
                              }}
                              className={`p-2.5 rounded-xl border-2 transition-all text-xs font-bold ${
                                rescheduleTime === time
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                        <p className="text-xs text-red-400 font-bold">No slots available for today. Please select another date.</p>
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <p className="text-xs text-slate-400">Please select a date first</p>
                </div>
              )}
            </div>

            {/* Confirm Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerNativeHaptic();
                  setReschedulingOrder(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/15 transition-all text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rescheduleDate || !rescheduleTime || isProcessingOrder}
                onClick={async () => {
                  triggerNativeHaptic();
                  setIsProcessingOrder(true);
                  try {
                    await updateOrder(reschedulingOrder.id, {
                      date: rescheduleDate,
                      time: rescheduleTime,
                      status: 'Pending'
                    });
                    showToast('Order rescheduled successfully!', 'success');
                    setReschedulingOrder(null);
                  } catch (err) {
                    console.error('Reschedule failed', err);
                    showToast('Failed to reschedule order', 'error');
                  } finally {
                    setIsProcessingOrder(false);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 text-white text-sm font-bold shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isProcessingOrder ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Support Floating Button removed */}

      {/* Profile & Settings Modals */}
      {showEditProfileModal ? (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 p-6">
            <h3 className="font-bold text-xl mb-6">{i18n.t('edit_profile')}</h3>
            <div className="space-y-4">
              <div className="flex flex-col items-center mb-4">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-cover bg-center border-4 border-primary" style={{ backgroundImage: `url("${profileData.photo}")` }}></div>
                  <button onClick={handleProfileImageChange} className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:bg-primary-dark shadow-lg border-2 border-surface-dark">
                    <span className="material-symbols-outlined text-sm">photo_camera</span>
                  </button>
                  <input type="file" ref={profileInputRef} onChange={handleFilePhotoChange} accept="image/*" className="hidden" />
                </div>
                <p className="text-xs text-slate-400 mt-2">{i18n.t('click_camera')}</p>
              </div>
              <div><label className="text-xs text-slate-400 uppercase font-bold">{i18n.t('full_name')}</label><input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mt-1 text-white" /></div>
              <div><label className="text-xs text-slate-400 uppercase font-bold">{i18n.t('email_address')}</label><input type="email" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mt-1 text-white" /></div>
              <div><label className="text-xs text-slate-400 uppercase font-bold">{i18n.t('phone_number')}</label><input type="tel" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: formatPhoneNumber(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mt-1 text-white" /></div>
              <div>
                <AddressAutocomplete
                  label={i18n.t('home_address')}
                  value={profileData.address || ''}
                  onChange={addr => setProfileData({ ...profileData, address: addr })}
                  onAddressSelect={(fullAddr) => {
                    setProfileData({ ...profileData, address: fullAddr });
                  }}
                  placeholder={i18n.t('enter_address_placeholder')}
                />
              </div>
              <button onClick={handleSaveProfile} style={{ backgroundColor: '#3b82f6' }} className="w-full hover:brightness-90 h-12 rounded-xl font-bold mt-4 text-white shadow-blue transition-all">{i18n.t('save_changes')}</button>
              <button onClick={() => setShowEditProfileModal(false)} className="w-full text-slate-400 py-2">{i18n.t('cancel')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Address Management Modal */}
      {showAddressModal ? (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl">{i18n.t('my_addresses')}</h3>
              <button onClick={() => setShowAddressModal(false)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>
            <div className="space-y-3 mb-6">
              {(addresses || []).length === 0 ? (
                <div className="text-center py-8 opacity-40">
                  <span className="material-symbols-outlined text-4xl mb-2">location_off</span>
                  <p className="text-sm">No saved addresses</p>
                </div>
              ) : (
                addresses.map(addr => (
                  <div key={addr.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined">{addr.icon || 'location_on'}</span>
                      </div>
                      <div>
                        <p className="font-bold">{addr.label || addr.name || i18n.t('address')}</p>
                        <p className="text-xs text-slate-400 line-clamp-1">{addr.address}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteAddress(addr.id)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={() => {
                setShowAddAddressModal(true);
                setNewAddress({ label: '', address: '', lat: 0, lng: 0 });
              }} 
              className="w-full bg-primary h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined">add</span> {i18n.t('add_new_address')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Add New Address Modal */}
      {showAddAddressModal && (
        <div className="absolute inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-dark w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_location</span>
                {i18n.t('add_new_address')}
              </h3>
              <button 
                onClick={() => setShowAddAddressModal(false)}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 uppercase font-black tracking-widest block mb-2 px-1">Label</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Home', 'Work', 'Other'].map(l => (
                    <button
                      key={l}
                      onClick={() => setNewAddress(prev => ({ ...prev, label: l }))}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        newAddress.label === l 
                          ? 'bg-primary border-primary text-black' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                {newAddress.label === 'Other' && (
                  <input
                    type="text"
                    placeholder="E.g. Girlfriend's House"
                    onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 h-11 mt-2 text-sm focus:border-primary focus:outline-none transition-colors"
                  />
                )}
              </div>

              <div className="relative">
                <AddressAutocomplete
                  label="Street Address"
                  value={newAddress.address}
                  onChange={(val) => setNewAddress(prev => ({ ...prev, address: val }))}
                  onAddressSelect={(address, lat, lng) => {
                    setNewAddress(prev => ({ ...prev, address, lat, lng }));
                  }}
                  placeholder="Enter full address"
                />
                
                <button 
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold text-primary hover:text-primary-light transition-colors py-2"
                >
                  <span className={`material-symbols-outlined text-sm ${isLocating ? 'animate-spin' : ''}`}>
                    {isLocating ? 'sync' : 'my_location'}
                  </span>
                  {isLocating ? 'Locating...' : 'Use Current Location'}
                </button>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowAddAddressModal(false)}
                  className="flex-1 py-4 rounded-2xl font-bold text-slate-400 hover:bg-white/5 transition-colors"
                >
                  {i18n.t('cancel')}
                </button>
                <button 
                  onClick={() => {
                    const addrToSave = {
                      label: newAddress.label || 'Home',
                      address: newAddress.address,
                      lat: (newAddress as any).lat || 0,
                      lng: (newAddress as any).lng || 0
                    };
                    handleAddAddress(addrToSave);
                  }}
                  disabled={!newAddress.address}
                  className="flex-1 py-4 rounded-2xl font-black bg-primary text-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
                >
                  {i18n.t('save_address')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal ? (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 p-6">
            <h3 className="font-bold text-xl mb-4 text-red-400 flex items-center gap-2"><span className="material-symbols-outlined">report_problem</span> {i18n.t('report_issue')}</h3>
            <textarea value={claimDescription} onChange={e => setClaimDescription(e.target.value)} placeholder={i18n.t('describe_problem_placeholder')} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4 text-white h-32 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setShowClaimModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5">{i18n.t('cancel')}</button>
              <button onClick={submitClaim} className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600">{i18n.t('submit_claim')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Loyalty Program Modal */}
      {showLoyaltyModal ? (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-dark border-b border-white/10 p-4 flex justify-between items-center z-10">
              <h3 className="font-bold text-xl">{i18n.t('loyalty_program')}</h3>
              <button onClick={() => setShowLoyaltyModal(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-4">
              <LoyaltyProgram userId={user?.id || ''} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Styled Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
        confirmText={i18n.t('proceed')}
        cancelText={i18n.t('cancel')}
        type={confirmModal.type}
      />

      {/* Delete Account Modal - Added to global modals */}
      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
      />

      {/* Legal Modal (Privacy & Terms) */}
      <LegalModal
        isOpen={!!showLegalModal}
        onClose={() => setShowLegalModal(null)}
        title={showLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
        content={showLegalModal === 'terms' ? 'terms' : 'privacy'}
      />
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handleAddCardSuccess}
        />
      )}

    </>
  );

  // CLIENT_HOME Screen
  if (screen === Screen.CLIENT_HOME) {
    const activeOrder = orders.find(o => ['Pending', 'Assigned', 'En Route', 'Arrived', 'In Progress'].includes(o.status));

    return (
      <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {renderGlobalModals()}
        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-24">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-slate-400 text-sm">{i18n.t('welcome_back')}</p>
              <h1 className="text-2xl font-bold">{(profileData.name || '').split(' ')[0] || i18n.t('user')}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(Screen.CLIENT_PROFILE)} className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-white/10" style={{ backgroundImage: `url("${profileData.photo}")` }}></button>
            </div>
          </div>

          {/* Weather Widget */}
          <div className="bg-gradient-to-br from-blue-600/20 via-cyan-500/20 to-teal-500/20 rounded-2xl p-6 border border-cyan-500/30 mb-8 relative overflow-hidden shadow-2xl backdrop-blur-sm">
            {/* Animated Background Effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-cyan-400 font-bold mb-1 text-sm uppercase tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                    {i18n.t('current_weather')}
                  </p>
                  {weather ? (
                    <>
                      <h2 className="text-5xl font-black text-white mb-1 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{weather.temp}°F</h2>
                      <p className="text-cyan-300 capitalize font-medium">{weather.description}</p>
                    </>
                  ) : (
                    <div className="space-y-2 mt-2">
                      <Skeleton width="120px" height="40px" className="rounded-lg opacity-40" />
                      <Skeleton width="180px" height="16px" className="rounded-md opacity-30" />
                    </div>
                  )}
                </div>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/30 flex items-center justify-center border-2 border-cyan-400/40 shadow-lg shadow-cyan-500/30 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-5xl text-cyan-300">
                    {weather ? weather.icon : 'routine'}
                  </span>
                </div>
              </div>

              {weather?.recommendation && (
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <p className="text-sm text-white/90 italic font-medium">
                    "{weather.recommendation}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reschedule Warning Card */}
          {(() => {
            const rescheduleOrders = orders.filter(o => o.status === 'PendingReschedule');
            return rescheduleOrders.map(order => (
              <div key={order.id} className="relative overflow-hidden rounded-2xl p-5 mb-6 bg-rose-950/20 backdrop-blur-md border border-rose-500/30 shadow-2xl">
                {/* Background neon blur */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>
                <div className="flex gap-4 items-start relative z-10">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                    <span className="material-symbols-outlined text-rose-400">warning</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-rose-300 text-lg mb-1">Order Reschedule Required</h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      Your washer cancelled the order. A 10% discount has been applied to your price (new total: ${order.price}). Please select a new date and time to reschedule.
                    </p>
                    <button
                      onClick={() => {
                        triggerNativeHaptic();
                        setReschedulingOrder(order);
                        setRescheduleDate(order.date);
                        setRescheduleTime(order.time);
                      }}
                      className="bg-gradient-to-r from-rose-500 to-purple-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20"
                    >
                      Reschedule Now
                    </button>
                  </div>
                </div>
              </div>
            ));
          })()}

          {/* Quick Actions */}
          <h2 className="font-bold text-lg mb-3">{i18n.t('quick_actions')}</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => handleGuestAction(() => {
                triggerNativeHaptic();
                setTempSelectedVehicles([]); // Reset selection
                navigate(Screen.CLIENT_VEHICLE);
              })}
              className="bg-surface-dark border border-white/5 p-4 rounded-2xl hover:border-primary/50 transition-all text-left group shadow-lg hover:shadow-primary/5"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary">add</span>
              </div>
              <p className="font-bold text-white">{i18n.t('book_wash')}</p>
              <p className="text-xs text-slate-400 mt-1">{i18n.t('schedule_service')}</p>
            </button>
            <button
              onClick={() => handleGuestAction(() => { triggerNativeHaptic(); navigate(Screen.CLIENT_GARAGE); })}
              className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-2xl hover:border-purple-500/40 transition-all text-left group shadow-lg"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-purple-400">directions_car</span>
              </div>
              <p className="font-bold text-white group-hover:text-purple-200 transition-colors">{i18n.t('my_garage')}</p>
              <p className="text-xs text-purple-400/60 mt-1">{(vehicles || []).length} {i18n.t('vehicles')}</p>
            </button>
          </div>

          {/* Active Order Card - Moved here */}

          {/* Active Orders */}
          <h2 className="font-bold text-lg mb-3">{i18n.t('active_orders')}</h2>
          <div className="space-y-3 mb-6">
            {(() => {
              // Combine Firestore orders with optimistic orders, preventing duplicates
              const activeOrders = [...optimisticOrders, ...orders]
                .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
                .filter(o =>
                  ['Pending', 'Assigned', 'En Route', 'Arrived', 'In Progress', 'PendingReschedule'].includes(o.status) &&
                  !successfullyCancelledIds.includes(o.id)
                );
              return activeOrders.map(order => (
                <div key={order.id} className="bg-surface-dark border border-white/10 rounded-xl p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-1 inline-block">{order.status}</span>
                      <h3 className="font-bold text-base">{order.service}</h3>
                      <p className="text-sm text-slate-300">{order.vehicle}</p>
                    </div>
                    <p className="font-bold">${order.price}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                      {order.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {order.time}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {order.status === 'PendingReschedule' ? (
                      <button
                        onClick={() => {
                          triggerNativeHaptic();
                          setReschedulingOrder(order);
                          setRescheduleDate(order.date);
                          setRescheduleTime(order.time);
                        }}
                        className="flex-1 bg-gradient-to-r from-rose-500 to-purple-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/10"
                      >
                        Reschedule Now
                      </button>
                    ) : (
                      <button onClick={() => setTrackingOrderId(order.id)} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold text-sm shadow-blue hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/10">{i18n.t('order_status')}</button>
                    )}
                    <button
                      disabled={cancellingOrderId === order.id}
                      onClick={() => {
                        const isAssigned = order.status !== 'Pending';
                        const message = isAssigned
                          ? i18n.t('washer_assigned_cancel_warn')
                          : i18n.t('cancel_no_fee_warn');

                        showConfirm(
                          i18n.t('cancel_order'),
                          message,
                          async () => {
                            setCancellingOrderId(order.id);
                            try {
                              // OPTIMISTIC UPDATE: Hide immediately
                              setSuccessfullyCancelledIds(prev => [...prev, order.id]);

                              // Also remove from optimistic list if it exists there
                              setOptimisticOrders(prev => prev.filter(o => o.id !== order.id));

                              await cancelOrder(order.id, isAssigned);
                              showToast(i18n.t('order_cancelled'), 'success');
                            } catch (e) {
                              console.error('Cancel failed', e);
                              showToast(i18n.t('cancel_failed'), 'error');
                              setCancellingOrderId(null);
                              // Revert optimistic update if failed
                              setSuccessfullyCancelledIds(prev => prev.filter(id => id !== order.id));
                            }
                          },
                          'danger'
                        );
                      }}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-bold text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {cancellingOrderId === order.id ? i18n.t('cancelling') : i18n.t('cancel')}
                    </button>
                  </div>
                </div>
              ));
            })()}
            {orders.filter(o => ['Pending', 'Assigned', 'En Route', 'Arrived', 'In Progress', 'PendingReschedule'].includes(o.status)).length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">{i18n.t('no_active_orders')}</p>
            )}
          </div>
        </div>



        <BottomNav />
        {renderGlobalModals()}
      </div>
    );
  }

















  if (screen === Screen.CLIENT_PROFILE) {
    return (
      <div className="flex flex-col h-full bg-background-dark text-white relative" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex-1 overflow-y-auto p-4 pb-32">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{i18n.t('profile')}</h1>
          </div>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-cover bg-center border-2 border-primary" style={{ backgroundImage: `url("${profileData.photo}")` }}></div>
            <div>
              <h2 className="font-bold text-lg">{profileData.name}</h2>
              <p className="text-slate-400">{profileData.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <button onClick={() => handleGuestAction(() => setShowEditProfileModal(true))} className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-400">person</span> <span>{i18n.t('edit_profile')}</span></div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>
            <button onClick={() => handleGuestAction(() => navigate(Screen.CLIENT_GARAGE))} className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-400">garage</span> <span>{i18n.t('my_garage')}</span></div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>
            <button onClick={() => handleGuestAction(() => navigate(Screen.CLIENT_PAYMENT_METHODS))} className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-400">credit_card</span> <span>{i18n.t('payment_methods')}</span></div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>
            <button onClick={() => handleGuestAction(() => setShowAddressModal(true))} className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-400">location_on</span> <span>{i18n.t('my_addresses')}</span></div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>





            {/* Loyalty Program Button */}
            <button onClick={() => handleGuestAction(() => setShowLoyaltyModal(true))} className="w-full bg-gradient-to-r from-amber-500/10 to-purple-500/10 p-4 rounded-xl flex items-center justify-between border border-amber-500/30 hover:border-amber-500/50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-400">stars</span>
                <div className="text-left">
                  <span className="font-bold text-white">{i18n.t('loyalty_program')}</span>
                  <p className="text-xs text-slate-400">{i18n.t('loyalty_desc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-amber-500/20 px-2 py-1 rounded-lg text-amber-500 text-[10px] font-black border border-amber-500/20">
                  {(user?.loyaltyPoints || 0)} {(user?.loyaltyPoints === 1 ? i18n.t('wash') : i18n.t('washes'))}
                </div>
                <span className="material-symbols-outlined text-amber-400">chevron_right</span>
              </div>
            </button>

            {/* Services Button */}
            <button
              onClick={() => setShowServicesCatalog(true)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">inventory_2</span>
                </div>
                <div className="text-left">
                  <p className="font-bold text-white">Full Service Catalog</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Detailed list of all services</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">chevron_right</span>
            </button>

            {/* Contact Support Button */}
            <button onClick={() => handleGuestAction(() => setShowSupportChat(true))} className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 mt-6 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined text-primary">support_agent</span>
                </div>
                <div className="text-left">
                  <span className="text-primary font-bold">{i18n.t('contact_support')}</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-primary">chevron_right</span>
            </button>

            {/* Join Team Button */}
            <button onClick={() => handleGuestAction(() => navigate(Screen.WASHER_REGISTRATION))} className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 mt-4 hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-green-400">work</span>
                <span className="font-bold text-white">{i18n.t('join_team')}</span>
              </div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>

            {/* Manual Push Notifications Request */}
            <button
              onClick={() => {
                import('../services/pushNotificationService').then(m => {
                  m.pushNotificationService.requestPermissionsIfNeeded().then(success => {
                    if (success) showToast(i18n.t('notification_requested'), 'success');
                    else showToast(i18n.t('notification_error'), 'warning');
                  });
                });
              }}
              className="w-full bg-blue-500/10 p-4 rounded-xl flex items-center justify-between border border-blue-500/20 mt-8 hover:bg-blue-500/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-400">notifications_active</span>
                <div className="text-left">
                  <span className="font-bold text-white">{i18n.t('enable_push_notifications')}</span>
                  <p className="text-xs text-slate-400">{i18n.t('stay_updated_push')}</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-blue-400">chevron_right</span>
            </button>

            {/* Privacy Policy */}
            <button
              onClick={() => setShowLegalModal('privacy')}
              className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 mt-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400">gavel</span>
                <span className="font-bold text-white">{i18n.t('privacy_policy')}</span>
              </div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>

            {/* Terms & Conditions */}
            <button
              onClick={() => setShowLegalModal('terms')}
              className="w-full bg-surface-dark p-4 rounded-xl flex items-center justify-between border border-white/5 mt-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400">description</span>
                <span className="font-bold text-white">{i18n.t('terms_conditions')}</span>
              </div>
              <span className="material-symbols-outlined text-slate-500">chevron_right</span>
            </button>

            {/* DELETE ACCOUNT BUTTON - DANGER ZONE (Moved above Logout) */}
            <div className="mt-8 pt-6 border-t border-white/5">
              <button
                onClick={() => {
                  console.log('🔴 Delete Account Clicked');
                  setIsDeleteModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-4 bg-red-500 text-white rounded-2xl transition-all shadow-lg shadow-red-500/20 hover:bg-red-600"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">delete_forever</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white">{i18n.t('delete_account')}</div>
                    <div className="text-xs text-white/80">{i18n.t('delete_account_desc')}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/50">chevron_right</span>
              </button>
            </div>

            {/* Log Out Button */}
            <div className="mt-4">
              <button
                onClick={() => showConfirm(i18n.t('logout'), i18n.t('logout_confirm'), logout)}
                className="w-full flex items-center justify-between p-4 bg-surface-dark border border-white/10 hover:bg-white/5 rounded-2xl transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                    <span className="material-symbols-outlined">logout</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-red-500">{i18n.t('logout')}</div>
                    <div className="text-xs text-white/40">{i18n.t('logout_desc')}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/20">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        <BottomNav />
        {renderGlobalModals()}
      </div>
    );
  }


  // CLIENT_BOOKINGS Screen (History)
  if ((screen as any) === Screen.CLIENT_BOOKINGS) {
    const historicalOrders = orders.filter(o => ['Completed', 'Cancelled'].includes(o.status))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    return (
      <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <header className="flex items-center px-4 py-4 border-b border-white/5 bg-surface-dark/50 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => navigate(Screen.CLIENT_HOME)}><span className="material-symbols-outlined text-slate-400">arrow_back_ios_new</span></button>
          <h1 className="flex-1 text-center font-bold text-lg mr-6">{i18n.t('order_history')}</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {historicalOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
              <span className="material-symbols-outlined text-5xl mb-3">history</span>
              <p className="text-sm font-medium">{i18n.t('no_past_orders')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {historicalOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => {
                    setViewingOrder(order);
                    navigate(Screen.CLIENT_RATING);
                  }}
                  className="bg-surface-dark border border-white/5 rounded-2xl p-4 active:scale-[0.98] transition-all cursor-pointer hover:border-white/10 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${order.status === 'Completed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      <span className="material-symbols-outlined text-2xl">{order.status === 'Completed' ? 'check_circle' : 'cancel'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white truncate">{order.service || (order.vehicleConfigs && order.vehicleConfigs.length > 1 ? `${order.vehicleConfigs.length} Vehicles` : 'Custom Service')}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-400">
                        <span className="font-medium">
                          {new Date(order.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-slate-600">•</span>
                        <div className="flex items-center gap-0.5 min-w-0">
                          <span className="material-symbols-outlined text-[12px] shrink-0 text-slate-500">location_on</span>
                          <span className="truncate max-w-[120px] sm:max-w-[180px]">{order.address?.split(',')?.[0] || i18n.t('address')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <span className="font-black text-white text-base">${(order.price || 0).toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      {(order.clientRating || order.rating) && (
                        <div className="flex items-center gap-0.5 text-amber-500 text-[11px]">
                          <span className="material-symbols-outlined text-xs filled">star</span>
                          <span className="font-bold">{order.clientRating || order.rating}</span>
                        </div>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${order.status === 'Completed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    );
  }


  // CLIENT_RATING Screen (Also serves as Order Details)
  if (screen === Screen.CLIENT_RATING) {
    // Robust selection: 1. already set viewingOrder, 2. most recent unrated, 3. fallback to most recent order
    const mostRecentUnrated = (orders || []).find(o => o.status === 'Completed' && !(o.clientRating || o.rating) && !recentlyRatedOrders.includes(o.id));
    const mostRecentOrder = orders.length > 0 ? orders[0] : null;
    const orderToView = viewingOrder || mostRecentUnrated || mostRecentOrder;

    if (!orderToView) {
      return (
        <div className="flex flex-col h-full bg-background-dark text-white items-center justify-center p-4">
          <div className="text-center opacity-40 mb-6">
            <span className="material-symbols-outlined text-6xl mb-4">manage_search</span>
            <p className="font-bold">{i18n.t('no_order_details')}</p>
          </div>
          <button 
            onClick={() => navigate(Screen.CLIENT_HOME)} 
            className="bg-primary text-black px-8 py-3 rounded-xl font-bold"
          >
            {i18n.t('go_home')}
          </button>
        </div>
      );
    }

    const actualSubtotal = orderToView.basePrice || orderToView.price || 0;
    const discountAmountTotal = orderToView.discountAmount || 0;
    const finalBillTotal = orderToView.price || 0;
    const isRated = !!(orderToView.clientRating || orderToView.rating);
    const existingTip = orderToView.tip || 0;

    // State for rating flow - Initialize with existing or defaults
    // Note: detailed state management is lifted up to ClientScreens logic if needed, but local state works for this form
    // PAYMENT: Tip removed, total is just the base price
    const totalWithTip = finalBillTotal;

    const handleTipSelect = (pct: number) => {
      if (isRated) return;
      const tipAmount = actualSubtotal * pct;
      setCurrentTip(tipAmount);
      setShowCustomTipInput(false);
      setCustomTip('');
    };

    const handleCustomTipChange = (e: any) => {
      if (isRated) return;
      const val = e.target.value;
      setCustomTip(val);
      setCurrentTip(parseFloat(val) || 0);
    };

    const submitRating = async () => {
      console.log('⭐ Submit Rating Clicked');

      if (isRated) {
        console.log('Already rated, navigating home');
        navigate(Screen.CLIENT_BOOKINGS);
        return;
      }

      console.log('Submitting rating:', {
        orderId: orderToView.id,
        rating: currentRating || 5,
        review: clientReviewText,
        tip: currentTip
      });

      try {
        if (!submitOrderRating) {
          console.error('submitOrderRating function is missing!');
          showToast(i18n.t('internal_error_rating'), 'error');
          return;
        }

        setIsSubmittingRating(true);
        await submitOrderRating(orderToView.id, {
          clientRating: currentRating || 5, // Fallback to 5 stars
          clientReview: clientReviewText.trim(),
          tip: currentTip,
          washerId: orderToView.washerId || ''
        });

        console.log('✅ Rating submitted successfully');
        showToast(i18n.t('thank_you_feedback'), 'success');

        // Mark ALL currently unrated orders as "handled" IMMEDIATELY
        const allUnratedIds = (orders || []).filter(o => o.status === 'Completed' && !(o.clientRating || o.rating)).map(o => o.id);
        const nextHandled = [...new Set([...recentlyRatedOrders, orderToView.id, ...allUnratedIds])];
        
        // Sync to state AND local storage immediately to beat any race conditions
        setRecentlyRatedOrders(nextHandled);
        localStorage.setItem('recently_rated_orders', JSON.stringify(nextHandled));

        // Reset local rating state
        setCurrentRating(0);
        setClientReviewText('');
        setCurrentTip(0);
        setViewingOrder(null);

        // Navigate back to home
        console.log('🏠 Navigation: Rating complete, returning home');
        navigate(Screen.CLIENT_HOME);

        // Redirect to Google Maps if 5-star review is submitted to help rank #1 in LA
        const reviewUrl = import.meta.env.VITE_GOOGLE_REVIEW_URL;
        if ((currentRating === 5 || !currentRating) && reviewUrl && !reviewUrl.includes('YOUR_GOOGLE_PLACE_ID')) {
          setTimeout(() => {
            showToast('Redirecting to Google Reviews... Help us rank #1 in LA!', 'success');
            window.open(reviewUrl, '_blank');
          }, 1500);
        }

      } catch (error) {
        console.error('Error submitting rating:', error);
        showToast(i18n.t('review_submit_error'), 'error');
      } finally {
        setIsSubmittingRating(false);
      }
    };

    return (
      <div className="fixed inset-0 flex flex-col bg-black text-white z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <button
              onClick={() => {
                setViewingOrder(null);
                navigate(isRated ? Screen.CLIENT_BOOKINGS : Screen.CLIENT_HOME);
              }}
              className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
            </button>
            <p className="text-sm font-semibold text-slate-300">{i18n.t('order_summary')}</p>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
              orderToView.status === 'Completed'  ? 'bg-green-500/10 text-green-400 border-green-500/20' :
              orderToView.status === 'Cancelled'  ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              'bg-primary/10 text-primary border-primary/20'
            }`}>
              {orderToView.status}
            </div>
          </div>

          {/* Order ID + Client line */}
          <div className="px-5 mb-6">
            <p className="text-base font-semibold tracking-tight">#{orderToView.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-slate-500 text-sm mt-0.5">{orderToView.date} · {orderToView.time}</p>
          </div>

          {/* Section: Location */}
          <div className="mx-5 mb-3 bg-white/4 border border-white/8 rounded-2xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-slate-500 text-lg mt-0.5">location_on</span>
            <p className="text-white text-sm leading-relaxed">{orderToView.address}</p>
          </div>

          {/* Section: Vehicle & Services */}
          <div className="mx-5 mb-3 bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Services</p>
            </div>
            {orderToView.vehicleConfigs && orderToView.vehicleConfigs.length > 0 ? (
              orderToView.vehicleConfigs.map((config: any, idx: number) => {
                const pkg = packages.find(p => p.id === config.packageId);
                const vehicleType = config.vehicleType || 'sedan';
                const pkgPrice = pkg?.price?.[vehicleType] || 0;
                const selectedAddons = (addons || []).filter((a: any) => config.addonIds?.includes(a.id));
                const addonsTotal = selectedAddons.reduce((sum: number, a: any) => sum + (a.price?.[vehicleType] || a.price || 0), 0);
                return (
                  <div key={idx} className="px-4 pb-4 border-b border-white/5 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-white text-sm">{config.vehicleModel}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{pkg?.name || 'Standard Wash'}</p>
                      </div>
                      <p className="font-semibold text-white text-sm">${(pkgPrice + addonsTotal).toFixed(2)}</p>
                    </div>
                    {selectedAddons.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {selectedAddons.map((addon: any) => (
                          <p key={addon.id} className="text-xs text-slate-500">+ {addon.name}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-4 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-white text-sm">{orderToView.vehicle}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{orderToView.service}</p>
                  </div>
                  <p className="font-semibold text-white text-sm">${(orderToView.price || 0).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section: Financial Summary */}
          <div className="mx-5 mb-3 bg-white/4 border border-white/8 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-white">${(actualSubtotal).toFixed(2)}</span>
            </div>
            {discountAmountTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-400">{i18n.t('discount_applied')}</span>
                <span className="text-green-400">-${discountAmountTotal.toFixed(2)}</span>
              </div>
            )}
            {(orderToView.tip || currentTip || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tip</span>
                <span className="text-emerald-400">+${(orderToView.tip || currentTip || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-white font-bold">Total</span>
              <span className="text-white font-black text-lg">${(finalBillTotal + (orderToView.tip || currentTip || 0)).toFixed(2)}</span>
            </div>
          </div>

          {/* Section: Before/After Photos */}
          {(() => {
            const before = orderToView.photos?.before as { front?: string } | undefined;
            const after = orderToView.photos?.after as { front?: string } | undefined;
            if (!before?.front && !after?.front) return null;
            return (
              <div className="mx-5 mb-3 bg-white/4 border border-white/8 rounded-2xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{i18n.t('before_after')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {before?.front && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">{i18n.t('before')}</p>
                      <div className="aspect-square rounded-xl overflow-hidden border border-white/10">
                        <img src={before.front} alt="Before" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  {after?.front && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">{i18n.t('after')}</p>
                      <div className="aspect-square rounded-xl overflow-hidden border border-green-500/30">
                        <img src={after.front} alt="After" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Section: Tip Selection (only if not yet rated) */}
          {!isRated && (
            <div className="mx-5 mb-3 bg-white/4 border border-white/8 rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">
                {i18n.t('add_tip')}
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[10, 15, 25].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                        setSelectedTipPct(pct);
                        const tipAmt = actualSubtotal * (pct / 100);
                        setCurrentTip(tipAmt);
                        setShowCustomTipInput(false);
                    }}
                    className={`py-3 rounded-xl font-black transition-all border ${selectedTipPct === pct ? 'bg-primary border-primary text-white shadow-blue' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    {pct}%
                    <p className="text-[9px] font-bold opacity-60">+${(actualSubtotal * (pct / 100)).toFixed(2)}</p>
                  </button>
                ))}
              </div>
              
              {!showCustomTipInput ? (
                <button 
                  onClick={() => setShowCustomTipInput(true)}
                  className="w-full py-2 text-xs font-bold text-primary hover:underline"
                >
                  {i18n.t('custom_tip')}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customTip}
                    onChange={handleCustomTipChange}
                    placeholder={i18n.t('enter_tip_amount')}
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-primary/50"
                  />
                  <button 
                    onClick={() => {
                        setShowCustomTipInput(false);
                        setCustomTip('');
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-500"
                  >
                    {i18n.t('cancel')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Section: Rating */}
          <div className="mx-5 mb-3 bg-white/4 border border-white/8 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">
              {isRated ? i18n.t('your_rating') : (currentRating <= 4 && currentRating > 0 ? i18n.t('low_rating_header') : i18n.t('rate_experience'))}
            </p>
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map((star) => {
                const isSelected = star <= (isRated ? (orderToView.clientRating || orderToView.rating || 0) : currentRating);
                return (
                  <button 
                    key={star} 
                    onClick={() => !isRated && setCurrentRating(star)} 
                    disabled={isRated}
                    className={`transition-all ${!isRated ? 'active:scale-95' : 'cursor-default'}`}
                  >
                    <span className={`material-symbols-outlined text-4xl ${isSelected ? 'text-primary filled' : 'text-slate-600'}`}>star</span>
                  </button>
                );
              })}
            </div>
            {!isRated && currentRating > 0 && (
              <textarea
                value={clientReviewText}
                onChange={(e) => setClientReviewText(e.target.value)}
                placeholder={currentRating <= 4 ? i18n.t('how_can_we_improve') : i18n.t('share_feedback_placeholder')}
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white text-sm resize-none h-20 focus:border-primary/50 outline-none transition-all"
              />
            )}
            {isRated && (orderToView.clientReview || orderToView.review) && (
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-xs text-slate-400 italic">"{orderToView.clientReview || orderToView.review}"</p>
              </div>
            )}
          </div>

          {/* Already rated badge */}
          {isRated && (
            <div className="mx-5 mb-3 bg-green-500/8 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-400">check_circle</span>
              <p className="text-green-400 text-sm font-semibold">{i18n.t('thank_you_feedback')}</p>
            </div>
          )}

          <div className="h-32" /> {/* Spacer for footer */}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 w-full bg-black/90 backdrop-blur-xl border-t border-white/10 p-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}>
          {!isRated ? (
            <button
              onClick={submitRating}
              disabled={isSubmittingRating}
              className="w-full py-4 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-base transition-all disabled:opacity-50 shadow-blue"
            >
              {isSubmittingRating ? i18n.t('submitting') : i18n.t('submit_review')}
            </button>
          ) : (
            <button
              onClick={() => {
                setViewingOrder(null);
                navigate(Screen.CLIENT_BOOKINGS);
              }}
              className="w-full py-4 bg-white/8 hover:bg-white/15 text-white font-bold rounded-2xl border border-white/10"
            >
              {i18n.t('back_to_history')}
            </button>
          )}
        </div>

        {renderGlobalModals()}
      </div>
    );
  }



  // PAYMENT: CLIENT_PAYMENT Screen - COMMENTED OUT (Payment screen is skipped)
  /*
  if ((screen as any) === Screen.CLIENT_PAYMENT) {
    return (
      <div className="flex flex-col h-full bg-background-dark text-white">
        <header className="flex items-center px-4 py-4 border-b border-white/5">
          <button onClick={() => navigate(Screen.CLIENT_SERVICE_SELECT)}><span className="material-symbols-outlined">arrow_back_ios_new</span></button>
          <h1 className="flex-1 text-center font-bold text-lg mr-6">Payment Method</h1>
        </header>
   
        <div className="flex-1 overflow-y-auto p-4 pb-32">
          <h2 className="text-sm text-slate-400 uppercase font-bold mb-4">Select Payment Method</h2>
   
          <div className="space-y-3 mb-6">
            {(cards || []).map(card => (
              <button
                key={card.id}
                onClick={() => setSelectedCard(card.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all ${selectedCard === card.id
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCard === card.id ? 'border-primary' : 'border-slate-500'
                    }`}>
                    {selectedCard === card.id && <div className="w-3 h-3 rounded-full bg-primary"></div>}
                  </div>
                  <div className="w-10 h-6 bg-white/10 rounded flex items-center justify-center text-xs font-bold">{card.brand}</div>
                  <div className="flex-1 text-left">
                    <p className="font-bold">•••• {card.last4}</p>
                    <p className="text-xs text-slate-400">Expires {card.expiry}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
   
          <button onClick={() => setShowPaymentModal(true)} className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-slate-400 hover:border-primary hover:text-primary transition-colors">
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">add</span>
              <span className="font-bold">Add New Card</span>
            </div>
          </button>
        </div>
   
        <div className="absolute bottom-0 w-full bg-surface-dark border-t border-white/5 p-4 pb-[calc(1rem)]">
          <button
            onClick={() => navigate(Screen.CLIENT_CONFIRM)}
            className="w-full h-14 bg-primary rounded-xl font-bold text-lg hover:bg-primary-dark transition-colors"
          >
            Continue to Confirm
          </button>
        </div>
      </div>
    );
  }
  */




  // CLIENT_REPORT_ISSUE Screen
  if (screen === Screen.CLIENT_REPORT_ISSUE) {
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [selectedOrderId, setSelectedOrderId] = useState('');

    const handleSubmitIssue = () => {
      if (!subject.trim() || !description.trim()) {
        showToast(i18n.t('fill_all_fields'), 'warning');
        return;
      }

      const issueData: any = {
        clientId: user.id,
        clientName: user.name,
        clientEmail: user.email,
        subject,
        description
      };

      // Only add orderId if it exists
      if (selectedOrderId) {
        issueData.orderId = selectedOrderId;
      }

      createIssue(issueData);

      showToast(i18n.t('issue_reported_success'), 'success');
      navigate(Screen.CLIENT_PROFILE);
    };

    return (
      <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <header className="flex items-center px-4 py-4 border-b border-white/5">
          <button onClick={() => navigate(Screen.CLIENT_PROFILE)} className="w-10 h-10 flex items-center justify-center -ml-2">
            <span className="material-symbols-outlined text-2xl">chevron_left</span>
          </button>
          <h1 className="flex-1 text-center font-bold text-lg mr-8">{i18n.t('report_issue')}</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <div className="space-y-4">
            <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{i18n.t('subject')}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={i18n.t('subject_placeholder')}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{i18n.t('related_order_optional')}</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              >
                <option value="">{i18n.t('select_order_placeholder')}</option>
                {(orders || []).map(o => (
                  <option key={o.id} value={o.id}>
                    {new Date(o.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()} - {o.vehicleName || i18n.t('vehicle')} ({o.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{i18n.t('description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={i18n.t('describe_issue_placeholder')}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white placeholder:text-slate-500 min-h-[150px] focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-surface-dark">
          <button
            onClick={handleSubmitIssue}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">send</span>
            {i18n.t('submit_report')}
          </button>
        </div>
        <BottomNav />
        {renderGlobalModals()}
      </div>
    );
  }

  if ((screen as any) === Screen.CLIENT_VEHICLE) {
    return (
      <>
        {renderGlobalModals()}
        <VehicleSelectionScreen
          vehicles={vehicles}
          tempSelectedVehicles={tempSelectedVehicles}
          setTempSelectedVehicles={setTempSelectedVehicles}
          setVehicleConfigs={setVehicleConfigs}
          setSelectedVehicleIds={setSelectedVehicleIds}
          setCurrentVehicleIndex={setCurrentVehicleIndex}
          navigate={navigate}
          setShowAddVehicleModal={(show) => {
            console.log('🚗 VehicleSelectionScreen: setShowAddVehicleModal called with:', show);
            if (show) {
              console.log('🔄 Resetting editingVehicle to null for new vehicle');
              setEditingVehicle(null); // Reset edit state when opening "Add New"
            }
            setShowAddVehicleModal(show);
          }}
          showToast={showToast}
          onEdit={(vehicle) => {
            console.log('✏️ VehicleSelectionScreen: onEdit called with vehicle:', vehicle);
            handleEditVehicle(vehicle);
          }}
        />
      </>
    );
  }

  // CLIENT_GARAGE Screen
  if ((screen as any) === Screen.CLIENT_GARAGE) {
    return (
      <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {renderGlobalModals()}
        <header className="flex items-center px-4 py-4 border-b border-white/5 bg-surface-dark/50 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => navigate(Screen.CLIENT_HOME)}><span className="material-symbols-outlined text-slate-400">arrow_back_ios_new</span></button>
          <h1 className="flex-1 text-center font-bold text-lg mr-6">{i18n.t('my_garage')}</h1>
          <button onClick={() => {
            setEditingVehicle(null);
            setShowAddVehicleModal(true);
          }}><span className="material-symbols-outlined text-primary">add</span></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 pb-24">
          {(vehicles || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 opacity-60">
              <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">no_crash</span>
              <p className="text-slate-400 font-medium">{i18n.t('garage_empty')}</p>
              <p className="text-xs text-slate-500 mt-2">{i18n.t('add_first_vehicle')}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {(vehicles || []).map((v) => (
                <div key={v.id} className="relative group overflow-hidden rounded-2xl bg-surface-dark border border-white/5 shadow-2xl transition-all hover:scale-[1.02] hover:shadow-primary/10 hover:border-primary/30">
                  {/* Vehicle Image / Placeholder */}
                  <div className="aspect-video w-full bg-black/60 relative flex items-center justify-center overflow-hidden">
                    {v.image ? (
                      <img src={v.image} alt={v.model} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      // PREMIUM SVG PLACEHOLDER (No external URLs)
                      <div className="flex flex-col items-center justify-center opacity-20 w-full h-full p-8">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
                          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.29 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 6.5H17.5L18.5 9.5H5.5L6.5 6.5ZM19 17H5V12L5.5 11H18.5L19 12V17Z" fill="currentColor" />
                          <path d="M7.5 16C8.32843 16 9 15.3284 9 14.5C9 13.6716 8.32843 13 7.5 13C6.67157 13 6 13.6716 6 14.5C6 15.3284 6.67157 16 7.5 16Z" fill="currentColor" />
                          <path d="M16.5 16C17.3284 16 18 15.3284 18 14.5C18 13.6716 17.3284 13 16.5 13C15.6716 13 15 13.6716 15 14.5C15 15.3284 15.6716 16 16.5 16Z" fill="currentColor" />
                        </svg>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-transparent to-transparent"></div>
                  </div>

                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-xl font-bold text-white mb-0.5">{v.model}</h3>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-0">{v.make || 'Vehicle'} • {v.color || 'Custom'}</p>

                    <div className="flex justify-between items-end mt-4">
                      <div className="px-3 py-1 rounded bg-white/5 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-slate-400 uppercase">
                        {v.type.replace('_', ' ')}
                      </div>
                      <span className="material-symbols-outlined text-slate-600">garage</span>
                    </div>
                  </div>

                  {/* Edit Action - Full Click */}
                  <button
                    onClick={() => {
                      setEditingVehicle(v);
                      setShowAddVehicleModal(true);
                    }}
                    className="absolute inset-0 z-10"
                  ></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    );
  }

  // CLIENT_SERVICE_SELECT Screen (MISSING - causes blue screen)
  if ((screen as any) === Screen.CLIENT_SERVICE_SELECT) {
    return (
      <ServiceSelectionScreen
        packages={packages}
        packagesError={packagesError}
        addons={addons}
        vehicles={vehicles}
        selectedVehicleIds={selectedVehicleIds}
        currentVehicleIndex={currentVehicleIndex}
        vehicleConfigs={vehicleConfigs}
        setVehicleConfigs={setVehicleConfigs}
        setCurrentVehicleIndex={setCurrentVehicleIndex}
        navigate={navigate}
        showToast={showToast}
      />
    );
  }

  // CLIENT_DATE_TIME Screen
  if ((screen as any) === Screen.CLIENT_DATE_TIME) {
    console.log('🕐 Rendering CLIENT_DATE_TIME screen');
    console.log('📅 States:', { selectedOption, selectedDate, selectedTime });

    try {
      return (
        <DateTimeSelectionScreen
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedTime={selectedTime}
          setSelectedTime={setSelectedTime}
          navigate={navigate}
          showToast={showToast}
          orders={orders}
          team={team}
          packages={packages}
          addons={addons}
          vehicleConfigs={vehicleConfigs}
        />
      );
    } catch (error) {
      console.error('❌ Error rendering DateTimeSelectionScreen:', error);
      return (
        <div className="flex flex-col h-full bg-background-dark text-white items-center justify-center p-4">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
          <h1 className="text-2xl font-bold mb-2">{i18n.t('error_loading_screen')}</h1>
          <p className="text-slate-400 text-center mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <button
            onClick={() => navigate(Screen.CLIENT_VEHICLE)}
            className="bg-primary px-6 py-3 rounded-xl font-bold"
          >
            {i18n.t('go_back')}
          </button>
        </div>
      );
    }
  }

  // CLIENT_ADDRESS Screen
  if ((screen as any) === Screen.CLIENT_ADDRESS) {
    console.log('📍 Rendering CLIENT_ADDRESS screen. Addresses:', addresses, 'User Address:', user.address);
    return (
      <>
        {renderGlobalModals()}
        <AddressSelectionScreen
          selectedAddress={selectedAddress}
          setSelectedAddress={setSelectedAddress}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          navigate={navigate}
          showToast={showToast}
          savedAddresses={addresses}
          userAddress={user.address}
          onSaveAddress={handleAddAddress}
          onDeleteAddress={handleDeleteAddress}
          serviceArea={serviceArea}
        />
      </>
    );
  }

  // CLIENT_PAYMENT_METHODS Screen - Payment Methods Management
  if ((screen as any) === Screen.CLIENT_PAYMENT_METHODS) {
    return (
      <>
        {renderGlobalModals()}
        <PaymentMethodsScreen
          savedCards={cards}
          selectedCardId={selectedCard}
          onSelectCard={setSelectedCard}
          onDeleteCard={handleDeleteCard}
          onAddCard={() => setShowPaymentModal(true)}
          navigate={navigate}
          isFromProfile={previousPaymentScreen === Screen.CLIENT_PROFILE}
          selectedPaymentType={selectedPaymentType}
          onSelectPaymentType={setSelectedPaymentType}
          i18n={i18n}
        />
      </>
    );
  }


  // CLIENT_CONFIRM Screen
  if ((screen as any) === Screen.CLIENT_CONFIRM) {
    return (
      <>
        {renderGlobalModals()}
        <OrderConfirmationScreen
          packages={packages}
          addons={addons}
          vehicles={vehicles}
          vehicleConfigs={vehicleConfigs}
          selectedOption={selectedOption}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          selectedAddress={selectedAddress}
          globalFees={globalFees}
          discounts={discounts}
          onConfirmOrder={handleConfirmOrder}
          navigate={navigate}
          selectedLocation={selectedLocation}
          serviceArea={serviceArea}
          showFeesToClient={false}
          selectedCard={(() => {
            const currentCards = cards || [];
            const fallbackCards = (user?.savedCards || []).filter(c => c.id.startsWith('pm_') || c.id.startsWith('card_'));
            const allCards = currentCards.length > 0 ? currentCards : fallbackCards;
            const cardId = selectedCard || fallbackCards?.[0]?.id;
            return allCards.find(c => c.id === cardId) || allCards[0] || null;
          })()}
          selectedPaymentType={selectedPaymentType || 'cash'}
          onAddCard={() => navigate(Screen.CLIENT_PAYMENT_METHODS)}
          userId={user.id}
          userEmail={user.email}
          isFirstOrder={orders.filter(o => o.status === 'Completed').length === 0}
          isProcessing={isProcessingOrder}
          i18n={i18n}
        />

        {/* PAYMENT: Payment Modal in CLIENT_CONFIRM - ENTIRE SECTION COMMENTED OUT
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
            <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-white">Payment Methods</h3>
                <button onClick={() => setShowPaymentModal(false)}><span className="material-symbols-outlined text-white">close</span></button>
              </div>
              {!showAddCardForm ? (
                <>
                  <div className="space-y-3 mb-6">
                    {(cards || []).map(card => (
                      <div key={card.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-6 bg-white/10 rounded flex items-center justify-center text-xs font-bold text-white uppercase">{card.brand}</div>
                          <div>
                            <p className="font-bold text-white">•••• {card.last4}</p>
                            <p className="text-xs text-slate-400">Expires {card.expiry}</p>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCard(card.id)} className="text-red-400 hover:text-red-300"><span className="material-symbols-outlined">delete</span></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowAddCardForm(true)} className="w-full bg-primary h-12 rounded-xl font-bold flex items-center justify-center gap-2 text-black"><span className="material-symbols-outlined">add</span> Add New Card</button>
                </>
              ) : (
                <div className="space-y-4">
                  <PaymentModal
                    isOpen={showAddCardForm}
                    onClose={() => setShowAddCardForm(false)}
                    onSuccess={handleAddCardSuccess}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        */ }
      </>
    );
  }

  console.log('⚠️ No screen matched, returning null. Current screen:', screen);
  return null;
};

export const ClientScreens = ClientContent;


