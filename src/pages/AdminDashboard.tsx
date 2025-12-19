import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders, useTechnicians } from '@/hooks/useServiceOrders';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExcelImport } from '@/components/admin/ExcelImport';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { TeamAssignment } from '@/components/admin/TeamAssignment';
import { StatusBadge } from '@/components/StatusBadge';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { UserMenu } from '@/components/UserMenu';
import { Droplets, RefreshCw, Smartphone } from 'lucide-react';
import { ServiceOrderStatus } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { orders, loading, refetch } = useServiceOrders();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const { technicians } = useTechnicians();
  const navigate = useNavigate();

  if (loading) return <FullPageLoading />;

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (techFilter !== 'all' && order.assigned_to !== techFilter) return false;
    return true;
  });

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  const stats = {
    pending: orders.filter((o) => o.status === 'pending').length,
    in_progress: orders.filter((o) => o.status === 'in_progress').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    not_executed: orders.filter((o) => o.status === 'not_executed').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Droplets className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold">Gestão de Campo</h1>
                <p className="text-sm opacity-80">Painel Administrativo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowMobilePreview(true)} className="text-primary-foreground hover:bg-primary-foreground/10">
                <Smartphone className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Simulador Mobile</span>
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats).map(([status, count]) => (
            <div key={status} className="bg-card rounded-lg p-4 shadow-card">
              <StatusBadge status={status as ServiceOrderStatus} />
              <p className="text-3xl font-bold mt-2">{count}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="not_executed">Não Executado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Técnico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Técnicos</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={refetch}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            <OrdersTable orders={filteredOrders} selectedOrders={selectedOrders} onSelectOrder={handleSelectOrder} onSelectAll={handleSelectAll} />
          </div>

          <div className="space-y-6">
            <ExcelImport onImportComplete={refetch} />
            <TeamAssignment selectedOrders={selectedOrders} pendingOrders={orders} onAssignmentComplete={() => { setSelectedOrders([]); refetch(); }} />
          </div>
        </div>
      </main>

      <Dialog open={showMobilePreview} onOpenChange={setShowMobilePreview}>
        <DialogContent className="max-w-sm h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b"><DialogTitle>Simulador Mobile</DialogTitle></DialogHeader>
          <iframe src="/technician" className="w-full h-full border-0" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
