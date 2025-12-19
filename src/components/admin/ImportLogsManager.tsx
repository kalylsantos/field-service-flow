import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useImportLogs } from '@/hooks/useImportLogs';
import { Trash2, History, Loader2 } from 'lucide-react';

interface ImportLogsManagerProps {
  selectedOrders: string[];
  onDeleteComplete: () => void;
}

export function ImportLogsManager({ selectedOrders, onDeleteComplete }: ImportLogsManagerProps) {
  const { logs, loading, deleting, deleteOrdersByImportLog, deleteSelectedOrders } = useImportLogs();
  const [selectedLogId, setSelectedLogId] = useState<string>('');

  const handleDeleteByLog = async () => {
    if (!selectedLogId) return;
    const result = await deleteOrdersByImportLog(selectedLogId);
    if (result.success) {
      setSelectedLogId('');
      onDeleteComplete();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedOrders.length === 0) return;
    const result = await deleteSelectedOrders(selectedOrders);
    if (result.success) {
      onDeleteComplete();
    }
  };

  const selectedLog = logs.find((l) => l.id === selectedLogId);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Gerenciar Importações
        </CardTitle>
        <CardDescription>
          Remova ordens por lote de importação ou individualmente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delete selected orders */}
        {selectedOrders.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover {selectedOrders.length} Selecionada(s)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
                <AlertDialogDescription>
                  Você está prestes a remover {selectedOrders.length} ordem(ns) de serviço. 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Delete by import batch */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Remover por Lote de Importação</label>
          <Select value={selectedLogId} onValueChange={setSelectedLogId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um lote..." />
            </SelectTrigger>
            <SelectContent>
              {logs.map((log) => (
                <SelectItem key={log.id} value={log.id}>
                  {log.label} ({log.orders_count} ordens)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedLogId && selectedLog && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover Lote: {selectedLog.label}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar remoção do lote</AlertDialogTitle>
                <AlertDialogDescription>
                  Você está prestes a remover todas as {selectedLog.orders_count} ordens do lote "{selectedLog.label}". 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteByLog} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Remover Lote
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {logs.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma importação registrada ainda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
