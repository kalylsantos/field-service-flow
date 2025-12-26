import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ImportLog {
  id: string;
  imported_at: string;
  orders_count: number;
  batch_number: number;
  import_date: string;
  label: string;
}

export function useImportLogs() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('imported_at', { ascending: false });

      if (error) throw error;

      const formattedLogs: ImportLog[] = (data || []).map((log) => {
        // Extract date from imported_at timestamp
        const timestamp = new Date(log.imported_at);
        const formattedDate = timestamp.toLocaleDateString('pt-BR');
        const formattedTime = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Extract date portion for import_date field (yyyy-MM-dd format)
        const importDate = log.imported_at.split(' ')[0];

        return {
          ...log,
          import_date: importDate, // Add extracted date
          label: `${formattedDate} ${formattedTime} - Lote ${log.batch_number}`,
        };
      });

      setLogs(formattedLogs);
    } catch (error: any) {
      console.error('Error fetching import logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const deleteOrdersByImportLog = async (importLogId: string) => {
    setDeleting(true);
    try {
      // First delete all orders with this import_log_id
      const { error: ordersError } = await supabase
        .from('service_orders')
        .delete()
        .eq('import_log_id', importLogId);

      if (ordersError) throw ordersError;

      // Then delete the import log
      const { error: logError } = await supabase
        .from('import_logs')
        .delete()
        .eq('id', importLogId);

      if (logError) throw logError;

      toast({
        title: 'Importação removida',
        description: 'Todas as ordens dessa importação foram removidas.',
      });

      await fetchLogs();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting import:', error);
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, error };
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelectedOrders = async (orderIds: string[]) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('service_orders')
        .delete()
        .in('id', orderIds);

      if (error) throw error;

      toast({
        title: 'Ordens removidas',
        description: `${orderIds.length} ordem(ns) removida(s) com sucesso.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting orders:', error);
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, error };
    } finally {
      setDeleting(false);
    }
  };

  return {
    logs,
    loading,
    deleting,
    refetch: fetchLogs,
    deleteOrdersByImportLog,
    deleteSelectedOrders,
  };
}
