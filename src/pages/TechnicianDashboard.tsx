import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders } from '@/hooks/useServiceOrders';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, RefreshCw, MapPin, Wrench, Clock, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceOrderStatus } from '@/types';
import { LocationTracker } from '@/components/LocationTracker';

export default function TechnicianDashboard() {
  const { user, signOut } = useAuth();
  const { orders, loading, refetch } = useServiceOrders(user?.id);
  const navigate = useNavigate();

  if (loading) return <FullPageLoading />;

  const getStatusConfig = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendente', className: 'bg-blue-500 text-white hover:bg-blue-600' };
      case 'in_progress':
        return { label: 'Em Andamento', className: 'bg-yellow-500 text-white hover:bg-yellow-600' };
      case 'completed':
        return { label: 'Concluído', className: 'bg-green-500 text-white hover:bg-green-600' };
      case 'not_executed':
        return { label: 'Não Executado', className: 'bg-red-500 text-white hover:bg-red-600' };
      default:
        return { label: status, className: 'bg-muted text-muted-foreground' };
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Técnico';

  return (
    <div className="min-h-screen bg-muted/30 pb-6">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="px-4 py-5 safe-area-inset">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <Droplets className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm opacity-80">Olá,</p>
                <h1 className="text-xl font-bold">{firstName}</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={refetch}
                className="text-primary-foreground hover:bg-white/10"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-primary-foreground hover:bg-white/10"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-4 -mt-3">
        <div className="bg-card rounded-xl shadow-card p-4 flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-foreground">{orders.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-blue-500">
              {orders.filter(o => o.status === 'pending').length}
            </p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-yellow-500">
              {orders.filter(o => o.status === 'in_progress').length}
            </p>
            <p className="text-xs text-muted-foreground">Andamento</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-500">
              {orders.filter(o => o.status === 'completed').length}
            </p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
        </div>
      </div>

      {/* Task List */}
      <main className="px-4 py-4 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Minhas Tarefas</h2>

        {orders.map((order) => {
          const statusConfig = getStatusConfig(order.status);

          return (
            <Card
              key={order.id}
              className="border-0 shadow-card cursor-pointer active:scale-[0.98] transition-all duration-150 overflow-hidden"
              onClick={() => navigate(`/technician/order/${order.id}`)}
            >
              <CardContent className="p-0">
                {/* Card Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="font-mono text-xl font-bold text-foreground">
                    #{order.sequencial || order.id.slice(0, 8)}
                  </span>
                  <Badge className={cn('text-xs font-medium px-3 py-1', statusConfig.className)}>
                    {statusConfig.label}
                  </Badge>
                </div>

                {/* Service Type */}
                <div className="px-4 pb-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Wrench className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      {order.service_type || 'Corte de Água'}
                    </span>
                  </div>
                </div>

                {/* Address */}
                <div className="px-4 pb-3">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="text-sm">
                      {order.address}, {order.number} - {order.neighborhood}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">
                    {order.scheduled_date || 'Sem data programada'}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {orders.length === 0 && (
          <div className="text-center py-16">
            <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Droplets className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">Nenhuma ordem atribuída</p>
            <p className="text-sm text-muted-foreground mt-1">Suas tarefas aparecerão aqui</p>
          </div>
        )}
      </main>
      <LocationTracker />
    </div>
  );
}
