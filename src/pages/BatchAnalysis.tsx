import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useImportLogs } from '@/hooks/useImportLogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, LogOut, Download, FileArchive, ArrowLeft } from 'lucide-react';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { exportOrdersToCsv, exportPhotosToZip } from '@/utils/ExportUtils';
import { supabase } from '@/integrations/supabase/client';
import { ServiceOrder } from '@/types';
import { toast } from '@/hooks/use-toast';

export default function BatchAnalysis() {
    const { user, signOut } = useAuth();
    const { logs, loading } = useImportLogs();
    const navigate = useNavigate();

    const handleExportCsv = async (batchId: string) => {
        const { data, error } = await supabase
            .from('service_orders')
            .select('*, profiles:assigned_to(id, email, full_name)')
            .eq('import_log_id', batchId);

        if (error) {
            toast({ title: 'Erro', description: 'Erro ao buscar ordens do lote', variant: 'destructive' });
            return;
        }

        await exportOrdersToCsv(data as ServiceOrder[]);
    };

    const handleExportZip = async (batchId: string, label: string) => {
        try {
            toast({ title: 'Processando...', description: 'Preparando o arquivo ZIP com as fotos.' });
            await exportPhotosToZip(batchId, label);
            toast({ title: 'Sucesso', description: 'O download do ZIP começará em breve.' });
        } catch (error: any) {
            toast({ title: 'Erro', description: error.message || 'Erro ao exportar fotos', variant: 'destructive' });
        }
    };

    if (loading) return <FullPageLoading />;

    return (
        <div className="min-h-screen bg-muted/30 pb-6">
            <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <Droplets className="h-8 w-8" />
                            <div>
                                <h1 className="text-xl font-bold leading-none">Gestão de Campo</h1>
                                <p className="text-xs opacity-80">Painel Administrativo</p>
                            </div>
                        </div>

                        <nav className="hidden md:flex items-center gap-1 bg-white/10 p-1 rounded-lg backdrop-blur-sm">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-white hover:bg-white/20"
                                onClick={() => navigate('/admin')}
                            >
                                Gestão de Campo
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-white hover:bg-white/20 bg-white/20 pointer-events-none"
                            >
                                Análise de Lotes
                            </Button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs opacity-80">Conectado como</p>
                            <p className="text-sm font-medium">{user?.email}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => signOut()}
                            className="text-white hover:bg-white/20"
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <Card className="border-0 shadow-card">
                    <CardHeader>
                        <CardTitle>Histórico de Lotes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                    <tr>
                                        <th className="px-6 py-3 rounded-l-lg">Lote</th>
                                        <th className="px-6 py-3 text-center">Total OS</th>
                                        <th className="px-6 py-3 text-right rounded-r-lg">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{log.label}</td>
                                            <td className="px-6 py-4 text-center">{log.orders_count}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleExportCsv(log.id)}
                                                        className="h-8"
                                                    >
                                                        <Download className="h-3.5 w-3.5 mr-1.5" />
                                                        CSV
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleExportZip(log.id, log.label)}
                                                        className="h-8"
                                                    >
                                                        <FileArchive className="h-3.5 w-3.5 mr-1.5" />
                                                        ZIP Fotos
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                                                Nenhum lote importado ainda.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
