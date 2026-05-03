'use client';

import { Toaster } from 'react-hot-toast';

const toastStyle = {
  background: '#111111',
  color: '#f0f0f0',
  border: '1px solid rgba(255,255,255,0.06)',
  fontSize: '12px',
  borderRadius: '10px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
};

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: toastStyle,
        success: { iconTheme: { primary: '#00e676', secondary: '#000' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  );
}
