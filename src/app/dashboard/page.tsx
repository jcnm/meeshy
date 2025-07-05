'use client';

import { useUser } from '@/context/AppContext';
import { ResponsiveLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { DashboardContent } from '@/components/dashboard';

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <ProtectedRoute>
      <ResponsiveLayout>
        {user && <DashboardContent />}
      </ResponsiveLayout>
    </ProtectedRoute>
  );
}
