import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders } from '@/hooks/useServiceOrders';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Droplets,
  RefreshCw,
  MapPin,
  Wrench,
  Clock,
  LogOut,
  Menu,
  History,
  ClipboardList,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceOrderStatus } from '@/types';
import { LocationTracker } from '@/components/LocationTracker';

type DashboardView = 'active' | 'history';

export default function TechnicianDashboard() {
  const { user, signOut } = useAuth();
  const { orders, loading, refetch } = useServiceOrders(user?.id);
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<DashboardView>('active');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const filteredOrders = orders.filter(order => {
    if (currentView === 'active') {
      return order.status === 'pending' || order.status === 'in_progress';
    } else {
      return order.status === 'completed' || order.status === 'not_executed';
    }
  });

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Técnico';

  return (
    <div className="min-h-screen bg-muted/30 pb-6">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="px-4 py-5 safe-area-inset">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[80%] max-w-[300px] border-r-0 p-0 flex flex-col">
                  <SheetHeader className="gradient-hero text-primary-foreground p-6 pt-10 text-left">
                    <SheetTitle className="text-primary-foreground flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-xl">
                        <Droplets className="h-6 w-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs opacity-80 font-normal italic">Fluxo Hidro</span>
                        <span className="text-lg font-bold">{firstName}</span>
                      </div>
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex-1 px-3 py-6 space-y-2">
                    <Button
                      variant={currentView === 'active' ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12 text-base font-medium"
                      onClick={() => {
                        setCurrentView('active');
                        setIsMenuOpen(false);
                      }}
                    >
                      <ClipboardList className="h-5 w-5" />
                      Ordens do Dia
                    </Button>
                    <Button
                      variant={currentView === 'history' ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12 text-base font-medium"
                      onClick={() => {
                        setCurrentView('history');
                        setIsMenuOpen(false);
                      }}
                    >
                      <History className="h-5 w-5" />
                      Histórico
                    </Button>
                    <div className="h-px bg-border my-2" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12 text-base font-medium opacity-50"
                      disabled
                    >
                      <Settings className="h-5 w-5" />
                      Configurações
                    </Button>
                  </div>

                  <div className="p-4 border-t border-border mt-auto mb-6">
                    <Button
                      variant="destructive"
                      className="w-full gap-3 h-12"
                      onClick={signOut}
                    >
                      <LogOut className="h-5 w-5" />
                      Sair da Conta
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex flex-col">
                <span className="text-xs opacity-80 uppercase tracking-tighter font-semibold">Tec. Campo</span>
                <h1 className="text-lg font-bold leading-tight line-clamp-1">{firstName}</h1>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={refetch}
              className="text-primary-foreground hover:bg-white/10"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
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
          <div className="text-center flex-1 text-blue-500">
            <p className="text-2xl font-bold">
              {orders.filter(o => o.status === 'pending').length}
            </p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center flex-1 text-green-500">
            <p className="text-2xl font-bold">
              {orders.filter(o => o.status === 'completed').length}
            </p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
        </div>
      </div>

      {/* Task List */}
      <main className="px-4 py-4 space-y-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          {currentView === 'active' ? (
            <><ClipboardList className="h-5 w-5 text-primary" /> Minhas Tarefas</>
          ) : (
            <><History className="h-5 w-5 text-primary" /> Meu Histórico</>
          )}
        </h2>

        {filteredOrders.map((order) => {
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
                    {order.status === 'completed' || order.status === 'not_executed'
                      ? `Finalizado em: ${order.finished_at ? new Date(order.finished_at).toLocaleString('pt-BR') : '—'}`
                      : order.scheduled_date || 'Sem data programada'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Droplets className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">
              {currentView === 'active' ? 'Nenhuma ordem atribuída' : 'Nenhum histórico encontrado'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {currentView === 'active' ? 'Suas tarefas aparecerão aqui' : 'Ordens finalizadas aparecerão aqui'}
            </p>
          </div>
        )}
      </main>
      <LocationTracker />
    </div>
  );
}
