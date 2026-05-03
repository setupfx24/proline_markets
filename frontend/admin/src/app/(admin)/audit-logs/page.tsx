'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, ScrollText } from 'lucide-react';

interface UserAuditRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  action_type: string;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'REGISTER', label: 'Registration' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'ORDER_PLACED', label: 'Order placed' },
];

const PAGE_SIZE = 25;

function formatTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionType, setActionType] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [userIdApplied, setUserIdApplied] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [items, setItems] = useState<UserAuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        per_page: String(PAGE_SIZE),
      };
      if (actionType) params.action_type = actionType;
      if (userIdApplied.trim()) params.user_id = userIdApplied.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await adminApi.get<{ items: UserAuditRow[]; total: number }>('/audit-logs', params);
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit logs');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, actionType, userIdApplied, dateFrom, dateTo]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [actionType, userIdApplied, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyUserFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setUserIdApplied(userIdFilter.trim());
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ScrollText size={18} className="text-buy" />
          Audit logs
        </h1>
        <p className="text-xxs text-text-tertiary mt-0.5">
          Trader registration, sign-in, sign-out, and order placement (IP and device from request)
        </p>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-md">
        <div className="flex flex-wrap items-end gap-3 p-3 border-b border-border-primary">
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">Action</span>
            <div className="relative">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="text-xs py-1.5 pl-2 pr-7 min-w-[9rem] appearance-none bg-bg-input border border-border-primary rounded-md text-text-primary"
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
            </div>
          </div>
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
            />
          </div>
          <div>
            <span className="text-xxs text-text-tertiary block mb-1">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
            />
          </div>
          <form onSubmit={applyUserFilter} className="flex items-end gap-2">
            <div>
              <span className="text-xxs text-text-tertiary block mb-1">User ID</span>
              <input
                type="text"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                placeholder="UUID…"
                className="text-xs py-1.5 px-2 w-56 bg-bg-input border border-border-primary rounded-md text-text-primary placeholder:text-text-tertiary font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-2.5 py-1.5 text-xs font-medium bg-bg-hover border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-fast"
            >
              Apply
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-tertiary uppercase tracking-wider">
                <th className="px-3 py-2 font-semibold">User</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">IP</th>
                <th className="px-3 py-2 font-semibold">Device</th>
                <th className="px-3 py-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-text-tertiary">
                    <Loader2 className="inline animate-spin mr-2" size={16} />
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-text-tertiary">
                    No audit entries
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border-primary/60 hover:bg-bg-hover/40 transition-fast"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="text-text-primary font-medium">
                        {row.user_email || '—'}
                      </div>
                      {row.user_name ? (
                        <div className="text-xxs text-text-tertiary">{row.user_name}</div>
                      ) : null}
                      <div className="text-[10px] text-text-tertiary font-mono mt-0.5">{row.user_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={cn(
                          'inline-flex px-1.5 py-0.5 rounded-sm font-semibold',
                          row.action_type === 'REGISTER' && 'bg-info/15 text-info',
                          row.action_type === 'LOGIN' && 'bg-success/15 text-success',
                          row.action_type === 'LOGOUT' && 'bg-text-tertiary/15 text-text-tertiary',
                          row.action_type === 'ORDER_PLACED' && 'bg-buy/15 text-buy',
                          !['REGISTER', 'LOGIN', 'LOGOUT', 'ORDER_PLACED'].includes(row.action_type) &&
                            'bg-bg-hover text-text-secondary',
                        )}
                      >
                        {row.action_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-text-secondary whitespace-nowrap">
                      {row.ip_address || '—'}
                    </td>
                    <td className="px-3 py-2 align-top text-text-secondary max-w-[240px]">
                      <span className="line-clamp-2 break-all" title={row.device_info || undefined}>
                        {row.device_info || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-text-tertiary whitespace-nowrap">
                      {row.created_at ? formatTime(row.created_at) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border-primary text-xxs text-text-tertiary">
            <span>
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-border-primary disabled:opacity-40 hover:bg-bg-hover"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
