import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoading } from '@/components/LoadingSpinner';

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      navigate('/auth');
    } else if (userRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/technician');
    }
  }, [user, userRole, loading, navigate]);

  return <FullPageLoading />;
};

export default Index;
