import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders, useTechnicians, useOrdersDates } from '@/hooks/useServiceOrders';
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
import { Droplets, RefreshCw, Smartphone, LogOut, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { ServiceOrderStatus } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { exportOrdersToCsv } from '@/utils/ExportUtils';
import { useImportLogs } from '@/hooks/useImportLogs';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [techFilter, setTechFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(new Date());
  const [showAllDates, setShowAllDates] = useState(false);
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const dateFilterString = showAllDates ? undefined : (dateFilter ? format(dateFilter, 'yyyy-MM-dd') : undefined);

  const { orders, loading, totalCount, refetch } = useServiceOrders(undefined, {
    page: currentPage,
    pageSize,
    filters: {
      status: statusFilter,
      techId: techFilter,
      date: dateFilterString,
      batchId: batchFilter
    }
  });

  // Debug logging
  useEffect(() => {
    console.log('🔍 Date filter:', dateFilterString);
    console.log('📊 Orders returned:', orders.length, '| Total count:', totalCount);
    if (orders.length > 0) {
      console.log('📅 Sample order import_log_id:', orders[0]?.import_log_id);
    }
  }, [dateFilterString, orders, totalCount]);

  const { technicians } = useTechnicians();
  const { logs: importLogs } = useImportLogs();
  const { dates: orderDates, dateBatchCounts } = useOrdersDates();
  const navigate = useNavigate();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter, techFilter, dateFilter, showAllDates, batchFilter]);

  if (loading) return <FullPageLoading />;

  // Filter batches based on selected date
  const filteredImportLogs = importLogs.filter(log => {
    if (showAllDates || !dateFilter) return true;
    const selectedDate = format(dateFilter, 'yyyy-MM-dd');
    return log.import_date === selectedDate;
  });

  const filteredOrders = orders; // Now filtered by the hook

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleExport = async () => {
    await exportOrdersToCsv(filteredOrders);
  };

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
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <Droplets className="h-8 w-8" />
                <div>
                  <h1 className="text-xl font-bold">Gestão de Campo</h1>
                  <p className="text-sm opacity-80">Painel Administrativo</p>
                </div>
              </div>

              <nav className="hidden md:flex items-center gap-1 bg-white/10 p-1 rounded-lg backdrop-blur-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 bg-white/20 pointer-events-none"
                >
                  Gestão de Campo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                  onClick={() => navigate('/admin/batches')}
                >
                  Análise de Lotes
                </Button>
              </nav>
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
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total Geral</p>
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
            <div className="flex gap-4 flex-wrap items-center">
              <div className="flex items-center gap-2 bg-background border rounded-md px-3 h-10">
                <Checkbox
                  id="all-dates"
                  checked={showAllDates}
                  onCheckedChange={(checked) => setShowAllDates(!!checked)}
                />
                <label htmlFor="all-dates" className="text-sm font-medium whitespace-nowrap cursor-pointer">
                  Todos os dias
                </label>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !dateFilter && "text-muted-foreground",
                      showAllDates && "opacity-50 pointer-events-none"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                    locale={ptBR}
                    modifiers={{
                      hasOrder: (date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        return orderDates.includes(dateStr);
                      },
                      multipleBatches: (date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        return (dateBatchCounts[dateStr] || 0) > 1;
                      }
                    }}
                    modifiersStyles={{
                      hasOrder: {
                        border: '1px solid #fdba74', // Lighter orange, thinner border
                        borderRadius: '4px',
                      },
                      multipleBatches: {
                        border: '1px solid #fdba74',
                        borderRadius: '4px',
                        fontWeight: 'bold' // Bold only for multiple batches
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Lotes</SelectItem>
                  {filteredImportLogs.map((log) => (
                    <SelectItem key={log.id} value={log.id}>{log.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

              <Button variant="outline" size="icon" onClick={refetch} title="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button variant="premium" onClick={handleExport} className="ml-auto">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>

            <OrdersTable orders={filteredOrders} selectedOrders={selectedOrders} onSelectOrder={handleSelectOrder} onSelectAll={handleSelectAll} />

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <p className="text-sm text-muted-foreground">
                  Página <span className="font-medium">{currentPage + 1}</span> de <span className="font-medium">{totalPages}</span>
                  <span className="ml-2">({totalCount} ordens no total)</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    Próxima <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
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
