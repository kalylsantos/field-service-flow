import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { RESOLUTION_TYPES, ServiceOrderStatus } from '@/types';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Camera,
  FileText,
  Loader2,
  Play,
  Check,
  Droplets,
  Hash,
  Calendar,
  X,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OrderExecution() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { order, photos, loading, startOrder, finishOrder, addPhoto } = useServiceOrder(orderId || '');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resolutionType, setResolutionType] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  if (loading) return <FullPageLoading />;
  if (!order) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="font-medium">Ordem não encontrada</p>
            <Button onClick={() => navigate('/technician')} className="mt-4">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExecuted = resolutionType.startsWith('Executado');
  const isImpedido = resolutionType.includes('Impedido') ||
    resolutionType.includes('Não Localizado') ||
    resolutionType.includes('Precisa') ||
    resolutionType.includes('Escavação feita');

  const canFinish = (() => {
    if (!resolutionType) return false;
    if (isExecuted) return meterReading && photos.length > 0;
    if (isImpedido) return notes.trim().length > 0;
    return true;
  })();

  const handleStart = async () => {
    const result = await startOrder();
    if (result.success) {
      toast({ title: 'Serviço iniciado!', description: 'Boa sorte na execução.' });
    }
  };

  const handleFinish = async () => {
    if (!canFinish) {
      if (isExecuted && !meterReading) {
        toast({ title: 'Leitura obrigatória', description: 'Informe a leitura do hidrômetro.', variant: 'destructive' });
        return;
      }
      if (isExecuted && photos.length === 0) {
        toast({ title: 'Foto obrigatória', description: 'Tire pelo menos 1 foto do serviço.', variant: 'destructive' });
        return;
      }
      if (isImpedido && !notes.trim()) {
        toast({ title: 'Observação obrigatória', description: 'Descreva o motivo do impedimento.', variant: 'destructive' });
        return;
      }
      return;
    }

    setSubmitting(true);
    const result = await finishOrder({
      resolution_type: resolutionType,
      meter_reading: meterReading || null,
      seal_number: sealNumber || null,
      notes: notes || null,
    });

    if (result.success) {
      toast({ title: 'Ordem finalizada!', description: 'Dados salvos com sucesso.' });
      navigate('/technician');
    }
    setSubmitting(false);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    toast({ title: 'Processando foto...', description: 'Adicionando marca d\'água...' });

    try {
      // Get current GPS location for watermarking
      let lat: number | undefined;
      let lng: number | undefined;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (err) {
        console.warn('Could not get GPS for photo:', err);
      }

      await addPhoto(file, lat, lng);
      toast({ title: 'Foto adicionada!' });
    } catch (error: any) {
      console.error('Photo capture error:', error);
      toast({ title: 'Erro ao salvar foto', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openGPS = () => {
    const destination = order.client_lat && order.client_long
      ? `${order.client_lat},${order.client_long}`
      : `${order.address}, ${order.number}, ${order.neighborhood}, ${order.municipality}`;

    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank');
  };

  const getStatusConfig = (status: ServiceOrderStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pendente', className: 'bg-blue-500 text-white' };
      case 'in_progress':
        return { label: 'Em Andamento', className: 'bg-yellow-500 text-white' };
      case 'completed':
        return { label: 'Concluído', className: 'bg-green-500 text-white' };
      case 'not_executed':
        return { label: 'Não Executado', className: 'bg-red-500 text-white' };
      default:
        return { label: status, className: 'bg-muted text-muted-foreground' };
    }
  };

  const statusConfig = getStatusConfig(order.status);

  return (
    <div className="min-h-screen bg-muted/30 pb-8">
      {/* Header */}
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="px-4 py-4 safe-area-inset">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/technician')}
              className="text-primary-foreground hover:bg-white/10 -ml-2"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="flex-1">
              <p className="text-xs opacity-80">Ordem de Serviço</p>
              <span className="font-mono text-xl font-bold">
                #{order.sequencial || order.id.slice(0, 8)}
              </span>
            </div>
            <Badge className={cn('text-xs font-medium px-3 py-1', statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Validation Block - Most Important */}
        <Card className="border-0 shadow-elevated overflow-hidden">
          <div className="bg-primary/5 px-4 py-2 border-b border-primary/10">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              Dados de Conferência
            </p>
          </div>
          <CardContent className="p-4 space-y-4">
            {/* Address */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {order.address}, {order.number}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.neighborhood} - {order.municipality}
                </p>
              </div>
            </div>

            {/* Enrollment & Meter - Critical for validation */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Matrícula</span>
                </div>
                <p className="font-mono font-bold text-foreground text-lg">
                  {order.enrollment_id || '—'}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Hidrômetro</span>
                </div>
                <p className="font-mono font-bold text-foreground text-lg">
                  {order.meter_number || '—'}
                </p>
              </div>
            </div>

            {/* GPS Button */}
            <Button
              onClick={openGPS}
              variant="outline"
              className="w-full h-14 text-base font-medium border-2"
            >
              <Navigation className="mr-2 h-5 w-5" />
              🗺️ Abrir no Maps/Waze
            </Button>
          </CardContent>
        </Card>

        {/* Status Block - Pending */}
        {order.status === 'pending' && (
          <Button
            onClick={handleStart}
            className="mobile-action-button bg-green-600 hover:bg-green-700 text-white shadow-lg"
          >
            <Play className="mr-3 h-6 w-6" />
            INICIAR SERVIÇO
          </Button>
        )}

        {/* Status Block - Completed */}
        {(order.status === 'completed' || order.status === 'not_executed') && (
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <div className="text-center py-4">
                <div className="p-3 bg-green-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-semibold text-lg text-foreground">Ordem Finalizada</p>
                <p className="text-sm text-muted-foreground mt-1">{order.resolution_type}</p>
                {order.finished_at && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">
                      {new Date(order.finished_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                {order.meter_reading && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Leitura: {order.meter_reading} m³
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Execution Block - In Progress */}
        {order.status === 'in_progress' && (
          <div className="space-y-4">
            {/* Resolution Type */}
            <Card className="border-0 shadow-card">
              <CardContent className="p-4">
                <Label className="text-sm font-semibold mb-3 block">
                  Tipo de Baixa <span className="text-destructive">*</span>
                </Label>
                <Select value={resolutionType} onValueChange={setResolutionType}>
                  <SelectTrigger className="h-14 text-base">
                    <SelectValue placeholder="Selecione o resultado..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {RESOLUTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="py-3">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Technical Inputs - Only if Executed */}
            {isExecuted && (
              <Card className="border-0 shadow-card">
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">
                      Leitura do Hidrômetro (m³) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={meterReading}
                      onChange={(e) => setMeterReading(e.target.value)}
                      placeholder="Ex: 12345"
                      className="h-14 text-lg font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">
                      Número do Lacre
                    </Label>
                    <Input
                      value={sealNumber}
                      onChange={(e) => setSealNumber(e.target.value)}
                      placeholder="Ex: ABC123"
                      className="h-14 text-lg font-mono"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Photo Evidence */}
            <Card className="border-0 shadow-card">
              <CardContent className="p-4">
                <Label className="text-sm font-semibold mb-3 block">
                  Evidências {isExecuted && <span className="text-destructive">*</span>}
                </Label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-14 text-base font-medium border-2 border-dashed"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  📷 Adicionar Foto
                </Button>

                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {photos.map((p: any) => (
                      <div key={p.id} className="relative aspect-square">
                        <img
                          src={p.url}
                          alt="Evidência"
                          className={cn(
                            "w-full h-full object-cover rounded-lg",
                            p.is_local && "opacity-70 border-2 border-yellow-500"
                          )}
                        />
                        {p.is_local && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Badge variant="secondary" className="bg-yellow-500/80 text-white text-[10px] px-1">
                              Pendente Sync
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes Dialog */}
            <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-14 text-base font-medium border-2",
                    isImpedido && !notes.trim() && "border-destructive text-destructive"
                  )}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  📝 {notes ? 'Editar Observação' : 'Adicionar Observação'}
                  {isImpedido && <span className="ml-1 text-destructive">*</span>}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Observações</DialogTitle>
                </DialogHeader>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  placeholder="Descreva detalhes importantes, impedimentos ou observações..."
                  className="text-base"
                />
                <DialogFooter>
                  <Button onClick={() => setShowNotesDialog(false)} className="w-full">
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Finish Button */}
            <Button
              onClick={handleFinish}
              disabled={!canFinish || submitting}
              className={cn(
                "mobile-action-button shadow-lg",
                canFinish
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {submitting ? (
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              ) : (
                <Check className="mr-3 h-6 w-6" />
              )}
              FINALIZAR OS
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
