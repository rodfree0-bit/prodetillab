import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, Timestamp, arrayUnion, arrayRemove, getDoc, query, where, getDocs, runTransaction, writeBatch } from 'firebase/firestore';
import { Order, ServicePackage, ServiceAddon, TeamMember, ClientUser, Notification, NotificationType, Message, Discount, Deduction, Bonus, WasherPayment, IssueReport, PayrollPeriod, ServiceArea } from '../types';
import { calculateOrderFinancials } from '../utils/financialCalculations';
import { StripeService } from '../services/StripeService';

export const useFirestoreActions = () => {

    // Helper to get next sequence
    const getNextSequence = async (counterName: string, padding: number, prefix: string = '') => {
        const counterRef = doc(db, 'settings', 'counters');
        try {
            return await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let newIndex = 1;

                if (counterDoc.exists()) {
                    const data = counterDoc.data();
                    const currentIndex = data[counterName] || 0;
                    newIndex = currentIndex + 1;
                    transaction.set(counterRef, { [counterName]: newIndex }, { merge: true });
                } else {
                    transaction.set(counterRef, { [counterName]: 1 });
                }

                return prefix + newIndex.toString().padStart(padding, '0');
            });
        } catch (e) {
            console.error(`Error generating sequence for ${counterName}`, e);
            // Fallback to timestamp if transaction fails
            return `${prefix}${Date.now()}`;
        }
    };

    // --- ORDERS ---
    const createOrder = async (orderData: Partial<Order>) => {
        try {
            // VALIDACIONES DEFENSIVAS - Evitar crear órdenes con datos inválidos
            if (!orderData.clientId) {
                throw new Error('Client ID is required');
            }
            if (!orderData.address || orderData.address.trim() === '') {
                throw new Error('Address is required');
            }
            if (!orderData.vehicleConfigs || orderData.vehicleConfigs.length === 0) {
                throw new Error('At least one vehicle configuration is required');
            }
            if (typeof orderData.price !== 'number' || orderData.price <= 0) {
                throw new Error('Valid price is required');
            }

            // Use time-based random ID for Firestore Document, delaying sequential ID until assignment
            // User Request: "Don't waste an ID for unassigned cancellations"
            const docId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

            // Remove 'id' if present
            const { id, ...rest } = orderData;

            // Remove undefined fields
            const cleanData = Object.entries(rest).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key] = value;
                }
                return acc;
            }, {} as any);

            const docRef = doc(db, 'orders', docId);
            const orderWithStatus = {
                ...cleanData,
                id: docId, // Internal ID
                displayId: null, // No sequential ID yet
                createdAt: Timestamp.now(),
                status: 'Pending',
                date: cleanData.date || new Date().toISOString().split('T')[0]
            };
            console.log("🔥 CREATING ORDER (Unassigned):", docId);
            await setDoc(docRef, orderWithStatus);


            // Notify ALL Washers using broadcast system
            try {
                await addNotification(
                    'washer-broadcast', // Special ID that all washers listen to
                    'New Order Available! 🚿',
                    `New request at ${orderWithStatus.address}. Claim it now!`,
                    'success',
                    'WASHER_JOB_DETAILS',
                    docId
                );
            } catch (notifyError) {
                console.warn("⚠️ Failed to send notifications:", notifyError);
            }

            return docId;
        } catch (error) {
            console.error("❌ Error creating order:", error);
            throw error;
        }
    };

    const updateOrder = async (orderId: string, updates: Partial<Order>) => {
        try {
            const docRef = doc(db, 'orders', orderId);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating order:", error);
            throw error;
        }
    };

    const grabOrder = async (orderId: string, washerId: string, washerName: string, washerAvatar?: string) => {
        const orderRef = doc(db, 'orders', orderId);
        const counterRef = doc(db, 'settings', 'counters');
        const washerRef = doc(db, 'users', washerId);

        try {
            return await runTransaction(db, async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists()) {
                    throw new Error('Order not found');
                }
                const orderData = orderDoc.data() as Order;
                if (orderData.status !== 'Pending') {
                    throw new Error('Order already taken');
                }

                // Fetch washer profile to check status and rating restrictions
                const washerDoc = await transaction.get(washerRef);
                if (!washerDoc.exists()) {
                    throw new Error('Washer profile not found');
                }
                const washerData = washerDoc.data();
                if (washerData.status === 'Blocked') {
                    throw new Error('Your account is blocked');
                }

                const rating = typeof washerData.rating === 'number' ? washerData.rating : 5.0;
                const price = orderData.price || 0;

                // Price-based rating requirements:
                // - Price > $150: Requires rating >= 4.5
                // - Price > $100: Requires rating >= 4.0
                // - Price > $60: Requires rating >= 3.5
                // - Price <= $60: No rating restriction (>= 1.0)
                if (price > 150 && rating < 4.5) {
                    throw new Error('This order requires a 4.5+ rating');
                } else if (price > 100 && rating < 4.0) {
                    throw new Error('This order requires a 4.0+ rating');
                } else if (price > 60 && rating < 3.5) {
                    throw new Error('This order requires a 3.5+ rating');
                }

                // Generate Sequential ID NOW (upon assignment)
                // This ensures we only "spend" an ID on valid jobs
                const counterDoc = await transaction.get(counterRef);
                let newIndex = 1;
                if (counterDoc.exists()) {
                    const data = counterDoc.data();
                    newIndex = (data['lastOrderIndex'] || 0) + 1;
                    transaction.set(counterRef, { 'lastOrderIndex': newIndex }, { merge: true });
                } else {
                    transaction.set(counterRef, { 'lastOrderIndex': 1 });
                }
                const newDisplayId = '#' + newIndex.toString().padStart(8, '0');

                transaction.update(orderRef, {
                    washerId,
                    washerName,
                    status: 'Assigned',
                    washerAvatar: washerAvatar || '',
                    displayId: newDisplayId // Assign the visible ID
                });
                return newDisplayId;
            });
        } catch (error) {
            console.error("Error grabbing order:", error);
            throw error;
        }
    };

    const submitOrderRating = async (orderId: string, ratingData: { clientRating: number, clientReview: string, tip: number, washerId: string }) => {
        try {
            console.log('🔍 submitOrderRating called with:', { orderId, ratingData });

            // Get the current order to access base price
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);

            if (!orderSnap.exists()) {
                throw new Error('Order not found');
            }

            const orderData = orderSnap.data() as Order;
            const basePrice = orderData.basePrice || orderData.price || 0;
            const tipAmount = ratingData.tip || 0;
            const totalToCharge = basePrice + tipAmount;

            // Get Global Fees from settings
            const settingsRef = doc(db, 'settings', 'fees');
            const settingsSnap = await getDoc(settingsRef);
            const globalFees = settingsSnap.exists() ? (settingsSnap.data().fees || []) : [];

            // Calculate final financial breakdown
            const financials = calculateOrderFinancials(
                { ...orderData, tip: tipAmount, basePrice },
                globalFees
            );

            // 1. Update Order with rating, review, tip, and FINANCIALS
            // Also mark as Completed finally if not already
            const updateData: any = {
                clientRating: ratingData.clientRating,
                clientReview: ratingData.clientReview,
                tip: tipAmount,
                ...financials // Save the breakdown (appRevenue, washerEarnings, etc.)
            };

            // 2. STRIPE PAYMENT: CAPTURE BASE + OPTIONAL TIP
            const isAlreadyPaid = orderData.paymentStatus === 'Paid' || orderData.finalChargedAmount !== undefined;

            if (orderData.paymentMethod === 'stripe' && !isAlreadyPaid) {
                try {
                    const paymentMethodId = orderData.stripePaymentMethodId;
                    const paymentIntentId = orderData.paymentIntentId;

                    if (orderData.paymentStatus === 'Authorized' && paymentIntentId) {
                        // CAPTURE (Base + Tip consolidated)
                        // This is the most ROBUST way: one single transaction, no $0.50 minimum issue for the tip
                        console.log(`🔐 CAPTURING TOTAL (Base + Tip): $${totalToCharge.toFixed(2)} for order ${orderId}`);
                        
                        try {
                            await StripeService.capturePayment(orderId, paymentIntentId, totalToCharge);
                            
                            updateData.paymentStatus = 'Paid';
                            updateData.paidAt = new Date().toISOString();
                            updateData.finalChargedAmount = totalToCharge;
                            updateData.tipStatus = tipAmount > 0 ? 'Paid' : 'None';
                            
                        } catch (captureErr: any) {
                            console.warn('⚠️ Consolidated capture failed, trying fallback (separate charges):', captureErr);
                            
                            // FALLBACK: If consolidated capture fails (e.g., over-capture limit), 
                            // try to capture only the base and charge tip separately (original logic)
                            await StripeService.capturePayment(orderId, paymentIntentId, basePrice);
                            updateData.paymentStatus = 'Paid';
                            updateData.paidAt = new Date().toISOString();
                            updateData.finalChargedAmount = basePrice;

                            if (tipAmount > 0 && paymentMethodId) {
                                try {
                                    const tipPaymentId = await StripeService.chargeStripeTip(tipAmount, paymentMethodId, orderId);
                                    updateData.tipPaymentId = tipPaymentId;
                                    updateData.tipStatus = 'Paid';
                                } catch (tipErr: any) {
                                    console.error('⚠️ Separate tip charge failed:', tipErr);
                                    updateData.tipStatus = 'Failed';
                                    updateData.tipError = tipErr.message;
                                }
                            }
                        }
                    } else {
                        // FALLBACK: Legacy Direct Charge (for orders created before authorization flow or guest checkouts)
                        if (!paymentMethodId) {
                            throw new Error('No payment method ID found for charge.');
                        }

                        console.log(`💳 LEGACY DIRECT CHARGE: $${totalToCharge.toFixed(2)} (Base: $${basePrice.toFixed(2)} + Tip: $${tipAmount.toFixed(2)}) using PM: ${paymentMethodId}`);
                        const chargeAttempt = await StripeService.createPayment(totalToCharge, paymentMethodId, orderId);

                        console.log('✅ Direct Payment Successful');
                        updateData.paymentStatus = 'Paid';
                        updateData.paidAt = new Date().toISOString();
                        updateData.finalChargedAmount = totalToCharge;
                        updateData.paymentId = chargeAttempt.paymentId;
                    }

                } catch (stripeErr: any) {
                    console.error('❌ Payment Operation Failed:', stripeErr);
                    updateData.paymentStatus = 'Failed';
                    updateData.paymentError = stripeErr.message || 'Payment processing error';
                }
            } else if (orderData.paymentMethod === 'stripe' && isAlreadyPaid) {
                console.log(`ℹ️ Order ${orderId} is already marked as Paid. Skipping redundant charge.`);
            } else if (orderData.paymentMethod === 'cash') {
                updateData.paymentStatus = 'Pending'; // Cash handled by washer
            }

            // Apply updates
            await updateOrder(orderId, updateData);
            console.log('✅ Firestore order updated with rating, tip, and financials');

            // 3. Update Washer Profile (Rating & Availability) via SERVER
            if (ratingData.washerId && ratingData.clientRating > 0) {
                try {
                    await StripeService.updateWasherRating(ratingData.washerId, ratingData.clientRating);
                    console.log('✅ Washer profile updated via server');
                } catch (washerUpdateError) {
                    console.warn('⚠️ Could not update washer profile (non-critical):', washerUpdateError);
                }
            }
        } catch (error) {
            console.error('❌ Error in submitOrderRating:', error);
            throw error;
        }
    };


    // --- PACKAGES (Using ID as doc key for stability) ---
    const savePackage = async (pkg: ServicePackage) => {
        try {
            // Defensive cleaning
            const cleanPrice: Record<string, number> = {};
            if (pkg.price) {
                Object.entries(pkg.price).forEach(([k, v]) => {
                    if (k && k.trim() !== '') {
                        // Ensure price is a valid number and at least 0
                        const val = parseFloat(v as any);
                        cleanPrice[k] = isNaN(val) ? 0 : Math.max(0, val);
                    }
                });
            }

            // Ensure essential fields are valid
            const cleanPkg = {
                ...pkg,
                name: pkg.name || 'Unnamed Package',
                price: cleanPrice,
                washerCommission: typeof pkg.washerCommission === 'number' ? pkg.washerCommission : 80,
                sortOrder: typeof pkg.sortOrder === 'number' ? pkg.sortOrder : 99, // Fallback para visibilidad en query
                fees: Array.isArray(pkg.fees) ? pkg.fees : []
            };

            const docRef = doc(db, 'packages', pkg.id);
            await setDoc(docRef, cleanPkg, { merge: true });
        } catch (error) {
            console.error("Error saving package:", error);
            throw error;
        }
    };

    const deletePackage = async (packageId: string) => {
        try {
            await deleteDoc(doc(db, 'packages', packageId));
        } catch (error) {
            console.error("Error deleting package:", error);
            throw error;
        }
    };

    // --- ADDONS ---
    const saveAddon = async (addon: ServiceAddon) => {
        try {
            // Defensive cleaning
            const cleanPrice: Record<string, number> = {};
            if (addon.price) {
                Object.entries(addon.price).forEach(([k, v]) => {
                    if (k && k.trim() !== '') {
                        // Ensure price is a valid number and at least 0
                        const val = parseFloat(v as any);
                        cleanPrice[k] = isNaN(val) ? 0 : Math.max(0, val);
                    }
                });
            }

            // Ensure essential fields are valid
            const cleanAddon = {
                ...addon,
                name: addon.name || 'Unnamed Add-on',
                price: cleanPrice,
                washerCommission: typeof addon.washerCommission === 'number' ? addon.washerCommission : 80,
                fees: Array.isArray(addon.fees) ? addon.fees : []
            };

            const docRef = doc(db, 'addons', addon.id);
            await setDoc(docRef, cleanAddon, { merge: true });
        } catch (error) {
            console.error("Error saving addon:", error);
            throw error;
        }
    };

    const deleteAddon = async (addonId: string) => {
        try {
            await deleteDoc(doc(db, 'addons', addonId));
        } catch (error) {
            console.error("Error deleting addon:", error);
            throw error;
        }
    };

    // --- USERS (Updates) ---
    const updateUserProfile = async (userId: string, updates: Partial<TeamMember | ClientUser>) => {
        try {
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, updates, { merge: true });
        } catch (error) {
            console.error("❌ Error updating profile:", error);
            throw error;
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            const docRef = doc(db, 'users', userId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("❌ Error deleting user:", error);
            throw error;
        }
    };

    const addClient = async (clientData: ClientUser) => {
        try {
            const docRef = doc(db, 'users', clientData.id);
            const dataToSave = {
                ...clientData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            await setDoc(docRef, dataToSave, { merge: true });
        } catch (error) {
            console.error("❌ Error adding client to Firestore:", error);
            throw error;
        }
    };

    const saveVehicleType = async (typeData: any) => {
        try {
            if (!typeData.id && !typeData.name) {
                throw new Error("Vehicle type must have at least a Name");
            }

            const id = typeData.id || `vt_${Date.now()}`;
            const docRef = doc(db, 'vehicle_types', id);

            // Defensive cleaning for simple fields
            const cleanType = {
                ...typeData,
                id,
                name: typeData.name || 'Unnamed Type',
                icon: typeData.icon || 'directions_car',
                active: typeData.active ?? true
            };

            await setDoc(docRef, cleanType, { merge: true });
        } catch (error) {
            console.error("Error saving vehicle type:", error);
            throw error;
        }
    };

    const deleteVehicleType = async (id: string) => {
        if (!id) {
            console.error("Error deleting vehicle type: Missing ID");
            return;
        }
        try {
            await deleteDoc(doc(db, 'vehicle_types', id));
        } catch (error) {
            console.error("Error deleting vehicle type:", error);
            throw error;
        }
    };

    // --- APPLICATIONS ---
    const submitWasherApplication = async (applicationData: Partial<TeamMember>) => {
        try {
            const newId = `app_${Date.now()}`;
            const docRef = doc(db, 'washer_applications', newId);
            const dataToSave = {
                ...applicationData,
                id: newId,
                role: 'washer',
                status: 'Applicant',
                joinedDate: new Date().toISOString(),
                completedJobs: 0,
                rating: 5.0,
                cancellationsCount: 0
            };
            await setDoc(docRef, dataToSave);
            return newId;
        } catch (error) {
            console.error("Error submitting application:", error);
            throw error;
        }
    };

    const approveWasherApplication = async (appId: string, appData: any) => {
        try {
            const emailId = appData.email.toLowerCase();
            const approvedRef = doc(db, 'approved_washers', emailId);

            await setDoc(approvedRef, {
                ...appData,
                role: 'washer',
                status: 'Active',
                rating: 5.0,
                completedJobs: 0,
                cancellationsCount: 0,
                approvedAt: new Date().toISOString()
            });

            await deleteDoc(doc(db, 'washer_applications', appId));

            const NotificationService = await import('../services/NotificationService').then(m => m.NotificationService);
            await NotificationService.sendEmail(
                appData.email,
                '🎉 Welcome to the Team! Your Washer Application Has Been Approved',
                `Hi ${appData.name},\n\nGreat news! Your application to join our car wash team has been approved!\n\nYou can now log in to the Washer Panel using the same credentials you used when you applied:\n\nEmail: ${appData.email}\n\nSimply visit our app and log in. You'll automatically be directed to the Washer Dashboard where you can start accepting jobs.\n\nWelcome aboard!\n\nBest regards,\nThe Car Wash Team`
            );
        } catch (error) {
            console.error("Error approving washer application:", error);
            throw error;
        }
    };

    const rejectWasherApplication = async (appId: string) => {
        try {
            await deleteDoc(doc(db, 'washer_applications', appId));
        } catch (error) {
            console.error("Error rejecting washer application:", error);
            throw error;
        }
    };

    // --- GPS TRACKING ---
    const updateOrderLocation = async (orderId: string, location: { lat: number; lng: number }) => {
        try {
            const docRef = doc(db, 'orders', orderId);
            await updateDoc(docRef, {
                washerLocation: {
                    ...location,
                    lastUpdated: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error("Error updating GPS location:", error);
        }
    };

    // --- DISCOUNTS ---
    const createDiscount = async (discountData: Omit<Discount, 'id' | 'usageCount'>) => {
        try {
            const newId = `disc_${Date.now()}`;
            const docRef = doc(db, 'discounts', newId);
            
            // Remove undefined fields
            const cleanData = Object.fromEntries(
                Object.entries(discountData).filter(([_, v]) => v !== undefined)
            );

            await setDoc(docRef, {
                ...cleanData,
                id: newId,
                usageCount: 0
            });
            return newId;
        } catch (error) {
            console.error("Error creating discount:", error);
            throw error;
        }
    };

    const updateDiscount = async (discountId: string, updates: Partial<Discount>) => {
        try {
            const docRef = doc(db, 'discounts', discountId);
            
            // Remove undefined fields
            const cleanUpdates = Object.fromEntries(
                Object.entries(updates).filter(([_, v]) => v !== undefined)
            );
            
            await updateDoc(docRef, cleanUpdates);
        } catch (error) {
            console.error("Error updating discount:", error);
            throw error;
        }
    };

    const deleteDiscount = async (discountId: string) => {
        try {
            await deleteDoc(doc(db, 'discounts', discountId));
        } catch (error) {
            console.error("Error deleting discount:", error);
            throw error;
        }
    };

    const validateDiscount = async (code: string, orderTotal: number): Promise<Discount | null> => {
        try {
            const q = query(collection(db, 'discounts'), where('code', '==', code.toUpperCase()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return null;

            const discount = snapshot.docs[0].data() as Discount;

            if (!discount.active) return null;
            if (discount.validFrom && new Date(discount.validFrom) > new Date()) return null;
            if (discount.validUntil && new Date(discount.validUntil) < new Date()) return null;
            if (discount.usageLimit && discount.usageCount >= discount.usageLimit) return null;
            if (discount.minimumOrderAmount && orderTotal < discount.minimumOrderAmount) return null;

            return discount;
        } catch (error) {
            console.error("Error validating discount:", error);
            return null;
        }
    };

    const incrementDiscountUsage = async (discountId: string) => {
        try {
            const docRef = doc(db, 'discounts', discountId);
            const snapshot = await getDocs(query(collection(db, 'discounts'), where('id', '==', discountId)));
            if (!snapshot.empty) {
                const currentCount = snapshot.docs[0].data().usageCount || 0;
                await updateDoc(docRef, { usageCount: currentCount + 1 });
            }
        } catch (error) {
            console.error("Error incrementing discount usage:", error);
        }
    };

    // --- DEDUCTIONS ---
    const createDeduction = async (deductionData: Omit<Deduction, 'id' | 'status'>) => {
        try {
            const newId = `ded_${Date.now()}`;
            const docRef = doc(db, 'deductions', newId);
            await setDoc(docRef, {
                ...deductionData,
                id: newId,
                status: 'pending'
            });
            return newId;
        } catch (error) {
            console.error("Error creating deduction:", error);
            throw error;
        }
    };

    const updateDeduction = async (deductionId: string, updates: Partial<Deduction>) => {
        try {
            const docRef = doc(db, 'deductions', deductionId);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating deduction:", error);
            throw error;
        }
    };

    const deleteDeduction = async (deductionId: string) => {
        try {
            await deleteDoc(doc(db, 'deductions', deductionId));
        } catch (error) {
            console.error("Error deleting deduction:", error);
            throw error;
        }
    };

    // --- BONUSES ---
    const createBonus = async (bonusData: Omit<Bonus, 'id' | 'status'>) => {
        try {
            const newId = `bon_${Date.now()}`;
            const docRef = doc(db, 'bonuses', newId);
            await setDoc(docRef, {
                ...bonusData,
                id: newId,
                status: 'pending'
            });
            return newId;
        } catch (error) {
            console.error("Error creating bonus:", error);
            throw error;
        }
    };

    const updateBonus = async (bonusId: string, updates: Partial<Bonus>) => {
        try {
            const docRef = doc(db, 'bonuses', bonusId);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating bonus:", error);
            throw error;
        }
    };

    const deleteBonus = async (bonusId: string) => {
        try {
            await deleteDoc(doc(db, 'bonuses', bonusId));
        } catch (error) {
            console.error("Error deleting bonus:", error);
            throw error;
        }
    };

    // --- PAYMENTS ---
    const createPayment = async (paymentData: Omit<WasherPayment, 'id'>) => {
        try {
            const newId = `pay_${Date.now()}`;
            const docRef = doc(db, 'payments', newId);
            await setDoc(docRef, {
                ...paymentData,
                id: newId
            });
            return newId;
        } catch (error) {
            console.error("Error creating payment:", error);
            throw error;
        }
    };


    const cancelOrder = async (orderId: string, applyFeeInput: boolean = false) => {
        try {
            const orderRef = doc(db, 'orders', orderId);
            return await runTransaction(db, async (transaction) => {
                const orderSnap = await transaction.get(orderRef);
                if (!orderSnap.exists()) {
                    throw new Error("Order not found");
                }

                const orderData = orderSnap.data() as Order;
                console.log("🔍 [cancelOrder] Transaction Data:", {
                    id: orderId,
                    status: orderData.status,
                    washerId: orderData.washerId,
                    paymentStatus: orderData.paymentStatus,
                    price: orderData.price
                });

                // Enforce fee ONLY if washer was assigned AND it's a late cancellation AND fee is requested
                const hasWasher = !!(orderData.washerId && orderData.washerId.trim() !== "");
                const isLateCancellation = orderData.status !== "Pending" && orderData.status !== "Cancelled";
                
                // CRITICAL: Respect the applyFeeInput flag (usually false for Admin cancellations)
                const shouldChargeFee = applyFeeInput && hasWasher && isLateCancellation;

                console.log("🔍 [cancelOrder] Logic Decision:", { hasWasher, isLateCancellation, applyFeeInput, shouldChargeFee });

                const updateData: any = {
                    status: 'Cancelled',
                    updatedAt: Timestamp.now()
                };

                if (shouldChargeFee) {
                    updateData.price = 25;
                    updateData.cancellationFee = 25;
                    updateData.washerEarnings = 25; // 100% to washer
                    updateData.appRevenue = 0;
                    updateData.paymentStatus = 'Pending'; // Default to pending until charged
                } else {
                    updateData.price = 0;
                    updateData.washerEarnings = 0;
                    updateData.paymentStatus = 'Voided'; // Explicitly mark as Voided/No Charge
                }

                console.log("🔥 Updating Order in Firestore:", orderId, updateData);
                transaction.update(orderRef, updateData);
                console.log(`✅ Transaction step for ${orderId} completed locally.`);

                // Return data for Stripe charge outside transaction
                return { orderData, shouldChargeFee, updateData };
            }).then(async ({ orderData, shouldChargeFee, updateData }) => {
                // 1. STRIPE CANCELLATION LOGIC (Instant Release or Partial Capture)
                const paymentIntentId = orderData.paymentIntentId;
                const paymentStatus = orderData.paymentStatus;
                const paymentMethodId = orderData.stripePaymentMethodId;

                try {
                    if (shouldChargeFee) {
                        // A. CHARGE CANCELLATION FEE ($25)
                        if (paymentStatus === 'Authorized' && paymentIntentId) {
                            // PARTIAL CAPTURE: Capture only $25 from the hold, Stripe releases the rest instantly
                            console.log(`🔐 PARTIAL CAPTURE: $25 fee from PI: ${paymentIntentId} for order ${orderId}`);
                            await StripeService.capturePayment(orderId, paymentIntentId, 25);
                            await updateDoc(orderRef, {
                                paymentStatus: 'Paid',
                                finalChargedAmount: 25,
                                paidAt: new Date().toISOString()
                            });
                        } else if (paymentMethodId) {
                            // Legacy/Direct charge if no active hold or cash order with registered card
                            console.log(`💳 DIRECT CHARGE FEE: $25 for order ${orderId} using PM: ${paymentMethodId}`);
                            const chargeAttempt = await StripeService.createPayment(25, paymentMethodId, orderId);
                            await updateDoc(orderRef, {
                                paymentStatus: 'Paid',
                                finalChargedAmount: 25,
                                paidAt: new Date().toISOString(),
                                paymentId: chargeAttempt.paymentId
                            });
                        }
                        console.log('✅ Cancellation Fee processed successfully');
                    } else if (paymentStatus === 'Authorized' && paymentIntentId) {
                        // B. INSTANT RELEASE (No fee)
                        console.log(`❌ INSTANT RELEASE: Cancelling hold ${paymentIntentId} for order ${orderId}`);
                        await StripeService.cancelAuthorization(paymentIntentId, orderId);
                        // Status will be updated to 'Voided' by the cloud function
                    }
                } catch (stripeErr: any) {
                    console.error('❌ Stripe Cancellation Operation Failed:', stripeErr);
                    
                    if (shouldChargeFee) {
                        await updateDoc(orderRef, {
                            paymentStatus: 'Failed',
                            paymentError: stripeErr.message || 'Payment declined for cancellation fee'
                        });

                        // NOTIFY ADMIN of failed cancellation fee
                        await addNotification(
                            'admin-broadcast',
                            'Failed Cancellation Fee',
                            `Failed to charge $25 fee for cancelled order ${orderId}. Client: ${orderData.clientName}. Error: ${stripeErr.message || 'Declined'}`,
                            'error',
                            'ADMIN_DASHBOARD',
                            orderId
                        );
                    }
                }

                // 2. Notifications
                if (orderData.washerId) {
                    await addNotification(
                        orderData.washerId,
                        'Order Cancelled',
                        shouldChargeFee
                            ? `Order cancelled. You receive $25 cancellation fee.`
                            : `Order cancelled by client.`,
                        shouldChargeFee ? 'success' : 'error',
                        'WASHER_DASHBOARD',
                        orderId
                    );
                }

                if (orderData.clientId) {
                    await addNotification(
                        orderData.clientId,
                        'Order Cancelled',
                        shouldChargeFee
                            ? 'Order cancelled. A $25 fee applies as a washer was assigned.'
                            : 'Order cancelled successfully. No charge applied.',
                        'info',
                        'CLIENT_HOME',
                        orderId
                    );
                }
            });

        } catch (error) {
            console.error("Error cancelling order:", error);
            throw error;
        }
    };

    const dropOrder = async (orderId: string, washerId: string) => {
        const orderRef = doc(db, 'orders', orderId);
        const washerRef = doc(db, 'users', washerId);

        try {
            return await runTransaction(db, async (transaction) => {
                const orderDoc = await transaction.get(orderRef);
                if (!orderDoc.exists()) {
                    throw new Error('Order not found');
                }
                const orderData = orderDoc.data() as Order;

                const validStatuses = ['Assigned', 'En Route', 'Arrived'];
                if (!validStatuses.includes(orderData.status)) {
                    throw new Error('Order cannot be dropped in its current status');
                }

                if (orderData.washerId !== washerId) {
                    throw new Error('Order is not assigned to this washer');
                }

                const washerDoc = await transaction.get(washerRef);
                if (!washerDoc.exists()) {
                    throw new Error('Washer profile not found');
                }
                const washerData = washerDoc.data();
                const washerName = washerData.name || 'Washer';

                // Calculate rating deduction and cancellations
                const currentRating = typeof washerData.rating === 'number' ? washerData.rating : 5.0;
                const newRating = Math.max(1.0, parseFloat((currentRating - 0.5).toFixed(1)));
                const newCancellationsCount = (washerData.cancellationsCount || 0) + 1;
                const isBlocked = newRating <= 3.0;

                // Update washer profile
                transaction.update(washerRef, {
                    rating: newRating,
                    cancellationsCount: newCancellationsCount,
                    ...(isBlocked ? { status: 'Blocked' } : {})
                });

                // Apply 10% discount on order
                const price = orderData.price || 0;
                const discountVal = parseFloat((price * 0.10).toFixed(2));
                const newPrice = parseFloat((price - discountVal).toFixed(2));
                const currentDiscountAmount = orderData.discountAmount || 0;
                const newDiscountAmount = parseFloat((currentDiscountAmount + discountVal).toFixed(2));

                // Reset assignment details, set price/discount and set state to PendingReschedule
                transaction.update(orderRef, {
                    status: 'PendingReschedule',
                    price: newPrice,
                    discountAmount: newDiscountAmount,
                    washerId: '',
                    washerName: '',
                    washerAvatar: '',
                    displayId: null,
                    adminFlag: true,
                    adminAlertReason: `Washer ${washerName} dropped order. 10% discount applied.`
                });

                return {
                    clientId: orderData.clientId,
                    washerName,
                    newRating,
                    isBlocked
                };
            }).then(async ({ clientId, washerName, newRating, isBlocked }) => {
                // Send Client Notification - English, no emojis
                if (clientId) {
                    await addNotification(
                        clientId,
                        'Order Reschedule Required',
                        'Your washer cancelled your order. They were penalized 0.5 stars, and we gave you 10% off. Tap to reschedule at a different time.',
                        'warning',
                        'CLIENT_HOME',
                        orderId
                    );
                }

                // Notify admin about the drop - English, no emojis
                await addNotification(
                    'admin-broadcast',
                    'Washer Dropped Job',
                    `Washer ${washerName} dropped order ${orderId}. They were penalized 0.5 stars. New rating is ${newRating}.`,
                    'warning',
                    'ADMIN_DASHBOARD',
                    orderId
                );

                // Notify admin if blocked - English, no emojis
                if (isBlocked) {
                    await addNotification(
                        'admin-broadcast',
                        'Washer Account Blocked',
                        `Washer ${washerName} has been automatically blocked because their rating fell to ${newRating} stars.`,
                        'error',
                        'ADMIN_DASHBOARD',
                        washerId
                    );
                }
            });
        } catch (error) {
            console.error("Error dropping order:", error);
            throw error;
        }
    };
    const cancelStripeAuthIfExists = async (orderData: any) => {
        if (
            orderData.paymentIntentId &&
            (orderData.paymentStatus === 'Authorized' || orderData.paymentStatus === 'Pending')
        ) {
            try {
                await StripeService.cancelAuthorization(orderData.paymentIntentId, orderData.id);
                console.log('✅ Stripe auth cancelled for order:', orderData.id);
            } catch (err) {
                console.warn('⚠️ Could not cancel Stripe auth (non-critical):', err);
            }
        }
    };

    const testPushNotification = async (userId: string) => {
        try {
            const testRef = doc(collection(db, 'test_notifications'));
            await setDoc(testRef, {
                userId,
                title: 'Prueba de Notificación 🔔',
                body: 'Si ves esto, las notificaciones push están funcionando correctamente.',
                timestamp: Date.now(),
                status: 'pending'
            });
            console.log("Test notification triggered for user:", userId);
        } catch (error) {
            console.error("Error triggering test notification:", error);
            throw error;
        }
    };

    // --- PAYROLL PERIODS ---
    const createPayrollPeriod = async (periodData: Omit<PayrollPeriod, 'id'>) => {
        try {
            const newId = `period_${Date.now()}`;
            const docRef = doc(db, 'payroll_periods', newId);
            await setDoc(docRef, {
                ...periodData,
                id: newId
            });
            return newId;
        } catch (error) {
            console.error("Error creating payroll period:", error);
            throw error;
        }
    };

    const updatePayrollPeriod = async (periodId: string, updates: Partial<PayrollPeriod>) => {
        try {
            const docRef = doc(db, 'payroll_periods', periodId);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating payroll period:", error);
            throw error;
        }
    };

    // --- ISSUES ---
    const createIssue = async (issueData: Omit<IssueReport, 'id' | 'timestamp' | 'status'>) => {
        try {
            // Remove undefined fields to avoid Firestore errors
            const cleanData: any = {
                clientId: issueData.clientId,
                clientEmail: issueData.clientEmail,
                subject: issueData.subject,
                description: issueData.description,
                timestamp: Date.now(),
                status: 'Open'
            };

            // Only add orderId if it exists and is not undefined
            if (issueData.orderId && issueData.orderId !== undefined) {
                cleanData.orderId = issueData.orderId;
            }

            // Only add image if it exists
            if (issueData.image) {
                cleanData.image = issueData.image;
            }

            await addDoc(collection(db, 'issues'), cleanData);
            return "success";
        } catch (error) {
            console.error("Error creating issue:", error);
            throw error;
        }
    };

    const updateIssue = async (id: string, updates: Partial<IssueReport>) => {
        try {
            const docRef = doc(db, 'issues', id);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating issue:", error);
            throw error;
        }
    };

    // --- MESSAGES ---
    const sendMessage = async (senderId: string, receiverId: string, orderId: string, content: string, type: 'text' | 'image' = 'text') => {
        try {
            await addDoc(collection(db, 'messages'), {
                senderId,
                receiverId,
                orderId,
                content,
                type,
                timestamp: Date.now(),
                read: false
            });

            // Auto-generate notification for the receiver
            await addNotification(
                receiverId,
                'New Message',
                type === 'image' ? 'Sent you an image' : content.length > 50 ? `${content.substring(0, 47)}...` : content,
                'info',
                'CLIENT_HOME', // This is a general link, the client/washer will handle specialized opening
                orderId
            );

            return "success";
        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    };

    const markMessagesAsRead = async (orderId: string, userId: string) => {
        try {
            const q = query(
                collection(db, 'messages'),
                where('orderId', '==', orderId),
                where('receiverId', '==', userId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);
            const batch = writeBatch(db);

            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    };

    // --- NOTIFICATIONS ---
    const addNotification = async (userId: string, title: string, message: string, type: NotificationType = 'info', linkTo?: any, relatedId?: string) => {
        try {
            // Filter out undefined fields to avoid Firestore "invalid data" error
            const notificationData: any = {
                userId,
                title,
                message,
                type,
                read: false,
                timestamp: Date.now()
            };

            if (linkTo !== undefined) notificationData.linkTo = linkTo;
            if (relatedId !== undefined) notificationData.relatedId = relatedId;

            await addDoc(collection(db, 'notifications'), notificationData);
        } catch (error) {
            console.error("Error creating notification:", error);
            throw error;
        }
    };

    const markNotificationRead = async (id: string) => {
        try {
            const docRef = doc(db, 'notifications', id);
            await updateDoc(docRef, { read: true });
        } catch (error) {
            console.error("Error marking notification read:", error);
            throw error;
        }
    };

    return {
        createOrder, updateOrder, grabOrder, dropOrder, cancelOrder,
        savePackage, deletePackage,
        saveAddon, deleteAddon,
        updateUserProfile, deleteUser, addClient,
        saveVehicleType, deleteVehicleType,

        submitWasherApplication, approveWasherApplication, rejectWasherApplication,
        updateOrderLocation,
        // Payment system
        createDiscount, updateDiscount, deleteDiscount, validateDiscount, incrementDiscountUsage,
        createDeduction, updateDeduction, deleteDeduction,
        createBonus, updateBonus, deleteBonus,
        createPayment,
        createPayrollPeriod, updatePayrollPeriod,
        createIssue, updateIssue,
        sendMessage, markMessagesAsRead,
        addNotification, markNotificationRead,
        submitOrderRating,
        testPushNotification,
        saveServiceArea: async (area: ServiceArea) => {
            await setDoc(doc(db, 'settings', 'service_area'), area);
        }
    };
};
