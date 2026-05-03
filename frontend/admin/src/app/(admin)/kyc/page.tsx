'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { adminApi, getAdminApiBase } from '@/lib/api';
import toast from 'react-hot-toast';
import { Check, X, Loader2, FileText, Eye, AlertCircle } from 'lucide-react';

interface KYCDocument {
  id: string;
  document_type: string;
  file_url: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  reviewed_at?: string;
}

interface KYCUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth?: string;
  country: string;
  address: string;
  kyc_status: string;
  created_at: string;
  approved_at?: string;
  documents: KYCDocument[];
}

type Tab = 'pending' | 'approved' | 'rejected';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function KYCPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<KYCUser[]>([]);
  const [approved, setApproved] = useState<KYCUser[]>([]);
  const [rejected, setRejected] = useState<KYCUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewModal, setViewModal] = useState<KYCUser | null>(null);
  const [approveModal, setApproveModal] = useState<KYCUser | null>(null);
  const [rejectModal, setRejectModal] = useState<KYCUser | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  /** KYC files are behind admin auth — fetch with Bearer token and open as blob URL. */
  const openKycDocument = async (docId: string) => {
    setOpeningDocId(docId);
    // Open the window synchronously inside the click so popup blockers allow it.
    const win = window.open('about:blank', '_blank');
    try {
      const token = adminApi.getToken();
      const res = await fetch(`${getAdminApiBase()}/kyc/file/${docId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : `Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (win && !win.closed) {
        win.location.href = url;
      } else {
        window.location.href = url;
      }
      // Revoke after a short delay so the tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      if (win && !win.closed) win.close();
      toast.error(e instanceof Error ? e.message : 'Failed to open document');
    } finally {
      setOpeningDocId(null);
    }
  };
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        adminApi.get<{ items: KYCUser[] }>('/kyc/pending'),
        adminApi.get<{ items: KYCUser[] }>('/kyc/approved'),
        adminApi.get<{ items: KYCUser[] }>('/kyc/rejected'),
      ]);
      setPending(pendingRes.items || []);
      setApproved(approvedRes.items || []);
      setRejected(rejectedRes.items || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load KYC data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      await adminApi.post(`/kyc/${approveModal.id}/approve`, {});
      toast.success('KYC approved successfully');
      setApproveModal(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await adminApi.post(`/kyc/${rejectModal.id}/reject`, { reason: rejectReason });
      toast.success('KYC rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const currentData = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;

  return (
    <>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">KYC Management</h1>
          <p className="text-xxs text-text-tertiary mt-0.5">Review and approve user KYC submissions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending Review', value: pending.length, color: 'text-warning' },
            { label: 'Approved', value: approved.length, color: 'text-success' },
            { label: 'Rejected', value: rejected.length, color: 'text-danger' },
          ].map((stat) => (
            <div key={stat.label} className="bg-bg-secondary border border-border-primary rounded-md p-3">
              <p className="text-xxs text-text-tertiary mb-1">{stat.label}</p>
              <p className={cn('text-xl font-semibold tabular-nums', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-bg-secondary border border-border-primary rounded-md">
          <div className="flex gap-1 p-1 border-b border-border-primary">
            {[
              { id: 'pending' as Tab, label: 'Pending Review', badge: pending.length },
              { id: 'approved' as Tab, label: 'Approved', badge: approved.length },
              { id: 'rejected' as Tab, label: 'Rejected', badge: rejected.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-fast',
                  tab === t.id
                    ? 'bg-bg-hover text-text-primary border border-border-primary'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="ml-1.5 px-1 py-0.5 text-xxs bg-buy/15 text-buy rounded-sm tabular-nums">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : currentData.length === 0 ? (
            <div className="text-center py-16 text-xs text-text-tertiary">No {tab} KYC submissions</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-tertiary/40">
                    {['User', 'Email', 'Phone', 'Country', 'Documents', 'Submitted', 'Actions'].map((c) => (
                      <th key={c} className="text-left px-3 py-2.5 text-xxs font-medium text-text-tertiary uppercase tracking-wide">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((user) => (
                    <tr key={user.id} className="border-b border-border-primary/50 hover:bg-bg-hover transition-fast">
                      <td className="px-3 py-2">
                        <p className="text-xs text-text-primary font-medium">
                          {user.first_name} {user.last_name}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{user.email}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{user.phone || '—'}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">{user.country || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <FileText size={12} className="text-text-tertiary" />
                          <span className="text-xs text-text-primary">{user.documents.length}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xxs text-text-tertiary">{fmt(user.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewModal(user)}
                            className="px-2 py-1 text-xxs font-medium bg-bg-tertiary text-text-primary border border-border-primary rounded hover:bg-bg-hover transition-fast inline-flex items-center gap-1"
                          >
                            <Eye size={11} /> View
                          </button>
                          {tab === 'pending' && (
                            <>
                              <button
                                onClick={() => setApproveModal(user)}
                                className="px-2 py-1 text-xxs font-medium bg-success/15 text-success border border-success/30 rounded hover:bg-success/25 transition-fast"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectModal(user)}
                                className="px-2 py-1 text-xxs font-medium bg-danger/15 text-danger border border-danger/30 rounded hover:bg-danger/25 transition-fast"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary sticky top-0 bg-bg-secondary">
              <h2 className="text-sm font-semibold text-text-primary">KYC Details</h2>
              <button
                onClick={() => setViewModal(null)}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* User Info */}
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <h3 className="text-xs font-semibold text-text-primary mb-2">Personal Information</h3>
                <div className="grid grid-cols-2 gap-2 text-xxs">
                  <div>
                    <span className="text-text-tertiary">Name:</span>{' '}
                    <span className="text-text-primary font-medium">
                      {viewModal.first_name} {viewModal.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Email:</span>{' '}
                    <span className="text-text-primary">{viewModal.email}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Phone:</span>{' '}
                    <span className="text-text-primary">{viewModal.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Country:</span>{' '}
                    <span className="text-text-primary">{viewModal.country || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-tertiary">Address:</span>{' '}
                    <span className="text-text-primary">{viewModal.address || '—'}</span>
                  </div>
                  {viewModal.date_of_birth && (
                    <div>
                      <span className="text-text-tertiary">DOB:</span>{' '}
                      <span className="text-text-primary">{fmt(viewModal.date_of_birth)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-xs font-semibold text-text-primary mb-2">Submitted Documents</h3>
                <div className="space-y-2">
                  {viewModal.documents.map((doc) => (
                    <div key={doc.id} className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs font-medium text-text-primary capitalize">
                            {doc.document_type.replace('_', ' ')}
                          </p>
                          <p className="text-xxs text-text-tertiary mt-0.5">Uploaded: {fmt(doc.created_at)}</p>
                        </div>
                        <span
                          className={cn(
                            'text-xxs px-1.5 py-0.5 rounded-sm font-medium',
                            doc.status === 'approved'
                              ? 'bg-success/15 text-success'
                              : doc.status === 'rejected'
                              ? 'bg-danger/15 text-danger'
                              : 'bg-warning/15 text-warning'
                          )}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openKycDocument(doc.id)}
                        disabled={openingDocId === doc.id}
                        className="text-xxs text-buy hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {openingDocId === doc.id ? <Loader2 size={10} className="animate-spin" /> : <Eye size={10} />}
                        {openingDocId === doc.id ? 'Opening…' : 'View Document'}
                      </button>
                      {doc.rejection_reason && (
                        <p className="text-xxs text-danger mt-2">Reason: {doc.rejection_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Approve KYC</h2>
              <button
                onClick={() => setApproveModal(null)}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-success/10 border border-success/20">
                <p className="text-xs text-success font-medium mb-1">✓ Approve KYC Verification</p>
                <p className="text-xxs text-text-secondary">
                  This will mark the user as verified and allow them full access to trading features.
                </p>
              </div>
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">
                  {approveModal.first_name} {approveModal.last_name}
                </p>
                <p className="text-xxs text-text-tertiary">{approveModal.email}</p>
                <p className="text-xxs text-text-tertiary mt-1">{approveModal.documents.length} documents submitted</p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={() => setApproveModal(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-success rounded-md hover:bg-success/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve KYC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-bg-secondary border border-border-primary rounded-md shadow-modal animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <h2 className="text-sm font-semibold text-text-primary">Reject KYC</h2>
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-fast"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20">
                <p className="text-xs text-danger font-medium mb-1 inline-flex items-center gap-1">
                  <AlertCircle size={12} /> Reject KYC Verification
                </p>
                <p className="text-xxs text-text-secondary">
                  User will be notified and can resubmit their documents.
                </p>
              </div>
              <div className="p-3 rounded-md bg-bg-tertiary border border-border-primary">
                <p className="text-xs text-text-primary font-medium">
                  {rejectModal.first_name} {rejectModal.last_name}
                </p>
                <p className="text-xxs text-text-tertiary">{rejectModal.email}</p>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection..."
                  className="w-full px-3 py-2 text-xs bg-bg-input border border-border-primary rounded-md text-text-primary resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-primary rounded-md hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-danger rounded-md hover:bg-danger/80 disabled:opacity-50 transition-fast inline-flex items-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Reject KYC
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
