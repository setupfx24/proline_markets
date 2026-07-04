'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import '../auth/auth.css';

const fadeUp = (delay: number) => ({
  initial: { y: 16, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { delay, duration: 0.45, ease: 'easeOut' as const },
});

export default function InvestorLoginPage() {
  const router = useRouter();
  const { investorLogin, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      await investorLogin(email.trim(), password);
      toast.success('Welcome — investor access');
      router.push('/accounts');
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message.trim() : 'Something went wrong.';
      setError(raw.toLowerCase().includes('invalid credentials')
        ? 'The email or password you entered is incorrect.'
        : raw);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          {/* LEFT PANEL */}
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
              <motion.h1 className="auth-left__title" {...fadeUp(0.3)}>Investor Access</motion.h1>
              <motion.p className="auth-left__subtitle" {...fadeUp(0.4)}>
                Read-only access to monitor your assigned account and its trading — no trades or withdrawals.
              </motion.p>
            </div>
          </motion.div>

          {/* RIGHT PANEL */}
          <div className="auth-right">
            <motion.div style={{ width: '100%', maxWidth: 380 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              <form className="auth-form" onSubmit={handleSignIn} noValidate>
                <motion.div {...fadeUp(0.2)} className="flex justify-center mb-2">
                  <img src="/images/logo1.png" alt="ProlineMarketsFX" className="w-16 h-16 object-contain" />
                </motion.div>
                <motion.div {...fadeUp(0.3)}>
                  <h2 className="auth-form__title">Investor Sign In</h2>
                  <p className="auth-form__subtitle">Enter the credentials provided by your account manager.</p>
                </motion.div>

                <motion.div {...fadeUp(0.37)}>
                  <div className="auth-field">
                    <label className="auth-field__label">Email</label>
                    <div className="auth-field__wrap">
                      <input
                        className="auth-field__input"
                        type="email"
                        placeholder="investor@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null); }}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.44)}>
                  <div className="auth-field">
                    <label className="auth-field__label">Password</label>
                    <div className="auth-field__wrap">
                      <input
                        className="auth-field__input auth-field__input--has-icon"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        autoComplete="current-password"
                      />
                      <button type="button" className="auth-field__icon" onClick={() => setShowPass(!showPass)}>
                        {showPass ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                    </div>
                    {error && <span className="auth-field__error">{error}</span>}
                  </div>
                </motion.div>

                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.55, duration: 0.4 }}>
                  <button type="submit" className="auth-btn" disabled={loading || isLoading}>
                    {(loading || isLoading) ? <Loader2 size={18} className="auth-spinner" /> : 'Sign In'}
                  </button>
                </motion.div>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
