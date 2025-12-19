import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Profile, ServiceOrder } from '@/types';
import { useTechnicians } from '@/hooks/useServiceOrders';
import { useToast } from '@/hooks/use-toast';
import { Users, Route, UserCheck, Loader2, Rocket, MapPin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { geocodeOrders, GeocodingProgress, hasValidCoordinates } from '@/utils/geocoder';
import { optimizeRoutes, calculateRouteDistance } from '@/utils/routeOptimizer';

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
  const [optimizing, setOptimizing] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState<GeocodingProgress | null>(null);
  const [optimizationStep, setOptimizationStep] = useState<string>('');
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

  const handleSmartDistribute = async () => {
    if (selectedForDistribution.length === 0) {
      toast({
        title: 'Selecione técnicos',
        description: 'Selecione pelo menos um técnico para distribuir as rotas.',
        variant: 'destructive',
      });
      return;
    }

    const pendingOrdersList = pendingOrders.filter((o) => o.status === 'pending');
    
    if (pendingOrdersList.length === 0) {
      toast({
        title: 'Sem ordens pendentes',
        description: 'Não há ordens pendentes para distribuir.',
        variant: 'destructive',
      });
      return;
    }

    setOptimizing(true);
    setOptimizationStep('geocoding');

    try {
      // Step 1: Geocode orders without coordinates
      const ordersNeedingGeocoding = pendingOrdersList.filter(o => !hasValidCoordinates(o));
      
      if (ordersNeedingGeocoding.length > 0) {
        toast({
          title: 'Geocodificando endereços...',
          description: `${ordersNeedingGeocoding.length} endereços precisam de coordenadas.`,
        });

        const geocodeResults = await geocodeOrders(
          ordersNeedingGeocoding,
          (progress) => setGeocodingProgress(progress)
        );

        // Update database with new coordinates
        for (const [orderId, coords] of geocodeResults) {
          await supabase
            .from('service_orders')
            .update({ 
              client_lat: coords.lat, 
              client_long: coords.lon 
            })
            .eq('id', orderId);
        }

        // Update local orders with new coordinates
        for (const order of pendingOrdersList) {
          const coords = geocodeResults.get(order.id);
          if (coords) {
            order.client_lat = coords.lat;
            order.client_long = coords.lon;
          }
        }
      }

      setGeocodingProgress(null);
      setOptimizationStep('optimizing');

      // Step 2: Run route optimization
      const result = optimizeRoutes(pendingOrdersList, selectedForDistribution);

      if (result.totalOptimized === 0) {
        toast({
          title: 'Sem coordenadas válidas',
          description: 'Nenhuma ordem possui coordenadas para otimização. Verifique a geocodificação.',
          variant: 'destructive',
        });
        return;
      }

      setOptimizationStep('assigning');

      // Step 3: Update database with assignments
      for (const route of result.routes) {
        for (const order of route.orders) {
          await supabase
            .from('service_orders')
            .update({ assigned_to: route.technicianId })
            .eq('id', order.id);
        }
      }

      // Build summary message
      const routeSummary = result.routes
        .map((route) => {
          const tech = technicians.find((t) => t.id === route.technicianId);
          const distance = calculateRouteDistance(route.orders);
          return `${tech?.full_name || 'Técnico'}: ${route.orders.length} ordens (~${distance.toFixed(1)}km)`;
        })
        .join('\n');

      toast({
        title: '🚀 Rotas otimizadas!',
        description: `${result.totalOptimized} ordens distribuídas entre ${result.routes.length} técnicos.`,
      });

      if (result.unassignedOrders.length > 0) {
        toast({
          title: 'Aviso',
          description: `${result.unassignedOrders.length} ordens sem coordenadas não foram distribuídas.`,
          variant: 'destructive',
        });
      }

      onAssignmentComplete();
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast({
        title: 'Erro na otimização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setOptimizing(false);
      setOptimizationStep('');
      setGeocodingProgress(null);
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

  const pendingCount = pendingOrders.filter((o) => o.status === 'pending').length;
  const withCoordsCount = pendingOrders.filter(
    (o) => o.status === 'pending' && hasValidCoordinates(o)
  ).length;

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

        {/* Smart Distribution */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Distribuição Inteligente de Rotas
          </h4>
          <p className="text-xs text-muted-foreground">
            Geocodifica endereços, clusteriza por região (Angular Sweep) e otimiza rota (Nearest Neighbor)
          </p>

          {/* Stats */}
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {withCoordsCount}/{pendingCount} com coordenadas
            </span>
          </div>

          <div className="space-y-2">
            {technicians.map((tech) => (
              <div key={tech.id} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedForDistribution.includes(tech.id)}
                  onCheckedChange={() => toggleTechForDistribution(tech.id)}
                  disabled={optimizing}
                />
                <span className="text-sm">{tech.full_name || tech.email}</span>
              </div>
            ))}
          </div>

          {/* Progress indicators */}
          {optimizing && (
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              {geocodingProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Geocodificando...</span>
                    <span>{geocodingProgress.current} de {geocodingProgress.total}</span>
                  </div>
                  <Progress 
                    value={(geocodingProgress.current / geocodingProgress.total) * 100} 
                  />
                  <p className="text-xs text-muted-foreground truncate">
                    {geocodingProgress.currentAddress}
                  </p>
                </div>
              )}
              {optimizationStep === 'optimizing' && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Calculando rotas otimizadas...</span>
                </div>
              )}
              {optimizationStep === 'assigning' && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Atribuindo ordens aos técnicos...</span>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleSmartDistribute}
            className="w-full bg-gradient-to-r from-primary to-primary/80"
            disabled={selectedForDistribution.length === 0 || optimizing || pendingCount === 0}
          >
            {optimizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Calcular e Distribuir Rotas ({pendingCount})
              </>
            )}
          </Button>

          {/* Simple distribution fallback */}
          <Button
            onClick={handleDistribute}
            variant="outline"
            className="w-full"
            disabled={selectedForDistribution.length === 0 || distributing || optimizing}
          >
            {distributing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Distribuindo...
              </>
            ) : (
              <>
                <Route className="mr-2 h-4 w-4" />
                Distribuição Simples (Norte→Sul)
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
