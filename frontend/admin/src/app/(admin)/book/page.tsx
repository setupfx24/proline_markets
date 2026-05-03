'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Users, TrendingUp, Search, ChevronLeft, ChevronRight,
  Loader2, Wifi, WifiOff, Save, Zap, Info, Check, X,
  ArrowLeftRight, Eye, EyeOff, Settings, BarChart3,
} from 'lucide-react';

/* ─── Types ─── */

interface BookStats {
  a_book_users: number;
  b_book_users: number;
  a_book_trades: number;
  b_book_trades: number;
}

interface BookUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  book_type: string;
  accounts_count: number;
  trades_count: number;
  status: string;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  created_at: string | null;
  account_id: string;
}

interface ClosedTrade {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price: number | null;
  profit: number;
  close_reason: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

/* ═══════════ COMPONENT ═══════════ */

export default function BookManagementPage() {
  const [activeTab, setActiveTab] = useState<'book' | 'abook'>('book');

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen size={20} className="text-accent" />
        <div>
          <h1 className="text-lg font-bold text-text-primary">Book Management</h1>
          <p className="text-xxs text-text-tertiary">Manage A-Book / B-Book assignments and LP connection</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border-primary">
        {[
          { key: 'book' as const, label: 'Book Management', icon: Users },
          { key: 'abook' as const, label: 'A-Book Trades', icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-fast border-b-2 -mb-px',
              activeTab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-secondary',
            )}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'book' ? <BookTab /> : <ABookTradesTab />}
    </div>
  );
}

/* ═══════════ BOOK TAB ═══════════ */

function BookTab() {
  const [stats, setStats] = useState<BookStats | null>(null);
  const [users, setUsers] = useState<BookUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lpConnected, setLpConnected] = useState(false);
  const [lpChecking, setLpChecking] = useState(false);
  const [lpMessage, setLpMessage] = useState<string>('');
  const [lpAgeMs, setLpAgeMs] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lpSettings, setLpSettings] = useState({ api_url: '', ws_url: '', api_key: '', api_secret: '' });
  const [showSecret, setShowSecret] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingLp, setTestingLp] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await adminApi.get<BookStats>('/book/stats');
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: '20' };
      if (search) params.search = search;
      if (bookFilter) params.book_type = bookFilter;
      const data = await adminApi.get<{ users: BookUser[]; total: number; pages: number }>('/book/users', params);
      setUsers(data.users);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, bookFilter]);

  const checkLpStatus = useCallback(async () => {
    setLpChecking(true);
    try {
      const data = await adminApi.get<{
        connected: boolean;
        message?: string;
        last_batch_age_ms?: number | null;
      }>('/book/lp-status');
      setLpConnected(data.connected);
      setLpMessage(data.message || '');
      setLpAgeMs(typeof data.last_batch_age_ms === 'number' ? data.last_batch_age_ms : null);
    } catch {
      setLpConnected(false);
      setLpMessage('Failed to reach admin API');
      setLpAgeMs(null);
    }
    finally { setLpChecking(false); }
  }, []);

  const loadLpSettings = useCallback(async () => {
    try {
      const data = await adminApi.get<Record<string, string>>('/book/lp-settings');
      setLpSettings({
        api_url: data.lp_api_url || '',
        ws_url: data.lp_ws_url || '',
        api_key: data.lp_api_key || '',
        api_secret: data.lp_api_secret || '',
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStats(); checkLpStatus(); loadLpSettings(); }, [fetchStats, checkLpStatus, loadLpSettings]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounce search
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchDebounced); }, 300);
    return () => clearTimeout(t);
  }, [searchDebounced]);

  const toggleUserBook = async (user: BookUser) => {
    const newType = user.book_type === 'A' ? 'B' : 'A';
    setTogglingId(user.id);
    try {
      await adminApi.put(`/book/users/${user.id}/book-type`, { book_type: newType });
      toast.success(`${user.email} → ${newType}-Book`);
      fetchUsers();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulk = async (bookType: string) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await adminApi.put('/book/users/bulk-book-type', { user_ids: Array.from(selected), book_type: bookType });
      toast.success(`${selected.size} users → ${bookType}-Book`);
      setSelected(new Set());
      fetchUsers();
      fetchStats();
    } catch (e: any) {
      toast.error(e.message || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await adminApi.put('/book/lp-settings', lpSettings);
      toast.success('LP settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestLp = async () => {
    setTestingLp(true);
    try {
      const data = await adminApi.post<{ success: boolean; message: string }>('/book/test-lp', {});
      if (data.success) {
        toast.success('LP connection successful');
        setLpConnected(true);
      } else {
        toast.error(data.message || 'Connection failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Test failed');
    } finally {
      setTestingLp(false);
    }
  };

  const selectAll = () => {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  };

  return (
    <div className="space-y-4">
      {/* LP Connection Banner */}
      <div
        className={cn(
          'flex flex-col gap-1 px-4 py-2.5 rounded-md border text-xs',
          lpConnected
            ? 'bg-buy/10 border-buy/30 text-buy'
            : 'bg-sell/10 border-sell/30 text-sell',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {lpConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="font-medium">
              LP Connection: {lpChecking ? 'Checking...' : lpConnected ? 'Connected' : 'Disconnected'}
            </span>
            {lpAgeMs !== null && (
              <span className="opacity-70">· last push {Math.max(0, Math.round(lpAgeMs / 1000))}s ago</span>
            )}
          </div>
          <button onClick={checkLpStatus} disabled={lpChecking} className="text-xxs underline hover:no-underline">
            {lpChecking ? <Loader2 size={12} className="animate-spin" /> : 'Refresh'}
          </button>
        </div>
        {lpMessage && <div className="opacity-80 text-[11px]">{lpMessage}</div>}
      </div>

      {/* LP Settings (collapsible) */}
      <div className="border border-border-primary rounded-md overflow-hidden">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-bg-hover transition-fast"
        >
          <div className="flex items-center gap-2">
            <Settings size={14} />
            LP Connection Settings
          </div>
          <ChevronRight size={14} className={cn('transition-transform', settingsOpen && 'rotate-90')} />
        </button>
        {settingsOpen && (
          <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border-primary">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xxs text-text-tertiary font-medium mb-1 block">LP API URL</label>
                <input
                  value={lpSettings.api_url}
                  onChange={(e) => setLpSettings((s) => ({ ...s, api_url: e.target.value }))}
                  placeholder="https://api.lp-provider.com"
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
                />
              </div>
              <div>
                <label className="text-xxs text-text-tertiary font-medium mb-1 block">WebSocket URL</label>
                <input
                  value={lpSettings.ws_url}
                  onChange={(e) => setLpSettings((s) => ({ ...s, ws_url: e.target.value }))}
                  placeholder="wss://api.lp-provider.com"
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
                />
              </div>
              <div>
                <label className="text-xxs text-text-tertiary font-medium mb-1 block">API Key</label>
                <input
                  value={lpSettings.api_key}
                  onChange={(e) => setLpSettings((s) => ({ ...s, api_key: e.target.value }))}
                  placeholder="ck_..."
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary font-mono"
                />
              </div>
              <div>
                <label className="text-xxs text-text-tertiary font-medium mb-1 block">API Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={lpSettings.api_secret}
                    onChange={(e) => setLpSettings((s) => ({ ...s, api_secret: e.target.value }))}
                    placeholder="cs_..."
                    className="w-full text-xs py-1.5 px-2 pr-8 bg-bg-input border border-border-primary rounded-md text-text-primary font-mono"
                  />
                  <button onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
                    {showSecret ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTestLp}
                disabled={testingLp}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xxs font-medium rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast disabled:opacity-50"
              >
                {testingLp ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                Test Connection
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xxs font-medium rounded-md bg-accent text-black hover:bg-accent-light transition-fast disabled:opacity-50"
              >
                {savingSettings ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-md bg-accent/5 border border-accent/20 text-xs text-text-secondary">
        <Info size={16} className="text-accent shrink-0 mt-0.5" />
        <div>
          <strong className="text-text-primary">A-Book</strong> — Trades routed to LP. Platform earns from spreads/commission only.
          <span className="mx-2 text-text-tertiary">|</span>
          <strong className="text-text-primary">B-Book</strong> — Trades processed internally. Platform takes the opposite side.
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'A-Book Users', value: stats.a_book_users, icon: Users, color: 'text-buy' },
            { label: 'B-Book Users', value: stats.b_book_users, icon: Users, color: 'text-sell' },
            { label: 'A-Book Trades', value: stats.a_book_trades, icon: TrendingUp, color: 'text-buy' },
            { label: 'B-Book Trades', value: stats.b_book_trades, icon: BarChart3, color: 'text-sell' },
          ].map((c) => (
            <div key={c.label} className="bg-bg-secondary border border-border-primary rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <c.icon size={14} className={c.color} />
                <span className="text-xxs text-text-tertiary">{c.label}</span>
              </div>
              <div className={cn('text-xl font-bold font-mono tabular-nums', c.color)}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            value={searchDebounced}
            onChange={(e) => setSearchDebounced(e.target.value)}
            placeholder="Search name or email..."
            className="w-full text-xs py-1.5 pl-8 pr-2 bg-bg-input border border-border-primary rounded-md text-text-primary"
          />
        </div>
        <select
          value={bookFilter}
          onChange={(e) => { setBookFilter(e.target.value); setPage(1); }}
          className="text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md text-text-primary appearance-none"
        >
          <option value="">All Books</option>
          <option value="A">A-Book Only</option>
          <option value="B">B-Book Only</option>
        </select>
        <span className="text-xxs text-text-tertiary">{total} users</span>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-bg-tertiary border border-border-primary text-xs">
          <span className="text-text-secondary font-medium">{selected.size} selected</span>
          <button
            onClick={() => handleBulk('A')}
            disabled={bulkLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast text-xxs font-medium disabled:opacity-50"
          >
            <ArrowLeftRight size={10} /> Move to A-Book
          </button>
          <button
            onClick={() => handleBulk('B')}
            disabled={bulkLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-sell/15 text-sell border border-sell/30 hover:bg-sell/25 transition-fast text-xxs font-medium disabled:opacity-50"
          >
            <ArrowLeftRight size={10} /> Move to B-Book
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xxs text-text-tertiary hover:text-text-primary ml-auto">
            Clear
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto border border-border-primary rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-text-tertiary">
              <th className="px-3 py-2 text-left w-8">
                <input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={selectAll} className="rounded" />
              </th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-center">Accounts</th>
              <th className="px-3 py-2 text-center">Open Trades</th>
              <th className="px-3 py-2 text-center">Book Type</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-tertiary"><Loader2 size={16} className="animate-spin inline-block" /> Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-tertiary">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-border-primary/30 hover:bg-bg-hover transition-fast">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      next.has(u.id) ? next.delete(u.id) : next.add(u.id);
                      setSelected(next);
                    }}
                    className="rounded"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-text-primary">
                  {u.first_name || ''} {u.last_name || ''}
                </td>
                <td className="px-3 py-2 text-text-secondary">{u.email}</td>
                <td className="px-3 py-2 text-center font-mono">{u.accounts_count}</td>
                <td className="px-3 py-2 text-center font-mono">{u.trades_count}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded text-xxs font-bold',
                    u.book_type === 'A' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell',
                  )}>
                    {u.book_type}-Book
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => toggleUserBook(u)}
                    disabled={togglingId === u.id}
                    className={cn(
                      'px-2 py-1 rounded text-xxs font-medium transition-fast disabled:opacity-50',
                      u.book_type === 'A'
                        ? 'bg-sell/10 text-sell border border-sell/20 hover:bg-sell/20'
                        : 'bg-buy/10 text-buy border border-buy/20 hover:bg-buy/20',
                    )}
                  >
                    {togglingId === u.id ? <Loader2 size={10} className="animate-spin inline-block" /> : `→ ${u.book_type === 'A' ? 'B' : 'A'}-Book`}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-xxs text-text-tertiary">
          <span>Page {page} of {pages} ({total} users)</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-2 py-1 rounded border border-border-primary hover:bg-bg-hover disabled:opacity-30">
              <ChevronLeft size={12} />
            </button>
            <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="px-2 py-1 rounded border border-border-primary hover:bg-bg-hover disabled:opacity-30">
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ A-BOOK TRADES TAB ═══════════ */

function ABookTradesTab() {
  const [subTab, setSubTab] = useState<'positions' | 'history'>('positions');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { key: 'positions' as const, label: 'Open Positions' },
          { key: 'history' as const, label: 'Trade History' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-xxs font-medium rounded-md transition-fast',
              subTab === t.key ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-tertiary hover:text-text-secondary border border-border-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'positions' ? <ABookPositions /> : <ABookHistory />}
    </div>
  );
}

function ABookPositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.get<{ positions: Position[]; total: number; pages: number }>('/book/a-book/positions', { page: String(page), per_page: '50' });
      setPositions(data.positions);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-3">
      <div className="text-xxs text-text-tertiary">{total} open A-Book position{total !== 1 ? 's' : ''}</div>
      <div className="overflow-x-auto border border-border-primary rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-text-tertiary">
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-center">Side</th>
              <th className="px-3 py-2 text-right">Lots</th>
              <th className="px-3 py-2 text-right">Open Price</th>
              <th className="px-3 py-2 text-right">Current Price</th>
              <th className="px-3 py-2 text-right">SL / TP</th>
              <th className="px-3 py-2 text-left">Opened</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-tertiary"><Loader2 size={16} className="animate-spin inline-block" /></td></tr>
            ) : positions.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-text-tertiary">No A-Book positions</td></tr>
            ) : positions.map((p) => (
              <tr key={p.id} className="border-b border-border-primary/30 hover:bg-bg-hover transition-fast">
                <td className="px-3 py-2 font-medium text-text-primary">{p.symbol}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('font-bold text-xxs', p.side === 'buy' ? 'text-buy' : 'text-sell')}>{p.side.toUpperCase()}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{p.lots}</td>
                <td className="px-3 py-2 text-right font-mono">{p.open_price}</td>
                <td className="px-3 py-2 text-right font-mono">{p.current_price ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono text-text-tertiary">
                  {p.stop_loss ?? '—'} / {p.take_profit ?? '—'}
                </td>
                <td className="px-3 py-2 text-text-tertiary">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ABookHistory() {
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.get<{ trades: ClosedTrade[]; total: number; pages: number }>('/book/a-book/history', { page: String(page), per_page: '50' });
      setTrades(data.trades);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="space-y-3">
      <div className="text-xxs text-text-tertiary">{total} closed A-Book trade{total !== 1 ? 's' : ''}</div>
      <div className="overflow-x-auto border border-border-primary rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-bg-tertiary text-text-tertiary">
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-center">Side</th>
              <th className="px-3 py-2 text-right">Lots</th>
              <th className="px-3 py-2 text-right">Open</th>
              <th className="px-3 py-2 text-right">Close</th>
              <th className="px-3 py-2 text-right">P&L</th>
              <th className="px-3 py-2 text-center">Reason</th>
              <th className="px-3 py-2 text-left">Closed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-text-tertiary"><Loader2 size={16} className="animate-spin inline-block" /></td></tr>
            ) : trades.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-text-tertiary">No A-Book trade history</td></tr>
            ) : trades.map((t) => (
              <tr key={t.id} className="border-b border-border-primary/30 hover:bg-bg-hover transition-fast">
                <td className="px-3 py-2 font-medium text-text-primary">{t.symbol}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn('font-bold text-xxs', t.side === 'buy' ? 'text-buy' : 'text-sell')}>{t.side.toUpperCase()}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono">{t.lots}</td>
                <td className="px-3 py-2 text-right font-mono">{t.open_price}</td>
                <td className="px-3 py-2 text-right font-mono">{t.close_price ?? '—'}</td>
                <td className={cn('px-3 py-2 text-right font-mono font-bold', t.profit >= 0 ? 'text-buy' : 'text-sell')}>
                  {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center text-text-tertiary uppercase text-xxs">{t.close_reason || '—'}</td>
                <td className="px-3 py-2 text-text-tertiary">{t.closed_at ? new Date(t.closed_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
