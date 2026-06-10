import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile,
    RecaptchaVerifier,
    User,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    signInWithCustomToken
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'washer' | 'client' | 'fleet';
    phone?: string;
    address?: string;
    savedAddresses?: Array<{ id: string; label: string; address: string; icon: string }>;
    savedVehicles?: any[];
    savedCards?: Array<{ id: string; brand: string; last4: string; expiry: string }>;
    avatar?: string;
    createdAt: string;
    isGuest?: boolean;
    companyId?: string;
    companyName?: string;
}

class AuthService {
    // Register new user
    async register(email: string, password: string, userData: Partial<UserProfile>) {
        console.log('🔵 Starting registration for:', email);

        try {
            // Create Firebase Auth user
            console.log('📝 Creating Firebase Auth user...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('✅ Firebase Auth user created:', user.uid);

            // Send custom 6-digit verification code instead of web link
            console.log('📧 Sending verification code via Cloud Function...');
            const sendCode = httpsCallable(functions, 'sendVerificationCode');
            await sendCode({ email });
            console.log('✅ Verification code sent');

            // Update display name
            if (userData.name) {
                console.log('👤 Updating display name...');
                await updateProfile(user, { displayName: userData.name });
                console.log('✅ Display name updated');
            }

            const finalRole = this.isAdminEmail(email) ? 'admin' : 'client';
            const finalData: any = { ...userData };

            // Create user profile in Firestore
            const userProfile: UserProfile = {
                id: user.uid,
                email: user.email!,
                name: finalData.name || 'User',
                role: finalRole as any,
                phone: finalData.phone || '',
                address: finalData.address || '',
                avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(finalData.name || 'User')}&background=136dec&color=fff&size=200&bold=true`,
                createdAt: new Date().toISOString(),
                // Add washer specific fields if role is washer
                ...(finalRole === 'washer' ? {
                    driverLicense: finalData.driverLicense,
                    insuranceNumber: finalData.insuranceNumber,
                    vehiclePlate: finalData.vehiclePlate,
                    vehicleModel: finalData.vehicleModel,
                    completedJobs: 0,
                    rating: 5.0,
                    cancellationsCount: 0,
                    status: 'Active',
                    joinedDate: new Date().toISOString()
                } : {
                    // CLIENT SPECIFIC: Initialize savedAddresses with the registration address if available
                    savedVehicles: [],
                    savedAddresses: finalData.address ? [{
                        id: 'a_init',
                        label: 'Home',
                        address: finalData.address,
                        icon: 'home'
                    }] : []
                })
            } as any;

            console.log('💾 Saving user profile to Firestore...', userProfile);
            await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });
            console.log('✅ User profile saved to Firestore successfully!');

            // Verify it was saved
            const savedDoc = await getDoc(doc(db, 'users', user.uid));
            if (savedDoc.exists()) {
                console.log('✅ VERIFIED: User profile exists in Firestore');
            } else {
                console.error('❌ ERROR: User profile NOT found in Firestore after save!');
                throw new Error('Failed to save user profile to Firestore');
            }

            return { user, profile: userProfile };
        } catch (error: any) {
            console.error('❌ Registration error:', error);
            throw new Error(error.message || 'Registration failed');
        }
    }

    // Login user
    async login(email: string, password: string) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Simple email verification check
            if (!user.emailVerified) {
                if (!this.isAdminEmail(user.email || '')) {
                    return { requiresEmailVerification: true, email: user.email };
                }
            }

            return await this.finalizeLogin(user);
        } catch (error: any) {
            console.error('❌ Login error:', error.code, error.message);
            throw new Error(error.message || 'Login failed');
        }
    }

    // MFA methods removed for simplicity as per user request

    // Helper to finalize login details
    private async finalizeLogin(user: User) {
        // Get user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
            // AUTO-RECOVERY FOR SUPER ADMIN
            if (this.isAdminEmail(user.email || '')) {
                console.warn('⚠️ Admin profile missing in Firestore. Recreating automatically...');
                const adminProfile: UserProfile = {
                    id: user.uid,
                    email: user.email!,
                    name: user.displayName || 'Admin',
                    role: 'admin',
                    createdAt: new Date().toISOString(),
                    avatar: user.photoURL || `https://ui-avatars.com/api/?name=Admin&background=136dec&color=fff`
                };
                await setDoc(doc(db, 'users', user.uid), adminProfile, { merge: true });
                return { user, profile: adminProfile };
            }

            throw new Error('User profile not found. Please contact support.');
        }

        return { user, profile: userDoc.data() as UserProfile };
    }

    // Virtual Login (Guest Mode - No Firebase interaction)
    loginAnonymously() {
        console.log('👻 Virtual Guest Mode - No Firebase account created');
        // Return a mock profile for the local session
        const guestProfile: UserProfile = {
            id: 'virtual_guest_' + Date.now(),
            email: '',
            name: 'Guest',
            role: 'client',
            createdAt: new Date().toISOString(),
            isGuest: true
        };

        return { user: null, profile: guestProfile };
    }

    // Logout user
    async logout() {
        console.log('🚀 authService.logout() INITIATED');
        try {
            console.log('🚪 authService.logout: Inactive session cleanup...');

            // Clear storage immediately to prevent stale data access
            localStorage.clear();
            sessionStorage.clear();

            // Attempt clean Firebase sign out
            await signOut(auth);

            // Force redirect to login
            if (typeof window !== 'undefined') {
                console.log('🔄 Redirecting to login...');
                window.location.replace('/?screen=LOGIN');
            }
        } catch (error: any) {
            console.error('Logout error:', error);
            // Emergency cleanup
            localStorage.clear();
            sessionStorage.clear();
            if (typeof window !== 'undefined') {
                window.location.replace('/?screen=LOGIN');
            }
        }
    }

    // Reset password using custom 6-digit code
    async resetPassword(email: string) {
        try {
            const sendCode = httpsCallable(functions, 'sendPasswordResetCode');
            await sendCode({ email });
            console.log('✅ Password reset code sent to:', email);
        } catch (error: any) {
            console.error('Password reset error:', error);
            throw new Error(error.message || 'Password reset failed');
        }
    }

    // Finalize password reset with code
    async finalizePasswordReset(email: string, code: string, newPassword: string) {
        try {
            const resetPwd = httpsCallable(functions, 'resetPasswordWithCode');
            await resetPwd({ email, code, newPassword });
            console.log('✅ Password updated successfully');
            return true;
        } catch (error: any) {
            console.error('Final reset error:', error);
            throw new Error(error.message || 'Failed to update password');
        }
    }

    // Get current user profile
    async getCurrentUserProfile(userId: string): Promise<UserProfile | null> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                return userDoc.data() as UserProfile;
            }
            return null;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            throw error; // Propagate error to prevent data wipe in App.tsx
        }
    }

    // Check if email is admin
    isAdminEmail(email: string): boolean {
        const adminEmails = ['rodfree0@gmail.com']; // Super admin emails
        return adminEmails.includes(email.toLowerCase());
    }

    // Verify email with code (custom)
    async verifyEmailCode(email: string, code: string) {
        try {
            const verify = httpsCallable(functions, 'verifyCode');
            const result = await verify({ email, code });

            const data = result.data as any;

            if (data.success && data.token) {
                console.log('🔑 Verification successful, signing in with custom token...');
                await signInWithCustomToken(auth, data.token);
                // The onAuthStateChanged listener in App.tsx will handle the rest
            } else {
                console.log('🔄 Verification success (no token), refreshing current user...');
                // Fallback for unexpected response structure or mission token
                await auth.currentUser?.reload();
                // Force a token refresh to update the 'emailVerified' property locally
                await auth.currentUser?.getIdToken(true);
            }

            return data;
        } catch (error: any) {
            console.error('Email verification error:', error);
            throw new Error(error.message || 'Verification failed');
        }
    }

    // Resend verification code (custom)
    async resendVerificationEmail(user: User) {
        try {
            if (user.emailVerified) {
                throw new Error('Email is already verified');
            }
            const sendCode = httpsCallable(functions, 'sendVerificationCode');
            await sendCode({ email: user.email });
            console.log('✅ Verification code resent');
        } catch (error: any) {
            console.error('Error resending verification code:', error);
            throw new Error(error.message || 'Failed to resend verification code');
        }
    }

    // Delete account
    async deleteAccount() {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');

        try {
            console.log('🗑️ Starting reliable account deletion via Cloud Function for:', user.uid);

            // Call the Cloud Function
            const deleteFunc = httpsCallable(functions, 'deleteUserAccount');
            await deleteFunc();
            console.log('✅ Cloud Function account deletion successful');

            // Cleanup local storage
            localStorage.clear();
            sessionStorage.clear();

            // Force sign out locally as well (though CF should have deleted the Auth user)
            await signOut(auth);

            return true;
        } catch (error: any) {
            console.error('❌ Error deleting account:', error);
            throw new Error(error.message || 'Error al borrar la cuenta. Por favor, intenta de nuevo.');
        }
    }

    // Re-authenticate user (required for sensitive operations like MFA enrollment)
    async reauthenticate(password: string) {
        const user = auth.currentUser;
        if (!user || !user.email) throw new Error('No user logged in');

        try {
            console.log('🔐 Re-authenticating user:', user.email);
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            console.log('✅ Re-authentication successful');
            return true;
        } catch (error: any) {
            console.error('❌ Re-authentication error:', error);
            throw new Error(error.message || 'Re-authentication failed');
        }
    }
}

export const authService = new AuthService();
