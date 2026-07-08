'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePlatformStatusStore } from '@/stores/platformStatusStore';
import toast from 'react-hot-toast';
import '../auth.css';

/* â”€â”€ animation helpers â”€â”€ */
const fadeUp = (delay: number) => ({
  initial: { y: 16, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { delay, duration: 0.45, ease: 'easeOut' as const },
});

const formVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

/* â”€â”€ step config â”€â”€ */
const STEPS = [
  { number: 1, label: 'Sign in to your account' },
  { number: 2, label: 'Demo Account' },
  { number: 3, label: 'Sign up your account' },
];

const LEFT_CONFIG: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Welcome Back', subtitle: 'Sign in to continue where you left off.' },
  2: { title: 'Try It Out', subtitle: 'Explore the app with a demo account.' },
  3: { title: 'Get Started with Us', subtitle: 'Complete these easy steps to register your account.' },
};

/* â”€â”€ error helper â”€â”€ */
function authErrorMessage(err: unknown, kind: 'login' | 'demo' | 'forgot'): string {
  const raw = err instanceof Error ? err.message.trim() : 'Something went wrong.';
  const lower = raw.toLowerCase();
  if (kind === 'login' && (raw === 'Invalid credentials' || lower === 'invalid credentials'))
    return 'The email or password you entered is incorrect.';
  if (lower.includes('invalid 2fa'))
    return 'The verification code is incorrect or expired.';
  return raw;
}

/* â”€â”€ Input Field â”€â”€ */
function AuthInput({
  label, type = 'text', placeholder, value, onChange, error, helper, rightIcon, onIconClick,
}: {
  label: string; type?: string; placeholder?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; helper?: string; rightIcon?: React.ReactNode; onIconClick?: () => void;
}) {
  return (
    <div className="auth-field">
      <label className="auth-field__label">{label}</label>
      <div className="auth-field__wrap">
        <input
          className={`auth-field__input${rightIcon ? ' auth-field__input--has-icon' : ''}${error ? ' auth-field__input--error' : ''}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={type === 'email' ? 'email' : type === 'password' ? 'current-password' : undefined}
        />
        {rightIcon && (
          <button type="button" className="auth-field__icon" onClick={onIconClick}>{rightIcon}</button>
        )}
      </div>
      {error && <span className="auth-field__error">{error}</span>}
      {!error && helper && <span className="auth-field__helper">{helper}</span>}
    </div>
  );
}

/* â•â•â•â•â•â•â• PAGE â•â•â•â•â•â•â• */
export default function LoginPage() {
  const router = useRouter();
  const { login, demoLogin, forgotPassword, verifyEmail, resendVerification, isLoading } = useAuthStore();
  const [activeStep, setActiveStep] = useState(1);

  /* Sign-in state */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [need2FA, setNeed2FA] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /* Demo state */
  const [demoLoading, setDemoLoading] = useState(false);

  /* Forgot state */
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);

  /* Error dialog */
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  /* Email verification (OTP) modal — shown when an unverified user tries to log in */
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResending, setVerifyResending] = useState(false);

  /* Platform maintenance status */
  const maintenance = usePlatformStatusStore((s) => s.maintenance_mode);
  const fetchStatus = usePlatformStatusStore((s) => s.fetch);
  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  /* â”€â”€ Sign-in handler â”€â”€ */
  const handleSignIn = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!email.includes('@') || !email.includes('.')) e.email = 'Please enter a valid email address.';
    if (password.length < 8) e.password = 'Password must be at least 8 characters.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await login(email, password, totpCode || undefined);
      toast.success('Welcome back!');
      router.push('/accounts');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('2FA') && !msg.includes('Invalid')) {
        setNeed2FA(true);
      } else if (msg.includes('EMAIL_NOT_VERIFIED')) {
        // Account exists but email isn't confirmed — send a fresh code and prompt.
        setVerifyOpen(true);
        setVerifyCode('');
        void resendVerification(email).catch(() => {});
        toast('Please verify your email. We sent you a 6-digit code.', { icon: '📧' });
      } else {
        setErrorDialog({ title: 'Sign-in failed', message: authErrorMessage(err, 'login') });
      }
    } finally {
      setLoading(false);
    }
  };

  /* â”€â”€ Email verification handlers â”€â”€ */
  const handleVerify = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!/^\d{6}$/.test(verifyCode.trim())) {
      toast.error('Enter the 6-digit code from your email.');
      return;
    }
    setVerifyLoading(true);
    try {
      await verifyEmail(email, verifyCode.trim());
      setVerifyOpen(false);
      toast.success('Email verified! Welcome back.');
      router.push('/accounts');
    } catch (err: unknown) {
      setErrorDialog({ title: 'Verification failed', message: authErrorMessage(err, 'login') });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyResend = async () => {
    setVerifyResending(true);
    try {
      await resendVerification(email);
      toast.success('A new code has been sent to your email.');
    } catch {
      toast.error('Could not resend the code.');
    } finally {
      setVerifyResending(false);
    }
  };

  /* â”€â”€ Demo handler â”€â”€ */
  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success('Welcome â€” demo account');
      router.push('/accounts');
    } catch (err: unknown) {
      setErrorDialog({ title: 'Demo sign-in failed', message: authErrorMessage(err, 'demo') });
    } finally {
      setDemoLoading(false);
    }
  };

  /* â”€â”€ Forgot handler â”€â”€ */
  const handleForgot = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      await forgotPassword(forgotEmail.trim());
      toast.success('Check your email for reset instructions.');
      setForgotOpen(false);
      setForgotEmail('');
    } catch (err: unknown) {
      setErrorDialog({ title: 'Error', message: authErrorMessage(err, 'forgot') });
    } finally {
      setForgotSending(false);
    }
  };

  /* â”€â”€ Step change: 3 â†’ go to register â”€â”€ */
  const handleStepClick = (step: number) => {
    if (step === 3) {
      router.push('/auth/register');
      return;
    }
    setActiveStep(step);
  };

  const cfg = LEFT_CONFIG[activeStep];

  return (
    <div className="auth-wrapper">
      {maintenance && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: 'linear-gradient(90deg, rgba(234,179,8,0.18), rgba(234,179,8,0.08))',
            borderBottom: '1px solid rgba(234,179,8,0.45)',
            color: '#fde68a',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            backdropFilter: 'blur(6px)',
          }}
        >
          <AlertTriangle size={16} />
          Platform is under maintenance. Sign-in is temporarily disabled. Please check back soon.
        </div>
      )}
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* â”€â”€ LEFT PANEL â”€â”€ */}
          <motion.div
            className="auth-left"
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <motion.div
              className="auth-left__bg"
              animate={{ scale: [1, 1.25, 1], y: [0, -30, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="auth-left__content">
              <motion.h1 className="auth-left__title" {...fadeUp(0.3)}>{cfg.title}</motion.h1>
              <motion.p className="auth-left__subtitle" {...fadeUp(0.4)}>{cfg.subtitle}</motion.p>
              <div className="auth-left__steps">
                {STEPS.map((s, i) => (
                  <motion.div key={s.number} {...fadeUp(0.45 + i * 0.08)}>
                    <div
                      className={`auth-step ${activeStep === s.number ? 'auth-step--active' : 'auth-step--inactive'}`}
                      onClick={() => handleStepClick(s.number)}
                    >
                      <span className="auth-step__num">{s.number}</span>
                      <span className="auth-step__label">{s.label}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* â”€â”€ RIGHT PANEL â”€â”€ */}
          <div className="auth-right">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                style={{ width: '100%', maxWidth: 380 }}
              >
                {/* â”€â”€ SIGN IN â”€â”€ */}
                {activeStep === 1 && (
                  <form className="auth-form" onSubmit={handleSignIn} noValidate>
                    <motion.div {...fadeUp(0.2)} className="flex justify-center mb-2">
                      <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-16 h-16 object-contain" />
                    </motion.div>
                    <motion.div {...fadeUp(0.3)}>
                      <h2 className="auth-form__title">Sign In</h2>
                      <p className="auth-form__subtitle">Enter your credentials to access your account.</p>
                    </motion.div>

                    <motion.div {...fadeUp(0.37)}>
                      <AuthInput
                        label="Email"
                        type="email"
                        placeholder="eg. john@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
                        error={errors.email}
                      />
                    </motion.div>

                    <motion.div {...fadeUp(0.44)}>
                      <AuthInput
                        label="Password"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                        error={errors.password}
                        helper="Must be at least 8 characters."
                        rightIcon={showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                        onIconClick={() => setShowPass(!showPass)}
                      />
                      <button
                        type="button"
                        onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                        style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.72rem', cursor: 'pointer', marginTop: 4 }}
                      >
                        Forgot password?
                      </button>
                    </motion.div>

                    {need2FA && (
                      <motion.div {...fadeUp(0.5)}>
                        <AuthInput
                          label="2FA Code"
                          type="text"
                          placeholder="000000"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                        />
                      </motion.div>
                    )}

                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.55, duration: 0.4 }}>
                      <button type="submit" className="auth-btn" disabled={loading || isLoading || maintenance}>
                        {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : (maintenance ? 'Unavailable (Maintenance)' : 'Sign In')}
                      </button>
                    </motion.div>

                    <motion.p className="auth-footer" {...fadeUp(0.62)}>
                      Don&apos;t have an account?{' '}
                      <a onClick={() => handleStepClick(3)}>Sign Up</a>
                    </motion.p>
                  </form>
                )}

                {/* â”€â”€ DEMO â”€â”€ */}
                {activeStep === 2 && (
                  <div className="auth-form">
                    <motion.div {...fadeUp(0.2)} className="flex justify-center mb-2">
                      <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-16 h-16 object-contain" />
                    </motion.div>
                    <motion.div {...fadeUp(0.3)}>
                      <h2 className="auth-form__title">Demo Account</h2>
                      <p className="auth-form__subtitle">Try the platform instantly with a demo account.</p>
                    </motion.div>

                    <motion.div {...fadeUp(0.37)}>
                      <div className="auth-demo-badge">
                        <span className="auth-demo-badge__dot" />
                        <span>One-click access â€” no registration needed</span>
                      </div>
                    </motion.div>

                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
                      <button type="button" className="auth-btn" onClick={handleDemo} disabled={demoLoading || isLoading || maintenance}>
                        {(demoLoading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : (maintenance ? 'Unavailable (Maintenance)' : 'Start Demo Trading')}
                      </button>
                    </motion.div>

                    <motion.p className="auth-footer" {...fadeUp(0.55)}>
                      Want full access?{' '}
                      <a onClick={() => handleStepClick(3)}>Sign Up</a>
                    </motion.p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* â”€â”€ Error Dialog â”€â”€ */}
      {errorDialog && (
        <div className="auth-overlay" onClick={() => setErrorDialog(null)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="auth-modal__title">{errorDialog.title}</h3>
            <p className="auth-modal__desc">{errorDialog.message}</p>
            <button type="button" className="auth-btn" onClick={() => setErrorDialog(null)}>OK</button>
          </div>
        </div>
      )}

      {/* â”€â”€ Email Verification Modal â”€â”€ */}
      {verifyOpen && (
        <div className="auth-overlay" onClick={() => setVerifyOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="auth-modal__title">Verify Your Email</h3>
            <p className="auth-modal__desc">
              Enter the 6-digit code we sent to <strong>{email}</strong> to activate your account.
            </p>
            <form onSubmit={handleVerify}>
              <AuthInput
                label="Verification Code"
                type="text"
                placeholder="123456"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button
                type="button"
                onClick={() => { if (!verifyResending) void handleVerifyResend(); }}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.72rem', cursor: 'pointer', marginTop: 4 }}
              >
                {verifyResending ? 'Sending…' : 'Resend code'}
              </button>
              <div className="auth-modal__actions">
                <button type="button" className="auth-btn auth-btn--outline" onClick={() => setVerifyOpen(false)}>Cancel</button>
                <button type="submit" className="auth-btn" disabled={verifyLoading}>
                  {verifyLoading ? <Loader2 size={18} className="auth-spinner" /> : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€ Forgot Password Modal â”€â”€ */}
      {forgotOpen && (
        <div className="auth-overlay" onClick={() => setForgotOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="auth-modal__title">Reset Password</h3>
            <p className="auth-modal__desc">Enter your email. If an account exists, we&apos;ll send reset instructions.</p>
            <form onSubmit={handleForgot}>
              <AuthInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
              <div className="auth-modal__actions">
                <button type="button" className="auth-btn auth-btn--outline" onClick={() => setForgotOpen(false)}>Cancel</button>
                <button type="submit" className="auth-btn" disabled={forgotSending}>
                  {forgotSending ? <Loader2 size={18} className="auth-spinner" /> : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
