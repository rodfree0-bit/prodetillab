import React, { useState, useEffect, useRef } from 'react';
import { Screen } from '../types';
import { authService } from '../services/authService';
import { auth as firebaseAuth } from '../firebase';
import { LegalModal } from './LegalComponents';
import { OTPInput } from './OTPInput';
import { formatPhoneNumber } from '../utils/formatters';
import { AddressAutocomplete } from './AddressAutocomplete';
import { i18n } from '../services/i18n';

interface AuthProps {
  screen: Screen;
  navigate: (screen: Screen) => void;
  onGuestLogin?: (profile: any) => void;
}

// Helper function to translate Firebase errors to user-friendly messages
const getErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  const errorMessage = error?.message || '';

  if (errorCode.includes('invalid-credential') || errorCode.includes('wrong-password') || errorCode.includes('user-not-found')) {
    return 'Invalid email or password. Please try again.';
  }
  if (errorCode.includes('email-already-in-use')) {
    return 'This email is already registered. Please sign in instead.';
  }
  if (errorCode.includes('weak-password')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (errorCode.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (errorCode.includes('network-request-failed')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (errorCode.includes('too-many-requests')) {
    return 'Too many attempts. Please try again later.';
  }

  if (errorMessage.toLowerCase().includes('firebase')) {
    return 'An error occurred. Please try again.';
  }

  return errorMessage || 'An error occurred. Please try again.';
};

// --- Custom Components ---

const CustomInput = ({ label, type, value, onChange, placeholder }: any) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="mb-5">
      <label className="block text-xs uppercase text-slate-400 font-bold mb-2 ml-1">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-4 md:p-4 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-all pr-12 text-base min-h-[48px]"
          autoCapitalize="none"
          autoComplete={isPassword ? 'current-password' : (type === 'email' ? 'email' : 'off')}
          spellCheck={false}
          style={{ fontSize: '16px' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xl">
              {showPassword ? 'visibility' : 'visibility_off'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

const CustomButton = ({ children, onClick, disabled, variant = 'primary' }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full min-h-[56px] h-auto py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 touch-manipulation ${disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${variant === 'primary'
        ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20 active:scale-[0.98]'
        : 'bg-white/5 text-white hover:bg-white/10 border border-white/10 active:scale-[0.98]'
      }`}
    style={{ fontSize: '18px' }}
  >
    {children}
  </button>
);

// --- Login Screen ---

const LoginScreen = ({ navigate }: { navigate: (s: Screen) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    // Check if user is already logged in via Firebase but not verified
    const user = firebaseAuth.currentUser;
    if (user && !user.emailVerified && !authService.isAdminEmail(user.email || '')) {
      setEmailToVerify(user.email || '');
      setShowEmailVerify(true);
    }

    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await authService.login(email, password);

      if (result && (result as any).requiresEmailVerification) {
        setEmailToVerify((result as any).email);
        setShowEmailVerify(true);
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (emailCode.length !== 6) return;
    setIsLoading(true);
    setError('');
    try {
      await authService.verifyEmailCode(emailToVerify, emailCode);
      // Fallback navigation in case listener is slow
      console.log('✅ Email verified, navigating to Home (Fallback)...');
      navigate(Screen.CLIENT_HOME);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0 || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const user = firebaseAuth.currentUser;
      if (user) {
        await authService.resendVerificationEmail(user);
        setResendTimer(60); // 60 second cooldown
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (showEmailVerify) {
    return (
      <div className="flex flex-col min-h-screen bg-background-dark p-6 overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8">
          <div className="mb-8 text-center animate-fade-in">
            <span className="material-symbols-outlined text-6xl text-primary mb-4">mail</span>
            <h1 className="text-3xl font-bold mb-2 text-white">Verify Email</h1>
            <p className="text-slate-400 text-base">Enter the 6-digit code sent to <strong>{emailToVerify}</strong></p>
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 animate-shake">
              <span className="material-symbols-outlined mt-0.5 text-xl text-red-500">error</span>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
          <OTPInput value={emailCode} onChange={setEmailCode} isLoading={isLoading} onComplete={() => handleVerifyEmail(null as any)} />
          <div className="mt-4">
            <CustomButton disabled={isLoading || emailCode.length !== 6} onClick={handleVerifyEmail}>
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </CustomButton>
          </div>
          <div className="mt-6 text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-slate-500">Resend code in <span className="text-primary font-bold">{resendTimer}s</span></p>
            ) : (
              <button
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-primary font-bold hover:underline transition-all disabled:opacity-50"
              >
                Resend verification code
              </button>
            )}
          </div>
          <div className="mt-8 text-center pt-4 border-t border-white/5 space-y-4">
            <button
              onClick={() => setShowEmailVerify(false)}
              className="text-slate-400 hover:text-white transition-colors block mx-auto text-sm"
            >
              Back to Sign In
            </button>
            <button
              onClick={async () => {
                await authService.logout();
                navigate(Screen.REGISTER);
              }}
              className="text-primary font-bold hover:underline transition-all block mx-auto"
            >
              Back to Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-dark p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8">
        <div className="mb-8 text-center animate-fade-in">
          <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center mx-auto mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight text-white">Welcome Back</h1>
          <p className="text-slate-400 text-base">Sign in to continue to your dashboard</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 animate-shake">
            <span className="material-symbols-outlined mt-0.5 text-xl text-red-500">error</span>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="animate-slide-up">
          <CustomInput
            label="Email Address"
            type="email"
            value={email}
            onChange={(e: any) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
          <CustomInput
            label="Password"
            type="password"
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <div className="flex justify-end mb-6">
            <button
              type="button"
              onClick={() => navigate(Screen.RECOVER_PASSWORD)}
              className="text-sm text-primary font-bold min-h-[44px] px-2 py-2 hover:underline"
            >
              Forgot Password?
            </button>
          </div>
          <CustomButton disabled={isLoading} onClick={handleSubmit}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </CustomButton>
        </form>

        <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <p className="text-slate-400 text-base">
            Don't have an account?{' '}
            <button onClick={() => navigate(Screen.REGISTER)} className="text-primary font-bold hover:underline min-h-[44px] px-2 py-2 inline-flex items-center">
              Create Account
            </button>
          </p>
        </div>



      </div>
      <div className="text-center pb-4">
        <button onClick={() => navigate(Screen.ONBOARDING)} className="text-slate-500 text-sm font-bold flex items-center justify-center gap-1 hover:text-white transition-colors min-h-[44px] px-4 py-2 mx-auto">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back to Home
        </button>
      </div>
    </div>
  );
};


// --- Forgot Password Screen ---

const ForgotPasswordScreen = ({ navigate }: { navigate: (s: Screen) => void }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (!email) {
      setMessage('Please enter your email address');
      setIsSuccess(false);
      setIsLoading(false);
      return;
    }

    try {
      await authService.resetPassword(email);
      setMessage(`A 6-digit reset code has been sent to ${email}`);
      setIsSuccess(true);
      setStep('VERIFY');
    } catch (err: any) {
      setMessage(getErrorMessage(err));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setMessage('Please enter the 6-digit code');
      setIsSuccess(false);
      return;
    }
    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      await authService.finalizePasswordReset(email, code, newPassword);
      setMessage('Password updated successfully! You can now sign in.');
      setIsSuccess(true);
      setTimeout(() => navigate(Screen.LOGIN), 3000);
    } catch (err: any) {
      setMessage(getErrorMessage(err));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-dark p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8">
        <div className="mb-8 text-center">
          <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center mx-auto mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-white">
            {step === 'REQUEST' ? 'Reset Password' : 'Verify & Reset'}
          </h1>
          <p className="text-slate-400 text-base">
            {step === 'REQUEST'
              ? "Enter your email and we'll send you a verification code."
              : "Check your inbox for the 6-digit code to set your new password."}
          </p>
        </div>

        {message && (
          <div className={`border rounded-xl p-4 mb-6 flex items-start gap-3 animate-fade-in ${isSuccess
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-red-500/10 border-red-500/20'
            }`}>
            <span className={`material-symbols-outlined mt-0.5 text-xl ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
              {isSuccess ? 'check_circle' : 'error'}
            </span>
            <p className={`text-sm ${isSuccess ? 'text-green-200' : 'text-red-200'}`}>{message}</p>
          </div>
        )}

        {step === 'REQUEST' ? (
          <form onSubmit={handleRequestCode} className="animate-slide-up">
            <CustomInput
              label="Email Address"
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
            <CustomButton disabled={isLoading} onClick={handleRequestCode}>
              {isLoading ? 'Sending code...' : 'Send Reset Code'}
            </CustomButton>
          </form>
        ) : (
          <form onSubmit={handleFinalReset} className="animate-slide-up">
            <div className="mb-6">
              <label className="block text-xs uppercase text-slate-400 font-bold mb-3 text-center">Verification Code</label>
              <OTPInput value={code} onChange={setCode} isLoading={isLoading} />
            </div>
            <CustomInput
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e: any) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
            <CustomButton disabled={isLoading || code.length !== 6} onClick={handleFinalReset}>
              {isLoading ? 'Updating...' : 'Update Password'}
            </CustomButton>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setStep('REQUEST')}
                className="text-sm text-primary hover:text-white transition-colors"
                disabled={isLoading}
              >
                Resend code or use different email
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-base">
            Remember your password?{' '}
            <button onClick={() => navigate(Screen.LOGIN)} className="text-primary font-bold hover:underline min-h-[44px] px-2 py-2 inline-flex items-center">
              Back to Sign In
            </button>
          </p>
        </div>
      </div>
      <div className="text-center pb-4">
        <button onClick={() => navigate(Screen.ONBOARDING)} className="text-slate-500 text-sm font-bold flex items-center justify-center gap-1 hover:text-white transition-colors min-h-[44px] px-4 py-2 mx-auto">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back to Home
        </button>
      </div>
    </div>
  );
};

// --- Register Screen ---

const RegisterScreen = ({ navigate }: { navigate: (s: Screen) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+1 ');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);

  // Email Verification states
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must accept the Terms & Conditions');
      return;
    }

    setIsLoading(true);
    setError('');

    const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
    const role = authService.isAdminEmail(email) ? 'admin' : 'client';

    try {
      const result = await authService.register(email, password, {
        name: `${firstName} ${lastName}`,
        phone: phoneNumber,
        address: fullAddress,
        role
      });
      setShowEmailVerify(true);
      // console.log('✅ Registration successful, navigating...');
      // Navigation will be handled by the onAuthStateChanged listener in App.tsx
      // if (result) navigate(Screen.CLIENT_HOME); 
    } catch (err: any) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (emailCode.length !== 6) return;
    setIsLoading(true);
    setError('');
    try {
      await authService.verifyEmailCode(email, emailCode);
      console.log('✅ Email verification call finished successfully. Navigating...');
      // Direct navigation as fallback
      const role = authService.isAdminEmail(email) ? 'admin' : 'client';
      if (role === 'admin') navigate(Screen.ADMIN_DASHBOARD);
      else navigate(Screen.CLIENT_HOME);
    } catch (err: any) {
      console.error('❌ Verification failed in UI:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0 || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const user = firebaseAuth.currentUser;
      if (user) {
        await authService.resendVerificationEmail(user);
        setResendTimer(60); // 60 second cooldown
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (showEmailVerify) {
    return (
      <div className="flex flex-col min-h-screen bg-background-dark p-6 overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8">
          <div className="mb-8 text-center animate-fade-in">
            <span className="material-symbols-outlined text-6xl text-primary mb-4">alternate_email</span>
            <h1 className="text-3xl font-bold mb-2 text-white">Verify Your Email</h1>
            <p className="text-slate-400 text-base">We've sent a 6-digit code to <strong>{email}</strong></p>
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 animate-shake">
              <span className="material-symbols-outlined mt-0.5 text-xl text-red-500">error</span>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
          <OTPInput value={emailCode} onChange={setEmailCode} isLoading={isLoading} onComplete={() => handleVerifyEmailCode(null as any)} />
          <div className="mt-4">
            <CustomButton disabled={isLoading || emailCode.length !== 6} onClick={handleVerifyEmailCode}>
              {isLoading ? 'Verifying...' : 'Continue'}
            </CustomButton>
          </div>
          <div className="mt-6 text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-slate-500">Resend code in <span className="text-primary font-bold">{resendTimer}s</span></p>
            ) : (
              <button
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-primary font-bold hover:underline transition-all disabled:opacity-50"
              >
                Resend verification code
              </button>
            )}
          </div>
          <div className="mt-8 text-center pt-4 border-t border-white/5">
            <button onClick={() => setShowEmailVerify(false)} className="text-slate-400 hover:text-white transition-colors">Back to Register</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-dark p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-8">
        <div className="mb-8 text-center animate-fade-in">
          <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center mx-auto mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-white">Create Account</h1>
          <p className="text-slate-400 text-base">Join Pro Detail Lab today</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3 animate-shake">
            <span className="material-symbols-outlined mt-0.5 text-xl text-red-500">error</span>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="animate-slide-up">
          <div className="grid grid-cols-2 gap-4">
            <CustomInput label="First Name" type="text" value={firstName} onChange={(e: any) => setFirstName(e.target.value)} placeholder="John" />
            <CustomInput label="Last Name" type="text" value={lastName} onChange={(e: any) => setLastName(e.target.value)} placeholder="Doe" />
          </div>
          <CustomInput label="Email Address" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="john.doe@example.com" />
          <CustomInput
            label="Phone Number"
            type="tel"
            value={phoneNumber}
            onChange={(e: any) => setPhoneNumber(formatPhoneNumber(e.target.value))}
            placeholder="+1 (234) 567-8900"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <div className="col-span-1 md:col-span-2 mb-4">
              <AddressAutocomplete
                label="Home Address"
                value={address}
                onChange={setAddress}
                onAddressSelect={(fullAddr, lat, lng, meta) => {
                  setAddress(fullAddr);
                  if (meta) {
                    if (meta.city) setCity(meta.city);
                    if (meta.state) setState(meta.state);
                    if (meta.zip) setZipCode(meta.zip);
                  }
                }}
                placeholder="Start typing your address..."
              />
            </div>
            <CustomInput label="City" type="text" value={city} onChange={(e: any) => setCity(e.target.value)} placeholder="Miami" />

            <div className="grid grid-cols-2 gap-4">
              <CustomInput label="State" type="text" value={state} onChange={(e: any) => setState(e.target.value)} placeholder="FL" />
              <CustomInput label="Zip Code" type="text" value={zipCode} onChange={(e: any) => setZipCode(e.target.value)} placeholder="33101" />
            </div>
          </div>

          <CustomInput label="Password" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} placeholder="Min 6 characters" />

          <div className="mb-6 flex items-start gap-3 p-2">
            <div className="relative flex items-center h-5 mt-1">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-5 h-5 bg-white/5 border border-white/20 rounded focus:ring-primary focus:ring-offset-background-dark text-primary cursor-pointer accent-primary"
              />
            </div>
            <label htmlFor="terms" className="text-sm text-slate-400 select-none cursor-pointer">
              I agree to the{' '}
              <button type="button" onClick={() => setShowLegalModal('terms')} className="text-primary hover:underline font-bold transition-colors">Terms & Conditions</button>
              {' '}and{' '}
              <button type="button" onClick={() => setShowLegalModal('privacy')} className="text-primary hover:underline font-bold transition-colors">Privacy Policy</button>.
            </label>
          </div>

          <CustomButton disabled={isLoading || !termsAccepted} onClick={handleRegisterSubmit}>
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </CustomButton>
        </form>

        <LegalModal isOpen={!!showLegalModal} onClose={() => setShowLegalModal(null)} title={showLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'} content={showLegalModal === 'terms' ? 'terms' : 'privacy'} />

        <div className="mt-8 text-center">
          <p className="text-slate-400">Already have an account? <button onClick={() => navigate(Screen.LOGIN)} className="text-primary font-bold hover:underline">Sign In</button></p>
        </div>
      </div>
      <div className="text-center pb-4">
        <button onClick={() => navigate(Screen.ONBOARDING)} className="text-slate-500 text-sm font-bold flex items-center justify-center gap-1 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-base">arrow_back</span> Back to Home
        </button>
      </div>
    </div>
  );
};

// --- Onboarding Screen ---

const OnboardingScreen = ({ navigate, onGuestLogin }: { navigate: (s: Screen) => void, onOpenChat: () => void, onGuestLogin?: (profile: any) => void }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  const carWashSlides = [
    { url: "/wheel_polish.png", title: "Professional Wheel Detailing", desc: "Deep cleaning and polishing for a showroom-quality shine" },
    { url: "/ceramic_coating.png", title: "Premium Ceramic Coating", desc: "Nano-ceramic protection with a stunning mirror finish" },
    { url: "/interior_detail.png", title: "Complete Interior Detailing", desc: "Deep cleaning and conditioning for every interior surface" },
    { url: "/paint_restoration.png", title: "Paint Correction", desc: "Expert buffing to bring back your car's original brilliance" }
  ];

  useEffect(() => {
    if (!isAutoRotating) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % carWashSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isAutoRotating]);

  return (
    <div className="flex flex-col h-full bg-background-dark text-white relative overflow-hidden items-center">
      {carWashSlides.map((slide, index) => (
        <div key={index} className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === activeIndex ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundImage: `url("${slide.url}")` }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-background-dark/95"></div>
        </div>
      ))}

      <div className="w-full max-w-md h-full flex flex-col items-center relative z-10 px-6 py-12 justify-between text-center">
        <div className="pt-8">
        </div>

        <div className="pb-2">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            <span className="text-blue-400">{carWashSlides[activeIndex].title.split(' ')[0]}</span> {carWashSlides[activeIndex].title.split(' ').slice(1).join(' ')}
          </h2>
          <p className="text-base text-white/90 drop-shadow-md max-w-sm mx-auto">{carWashSlides[activeIndex].desc}</p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <button onClick={() => navigate(Screen.REGISTER)} className="w-full h-16 bg-blue-600 rounded-2xl font-bold text-xl shadow-xl active:scale-95 transition-all">Create Account</button>
          <button onClick={() => navigate(Screen.LOGIN)} className="w-full h-16 bg-white/5 rounded-2xl font-bold text-xl border border-white/10 active:scale-95 transition-all backdrop-blur-sm">I have an account</button>

          <button onClick={async () => {
            try {
              const { profile } = await authService.loginAnonymously();
              if (onGuestLogin) onGuestLogin(profile);
            } catch (error) {
              console.error("Guest login failed", error);
            }
          }} className="text-sm font-bold text-blue-400 hover:text-blue-300 underline">Continue as Guest</button>
        </div>
      </div>
    </div>
  );
};

export const AuthScreens: React.FC<AuthProps> = ({ screen, navigate, onGuestLogin }) => {
  if (screen === Screen.ONBOARDING) return <OnboardingScreen navigate={navigate} onOpenChat={() => { }} onGuestLogin={onGuestLogin} />;
  if (screen === Screen.LOGIN) return <LoginScreen navigate={navigate} />;
  if (screen === Screen.REGISTER) return <RegisterScreen navigate={navigate} />;
  if (screen === Screen.RECOVER_PASSWORD) return <ForgotPasswordScreen navigate={navigate} />;
  return null;
};
