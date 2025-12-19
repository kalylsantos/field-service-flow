import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { FullPageLoading } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { RESOLUTION_TYPES } from '@/types';
import { ArrowLeft, MapPin, Navigation, Camera, FileText, Loader2, Play, Check, X } from 'lucide-react';

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
  if (!order) return <div className="p-4 text-center">Ordem não encontrada</div>;

  const isExecuted = resolutionType.startsWith('Executado');
  const canFinish = resolutionType && (!isExecuted || (meterReading && sealNumber && photos.length > 0));

  const handleStart = async () => {
    const result = await startOrder();
    if (result.success) toast({ title: 'Serviço iniciado!' });
  };

  const handleFinish = async () => {
    if (!canFinish) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha leitura, lacre e tire pelo menos 1 foto.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const result = await finishOrder({ resolution_type: resolutionType, meter_reading: meterReading, seal_number: sealNumber, notes });
    if (result.success) { toast({ title: 'Ordem finalizada!' }); navigate('/technician'); }
    setSubmitting(false);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addPhoto(file);
  };

  const openGPS = () => {
    if (order.client_lat && order.client_long) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.client_lat},${order.client_long}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="gradient-hero text-primary-foreground sticky top-0 z-50 px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/technician')} className="text-primary-foreground"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1"><span className="font-mono font-bold">{order.sequencial || order.id}</span></div>
          <StatusBadge status={order.status} />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        <div className="bg-card rounded-xl p-4 shadow-card space-y-3">
          <div className="flex items-start gap-2"><MapPin className="h-5 w-5 text-primary mt-0.5" /><div><p className="font-medium">{order.address}, {order.number}</p><p className="text-sm text-muted-foreground">{order.neighborhood} - {order.municipality}</p></div></div>
          {order.client_lat && order.client_long && (
            <Button onClick={openGPS} className="w-full" variant="outline"><Navigation className="mr-2 h-4 w-4" />Abrir no GPS</Button>
          )}
        </div>

        {order.status === 'pending' && (
          <Button onClick={handleStart} className="mobile-action-button gradient-primary text-primary-foreground"><Play className="mr-2 h-5 w-5" />INICIAR SERVIÇO</Button>
        )}

        {order.status === 'in_progress' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Baixa *</Label>
              <Select value={resolutionType} onValueChange={setResolutionType}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{RESOLUTION_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {isExecuted && (
              <>
                <div className="space-y-2"><Label>Leitura do Hidrômetro *</Label><Input value={meterReading} onChange={(e) => setMeterReading(e.target.value)} placeholder="Ex: 12345" /></div>
                <div className="space-y-2"><Label>Número do Lacre *</Label><Input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} placeholder="Ex: ABC123" /></div>
              </>
            )}

            <div className="space-y-2">
              <Label>Fotos {isExecuted && '*'}</Label>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full"><Camera className="mr-2 h-4 w-4" />Tirar Foto</Button>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">{photos.map((p) => <img key={p.id} src={p.url} alt="" className="rounded-lg aspect-square object-cover" />)}</div>
              )}
            </div>

            <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
              <DialogTrigger asChild><Button variant="outline" className="w-full"><FileText className="mr-2 h-4 w-4" />Anotações</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Anotações</DialogTitle></DialogHeader><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Observações..." /><Button onClick={() => setShowNotesDialog(false)}>Salvar</Button></DialogContent>
            </Dialog>

            <Button onClick={handleFinish} disabled={!canFinish || submitting} className="mobile-action-button bg-status-completed text-primary-foreground">
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}FINALIZAR
            </Button>
          </div>
        )}

        {(order.status === 'completed' || order.status === 'not_executed') && (
          <div className="bg-muted rounded-xl p-4 text-center"><p className="font-medium">Ordem já finalizada</p><p className="text-sm text-muted-foreground">{order.resolution_type}</p></div>
        )}
      </main>
    </div>
  );
}
