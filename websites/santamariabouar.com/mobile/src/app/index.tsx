import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { LoadingState } from '@/components/States';

export default function Index() {
  const { status, mode, user } = useAuth();

  if (status === 'loading') return <LoadingState />;
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (mode === 'admin' && user?.isAdmin) return <Redirect href="/admin" />;
  return <Redirect href="/member" />;
}
