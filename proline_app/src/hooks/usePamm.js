import { useState, useEffect, useCallback, useRef } from 'react';
import ApiService from '../services/api/ApiService';
import logger from '../utils/logger';

export default function usePamm() {
  const [masters, setMasters] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [summary, setSummary] = useState({ total_invested: 0, total_current_value: 0, total_pnl: 0, overall_pnl_pct: 0 });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const fetchMasters = useCallback(async () => {
    try {
      const data = await ApiService.request('/social/mamm-pamm?page=1&per_page=50');
      if (mounted.current) setMasters(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      logger.error('usePamm: masters fetch failed', e);
    }
  }, []);

  const fetchAllocations = useCallback(async () => {
    try {
      const data = await ApiService.getMyAllocations();
      if (!mounted.current) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      setAllocations(items);
      if (data?.summary) {
        setSummary({
          total_invested: Number(data.summary.total_invested || 0),
          total_current_value: Number(data.summary.total_current_value || 0),
          total_pnl: Number(data.summary.total_pnl || 0),
          overall_pnl_pct: Number(data.summary.overall_pnl_pct || 0),
        });
      } else {
        const totalInv = items.reduce((s, a) => s + Number(a.allocation_amount || 0), 0);
        const totalVal = items.reduce((s, a) => s + Number(a.current_value || a.allocation_amount || 0), 0);
        const totalPnl = items.reduce((s, a) => s + Number(a.total_pnl || 0), 0);
        setSummary({
          total_invested: totalInv,
          total_current_value: totalVal,
          total_pnl: totalPnl,
          overall_pnl_pct: totalInv > 0 ? (totalPnl / totalInv) * 100 : 0,
        });
      }
    } catch (e) {
      logger.error('usePamm: allocations fetch failed', e);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await ApiService.getAccounts();
      if (!mounted.current) return;
      const items = Array.isArray(data?.items ?? data) ? (data.items ?? data) : [];
      setAccounts(items);
    } catch (e) {
      logger.error('usePamm: accounts fetch failed', e);
    }
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchMasters(), fetchAllocations(), fetchAccounts()]);
    } catch (e) {
      if (mounted.current) setError(e?.message || 'Failed to load PAMM data');
    }
    if (mounted.current) { setLoading(false); setRefreshing(false); }
  }, [fetchMasters, fetchAllocations, fetchAccounts]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const invest = useCallback(async (masterId, amount, opts = {}) => {
    // Funds come from the main wallet; the backend auto-creates a dedicated MAM
    // sub-account. No account needs to be picked — account_id is optional.
    const params = new URLSearchParams({ amount: String(amount) });
    if (opts.accountId) params.set('account_id', opts.accountId);
    if (opts.volumeScalingPct != null) params.set('volume_scaling_pct', String(opts.volumeScalingPct));
    const data = await ApiService.request(`/social/mamm-pamm/${masterId}/invest?${params.toString()}`, {
      method: 'POST',
    });
    await fetchAllocations();
    return data;
  }, [fetchAllocations]);

  const withdrawAllocation = useCallback(async (allocationId) => {
    const data = await ApiService.withdrawAllocation(allocationId);
    await fetchAllocations();
    return data;
  }, [fetchAllocations]);

  return {
    masters, allocations, summary, accounts, loading, refreshing, error,
    refresh: () => loadAll(true), invest, withdrawAllocation,
  };
}
