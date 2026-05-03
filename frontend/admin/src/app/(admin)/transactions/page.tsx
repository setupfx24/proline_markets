'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Receipt,
  Search,
  X,
} from 'lucide-react';

type TypeFilter = 'all' | 'deposit' | 'withdrawal' | 'adjustment' | 'credit';

interface TransactionRecord {
  id: string;
  user_id: string | null;
  account_id: string | null;
  type: string;
  amount: number;
  balance_after: number | null;
  reference_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  account_number: string | null;
  admin_email: string | null;
  admin_name: string | null;
}

interface Summary {
  total_transactions: number;
  type_breakdown: Record<string, { count: number; total_amount: number }>;
}

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'adjustment', label: 'Fund Add/Deduct' },
  { value: 'credit', label: 'Credit' },
];

function typeIcon(type: string) {
  switch (type) {
    case 'deposit':
      return <ArrowDownCircle size={14} className="text-success" />;
    case 'withdrawal':
      return <ArrowUpCircle size={14} className="text-danger" />;
    case 'adjustment':
      return <Receipt size={14} className="text-buy" />;
    case 'credit':
      return <CreditCard size={14} className="text-warning" />;
    default:
      return <Receipt size={14} className="text-text-tertiary" />;
  }
}

function typeBadge(type: string) {
  switch (type) {
    case 'deposit':
      return 'bg-success/15 text-success';
    case 'withdrawal':
      return 'bg-danger/15 text-danger';
    case 'adjustment':
      return 'bg-buy/15 text-buy';
    case 'credit':
      return 'bg-warning/15 text-warning';
    default:
      return 'bg-text-tertiary/15 text-text-tertiary';
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'deposit':
      return 'Deposit';
    case 'withdrawal':
      return 'Withdrawal';
    case 'adjustment':
      return 'Fund Adj.';
    case 'credit':
      return 'Credit';
    default:
      return type;
  }
}

function formatMoney(n: number) {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n >= 0 ? `+$${formatted}` : `-$${formatted}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<TransactionRecord | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        page: String(page),
        per_page: String(PAGE_SIZE),
      };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search) params.search = search;

      const res = await adminApi.get<{ items: TransactionRecord[]; total: number }>(
        '/transactions',
        params,
      );
      setTransactions(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e.message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, search]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await adminApi.get<Summary>('/transactions/summary');
      setSummary(res);
    } catch {}
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summaryCards = [
    {
      label: 'Total Transactions',
      value: summary?.total_transactions ?? 0,
      color: 'text-text-primary',
      icon: Receipt,
    },
    {
      label: 'Deposits',
      value: summary?.type_breakdown?.deposit?.count ?? 0,
      amount: summary?.type_breakdown?.deposit?.total_amount ?? 0,
      color: 'text-success',
      icon: ArrowDownCircle,
    },
    {
      label: 'Withdrawals',
      value: summary?.type_breakdown?.withdrawal?.count ?? 0,
      amount: summary?.type_breakdown?.withdrawal?.total_amount ?? 0,
      color: 'text-danger',
      icon: ArrowUpCircle,
    },
    {
      label: 'Fund Adjustments',
      value: summary?.type_breakdown?.adjustment?.count ?? 0,
      amount: summary?.type_breakdown?.adjustment?.total_amount ?? 0,
      color: 'text-buy',
      icon: Receipt,
    },
    {
      label: 'Credit',
      value: summary?.type_breakdown?.credit?.count ?? 0,
      amount: summary?.type_breakdown?.credit?.total_amount ?? 0,
      color: 'text-warning',
      icon: CreditCard,
    },
  ];

  return (
    <>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Admin Transactions</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">
            Complete record of all admin financial operations — deposits, withdrawals, fund adjustments and credits
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-bg-secondary border border-border-primary rounded-md p-3"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} className={card.color} />
                  <span className="text-xxs text-text-tertiary">{card.label}</span>
                </div>
                <p className={cn('text-lg font-semibold tabular-nums', card.color)}>
                  {card.value}
                </p>
                {'amount' in card && card.amount !== undefined && (
                  <p className="text-xxs text-text-tertiary tabular-nums mt-0.5">
                    ${Math.abs(card.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Main table card */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-border-primary">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search user, account, description..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary w-72 transition-fast focus:border-buy"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast"
              >
                Search
              </button>
            </form>

            {/* Type filter */}
            <div className="flex items-center gap-2">
              <span className="text-xxs text-text-tertiary">Type:</span>
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                  className="text-xs py-1.5 pl-2 pr-7 appearance-none bg-bg-input border border-border-primary rounded-md text-text-primary"
                >
                  {TYPE_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-text-tertiary" />
              </div>
            ) : error ? (
              <div className="text-center py-16 text-xs text-danger">{error}</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16 text-xs text-text-tertiary">
                No transactions found
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead>
                      <tr className="border-b border-border-primary bg-bg-tertiary/40">
                        {[
                          'Type',
                          'User',
                          'Account',
                          'Amount',
                          'Balance After',
                          'Description',
                          'Admin By',
                          'Date',
                        ].map((col) => (
                          <th
                            key={col}
                            className={cn(
                              'text-left px-4 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide',
                              (col === 'Amount' || col === 'Balance After') && 'text-right',
                            )}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTxn(t)}
                          className="border-b border-border-primary/50 transition-fast hover:bg-bg-hover cursor-pointer"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {typeIcon(t.type)}
                              <span
                                className={cn(
                                  'inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium capitalize',
                                  typeBadge(t.type),
                                )}
                              >
                                {typeLabel(t.type)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {t.user_name || t.user_email ? (
                              <>
                                <p className="text-xs text-text-primary">
                                  {t.user_name || '—'}
                                </p>
                                <p className="text-xxs text-text-tertiary">
                                  {t.user_email || '—'}
                                </p>
                              </>
                            ) : (
                              <span className="text-xxs text-text-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-secondary font-mono tabular-nums">
                            {t.account_number || '—'}
                          </td>
                          <td
                            className={cn(
                              'px-4 py-2.5 text-xs text-right font-mono tabular-nums font-medium',
                              t.amount >= 0 ? 'text-success' : 'text-danger',
                            )}
                          >
                            {formatMoney(t.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-secondary text-right font-mono tabular-nums">
                            {t.balance_after !== null
                              ? `$${Math.abs(t.balance_after).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-secondary max-w-[200px] truncate">
                            {t.description || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {t.admin_name || t.admin_email ? (
                              <>
                                <p className="text-xs text-text-primary">
                                  {t.admin_name || '—'}
                                </p>
                                <p className="text-xxs text-text-tertiary">
                                  {t.admin_email || '—'}
                                </p>
                              </>
                            ) : (
                              <span className="text-xxs text-text-tertiary">System</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-text-tertiary font-mono tabular-nums whitespace-nowrap">
                            {formatDate(t.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between">
                    <p className="text-xxs text-text-tertiary">
                      Showing {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(page * PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-fast"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="px-2 text-xs text-text-secondary font-mono tabular-nums">
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:pointer-events-none transition-fast"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <div className="flex items-center gap-2">
                {typeIcon(selectedTxn.type)}
                <h2 className="text-sm font-semibold text-text-primary">
                  Transaction Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Type">
                  <span
                    className={cn(
                      'inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium capitalize',
                      typeBadge(selectedTxn.type),
                    )}
                  >
                    {typeLabel(selectedTxn.type)}
                  </span>
                </DetailField>
                <DetailField label="Amount">
                  <span
                    className={cn(
                      'text-sm font-mono tabular-nums font-semibold',
                      selectedTxn.amount >= 0 ? 'text-success' : 'text-danger',
                    )}
                  >
                    {formatMoney(selectedTxn.amount)}
                  </span>
                </DetailField>
                <DetailField label="User">
                  <p className="text-xs text-text-primary">{selectedTxn.user_name || '—'}</p>
                  <p className="text-xxs text-text-tertiary">{selectedTxn.user_email || '—'}</p>
                </DetailField>
                <DetailField label="Account">
                  <p className="text-xs text-text-primary font-mono">
                    {selectedTxn.account_number || '—'}
                  </p>
                </DetailField>
                <DetailField label="Balance After">
                  <p className="text-xs text-text-primary font-mono tabular-nums">
                    {selectedTxn.balance_after !== null
                      ? `$${Math.abs(selectedTxn.balance_after).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </p>
                </DetailField>
                <DetailField label="Date">
                  <p className="text-xs text-text-primary">
                    {formatDate(selectedTxn.created_at)}
                  </p>
                </DetailField>
              </div>

              <DetailField label="Description">
                <p className="text-xs text-text-primary">
                  {selectedTxn.description || '—'}
                </p>
              </DetailField>

              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Performed By (Admin)">
                  <p className="text-xs text-text-primary">{selectedTxn.admin_name || '—'}</p>
                  <p className="text-xxs text-text-tertiary">{selectedTxn.admin_email || 'System'}</p>
                </DetailField>
                <DetailField label="Transaction ID">
                  <p className="text-xxs text-text-tertiary font-mono break-all">
                    {selectedTxn.id}
                  </p>
                </DetailField>
              </div>

              {selectedTxn.reference_id && (
                <DetailField label="Reference ID">
                  <p className="text-xxs text-text-tertiary font-mono break-all">
                    {selectedTxn.reference_id}
                  </p>
                </DetailField>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border-primary flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-2.5 rounded-md bg-bg-tertiary border border-border-primary">
      <p className="text-xxs text-text-tertiary mb-1">{label}</p>
      {children}
    </div>
  );
}
