import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { toast } from 'sonner';

const Index = () => {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'technician') {
      navigate('/technician');
    } else {
      // User is logged in but has no role record in the DB yet
      // This happens typically right after sign-up or if DB setup is incomplete
      console.warn('User logged in but has no assigned role:', user.email);
      // We can redirect them to a default page or sign them out to fix state
      toast.error('Seu perfil ainda não foi configurado. Entre em contato com o administrador.');
      signOut();
      navigate('/auth');
    }
  }, [user, userRole, loading, navigate, signOut]);

  return <FullPageLoading />;
};

export default Index;
