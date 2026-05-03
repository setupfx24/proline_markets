import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowUpRight, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXTERNAL } from "@/lib/forexData";

export function LoginDialog({ open, onClose, contextLabel }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    // Hand off to the real Client Portal — Proline does the actual auth there.
    setTimeout(() => {
      window.location.href = EXTERNAL.login;
    }, 400);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="login-dialog-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Dialog panel */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl p-7 md:p-8"
          >
            <button
              type="button"
              aria-label="Close login"
              onClick={onClose}
              className="absolute top-4 right-4 size-9 rounded-full border border-border flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="flex flex-col gap-1.5 mb-6">
              <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                {contextLabel ? `Trade ${contextLabel}` : "Client Portal"}
              </span>
              <h2
                id="login-dialog-title"
                className="font-display uppercase text-2xl md:text-3xl tracking-tight"
              >
                Sign in to trade
              </h2>
              <p className="font-body text-sm text-foreground/65 leading-relaxed mt-1">
                Sign in to your Proline Markets account to place a trade. Don't have one yet? Open an account in minutes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                  Email
                </span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/45" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-full border border-border bg-transparent px-10 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-body text-xs text-foreground/55 uppercase tracking-wide">
                  Password
                </span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/45" />
                  <input
                    type={showPwd ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-full border border-border bg-transparent px-10 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/55 hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-body text-foreground/65 cursor-pointer">
                  <input type="checkbox" className="accent-primary" />
                  Remember me
                </label>
                <a
                  href={EXTERNAL.login}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-foreground/65 hover:text-foreground"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                variant="hero"
                disabled={submitting}
                className="mt-2 w-full justify-center"
              >
                {submitting ? "Redirecting…" : "Sign In & Trade"}
                <ArrowUpRight className="ml-1 size-4" />
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="font-body text-[11px] text-foreground/45 uppercase tracking-wide">
                or
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <a
              href={EXTERNAL.register}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center rounded-full border border-border px-4 py-2.5 font-body text-sm text-foreground/85 hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              Open a New Account →
            </a>

            <p className="font-body text-[11px] text-foreground/45 leading-relaxed text-center mt-5">
              Trading involves significant risk. By signing in you accept the
              Risk Disclosure and Client Agreement.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
