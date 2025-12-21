import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders, useTechnicians } from '@/hooks/useServiceOrders';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExcelImport } from '@/components/admin/ExcelImport';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { TeamAssignment } from '@/components/admin/TeamAssignment';
import { ImportLogsManager } from '@/components/admin/ImportLogsManager';
import { AdminMap } from '@/components/admin/AdminMap';
import { StatusBadge } from '@/components/StatusBadge';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { UserMenu } from '@/components/UserMenu';
import { Droplets, RefreshCw, Smartphone, LogOut } from 'lucide-react';
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
    <div className="min-h-screen bg-muted/30 pb-6">
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="px-4 py-5 safe-area-inset">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Droplets className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold">Gestão de Campo</h1>
                <p className="text-sm opacity-80">Painel Administrativo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <UserMenu />
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
            <p className="text-2xl font-bold text-blue-500">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-yellow-500">{stats.in_progress}</p>
            <p className="text-xs text-muted-foreground">Andamento</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="mt-2 mb-6">
          <AdminMap />
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
            <ImportLogsManager selectedOrders={selectedOrders} onDeleteComplete={() => { setSelectedOrders([]); refetch(); }} />
            <TeamAssignment selectedOrders={selectedOrders} pendingOrders={orders} onAssignmentComplete={() => { setSelectedOrders([]); refetch(); }} />
          </div>
        </div>
      </main>

      <Dialog open={showMobilePreview} onOpenChange={setShowMobilePreview}>
        <DialogContent
          className="p-0 overflow-hidden border-2 border-border/50 bg-background max-w-none w-auto"
          style={{
            height: '85vh',
            aspectRatio: '1080/2340'
          }}
        >
          <DialogHeader className="px-4 py-3 border-b bg-muted/30">
            <DialogTitle className="text-sm font-mono text-muted-foreground flex justify-between items-center">
              <span>Simulador Mobile</span>
              <span className="text-xs bg-background border px-2 py-0.5 rounded">1080 x 2340</span>
            </DialogTitle>
          </DialogHeader>
          <iframe src="/technician" className="w-full h-full border-0 bg-background" />
        </DialogContent>
      </Dialog>
    </div >
  );
}
