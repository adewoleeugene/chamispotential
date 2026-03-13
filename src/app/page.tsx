'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRouteForRole } from '@/lib/roleRoutes';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace(user.mustChangePassword ? '/change-password' : getDefaultRouteForRole(user.role));
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="fullscreen-shell">
      <div className="fullscreen-panel">
        <span className="fullscreen-kicker">Initializing RMS</span>
        <div className="loading-spinner" />
        <p className="fullscreen-copy">Routing you to the right station.</p>
      </div>
    </div>
  );
}
