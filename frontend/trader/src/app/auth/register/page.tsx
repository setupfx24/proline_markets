'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
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

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, verifyEmailCode, isLoading } = useAuthStore();

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    first_name: '', last_name: '', phone: '', referral_code: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setForm((prev) => ({ ...prev, referral_code: ref }));
  }, [searchParams]);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (!form.email.includes('@') || !form.email.includes('.')) e.email = 'Please enter a valid email address.';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        referral_code: form.referral_code || undefined,
      });
      toast.success('Verification code sent to your email');
      setStep('otp');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (otp.length !== 6) return;
    setVerifying(true);
    try {
      await verifyEmailCode(form.email, otp, form.password);
      toast.success('Email verified!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  /* password strength */
  const strength = form.password.length >= 12 ? 4 : form.password.length >= 10 ? 3 : form.password.length >= 8 ? 2 : form.password.length > 0 ? 1 : 0;
  const strengthColors = ['#ef4444', '#f59e0b', '#22c55e', '#22c55e'];

  /* â”€â”€ Step change â”€â”€ */
  const handleStepClick = (step: number) => {
    if (step === 1 || step === 2) {
      router.push('/auth/login');
      return;
    }
  };

  return (
    <div className="auth-wrapper">
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
              <motion.h1 className="auth-left__title" {...fadeUp(0.3)}>
                {LEFT_CONFIG[3].title}
              </motion.h1>
              <motion.p className="auth-left__subtitle" {...fadeUp(0.4)}>
                {LEFT_CONFIG[3].subtitle}
              </motion.p>
              <div className="auth-left__steps">
                {STEPS.map((s, i) => (
                  <motion.div key={s.number} {...fadeUp(0.45 + i * 0.08)}>
                    <div
                      className={`auth-step ${s.number === 3 ? 'auth-step--active' : 'auth-step--inactive'}`}
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
                key="signup"
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                style={{ width: '100%', maxWidth: 380 }}
              >
                {step === 'otp' ? (
                <form className="auth-form" onSubmit={handleVerify} noValidate>
                  <motion.div {...fadeUp(0.2)} className="flex justify-center mb-2">
                    <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-16 h-16 object-contain" />
                  </motion.div>
                  <motion.div {...fadeUp(0.3)}>
                    <h2 className="auth-form__title">Verify Your Email</h2>
                    <p className="auth-form__subtitle">Enter the 6-digit code we sent to {form.email}.</p>
                  </motion.div>
                  <motion.div {...fadeUp(0.37)}>
                    <AuthInput
                      label="Verification Code"
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </motion.div>
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4, duration: 0.4 }}>
                    <button type="submit" className="auth-btn" disabled={verifying || otp.length !== 6}>
                      {verifying ? <Loader2 size={18} className="auth-spinner" /> : 'Verify & Continue'}
                    </button>
                  </motion.div>
                  <motion.p className="auth-footer" {...fadeUp(0.5)}>
                    Entered the wrong email?{' '}
                    <a onClick={() => setStep('form')}>Go back</a>
                  </motion.p>
                </form>
                ) : (
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                  <motion.div {...fadeUp(0.2)} className="flex justify-center mb-2">
                    <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-16 h-16 object-contain" />
                  </motion.div>
                  <motion.div {...fadeUp(0.3)}>
                    <h2 className="auth-form__title">Sign Up Account</h2>
                    <p className="auth-form__subtitle">Enter your personal data to create your account.</p>
                  </motion.div>

                  <motion.div className="auth-name-row" {...fadeUp(0.37)}>
                    <AuthInput
                      label="First Name"
                      placeholder="eg. John"
                      value={form.first_name}
                      onChange={(e) => update('first_name', e.target.value)}
                      error={errors.first_name}
                    />
                    <AuthInput
                      label="Last Name"
                      placeholder="eg. Francisco"
                      value={form.last_name}
                      onChange={(e) => update('last_name', e.target.value)}
                      error={errors.last_name}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.44)}>
                    <AuthInput
                      label="Email"
                      type="email"
                      placeholder="eg. johnfrans@gmail.com"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      error={errors.email}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.5)}>
                    <AuthInput
                      label="Phone (optional)"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.56)}>
                    <AuthInput
                      label="Referral Code (optional)"
                      placeholder="Enter code"
                      value={form.referral_code}
                      onChange={(e) => update('referral_code', e.target.value)}
                    />
                  </motion.div>

                  <motion.div {...fadeUp(0.62)}>
                    <AuthInput
                      label="Password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      error={errors.password}
                      helper="Must be at least 8 characters."
                      rightIcon={showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      onIconClick={() => setShowPass(!showPass)}
                    />
                    {strength > 0 && (
                      <div className="auth-strength" style={{ marginTop: 6 }}>
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="auth-strength__bar"
                            style={{ background: i <= strength ? strengthColors[strength - 1] : undefined }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div {...fadeUp(0.68)}>
                    <AuthInput
                      label="Confirm Password"
                      type={showConfirmPass ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={(e) => update('confirmPassword', e.target.value)}
                      error={errors.confirmPassword}
                      rightIcon={showConfirmPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      onIconClick={() => setShowConfirmPass(!showConfirmPass)}
                    />
                  </motion.div>

                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.72, duration: 0.4 }}>
                    <button type="submit" className="auth-btn" disabled={loading || isLoading}>
                      {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : 'Sign Up'}
                    </button>
                  </motion.div>

                  <motion.p className="auth-footer" {...fadeUp(0.78)}>
                    Already have an account?{' '}
                    <a onClick={() => router.push('/auth/login')}>Log in</a>
                  </motion.p>
                </form>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
