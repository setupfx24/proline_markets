'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  CreditCard,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Shield,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

interface UserDetail {
  user: {
    id: string;
    email: string;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    country: string | null;
    address: string | null;
    role: string;
    status: string;
    kyc_status: string;
    is_demo: boolean;
    created_at: string | null;
  };
  accounts: {
    id: string;
    account_number: string;
    balance: number;
    credit: number;
    equity: number;
    margin_used: number;
    free_margin: number;
    margin_level: number;
    leverage: number;
    currency: string;
    is_demo: boolean;
    is_active: boolean;
  }[];
  total_deposit: number;
  total_withdrawal: number;
  total_trades: number;
  open_positions: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'active': return 'bg-success/15 text-success';
    case 'banned': case 'suspended': return 'bg-danger/15 text-danger';
    default: return 'bg-warning/15 text-warning';
  }
}

function kycColor(k: string) {
  switch (k?.toLowerCase()) {
    case 'verified': case 'approved': return 'bg-success/15 text-success';
    case 'pending': return 'bg-warning/15 text-warning';
    case 'rejected': return 'bg-danger/15 text-danger';
    default: return 'bg-text-tertiary/15 text-text-tertiary';
  }
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get<UserDetail>(`/users/${userId}`);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin text-text-tertiary" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="p-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-4">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-center py-20 text-sm text-danger">{error || 'User not found'}</div>
        </div>
      </>
    );
  }

  const { user, accounts, total_deposit, total_withdrawal, total_trades, open_positions } = data;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email.split('@')[0];

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Back + Header */}
        <div>
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-fast mb-4">
            <ArrowLeft size={16} /> Back to Users
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-buy/10 border-2 border-buy/20 flex items-center justify-center">
                <UserRound size={28} className="text-buy" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">{name}</h1>
                <p className="text-sm text-text-tertiary">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', statusColor(user.status))}>{user.status}</span>
              <span className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold', kycColor(user.kyc_status))}>KYC: {user.kyc_status}</span>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Deposits', value: `$${fmt(total_deposit)}`, icon: DollarSign, color: 'text-success' },
            { label: 'Total Withdrawals', value: `$${fmt(total_withdrawal)}`, icon: Wallet, color: 'text-warning' },
            { label: 'Total Trades', value: total_trades.toLocaleString(), icon: CreditCard, color: 'text-buy' },
            { label: 'Open Positions', value: open_positions.toLocaleString(), icon: Shield, color: 'text-text-primary' },
          ].map(c => (
            <div key={c.label} className="bg-bg-secondary border border-border-primary rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon size={16} className={c.color} />
                <p className="text-xs text-text-tertiary">{c.label}</p>
              </div>
              <p className="text-lg font-bold text-text-primary font-mono tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>

        {/* User Details */}
        <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
          <h2 className="text-base font-bold text-text-primary mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Email', value: user.email, icon: Mail },
              { label: 'Phone', value: user.phone || '—', icon: Phone },
              { label: 'Country', value: user.country || '—', icon: MapPin },
              { label: 'Address', value: user.address || '—', icon: MapPin },
              { label: 'Role', value: user.role },
              { label: 'Member Since', value: user.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs text-text-tertiary mb-1">{f.label}</p>
                <p className="text-sm text-text-primary">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Accounts */}
        <div className="bg-bg-secondary border border-border-primary rounded-lg p-5">
          <h2 className="text-base font-bold text-text-primary mb-4">Trading Accounts ({accounts.length})</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-text-tertiary py-6 text-center">No trading accounts</p>
          ) : (
            <div className="space-y-3">
              {accounts.map(a => (
                <div key={a.id} className="border border-border-primary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary font-mono">{a.account_number}</p>
                      <p className="text-xs text-text-tertiary">{a.currency} · Leverage {a.leverage}:1 {a.is_demo ? '· Demo' : ''}</p>
                    </div>
                    <span className={cn('px-2 py-1 rounded text-xxs font-semibold', a.is_active ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                      { label: 'Balance', value: `$${fmt(a.balance)}` },
                      { label: 'Credit', value: `$${fmt(a.credit)}` },
                      { label: 'Equity', value: `$${fmt(a.equity)}` },
                      { label: 'Margin Used', value: `$${fmt(a.margin_used)}` },
                      { label: 'Free Margin', value: `$${fmt(a.free_margin)}` },
                      { label: 'Margin Level', value: a.margin_level > 0 ? `${fmt(a.margin_level)}%` : '—' },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-xxs text-text-tertiary uppercase tracking-wide">{f.label}</p>
                        <p className="text-sm text-text-primary font-mono tabular-nums">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
