import { ServiceOrder } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function exportOrdersToCsv(orders: ServiceOrder[]) {
    if (orders.length === 0) return;

    // Fetch photos for all provided orders in one go if possible
    const orderIds = orders.map(o => o.id);
    const { data: allPhotos, error: photoError } = await supabase
        .from('photos')
        .select('service_order_id, url')
        .in('service_order_id', orderIds);

    if (photoError) {
        console.error('Error fetching photos for export:', photoError);
    }

    // Create a map of orderId -> photoUrls[]
    const photoMap: Record<string, string[]> = {};
    (allPhotos || []).forEach(photo => {
        if (!photoMap[photo.service_order_id]) {
            photoMap[photo.service_order_id] = [];
        }
        photoMap[photo.service_order_id].push(photo.url);
    });

    // Define headers
    const headers = [
        'Sequencial/Protocolo',
        'Status',
        'Tipo de Serviço',
        'Endereço',
        'Número',
        'Bairro',
        'Município',
        'Data Programada',
        'Iniciado em',
        'Finalizado em',
        'Tipo de Resolução',
        'Leitura',
        'Número do Lacre',
        'Observações do Técnico',
        'Fotos (URLs)'
    ];

    // Map rows
    const rows = orders.map(order => {
        const osNumber = order.sequencial || order.protocol || order.id;
        const photoUrls = photoMap[order.id]?.join(' ; ') || '';

        return [
            osNumber,
            order.status,
            order.service_type || '',
            order.address || '',
            order.number || '',
            order.neighborhood || '',
            order.municipality || '',
            order.scheduled_date || '',
            order.started_at || '',
            order.finished_at || '',
            order.resolution_type || '',
            order.meter_reading || '',
            order.seal_number || '',
            (order.notes || '').replace(/\n/g, ' '),
            photoUrls
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    // Construct CSV string
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Trigger download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-service-orders-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export async function exportPhotosToZip(importLogId: string, batchLabel: string) {
    try {
        // 1. Fetch all orders for this batch
        const { data: orders, error: ordersError } = await supabase
            .from('service_orders')
            .select('id, sequencial, protocol')
            .eq('import_log_id', importLogId);

        if (ordersError) throw ordersError;
        if (!orders || orders.length === 0) return;

        // 2. Fetch all photos for these orders
        const orderIds = orders.map(o => o.id);
        const { data: photos, error: photosError } = await supabase
            .from('photos')
            .select('service_order_id, url')
            .in('service_order_id', orderIds);

        if (photosError) throw photosError;
        if (!photos || photos.length === 0) {
            throw new Error('Nenhuma foto encontrada para este lote.');
        }

        const zip = new JSZip();
        const folder = zip.folder(batchLabel.replace(/\W+/g, '-'));

        // 3. Download photos and add to ZIP
        const downloadPromises = photos.map(async (photo, index) => {
            const order = orders.find(o => o.id === photo.service_order_id);
            const osNumber = order?.sequencial || order?.protocol || photo.service_order_id;

            try {
                const response = await fetch(photo.url);
                const blob = await response.blob();

                // Use a structure like OS_NUMBER/photo_index.jpg
                const extension = photo.url.split('.').pop()?.split('?')[0] || 'jpg';
                folder?.file(`${osNumber}/foto-${index + 1}.${extension}`, blob);
            } catch (err) {
                console.error(`Failed to download photo ${photo.url}:`, err);
            }
        });

        await Promise.all(downloadPromises);

        // 4. Generate and save ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `fotos-${batchLabel.replace(/\W+/g, '-')}.zip`);

        return { success: true };
    } catch (error: any) {
        console.error('Error exporting photos to ZIP:', error);
        throw error;
    }
}
