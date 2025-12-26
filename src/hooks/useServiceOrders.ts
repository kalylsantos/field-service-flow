import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceOrder, ServiceOrderStatus, Profile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { addWatermarkToImage } from '@/lib/imageUtils';
import { savePhotoToFilesystem, saveOfflineTask, getOfflineTasks, removeOfflineTask } from '@/lib/offlineStorage';

export function useServiceOrders(assignedToId?: string, options?: {
  page?: number;
  pageSize?: number;
  filters?: {
    status?: string;
    techId?: string;
    date?: string;
    batchId?: string;
  }
}) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // When filtering by date, we need to filter by import_date from import_logs
      // So we need to get the import_log_ids first, then filter orders
      let importLogIds: string[] | null = null;

      if (options?.filters?.date && !assignedToId) {
        // Fetch import_log_ids for the selected date
        const { data: logsData, error: logsError } = await supabase
          .from('import_logs')
          .select('id, imported_at')
          .gte('imported_at', `${options.filters.date} 00:00:00+00`)
          .lt('imported_at', `${options.filters.date} 23:59:59+00`);

        if (logsError) throw logsError;
        importLogIds = logsData?.map(log => log.id) || [];


        console.log('🗓️ Filtering by imported_at date:', options.filters.date);
        console.log('📦 Found import_log_ids:', importLogIds);
        if (logsData && logsData.length > 0) {
          console.log('⏰ Import timestamps:', logsData.map(l => ({ id: l.id, imported_at: l.imported_at })));
        }

        // If no logs found for this date, return empty results
        if (importLogIds.length === 0) {
          setOrders([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('service_orders')
        .select(`
          id, sequencial, protocol, service_type, address, number, neighborhood, 
          municipality, status, assigned_to, scheduled_date, finished_at, 
          created_at, updated_at, import_log_id,
          profiles:assigned_to(id, email, full_name)
        `, { count: 'exact' });

      if (assignedToId) {
        query = query.eq('assigned_to', assignedToId);
      }

      // Apply Filters
      if (options?.filters) {
        const { status, techId, batchId } = options.filters;
        if (status && status !== 'all') query = query.eq('status', status as any);
        if (techId && techId !== 'all') query = query.eq('assigned_to', techId);

        // If we have import_log_ids from date filter, use them
        if (importLogIds && importLogIds.length > 0) {
          console.log('🔧 Applying filter: import_log_id IN', importLogIds);
          query = query.in('import_log_id', importLogIds);
        }

        if (batchId && batchId !== 'all') {
          console.log('🔧 Applying filter: import_log_id =', batchId);
          query = query.eq('import_log_id', batchId);
        }
      }

      query = query.order('scheduled_date', { ascending: true });

      if (options?.page !== undefined && options?.pageSize !== undefined) {
        const from = options.page * options.pageSize;
        const to = from + options.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      console.log('📊 Orders found:', data?.length, '| Total count:', count);
      if (data && data.length > 0) {
        console.log('📋 Sample orders:', data.slice(0, 3).map((o: any) => ({ id: o.id, import_log_id: o.import_log_id })));
      } else if (data && data.length === 0 && importLogIds && importLogIds.length > 0) {
        console.warn('⚠️ No orders found with import_log_id IN', importLogIds);
        console.warn('⚠️ This might mean orders were not properly linked during import');
      }

      setOrders((data || []) as ServiceOrder[]);
      if (count !== null) setTotalCount(count);
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
    syncOfflineData(); // Check for offline data to sync

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
  }, [
    assignedToId,
    options?.page,
    options?.pageSize,
    options?.filters?.status,
    options?.filters?.techId,
    options?.filters?.date,
    options?.filters?.batchId
  ]);

  const syncOfflineData = async () => {
    const tasks = getOfflineTasks();
    if (tasks.length === 0) return;

    console.log(`Found ${tasks.length} offline tasks to sync`);

    for (const task of tasks) {
      try {
        const { error } = await supabase
          .from('service_orders')
          .update(task.data)
          .eq('id', task.orderId);

        if (!error) {
          removeOfflineTask(task.orderId);
          console.log(`Task ${task.orderId} synced successfully`);
        }
      } catch (err) {
        console.error(`Failed to sync task ${task.orderId}:`, err);
      }
    }

    if (tasks.length > 0) {
      toast({ title: 'Sincronização concluída', description: 'Dados offline foram enviados.' });
      fetchOrders();
    }
  };

  return { orders, loading, totalCount, refetch: fetchOrders, syncOfflineData };
}

export function useOrdersDates() {
  const [dates, setDates] = useState<string[]>([]);
  const [dateBatchCounts, setDateBatchCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDates = async () => {
      try {
        // Fetch imported_at from import_logs and extract unique dates
        const { data, error } = await supabase
          .from('import_logs')
          .select('imported_at')
          .not('imported_at', 'is', null);

        if (error) throw error;

        // Extract date portion and count batches per date
        const datesList = data.map(d => d.imported_at.split('T')[0]);
        const uniqueDates = Array.from(new Set(datesList));

        // Count how many batches per date
        const counts: Record<string, number> = {};
        datesList.forEach(date => {
          counts[date] = (counts[date] || 0) + 1;
        });

        setDates(uniqueDates as string[]);
        setDateBatchCounts(counts);

        console.log('📅 Available import dates:', uniqueDates);
        console.log('📦 Batch counts per date:', counts);
      } catch (error) {
        console.error('Error fetching order dates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDates();
  }, []);

  return { dates, dateBatchCounts, loading };
}

export function useServiceOrder(orderId: string) {
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; taken_at: string; is_local?: boolean; local_uri?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          id, sequencial, protocol, service_type, address, number, neighborhood, 
          municipality, status, assigned_to, scheduled_date, finished_at, 
          meter_reading, seal_number, resolution_type, notes, enrollment_id, 
          meter_number, client_lat, client_long,
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
    const finished_at = new Date().toISOString();

    const updates = {
      status,
      finished_at,
      resolution_type: data.resolution_type,
      meter_reading: data.meter_reading || null,
      seal_number: data.seal_number || null,
      notes: data.notes || null,
    };

    // Attempt to update online first
    const result = await updateOrder(updates);

    if (!result.success) {
      // If offline or error, save locally
      saveOfflineTask({
        orderId,
        data: updates,
        status: 'pending',
        timestamp: finished_at,
      });
      toast({
        title: 'Modo Offline',
        description: 'Ordem salva localmente e será sincronizada quando houver conexão.',
      });
      return { success: true, offline: true };
    }

    return result;
  };

  const addPhoto = async (file: File, gpsLat?: number, gpsLong?: number) => {
    try {
      if (!order) throw new Error('Order not loaded');

      // 1. Add Watermark
      const now = new Date();
      const watermarkedBlob = await addWatermarkToImage(file, {
        orderNumber: order.sequencial || order.id.slice(0, 8),
        date: now.toLocaleDateString('pt-BR'),
        time: now.toLocaleTimeString('pt-BR'),
        gps: gpsLat && gpsLong ? { lat: gpsLat, lng: gpsLong } : undefined,
      });

      const watermarkedFile = new File([watermarkedBlob], file.name, { type: 'image/jpeg' });
      const photoCount = photos.length + 1;
      const fileName = `${order.sequencial || order.id.slice(0, 8)} (${photoCount}).jpg`;

      // 2. Save locally first (Capacitor Filesystem)
      const localUri = await savePhotoToFilesystem(
        order.sequencial || order.id.slice(0, 8),
        fileName,
        watermarkedBlob
      );

      // 3. Attempt upload to Supabase
      const storagePath = `${orderId}/${Date.now()}-${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('service-photos')
        .upload(storagePath, watermarkedFile);

      if (uploadError) {
        console.warn('Upload failed, photo saved locally:', uploadError);
        // Add to local photos state so user sees it
        const localPhoto = {
          id: `local-${Date.now()}`,
          url: URL.createObjectURL(watermarkedBlob),
          taken_at: now.toISOString(),
          is_local: true,
          local_uri: localUri
        };
        setPhotos((prev) => [localPhoto as any, ...prev]);

        toast({
          title: 'Foto salva localmente',
          description: 'A foto será enviada quando você estiver online.',
        });
        return { success: true, offline: true };
      }

      const { data: urlData } = supabase.storage
        .from('service-photos')
        .getPublicUrl(storagePath);

      const { data: photoData, error: insertError } = await supabase
        .from('photos')
        .insert({
          service_order_id: orderId,
          url: urlData.publicUrl,
          gps_lat: gpsLat || null,
          gps_long: gpsLong || null,
          taken_at: now.toISOString(),
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
