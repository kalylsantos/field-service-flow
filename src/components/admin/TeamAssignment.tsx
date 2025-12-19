import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Profile, ServiceOrder } from '@/types';
import { useTechnicians } from '@/hooks/useServiceOrders';
import { useToast } from '@/hooks/use-toast';
import { Users, Route, UserCheck, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface TeamAssignmentProps {
  selectedOrders: string[];
  pendingOrders: ServiceOrder[];
  onAssignmentComplete: () => void;
}

export function TeamAssignment({
  selectedOrders,
  pendingOrders,
  onAssignmentComplete,
}: TeamAssignmentProps) {
  const { technicians, loading: loadingTechnicians } = useTechnicians();
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');
  const [selectedForDistribution, setSelectedForDistribution] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const { toast } = useToast();

  const handleAssign = async () => {
    if (!selectedTechnician || selectedOrders.length === 0) return;

    setAssigning(true);
    try {
      const { error } = await supabase
        .from('service_orders')
        .update({ assigned_to: selectedTechnician })
        .in('id', selectedOrders);

      if (error) throw error;

      toast({
        title: 'Ordens atribuídas!',
        description: `${selectedOrders.length} ordens atribuídas com sucesso.`,
      });
      onAssignmentComplete();
    } catch (error: any) {
      toast({
        title: 'Erro ao atribuir',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleDistribute = async () => {
    if (selectedForDistribution.length === 0 || pendingOrders.length === 0) return;

    setDistributing(true);
    try {
      // Sort orders by latitude (North to South)
      const sortedOrders = [...pendingOrders]
        .filter((o) => o.status === 'pending')
        .sort((a, b) => (b.client_lat || 0) - (a.client_lat || 0));

      const techCount = selectedForDistribution.length;
      const ordersPerTech = Math.ceil(sortedOrders.length / techCount);

      const updates: { id: string; assigned_to: string }[] = [];

      sortedOrders.forEach((order, index) => {
        const techIndex = Math.floor(index / ordersPerTech);
        const techId = selectedForDistribution[Math.min(techIndex, techCount - 1)];
        updates.push({ id: order.id, assigned_to: techId });
      });

      // Update in batches
      for (const update of updates) {
        await supabase
          .from('service_orders')
          .update({ assigned_to: update.assigned_to })
          .eq('id', update.id);
      }

      toast({
        title: 'Rotas distribuídas!',
        description: `${sortedOrders.length} ordens distribuídas entre ${techCount} técnicos.`,
      });
      onAssignmentComplete();
    } catch (error: any) {
      toast({
        title: 'Erro na distribuição',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDistributing(false);
    }
  };

  const toggleTechForDistribution = (techId: string) => {
    setSelectedForDistribution((prev) =>
      prev.includes(techId)
        ? prev.filter((id) => id !== techId)
        : [...prev, techId]
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gestão de Equipe
        </CardTitle>
        <CardDescription>
          Atribua ordens manualmente ou distribua automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Manual Assignment */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Atribuição Manual
          </h4>
          <div className="flex gap-2">
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um técnico" />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.full_name || tech.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedTechnician || selectedOrders.length === 0 || assigning}
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Atribuir (${selectedOrders.length})`
              )}
            </Button>
          </div>
          {selectedOrders.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Selecione ordens na lista para atribuir
            </p>
          )}
        </div>

        {/* Auto Distribution */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Route className="h-4 w-4" />
            Distribuição Inteligente de Rotas
          </h4>
          <p className="text-xs text-muted-foreground">
            Ordena por latitude (Norte → Sul) e divide igualmente entre os técnicos selecionados
          </p>

          <div className="space-y-2">
            {technicians.map((tech) => (
              <div key={tech.id} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedForDistribution.includes(tech.id)}
                  onCheckedChange={() => toggleTechForDistribution(tech.id)}
                />
                <span className="text-sm">{tech.full_name || tech.email}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={handleDistribute}
            variant="outline"
            className="w-full"
            disabled={selectedForDistribution.length === 0 || distributing}
          >
            {distributing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Distribuindo...
              </>
            ) : (
              <>
                <Route className="mr-2 h-4 w-4" />
                Distribuir {pendingOrders.filter((o) => o.status === 'pending').length} Ordens
                Pendentes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
