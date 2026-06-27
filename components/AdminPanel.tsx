
import React, { useState, useMemo } from 'react';
import { UserMenu } from './UserMenu';
import { Screen as AdminScreenEnum, Order, TeamMember, ClientUser, UserRole, OrderStatus, ServicePackage, ServiceAddon, VehicleType, IssueReport, VehicleTypeConfig, ToastType, NotificationType, ServiceArea } from '../types';
import { parseSafeDate } from '../utils/dateUtils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NotificationService } from '../services/NotificationService';
import { DiscountManagement } from './DiscountManagement';
import { BonusManagement } from './BonusManagement';
import { addLoyaltyPoints, LoyaltyProgram, LOYALTY_TIERS } from './LoyaltyProgram';
import { ServiceAreaConfig } from './ServiceAreaConfig';
import { seedVehicleTypes, seedServicePackages, seedServiceAddons } from '../utils/seedData';
import { SupportChatAdmin } from './SupportChatAdmin';
import { storage, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, addDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { CouponSystem } from './CouponSystem';
import { ReportGenerator } from './ReportGenerator';
import { RevenueChart, OrdersStatusChart } from './Charts';
import { i18n } from '../services/i18n';
import { FinancialReportsScreen } from './admin/FinancialReportsScreen';
import { WasherEarningsScreen } from './admin/WasherEarningsScreen';
import { WasherHistoryScreen } from './admin/WasherHistoryScreen';
import { AppEarningsScreen } from './admin/AppEarningsScreen';
import { TaxReportsScreen } from './admin/TaxReportsScreen';
import { AdminOrderPhotos } from './admin/AdminOrderPhotos';
import { FleetPanel } from './admin/FleetPanel';
import { StripeService } from '../services/StripeService';
import { ConfirmationModal } from './ConfirmationModal';
import { NotificationTest } from './NotificationTest';
import { AdminSocialPanel } from './AdminSocialPanel';
import { LandingGalleryScreen } from './admin/LandingGalleryScreen';

interface AdminProps {
    screen: AdminScreenEnum;
    navigate: (screen: AdminScreenEnum, params?: any) => void;
    orders: Order[];
    team: TeamMember[];
    clients: ClientUser[];
    packages: ServicePackage[];
    addons: ServiceAddon[];
    vehicleTypes: VehicleTypeConfig[];
    supportPhone: string;
    setSupportPhone: (phone: string) => void;
    assignOrder: (orderId: string, washerId: string) => void;
    updateOrder: (orderId: string, updates: Partial<Order>) => void;
    cancelOrder: (orderId: string, applyFee?: boolean) => void;
    addTeamMember: (memberData: any) => void;
    toggleBlockUser: (userId: string) => void;
    deleteUser: (userId: string) => void;
    updateUserProfile: (userId: string, updates: Partial<TeamMember | ClientUser>) => Promise<void>;
    onSavePackage: (pkg: ServicePackage) => Promise<void>;
    onDeletePackage: (id: string) => Promise<void>;
    onSaveAddon: (addon: ServiceAddon) => Promise<void>;
    onDeleteAddon: (id: string) => Promise<void>;
    onSaveVehicleType: (type: any) => Promise<void>;
    onDeleteVehicleType: (id: string) => Promise<void>;
    approveWasher: (id: string, data: any) => void;
    rejectWasher: (id: string) => void;
    // Payment system
    bonuses: any[];
    discounts: any[];
    payments: any[];
    createBonus: (data: any) => Promise<string>;
    updateBonus: (id: string, updates: any) => Promise<void>;
    deleteBonus: (id: string) => Promise<void>;
    createDiscount: (data: any) => Promise<string>;
    updateDiscount: (id: string, updates: any) => Promise<void>;
    deleteDiscount: (id: string) => Promise<void>;
    createPayment: (data: any) => Promise<string>;
    showToast: (message: string, type: ToastType) => void;
    currentUser: TeamMember | null;
    logout: () => void;
    reportEmail?: string;
    setReportEmail?: (email: string) => void;
    issues?: IssueReport[];
    saveServiceArea: (area: any) => Promise<void>;
    serviceArea: any;
    addNotification: (userId: string, title: string, message: string, type?: NotificationType, linkTo?: AdminScreenEnum, relatedId?: string) => void;
    washerApplications: any[];
}

const FINANCE_SCREENS = [
    AdminScreenEnum.ADMIN_FINANCIAL_REPORTS,
    AdminScreenEnum.ADMIN_PAYROLL,
    AdminScreenEnum.ADMIN_WASHER_EARNINGS,
    AdminScreenEnum.ADMIN_APP_EARNINGS,
    AdminScreenEnum.ADMIN_TAX_REPORTS
];

const Nav = ({ active, navigate }: { active: AdminScreenEnum, navigate: any }) => {
    const [showMore, setShowMore] = React.useState(false);

    const mainTabs = [
        { s: AdminScreenEnum.ADMIN_DASHBOARD, i: 'grid_view', l: i18n.t('orders') || 'Orders' },
        { s: AdminScreenEnum.ADMIN_TEAM, i: 'group', l: i18n.t('team') || 'Team' },
        { s: AdminScreenEnum.ADMIN_ANALYTICS, i: 'monitoring', l: i18n.t('metrics') || 'Metrics' },
    ];

    const moreItems = [
        { s: AdminScreenEnum.ADMIN_CLIENTS, i: 'person', l: i18n.t('clients') || 'Clients' },
        { s: AdminScreenEnum.ADMIN_PRICING, i: 'sell', l: i18n.t('services') || 'Services' },
        { s: AdminScreenEnum.ADMIN_QUOTES, i: 'local_shipping', l: 'Flotas' },
        { s: AdminScreenEnum.ADMIN_SOCIAL, i: 'share', l: 'Social' },
        { s: AdminScreenEnum.ADMIN_LANDING_GALLERY, i: 'photo_library', l: 'Landing Gallery' },
        { s: AdminScreenEnum.ADMIN_SETTINGS, i: 'settings', l: 'Config' },
        { s: AdminScreenEnum.ADMIN_ISSUES, i: 'support_agent', l: 'Issues' },
        { s: AdminScreenEnum.ADMIN_FINANCIAL_REPORTS, i: 'payments', l: 'Finanzas' },
        { s: AdminScreenEnum.ADMIN_SERVICE_AREA, i: 'map', l: 'Area' }
    ];

    const isFinanceActive = FINANCE_SCREENS.includes(active as any);
    const isMoreActive = moreItems.some(item => 
        item.s === active || 
        (item.s === AdminScreenEnum.ADMIN_FINANCIAL_REPORTS && isFinanceActive)
    );

    return (
        <div className="relative shrink-0" style={{ height: `calc(env(safe-area-inset-bottom) + 60px)` }}>
            {/* More Menu Backdrop & Sheet */}
            {showMore && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm transition-opacity" 
                        onClick={() => setShowMore(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 bg-[#16161a] border-t border-white/10 rounded-t-[2.5rem] p-6 pb-8 z-40 shadow-2xl transition-all max-h-[80vh] overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white">More Options</h3>
                            <button 
                                onClick={() => setShowMore(false)}
                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {moreItems.map(item => {
                                const isActive = active === item.s || 
                                    (item.s === AdminScreenEnum.ADMIN_FINANCIAL_REPORTS && isFinanceActive);
                                return (
                                    <button
                                        key={item.s}
                                        onClick={() => {
                                            navigate(item.s);
                                            setShowMore(false);
                                        }}
                                        className="flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 active:scale-95 hover:bg-white/5"
                                    >
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-colors ${
                                            isActive 
                                                ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30' 
                                                : 'bg-white/5 text-slate-400'
                                        }`}>
                                            <span className="material-symbols-outlined">{item.i}</span>
                                        </div>
                                        <span className={`text-[10px] font-semibold text-center truncate w-full ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                                            {item.l}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Bottom Tab Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0c0c0e] border-t border-white/10 p-2 flex justify-around z-20" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
                <div className="flex justify-around w-full max-w-lg mx-auto">
                    {mainTabs.map(item => {
                        const isActive = active === item.s;
                        return (
                            <button 
                                key={item.s} 
                                onClick={() => {
                                    navigate(item.s);
                                    setShowMore(false);
                                }} 
                                className={`flex flex-col items-center p-2 min-w-[64px] transition-all active:scale-95 ${isActive ? 'text-primary' : 'text-slate-500'}`}
                            >
                                <span className="material-symbols-outlined text-xl">{item.i}</span>
                                <span className="text-[10px] mt-1 font-bold">{item.l}</span>
                            </button>
                        );
                    })}
                    
                    <button 
                        onClick={() => setShowMore(!showMore)} 
                        className={`flex flex-col items-center p-2 min-w-[64px] transition-all active:scale-95 ${isMoreActive || showMore ? 'text-primary' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined text-xl">{showMore ? 'close' : 'more_horiz'}</span>
                        <span className="text-[10px] mt-1 font-bold">More</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AdminScreens: React.FC<AdminProps> = ({
    screen, navigate, orders, team, clients, packages, addons, vehicleTypes,
    supportPhone, setSupportPhone,
    assignOrder, updateOrder, cancelOrder, addTeamMember, toggleBlockUser, deleteUser, updateUserProfile,
    onSavePackage, onDeletePackage, onSaveAddon, onDeleteAddon, onSaveVehicleType, onDeleteVehicleType,
    approveWasher, rejectWasher,
    bonuses, discounts, payments, createBonus, updateBonus, deleteBonus,
    createDiscount, updateDiscount, deleteDiscount, createPayment,
    showToast, currentUser, logout, reportEmail, setReportEmail, issues = [],
    saveServiceArea, serviceArea, addNotification, washerApplications
}) => {
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientFilter, setClientFilter] = useState('All');
    const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatus, setHistoryStatus] = useState<'All' | 'Completed' | 'Cancelled'>('All');
    const [historyDateFilter, setHistoryDateFilter] = useState('All Dates');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');

    const handleDeleteClient = async (id: string) => {
        showConfirm(
            'Delete Client',
            'Delete this client?',
            async () => {
                try {
                    await deleteUser(id);
                    showToast('Client deleted successfully', 'success');
                } catch (error) {
                    console.error('Error deleting client:', error);
                    showToast('Failed to delete client', 'error');
                }
            },
            'danger'
        );
    };
    const [isUploading, setIsUploading] = useState(false);
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('week');

    // Financial Reports State
    const [reportPeriod, setReportPeriod] = useState<'year'>('year');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [pricingTab, setPricingTab] = useState<'packages' | 'addons' | 'vehicleTypes' | 'settings'>('packages');
    const [editingItem, setEditingItem] = useState<ServicePackage | ServiceAddon | VehicleTypeConfig | null>(null);
    const [isNewItem, setIsNewItem] = useState(false);
    const [tempVehiclePrices, setTempVehiclePrices] = useState<Record<string, number>>({});
    const [showTypeSelectionModal, setShowTypeSelectionModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showNotificationTest, setShowNotificationTest] = useState(false);
    const [newMemberData, setNewMemberData] = useState<{
        id?: string;
        name: string;
        email: string;
        password?: string;
        role: UserRole;
        driverLicense: string;
        insuranceNumber: string;
        vehiclePlate: string;
        vehicleModel: string;
    }>({
        name: '', email: '', password: '', role: 'washer' as UserRole,
        driverLicense: '', insuranceNumber: '', vehiclePlate: '', vehicleModel: '',
    });
    const [viewingClientHistory, setViewingClientHistory] = useState<ClientUser | null>(null);
    const [viewingOrderDetails, setViewingOrderDetails] = useState<Order | null>(null);
    const [newVehicleType, setNewVehicleType] = useState({ name: '', icon: 'directions_car' });
    const [clientSearch, setClientSearch] = useState('');
    const [liveSearch, setLiveSearch] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [supportTickets, setSupportTickets] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);

    // Payroll state
    const [payingWasher, setPayingWasher] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'check' | 'other'>('transfer');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [editingServicesOrder, setEditingServicesOrder] = useState<Order | null>(null);
    const [tempConfigs, setTempConfigs] = useState<any[]>([]);
    const [dashboardTab, setDashboardTab] = useState<'live' | 'history'>('live');
    const [teamTab, setTeamTab] = useState<'active' | 'pending'>('active');
    const [selectedWasherId, setSelectedWasherId] = useState<string>('');
    const [washerETAs, setWasherETAs] = useState<Record<string, { remainingMin: number; travelMin: number; etaStr: string; loading: boolean }>>({});

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

    // Global Fees State
    const [globalFees, setGlobalFees] = useState<{ name: string, percentage: number }[]>([{ name: 'App Commission', percentage: 20 }]);

    // Load Global Fees
    React.useEffect(() => {
        const loadFees = async () => {
            try {
                const docRef = doc(db, 'settings', 'financials');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().globalFees) {
                    setGlobalFees(docSnap.data().globalFees);
                }
            } catch (e) {
                console.error("Error loading fees", e);
            }
        };
        loadFees();
    }, []);

    const saveGlobalFeesToFirestore = async () => {
        try {
            // Guardar en 'settings/fees' para consistencia con App.tsx
            await setDoc(doc(db, 'settings', 'fees'), { globalFees }, { merge: true });
            showToast('Global fees saved successfully', 'success');
        } catch (e) {
            console.error("Error saving fees", e);
            showToast('Error saving fees', 'error');
        }
    };

    const addGlobalFee = () => setGlobalFees([...globalFees, { name: 'New Fee', percentage: 0 }]);
    const updateGlobalFee = (index: number, field: 'name' | 'percentage', value: any) => {
        const newFees = [...globalFees];
        (newFees[index] as any)[field] = value;
        setGlobalFees(newFees);
    };
    const deleteGlobalFee = (index: number) => setGlobalFees(globalFees.filter((_, i) => i !== index));

    // Service Area state managed by parent props now

    // Auto-Cancel Logic for Unassigned Orders
    // Use ref to avoid resetting interval on every order update
    const ordersRef = React.useRef(orders);
    React.useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    React.useEffect(() => {
        const intervalId = setInterval(() => {
            const now = Date.now();
            const CANCEL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes fallback

            ordersRef.current.forEach(order => {
                if (order.status === 'Pending') {
                    // 1. Calculate Scheduled Time
                    let scheduledTimestamp = 0;

                    if (order.date === 'ASAP' || order.time === 'ASAP' || order.date === 'Wash Now' || order.time === 'Wash Now') {
                        // Fallback to CreatedAt if available
                        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
                            scheduledTimestamp = order.createdAt.toDate().getTime();
                        } else {
                            // If no createdAt, assume checking against "Now" is risky without reference, maybe just skip or use fallback
                            return;
                        }
                    } else {
                        // Parse Date/Time string
                        try {
                            const dateStr = order.date === 'Today' ? new Date().toISOString().split('T')[0] :
                                order.date === 'Tomorrow' ? new Date(Date.now() + 86400000).toISOString().split('T')[0] :
                                    order.date; // Expect YYYY-MM-DD

                            // Parse 12h Time (e.g. 01:00 PM)
                            const [timePart, modifier] = order.time.split(' ');
                            let [hours, minutes] = timePart.split(':').map(Number);
                            if (hours === 12) hours = 0;
                            if (modifier === 'PM') hours += 12;

                            const d = new Date(dateStr);
                            d.setHours(hours, minutes, 0, 0);
                            scheduledTimestamp = d.getTime();

                            // Handle "Today" edge case if date string logic failed (e.g. if order.date is literally "Today" string and not parsed above correctly by Date constructor? 
                            // Ah, "Today" isn't valid for new Date(), so key is the ternary above.
                            // If order.date is a specific date string like "2023-10-27", we are good.
                        } catch (e) {
                            console.error("Error parsing order date/time", order.id, e);
                            return;
                        }
                    }

                    // 2. Cancellation Logic
                    // "Si se llega la hora... cancela" -> If Now >= ScheduledTime
                    // We add a small buffer (e.g. 1 min) to avoid premature cancellation if clocks slightly off
                    // OR strict: Now > ScheduledTime

                    // Allow 15 min grace period? User said "se llega la una cancela". Implies immediate.
                    // Let's stick to strict or small buffer (e.g. 5 mins past scheduled time?)
                    // "no washer available" implies we waited a bit?
                    // Let's trigger if Now > ScheduledTime + 1 minute

                    if (scheduledTimestamp > 0 && now > scheduledTimestamp + 1200000) { // 20 minute buffer
                        // CANCEL
                        updateOrder(order.id, {
                            status: 'Cancelled',
                            // Use 'client_cancellation' or similar if existing, or just string
                            // We use a custom field or reuse one. I'll add a note field if proper fields unavailable in type
                            // But I'll attempt to set a reason if specific field exists. 
                            // Looking at Types is hard without file, but usually 'cancellationReason' or similar.
                            // I'll stick to just status and handle side effects.
                        });

                        // Apply 5% Discount to User
                        if (order.clientId) {
                            // Update user profile with discount flag
                            updateUserProfile(order.clientId, {
                                nextOrderDiscount: 5, // 5%
                                nextOrderDiscountReason: 'Auto-cancellation apology'
                            }).catch(err => console.error("Failed to apply discount", err));

                            // NOTIFY message (in Spanish as requested/context implies, or consistent English?)
                            // Previous messages in English. User asked "mandale ... que no hay washer".
                            // I'll write in English/Spanish hybrid or just English based on app?
                            // App seems English ("We apologize...").
                            // User request: "se le manda al cliente que no hay washer disponibles pero que estaremos encantlados de ayudarle en otra ocacion"
                            // I will translate to clear English/Spanish or use English as UI is English.
                            // "Apologies, no washers are available at this time. We'd love to help you another time and have applied a 5% discount to your next order."
                            const message = "We apologize, but no washers are available at this time. Your order has been cancelled. We have applied a 5% discount to your next order.";
                            addNotification(order.clientId, 'Order Cancelled - Discount Applied', message, 'info');
                        }

                        showToast(`Order ${order.id.substring(0, 5)}... auto-cancelled & discount applied`, 'info');
                    }
                }
            });
        }, 60000); // Check every minute

        return () => clearInterval(intervalId);
    }, [updateOrder, showToast]);

    // Load Support Tickets for notifications
    React.useEffect(() => {
        const unsubscribe = onSnapshot(
            query(collection(db, 'supportTickets')),
            (snapshot) => {
                const tickets = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by lastMessageAt desc
                setSupportTickets(tickets.sort((a: any, b: any) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0)));
            },
            (error) => {
                console.error('Error loading support tickets:', error);
            }
        );

        return () => unsubscribe();
    }, []);

    // Load Quotes for notifications and badge counts
    React.useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'quotes'),
            (snapshot) => {
                const quotesList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setQuotes(quotesList);
            },
            (error) => {
                console.error('Error loading quotes:', error);
            }
        );

        return () => unsubscribe();
    }, []);


    const washers = team.filter(m => m.role === 'washer');

    const computeWasherETAs = async (destAddress: string) => {
        setWasherETAs(Object.fromEntries(washers.map(w => [w.id, { remainingMin: 0, travelMin: 0, etaStr: '', loading: true }])));
        for (const washer of washers) {
            const activeOrder = orders.find(o => o.washerId === washer.id && ['In Progress', 'En Route', 'Assigned'].includes(o.status));
            let remainingMin = 0;
            if (activeOrder) {
                if (activeOrder.inProgressAt && activeOrder.totalServiceDuration) {
                    remainingMin = Math.max(0, Math.round(activeOrder.totalServiceDuration - (Date.now() - activeOrder.inProgressAt) / 60000));
                } else if (activeOrder.totalServiceDuration) {
                    remainingMin = activeOrder.totalServiceDuration;
                }
            }
            let travelMin = 0;
            const washerDoc = team.find(t => t.id === washer.id) as any;
            const originLat: number | null = washerDoc?.currentLocation?.latitude ?? (activeOrder as any)?.washerLocation?.lat ?? null;
            const originLng: number | null = washerDoc?.currentLocation?.longitude ?? (activeOrder as any)?.washerLocation?.lng ?? null;
            if (originLat !== null && originLng !== null && (window as any).google?.maps) {
                try {
                    const result = await new Promise<any>((resolve, reject) => {
                        new (window as any).google.maps.DistanceMatrixService().getDistanceMatrix({
                            origins: [new (window as any).google.maps.LatLng(originLat, originLng)],
                            destinations: [destAddress],
                            travelMode: 'DRIVING',
                        }, (res: any, status: any) => status === 'OK' ? resolve(res) : reject(status));
                    });
                    const el = result?.rows?.[0]?.elements?.[0];
                    if (el?.status === 'OK') travelMin = Math.round(el.duration.value / 60);
                } catch (_e) { /* fallback: 0 */ }
            }
            const totalMin = remainingMin + travelMin;
            const etaStr = totalMin > 0
                ? new Date(Date.now() + totalMin * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : '';
            setWasherETAs(prev => ({ ...prev, [washer.id]: { remainingMin, travelMin, etaStr, loading: false } }));
        }
    };

    React.useEffect(() => {
        if (assigningOrderId) {
            const o = orders.find(x => x.id === assigningOrderId);
            if (o?.address) computeWasherETAs(o.address);
        } else {
            setWasherETAs({});
        }
    }, [assigningOrderId]);

    // Payroll State
    const [payrollTab, setPayrollTab] = useState<'pending' | 'history'>('pending');
    const [payrollWeek, setPayrollWeek] = useState<number>(() => {
        // Default to current week's Monday
        const now = new Date();
        const day = now.getDay() || 7; // Mon=1
        if (day !== 1) now.setHours(-24 * (day - 1));
        now.setHours(0, 0, 0, 0);
        return now.getTime();
    });

    // Track expanded item for details
    const [expandedPayrollItem, setExpandedPayrollItem] = useState<string | null>(null);

    const dailyStats = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        // Filter orders completed TODAY
        const completedToday = orders.filter(o => {
            if (o.status !== 'Completed') return false;

            // 1. Try strict timestamp
            if (o.completedAt) {
                const completedTime = (o.completedAt as any)?.seconds ? (o.completedAt as any).seconds * 1000 : new Date(o.completedAt).getTime();
                const endOfDay = startOfDay + (24 * 60 * 60 * 1000); // Add 24 hours
                return completedTime >= startOfDay && completedTime < endOfDay;
            }

            // 2. Fallback to string date logic
            // 2. Fallback to string date logic using LOCAL time (not UTC/ISO)
            const localY = now.getFullYear();
            const localM = String(now.getMonth() + 1).padStart(2, '0');
            const localD = String(now.getDate()).padStart(2, '0');
            const localTodayStr = `${localY}-${localM}-${localD}`; // YYYY-MM-DD

            // Handle "Today" literal
            if (o.date === 'Today') return true;

            // Handle strings
            if (o.date) {
                try {
                    // Try exact match first (if format is YYYY-MM-DD)
                    if (o.date === localTodayStr) return true;

                    // Parse date and compare local parts
                    const d = new Date(o.date);
                    if (!isNaN(d.getTime())) {
                        const dY = d.getFullYear();
                        const dM = String(d.getMonth() + 1).padStart(2, '0');
                        const slightlyFormattedD = String(d.getDate()).padStart(2, '0');
                        const orderDateStr = `${dY}-${dM}-${slightlyFormattedD}`;
                        if (orderDateStr === localTodayStr) return true;
                    }
                } catch (e) {
                    // ignore
                }
            }

            return false;
        });

        // GROSS REVENUE (Total Sales)
        // User expected the sum of the orders shown in the list.
        const dailyGross = completedToday.reduce((sum, o) => sum + (o.price || 0), 0);

        // Daily Washer Pay (Net + Tips)
        const totalFeePercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);
        const dailyWasherPay = completedToday.reduce((sum, o) => {
            const price = o.price || 0;
            const tip = o.tip || 0;
            const deduction = (price * totalFeePercent) / 100;
            return sum + (price - deduction) + tip;
        }, 0);

        const activeWashersCount = team.filter(m => m.role === 'washer' && m.status !== 'Offline' && m.status !== 'Blocked').length;

        return { count: completedToday.length, revenue: dailyGross, washerPay: dailyWasherPay, activeWashers: activeWashersCount };
    }, [orders, team, globalFees]);

    const filteredOrders = useMemo(() => {
        let result = orders;
        if (filter !== 'All') result = result.filter(o => o.status === filter);
        if (liveSearch) {
            const q = liveSearch.toLowerCase();
            result = result.filter(o =>
                (o.clientName?.toLowerCase() || '').includes(q) ||
                (o.id?.toLowerCase() || '').includes(q) ||
                (o.displayId?.toLowerCase() || '').includes(q) ||
                (o.clientPhone?.toLowerCase() || '').includes(q) ||
                (o.address?.toLowerCase() || '').includes(q) ||
                (o.vehicle?.toLowerCase() || '').includes(q)
            );
        }
        return result;
    }, [orders, filter, liveSearch]);


    const historyOrders = useMemo(() => {
        return orders.filter(o => {
            const isPast = o.status === 'Completed' || o.status === 'Cancelled';
            if (!isPast) return false;
            if (historyStatus !== 'All' && o.status !== historyStatus) return false;
            if (historyDateFilter !== 'All Dates' && o.date !== historyDateFilter) return false;
            if (historySearch) {
                const q = historySearch.toLowerCase();
                return (o.clientName?.toLowerCase() || '').includes(q) ||
                    (o.id?.toLowerCase() || '').includes(q) ||
                    (o.displayId?.toLowerCase() || '').includes(q) ||
                    (o.clientPhone?.toLowerCase() || '').includes(q) ||
                    (o.address?.toLowerCase() || '').includes(q);
            }
            return true;
        });
    }, [orders, historyStatus, historyDateFilter, historySearch]);

    const uniqueDates = useMemo(() => {
        const dates = new Set(orders.map(o => o.date));
        return ['All Dates', ...Array.from(dates)];
    }, [orders]);

    const analyticsData = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (now.getDay() || 7) + 1); // Monday start
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

        const filteredOrders = orders.filter(o => {
            // Determine the definitive timestamp for the order
            let t = 0;
            if (o.status === 'Completed' && o.completedAt) {
                t = (o.completedAt as any)?.seconds ? (o.completedAt as any).seconds * 1000 : new Date(o.completedAt).getTime();
            } else if (o.status === 'Cancelled') {
                // For cancelled, use createdAt or date
                t = (o.createdAt as any)?.seconds ? (o.createdAt as any).seconds * 1000 : new Date(o.date).getTime();
            } else {
                // For pending/active, use date
                t = new Date(o.date).getTime();
            }

            if (isNaN(t) || t === 0) return false;

            if (timeRange === 'day') return t >= startOfDay;
            if (timeRange === 'week') return t >= startOfWeek.getTime();
            if (timeRange === 'month') return t >= startOfMonth;
            if (timeRange === 'year') return t >= startOfYear;
            return true;
        });

        const completedOrders = filteredOrders.filter(o => o.status === 'Completed');
        const cancelledOrders = filteredOrders.filter(o => o.status === 'Cancelled');

        // GROSS REVENUE: Sum of historical prices
        const totalRevenue = completedOrders.reduce((acc, curr) => acc + (curr.price || 0), 0);

        // Cancellation revenue (summing actual cancellationFee from orders)
        const cancellationRevenue = cancelledOrders.reduce((acc, curr) => acc + (curr.cancellationFee || 0), 0);
        const grossRevenue = totalRevenue + cancellationRevenue;

        // Total Deduction % from Global Fees
        const totalDeductionPercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);

        let washerPayout = 0;
        let appProfit = 0;

        completedOrders.forEach(order => {
            const price = order.price || 0;
            const tip = order.tip || 0;

            // Calculate Global Deductions (App Share)
            // Logic: Total Price * Fee% = App Share
            const deductionAmount = (price * totalDeductionPercent) / 100;

            // Washer Share = Total Price - App Share + Tips
            const netForWasher = price - deductionAmount;

            washerPayout += (netForWasher + tip);
            appProfit += deductionAmount;
        });

        // Add cancellation revenue to app profit
        appProfit += cancellationRevenue;

        const chartData = [
            { name: 'Revenue', revenue: grossRevenue },
            { name: 'Washer', revenue: washerPayout },
            { name: 'Profit', revenue: appProfit },
        ];

        return {
            totalOrders: filteredOrders.length,
            completedCount: completedOrders.length,
            cancelledCount: cancelledOrders.length,
            grossRevenue,
            appProfit,
            washerPayout,
            chartData,
            detailedOrders: filteredOrders
        };
    }, [orders, timeRange, globalFees]);

    const handleSaveItem = async () => {
        if (!editingItem) return;
        
        try {
            if (pricingTab === 'packages') {
                await onSavePackage(editingItem as ServicePackage);
                showToast('Package saved successfully!', 'success');
            }
            else if (pricingTab === 'vehicleTypes') {
                await onSaveVehicleType({ id: editingItem.id, ...newVehicleType });

                // Save Prices for ALL services (Packages and Addons)
                const vehicleId = editingItem.id;
                const savePromises: Promise<any>[] = [];

                // Update Packages
                packages.forEach(pkg => {
                    const newPrice = tempVehiclePrices[pkg.id];
                    if (newPrice !== undefined) {
                        const currentPrice = pkg.price[vehicleId] || 0;
                        if (currentPrice !== newPrice) {
                            const updatedPkg = { ...pkg, price: { ...pkg.price, [vehicleId]: newPrice } };
                            savePromises.push(onSavePackage(updatedPkg));
                        }
                    }
                });

                // Update Addons
                addons.forEach(addon => {
                    const newPrice = tempVehiclePrices[addon.id];
                    if (newPrice !== undefined) {
                        const currentPrice = addon.price[vehicleId] || 0;
                        if (currentPrice !== newPrice) {
                            const updatedAddon = { ...addon, price: { ...addon.price, [vehicleId]: newPrice } };
                            savePromises.push(onSaveAddon(updatedAddon));
                        }
                    }
                });

                if (savePromises.length > 0) {
                    await Promise.all(savePromises);
                }
                showToast('Vehicle type and prices updated!', 'success');
            }
            else {
                await onSaveAddon(editingItem as ServiceAddon);
                showToast('Add-on saved successfully!', 'success');
            }
            setEditingItem(null);
        } catch (error) {
            console.error("Error saving item:", error);
            showToast('Failed to save item. Please try again.', 'error');
        }
    };

    const handleDeleteItem = async (id: string) => {
        console.log("🗑️ Attempting to delete item with ID:", id);
        console.log("Current Pricing Tab:", pricingTab);

        if (!id) {
            console.error("handleDeleteItem: Missing ID", { pricingTab });
            showToast("Error: Missing item ID", "error");
            return;
        }
        showConfirm(
            'Delete Item',
            'Are you sure you want to delete this item? This action cannot be undone.',
            async () => {
                try {
                    if (pricingTab === 'packages') await onDeletePackage(id);
                    else if (pricingTab === 'vehicleTypes') await onDeleteVehicleType(id);
                    else await onDeleteAddon(id);
                    showToast('Item deleted successfully', 'success');
                } catch (error) {
                    console.error("Error deleting item:", error);
                    showToast('Failed to delete item', 'error');
                }
            },
            'danger'
        );
    };

    const startAddNew = () => setShowTypeSelectionModal(true);

    const renderIcon = (iconStr: string) => {
        if (!iconStr) return <span className="material-symbols-outlined text-slate-300">directions_car</span>;
        if (iconStr.includes('/') || iconStr.includes('.')) {
            return <img src={iconStr} alt="icon" className="w-full h-full object-contain" />;
        }
        return <span className="material-symbols-outlined text-slate-300">{iconStr}</span>;
    };

    const selectTypeAndOpenModal = (type: 'packages' | 'addons') => {
        setPricingTab(type);
        setShowTypeSelectionModal(false);
        setIsNewItem(true);
        
        // Estandarizar prefijos de ID para consistencia con datos existentes
        const idPrefix = type === 'packages' ? 'package_' : 'addon_';
        const id = `${idPrefix}${Date.now()}`;

        // Initialize prices for all known vehicle types
        const initialPrices: Record<string, number> = {};
        if (vehicleTypes) {
            vehicleTypes.forEach(vt => {
                initialPrices[vt.id || vt.name] = 0;
            });
        }

        // Reset temporary vehicle prices state to prevent data carry-over
        setTempVehiclePrices({});

        setEditingItem({
            id,
            name: '',
            price: initialPrices,
            description: '',
            duration: '',
            image: '',
            washerCommission: 80,
            sortOrder: type === 'packages' ? (packages.length + 1) : undefined, // Importante para que aparezca en consultas ordenadas
            fees: []
        } as any);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setIsUploading(true);

        try {
            const storageRef = ref(storage, `services/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            setEditingItem(prev => prev ? { ...prev, image: downloadURL } : null);
            showToast('Image uploaded successfully!', 'success');
        } catch (error) {
            console.error("Error uploading image:", error);
            showToast('Failed to upload image', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const openEditItemModal = (item: any) => {
        setIsNewItem(false);
        setEditingItem({
            ...item,
            washerCommission: item.washerCommission ?? 80,
            fees: item.fees || []
        });

        if (pricingTab === 'vehicleTypes') {
            setNewVehicleType({ name: item.name, icon: item.icon });
            // Populate Temporary Prices from current packages and addons
            const prices: Record<string, number> = {};
            const vehicleId = item.id;

            packages.forEach(pkg => {
                prices[pkg.id] = pkg.price[vehicleId] || 0;
            });

            addons.forEach(addon => {
                prices[addon.id] = addon.price[vehicleId] || 0;
            });

            setTempVehiclePrices(prices);
        }
    };
    const submitNewMember = () => {
        addTeamMember({ ...newMemberData, id: '' });
        setShowAddMemberModal(false);
        setNewMemberData({ name: '', email: '', password: '', role: 'washer', driverLicense: '', insuranceNumber: '', vehiclePlate: '', vehicleModel: '' });
    };
    const handleSaveEdit = () => {
        if (editingOrder) {
            updateOrder(editingOrder.id, {
                status: editingOrder.status,
                washerId: editingOrder.washerId,
                date: editingOrder.date,
                time: editingOrder.time,
                price: editingOrder.price,
                address: (editingOrder as any).address,
                vehicle: (editingOrder as any).vehicle,
                vehicleType: (editingOrder as any).vehicleType,
                service: (editingOrder as any).service,
                notes: (editingOrder as any).notes,
            });

            // Notify Client of Status Change
            const client = clients.find(c => c.name === editingOrder.clientName); // Ideally use ID, but for now name matching or we fetch full order object
            if (client) {
                NotificationService.notifyOrderUpdate({ phone: client.phone, email: client.email }, editingOrder.id, editingOrder.status);
            }

            setEditingOrder(null);
        }
    };

    const handleCancelOrder = (orderId: string) => {
        showConfirm(
            'Cancel Order',
            'ÔÜá´©Å CANCEL ORDER\n\nAre you sure you want to cancel this order?\n\nThis action cannot be undone.',
            () => {
                try {
                    cancelOrder(orderId, false);
                    showToast('Order cancelled successfully', 'success');

                    // Notify client
                    const order = orders.find(o => o.id === orderId);
                    if (order) {
                        const client = clients.find(c => c.name === order.clientName);
                        if (client) {
                            addNotification(
                                client.id,
                                'Order Cancelled',
                                `Your order ${orderId} has been cancelled by admin`,
                                'info'
                            );
                        }
                    }
                } catch (error) {
                    showToast('Error cancelling order', 'error');
                }
            },
            'danger'
        );
    };

    const getClientHistory = (clientName: string) => {
        return orders.filter(o => o.clientName === clientName && (o.status === 'Completed' || o.status === 'Cancelled'));
    };

    // Desktop Detection
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

    React.useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Desktop Navigation Sidebar
    const DesktopSidebar = () => {
        const isFinanceActive = FINANCE_SCREENS.includes(screen as any);
        const sections = [
            {
                label: 'MAIN',
                items: [
                    { s: AdminScreenEnum.ADMIN_DASHBOARD, i: 'grid_view', l: 'Dashboard' },
                ]
            },
            {
                label: 'PEOPLE',
                items: [
                    { s: AdminScreenEnum.ADMIN_TEAM, i: 'group', l: 'Team Management', badgeFn: () => { const c = washerApplications?.length || 0; return c > 0 ? c : null; } },
                    { s: AdminScreenEnum.ADMIN_CLIENTS, i: 'person', l: 'Client Base' },
                ]
            },
            {
                label: 'BUSINESS',
                items: [
                    { s: AdminScreenEnum.ADMIN_PRICING, i: 'sell', l: 'Services & Pricing' },
                    { s: AdminScreenEnum.ADMIN_DISCOUNTS, i: 'local_offer', l: 'Discount Codes' },
                    { s: AdminScreenEnum.ADMIN_QUOTES, i: 'local_shipping', l: 'Flotas', badgeFn: () => { const c = quotes.filter(q => q.status === 'new').length; return c > 0 ? c : null; } },
                ]
            },
            {
                label: 'INSIGHTS',
                items: [
                    { s: AdminScreenEnum.ADMIN_ANALYTICS, i: 'monitoring', l: 'Analytics' },
                    { s: AdminScreenEnum.ADMIN_FINANCIAL_REPORTS, i: 'account_balance_wallet', l: 'Finanzas' },
                ]
            },
            {
                label: 'MARKETING',
                items: [
                    { s: AdminScreenEnum.ADMIN_LANDING_GALLERY, i: 'photo_library', l: 'Landing Gallery' },
                    { s: AdminScreenEnum.ADMIN_SOCIAL, i: 'share', l: 'Social Media' },
                ]
            },
            {
                label: 'SETTINGS',
                items: [
                    { s: AdminScreenEnum.ADMIN_SERVICE_AREA, i: 'location_on', l: 'Service Area' },
                    { s: AdminScreenEnum.ADMIN_ISSUES, i: 'support_agent', l: 'Support Tickets', badgeFn: () => { const c = supportTickets.filter(t => t.status === 'open' && t.unreadByAdmin > 0).length; return c > 0 ? c : null; } },
                    { s: AdminScreenEnum.ADMIN_SETTINGS, i: 'settings', l: 'Configuration' },
                ]
            },
        ];

        return (
            <div className="w-64 bg-[#09090b] border-r border-white/[0.06] flex flex-col h-full shrink-0">
                {/* Header */}
                <div className="px-4 py-5 border-b border-white/[0.06] flex items-center gap-3">
                    <img
                        src="/logo.webp"
                        onError={(e: any) => { e.target.src = '/logo.png'; }}
                        alt="Logo"
                        className="w-9 h-9 object-contain rounded-xl"
                    />
                    <div>
                        <p className="text-[13px] font-bold text-white leading-none tracking-tight">Pro Detail Lab</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 block shrink-0" />
                            <p className="text-[9px] text-slate-600 uppercase tracking-[0.18em]">Admin Panel</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
                    {sections.map(section => (
                        <div key={section.label}>
                            <p className="text-[9px] font-bold tracking-[0.18em] text-slate-700 px-3 mb-1 uppercase">{section.label}</p>
                            <div className="space-y-0.5">
                                {(section.items as any[]).map((item: any) => {
                                    const isActive = screen === item.s ||
                                        (item.s === AdminScreenEnum.ADMIN_FINANCIAL_REPORTS && isFinanceActive);
                                    const badge = item.badgeFn?.();
                                    return (
                                        <button
                                            key={item.s}
                                            onClick={() => navigate(item.s)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg transition-all duration-150 group ${
                                                isActive
                                                    ? 'bg-white/[0.06]'
                                                    : 'hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            <span className={`material-symbols-outlined text-[16px] transition-colors shrink-0 ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'}`}>{item.i}</span>
                                            <span className={`text-[12.5px] flex-1 text-left tracking-[-0.01em] ${isActive ? 'font-medium text-white' : 'font-normal text-slate-500 group-hover:text-slate-300'}`}>{item.l}</span>
                                            {badge !== null && badge !== undefined && (
                                                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none">{badge}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer user */}
                <div className="px-3 py-3 border-t border-white/[0.06] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-black font-bold text-[11px] shrink-0 overflow-hidden">
                        {currentUser.avatar
                            ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                            : (currentUser.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-white truncate leading-none mb-0.5">{currentUser.name}</p>
                        <p className="text-[10px] text-slate-600 truncate leading-none">{currentUser.email}</p>
                    </div>
                    <button
                        onClick={logout}
                        title="Log Out"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                    </button>
                </div>
            </div>
        );
    };

    // ─── TOPBAR ────────────────────────────────────────────────────────────────
    const TopBarBell = () => {
        const getTs = (d: any) => parseSafeDate(d).getTime();
        const now = Date.now();
        const ONE_DAY = 86400000;
        const lastViewed = parseInt(localStorage.getItem('adminLastViewedNotifications') || '0');
        const allN = [
            ...orders.filter(o => o.status === 'Pending').map(o => ({
                id: o.id, type: 'order', title: 'New Order', subtitle: `From ${o.clientName}`,
                ts: getTs((o as any).createdAt || o.date), icon: 'add_shopping_cart', data: o,
                c: 'text-blue-400', bg: 'bg-blue-500/10'
            })),
            ...orders.filter(o => o.rating && o.rating < 3 && o.status === 'Completed').map(o => ({
                id: o.id, type: 'rating', title: 'Low Rating', subtitle: `${o.rating}★ — #${o.id.slice(0,6)}`,
                ts: getTs((o as any).completedAt || 0), icon: 'star_half', data: o,
                c: 'text-red-400', bg: 'bg-red-500/10'
            })),
            ...(issues || []).filter(i => i.status === 'Open').map(i => ({
                id: i.id, type: 'issue', title: 'Support Ticket', subtitle: (i as any).subject,
                ts: (i as any).timestamp, icon: 'report_problem', data: i,
                c: 'text-amber-400', bg: 'bg-amber-500/10'
            })),
            ...supportTickets.filter(t => t.status === 'open' && t.unreadByAdmin > 0).map(t => ({
                id: t.id, type: 'ticket', title: 'New Message', subtitle: `${t.userName || 'User'}: ${t.unreadByAdmin} unread`,
                ts: t.lastMessageAt?.seconds ? t.lastMessageAt.seconds * 1000 : Date.now(),
                icon: 'chat', data: t, c: 'text-primary', bg: 'bg-primary/10'
            }))
        ];
        const recent = allN.filter(n => (now - n.ts) < ONE_DAY).sort((a, b) => b.ts - a.ts);
        const unread = recent.filter(n => n.ts > lastViewed).length;
        return (
            <div className="relative">
                <button
                    onClick={() => {
                        if (!showNotifications) localStorage.setItem('adminLastViewedNotifications', Date.now().toString());
                        setShowNotifications(!showNotifications);
                    }}
                    className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all ${showNotifications ? 'bg-primary/15 text-primary' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">notifications</span>
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>
                {showNotifications && (
                    <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setShowNotifications(false)} />
                        <div className="absolute right-0 top-[calc(100%+6px)] w-72 bg-[#141418] border border-white/[0.08] rounded-xl shadow-2xl z-[101] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
                                <span className="text-[13px] font-semibold text-white">Notifications</span>
                                <button onClick={() => setShowNotifications(false)} className="text-slate-600 hover:text-white"><span className="material-symbols-outlined text-[15px]">close</span></button>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {recent.map(n => (
                                    <button key={`${n.type}-${n.id}`} onClick={() => {
                                        if (n.type === 'order' || n.type === 'rating') { navigate(AdminScreenEnum.ADMIN_DASHBOARD); setViewingOrderDetails(n.data as Order); }
                                        if (n.type === 'issue' || n.type === 'ticket') navigate(AdminScreenEnum.ADMIN_ISSUES);
                                        setShowNotifications(false);
                                    }} className="w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] flex gap-3 transition-colors">
                                        <div className={`w-8 h-8 rounded-lg ${n.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                            <span className={`material-symbols-outlined ${n.c} text-[15px]`}>{n.icon}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-1">
                                                <p className="text-[12px] font-semibold text-white leading-tight">{n.title}</p>
                                                {n.ts > lastViewed && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0 mt-1" />}
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{n.subtitle}</p>
                                        </div>
                                    </button>
                                ))}
                                {recent.length === 0 && (
                                    <div className="py-8 text-center">
                                        <span className="material-symbols-outlined text-slate-700 text-3xl block mb-1">notifications_off</span>
                                        <p className="text-[12px] text-slate-600">No recent notifications</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const TopBar = ({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) => (
        <div className="h-[52px] px-5 border-b border-white/[0.06] bg-[#0a0a0c] flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
                <span className="text-[14px] font-semibold text-white">{title}</span>
                {subtitle && <span className="text-[12px] text-slate-600 ml-2.5">{subtitle}</span>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {children}
                <TopBarBell />
            </div>
        </div>
    );
    // ──────────────────────────────────────────────────────────────────────────

    const FinanceTabs = ({ activeTab, navigate }: { activeTab: AdminScreenEnum, navigate: any }) => {
        const tabs = [
            { s: AdminScreenEnum.ADMIN_FINANCIAL_REPORTS, i: 'receipt_long', l: 'Ventas y Órdenes' },
            { s: AdminScreenEnum.ADMIN_PAYROLL, i: 'payments', l: 'Nómina Washers' },
            { s: AdminScreenEnum.ADMIN_WASHER_EARNINGS, i: 'account_balance_wallet', l: 'Ganancias Washers' },
            { s: AdminScreenEnum.ADMIN_APP_EARNINGS, i: 'trending_up', l: 'Ingresos de la App' },
            { s: AdminScreenEnum.ADMIN_TAX_REPORTS, i: 'description', l: 'Reportes Fiscales' }
        ];

        return (
            <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth select-none py-1">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.s;
                    return (
                        <button
                            key={tab.s}
                            onClick={() => navigate(tab.s)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap text-xs font-bold transition-all duration-300 border ${
                                isActive
                                    ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30 border-white/10 scale-105 font-black'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border-transparent'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">{tab.i}</span>
                            <span>{tab.l}</span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderFinanceScreen = (child: React.ReactNode, activeTab: AdminScreenEnum) => {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    {/* Unified Premium Finance Header */}
                    <div className="p-6 pb-4 bg-surface-dark/40 backdrop-blur-md border-b border-white/5 flex flex-col gap-4 shrink-0">
                        <div className="flex items-center gap-3">
                            {!isDesktop && (
                                <button onClick={() => navigate(AdminScreenEnum.ADMIN_DASHBOARD)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                                    <span className="material-symbols-outlined">arrow_back</span>
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-black bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-2xl">payments</span>
                                    Finanzas
                                </h1>
                                <p className="text-xs text-slate-400">Nóminas, ingresos, reportes fiscales y ventas</p>
                            </div>
                        </div>
                        <FinanceTabs activeTab={activeTab} navigate={navigate} />
                    </div>
                    {/* Screen Content */}
                    <div className="flex-1 overflow-y-auto relative bg-background-dark">
                        {child}
                    </div>
                </div>
                {!isDesktop && <Nav active={activeTab} navigate={navigate} />}
            </div>
        );
    };

    if (screen === AdminScreenEnum.ADMIN_DASHBOARD) {
        return (
            <div className={`flex h-full bg-background-dark text-white ${isDesktop ? 'flex-row' : 'flex-col'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                {isDesktop && <DesktopSidebar />}

                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {isDesktop && (
                        <TopBar
                            title="Dashboard"
                            subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        >
                            <button
                                onClick={() => navigate(AdminScreenEnum.ADMIN_SETTINGS)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
                                title="Settings"
                            >
                                <span className="material-symbols-outlined text-[17px]">settings</span>
                            </button>
                        </TopBar>
                    )}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {!isDesktop && (<header className="flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold">Dashboard</h1>
                                <p className="text-slate-400 text-sm">{new Date().toDateString()}</p>
                            </div>
                            <div className="flex flex-row items-center gap-2 shrink-0">
                                {/* Support/Issues Button - Hidden on Desktop Sidebar, shown here only for mobile or quick access */}
                                {!isDesktop && (
                                    <button
                                        onClick={() => navigate(AdminScreenEnum.ADMIN_ISSUES)}

                                        className="relative w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors"
                                        title="Support & Issues"
                                    >
                                        <span className="material-symbols-outlined text-slate-400 hover:text-primary">support_agent</span>
                                        {issues && issues.filter(i => i.status === 'Open').length > 0 && (
                                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                        )}
                                    </button>
                                )}

                                {/* Notification Bell */}
                                <div className="relative">
                                    {(() => {
                                        // Helper to parse date safely
                                        const getTimestamp = (date: any): number => {
                                            return parseSafeDate(date).getTime();
                                        };

                                        const now = Date.now();
                                        // 24 hours in ms
                                        const ONE_DAY = 24 * 60 * 60 * 1000;

                                        // Get Last Viewed Time
                                        const lastViewed = parseInt(localStorage.getItem('adminLastViewedNotifications') || '0');

                                        // Aggregate all potential notifications
                                        const allNotifications = [
                                            ...orders.filter(o => o.status === 'Pending').map(o => ({
                                                id: o.id,
                                                type: 'order',
                                                title: 'New Order Received',
                                                subtitle: `Order from ${o.clientName}`,
                                                timeDisplay: o.time,
                                                timestamp: getTimestamp(o.createdAt || o.date),
                                                data: o,
                                                icon: 'add_shopping_cart',
                                                colorClass: 'text-blue-400',
                                                bgClass: 'bg-blue-500/20'
                                            })),
                                            ...orders.filter(o => o.rating && o.rating < 3 && o.status === 'Completed').map(o => ({
                                                id: o.id,
                                                type: 'rating',
                                                title: 'Low Rating Alert',
                                                subtitle: `Order ${o.id.substring(0, 6)} rated ${o.rating} stars`,
                                                timeDisplay: 'Completed',
                                                timestamp: getTimestamp(o.completedAt || 0),
                                                data: o,
                                                icon: 'star_half',
                                                colorClass: 'text-red-400',
                                                bgClass: 'bg-red-500/20'
                                            })),
                                            ...(issues || []).filter(i => i.status === 'Open').map(i => ({
                                                id: i.id,
                                                type: 'issue',
                                                title: 'Open Support Issue',
                                                subtitle: i.subject,
                                                timeDisplay: 'Open',
                                                timestamp: i.timestamp,
                                                data: i,
                                                icon: 'report_problem',
                                                colorClass: 'text-amber-400',
                                                bgClass: 'bg-amber-500/20'
                                            })),
                                            ...supportTickets.filter(t => t.status === 'open' && t.unreadByAdmin > 0).map(t => ({
                                                id: t.id,
                                                type: 'support_ticket',
                                                title: 'New Support Message',
                                                subtitle: `${t.userName || 'User'}: ${t.unreadByAdmin} unread`,
                                                timeDisplay: 'Unread',
                                                timestamp: t.lastMessageAt?.seconds ? t.lastMessageAt.seconds * 1000 : Date.now(),
                                                data: t,
                                                icon: 'chat',
                                                colorClass: 'text-primary',
                                                bgClass: 'bg-primary/20'
                                            }))
                                        ];

                                        // Filter for "Recent" (Last 24h) - Keeps them in the list
                                        const recentNotifications = allNotifications
                                            .filter(n => (now - n.timestamp) < ONE_DAY)
                                            .sort((a, b) => b.timestamp - a.timestamp);

                                        // Filter for "New/Unread" (Since last view) - Controls the Badge
                                        const unreadCount = recentNotifications.filter(n => n.timestamp > lastViewed).length;

                                        return (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        if (!showNotifications) {
                                                            // When OPENING, mark as seen
                                                            localStorage.setItem('adminLastViewedNotifications', Date.now().toString());
                                                        }
                                                        setShowNotifications(!showNotifications);
                                                    }}
                                                    className={`relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 border backdrop-blur-md ${showNotifications ? 'bg-primary/20 border-primary/40 text-primary shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/30 hover:text-white'}`}
                                                    title="Notifications"
                                                >
                                                    <span className="material-symbols-outlined hover:text-primary">notifications</span>
                                                    {unreadCount > 0 && (
                                                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                                            {unreadCount > 9 ? '9+' : unreadCount}
                                                        </span>
                                                    )}
                                                </button>

                                                {showNotifications && (
                                                    <>
                                                        {/* Mobile Backdrop */}
                                                        <div className="md:hidden fixed inset-0 bg-black/50 z-[100]" onClick={() => setShowNotifications(false)} />

                                                        <div className="fixed inset-0 md:absolute md:inset-auto md:right-0 md:top-12 md:w-80 bg-surface-dark md:border border-white/10 md:rounded-xl shadow-2xl z-[101] overflow-hidden flex flex-col">
                                                            <div className="p-3 border-b border-white/10 flex justify-between items-center bg-surface-dark">
                                                                <h3 className="font-bold text-sm">{i18n.t('notifications_title')}</h3>
                                                                <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white">
                                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                                </button>
                                                            </div>
                                                            <div className="flex-1 overflow-y-auto">
                                                                {recentNotifications.map(n => (
                                                                    <button
                                                                        key={`${n.type}-${n.id}`}
                                                                        onClick={() => {
                                                                            if (n.type === 'order' || n.type === 'rating') {
                                                                                navigate(AdminScreenEnum.ADMIN_DASHBOARD);
                                                                                setViewingOrderDetails(n.data as Order);
                                                                            }
                                                                            if (n.type === 'issue') navigate(AdminScreenEnum.ADMIN_ISSUES);
                                                                            if (n.type === 'support_ticket') navigate(AdminScreenEnum.ADMIN_ISSUES);
                                                                            setShowNotifications(false);
                                                                        }}
                                                                        className="w-full text-left p-3 border-b border-white/5 hover:bg-white/5 flex gap-3 transition-colors relative"
                                                                    >
                                                                        <div className={`w-8 h-8 rounded-full ${n.bgClass} flex items-center justify-center shrink-0`}>
                                                                            <span className={`material-symbols-outlined ${n.colorClass} text-sm`}>{n.icon}</span>
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="font-bold text-sm">{n.title}</div>
                                                                                {n.timestamp > lastViewed && (
                                                                                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-xs text-slate-400">{n.subtitle}</div>
                                                                            <div className="text-[10px] text-slate-500 mt-1">{n.timeDisplay} ÔÇó {Math.floor((now - n.timestamp) / (1000 * 60 * 60))}{i18n.t('hours_ago')}</div>
                                                                        </div>
                                                                    </button>
                                                                ))}

                                                                {recentNotifications.length === 0 && (
                                                                    <div className="p-8 text-center text-slate-500">
                                                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
                                                                        <p className="text-sm">No new notifications</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                <button
                                    onClick={() => navigate(AdminScreenEnum.ADMIN_SETTINGS)}
                                    className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl transition-all duration-300 hover:bg-white/10 hover:border-white/30 text-slate-400 hover:text-white hover:rotate-90"
                                >
                                    <span className="material-symbols-outlined text-slate-400 hover:text-primary">settings</span>
                                </button>
                                <UserMenu user={{ name: currentUser.name, email: currentUser.email, avatar: currentUser.avatar, role: 'admin' }} onLogout={logout} />
                            </div>
                        </header>)}

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                            {/* 1. Daily Revenue */}
                            <button onClick={() => navigate(AdminScreenEnum.ADMIN_ANALYTICS)} className="col-span-1 group relative bg-[#0f0f11] p-5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.15] hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-green-400/70 to-transparent" />
                                <div className="flex items-center gap-1.5 mb-4">
                                    <span className="material-symbols-outlined text-green-400 text-[17px]">attach_money</span>
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">{i18n.t('daily_sales')}</span>
                                </div>
                                <p className="text-[28px] sm:text-[32px] font-bold text-white leading-none mb-1.5">${dailyStats.revenue.toFixed(0)}</p>
                                <p className="text-[11px] text-slate-600"><span className="text-green-400 font-medium">↑ 12%</span> vs yesterday</p>
                            </button>

                            {/* 2. Washer Pay */}
                            <button onClick={() => navigate(AdminScreenEnum.ADMIN_PAYROLL)} className="col-span-1 group relative bg-[#0f0f11] p-5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.15] hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-teal-400/70 to-transparent" />
                                <div className="flex items-center gap-1.5 mb-4">
                                    <span className="material-symbols-outlined text-teal-400 text-[17px]">payments</span>
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">{i18n.t('washer_pay')}</span>
                                </div>
                                <p className="text-[28px] sm:text-[32px] font-bold text-white leading-none mb-1.5">${dailyStats.washerPay.toFixed(0)}</p>
                                <p className="text-[11px] text-slate-600"><span className="text-teal-400 font-medium">Active</span> payroll week</p>
                            </button>

                            {/* 3. Clients */}
                            <button onClick={() => navigate(AdminScreenEnum.ADMIN_CLIENTS)} className="col-span-1 group relative bg-[#0f0f11] p-5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.15] hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />
                                <div className="flex items-center gap-1.5 mb-4">
                                    <span className="material-symbols-outlined text-blue-400 text-[17px]">group_add</span>
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">{i18n.t('clients')}</span>
                                </div>
                                <p className="text-[28px] sm:text-[32px] font-bold text-white leading-none mb-1.5">{clients.length}</p>
                                <p className="text-[11px] text-slate-600"><span className="text-blue-400 font-medium">+{Math.floor(clients.length * 0.05)}</span> this month</p>
                            </button>

                            {/* 4. Active Washers */}
                            <button onClick={() => navigate(AdminScreenEnum.ADMIN_TEAM)} className="col-span-1 group relative bg-[#0f0f11] p-5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.15] hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/70 to-transparent" />
                                <div className="flex items-center gap-1.5 mb-4">
                                    <span className="material-symbols-outlined text-purple-400 text-[17px]">engineering</span>
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">{i18n.t('team')}</span>
                                </div>
                                <p className="text-[28px] sm:text-[32px] font-bold text-white leading-none mb-1.5">{dailyStats.activeWashers}</p>
                                <p className="text-[11px] text-slate-600"><span className="text-purple-400 font-medium">Online</span> now</p>
                            </button>

                            {/* 5. Avg Rating */}
                            <button onClick={() => navigate(AdminScreenEnum.ADMIN_ANALYTICS)} className="col-span-2 lg:col-span-1 group relative bg-[#0f0f11] p-5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.15] hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-400/70 to-transparent" />
                                <div className="flex items-center gap-1.5 mb-4">
                                    <span className="material-symbols-outlined text-yellow-400 text-[17px]">star</span>
                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.18em]">{i18n.t('avg_rating')}</span>
                                </div>
                                <p className="text-[28px] sm:text-[32px] font-bold text-white leading-none mb-1.5">
                                    {(() => {
                                        const ratedOrders = orders.filter(o => o.rating && o.rating > 0);
                                        if (ratedOrders.length === 0) return '0.0';
                                        const avgRating = ratedOrders.reduce((acc, o) => acc + (o.rating || 0), 0) / ratedOrders.length;
                                        return avgRating.toFixed(1);
                                    })()}
                                </p>
                                <p className="text-[11px] text-slate-600"><span className="text-yellow-400 font-medium">Excellent</span> status</p>
                            </button>
                        </div>

                        {/* ── ACTIVE JOBS MONITOR ── */}
                        {(() => {
                            const activeJobs = orders.filter(o => o.status === 'In Progress');
                            if (activeJobs.length === 0) return null;
                            const now = Date.now();
                            return (
                                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                                    <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2.5">
                                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse block shrink-0" />
                                        <span className="text-[13px] font-semibold text-white">Active Jobs</span>
                                        <span className="text-[11px] text-slate-600 ml-1">{activeJobs.length} in progress</span>
                                        <span className="ml-auto text-[9px] text-slate-600 uppercase tracking-[0.15em]">Live</span>
                                    </div>
                                    <div className="divide-y divide-white/[0.03]">
                                        {activeJobs.map(order => {
                                            const washer = team.find(t => t.id === order.washerId);
                                            const dur = (order as any).totalServiceDuration || 60;
                                            const startAt = (order as any).inProgressAt || (now - 30 * 60000);
                                            const elapsed = Math.max(0, (now - startAt) / 60000);
                                            const remaining = Math.max(0, dur - elapsed);
                                            const pct = Math.min(100, (elapsed / dur) * 100);
                                            const isOvertime = elapsed > dur;
                                            const barColor = isOvertime ? 'bg-red-500' : remaining <= 10 ? 'bg-yellow-500' : 'bg-green-500';
                                            return (
                                                <div key={order.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setViewingOrderDetails(order)}>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        {washer?.avatar && <img src={washer.avatar} className="w-7 h-7 rounded-lg object-cover shrink-0" alt="" />}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                                <span className="text-[12px] font-semibold text-white">{washer?.name || 'Unassigned'}</span>
                                                                <span className="text-[10px] text-slate-500">→</span>
                                                                <span className="text-[12px] text-slate-400">{order.clientName}</span>
                                                                <span className="text-[10px] text-slate-600 ml-auto">#{order.id.slice(0, 6).toUpperCase()}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-600 mt-0.5">{(order as any).service || (order as any).packageName} • {order.address?.split(',')[0]}</div>
                                                        </div>
                                                        <div className={`text-right shrink-0 ${isOvertime ? 'text-red-400' : remaining <= 10 ? 'text-yellow-400' : 'text-slate-400'}`}>
                                                            <div className="text-[13px] font-bold leading-none">
                                                                {isOvertime ? '+' + Math.round(elapsed - dur) : Math.round(remaining)}
                                                                <span className="text-[9px] font-normal ml-0.5">min</span>
                                                            </div>
                                                            <div className="text-[9px] uppercase tracking-wider mt-0.5">{isOvertime ? 'Overtime' : 'Remaining'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: isOvertime ? '100%' : `${pct}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── BAD REVIEWS ALERT ── */}
                        {(() => {
                            const badReviews = orders.filter(o =>
                                o.status === 'Completed' &&
                                ((o.clientRating && o.clientRating <= 2) || (o.rating && o.rating <= 2)) &&
                                (o.clientReview || (o as any).review)
                            ).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 5);

                            if (badReviews.length === 0) return null;

                            return (
                                <div className="mb-2 rounded-2xl border border-red-500/20 bg-red-500/[0.04] overflow-hidden">
                                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-red-500/10">
                                        <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-red-400 text-[17px]">warning</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-red-400 uppercase tracking-widest">Reseñas negativas</p>
                                            <p className="text-[10px] text-slate-500">{badReviews.length} reseña{badReviews.length > 1 ? 's' : ''} con 1–2 estrellas</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(AdminScreenEnum.ADMIN_ANALYTICS)}
                                            className="text-[10px] text-red-400/70 hover:text-red-400 font-semibold uppercase tracking-wider"
                                        >
                                            Ver todas →
                                        </button>
                                    </div>
                                    <div className="divide-y divide-red-500/[0.07]">
                                        {badReviews.map(order => {
                                            const stars = order.clientRating || order.rating || 0;
                                            const reviewText = order.clientReview || (order as any).review || '';
                                            const washer = team.find(t => t.id === order.washerId);
                                            return (
                                                <button
                                                    key={order.id}
                                                    className="w-full text-left px-4 py-3 hover:bg-red-500/[0.04] transition-colors group"
                                                    onClick={() => setViewingOrderDetails(order)}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="shrink-0 mt-0.5 flex gap-0.5">
                                                            {[1,2,3,4,5].map(i => (
                                                                <span key={i} className={`material-symbols-outlined text-[13px] ${i <= stars ? 'text-red-400' : 'text-white/10'}`}>star</span>
                                                            ))}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                                <span className="text-[12px] font-semibold text-white truncate">{order.clientName}</span>
                                                                {washer && (
                                                                    <span className="text-[10px] text-slate-500">→ washer: <span className="text-slate-400">{washer.name}</span></span>
                                                                )}
                                                                <span className="text-[10px] text-slate-600 ml-auto">#{order.id.slice(0,6).toUpperCase()}</span>
                                                            </div>
                                                            {reviewText && (
                                                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">"{reviewText}"</p>
                                                            )}
                                                        </div>
                                                        <span className="material-symbols-outlined text-[14px] text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5">chevron_right</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                                <div className="flex items-baseline gap-2 shrink-0">
                                    <h2 className="text-[15px] font-semibold text-white">Live Orders</h2>
                                    <span className="text-[11px] text-slate-600">{filteredOrders.length}</span>
                                </div>

                                <div className="flex flex-1 flex-col sm:flex-row gap-2.5 sm:items-center">
                                    {/* Search Input */}
                                    <div className="relative sm:w-56">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[15px]">search</span>
                                        <input
                                            type="text"
                                            placeholder="Search orders..."
                                            value={liveSearch}
                                            onChange={e => setLiveSearch(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-white placeholder-slate-600 focus:border-white/20 focus:outline-none"
                                        />
                                    </div>

                                    {/* Filter chips */}
                                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                                        {['All', 'Pending', 'In Progress', 'Assigned', 'Completed'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border whitespace-nowrap transition-all ${filter === f
                                                    ? 'bg-primary/15 border-primary/30 text-primary'
                                                    : 'bg-transparent border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/20'}`}
                                            >
                                                {i18n.t(f.toLowerCase() as any) || f}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {isDesktop ? (
                                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-white/[0.02]">
                                            <tr className="border-b border-white/[0.06]">
                                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">#</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Client</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Service</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Date</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Washer</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Status</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Amount</th>
                                                <th className="px-4 py-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {filteredOrders.map(order => (
                                                <tr key={order.id} onClick={() => setViewingOrderDetails(order)} className="hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                                    <td className="px-4 py-3.5">
                                                        <span className="text-[11px] font-mono text-slate-500">
                                                            {(order as any).displayId ? `#${(order as any).displayId}` : `#${order.id.slice(0,6).toUpperCase()}`}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <p className="text-[13px] font-medium text-white leading-none">{order.clientName}</p>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">{order.vehicle}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5 max-w-[180px]">
                                                        <span className="text-[12px] text-slate-300 truncate block">{order.service}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <p className="text-[12px] text-slate-300 leading-none">{order.date}</p>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">{order.time}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {order.washerName
                                                            ? <span className="text-[12px] text-slate-300">{order.washerName}</span>
                                                            : <span className="text-[12px] text-amber-500 font-medium">Unassigned</span>
                                                        }
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                            order.status === 'Pending' ? 'bg-blue-500/10 text-blue-400' :
                                                            order.status === 'In Progress' ? 'bg-yellow-500/10 text-yellow-400' :
                                                            order.status === 'Assigned' ? 'bg-purple-500/10 text-purple-400' :
                                                            order.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                                                            'bg-red-500/10 text-red-400'
                                                        }`}>{order.status}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <span className="text-[14px] font-semibold text-white">${order.price}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {order.status === 'Pending' && (
                                                                <button onClick={() => setAssigningOrderId(order.id)} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary hover:text-white transition-all whitespace-nowrap">Assign</button>
                                                            )}
                                                            <button onClick={() => setEditingOrder(order)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-all">
                                                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredOrders.length === 0 && (
                                                <tr><td colSpan={8} className="py-12 text-center text-slate-600">
                                                    <span className="material-symbols-outlined text-3xl block mb-2 mx-auto">inbox</span>
                                                    <p className="text-[13px]">No orders match this filter</p>
                                                </td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                            <div className="space-y-3.5">
                                {filteredOrders.map(order => {
                                    const client = clients.find(c => c.id === order.clientId);
                                    const phone = client?.phone || order.clientPhone || '';
                                    return (
                                        <div
                                            key={order.id}
                                            className="bg-gradient-to-br from-surface-dark to-[#16161a] p-4 rounded-2xl border border-white/5 hover:border-primary/40 transition-all shadow-lg flex flex-col gap-3 group relative overflow-hidden"
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                                                setViewingOrderDetails(order);
                                            }}
                                        >
                                            {/* Card Header Row */}
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-white/5 w-8 h-8 rounded-xl flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                                                    </div>
                                                    <span className="font-black text-sm sm:text-base text-white">{order.time}</span>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                        order.status === 'Pending' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                                                        order.status === 'In Progress' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
                                                        order.status === 'Assigned' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                        order.status === 'Completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-base sm:text-lg font-black text-white bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/5 inline-block">${order.price}</div>
                                                </div>
                                            </div>

                                            {/* Card Body - Client & Vehicle Details */}
                                            <div className="grid grid-cols-2 gap-3 py-1.5 border-t border-b border-white/[0.03]">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Client</span>
                                                    <span className="text-xs sm:text-sm font-semibold text-white truncate">{order.clientName}</span>
                                                    {phone && (
                                                        <a href={`tel:${phone}`} className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5">
                                                            <span className="material-symbols-outlined text-xs">call</span>
                                                            {phone}
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Vehicle</span>
                                                    <span className="text-xs sm:text-sm font-semibold text-slate-300 truncate">{order.vehicle}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono truncate">Order #{order.id.slice(0, 8).toUpperCase()}</span>
                                                </div>
                                            </div>

                                            {/* Address Info */}
                                            <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="material-symbols-outlined text-slate-500 text-sm shrink-0">location_on</span>
                                                    <span className="truncate leading-tight">{order.address}</span>
                                                </div>
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline shrink-0 bg-primary/10 px-2 py-1 rounded-lg border border-primary/20"
                                                >
                                                    <span className="material-symbols-outlined text-xs">map</span>
                                                    Map
                                                </a>
                                            </div>

                                            {/* Footer Row - Assigned Washer & Actions */}
                                            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/[0.03] items-center justify-between">
                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                        <span className="material-symbols-outlined text-slate-500 text-xs">person</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 truncate">
                                                        {order.washerName || <span className="text-amber-500 font-bold">Unassigned</span>}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                                    {order.status === 'Pending' && (
                                                        <button 
                                                            onClick={() => setAssigningOrderId(order.id)} 
                                                            className="flex-1 sm:flex-none h-10 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-primary to-blue-600 text-white shadow-md shadow-primary/20 hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">person_add</span>
                                                            Assign
                                                        </button>
                                                    )}
                                                    {order.status !== 'Pending' && order.status !== 'Completed' && (
                                                        <button 
                                                            onClick={() => {
                                                                showConfirm(
                                                                    'Force Complete Order',
                                                                    'Are you sure you want to force complete this order? The client will be notified.',
                                                                    () => {
                                                                        updateOrder(order.id, { status: 'Completed' });
                                                                        if (order.clientId) {
                                                                            addLoyaltyPoints(order.clientId).then(pts => {
                                                                                showToast(pts > 0 ? `Completed & ${pts} loyalty pts awarded!` : 'Order completed', 'success');
                                                                            });
                                                                        } else {
                                                                            showToast('Order completed', 'success');
                                                                        }
                                                                    },
                                                                    'primary'
                                                                );
                                                            }} 
                                                            className="flex-1 sm:flex-none h-10 px-3 rounded-xl text-xs font-black text-green-400 border border-green-500/20 hover:bg-green-500/10 active:scale-95 transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                                            Complete
                                                        </button>
                                                    )}
                                                    {order.status !== 'Cancelled' && order.status !== 'Completed' && (
                                                        <button
                                                            onClick={() => handleCancelOrder(order.id)}
                                                            className="flex-1 sm:flex-none h-10 px-3 rounded-xl text-xs font-black text-red-400 border border-red-500/20 hover:bg-red-500/10 active:scale-95 transition-all flex items-center justify-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">cancel</span>
                                                            Cancel
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => setViewingOrderDetails(order)} 
                                                        className="flex-1 sm:flex-none h-10 px-3 rounded-xl text-xs font-black text-slate-400 border border-white/10 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredOrders.length === 0 && <div className="text-center py-10 text-slate-500">No active orders found</div>}
                            </div>
                            )}
                        </div>
                    </div>

                    {assigningOrderId && (() => {
                        const targetOrder = orders.find(o => o.id === assigningOrderId);
                        return (
                            <div className="absolute inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center sm:p-4">
                                <div className="bg-[#0f0f11] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">Assign Washer</p>
                                            <p className="text-[13px] font-semibold text-white mt-0.5 truncate">{targetOrder?.clientName} — {targetOrder?.address?.split(',')[0]}</p>
                                        </div>
                                        <button onClick={() => setAssigningOrderId(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all shrink-0">
                                            <span className="material-symbols-outlined text-[15px]">close</span>
                                        </button>
                                    </div>
                                    <div className="p-3 max-h-[65vh] overflow-y-auto space-y-2">
                                        {washers.map(washer => {
                                            const eta = washerETAs[washer.id];
                                            return (
                                                <button
                                                    key={washer.id}
                                                    onClick={() => {
                                                        if (eta?.etaStr) updateOrder(assigningOrderId, { estimatedArrival: eta.etaStr } as any);
                                                        assignOrder(assigningOrderId, washer.id);
                                                        setAssigningOrderId(null);
                                                    }}
                                                    className="w-full p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] hover:border-white/[0.15] rounded-xl flex items-center gap-3 transition-all"
                                                >
                                                    <div className="relative shrink-0">
                                                        <img src={washer.avatar} className="w-10 h-10 rounded-xl object-cover" alt={washer.name} />
                                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0f0f11] ${washer.status === 'On Job' ? 'bg-orange-500' : 'bg-green-500'}`} />
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <div className="text-[12px] font-semibold text-white">{washer.name}</div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                                                                <span className="material-symbols-outlined text-[11px] text-yellow-500">star</span>{washer.rating}
                                                            </span>
                                                            <span className="text-[9px] text-slate-600">{washer.completedJobs} jobs</span>
                                                            {washer.status === 'On Job' && <span className="text-[9px] text-orange-400">On Job</span>}
                                                        </div>
                                                        {eta && !eta.loading && (eta.remainingMin > 0 || eta.travelMin > 0) && (
                                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                                {eta.remainingMin > 0 && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-medium">
                                                                        {eta.remainingMin}m job left
                                                                    </span>
                                                                )}
                                                                {eta.travelMin > 0 && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">
                                                                        {eta.travelMin}m drive
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {eta?.loading ? (
                                                            <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                                                        ) : eta?.etaStr ? (
                                                            <>
                                                                <div className="text-[14px] font-bold text-white">{eta.etaStr}</div>
                                                                <div className="text-[9px] text-slate-600 uppercase tracking-wider">ETA</div>
                                                            </>
                                                        ) : (
                                                            <div className="text-[11px] text-green-400 font-semibold">Free</div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {editingOrder && (
                        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
                            <div className="bg-[#0f1117] w-full max-w-lg rounded-2xl border border-white/[0.08] shadow-2xl max-h-[92vh] overflow-y-auto">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                                    <div>
                                        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Editando</p>
                                        <p className="text-base font-semibold text-white">#{editingOrder.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                    <button onClick={() => setEditingOrder(null)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                </div>

                                <div className="p-6 space-y-5">
                                    {/* Date + Time */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fecha</label>
                                            <input
                                                type="date"
                                                value={editingOrder.date}
                                                onChange={e => setEditingOrder({ ...editingOrder, date: e.target.value })}
                                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-white text-sm focus:outline-none focus:border-primary/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hora</label>
                                            <input
                                                type="time"
                                                value={editingOrder.time}
                                                onChange={e => setEditingOrder({ ...editingOrder, time: e.target.value })}
                                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-white text-sm focus:outline-none focus:border-primary/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Status + Washer */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Estado</label>
                                            <select
                                                value={editingOrder.status}
                                                onChange={e => setEditingOrder({ ...editingOrder, status: e.target.value as any })}
                                                className="w-full bg-[#0f1117] text-white border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-sm focus:outline-none focus:border-primary/50"
                                            >
                                                <option value="New">New</option>
                                                <option value="Assigned">Assigned</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Washer</label>
                                            <select
                                                value={editingOrder.washerId || ''}
                                                onChange={e => setEditingOrder({ ...editingOrder, washerId: e.target.value })}
                                                className="w-full bg-[#0f1117] text-white border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-sm focus:outline-none focus:border-primary/50"
                                            >
                                                <option value="">Sin asignar</option>
                                                {washers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Service + Price */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Servicio</label>
                                            <select
                                                value={(editingOrder as any).service || ''}
                                                onChange={e => setEditingOrder({ ...editingOrder, service: e.target.value } as any)}
                                                className="w-full bg-[#0f1117] text-white border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-sm focus:outline-none focus:border-primary/50"
                                            >
                                                <option value="">— Sin cambio —</option>
                                                {packages.map(pkg => <option key={pkg.id} value={pkg.name}>{pkg.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Precio ($)</label>
                                            <input
                                                type="number"
                                                value={editingOrder.price}
                                                onChange={e => setEditingOrder({ ...editingOrder, price: Number(e.target.value) })}
                                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-white text-sm focus:outline-none focus:border-primary/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Vehicle + Type */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Vehículo</label>
                                            <input
                                                type="text"
                                                value={(editingOrder as any).vehicle || ''}
                                                onChange={e => setEditingOrder({ ...editingOrder, vehicle: e.target.value } as any)}
                                                placeholder="Toyota Camry"
                                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-white text-sm focus:outline-none focus:border-primary/50 placeholder-slate-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo</label>
                                            <select
                                                value={(editingOrder as any).vehicleType || 'sedan'}
                                                onChange={e => setEditingOrder({ ...editingOrder, vehicleType: e.target.value } as any)}
                                                className="w-full bg-[#0f1117] text-white border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-sm focus:outline-none focus:border-primary/50"
                                            >
                                                {vehicleTypes.length > 0
                                                    ? vehicleTypes.map(vt => <option key={vt.id} value={vt.name?.toLowerCase()}>{vt.name}</option>)
                                                    : ['Sedan', 'SUV', 'Truck', 'Van', 'RV'].map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)
                                                }
                                            </select>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Dirección</label>
                                        <input
                                            type="text"
                                            value={(editingOrder as any).address || ''}
                                            onChange={e => setEditingOrder({ ...editingOrder, address: e.target.value } as any)}
                                            placeholder="123 Main St, Los Angeles, CA..."
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-white text-sm focus:outline-none focus:border-primary/50 placeholder-slate-600"
                                        />
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notas del admin</label>
                                        <textarea
                                            value={(editingOrder as any).notes || ''}
                                            onChange={e => setEditingOrder({ ...editingOrder, notes: e.target.value } as any)}
                                            rows={2}
                                            placeholder="Instrucciones especiales para el washer..."
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 mt-1.5 text-white text-sm focus:outline-none focus:border-primary/50 placeholder-slate-600 resize-none"
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setEditingOrder(null)} className="flex-1 py-3 rounded-xl font-semibold text-sm text-slate-500 hover:bg-white/5 hover:text-white transition-all border border-white/[0.06]">
                                            Cancelar
                                        </button>
                                        <button onClick={handleSaveEdit} className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary text-black hover:opacity-90 active:scale-[0.98] transition-all">
                                            Guardar cambios
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {viewingOrderDetails && (
                        <div className="absolute inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
                            <div className="bg-[#0A0A0B] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/[0.06] shadow-2xl flex flex-col max-h-[92vh]">

                                {/* ── HEADER ── */}
                                <div className="px-6 py-5 flex items-center justify-between border-b border-white/[0.04] shrink-0">
                                    <div>
                                        <p className="text-[9px] uppercase font-bold tracking-[0.25em] text-slate-500">Order Summary</p>
                                        <p className="text-base font-semibold tracking-tight">#{viewingOrderDetails.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                            viewingOrderDetails.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' :
                                            viewingOrderDetails.status === 'Completed'   ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            viewingOrderDetails.status === 'Cancelled'   ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            viewingOrderDetails.status === 'Assigned'    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                                           'bg-white/5 text-slate-400 border-white/10'
                                        }`}>
                                            {viewingOrderDetails.status}
                                        </div>
                                        <button
                                            onClick={() => setViewingOrderDetails(null)}
                                            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                </div>

                                {/* ── SCROLLABLE BODY ── */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar">

                                    {/* Client */}
                                    <div className="px-6 py-5 border-b border-white/[0.04]">
                                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em] mb-2">Client</p>
                                        <p className="text-xl font-semibold text-white">{viewingOrderDetails.clientName}</p>
                                        <p className="text-slate-500 text-sm mt-0.5">{viewingOrderDetails.date} · {viewingOrderDetails.time}</p>
                                        {(() => {
                                            const client = clients.find(c => c.id === viewingOrderDetails.clientId);
                                            return client ? (
                                                <div className="mt-3 flex flex-wrap gap-3">
                                                    {client.phone && (
                                                        <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                                                            <span className="material-symbols-outlined text-sm">phone</span>{client.phone}
                                                        </a>
                                                    )}
                                                    {client.email && (
                                                        <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                                                            <span className="material-symbols-outlined text-sm">mail</span>{client.email}
                                                        </a>
                                                    )}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>

                                    {/* Washer */}
                                    <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="material-symbols-outlined text-slate-500">person</span>
                                            <div>
                                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.15em]">Assigned Washer</p>
                                                <p className="text-white text-sm font-medium">{viewingOrderDetails.washerName || 'Unassigned'}</p>
                                            </div>
                                        </div>
                                        {viewingOrderDetails.status === 'Pending' && (
                                            <button
                                                onClick={() => { setAssigningOrderId(viewingOrderDetails.id); setViewingOrderDetails(null); }}
                                                className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                                            >
                                                Assign
                                            </button>
                                        )}
                                    </div>

                                    {/* Location */}
                                    <div className="px-6 py-4 border-b border-white/[0.04]">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-slate-500 mt-0.5">location_on</span>
                                            <div>
                                                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.15em] mb-1">Location</p>
                                                <p className="text-white text-sm leading-relaxed">{viewingOrderDetails.address}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vehicle & Services */}
                                    <div className="px-6 py-5 border-b border-white/[0.04]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-slate-500 text-sm">directions_car</span>
                                            <h3 className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-500">Vehicle & Services</h3>
                                        </div>
                                        {viewingOrderDetails.vehicleConfigs && viewingOrderDetails.vehicleConfigs.length > 0 ? (
                                            viewingOrderDetails.vehicleConfigs.map((config: any, idx: number) => {
                                                const pkg = packages.find(p => p.id === config.packageId);
                                                const vType = config.vehicleType || 'sedan';
                                                const pkgPrice = pkg?.price?.[vType] || 0;
                                                const vehicleAddons = (config.addonIds || []).map((aid: string) => addons.find((a: any) => a.id === aid)).filter(Boolean);
                                                const addonsTotal = vehicleAddons.reduce((s: number, a: any) => s + (a.price?.[vType] || 0), 0);
                                                return (
                                                    <div key={idx} className="mb-2 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <p className="font-semibold text-white text-sm">{config.vehicleModel || viewingOrderDetails.vehicle}</p>
                                                            <p className="font-semibold text-white text-sm">${(pkgPrice + addonsTotal).toFixed(2)}</p>
                                                        </div>
                                                        <p className="text-slate-500 text-xs">{pkg?.name || 'Standard Wash'} · <span className="uppercase">{vType}</span></p>
                                                        {vehicleAddons.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-0.5">
                                                                {vehicleAddons.map((a: any) => (
                                                                    <div key={a.id} className="flex justify-between text-[11px] text-slate-500">
                                                                        <span>+ {a.name}</span>
                                                                        <span>+${(a.price?.[vType] || 0).toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex justify-between">
                                                <div>
                                                    <p className="font-semibold text-white text-sm">{viewingOrderDetails.vehicle}</p>
                                                    <p className="text-slate-500 text-xs mt-0.5">{viewingOrderDetails.service}</p>
                                                </div>
                                                <p className="font-semibold text-white text-sm">${viewingOrderDetails.price.toFixed(2)}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Financial Summary */}
                                    <div className="px-6 py-5 border-b border-white/[0.04]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-slate-500 text-sm">receipt_long</span>
                                            <h3 className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-500">Financial Summary</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Order Total</span>
                                                <span className="text-white font-medium">${(viewingOrderDetails.price || 0).toFixed(2)}</span>
                                            </div>
                                            {globalFees && globalFees.map((fee: any, i: number) => (
                                                <div key={i} className="flex justify-between text-sm">
                                                    <span className="text-slate-500">{fee.name} ({fee.percentage}%)</span>
                                                    <span className="text-red-400/80">-${((viewingOrderDetails.price || 0) * fee.percentage / 100).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {(viewingOrderDetails.tip || 0) > 0 && (
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-emerald-400">Tip</span>
                                                    <span className="text-emerald-400">+${(viewingOrderDetails.tip || 0).toFixed(2)}</span>
                                                </div>
                                            )}
                                            {(() => {
                                                const base = viewingOrderDetails.price || 0;
                                                const totalFeePercent = (globalFees || []).reduce((acc: number, fee: any) => acc + (fee.percentage || 0), 0);
                                                const fees = (base * totalFeePercent) / 100;
                                                const tip = viewingOrderDetails.tip || 0;
                                                const washerNet = base - fees + tip;
                                                return (
                                                    <div className="border-t border-white/[0.06] pt-3 mt-1 flex justify-between items-center">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Washer Net</span>
                                                        <span className="text-xl font-bold text-primary">${washerNet.toFixed(2)}</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Photos */}
                                    <div className="px-6 py-4 border-b border-white/[0.04]">
                                        <AdminOrderPhotos order={viewingOrderDetails} />
                                    </div>

                                    {/* Admin Action Buttons */}
                                    <div className="px-6 py-5">
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Modify */}
                                            <button
                                                onClick={() => {
                                                    setEditingOrder(viewingOrderDetails);
                                                    const configs = viewingOrderDetails.vehicleConfigs?.length > 0
                                                        ? JSON.parse(JSON.stringify(viewingOrderDetails.vehicleConfigs))
                                                        : [{ vehicleId: 'legacy', vehicleModel: viewingOrderDetails.vehicle || 'Unknown', vehicleType: viewingOrderDetails.vehicleType || 'Sedan', vehicleColor: 'Unknown', vehiclePlate: 'Unknown', packageId: '', addonIds: [], vehicleImage: '' }];
                                                    setTempConfigs(configs);
                                                    setEditingServicesOrder(viewingOrderDetails);
                                                    setViewingOrderDetails(null);
                                                }}
                                                disabled={viewingOrderDetails.status === 'Completed' || viewingOrderDetails.status === 'Cancelled'}
                                                className={`py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${viewingOrderDetails.status === 'Completed' || viewingOrderDetails.status === 'Cancelled' ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-white/8 hover:bg-white/15 text-white border border-white/10'}`}
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                Modify
                                            </button>

                                            {/* Refund */}
                                            <button
                                                onClick={async () => {
                                                    const paymentId = (viewingOrderDetails as any).paymentId;
                                                    const isPaid = viewingOrderDetails.paymentStatus === 'Paid';
                                                    showConfirm(
                                                        isPaid && paymentId ? 'Process Refund' : 'Mark as Refunded',
                                                        isPaid && paymentId
                                                            ? `Process refund of $${viewingOrderDetails.price} through Stripe?`
                                                            : `Mark this order as refunded? (No Stripe payment — manual refund needed)`,
                                                        async () => {
                                                            try {
                                                                showToast('Processing refund...', 'info');
                                                                if (isPaid && paymentId) {
                                                                    const result = await StripeService.refundPayment(viewingOrderDetails.id, paymentId, 'Admin initiated refund');
                                                                    showToast(`Refund successful! $${result.amount} refunded.`, 'success');
                                                                } else {
                                                                    await updateOrder(viewingOrderDetails.id, { paymentStatus: 'Refunded', refundedAt: new Date(), refundReason: 'Manual admin refund' } as any);
                                                                    showToast('Order marked as refunded', 'success');
                                                                }
                                                                setViewingOrderDetails(null);
                                                            } catch (error: any) {
                                                                showToast(error.message || 'Refund failed', 'error');
                                                            }
                                                        },
                                                        'danger'
                                                    );
                                                }}
                                                className="py-3.5 rounded-2xl font-bold text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-sm">undo</span>
                                                Refund
                                            </button>

                                            {/* Force Complete */}
                                            {viewingOrderDetails.status !== 'Completed' && viewingOrderDetails.status !== 'Cancelled' && (
                                                <button
                                                    onClick={() => {
                                                        showConfirm('Force Complete', 'Force complete this order?', () => {
                                                            updateOrder(viewingOrderDetails.id, { status: 'Completed' });
                                                            if (viewingOrderDetails.clientId) {
                                                                addLoyaltyPoints(viewingOrderDetails.clientId).then(pts => {
                                                                    showToast(pts > 0 ? `Completed & ${pts} loyalty pts awarded!` : 'Order completed', 'success');
                                                                });
                                                            } else {
                                                                showToast('Order completed', 'success');
                                                            }
                                                            setViewingOrderDetails(null);
                                                        }, 'primary');
                                                    }}
                                                    className="py-3.5 rounded-2xl font-bold text-sm bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    Complete
                                                </button>
                                            )}

                                            {/* Cancel */}
                                            {viewingOrderDetails.status !== 'Cancelled' && viewingOrderDetails.status !== 'Completed' && (
                                                <button
                                                    onClick={() => {
                                                        handleCancelOrder(viewingOrderDetails.id);
                                                        setViewingOrderDetails(null);
                                                    }}
                                                    className="py-3.5 rounded-2xl font-bold text-sm bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-white/10 hover:border-red-500/20 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined text-sm">cancel</span>
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_DASHBOARD} navigate={navigate} />}
                    {/* Render modals for this screen */}
                    <ConfirmationModal
                        isOpen={confirmModal.isOpen}
                        title={confirmModal.title}
                        message={confirmModal.message}
                        confirmText="Confirm"
                        cancelText="Cancel"
                        onConfirm={confirmModal.onConfirm}
                        onCancel={closeConfirm}
                        type={confirmModal.type}
                    />
                </div>
            </div>
        );
    }




    if (screen === AdminScreenEnum.ADMIN_CLIENTS) {
        const filteredClients = clients.filter(client => {
            const searchLower = clientSearch.toLowerCase();
            return (
                (client.name?.toLowerCase() || '').includes(searchLower) ||
                (client.email?.toLowerCase() || '').includes(searchLower) ||
                (client.phone?.toLowerCase() || '').includes(searchLower) ||
                (client.id?.toLowerCase() || '').includes(searchLower)
            );
        });

        return (
            <div className={`flex h-full bg-background-dark text-white ${isDesktop ? 'flex-row' : 'flex-col'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                {isDesktop && <TopBar title="Client Base" subtitle={`${clients.length} clients`}><button onClick={() => navigate(AdminScreenEnum.ADMIN_SETTINGS)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all"><span className="material-symbols-outlined text-[17px]">settings</span></button></TopBar>}
                <div className="flex-1 overflow-y-auto p-4">
                    {!isDesktop && <h1 className="text-2xl font-bold mb-4">Clients</h1>}

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Search by name, email, phone, or client #..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="w-full bg-surface-dark border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                        {clientSearch && (
                            <button
                                onClick={() => setClientSearch('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {filteredClients.map(client => (
                            <div key={client.id} onClick={() => setViewingClientHistory(client)} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex justify-between items-center cursor-pointer hover:bg-white/5">
                                <div>
                                    <div className="font-bold">{client.name}</div>
                                    <div className="text-xs text-slate-400">{client.email}</div>
                                    <div className="text-xs text-slate-500">{client.phone}</div>
                                    <div className="text-xs text-primary font-mono mt-1">Client #{client.id.substring(0, 8).toUpperCase()}</div>
                                </div>
                                <span className="material-symbols-outlined text-slate-500">chevron_right</span>
                            </div>
                        ))}
                        {filteredClients.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                                <p>No clients found</p>
                            </div>
                        )}
                    </div>
                </div>

                {viewingClientHistory && (
                    <div className="absolute inset-0 bg-background-dark z-30 flex flex-col animate-in slide-in-from-right">
                        <div className="p-4 border-b border-white/10 flex items-center gap-4">
                            <button onClick={() => setViewingClientHistory(null)}><span className="material-symbols-outlined">arrow_back</span></button>
                            <h2 className="font-bold">{viewingClientHistory.name}</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Client Contact Info */}
                            <div className="bg-surface-dark p-4 rounded-xl border border-white/5 mb-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Contact Information</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><span className="material-symbols-outlined text-slate-400 text-sm">mail</span></div>
                                        <div><p className="text-xs text-slate-400">Email</p><p className="font-medium">{viewingClientHistory.email}</p></div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><span className="material-symbols-outlined text-slate-400 text-sm">call</span></div>
                                        <div><p className="text-xs text-slate-400">Phone</p><p className="font-medium">{viewingClientHistory.phone}</p></div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><span className="material-symbols-outlined text-slate-400 text-sm">location_on</span></div>
                                        <div><p className="text-xs text-slate-400">Address</p><p className="font-medium">{viewingClientHistory.address}</p></div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><span className="material-symbols-outlined text-amber-500 text-sm">star</span></div>
                                        <div>
                                            <p className="text-xs text-slate-400">Client Rating</p>
                                            <p className="font-bold flex items-center gap-2">
                                                {typeof viewingClientHistory.rating === 'number' ? viewingClientHistory.rating.toFixed(1) : '5.0'}
                                                <span className="text-xs font-normal text-slate-500">
                                                    ({viewingClientHistory.cancellationCount || 0} cancellations)
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Loyalty Program Card - Rich Display */}
                            <div className="bg-surface-dark p-0 rounded-xl border border-white/5 mb-6 overflow-hidden relative">
                                {(() => {
                                    const points = viewingClientHistory.loyaltyPoints || 0;
                                    const currentTier = [...LOYALTY_TIERS].reverse().find(t => points >= t.minPoints) || LOYALTY_TIERS[0];
                                    const nextTierIndex = LOYALTY_TIERS.findIndex(t => t.name === currentTier.name) + 1;
                                    const nextTier = nextTierIndex < LOYALTY_TIERS.length ? LOYALTY_TIERS[nextTierIndex] : null;
                                    const progress = nextTier ? ((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100 : 100;

                                    return (
                                        <>
                                            <div className="p-4 relative z-10" style={{ background: `linear-gradient(135deg, ${currentTier.color}15 0%, ${currentTier.color}05 100%)` }}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Loyalty Program</h3>
                                                        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: currentTier.color }}>
                                                            {currentTier.name}
                                                            {currentTier.discount > 0 && <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white">{currentTier.discount}% OFF</span>}
                                                        </h2>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-slate-400">Points Balance</p>
                                                        <p className="text-2xl font-bold">{points}</p>
                                                    </div>
                                                </div>

                                                {nextTier && (
                                                    <div className="mt-4">
                                                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                                            <span>Progress to {nextTier.name}</span>
                                                            <span>{nextTier.minPoints - points} points needed</span>
                                                        </div>
                                                        <div className="w-full bg-black/20 rounded-full h-2">
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{
                                                                    width: `${Math.min(progress, 100)}%`,
                                                                    background: `linear-gradient(90deg, ${currentTier.color}, ${nextTier.color})`
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Benefits Summary - Collapsible or Just List */}
                                            <div className="p-4 border-t border-white/5 bg-black/20">
                                                <p className="text-xs font-bold text-slate-500 mb-2">Current Benefits</p>
                                                <div className="space-y-1">
                                                    {currentTier.benefits.slice(0, 3).map((b, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                                                            <span className="material-symbols-outlined text-[10px] text-green-400">check</span>
                                                            {b}
                                                        </div>
                                                    ))}
                                                    {currentTier.benefits.length > 3 && (
                                                        <div className="text-[10px] text-slate-500 italic">+ {currentTier.benefits.length - 3} more benefits</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div
                                                className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 pointer-events-none"
                                                style={{ background: currentTier.color, transform: 'translate(30%, -30%)' }}
                                            />
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Role Management */}
                            <div className="bg-surface-dark p-4 rounded-xl border border-white/5 mb-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Role Management</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                        <div>
                                            <p className="text-sm font-bold">Current Role</p>
                                            <p className="text-xs text-slate-400 capitalize">{viewingClientHistory.role || 'client'}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${viewingClientHistory.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                                            viewingClientHistory.role === 'washer' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-green-500/20 text-green-400'
                                            }`}>
                                            {viewingClientHistory.role?.toUpperCase() || 'CLIENT'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <button
                                            onClick={async () => {
                                                console.log('­ƒöÁ Make Washer button clicked');
                                                console.log('viewingClientHistory:', viewingClientHistory);
                                                console.log('updateUserProfile function:', typeof updateUserProfile);

                                                // Execute immediately without confirmation for now
                                                console.log('Ô£à Executing promotion to Washer');

                                                try {
                                                    await updateUserProfile(viewingClientHistory.id, { role: 'washer', status: 'Active' });
                                                    console.log('Ô£à updateUserProfile completed');

                                                    // Send email notification
                                                    try {
                                                        const { NotificationService } = await import('../services/NotificationService');
                                                        await NotificationService.sendEmail(
                                                            viewingClientHistory.email,
                                                            '­ƒÄë Welcome to the Team! You Are Now a Washer',
                                                            `Hi ${viewingClientHistory.name},\n\nGreat news! You have been promoted to a Washer in our car wash team!\n\nYou can now log in to the Washer Panel using your existing credentials:\n\nEmail: ${viewingClientHistory.email}\n\nSimply log in to our app and you'll automatically be directed to the Washer Dashboard where you can start accepting jobs.\n\nWelcome aboard!\n\nBest regards,\nThe Car Wash Team`
                                                        );
                                                        console.log('Ô£à Email sent');
                                                    } catch (error) {
                                                        console.error('ÔØî Error sending email:', error);
                                                    }

                                                    setViewingClientHistory(null);
                                                } catch (error) {
                                                    console.error('ÔØî Error in updateUserProfile:', error);
                                                    showToast('Error updating user role', 'error');
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-blue-400 text-sm">engineering</span>
                                            <span className="text-xs font-bold text-blue-400">Make Washer</span>
                                        </button>

                                        <button
                                            onClick={async () => {
                                                showConfirm(
                                                    'Promote to Admin',
                                                    `ÔÜá´©Å Promote ${viewingClientHistory.name} to Admin? This gives full access to the system.`,
                                                    async () => {
                                                        updateUserProfile(viewingClientHistory.id, { role: 'admin', status: 'Active' });

                                                        // Send email notification
                                                        try {
                                                            const { NotificationService } = await import('../services/NotificationService');
                                                            await NotificationService.sendEmail(
                                                                viewingClientHistory.email,
                                                                '­ƒÄë You Are Now an Administrator',
                                                                `Hi ${viewingClientHistory.name},\n\nYou have been promoted to Administrator in our car wash system!\n\nYou can now log in to the Admin Panel using your existing credentials:\n\nEmail: ${viewingClientHistory.email}\n\nSimply log in to our app and you'll automatically be directed to the Admin Dashboard where you have full access to manage the system.\n\nBest regards,\nThe Car Wash Team`
                                                            );
                                                        } catch (error) {
                                                            console.error('Error sending email:', error);
                                                        }

                                                        showToast(`${viewingClientHistory.name} is now an Admin! Email sent.`, 'success');
                                                        setViewingClientHistory(null);
                                                    },
                                                    'danger'
                                                );
                                            }}
                                            className="flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-red-400 text-sm">admin_panel_settings</span>
                                            <span className="text-xs font-bold text-red-400">Make Admin</span>
                                        </button>
                                    </div>

                                    {viewingClientHistory.role !== 'client' && (
                                        <div className="space-y-2 mt-2">
                                            <button
                                                onClick={() => {
                                                    showConfirm(
                                                        'Demote to Client',
                                                        `Demote ${viewingClientHistory.name} back to Client?`,
                                                        () => {
                                                            updateUserProfile(viewingClientHistory.id, { role: 'client' });
                                                            showToast(`${viewingClientHistory.name} is now a Client`, 'info');
                                                            setViewingClientHistory(null);
                                                        },
                                                        'primary'
                                                    );
                                                }}
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/30 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                                                <span className="text-xs font-bold text-slate-400">Demote to Client</span>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    showConfirm(
                                                        'Delete User',
                                                        `ÔÜá´©Å DELETE ${viewingClientHistory.name}? This action cannot be undone!`,
                                                        () => {
                                                            deleteUser(viewingClientHistory.id);
                                                            showToast(`${viewingClientHistory.name} has been deleted`, 'info');
                                                            setViewingClientHistory(null);
                                                        },
                                                        'danger'
                                                    );
                                                }}
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-red-400 text-sm">delete_forever</span>
                                                <span className="text-xs font-bold text-red-400">Delete User</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Order History</h3>
                            <div className="space-y-3">
                                {getClientHistory(viewingClientHistory.name).map(o => (
                                    <div key={o.id} onClick={() => setViewingOrderDetails(o)} className="bg-surface-dark p-3 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between"><span className="font-bold">{o.date}</span><span className="text-xs">{o.status}</span></div>
                                        <div className="text-sm text-slate-400">{o.service}</div>
                                        <div className="text-right font-bold text-sm">${o.price}</div>
                                    </div>
                                ))}
                                {getClientHistory(viewingClientHistory.name).length === 0 && <div className="text-slate-500 text-center">No history available</div>}
                            </div>
                        </div>
                    </div>
                )
                }

                {/* Order Details Modal (Reused for Client View) */}
                {
                    viewingOrderDetails && (
                        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                            <div className="bg-surface-dark w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                    <h3 className="font-bold text-lg">Order Details #{viewingOrderDetails.id}</h3>
                                    <button onClick={() => setViewingOrderDetails(null)}><span className="material-symbols-outlined">close</span></button>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Client Info</h4>
                                            <p className="font-bold text-lg">{viewingOrderDetails.clientName}</p>
                                            <p className="text-sm text-slate-300">123 Main St (Mock Address)</p>
                                            <p className="text-sm text-slate-300">+1 (555) 000-0000</p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Service Info</h4>
                                            <p className="font-bold">{viewingOrderDetails.service}</p>
                                            <p className="text-sm text-slate-300">{viewingOrderDetails.vehicle} ({viewingOrderDetails.vehicleType})</p>
                                            <p className="text-sm font-bold text-primary mt-1">${viewingOrderDetails.price}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <AdminOrderPhotos order={viewingOrderDetails} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_CLIENTS} navigate={navigate} />}
                </div>
            </div >
        );
    }

    if (screen === AdminScreenEnum.ADMIN_PAYROLL) {
        // Helper to generate week options
        const weekOptions = (() => {
            const opts = [];
            const now = new Date();
            const day = now.getDay() || 7; // Mon=1
            const currentMonday = new Date(now);
            currentMonday.setDate(now.getDate() - (day - 1));
            currentMonday.setHours(0, 0, 0, 0);

            for (let i = 0; i < 12; i++) {
                const d = new Date(currentMonday);
                d.setDate(d.getDate() - (i * 7));
                const end = new Date(d);
                end.setDate(end.getDate() + 6);
                const label = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                opts.push({ value: d.getTime(), label: i === 0 ? `Current Week (${label})` : label });
            }
            return opts;
        })();

        // Calculate Payroll Data
        const payrollData = (() => {
            const start = new Date(payrollWeek);
            const end = new Date(payrollWeek);
            end.setDate(end.getDate() + 6);
            end.setHours(23, 59, 59, 999);



            // Filter Orders for Week
            const weeklyOrders = orders.filter(o => {
                let t = 0;
                if (o.completedAt) {
                    t = (o.completedAt as any)?.seconds ? (o.completedAt as any).seconds * 1000 : new Date(o.completedAt).getTime();
                } else {
                    let dStr = o.date;
                    if (dStr === 'Today') dStr = new Date().toISOString().split('T')[0];
                    else if (dStr === 'Tomorrow') {
                        const next = new Date();
                        next.setDate(next.getDate() + 1);
                        dStr = next.toISOString().split('T')[0];
                    }
                    t = new Date(dStr).getTime();
                }

                const inRange = t >= start.getTime() && t <= end.getTime();
                // Include Completed and Cancelled orders as requested
                return inRange && (o.status === 'Completed' || o.status === 'Cancelled');
            });

            // Calculate Totals & Group by Washer
            const grouped: any[] = [];
            const washers = team.filter(m => m.role === 'washer');

            washers.forEach(washer => {
                const washerOrders = weeklyOrders.filter(o => o.washerId === washer.id);
                if (washerOrders.length === 0) return;

                // Global Fees
                const totalFeePercent = globalFees.reduce((acc, fee) => acc + (fee.percentage || 0), 0);

                let gross = 0;
                let tips = 0;
                let deductions = 0;
                let net = 0;

                const enrichedOrders = washerOrders.map(o => {
                    const price = o.price || 0;
                    const tip = o.tip || 0;
                    let orderNet = 0;
                    let orderDeduction = 0;

                    if (o.status === 'Completed') {
                        orderDeduction = (price * totalFeePercent) / 100;
                        orderNet = (price - orderDeduction) + tip;

                        gross += price;
                        tips += tip;
                        deductions += orderDeduction;
                        net += orderNet;
                    }
                    // Cancelled: typically 0 unless a specific fee logic exists. Assuming 0 pay for now.

                    return { ...o, calculatedNet: orderNet, calculatedDeduction: orderDeduction };
                });

                // Check Existing Payment
                const weekId = `week_${start.toISOString().split('T')[0]}`;
                const payment = payments.find(p => p.washerId === washer.id && p.periodId === weekId);

                grouped.push({
                    washer,
                    gross,
                    tips,
                    deductions,
                    net,
                    jobCount: washerOrders.length,
                    isPaid: !!payment,
                    payment,
                    orders: enrichedOrders
                });
            });

            return grouped;
        })();

        const handleMarkPaid = async (item: any) => {
            showConfirm(
                'Confirm Payment',
                `Confirm payment of $${item.net.toFixed(2)} to ${item.washer.name}?`,
                async () => {

                    const start = new Date(payrollWeek);
                    const weekId = `week_${start.toISOString().split('T')[0]}`;

                    try {
                        await addDoc(collection(db, 'payments'), {
                            washerId: item.washer.id,
                            washerName: item.washer.name,
                            periodId: weekId,
                            weekStart: start.toISOString(),
                            amount: item.net,
                            paidDate: new Date().toISOString(),
                            paidBy: currentUser.id || 'admin',
                            status: 'Paid',
                            orderIds: item.orders.map((o: any) => o.id)
                        });
                        showToast('Payment recorded successfully', 'success');
                    } catch (e) {
                        console.error(e);
                        showToast('Error recording payment', 'error');
                    }
                },
                'primary'
            );
        };

        // Stats
        const totalUnpaid = payrollData.filter(i => !i.isPaid).reduce((sum, i) => sum + i.net, 0);
        const totalPaid = payrollData.filter(i => i.isPaid).reduce((sum, i) => sum + i.net, 0);

        return (
            <div className={`flex h-full bg-background-dark text-white ${isDesktop ? 'flex-row' : 'flex-col'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold">Payroll & Payouts</h1>
                                <p className="text-slate-400 text-sm">Manage team payments</p>
                            </div>

                            <select
                                value={payrollWeek}
                                onChange={(e) => setPayrollWeek(Number(e.target.value))}
                                className="bg-surface-dark border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                            >
                                {weekOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </header>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">To Pay (This Week)</div>
                                <div className="text-2xl font-bold text-yellow-400">${totalUnpaid.toFixed(2)}</div>
                                <div className="text-xs text-slate-500">Unpaid balance</div>
                            </div>
                            <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                                <div className="text-slate-400 text-xs uppercase font-bold mb-1">Paid (This Week)</div>
                                <div className="text-2xl font-bold text-teal-400">${totalPaid.toFixed(2)}</div>
                                <div className="text-xs text-slate-500">Already disbursed</div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/10">
                            <button
                                onClick={() => setPayrollTab('pending')}
                                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${payrollTab === 'pending' ? 'border-primary text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                            >
                                Weekly Payouts
                            </button>
                            <button
                                onClick={() => setPayrollTab('history')}
                                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${payrollTab === 'history' ? 'border-primary text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                            >
                                Payment History
                            </button>
                        </div>

                        {/* Content */}
                        {payrollTab === 'pending' ? (
                            <div className="space-y-4">
                                {payrollData.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500 bg-surface-dark rounded-xl border border-white/5">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">money_off</span>
                                        <p>No completed jobs found for this week.</p>
                                    </div>
                                ) : (
                                    payrollData.map((item, idx) => (
                                        <div key={idx} className="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
                                            <div
                                                className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                                                onClick={() => setExpandedPayrollItem(expandedPayrollItem === item.washer.id ? null : item.washer.id)}
                                            >
                                                <div className="flex items-center gap-4 w-full md:w-auto">
                                                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white relative">
                                                        {item.washer.name.charAt(0)}
                                                        <div className="absolute -bottom-1 -right-1 bg-surface-dark rounded-full">
                                                            <span className={`material-symbols-outlined text-sm ${expandedPayrollItem === item.washer.id ? 'rotate-180' : ''} transition-transform`}>expand_more</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{item.washer.name}</div>
                                                        <div className="text-xs text-slate-400">{item.jobCount} Orders (Inc. Cancelled) ÔÇó Gross: ${item.gross.toFixed(2)}</div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400">Net Pay</div>
                                                        <div className="text-xl font-bold text-white">${item.net.toFixed(2)}</div>
                                                        <div className="text-[10px] text-slate-500">Tips: ${item.tips.toFixed(2)}</div>
                                                    </div>

                                                    {item.isPaid ? (
                                                        <div className="px-4 py-2 bg-teal-500/20 text-teal-400 rounded-lg text-sm font-bold flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                                            Paid
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkPaid(item);
                                                            }}
                                                            className="px-5 py-2.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-primary/20 hover:shadow-primary/40"
                                                        >
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {expandedPayrollItem === item.washer.id && (
                                                <div className="border-t border-white/10 bg-black/20 p-4">
                                                    <table className="w-full text-left text-sm">
                                                        <thead>
                                                            <tr className="text-slate-500 border-b border-white/10">
                                                                <th className="pb-2 font-normal">Order #</th>
                                                                <th className="pb-2 font-normal">Status</th>
                                                                <th className="pb-2 font-normal">Date</th>
                                                                <th className="pb-2 font-normal text-right">Price</th>
                                                                <th className="pb-2 font-normal text-right">Fee (App)</th>
                                                                <th className="pb-2 font-normal text-right">Tip</th>
                                                                <th className="pb-2 font-normal text-right text-teal-400">Net Pay</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {item.orders.map((o: any) => (
                                                                <tr key={o.id} className="text-slate-300 hover:bg-white/5 transition-colors">
                                                                    <td className="py-3 flex items-center gap-2">
                                                                        <span className="font-mono bg-white/10 px-1 rounded text-[10px] text-slate-400">#{o.id.substring(0, 8)}</span>
                                                                    </td>
                                                                    <td className="py-3">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${o.status === 'Completed' ? 'bg-green-500/20 text-green-400' :
                                                                            o.status === 'Cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'
                                                                            }`}>
                                                                            {o.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 text-xs text-slate-500">
                                                                        {new Date(o.completedAt?.seconds ? o.completedAt.seconds * 1000 : o.date).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="py-3 text-right text-slate-400">${(o.price || 0).toFixed(2)}</td>
                                                                    <td className="py-3 text-right text-red-400/70">-${(o.calculatedDeduction || 0).toFixed(2)}</td>
                                                                    <td className="py-3 text-right text-yellow-400/70">+${(o.tip || 0).toFixed(2)}</td>
                                                                    <td className="py-3 text-right font-bold text-teal-400">${(o.calculatedNet || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {payments.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">No payment history found.</div>
                                ) : (
                                    payments.map(p => (
                                        <div key={p.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-white">{p.washerName}</div>
                                                <div className="text-xs text-slate-400">Week of {new Date(p.periodId.replace('week_', '')).toLocaleDateString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-teal-400">${p.amount.toFixed(2)}</div>
                                                <div className="text-[10px] text-slate-500">Paid: {new Date(p.paidDate).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (screen === AdminScreenEnum.ADMIN_ANALYTICS) {
        return (
            <div className={`flex h-full bg-background-dark text-white ${isDesktop ? 'flex-row' : 'flex-col'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                {isDesktop && <TopBar title="Analytics" subtitle="Performance & trends"><button onClick={() => navigate(AdminScreenEnum.ADMIN_SETTINGS)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all"><span className="material-symbols-outlined text-[17px]">settings</span></button></TopBar>}
                <div className="flex-1 overflow-y-auto p-4">
                    {!isDesktop && <h1 className="text-2xl font-bold mb-6">Analytics</h1>}

                    {/* Time Range Selector */}
                    <div className="bg-surface-dark p-1 rounded-lg flex border border-white/10 mb-6">
                        {(['day', 'week', 'month', 'year'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors uppercase ${timeRange === range ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* 1. Gross Revenue */}
                        <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-slate-400 text-xs uppercase font-bold">Total Revenue</span>
                                <span className="material-symbols-outlined text-green-400">payments</span>
                            </div>
                            <div className="text-3xl font-bold text-green-400">${analyticsData.grossRevenue.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">Gross income ({timeRange})</div>
                        </div>

                        {/* 2. Washer Payouts */}
                        <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-slate-400 text-xs uppercase font-bold">Washer Pay</span>
                                <span className="material-symbols-outlined text-blue-400">account_balance_wallet</span>
                            </div>
                            <div className="text-3xl font-bold text-blue-400">${analyticsData.washerPayout.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">Washer Share (Net + Tips)</div>
                        </div>

                        {/* 3. Net Profit (Commissions) */}
                        <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-slate-400 text-xs uppercase font-bold">App Profit</span>
                                <span className="material-symbols-outlined text-purple-400">savings</span>
                            </div>
                            <div className="text-3xl font-bold text-purple-400">${analyticsData.appProfit.toFixed(2)}</div>
                            <div className="text-xs text-slate-500 mt-1">Total Admin Fees</div>
                        </div>

                        {/* 4. Total Orders */}
                        <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-slate-400 text-xs uppercase font-bold">Orders</span>
                                <span className="material-symbols-outlined text-white">list_alt</span>
                            </div>
                            <div className="text-3xl font-bold text-white">{analyticsData.completedCount}</div>
                            <div className="text-xs text-slate-500 mt-1">Completed ({timeRange})</div>
                        </div>
                    </div>

                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                        <h3 className="font-bold mb-4">Recent Feedback</h3>
                        <div className="space-y-4">
                            {orders.filter(o => o.rating && o.review).slice(0, 3).length > 0 ? (
                                orders.filter(o => o.rating && o.review).slice(0, 3).map(order => (
                                    <div key={order.id} className="border-b border-white/5 pb-3 last:border-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-sm">{order.clientName}</span>
                                            <div className="flex text-yellow-400 text-xs">
                                                {Array.from({ length: order.rating || 0 }).map((_, i) => (
                                                    <span key={i} className="material-symbols-outlined text-sm">star</span>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400">"{order.review}"</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 text-sm">No feedback yet</p>
                            )}
                        </div>
                    </div>
                </div>
                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_ANALYTICS} navigate={navigate} />}
                </div>
            </div>
        );
    }


    if (screen === AdminScreenEnum.ADMIN_PRICING) {
        return (
            <div className={`flex h-full bg-background-dark text-white ${isDesktop ? 'flex-row' : 'flex-col'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 flex flex-col h-full overflow-hidden items-center">
                    <div className="w-full max-w-5xl flex flex-col h-full">
                        <header className="px-4 py-6 border-b border-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => navigate(AdminScreenEnum.ADMIN_DASHBOARD)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                                        <span className="material-symbols-outlined">arrow_back</span>
                                    </button>
                                    <h1 className="text-2xl font-bold">Services & Pricing</h1>
                                </div>
                                <button onClick={startAddNew} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-95">
                                    <span className="material-symbols-outlined text-sm">add_circle</span>
                                    <span className="hidden sm:inline">Add New Service</span>
                                </button>
                            </div>
                            <div className="bg-surface-dark/60 backdrop-blur-md p-1.5 rounded-2xl flex border border-white/10 shadow-inner">
                                <button onClick={() => setPricingTab('packages')} className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all duration-300 tracking-wider uppercase ${pricingTab === 'packages' ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Packages</button>
                                <button onClick={() => setPricingTab('addons')} className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all duration-300 tracking-wider uppercase ${pricingTab === 'addons' ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Add-ons</button>
                                <button onClick={() => setPricingTab('vehicleTypes')} className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all duration-300 tracking-wider uppercase ${pricingTab === 'vehicleTypes' ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Vehicle Types</button>
                                <button onClick={() => setPricingTab('settings')} className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all duration-300 flex items-center justify-center ${pricingTab === 'settings' ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><span className="material-symbols-outlined text-lg">settings</span></button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto px-4 py-6 pb-24 space-y-4">
                            {pricingTab === 'packages' && (
                                <div className="mb-6 flex gap-2">
                                    <button
                                        onClick={async () => {
                                            showConfirm(
                                                'Reset Packages',
                                                'This will RESET all packages to defaults (Basic, Premium, Deluxe) with new pricing structure. Continue?',
                                                async () => {
                                                    await seedServicePackages();
                                                    showToast('Packages seeded successfully!', 'success');
                                                    // Force reload or wait for listener
                                                },
                                                'danger'
                                            );
                                        }}
                                        className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-4 py-2 rounded-xl text-xs font-black hover:bg-purple-500/20 transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">database</span>
                                        Seed Default Packages
                                    </button>
                                </div>
                            )}
                            {pricingTab === 'packages' && [...packages].sort((a, b) => {
                                const aPrice = a.price?.['sedan'] || a.price?.['Sedan'] || a.price?.['compact_car'] || a.price?.['midsize_sedan'] || 0;
                                const bPrice = b.price?.['sedan'] || b.price?.['Sedan'] || b.price?.['compact_car'] || b.price?.['midsize_sedan'] || 0;
                                return aPrice - bPrice;
                            }).map(pkg => (
                                <div key={pkg.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex gap-4 items-start group">
                                    <div className="w-20 h-20 rounded-lg bg-cover bg-center shrink-0" style={{ backgroundImage: `url("${pkg.image || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\' viewBox=\'0 0 150 150\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%231a2431\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'Inter,sans-serif\' font-size=\'14\' fill=\'%23a0aec0\'%3ENo Image%3C/text%3E%3C/svg%3E'}")` }}></div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-lg">{pkg.name}</h3>
                                            <span className="text-primary font-bold text-lg">
                                                ${pkg.price?.['sedan'] || pkg.price?.['Sedan'] || pkg.price?.['compact_car'] || pkg.price?.['midsize_sedan'] || 0}+
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">{pkg.description}</p>
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">schedule</span> {pkg.duration}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditItemModal(pkg)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
                                        <button onClick={() => handleDeleteItem(pkg.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20">
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {pricingTab === 'addons' && (
                                <div className="mb-6 flex gap-2">
                                    <button
                                        onClick={async () => {
                                            showConfirm(
                                                'Reset Add-ons',
                                                'This will reset all add-ons to defaults with new fair pricing. Continue?',
                                                async () => {
                                                    await seedServiceAddons();
                                                    showToast('Add-ons seeded successfully!', 'success');
                                                },
                                                'danger'
                                            );
                                        }}
                                        className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-4 py-2 rounded-xl text-xs font-black hover:bg-purple-500/20 transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">database</span>
                                        Seed Default Add-ons
                                    </button>
                                </div>
                            )}
                            {pricingTab === 'addons' && addons.map(addon => (
                                <div key={addon.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center justify-between group">
                                    <div><h3 className="font-bold text-lg">{addon.name}</h3><p className="text-sm text-slate-400">{addon.description}</p><div className="flex items-center gap-2 mt-2"><span className="text-xs text-slate-500 flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {addon.duration}</span></div></div>
                                    <div className="flex items-center gap-6"><span className="text-primary font-bold text-lg">${addon.price['Sedan']}+</span><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openEditItemModal(addon)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20"><span className="material-symbols-outlined text-sm">edit</span></button><button onClick={() => handleDeleteItem(addon.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><span className="material-symbols-outlined text-sm">delete</span></button></div></div>
                                </div>
                            ))}
                            {pricingTab === 'vehicleTypes' && (
                                <div className="mb-6 flex gap-2">
                                    <button
                                        onClick={async () => {
                                            showConfirm(
                                                'Reset Vehicle Types',
                                                'This will reset vehicle types to default. Continue?',
                                                async () => {
                                                    await seedVehicleTypes();
                                                    showToast('Vehicle types seeded!', 'success');
                                                },
                                                'danger'
                                            );
                                        }}
                                        className="bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-500/30 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">database</span>
                                        Seed Default Types
                                    </button>
                                </div>
                            )}
                            {pricingTab === 'vehicleTypes' && vehicleTypes.map(type => (
                                <div key={type.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center overflow-hidden p-2">
                                            {renderIcon(type.icon)}
                                        </div>
                                        <h3 className="font-bold text-lg">{type.name}</h3>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setIsNewItem(false); setEditingItem(type); setNewVehicleType({ name: type.name, icon: type.icon || 'directions_car' }); }} className="p-2 bg-white/10 rounded-lg hover:bg-white/20"><span className="material-symbols-outlined text-sm">edit</span></button>
                                        <button onClick={() => handleDeleteItem(type.id)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><span className="material-symbols-outlined text-sm">delete</span></button>
                                    </div>
                                </div>
                            ))}

                            {/* GLOBAL FEES & SETTINGS TAB */}
                            {pricingTab === 'settings' && (
                                <div className="space-y-6">
                                    <div className="bg-surface-dark p-6 rounded-xl border border-white/5">
                                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">percent</span>
                                            Global Order Deductions
                                        </h3>
                                        <p className="text-sm text-slate-400 mb-6">
                                            These fees are automatically deducted from the Total Order Price before calculating Washer payout.
                                        </p>

                                        <div className="space-y-4">
                                            {globalFees.map((fee, index) => (
                                                <div key={index} className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                                                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">%</div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={fee.name}
                                                            onChange={(e) => updateGlobalFee(index, 'name', e.target.value)}
                                                            className="font-bold bg-transparent outline-none w-full text-white"
                                                        />
                                                        <p className="text-xs text-slate-400">Deduction</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={fee.percentage}
                                                            onChange={(e) => updateGlobalFee(index, 'percentage', parseFloat(e.target.value))}
                                                            className="font-bold text-xl bg-transparent outline-none text-right w-16 text-white"
                                                        />
                                                        <span className="font-bold text-xl text-white">%</span>
                                                        <button onClick={() => deleteGlobalFee(index)} className="p-2 hover:bg-white/10 rounded-lg text-red-400"><span className="material-symbols-outlined text-sm">delete</span></button>
                                                    </div>
                                                </div>
                                            ))}

                                            <button onClick={addGlobalFee} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white hover:border-white/40 font-bold text-sm flex items-center justify-center gap-2">
                                                <span className="material-symbols-outlined">add</span>
                                                Add New Fee
                                            </button>

                                            <div className="pt-4 border-t border-white/10 flex justify-end">
                                                <button onClick={saveGlobalFeesToFirestore} className="bg-primary px-6 py-2 rounded-lg font-bold hover:bg-primary-dark text-white">Save Changes</button>
                                            </div>

                                            {/* Language Selector removed */}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TYPE SELECTION MODAL */}
                    {
                        showTypeSelectionModal && <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4"><div className="bg-surface-dark w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 text-center"><h3 className="text-xl font-bold mb-6">What would you like to add?</h3><div className="space-y-3">
                            <button onClick={() => selectTypeAndOpenModal('packages')} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><span className="material-symbols-outlined text-primary">inventory_2</span> Service Package</button>
                            <button onClick={() => selectTypeAndOpenModal('addons')} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><span className="material-symbols-outlined text-purple-400">extension</span> Add-on Service</button>
                            <button onClick={() => {
                                const newId = `vt_${Date.now()}`;
                                setPricingTab('vehicleTypes');
                                setShowTypeSelectionModal(false);
                                setIsNewItem(true);
                                setEditingItem({ id: newId, name: 'New Vehicle Type' } as any);
                                setNewVehicleType({ name: '', icon: 'directions_car' });
                            }} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><span className="material-symbols-outlined text-slate-300">directions_car</span> Vehicle Type</button>
                        </div><button onClick={() => setShowTypeSelectionModal(false)} className="mt-6 text-slate-400 text-sm hover:text-white">Cancel</button></div></div>
                    }

                    {/* EDIT ITEM MODAL - Supports Vehicle Type Pricing for BOTH */}
                    {
                        editingItem && (
                            <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                                <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                                    <div className="p-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-lg">{isNewItem ? 'Add New' : 'Edit'} {pricingTab === 'packages' ? 'Package' : 'Add-on'}</h3><button onClick={() => setEditingItem(null)}><span className="material-symbols-outlined">close</span></button></div>
                                    <div className="p-6 overflow-y-auto space-y-4">
                                        {pricingTab === 'vehicleTypes' ? (
                                            <>
                                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Vehicle Type Name</label><input type="text" value={newVehicleType.name} onChange={e => setNewVehicleType({ ...newVehicleType, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" /></div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Icon (URL or Material Symbol)</label>
                                                    <div className="flex gap-2 mb-3">
                                                        <input type="text" value={newVehicleType.icon} onChange={e => setNewVehicleType({ ...newVehicleType, icon: e.target.value })} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" placeholder="e.g. directions_car or /assets/sedan.png" />
                                                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden p-1">
                                                            {newVehicleType.icon && renderIcon(newVehicleType.icon)}
                                                        </div>
                                                    </div>

                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Quick Select</label>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {[
                                                            { i: '/assets/vehicles/sedan.webp', l: 'Sedan' },
                                                            { i: '/assets/vehicles/suv.webp', l: 'SUV' },
                                                            { i: '/assets/vehicles/pickup.webp', l: 'Pickup' },
                                                            { i: '/assets/vehicles/van.webp', l: 'Van' },
                                                            { i: '/assets/vehicles/trailer.webp', l: 'Trailer' },
                                                            { i: '/assets/vehicles/trailer_box.webp', l: 'Trl Box' },
                                                            { i: 'two_wheeler', l: 'Moto' },
                                                            { i: 'sports_motorsports', l: 'Sport' },
                                                            { i: 'agriculture', l: 'Tractor' },
                                                            { i: 'directions_bus', l: 'Bus' }
                                                        ].map((item) => (
                                                            <button
                                                                key={item.i}
                                                                onClick={() => setNewVehicleType({ ...newVehicleType, icon: item.i })}
                                                                className={`p-2 rounded-lg border flex flex-col items-center gap-1 ${newVehicleType.icon === item.i ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                                            >
                                                                <div className="w-8 h-8 flex items-center justify-center">
                                                                    {renderIcon(item.i)}
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{item.l}</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="mt-6 pt-4 border-t border-white/10">
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Prices for this Vehicle Type</label>
                                                        <div className="space-y-1 bg-white/5 rounded-xl p-2 max-h-64 overflow-y-auto">
                                                            {packages.length === 0 && addons.length === 0 && <div className="text-center text-slate-500 py-4 text-xs">No services found.</div>}

                                                            <h4 className="text-[9px] font-bold text-slate-600 uppercase px-2 py-1 mt-2">Packages</h4>
                                                            {packages.map(pkg => (
                                                                <div key={pkg.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                        <span className="text-sm font-bold block text-white truncate">{pkg.name}</span>
                                                                        <span className="text-[10px] text-slate-500 block">{pkg.duration || 'No duration'}</span>
                                                                    </div>
                                                                    <div className="flex items-center bg-black/40 rounded-lg border border-white/10 focus-within:border-primary transition-colors overflow-hidden w-24">
                                                                        <span className="pl-3 text-slate-500 text-sm">$</span>
                                                                        <input
                                                                            type="number"
                                                                            value={tempVehiclePrices[pkg.id] || 0}
                                                                            onChange={e => setTempVehiclePrices({ ...tempVehiclePrices, [pkg.id]: parseFloat(e.target.value) || 0 })}
                                                                            className="w-full bg-transparent p-2 text-right font-bold text-white outline-none text-sm"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            <h4 className="text-[9px] font-bold text-slate-600 uppercase px-2 py-1 mt-4">Add-ons</h4>
                                                            {addons.map(addon => (
                                                                <div key={addon.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                        <span className="text-sm font-bold block text-white truncate">{addon.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center bg-black/40 rounded-lg border border-white/10 focus-within:border-primary transition-colors overflow-hidden w-24">
                                                                        <span className="pl-3 text-slate-500 text-sm">$</span>
                                                                        <input
                                                                            type="number"
                                                                            value={tempVehiclePrices[addon.id] || 0}
                                                                            onChange={e => setTempVehiclePrices({ ...tempVehiclePrices, [addon.id]: parseFloat(e.target.value) || 0 })}
                                                                            className="w-full bg-transparent p-2 text-right font-bold text-white outline-none text-sm"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 mt-2 text-center">
                                                            Updating these prices will actively modify the Pricing structure for all selected Services.
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Name</label><input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" /></div>
                                                <div className="space-y-2">
                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Prices per Vehicle Type</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {(vehicleTypes && vehicleTypes.length > 0 ? vehicleTypes : []).map((vt) => (
                                                            <div key={vt.id} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/10">
                                                                <div className="flex flex-col flex-1 min-w-0">
                                                                    <span className="text-[10px] font-bold text-slate-400 truncate uppercase">{vt.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="number"
                                                                        value={(editingItem as any).price?.[vt.id] || 0}
                                                                        onChange={e => setEditingItem({ ...editingItem, price: { ...(editingItem as any).price, [vt.id]: parseFloat(e.target.value) || 0 } })}
                                                                        className="w-16 bg-transparent text-right font-bold focus:outline-none text-white text-sm"
                                                                    />
                                                                    <span className="text-slate-500 text-xs">$</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Duration</label><input type="text" value={(editingItem as any).duration || ''} onChange={e => setEditingItem({ ...editingItem, duration: e.target.value })} placeholder="e.g. 30m" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 text-white" /></div>
                                                <div><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label><textarea rows={3} value={editingItem.description} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white" /></div>
                                                {(pricingTab === 'packages' || pricingTab === 'addons') && (
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Image</label>

                                                        {isUploading ? (
                                                            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                                                                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                                                                <span className="text-sm text-slate-300">Uploading image...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {(editingItem as any).image && (
                                                                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10 group">
                                                                        <img src={(editingItem as any).image} alt="Service Item" className="w-full h-full object-cover" />
                                                                        <button
                                                                            onClick={() => setEditingItem({ ...editingItem, image: '' })}
                                                                            className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                <div className="flex gap-2">
                                                                    <label className="flex-1 cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-colors">
                                                                        <span className="material-symbols-outlined text-slate-400">cloud_upload</span>
                                                                        <span className="text-xs text-slate-400 font-bold uppercase">Upload Photo</span>
                                                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                                                    </label>

                                                                    {/* Fallback URL input */}
                                                                    <div className="flex-1">
                                                                        <input
                                                                            type="text"
                                                                            value={(editingItem as any).image || ''}
                                                                            onChange={e => setEditingItem({ ...editingItem, image: e.target.value })}
                                                                            className="w-full h-full bg-white/5 border border-white/10 rounded-lg px-3 text-white text-xs"
                                                                            placeholder="Or paste URL..."
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* WASHER COMMISSION & FEES REMOVED as per new Global Fee logic */}
                                            </>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-white/10"><button onClick={handleSaveItem} className="w-full bg-primary h-12 rounded-xl font-bold hover:bg-primary-dark transition-colors">Save</button></div>
                                </div>
                            </div>
                        )
                    }
                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_PRICING} navigate={navigate} />}
                </div >

                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText="Confirm"
                    cancelText="Cancel"
                    onConfirm={confirmModal.onConfirm}
                    onCancel={closeConfirm}
                    type={confirmModal.type}
                />
            </div >
        );
    }



    // ... (Previous logic)

    const handleEditTeamMember = (member: TeamMember) => {
        setNewMemberData({ ...member, password: '' } as any); // Don't show password
        setShowAddMemberModal(true);
    };

    const handleDeleteTeamMember = (id: string) => {
        showConfirm(
            'Delete Team Member',
            'Are you sure you want to delete this team member?',
            () => {
                // In a real app, this would call a delete function passed via props
                // For now, we'll simulate it by filtering the local state (conceptually)
                // Since props are read-only, we can't delete directly here without a prop function
                // Assuming 'toggleBlockUser' is the only available action for now, or we need to add onDeleteTeamMember prop
                showToast('Delete functionality would be implemented here.', 'info');
            },
            'danger'
        );
    };

    if ((screen as any) === AdminScreenEnum.ADMIN_DASHBOARD) {
        return (
            <div className="flex flex-col h-full bg-background-dark text-white">
                {/* ... (Dashboard Header & Stats) */}

                {/* ... (Live Orders List) */}
                <div className="px-4 mb-4">
                    <div className="flex bg-surface-dark rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setDashboardTab('live')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${dashboardTab === 'live' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Live Orders
                        </button>
                        <button
                            onClick={() => setDashboardTab('history')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${dashboardTab === 'history' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            History
                        </button>
                    </div>
                </div>

                <div className="space-y-3 px-4 pb-20 overflow-y-auto">
                    {filteredOrders
                        .filter(o => dashboardTab === 'live'
                            ? (o.status !== 'Completed' && o.status !== 'Cancelled')
                            : (o.status === 'Completed' || o.status === 'Cancelled')
                        )
                        .map(order => (
                            <div key={order.id} onClick={() => setViewingOrderDetails(order)} className="bg-surface-dark p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-1 inline-block ${order.status === 'Pending' ? 'bg-green-500/20 text-green-500' :
                                            order.status === 'Cancelled' ? 'bg-red-500/20 text-red-500' :
                                                'bg-primary/20 text-primary'
                                            }`}>{order.status}</span>
                                        <h3 className="font-bold">{order.service}</h3>
                                        <p className="text-sm text-slate-400">{order.clientName || 'Unknown Client'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">${order.price}</p>
                                        <p className="text-xs text-slate-500">{order.time}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                    <span className="material-symbols-outlined text-sm">directions_car</span>
                                    {order.vehicle || 'Unknown Vehicle'}
                                </div>
                            </div>
                        ))}
                    {filteredOrders.filter(o => dashboardTab === 'live' ? (o.status !== 'Completed' && o.status !== 'Cancelled') : (o.status === 'Completed' || o.status === 'Cancelled')).length === 0 && (
                        <div className="text-center py-10 text-slate-500">
                            <p>No orders found in {dashboardTab} view.</p>
                        </div>
                    )}
                </div>

                {/* Order Details Modal with Photos */}
                {viewingOrderDetails && (
                    <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                        <div className="bg-surface-dark w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Order Details #{viewingOrderDetails.id}</h3>
                                <button onClick={() => setViewingOrderDetails(null)}><span className="material-symbols-outlined">close</span></button>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Client Info</h4>
                                        <p className="font-bold text-lg">{viewingOrderDetails.clientName}</p>
                                        <p className="text-sm text-slate-300">123 Main St (Mock Address)</p>
                                        <p className="text-sm text-slate-300">+1 (555) 000-0000</p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Service Info</h4>
                                        <p className="font-bold">{viewingOrderDetails.service}</p>
                                        <p className="text-sm text-slate-300">{viewingOrderDetails.vehicle} ({viewingOrderDetails.vehicleType})</p>
                                        <p className="text-sm font-bold text-primary mt-1">${viewingOrderDetails.price}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Job Evidence</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 mb-2">BEFORE</p>
                                            <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden">
                                                {viewingOrderDetails.photos?.before ? (
                                                    <img src={viewingOrderDetails.photos.before[0]} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs text-slate-600">No photos</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 mb-2">AFTER</p>
                                            <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center border border-white/10 overflow-hidden">
                                                {viewingOrderDetails.photos?.after ? (
                                                    <img src={viewingOrderDetails.photos.after[0]} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-xs text-slate-600">No photos</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {editingServicesOrder && (
                    <div className="absolute inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
                        <div className="bg-surface-dark w-full max-w-2xl rounded-2xl border border-white/10 flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                <h3 className="font-bold text-lg">Modify Services</h3>
                                <button onClick={() => setEditingServicesOrder(null)}><span className="material-symbols-outlined">close</span></button>
                            </div>

                            <div className="p-4 overflow-y-auto flex-1 space-y-6">
                                {tempConfigs.map((config, index) => {
                                    const availablePackages = packages; // All packages
                                    const vehicleType = config.vehicleType || 'Sedan';

                                    // Calculate vehicle subtotal
                                    const pkg = packages.find(p => p.id === config.packageId);
                                    const currentAddons = addons.filter(a => config.addonIds.includes(a.id));
                                    const subtotal = (pkg?.price[vehicleType] || 0) + currentAddons.reduce((sum, a) => sum + (a.price[vehicleType] || 0), 0);

                                    return (
                                        <div key={index} className="bg-white/5 p-4 rounded-xl border border-white/10">
                                            {/* Vehicle Header */}
                                            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
                                                <div className="w-16 h-16 rounded-lg bg-cover bg-center border border-white/10" style={{ backgroundImage: `url("${config.vehicleImage}")` }}></div>
                                                <div>
                                                    <div className="font-bold text-lg">{config.vehicleModel}</div>
                                                    <div className="text-xs text-slate-400">{config.vehiclePlate} ÔÇó {config.vehicleColor}</div>
                                                    <div className="text-xs text-primary font-bold mt-1 uppercase">{vehicleType}</div>
                                                </div>
                                                <div className="ml-auto text-xl font-bold">${subtotal}</div>
                                            </div>

                                            {/* Package Selection */}
                                            <div className="mb-4">
                                                <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Package</label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {availablePackages.map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => {
                                                                const newConfigs = [...tempConfigs];
                                                                newConfigs[index].packageId = p.id;
                                                                setTempConfigs(newConfigs);
                                                            }}
                                                            className={`p-3 rounded-lg border text-left transition-all ${config.packageId === p.id
                                                                ? 'bg-primary/20 border-primary text-white'
                                                                : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5'}`}
                                                        >
                                                            <div className="font-bold text-sm">{p.name}</div>
                                                            <div className="text-xs opacity-70">${p.price[vehicleType]}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Addons Selection */}
                                            <div>
                                                <label className="text-xs text-slate-400 uppercase font-bold block mb-2">Add-ons</label>
                                                <div className="space-y-2">
                                                    {addons.map(addon => {
                                                        const isSelected = config.addonIds.includes(addon.id);
                                                        return (
                                                            <button
                                                                key={addon.id}
                                                                onClick={() => {
                                                                    const newConfigs = [...tempConfigs];
                                                                    if (isSelected) {
                                                                        newConfigs[index].addonIds = newConfigs[index].addonIds.filter((id: string) => id !== addon.id);
                                                                    } else {
                                                                        newConfigs[index].addonIds.push(addon.id);
                                                                    }
                                                                    setTempConfigs(newConfigs);
                                                                }}
                                                                className={`w-full p-3 rounded-lg border flex justify-between items-center transition-all ${isSelected
                                                                    ? 'bg-primary/10 border-primary/50 text-white'
                                                                    : 'bg-black/20 border-white/10 text-slate-400 hover:bg-white/5'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                                                                        {isSelected && <span className="material-symbols-outlined text-[10px]">check</span>}
                                                                    </div>
                                                                    <span className="text-sm font-medium">{addon.name}</span>
                                                                </div>
                                                                <span className="text-xs font-bold">+${addon.price[vehicleType]}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 border-t border-white/10 bg-surface-dark">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-slate-400 font-bold">New Total</span>
                                    <span className="text-2xl font-bold text-primary">
                                        ${tempConfigs.reduce((total, config) => {
                                            const vehicleType = config.vehicleType || 'Sedan';
                                            const pkg = packages.find(p => p.id === config.packageId);
                                            const pkgPrice = pkg?.price[vehicleType] || 0;
                                            const addonsPrice = addons
                                                .filter(a => config.addonIds.includes(a.id))
                                                .reduce((sum, a) => sum + (a.price[vehicleType] || 0), 0);
                                            return total + pkgPrice + addonsPrice;
                                        }, 0).toFixed(2)}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        // Calculate total
                                        const newTotal = tempConfigs.reduce((total, config) => {
                                            const vehicleType = config.vehicleType || 'Sedan';
                                            const pkg = packages.find(p => p.id === config.packageId);
                                            const pkgPrice = pkg?.price[vehicleType] || 0;
                                            const addonsPrice = addons
                                                .filter(a => config.addonIds.includes(a.id))
                                                .reduce((sum, a) => sum + (a.price[vehicleType] || 0), 0);
                                            return total + pkgPrice + addonsPrice;
                                        }, 0);

                                        updateOrder(editingServicesOrder.id, {
                                            vehicleConfigs: tempConfigs,
                                            price: newTotal
                                        });
                                        setEditingServicesOrder(null);
                                        // Also update viewingOrderDetails if open
                                        if (viewingOrderDetails && viewingOrderDetails.id === editingServicesOrder.id) {
                                            setViewingOrderDetails({ ...viewingOrderDetails, vehicleConfigs: tempConfigs, price: newTotal });
                                        }
                                        showToast('Services updated successfully', 'success');
                                    }}
                                    className="w-full h-12 bg-primary rounded-xl font-bold hover:bg-primary-dark transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <Nav active={AdminScreenEnum.ADMIN_DASHBOARD} navigate={navigate} />
            </div>
        );
    }

    // ... (Other screens)

    if (screen === AdminScreenEnum.ADMIN_TEAM) {
        const activeMembers = team.filter(m => m.role === 'washer' && m.status !== 'Blocked');
        const applicants = washerApplications || [];

        return (
            <div className={`flex h-full bg-background-dark text-white ${isDesktop ? 'flex-row' : 'flex-col'}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                {isDesktop && (
                    <TopBar title="Team Management" subtitle={`${activeMembers.length} active · ${applicants.length} pending`}>
                        <button
                            onClick={() => { setNewMemberData({ name: '', email: '', password: '', role: 'washer', driverLicense: '', insuranceNumber: '', vehiclePlate: '', vehicleModel: '' } as any); setShowAddMemberModal(true); }}
                            className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-[12px] font-semibold hover:bg-primary hover:text-black transition-all flex items-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[15px]">add</span>
                            Add Member
                        </button>
                    </TopBar>
                )}
                {!isDesktop && (<header className="p-4 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">Team Management</h1>
                        <p className="text-xs text-slate-400">{activeMembers.length} Active · {applicants.length} Pending</p>
                    </div>
                    <button
                        onClick={() => { setNewMemberData({ name: '', email: '', password: '', role: 'washer', driverLicense: '', insuranceNumber: '', vehiclePlate: '', vehicleModel: '' } as any); setShowAddMemberModal(true); }}
                        className="bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Member
                    </button>
                </header>)}

                <div className="px-4 mt-4">
                    <div className="flex bg-surface-dark rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setTeamTab('active')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${teamTab === 'active' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Active Team
                        </button>
                        <button
                            onClick={() => setTeamTab('pending')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${teamTab === 'pending' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Requests {applicants.length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{applicants.length}</span>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-3">
                    {teamTab === 'active' ? (
                        activeMembers.map(member => (
                            <div key={member.id} className="bg-surface-dark p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                        {member.avatar ? <img src={member.avatar} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">person</span>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold">{member.name}</h3>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${member.role === 'admin' ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-blue-500 text-blue-400 bg-blue-500/10'}`}>{member.role.toUpperCase()}</span>
                                        </div>
                                        <p className="text-xs text-slate-400">{member.email}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] bg-white/5 px-1.5 rounded text-slate-400">Jobs: {member.completedJobs || 0}</span>
                                            <span className="text-[10px] bg-white/5 px-1.5 rounded text-slate-400">Rating: {member.rating?.toFixed(1) || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditTeamMember(member)} className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"><span className="material-symbols-outlined">edit</span></button>
                                    <button onClick={() => toggleBlockUser(member.id)} className={`p-2 rounded-lg transition-colors ${member.status === 'Blocked' ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10'}`}>
                                        <span className="material-symbols-outlined">{member.status === 'Blocked' ? 'lock' : 'lock_open'}</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            showConfirm(
                                                'Convert to Client',
                                                `Convert ${member.name} back to Client? They will lose team access.`,
                                                () => {
                                                    updateUserProfile(member.id, { role: 'client' });
                                                    showToast(`${member.name} is now a Client`, 'info');
                                                },
                                                'primary'
                                            );
                                        }}
                                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                        title="Demote to Client"
                                    >
                                        <span className="material-symbols-outlined">person</span>
                                    </button>
                                    <button onClick={() => deleteUser(member.id)} className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        applicants.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                <p>No pending applications</p>
                            </div>
                        ) : (
                            applicants.map(app => (
                                <div key={app.id} className="bg-surface-dark p-4 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-blue-400">badge</span>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{app.name}</h3>
                                                <p className="text-sm text-slate-400">{app.email}</p>
                                                <p className="text-sm text-slate-400">{app.phone || 'No phone'}</p>
                                            </div>
                                        </div>
                                        <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">APPLICANT</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-slate-300 bg-black/20 p-3 rounded-lg">
                                        <div><span className="text-slate-500 block">Experience:</span> {app.experience || 'N/A'}</div>
                                        <div><span className="text-slate-500 block">Location:</span> {app.city}, {app.state}</div>
                                        <div><span className="text-slate-500 block">Vehicle:</span> {app.vehicleModel}</div>
                                        <div><span className="text-slate-500 block">SSN:</span> {app.ssn ? '***-**-' + app.ssn.slice(-4) : 'N/A'}</div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => rejectWasher(app.id)}
                                            className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-400 font-bold hover:bg-red-500/10 transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => approveWasher(app.id, app)}
                                            className="flex-1 py-2 rounded-lg bg-green-500 text-black font-bold hover:bg-green-400 transition-colors"
                                        >
                                            Request
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {showAddMemberModal && (
                    <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                        <div className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl animate-in zoom-in-95">
                            <h2 className="text-xl font-bold mb-4">{newMemberData.id ? 'Edit Member' : 'Add New Member'}</h2>

                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={newMemberData.name}
                                    onChange={e => setNewMemberData({ ...newMemberData, name: e.target.value, id: newMemberData.id || '' })}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={newMemberData.email}
                                    onChange={e => setNewMemberData({ ...newMemberData, email: e.target.value, id: newMemberData.id || '' })}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                />
                                {!newMemberData.id && (
                                    <input
                                        type="password"
                                        placeholder="Temporary Password"
                                        value={newMemberData.password}
                                        onChange={e => setNewMemberData({ ...newMemberData, password: e.target.value, id: newMemberData.id || '' })}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                    />
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setNewMemberData({ ...newMemberData, role: 'washer', id: newMemberData.id || '' })}
                                            className={`flex-1 py-2 rounded-lg border transition-colors ${newMemberData.role === 'washer' ? 'bg-primary/20 border-primary text-white' : 'border-white/10 text-slate-400'}`}
                                        >
                                            Washer
                                        </button>
                                        <button
                                            onClick={() => setNewMemberData({ ...newMemberData, role: 'admin', id: newMemberData.id || '' })}
                                            className={`flex-1 py-2 rounded-lg border transition-colors ${newMemberData.role === 'admin' ? 'bg-purple-500/20 border-purple-500 text-white' : 'border-white/10 text-slate-400'}`}
                                        >
                                            Admin
                                        </button>
                                    </div>
                                </div>

                                {newMemberData.role === 'washer' && (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Vehicle Plate"
                                            value={newMemberData.vehiclePlate || ''}
                                            onChange={e => setNewMemberData({ ...newMemberData, vehiclePlate: e.target.value, id: newMemberData.id || '' })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="License Number"
                                            value={newMemberData.driverLicense || ''}
                                            onChange={e => setNewMemberData({ ...newMemberData, driverLicense: e.target.value, id: newMemberData.id || '' })}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                        />
                                    </>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowAddMemberModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold">Cancel</button>
                                <button
                                    onClick={() => {
                                        if (newMemberData.id) {
                                            // Update existing
                                            updateUserProfile(newMemberData.id, newMemberData);
                                            showToast('Member profile updated', 'success');
                                            setShowAddMemberModal(false);
                                        } else {
                                            // Create new
                                            submitNewMember();
                                        }
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-primary text-black font-bold hover:bg-primary-dark"
                                >
                                    {newMemberData.id ? 'Save Changes' : 'Create Member'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_TEAM} navigate={navigate} />}
                </div>
            </div>
        );
    }

    // ADMIN_PAYROLL Screen
    if ((screen as any) === AdminScreenEnum.ADMIN_PAYROLL) {
        const completedOrders = orders.filter(o => o.status === 'Completed' && o.washerId);

        // Calculate earnings per washer
        const washerEarnings = washers.map(washer => {
            const washerOrders = completedOrders.filter(o => o.washerId === washer.id);

            let totalEarnings = 0;
            let totalTips = 0;

            // Calculate total earnings using Global Fees logic (Price - Fees + Tips)
            washerOrders.forEach(order => {
                let orderGross = 0;

                // Sum up earnings from vehicle configs
                if (order.vehicleConfigs) {
                    order.vehicleConfigs.forEach(config => {
                        // Package price
                        const pkg = packages.find(p => p.id === config.packageId);
                        if (pkg && config.vehicleType) {
                            orderGross += pkg.price[config.vehicleType] || 0;
                        }

                        // Addon prices
                        config.addonIds?.forEach(addonId => {
                            const addon = addons.find(a => a.id === addonId);
                            if (addon && config.vehicleType) {
                                orderGross += addon.price[config.vehicleType] || 0;
                            }
                        });
                    });
                } else {
                    // Fallback for legacy orders without configs
                    orderGross = order.price || 0;
                }

                // Calculate Deduction based on Global Fees
                const totalFeePercent = globalFees.reduce((sum, fee) => sum + fee.percentage, 0);
                const deduction = (orderGross * totalFeePercent) / 100;
                const netEarnings = orderGross - deduction;

                // Add totals
                totalEarnings += netEarnings;

                // Add tips (100% to washer)
                if (order.tip) {
                    totalTips += order.tip;
                }
            });

            // Get pending bonuses for this washer
            const washerBonuses = bonuses.filter(b => b.washerId === washer.id && b.status === 'pending');
            const totalBonuses = washerBonuses.reduce((sum, b) => sum + b.amount, 0);


            return {
                washer,
                completedJobs: washerOrders.length,
                baseEarnings: totalEarnings,
                tips: totalTips,
                bonuses: totalBonuses,
                totalEarnings: totalEarnings + totalTips + totalBonuses,
                orders: washerOrders,
                bonusList: washerBonuses
            };
        }).filter(w => w.completedJobs > 0);

        const grandTotal = washerEarnings.reduce((sum, w) => sum + w.totalEarnings, 0);
        const totalJobs = washerEarnings.reduce((sum, w) => sum + w.completedJobs, 0);
        const totalTips = washerEarnings.reduce((sum, w) => sum + w.tips, 0);
        const totalBonuses = washerEarnings.reduce((sum, w) => sum + w.bonuses, 0);

        const handleMarkAsPaid = async (washerData: any) => {
            try {
                // Create payment record
                await createPayment({
                    washerId: washerData.washer.id,
                    washerName: washerData.washer.name,
                    periodId: `week_${new Date().toISOString().split('T')[0]}`,
                    baseEarnings: washerData.baseEarnings,
                    tips: washerData.tips,
                    bonuses: washerData.bonuses,
                    deductions: 0,
                    totalPaid: washerData.totalEarnings,
                    completedJobs: washerData.completedJobs,
                    paidDate: new Date().toISOString(),
                    paidBy: currentUser.id,
                    paidByName: currentUser.name,
                    notes: paymentNotes,
                    orderIds: washerData.orders.map((o: any) => o.id),
                    paymentMethod
                });

                // Update bonuses to 'applied' status
                for (const bonus of washerData.bonusList) {
                    await updateBonus(bonus.id, {
                        status: 'applied',
                        appliedToPeriodId: `week_${new Date().toISOString().split('T')[0]}`
                    });
                }

                showToast(`Payment of $${washerData.totalEarnings.toFixed(2)} recorded for ${washerData.washer.name}`, 'success');
                setPayingWasher(null);
                setPaymentNotes('');
            } catch (error) {
                showToast('Error recording payment', 'error');
            }
        };

        const exportToCSV = () => {
            const csvData = washerEarnings.map(w => ({
                'Washer Name': w.washer.name,
                'Email': w.washer.email,
                'Jobs': w.completedJobs,
                'Base Earnings': w.baseEarnings.toFixed(2),
                'Tips': w.tips.toFixed(2),
                'Bonuses': w.bonuses.toFixed(2),
                'Total': w.totalEarnings.toFixed(2)
            }));

            const headers = Object.keys(csvData[0]).join(',');
            const rows = csvData.map(row => Object.values(row).join(','));
            const csv = [headers, ...rows].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        };

        return renderFinanceScreen(
            <div className="p-4 pb-20">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold">Nómina Semanal</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(AdminScreenEnum.ADMIN_DASHBOARD)}
                            className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-primary rounded-xl font-bold flex items-center gap-2 text-xs active:scale-95"
                        >
                            <span className="material-symbols-outlined text-sm">card_giftcard</span>
                            Incentivos y Bonos
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="px-4 py-2 bg-primary/25 hover:bg-primary/45 border border-primary/25 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-xs active:scale-95"
                        >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Payroll</p>
                        <p className="text-2xl font-bold text-green-400">${grandTotal.toFixed(2)}</p>
                    </div>
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Jobs</p>
                        <p className="text-2xl font-bold">{totalJobs}</p>
                    </div>
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Tips</p>
                        <p className="text-2xl font-bold text-amber-400">${totalTips.toFixed(2)}</p>
                    </div>
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Total Bonuses</p>
                        <p className="text-2xl font-bold text-green-400">${totalBonuses.toFixed(2)}</p>
                    </div>
                </div>

                {/* Washer List */}
                <div className="space-y-4">
                    {washerEarnings.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">payments</span>
                            <p>No completed jobs this week</p>
                        </div>
                    ) : (
                        washerEarnings.map((data) => (
                            <div key={data.washer.id} className="bg-surface-dark rounded-xl p-5 border border-white/5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                            {data.washer.avatar ? (
                                                <img src={data.washer.avatar} alt={data.washer.name} className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <span className="material-symbols-outlined text-slate-300">person</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{data.washer.name}</h3>
                                            <p className="text-xs text-slate-400">{data.completedJobs} completed jobs</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-green-400">${data.totalEarnings.toFixed(2)}</span>
                                        <p className="text-[10px] text-slate-500">Net payout</p>
                                    </div>
                                </div>

                                {/* Financial Detail Grid */}
                                <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-lg bg-black/20 border border-white/5">
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Base Pay</p>
                                        <p className="text-sm font-semibold">${data.baseEarnings.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Tips</p>
                                        <p className="text-sm font-semibold text-amber-400">${data.tips.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Bonuses</p>
                                        <p className="text-sm font-semibold text-green-400">${data.bonuses.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Detail collapse/expand list */}
                                <div className="mb-4">
                                    <h4 className="text-xs font-bold text-slate-400 mb-2">Included Orders:</h4>
                                    <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                                        {data.orders.map((o: any) => (
                                            <div key={o.id} className="flex justify-between items-center text-xs p-2 rounded bg-white/5">
                                                <span>{new Date(o.createdAt?.toDate?.() || o.date).toLocaleDateString()} - {o.clientName}</span>
                                                <span className="font-bold text-slate-300">${(o.financialBreakdown?.washerGrossEarnings || o.washerEarnings || 0).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {payingWasher === data.washer.id ? (
                                    <div className="p-4 rounded-lg bg-black/40 border border-primary/20 space-y-3">
                                        <h4 className="font-bold text-sm text-primary">Confirm Payment Details</h4>
                                        <div className="space-y-2">
                                            <label className="block text-xs text-slate-400">Payment Method</label>
                                            <div className="flex gap-2">
                                                {(['cash', 'transfer', 'check'] as const).map((method) => (
                                                    <button
                                                        key={method}
                                                        onClick={() => setPaymentMethod(method)}
                                                        className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize border ${paymentMethod === method ? 'bg-primary text-black border-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}
                                                    >
                                                        {method}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-xs text-slate-400">Notes (Optional)</label>
                                            <input
                                                type="text"
                                                placeholder="Transaction ID, check number..."
                                                value={paymentNotes}
                                                onChange={(e) => setPaymentNotes(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => setPayingWasher(null)}
                                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 py-2 rounded-lg text-xs font-bold"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleMarkAsPaid(data)}
                                                className="flex-1 bg-primary text-black hover:bg-primary/80 py-2 rounded-lg text-xs font-black"
                                            >
                                                Confirm Payment
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setPayingWasher(data.washer.id)}
                                        className="w-full bg-primary hover:bg-primary-dark transition-colors rounded-lg py-3 font-bold flex items-center justify-center gap-2 text-black"
                                    >
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Mark as Paid
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>,
            AdminScreenEnum.ADMIN_PAYROLL
        );
    }

    // Settings Screen (Simplified Hub)
    if ((screen as any) === AdminScreenEnum.ADMIN_SETTINGS) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}

                <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <header className="p-5 border-b border-white/5 flex items-center gap-3 bg-surface-dark/40 backdrop-blur-md shrink-0">
                        {!isDesktop && (
                            <button onClick={() => navigate(AdminScreenEnum.ADMIN_DASHBOARD)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            </button>
                        )}
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-xl">settings</span>
                                Ajustes del Sistema
                            </h1>
                            <p className="text-xs text-slate-400">Configuración global y herramientas de administración</p>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
                        {/* General Section */}
                        <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
                            <h3 className="text-lg font-bold mb-6 border-b border-white/5 pb-3 flex items-center gap-2 text-white">
                                <span className="material-symbols-outlined text-primary text-xl">tune</span>
                                Información General
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-slate-400 text-[10px] uppercase font-black tracking-wider mb-2">Número de Teléfono de Soporte</label>
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 material-symbols-outlined text-lg">phone</span>
                                            <input
                                                type="tel"
                                                value={supportPhone}
                                                onChange={(e) => setSupportPhone(e.target.value)}
                                                className="w-full bg-black/25 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                                                placeholder="+1 (555) 123-4567"
                                            />
                                        </div>
                                        <button
                                            onClick={() => showToast('Support phone number updated!', 'success')}
                                            className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-blue-700 text-white font-bold px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-98 transition-all text-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-sm">save</span>
                                            Guardar
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">Este número se muestra a los clientes para comunicarse con soporte.</p>
                                </div>

                                <div>
                                    <label className="block text-slate-400 text-[10px] uppercase font-black tracking-wider mb-2">Email para Reportes Diarios</label>
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 material-symbols-outlined text-lg">mail</span>
                                            <input
                                                type="email"
                                                value={reportEmail || ''}
                                                onChange={(e) => setReportEmail && setReportEmail(e.target.value)}
                                                className="w-full bg-black/25 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                                                placeholder="reports@company.com"
                                            />
                                        </div>
                                        <button
                                            onClick={() => showToast('Report email updated!', 'success')}
                                            className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-blue-700 text-white font-bold px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-98 transition-all text-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-sm">save</span>
                                            Guardar
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">Los reportes financieros automáticos se enviarán diariamente a esta dirección.</p>
                                </div>
                            </div>
                        </div>

                        {/* Notifications Section */}
                        <div className="bg-surface-dark/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-xl">
                            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-white">
                                <span className="material-symbols-outlined text-primary text-xl">campaign</span>
                                Notificaciones Manuales Masivas
                            </h3>
                            <p className="text-xs text-slate-400 mb-6 border-b border-white/5 pb-3">Envía alertas urgentes a todos los usuarios del sistema. Usa con precaución.</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/10 border border-orange-500/15 p-5 rounded-2xl flex flex-col justify-between hover:border-orange-500/30 transition-all hover:shadow-lg hover:shadow-orange-500/5 duration-300">
                                    <div>
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 mb-4 border border-orange-500/20">
                                            <span className="material-symbols-outlined text-xl">sunny</span>
                                        </div>
                                        <h4 className="font-bold text-orange-400 text-base mb-2">Alerta de Clima</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed mb-6">Envía notificaciones masivas basadas en las condiciones climáticas actuales.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            showConfirm(
                                                'Send Weather Notifications',
                                                'Do you want to send WEATHER notifications?',
                                                async () => {
                                                    const tempStr = prompt("Enter temperature (F):", "75");
                                                    if (tempStr === null) return;
                                                    const msg = prompt("Enter message:", "☀️ Perfect weather today! Great day to wash your car.");
                                                    if (msg === null) return;

                                                    try {
                                                        showToast('Sending weather notifications...', 'info');
                                                        const sendWeather = httpsCallable(functions, 'sendWeatherNotificationsManual');
                                                        const result: any = await sendWeather({ temperature: parseInt(tempStr), message: msg });
                                                        showToast(`Success: ${result.data.success} sent, ${result.data.failed} failed`, 'success');
                                                    } catch (error: any) {
                                                        console.error(error);
                                                        showToast('Failed to send notifications: ' + error.message, 'error');
                                                    }
                                                },
                                                'primary'
                                            );
                                        }}
                                        className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-extrabold rounded-xl shadow-md shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20 active:scale-95 transition-all text-xs cursor-pointer text-center"
                                    >
                                        Enviar Alerta
                                    </button>
                                </div>

                                <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/10 border border-blue-500/15 p-5 rounded-2xl flex flex-col justify-between hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/5 duration-300">
                                    <div>
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 border border-blue-500/20">
                                            <span className="material-symbols-outlined text-xl">history</span>
                                        </div>
                                        <h4 className="font-bold text-blue-400 text-base mb-2">Recordatorio</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed mb-6">Reactiva a clientes inactivos que no han realizado pedidos en varias semanas.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            showConfirm(
                                                'Send Inactivity Reminders',
                                                'Do you want to send INACTIVITY reminders?',
                                                async () => {
                                                    const daysStr = prompt("Minimum inactivity days:", "14");
                                                    if (daysStr === null) return;

                                                    try {
                                                        showToast('Sending inactivity reminders...', 'info');
                                                        const sendInactivity = httpsCallable(functions, 'sendInactivityRemindersManual');
                                                        const result: any = await sendInactivity({ minDays: parseInt(daysStr) });
                                                        showToast(`Success: ${result.data.success} sent, ${result.data.failed} failed`, 'success');
                                                    } catch (error: any) {
                                                        console.error(error);
                                                        showToast('Failed to send reminders: ' + error.message, 'error');
                                                    }
                                                },
                                                'primary'
                                            );
                                        }}
                                        className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-extrabold rounded-xl shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all text-xs cursor-pointer text-center"
                                    >
                                        Enviar Recordatorio
                                    </button>
                                </div>

                                <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/10 border border-purple-500/15 p-5 rounded-2xl flex flex-col justify-between hover:border-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-500/5 duration-300">
                                    <div>
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 border border-purple-500/20">
                                            <span className="material-symbols-outlined text-xl">bug_report</span>
                                        </div>
                                        <h4 className="font-bold text-purple-400 text-base mb-2">Pruebas de Red</h4>
                                        <p className="text-xs text-slate-400 leading-relaxed mb-6">Consola de depuración para probar el estado y envío de notificaciones push.</p>
                                    </div>
                                    <button
                                        onClick={() => setShowNotificationTest(true)}
                                        className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-extrabold rounded-xl shadow-md shadow-purple-500/10 hover:shadow-lg hover:shadow-purple-500/20 active:scale-95 transition-all text-xs cursor-pointer text-center"
                                    >
                                        Consola de Prueba
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isDesktop && (
                        <div className="px-4 pb-4">
                            <button
                                onClick={logout}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all font-medium text-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">logout</span>
                                Log Out
                            </button>
                        </div>
                    )}
                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_SETTINGS} navigate={navigate} />}
                </div>
            </div>
        );
    }

    // Service Area Screen
    if (screen === AdminScreenEnum.ADMIN_SERVICE_AREA) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <header className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-surface-dark/40 backdrop-blur-md shrink-0">
                        <div className="flex items-center gap-3">
                            {!isDesktop && (
                                <button onClick={() => navigate(AdminScreenEnum.ADMIN_DASHBOARD)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                                </button>
                            )}
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-xl">map</span>
                                    Área de Cobertura
                                </h1>
                                <p className="text-xs text-slate-400">Configura el radio de servicio y ubicación del epicentro</p>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 relative overflow-hidden bg-[#0e0e11]">
                        <ServiceAreaConfig
                            serviceArea={serviceArea}
                            onSave={async (area) => {
                                await saveServiceArea(area);
                                showToast('Área de servicio guardada exitosamente', 'success');
                            }}
                        />
                    </div>
                    {!isDesktop && <Nav active={AdminScreenEnum.ADMIN_SERVICE_AREA} navigate={navigate} />}
                </div>
            </div>
        );
    }

    // Financial Reports Screen
    if (screen === AdminScreenEnum.ADMIN_FINANCIAL_REPORTS) {


        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        // Calculate financial data with breakdown
        const calculateFinancials = () => {
            // Default "Zero" state
            const zeroState = {
                totalRevenue: 0,
                washerPayments: 0,
                adminCommission: 0,
                orderCount: 0,
                breakdown: months.map(m => ({
                    month: m,
                    totalRevenue: 0,
                    washerPayments: 0,
                    adminCommission: 0,
                    orderCount: 0
                })),
                washerPayouts: {} as Record<string, { name: string, amount: number, jobs: number }>,
                transactions: [] as any[]
            };

            try {
                // Initialize monthly buckets with 0
                const monthlyBreakdown = months.map(m => ({
                    month: m,
                    totalRevenue: 0,
                    washerPayments: 0,
                    adminCommission: 0,
                    orderCount: 0
                }));

                const washerPayouts: Record<string, { name: string, amount: number, jobs: number }> = {};
                const transactions: any[] = [];

                // Safe guard against undefined orders
                if (!orders || !Array.isArray(orders)) {
                    return zeroState;
                }

                let yearTotalRevenue = 0;
                let yearWasherPayments = 0;
                let yearAdminCommission = 0;
                let yearOrderCount = 0;

                const completedOrders = orders.filter(o => o.status === 'Completed');

                completedOrders.forEach(order => {
                    try {
                        // Parse date safely
                        const orderDate = parseSafeDate(order.createdAt || order.date);

                        // Validate date
                        if (isNaN(orderDate.getTime())) return;

                        // Filter by selected year
                        if (orderDate.getFullYear() !== selectedYear) return;

                        // --- Financial Calculation ---
                        const basePrice = order.basePrice || order.price || 0;
                        const tip = order.tip || 0;
                        const totalRevenue = basePrice + tip;

                        let orderWasherPay = 0;
                        let orderAdminCom = 0;

                        if (order.vehicleConfigs && Array.isArray(order.vehicleConfigs)) {
                            order.vehicleConfigs.forEach(config => {
                                const pkg = packages?.find(p => p.id === config.packageId);
                                if (pkg && config.vehicleType) {
                                    const pPrice = pkg.price?.[config.vehicleType] || 0;
                                    const comm = pkg.washerCommission || 80;
                                    orderWasherPay += (pPrice * comm) / 100;
                                    orderAdminCom += (pPrice * (100 - comm)) / 100;
                                }
                                config.addonIds?.forEach(addonId => {
                                    const addon = addons?.find(a => a.id === addonId);
                                    if (addon && config.vehicleType) {
                                        const aPrice = addon.price?.[config.vehicleType] || 0;
                                        const comm = addon.washerCommission || 80;
                                        orderWasherPay += (aPrice * comm) / 100;
                                        orderAdminCom += (aPrice * (100 - comm)) / 100;
                                    }
                                });
                            });
                        } else {
                            // Fallback for flat orders (assume 80/20 split on base)
                            orderWasherPay = basePrice * 0.8;
                            orderAdminCom = basePrice * 0.2;
                        }

                        // Washer gets 100% of the tip
                        orderWasherPay += tip;

                        // Add to Totals
                        yearTotalRevenue += totalRevenue;
                        yearWasherPayments += orderWasherPay;
                        yearAdminCommission += orderAdminCom;
                        yearOrderCount++;

                        const monthIdx = orderDate.getMonth();
                        monthlyBreakdown[monthIdx].totalRevenue += totalRevenue;
                        monthlyBreakdown[monthIdx].washerPayments += orderWasherPay;
                        monthlyBreakdown[monthIdx].adminCommission += orderAdminCom;
                        monthlyBreakdown[monthIdx].orderCount++;

                        // --- Washer Payout Attribution ---
                        // Try to find washer ID from assignedTo array or washerId field
                        const washerId = order.assignedTo?.[0] || (order as any).washerId;
                        if (washerId) {
                            if (!washerPayouts[washerId]) {
                                // Find name in team list
                                const washer = team.find(t => t.id === washerId);
                                washerPayouts[washerId] = {
                                    name: washer ? washer.name : 'Unknown Washer',
                                    amount: 0,
                                    jobs: 0
                                };
                            }
                            washerPayouts[washerId].amount += orderWasherPay;
                            washerPayouts[washerId].jobs += 1;
                        }

                        // --- Add to Transaction List ---
                        transactions.push({
                            id: order.id,
                            date: orderDate.toLocaleDateString(),
                            clientName: order.clientName || 'Client',
                            amount: totalRevenue,
                            washerPay: orderWasherPay,
                            washerId: washerId
                        });

                    } catch (innerErr) {
                        console.warn('Skipping malformed order:', order.id, innerErr);
                    }
                });

                // Sort transactions by newest
                transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                return {
                    totalRevenue: yearTotalRevenue,
                    washerPayments: yearWasherPayments,
                    adminCommission: yearAdminCommission,
                    orderCount: yearOrderCount,
                    breakdown: monthlyBreakdown,
                    washerPayouts,
                    transactions
                };

            } catch (err) {
                console.error('Critical error in financial report calculation', err);
                return zeroState;
            }
        };

        const financials = calculateFinancials();

        const exportToCSV = () => {
            const csvData = [
                ['FINANCIAL REPORT', `YEAR ${selectedYear}`],
                ['Generated', new Date().toLocaleDateString()],
                [''],
                ['SUMMARY'],
                ['Total Revenue', `$${financials.totalRevenue.toFixed(2)}`],
                ['Washer Payments', `$${financials.washerPayments.toFixed(2)}`],
                ['Net Profit', `$${financials.adminCommission.toFixed(2)}`],
                ['Total Orders', financials.orderCount.toString()],
                [''],
                ['MONTHLY BREAKDOWN'],
                ['Month', 'Orders', 'Revenue', 'Washer Pay', 'Net Profit'],
                ...financials.breakdown.map(m => [
                    m.month,
                    m.orderCount.toString(),
                    `$${m.totalRevenue.toFixed(2)}`,
                    `$${m.washerPayments.toFixed(2)}`,
                    `$${m.adminCommission.toFixed(2)}`
                ]),
                [''],
                ['WASHER PAYOUTS'],
                ['Washer Name', 'Jobs Completed', 'Total Payout'],
                ...Object.entries(financials.washerPayouts).map(([, data]) => [
                    data.name,
                    data.jobs.toString(),
                    `$${data.amount.toFixed(2)}`
                ]),
                [''],
                ['TRANSACTION HISTORY'],
                ['Date', 'Order ID', 'Client', 'Total Amount', 'Washer Pay'],
                ...financials.transactions.map(t => [
                    t.date,
                    t.id,
                    t.clientName,
                    `$${t.amount.toFixed(2)}`,
                    `$${t.washerPay.toFixed(2)}`
                ])
            ];

            const csv = csvData.map(row => row.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `financial-report-${selectedYear}.csv`;
            a.click();
            showToast('Report exported successfully', 'success');
        };

        return (
            <div className="flex flex-col h-full bg-background-dark text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                <header className="p-4 border-b border-white/5 flex items-center gap-3">
                    <button onClick={() => navigate(AdminScreenEnum.ADMIN_DASHBOARD)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Financial Reports</h1>
                        <p className="text-xs text-slate-400">Tax documents & metrics</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4">
                    {/* Year Selector */}
                    <div className="bg-surface-dark p-4 rounded-xl border border-white/5">
                        <label className="block text-sm font-bold mb-2">Select Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white"
                        >
                            {[2023, 2024, 2025, 2026].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-2 border-b border-white/10 pb-4">
                        <h2 className="text-xs font-bold text-slate-500 uppercase">Annual Summary</h2>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-surface-dark p-3 rounded-xl border border-white/5 text-center">
                                <span className="text-xs text-green-400 font-bold block">Revenue</span>
                                <span className="text-sm font-bold text-white">${financials.totalRevenue.toFixed(0)}</span>
                            </div>
                            <div className="bg-surface-dark p-3 rounded-xl border border-white/5 text-center">
                                <span className="text-xs text-blue-400 font-bold block">Washer</span>
                                <span className="text-sm font-bold text-white">${financials.washerPayments.toFixed(0)}</span>
                            </div>
                            <div className="bg-surface-dark p-3 rounded-xl border border-white/5 text-center">
                                <span className="text-xs text-purple-400 font-bold block">Profit</span>
                                <span className="text-sm font-bold text-white">${financials.adminCommission.toFixed(0)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Breakdown Table */}
                    <div className="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-3 bg-black/20 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-sm">Monthly Breakdown</h3>
                            <span className="text-xs text-slate-500">Jan - Dec {selectedYear}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-400 border-b border-white/5">
                                        <th className="p-3 font-medium">Month</th>
                                        <th className="p-3 font-medium text-right">Orders</th>
                                        <th className="p-3 font-medium text-right">Revenue</th>
                                        <th className="p-3 font-medium text-right">Profit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financials.breakdown.map((m) => (
                                        <tr key={m.month} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-medium text-slate-300">{m.month}</td>
                                            <td className="p-3 text-right text-slate-400">{m.orderCount}</td>
                                            <td className="p-3 text-right text-green-400/80">${m.totalRevenue.toFixed(0)}</td>
                                            <td className="p-3 text-right text-purple-400/80 font-bold">${m.adminCommission.toFixed(0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Washer Payouts Table */}
                    <div className="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-3 bg-black/20 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-blue-400">Washer Payouts</h3>
                            <span className="text-xs text-slate-500">Total Paid: ${financials.washerPayments.toFixed(0)}</span>
                        </div>
                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-400 border-b border-white/5">
                                        <th className="p-3 font-medium">Washer Name</th>
                                        <th className="p-3 font-medium text-right">Jobs</th>
                                        <th className="p-3 font-medium text-right">Total Payout</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(financials.washerPayouts).length > 0 ? (
                                        Object.entries(financials.washerPayouts).map(([id, data]) => (
                                            <tr key={id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-medium text-slate-300">{data.name}</td>
                                                <td className="p-3 text-right text-slate-400">{data.jobs}</td>
                                                <td className="p-3 text-right text-blue-400 font-bold">${data.amount.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={3} className="p-4 text-center text-slate-500">No washer data available</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Transaction History (Simplified) */}
                    <div className="bg-surface-dark rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-3 bg-black/20 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-amber-400">Transaction History</h3>
                            <span className="text-xs text-slate-500">{financials.transactions.length} Transactions</span>
                        </div>
                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-slate-400 border-b border-white/5">
                                        <th className="p-3 font-medium">Date</th>
                                        <th className="p-3 font-medium">Client</th>
                                        <th className="p-3 font-medium text-right">Total</th>
                                        <th className="p-3 font-medium text-right">Washer Pay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financials.transactions.length > 0 ? (
                                        financials.transactions.map((t, i) => (
                                            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-medium text-slate-300 text-xs">{t.date}</td>
                                                <td className="p-3 text-slate-400 text-xs">{t.clientName}</td>
                                                <td className="p-3 text-right text-green-400/80 font-mono text-xs">${t.amount.toFixed(2)}</td>
                                                <td className="p-3 text-right text-blue-400/80 font-mono text-xs">${t.washerPay.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={4} className="p-4 text-center text-slate-500">No transactions found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={exportToCSV}
                        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-blue-700 p-5 rounded-2xl flex items-center justify-center gap-3 font-black text-white shadow-xl shadow-primary/20 transition-all active:scale-[0.98] mt-6"
                    >
                        <span className="material-symbols-outlined">download</span>
                        Export Full Financial Report (CSV)
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-2">Includes Monthly, Washer, and Transaction details</p>
                </div>

                <Nav active={AdminScreenEnum.ADMIN_FINANCIAL_REPORTS} navigate={navigate} />
            </div>
        );
    }

    // Render new screens
    if (screen === AdminScreenEnum.ADMIN_DISCOUNTS) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <DiscountManagement
                        discounts={discounts}
                        navigate={navigate}
                        currentUser={currentUser}
                        createDiscount={createDiscount}
                        updateDiscount={updateDiscount}
                        deleteDiscount={deleteDiscount}
                        showToast={showToast}
                        isEmbedded={true}
                    />
                </div>
                {!isDesktop && <Nav active={screen} navigate={navigate} />}
            </div>
        );
    }

    // Bonus Management Screen (was incorrectly checking ADMIN_DASHBOARD)
    if ((screen as unknown as string) === 'ADMIN_BONUSES') {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <BonusManagement
                        bonuses={bonuses}
                        team={team}
                        navigate={navigate}
                        currentUser={currentUser}
                        createBonus={createBonus}
                        updateBonus={updateBonus}
                        deleteBonus={deleteBonus}
                        showToast={showToast}
                        isEmbedded={true}
                    />
                </div>
                {!isDesktop && <Nav active={screen as any} navigate={navigate} />}
            </div>
        );
    }

    // Support Chat Screen - Real-time chat with clients
    if (screen === AdminScreenEnum.ADMIN_ISSUES) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden flex flex-col relative" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <SupportChatAdmin currentUser={currentUser} navigate={navigate} isEmbedded={true} />
                </div>
                {!isDesktop && <Nav active={screen} navigate={navigate} />}
            </div>
        );
    }



    // Financial Reports Screen
    if ((screen as any) === AdminScreenEnum.ADMIN_FINANCIAL_REPORTS) {
        return renderFinanceScreen(
            <FinancialReportsScreen orders={orders} team={team} navigate={navigate} hideHeader={true} />,
            AdminScreenEnum.ADMIN_FINANCIAL_REPORTS
        );
    }

    // Washer Earnings Screen
    if ((screen as any) === AdminScreenEnum.ADMIN_WASHER_EARNINGS) {
        return renderFinanceScreen(
            <WasherEarningsScreen
                orders={orders}
                team={team}
                navigate={(screen, washerId) => {
                    if (washerId) setSelectedWasherId(washerId);
                    navigate(screen);
                }}
                hideHeader={true}
            />,
            AdminScreenEnum.ADMIN_WASHER_EARNINGS
        );
    }

    // Washer History Screen
    if ((screen as any) === AdminScreenEnum.ADMIN_WASHER_HISTORY) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <WasherHistoryScreen
                        washerId={selectedWasherId}
                        orders={orders}
                        team={team}
                        globalFees={globalFees}
                        navigate={navigate}
                    />
                </div>
                {!isDesktop && <Nav active={screen} navigate={navigate} />}
            </div>
        );
    }

    // App Earnings Screen
    if ((screen as any) === AdminScreenEnum.ADMIN_APP_EARNINGS) {
        return renderFinanceScreen(
            <AppEarningsScreen orders={orders} hideHeader={true} />,
            AdminScreenEnum.ADMIN_APP_EARNINGS
        );
    }

    // Tax Reports Screen
    if ((screen as any) === AdminScreenEnum.ADMIN_TAX_REPORTS) {
        return renderFinanceScreen(
            <TaxReportsScreen orders={orders} team={team} hideHeader={true} />,
            AdminScreenEnum.ADMIN_TAX_REPORTS
        );
    }


    // Fleet Panel (Flotas - Empresas, Cuotas, Historial)
    if (screen === AdminScreenEnum.ADMIN_QUOTES) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <FleetPanel navigate={navigate} />
                </div>
                {!isDesktop && <Nav active={screen} navigate={navigate} />}
            </div>
        );
    }

    // Social Media Automation Screen
    if (screen === AdminScreenEnum.ADMIN_SOCIAL) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <AdminSocialPanel showToast={showToast} />
                </div>
                {!isDesktop && <Nav active={screen} navigate={navigate} />}
            </div>
        );
    }

    // Landing Gallery Management Screen
    if (screen === AdminScreenEnum.ADMIN_LANDING_GALLERY) {
        return (
            <div className={`flex h-full bg-background-dark ${isDesktop ? 'flex-row' : 'flex-col'}`}>
                {isDesktop && <DesktopSidebar />}
                <div className="flex-1 overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <LandingGalleryScreen showToast={showToast} />
                </div>
                {!isDesktop && <Nav active={screen} navigate={navigate} />}
            </div>
        );
    }

    // ... (Rest of the file)
    return (
        <>
            <div className="text-white">Screen not found</div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText="Confirm"
                cancelText="Cancel"
                onConfirm={confirmModal.onConfirm}
                onCancel={closeConfirm}
                type={confirmModal.type}
            />

            {showNotificationTest && (
                <NotificationTest onClose={() => setShowNotificationTest(false)} />
            )}
        </>
    );
};

