import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders } from '@/hooks/useServiceOrders';
import { StatusBadge } from '@/components/StatusBadge';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Droplets, LogOut, RefreshCw, MapPin, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TechnicianDashboard() {
  const { user, signOut } = useAuth();
  const { orders, loading, refetch } = useServiceOrders(user?.id);
  const navigate = useNavigate();

  if (loading) return <FullPageLoading />;

  const statusBorderColors = {
    pending: 'border-l-status-pending',
    in_progress: 'border-l-status-in-progress',
    completed: 'border-l-status-completed',
    not_executed: 'border-l-status-not-executed',
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Droplets className="h-7 w-7" />
              <div>
                <h1 className="text-lg font-bold">Minhas Ordens</h1>
                <p className="text-xs opacity-80">{orders.length} tarefas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={refetch} className="text-primary-foreground"><RefreshCw className="h-5 w-5" /></Button>
              <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground"><LogOut className="h-5 w-5" /></Button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3">
        {orders.map((order) => (
          <Card
            key={order.id}
            className={cn('border-l-4 cursor-pointer active:scale-[0.99] transition-transform', statusBorderColors[order.status])}
            onClick={() => navigate(`/technician/order/${order.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="font-mono font-bold">{order.sequencial || order.id}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{order.address}, {order.number} - {order.neighborhood}</span></div>
                {order.service_type && <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span>{order.service_type}</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhuma ordem atribuída</div>}
      </main>
    </div>
  );
}
