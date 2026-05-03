'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, Image as ImageIcon, ExternalLink, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url?: string | null;
  position: string;
  target_page: string;
  target_audience?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

/** Trader-facing URL in DB; admin UI loads via /admin-api proxy to the same files. */
function adminBannerImgSrc(stored: string): string {
  if (!stored) return '';
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;
  const m = stored.match(/\/api\/v1\/banners\/media\/([^/?#]+)/);
  if (m) return `/admin-api/banners/media/${encodeURIComponent(m[1])}`;
  return stored;
}

const EMPTY_FORM = {
  title: '',
  image_url: '',
  link_url: '',
  position: 'top',
  target_page: 'dashboard',
  sort_order: '0',
  is_active: true,
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ banners: Banner[] } | Banner[]>('/banners');
      const raw: unknown[] = Array.isArray(res) ? res : res.banners ?? [];
      const mapped: Banner[] = raw.map((row) => {
        const b = row as Record<string, unknown>;
        return {
        id: String(b.id),
        title: (b.title as string) ?? '',
        image_url: (b.image_url as string) ?? '',
        link_url: (b.link_url as string) ?? '',
        position: (b.position as string) ?? 'top',
        target_page: (b.target_page as string) ?? 'dashboard',
        target_audience: (b.target_audience as string) ?? 'all',
        is_active: Boolean(b.is_active),
        sort_order: Number(b.priority ?? b.sort_order ?? 0),
        created_at: b.created_at as string | undefined,
        };
      });
      setBanners(mapped);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load banners';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setForm({
      title: b.title,
      image_url: b.image_url,
      link_url: b.link_url ?? '',
      position: b.position,
      target_page: b.target_page,
      sort_order: String(b.sort_order),
      is_active: b.is_active,
    });
    setShowModal(true);
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const out = await adminApi.postForm<{ url: string }>('/banners/upload', fd);
      if (!out.url) throw new Error('No URL returned');
      setForm((f) => ({ ...f, image_url: out.url }));
      toast.success('Image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!form.image_url.trim()) {
      toast.error('Add an image from your device or paste an image URL');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        image_url: form.image_url.trim(),
        link_url: form.link_url.trim() || null,
        position: form.position,
        target_page: form.target_page,
        target_audience: 'all',
        priority: parseInt(form.sort_order, 10) || 0,
        is_active: form.is_active,
      };
      if (editId) {
        await adminApi.put(`/banners/${editId}`, body);
        toast.success('Banner updated');
      } else {
        await adminApi.post('/banners', { ...body, is_active: true });
        toast.success('Banner created');
      }
      setShowModal(false);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminApi.delete(`/banners/${id}`);
      toast.success('Banner deleted');
      setDeleteConfirm(null);
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const toggleActive = async (b: Banner) => {
    try {
      await adminApi.put(`/banners/${b.id}`, {
        title: b.title || '',
        image_url: b.image_url,
        link_url: b.link_url || null,
        position: b.position,
        target_page: b.target_page,
        target_audience: b.target_audience || 'all',
        priority: b.sort_order,
        is_active: !b.is_active,
      });
      toast.success(b.is_active ? 'Banner deactivated' : 'Banner activated');
      void fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const updateForm = (key: string, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Banner Management</h1>
            <p className="text-xxs text-text-tertiary mt-0.5">
              Upload images from your device. Banners with target <strong>Dashboard</strong> (or <strong>All Pages</strong>)
              show on the trader dashboard after you activate them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast"
            >
              <Plus size={14} /> New Banner
            </button>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="p-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover transition-fast"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        ) : banners.length === 0 ? (
          <div className="bg-bg-secondary border border-border-primary rounded-md text-center text-xs text-text-tertiary py-12">
            No banners yet. Create one and set target page to Dashboard (or All Pages), then activate it.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((b) => (
              <div
                key={b.id}
                className="bg-bg-secondary border border-border-primary rounded-md overflow-hidden transition-fast hover:border-border-secondary"
              >
                <div className="aspect-[16/7] bg-bg-tertiary relative overflow-hidden">
                  {b.image_url ? (
                    <img
                      src={adminBannerImgSrc(b.image_url)}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={32} className="text-text-tertiary/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span
                      className={cn(
                        'inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium',
                        b.is_active
                          ? 'bg-success/90 text-white'
                          : 'bg-bg-secondary/90 text-text-tertiary border border-border-primary',
                      )}
                    >
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="text-xs font-medium text-text-primary truncate">{b.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-buy/15 text-buy">
                      {b.position}
                    </span>
                    <span className="inline-flex px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-accent/15 text-accent">
                      {b.target_page}
                    </span>
                  </div>
                  {b.link_url && (
                    <div className="flex items-center gap-1 text-xxs text-text-tertiary truncate">
                      <ExternalLink size={10} />
                      <span className="truncate">{b.link_url}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border-primary">
                    <button
                      type="button"
                      onClick={() => toggleActive(b)}
                      className={cn(
                        'flex-1 px-2 py-1 rounded-md text-xxs font-medium transition-fast border',
                        b.is_active
                          ? 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/25'
                          : 'bg-success/15 text-success border-success/30 hover:bg-success/25',
                      )}
                    >
                      {b.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      className="p-1 rounded-md text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(b.id)}
                      className="p-1 rounded-md text-danger border border-danger/30 hover:bg-danger/15 transition-fast"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">{editId ? 'Edit Banner' : 'Create Banner'}</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  placeholder="Banner title"
                />
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Banner image</label>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onPickFile} />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border-primary bg-bg-input hover:bg-bg-hover transition-fast disabled:opacity-50"
                  >
                    {uploadingFile ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Choose file
                  </button>
                  {form.image_url ? (
                    <span className="text-xxs text-success truncate max-w-[200px]" title={form.image_url}>
                      Image set
                    </span>
                  ) : (
                    <span className="text-xxs text-text-tertiary">No file selected</span>
                  )}
                </div>
                <p className="text-xxs text-text-tertiary mt-1">Or paste a public image URL:</p>
                <input
                  value={form.image_url}
                  onChange={(e) => updateForm('image_url', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md mt-1"
                  placeholder="/api/v1/banners/media/… or https://…"
                />
                {form.image_url ? (
                  <div className="mt-2 rounded-md border border-border-primary overflow-hidden bg-bg-tertiary max-h-32">
                    <img src={adminBannerImgSrc(form.image_url)} alt="Preview" className="w-full h-full object-contain max-h-32" />
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Link URL (optional)</label>
                <input
                  value={form.link_url}
                  onChange={(e) => updateForm('link_url', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  placeholder="https://…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Position</label>
                  <select
                    value={form.position}
                    onChange={(e) => updateForm('position', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  >
                    <option value="top">Top</option>
                    <option value="sidebar">Sidebar</option>
                    <option value="bottom">Bottom</option>
                    <option value="popup">Popup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xxs text-text-tertiary mb-1">Target Page</label>
                  <select
                    value={form.target_page}
                    onChange={(e) => updateForm('target_page', e.target.value)}
                    className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="all">All Pages</option>
                    <option value="trading">Trading</option>
                    <option value="deposit">Deposit</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xxs text-text-tertiary mb-1">Sort order (higher first)</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => updateForm('sort_order', e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-bg-input border border-border-primary rounded-md"
                />
              </div>
              {editId ? (
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => updateForm('is_active', e.target.checked)} className="rounded" />
                  Active (visible to traders when scheduled)
                </label>
              ) : null}
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-buy/15 text-buy border border-buy/30 hover:bg-buy/25 transition-fast disabled:opacity-50"
              >
                {submitting ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-bg-secondary border border-border-primary rounded-md shadow-modal w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary">Delete Banner</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-text-secondary">
                Remove this banner and its uploaded image from the server? You can upload a new banner anytime.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-border-primary flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-md text-xs text-text-secondary border border-border-primary hover:bg-bg-hover transition-fast"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(deleteConfirm)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 transition-fast"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
