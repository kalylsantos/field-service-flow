import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceOrder, ServiceOrderStatus, Profile } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useServiceOrders(assignedToId?: string) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_orders')
        .select(`
          *,
          profiles:assigned_to(id, email, full_name)
        `)
        .order('scheduled_date', { ascending: true });

      if (assignedToId) {
        query = query.eq('assigned_to', assignedToId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setOrders((data || []) as ServiceOrder[]);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Erro ao carregar ordens',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('service_orders_list_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_orders'
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignedToId]);

  return { orders, loading, refetch: fetchOrders };
}

export function useServiceOrder(orderId: string) {
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; taken_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          *,
          profiles:assigned_to(id, email, full_name)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      setOrder(data as ServiceOrder | null);

      // Fetch photos
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('id, url, taken_at')
        .eq('service_order_id', orderId)
        .order('taken_at', { ascending: false });

      if (photosError) throw photosError;
      setPhotos(photosData || []);
    } catch (error: any) {
      console.error('Error fetching order:', error);
      toast({
        title: 'Erro ao carregar ordem',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();

      const channel = supabase
        .channel(`service_order_${orderId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'service_orders',
            filter: `id=eq.${orderId}`
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setOrder((prev) => prev ? { ...prev, ...payload.new as any } : null);
            } else {
              fetchOrder();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [orderId]);

  const updateOrder = async (updates: Partial<ServiceOrder>) => {
    try {
      const { error } = await supabase
        .from('service_orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;

      setOrder((prev) => prev ? { ...prev, ...updates } : null);
      return { success: true };
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: 'Erro ao atualizar ordem',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  const startOrder = async () => {
    return updateOrder({
      status: 'in_progress' as ServiceOrderStatus,
      started_at: new Date().toISOString(),
    });
  };

  const finishOrder = async (data: {
    resolution_type: string;
    meter_reading?: string;
    seal_number?: string;
    notes?: string;
  }) => {
    const isExecuted = data.resolution_type.startsWith('Executado');
    const status: ServiceOrderStatus = isExecuted ? 'completed' : 'not_executed';

    return updateOrder({
      status,
      finished_at: new Date().toISOString(),
      resolution_type: data.resolution_type,
      meter_reading: data.meter_reading || null,
      seal_number: data.seal_number || null,
      notes: data.notes || null,
    });
  };

  const addPhoto = async (file: File, gpsLat?: number, gpsLong?: number) => {
    try {
      const fileName = `${orderId}/${Date.now()}-${file.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('service-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('service-photos')
        .getPublicUrl(fileName);

      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert({
          service_order_id: orderId,
          url: urlData.publicUrl,
          gps_lat: gpsLat || null,
          gps_long: gpsLong || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setPhotos((prev) => [photoData, ...prev]);
      return { success: true, photo: photoData };
    } catch (error: any) {
      console.error('Error adding photo:', error);
      toast({
        title: 'Erro ao adicionar foto',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, error };
    }
  };

  return { order, photos, loading, refetch: fetchOrder, updateOrder, startOrder, finishOrder, addPhoto };
}

export function useTechnicians() {
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        // First get all technician user_ids
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'technician');

        if (rolesError) throw rolesError;

        const technicianIds = (rolesData || []).map((r) => r.user_id);

        if (technicianIds.length === 0) {
          setTechnicians([]);
          setLoading(false);
          return;
        }

        // Then fetch profiles for those user_ids
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', technicianIds);

        if (profilesError) throw profilesError;

        setTechnicians((profilesData || []) as Profile[]);
      } catch (error: any) {
        console.error('Error fetching technicians:', error);
        toast({
          title: 'Erro ao carregar técnicos',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTechnicians();
  }, []);

  return { technicians, loading };
}
