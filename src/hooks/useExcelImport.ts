import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { ExcelRow } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useExcelImport() {
  const [importing, setImporting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [parsedData, setParsedData] = useState<ExcelRow[]>([]);
  const { toast } = useToast();

  const parseExcel = useCallback(async (file: File): Promise<ExcelRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

          setParsedData(jsonData);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  }, []);

  const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'FieldServiceApp/1.0',
          },
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Helper to normalize row data from different column formats
  const normalizeRow = (row: ExcelRow) => {
    return {
      sequencial: row.Sequencial || row.SEQUENCIAL || null,
      protocol: row.PROTOCOLO || null,
      service_type: row.Serviço || row['Descrição Serviço'] || row.SERVICO || null,
      address: row.Endereço || row.ENDERECO || null,
      number: row.Número || row.NUMERO || null,
      neighborhood: row.Bairro || row.BAIRRO || null,
      municipality: row.Município || row.MUNICIPIO || null,
      scheduled_date: row['Data Programada'] || row.DATA || null,
      latitude: row.Latitude || row.LATITUDE || null,
      longitude: row.Longitude || row.LONGITUDE || null,
      enrollment_id: row.Matrícula || null,
      meter_number: row.Hidrômetro || row['HD Vinculado'] || null,
    };
  };

  const geocodeData = async (data: ExcelRow[]): Promise<ExcelRow[]> => {
    setGeocoding(true);
    const updatedData: ExcelRow[] = [];

    for (const row of data) {
      const normalized = normalizeRow(row);

      if (normalized.latitude && normalized.longitude) {
        updatedData.push(row);
        continue;
      }

      const fullAddress = `${normalized.address}, ${normalized.number}, ${normalized.neighborhood}, ${normalized.municipality}, Brasil`;
      const coords = await geocodeAddress(fullAddress);

      if (coords) {
        updatedData.push({
          ...row,
          Latitude: coords.lat,
          Longitude: coords.lon,
        });
      } else {
        updatedData.push(row);
      }

      // Rate limiting for Nominatim
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    setParsedData(updatedData);
    setGeocoding(false);
    return updatedData;
  };

  const importToDatabase = async (data: ExcelRow[], customDate?: string) => {
    setImporting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Use custom date if provided (for testing), otherwise use current date
      const importTimestamp = customDate
        ? new Date(customDate).toISOString()
        : new Date().toISOString();

      // Get next batch number for today
      // Get next batch number for the import date
      const today = importTimestamp.split('T')[0];
      const { data: batchData } = await supabase.rpc('get_next_batch_number', { p_date: today });
      const batchNumber = batchData || 1;

      // Create import log entry with custom or current timestamp
      const { data: importLog, error: logError } = await supabase
        .from('import_logs')
        .insert({
          imported_by: user?.id,
          imported_at: importTimestamp, // Timestamp with time
          import_date: today, // Date only (yyyy-MM-dd)
          orders_count: data.length,
          batch_number: batchNumber,
        })
        .select()
        .single();

      if (logError) throw logError;

      const ordersToInsert = data.map((row) => {
        const normalized = normalizeRow(row);
        const lat = normalized.latitude ? parseFloat(String(normalized.latitude)) : null;
        const lon = normalized.longitude ? parseFloat(String(normalized.longitude)) : null;

        // Generate unique ID by combining sequencial/protocol with import_log_id
        // This ensures each import creates new records (additive)
        const baseId = normalized.sequencial || normalized.protocol || `OS-${Math.random().toString(36).substr(2, 9)}`;
        const uniqueId = `${baseId}-${importLog.id.slice(0, 8)}`; // Add import_log prefix to make unique

        return {
          id: uniqueId,
          sequencial: normalized.sequencial,
          protocol: normalized.protocol,
          service_type: normalized.service_type,
          address: normalized.address,
          number: normalized.number,
          neighborhood: normalized.neighborhood,
          municipality: normalized.municipality,
          scheduled_date: normalized.scheduled_date,
          client_lat: isNaN(lat as number) ? null : lat,
          client_long: isNaN(lon as number) ? null : lon,
          status: 'pending' as const,
          import_log_id: importLog.id,
          enrollment_id: normalized.enrollment_id,
          meter_number: normalized.meter_number,
        };
      });

      // Use INSERT instead of UPSERT to make imports additive
      const { data: insertedData, error } = await supabase
        .from('service_orders')
        .insert(ordersToInsert)
        .select();

      if (error) throw error;

      const formattedDate = new Date().toLocaleDateString('pt-BR');
      toast({
        title: 'Importação concluída!',
        description: `${ordersToInsert.length} ordens importadas. Lote: ${formattedDate} - ${batchNumber}`,
      });

      setParsedData([]);
      return { success: true, count: ordersToInsert.length, importLogId: importLog.id };
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
      return { success: false, error };
    } finally {
      setImporting(false);
    }
  };

  return {
    parseExcel,
    geocodeData,
    importToDatabase,
    parsedData,
    setParsedData,
    importing,
    geocoding,
  };
}
