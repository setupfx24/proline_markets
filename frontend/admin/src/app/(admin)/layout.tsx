'use client';

import AdminLayout from '@/components/layout/AdminLayout';

/** Client layout: avoids RSC/client boundary issues; one shell for all admin routes. */
export default function AdminRouteGroupLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
