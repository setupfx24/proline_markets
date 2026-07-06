'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi, getAdminApiBase } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Building2,
  Edit2,
  Loader2,
  Plus,
  QrCode,
  Trash2,
  Upload,
  X,
  ImageIcon,
} from 'lucide-react';

interface Bank {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
  qr_code_url: string;
  is_active: boolean;
  method_type?: string;   // 'bank' | 'crypto'
  asset?: string;         // e.g. USDT
  network?: string;       // e.g. TRC20
  wallet_address?: string;
}

type BankForm = Omit<Bank, 'id'>;

const emptyForm: BankForm = {
  bank_name: '',
  account_holder: '',
  account_number: '',
  ifsc_code: '',
  upi_id: '',
  qr_code_url: '',
  is_active: true,
  method_type: 'bank',
  asset: 'USDT',
  network: 'TRC20',
  wallet_address: '',
};

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [form, setForm] = useState<BankForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get<any[]>('/banks');
      const list = (Array.isArray(res) ? res : (res as any).banks || []).map((b: any) => ({
        ...b,
        account_holder: b.account_holder || b.account_name || '',
      }));
      setBanks(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const openAdd = () => {
    setEditingBank(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (bank: Bank) => {
    setEditingBank(bank);
    setForm({
      bank_name: bank.bank_name,
      account_holder: bank.account_holder,
      account_number: bank.account_number,
      ifsc_code: bank.ifsc_code,
      upi_id: bank.upi_id,
      qr_code_url: bank.qr_code_url,
      is_active: bank.is_active,
      method_type: bank.method_type || 'bank',
      asset: bank.asset || 'USDT',
      network: bank.network || 'TRC20',
      wallet_address: bank.wallet_address || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBank(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    const isCrypto = form.method_type === 'crypto';
    if (isCrypto) {
      if (!(form.wallet_address || '').trim()) {
        toast.error('Wallet address is required for a crypto method');
        return;
      }
    } else if (!form.bank_name.trim() || !form.account_holder.trim() || !form.account_number.trim()) {
      toast.error('Bank name, account holder, and account number are required');
      return;
    }

    const payload = {
      method_type: form.method_type || 'bank',
      account_name: form.account_holder,
      account_number: form.account_number,
      bank_name: form.bank_name,
      ifsc_code: form.ifsc_code,
      upi_id: form.upi_id,
      qr_code_url: form.qr_code_url,
      asset: form.asset,
      network: form.network,
      wallet_address: form.wallet_address,
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editingBank) {
        await adminApi.put(`/banks/${editingBank.id}`, payload);
        toast.success('Bank updated');
      } else {
        await adminApi.post('/banks', payload);
        toast.success('Bank added');
      }
      closeModal();
      fetchBanks();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bank: Bank) => {
    try {
      await adminApi.put(`/banks/${bank.id}`, {
        ...bank,
        is_active: !bank.is_active,
      });
      toast.success(bank.is_active ? 'Bank deactivated' : 'Bank activated');
      fetchBanks();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.delete(`/banks/${deleteTarget.id}`);
      toast.success('Bank deleted');
      setDeleteTarget(null);
      fetchBanks();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (field: keyof BankForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleQrUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large (max 5MB)');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const authToken = adminApi.getToken() || '';
      const uploadUrl = `${getAdminApiBase()}/banks/upload-qr`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
      const rel = typeof data.url === 'string' ? data.url : '';
      const qrUrl = rel.startsWith('http') ? rel : `${getAdminApiBase()}${rel.startsWith('/') ? rel : `/${rel}`}`;
      updateField('qr_code_url', qrUrl);
      toast.success('QR code uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Bank Accounts</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Manage settlement bank accounts shown to users
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-buy text-white rounded-md hover:bg-buy-dark transition-fast"
          >
            <Plus size={14} />
            Add Bank Account
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-xs text-danger">{error}</div>
        ) : banks.length === 0 ? (
          <div className="bg-bg-secondary border border-border-primary rounded-md py-16 text-center text-xs text-text-tertiary">
            No bank accounts configured yet
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {banks.map((b) => (
              <div
                key={b.id}
                className="bg-bg-secondary border border-border-primary rounded-md p-4 flex flex-col gap-3 transition-fast hover:border-border-secondary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-md bg-bg-tertiary border border-border-primary shrink-0">
                      <Building2 size={16} className="text-buy" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {b.bank_name}
                      </p>
                      <p className="text-xxs text-text-tertiary truncate">{b.account_holder}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(b)}
                    className={cn(
                      'shrink-0 px-1.5 py-0.5 rounded-sm text-xxs font-medium cursor-pointer transition-fast',
                      b.is_active
                        ? 'bg-success/15 text-success hover:bg-success/25'
                        : 'bg-text-tertiary/20 text-text-tertiary hover:bg-text-tertiary/30',
                    )}
                  >
                    {b.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <dt className="text-xxs text-text-tertiary uppercase tracking-wide">
                      Account
                    </dt>
                    <dd className="text-xs text-text-secondary font-mono tabular-nums">
                      {b.account_number}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xxs text-text-tertiary uppercase tracking-wide">IFSC</dt>
                    <dd className="text-xs text-text-secondary font-mono">{b.ifsc_code || 'â€”'}</dd>
                  </div>
                  <div>
                    <dt className="text-xxs text-text-tertiary uppercase tracking-wide">UPI ID</dt>
                    <dd className="text-xs text-text-secondary truncate">{b.upi_id || 'â€”'}</dd>
                  </div>
                  <div>
                    <dt className="text-xxs text-text-tertiary uppercase tracking-wide">
                      QR Code
                    </dt>
                    <dd>
                      {b.qr_code_url ? (
                        <div className="mt-1">
                          <img
                            src={b.qr_code_url.startsWith('http') ? b.qr_code_url : `${typeof window !== 'undefined' ? window.location.origin : ''}/admin-api${b.qr_code_url.startsWith('/') ? b.qr_code_url : `/${b.qr_code_url}`}`}
                            alt="QR"
                            className="w-14 h-14 object-contain rounded-md border border-border-primary bg-white cursor-pointer hover:scale-105 transition-fast shadow-sm"
                            onClick={() => {
                              const url = b.qr_code_url!.startsWith('http') ? b.qr_code_url! : `${window.location.origin}/admin-api${b.qr_code_url!.startsWith('/') ? b.qr_code_url! : `/${b.qr_code_url!}`}`;
                              window.open(url, '_blank');
                            }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-text-tertiary">â€”</span>
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2 pt-1 border-t border-border-primary/50">
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xxs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover hover:text-text-primary transition-fast"
                  >
                    <Edit2 size={11} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(b)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xxs text-danger border border-danger/30 rounded-md hover:bg-danger/15 transition-fast"
                  >
                    <Trash2 size={11} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">
                {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Method type: Bank/UPI vs Crypto */}
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Type</label>
                <div className="flex gap-2">
                  {(['bank', 'crypto'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateField('method_type', t)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-fast',
                        (form.method_type || 'bank') === t
                          ? 'bg-buy/15 text-buy border-buy/30'
                          : 'border-border-primary text-text-secondary hover:bg-bg-hover',
                      )}
                    >
                      {t === 'bank' ? 'Bank / UPI' : 'Crypto (USDT)'}
                    </button>
                  ))}
                </div>
              </div>

              {(
                form.method_type === 'crypto'
                  ? ([
                      { key: 'asset', label: 'Asset', placeholder: 'e.g. USDT' },
                      { key: 'network', label: 'Network', placeholder: 'e.g. TRC20' },
                      { key: 'wallet_address', label: 'Wallet Address', placeholder: 'e.g. TXYZ...' },
                    ] as const)
                  : ([
                      { key: 'bank_name', label: 'Bank Name', placeholder: 'e.g. HDFC Bank' },
                      { key: 'account_holder', label: 'Account Holder', placeholder: 'e.g. ProlineMarkets Pvt Ltd' },
                      { key: 'account_number', label: 'Account Number', placeholder: 'e.g. 1234567890' },
                      { key: 'ifsc_code', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234' },
                      { key: 'upi_id', label: 'UPI ID', placeholder: 'e.g. merchant@upi' },
                    ] as const)
              ).map((f) => (
                <div key={f.key}>
                  <label className="block text-xxs text-text-tertiary mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={(form[f.key] as string) || ''}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md placeholder:text-text-tertiary transition-fast focus:border-buy"
                  />
                </div>
              ))}

              {/* QR Code Upload */}
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">QR Code</label>
                {form.qr_code_url ? (
                  <div className="flex items-center gap-3 p-3 bg-bg-input border border-border-primary rounded-md">
                    <img
                      src={form.qr_code_url}
                      alt="QR Code"
                      className="w-20 h-20 object-contain rounded-md border border-border-primary bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-secondary truncate">QR code uploaded</p>
                      <div className="flex gap-2 mt-2">
                        <label className="inline-flex items-center gap-1 px-2 py-1 text-xxs text-buy border border-buy/30 rounded-md hover:bg-buy/10 transition-fast cursor-pointer">
                          <Upload size={11} />
                          Replace
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleQrUpload(f);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => updateField('qr_code_url', '')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xxs text-danger border border-danger/30 rounded-md hover:bg-danger/10 transition-fast"
                        >
                          <Trash2 size={11} />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md cursor-pointer transition-fast',
                      uploading
                        ? 'border-buy/40 bg-buy/5'
                        : 'border-border-primary hover:border-buy/50 hover:bg-buy/5',
                    )}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleQrUpload(f);
                    }}
                  >
                    {uploading ? (
                      <Loader2 size={24} className="animate-spin text-buy" />
                    ) : (
                      <div className="p-3 rounded-full bg-bg-tertiary border border-border-primary">
                        <ImageIcon size={20} className="text-text-tertiary" />
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-xs text-text-secondary">
                        {uploading ? 'Uploading...' : 'Click to upload or drag & drop'}
                      </p>
                      <p className="text-xxs text-text-tertiary mt-0.5">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleQrUpload(f);
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateField('is_active', !form.is_active)}
                  className={cn(
                    'w-9 h-5 rounded-full transition-fast relative',
                    form.is_active ? 'bg-success' : 'bg-text-tertiary/40',
                  )}
                >
                  <div
                    className={cn(
                      'w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-fast',
                      form.is_active ? 'left-[18px]' : 'left-[3px]',
                    )}
                  />
                </button>
                <span className="text-xs text-text-secondary">
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium bg-buy text-white rounded-md hover:bg-buy-dark transition-fast inline-flex items-center gap-1.5',
                  saving && 'opacity-50 pointer-events-none',
                )}
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                {editingBank ? 'Save Changes' : 'Add Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Delete Bank Account</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-text-secondary">
                Are you sure you want to delete{' '}
                <span className="text-text-primary font-medium">{deleteTarget.bank_name}</span> (
                {deleteTarget.account_number})? This action cannot be undone.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium bg-danger text-white rounded-md hover:bg-danger/80 transition-fast inline-flex items-center gap-1.5',
                  deleting && 'opacity-50 pointer-events-none',
                )}
              >
                {deleting && <Loader2 size={12} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
