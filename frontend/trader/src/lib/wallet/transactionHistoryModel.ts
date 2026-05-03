/** Shared types + pure helpers for wallet / transactions history UIs. */

export type TransactionKind =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'bonus'
  | 'correction'
  | 'profit'
  | 'loss'
  | 'adjustment'
  | 'credit';

export interface Transaction {
  id: string;
  type: TransactionKind;
  amount: number;
  signedAmount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  method: string;
  created_at: string;
  tx_hash?: string;
  description?: string;
  account_id?: string | null;
}

export interface WalletLedgerItem {
  id: string;
  created_at: string | null;
  type: string;
  method: string;
  amount: number;
  status: string;
  currency: string;
  description?: string;
  account_id?: string | null;
}

export interface WalletListItem {
  id: string;
  created_at: string | null;
  type: string;
  method: string;
  amount: number;
  status: string;
  currency: string;
}

export function formatMethod(method: string): string {
  const m = (method || '').toLowerCase().replace(/-/g, '_');
  const labels: Record<string, string> = {
    bank_transfer: 'Bank transfer',
    bank: 'Bank transfer',
    upi: 'UPI',
    qr: 'QR code',
    crypto_btc: 'Bitcoin',
    crypto_eth: 'Ethereum',
    crypto_usdt: 'USDT',
    metamask: 'MetaMask',
    card: 'Card',
    oxapay: 'OxaPay',
    manual: 'Manual / Bank',
  };
  if (labels[m]) return labels[m];
  return method
    ? method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';
}

export function normalizeStatus(raw: string): Transaction['status'] {
  const s = (raw || '').toLowerCase();
  if (['approved', 'auto_approved', 'completed'].includes(s)) return 'completed';
  if (s === 'pending') return 'pending';
  if (['rejected', 'failed'].includes(s)) return 'failed';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  return 'pending';
}

export function mapLedgerToTransaction(row: WalletLedgerItem): Transaction {
  const raw = (row.type || '').toLowerCase();
  let uiType: TransactionKind = 'adjustment';
  if (raw === 'transfer') uiType = 'transfer';
  else if (raw === 'profit') uiType = 'profit';
  else if (raw === 'loss') uiType = 'loss';
  else if (raw === 'credit') uiType = 'credit';
  else if (raw === 'adjustment') uiType = 'adjustment';
  const amt = Number(row.amount) || 0;
  return {
    id: `ledger-${row.id}`,
    type: uiType,
    amount: Math.abs(amt),
    signedAmount: amt,
    currency: row.currency || 'USD',
    status: normalizeStatus(row.status || 'completed'),
    method: row.method || formatMethod(raw),
    created_at: row.created_at || new Date(0).toISOString(),
    description: row.description?.trim() || undefined,
    account_id: row.account_id ?? undefined,
  };
}

export function mergeWalletHistory(
  deposits: WalletListItem[],
  withdrawals: WalletListItem[],
  ledger: WalletLedgerItem[],
): Transaction[] {
  const mapRow = (row: WalletListItem, kind: 'deposit' | 'withdrawal'): Transaction => {
    const n = Math.abs(Number(row.amount) || 0);
    return {
      id: `${kind}-${row.id}`,
      type: kind,
      amount: n,
      signedAmount: kind === 'deposit' ? n : -n,
      currency: row.currency || 'USD',
      status: normalizeStatus(row.status),
      method: formatMethod(row.method),
      created_at: row.created_at || new Date(0).toISOString(),
    };
  };

  const merged = [
    ...deposits.map((d) => mapRow(d, 'deposit')),
    ...withdrawals.map((w) => mapRow(w, 'withdrawal')),
    ...ledger.map(mapLedgerToTransaction),
  ];
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return merged;
}

export function transactionMatchesTypeFilter(
  tx: Transaction,
  f: 'all' | 'deposit' | 'withdrawal' | 'transfer' | 'trading' | 'adjustment' | 'commission',
): boolean {
  if (f === 'all') return true;
  if (f === 'deposit') return tx.type === 'deposit';
  if (f === 'withdrawal') return tx.type === 'withdrawal';
  if (f === 'transfer') return tx.type === 'transfer';
  if (f === 'trading') return tx.type === 'profit' || tx.type === 'loss';
  if (f === 'commission') return tx.type === 'credit' || tx.method.toLowerCase().includes('commission');
  if (f === 'adjustment')
    return (
      tx.type === 'adjustment' ||
      tx.type === 'credit' ||
      tx.type === 'correction' ||
      tx.type === 'bonus'
    );
  return true;
}

export function transactionTitle(tx: Transaction): string {
  switch (tx.type) {
    case 'deposit':
      return 'Deposit';
    case 'withdrawal':
      return 'Withdrawal';
    case 'transfer':
      return 'Transfer';
    case 'profit':
      return 'Realized profit';
    case 'loss':
      return 'Realized loss';
    case 'credit':
      return 'Credit';
    case 'adjustment':
      return 'Adjustment';
    case 'bonus':
      return 'Bonus';
    case 'correction':
      return 'Correction';
    default:
      return 'Transaction';
  }
}

export const PAGE_SIZES = [10, 25, 50] as const;
