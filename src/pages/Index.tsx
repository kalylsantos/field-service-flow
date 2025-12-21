import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoading } from '@/components/LoadingSpinner';

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    console.log('Index Redirect Debug:', { user: user?.email, role: userRole });

    if (!user) {
      navigate('/auth');
    } else if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'technician') {
      navigate('/technician');
    }
    // If user is authenticated but has no role yet (or invalid), stay on loading or handle error
    // For now, we wait. ProtectedRoute handles the nuances for direct access.
  }, [user, userRole, loading, navigate]);

  return <FullPageLoading />;
};

export default Index;
