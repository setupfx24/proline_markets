'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Link2, Loader2, X } from 'lucide-react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import ShareTradeCard from './ShareTradeCard';

type DisplayMode = 'pnl' | 'roi' | 'ticks';

interface Position {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  current_price?: number | null;
  profit?: number;
  commission?: number;
  created_at?: string | null;
}

interface ShareTradeModalProps {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  leverage?: number;
  pipSize?: number;
}

export default function ShareTradeModal({ open, onClose, position, leverage = 100, pipSize = 0.0001 }: ShareTradeModalProps) {
  const [description, setDescription] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pnl');
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setLinkDescription('');
      setDisplayMode('pnl');
      setShareUrl(null);
    }
  }, [open, position?.id]);

  if (!open || !position) return null;

  const handleCopyLink = async () => {
    setCreating(true);
    try {
      const res = await api.post<{ short_code: string; expires_at: string }>(
        `/positions/${position.id}/share`,
        {
          description: description || null,
          link_description: linkDescription || null,
          display_mode: displayMode,
        },
      );
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/s/${res.short_code}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link copied to clipboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download = `ProlineMarkets-${position.symbol}-${position.side}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to generate image');
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-bg-secondary border border-border-glass rounded-xl shadow-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-glass">
          <h2 className="text-lg font-bold text-text-primary">Share</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-hover hover:text-text-primary transition-fast">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Card preview */}
          <div>
            <div ref={cardRef}>
              <ShareTradeCard
                symbol={position.symbol}
                side={position.side}
                lots={position.lots}
                leverage={leverage}
                openPrice={position.open_price}
                currentPrice={position.current_price ?? position.open_price}
                pnl={(position.profit ?? 0) - (position.commission ?? 0)}
                openedAt={position.created_at ?? null}
                displayMode={displayMode}
                pipSize={pipSize}
                status="active"
                shortUrl={shareUrl ?? 'ProlineMarketsfx.com/s/xxxxxx'}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-text-secondary">Card description</label>
                <span className="text-[10px] text-text-tertiary">{description.length}/140</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 140))}
                rows={3}
                placeholder="Describe your trade"
                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-glass rounded-lg focus:border-buy outline-none transition-fast resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-text-secondary">Online link description</label>
                <span className="text-[10px] text-text-tertiary">{linkDescription.length}/500</span>
              </div>
              <textarea
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Share your links, e.g. https://www.instagram.com/..."
                className="w-full px-3 py-2 text-sm bg-bg-input border border-border-glass rounded-lg focus:border-buy outline-none transition-fast resize-none"
              />
              <p className="text-[10px] text-text-tertiary mt-1.5">
                Text will be displayed only when the shared link is visited. Share your affiliate or social media links here.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-secondary mb-2 block">Profit / Loss</label>
              <div className="space-y-2">
                {[
                  { v: 'pnl', label: 'Profit and loss' },
                  { v: 'roi', label: 'ROI % compared to margin' },
                  { v: 'ticks', label: 'Ticks' },
                ].map((opt) => (
                  <label key={opt.v} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="displayMode"
                      value={opt.v}
                      checked={displayMode === opt.v}
                      onChange={() => setDisplayMode(opt.v as DisplayMode)}
                      className="w-4 h-4 accent-buy"
                    />
                    <span className="text-sm text-text-primary">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={creating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-buy text-white hover:bg-buy-light disabled:opacity-60 transition-fast"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : shareUrl ? <Copy className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                {shareUrl ? 'Copy Link' : 'Create Link'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold bg-bg-tertiary border border-border-glass text-text-primary hover:bg-bg-hover transition-fast"
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>

            {shareUrl && (
              <div className="p-3 rounded-lg bg-buy/10 border border-buy/25 space-y-1.5">
                <p className="text-xs font-semibold text-buy">Link Created Â· valid 7 days</p>
                <p className="text-xs font-mono text-text-primary break-all">{shareUrl}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
