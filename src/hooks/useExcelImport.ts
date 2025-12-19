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

  const geocodeData = async (data: ExcelRow[]): Promise<ExcelRow[]> => {
    setGeocoding(true);
    const updatedData: ExcelRow[] = [];

    for (const row of data) {
      if (row.LATITUDE && row.LONGITUDE) {
        updatedData.push(row);
        continue;
      }

      const fullAddress = `${row.ENDERECO}, ${row.NUMERO}, ${row.BAIRRO}, ${row.MUNICIPIO}`;
      const coords = await geocodeAddress(fullAddress);

      if (coords) {
        updatedData.push({
          ...row,
          LATITUDE: coords.lat,
          LONGITUDE: coords.lon,
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

  const importToDatabase = async (data: ExcelRow[]) => {
    setImporting(true);

    try {
      const ordersToInsert = data.map((row) => ({
        id: row.SEQUENCIAL || row.PROTOCOLO || `OS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sequencial: row.SEQUENCIAL || null,
        protocol: row.PROTOCOLO || null,
        service_type: row.SERVICO || null,
        address: row.ENDERECO || null,
        number: row.NUMERO || null,
        neighborhood: row.BAIRRO || null,
        municipality: row.MUNICIPIO || null,
        scheduled_date: row.DATA || null,
        client_lat: row.LATITUDE || null,
        client_long: row.LONGITUDE || null,
        status: 'pending' as const,
      }));

      const { data: insertedData, error } = await supabase
        .from('service_orders')
        .upsert(ordersToInsert, { onConflict: 'id' })
        .select();

      if (error) throw error;

      toast({
        title: 'Importação concluída!',
        description: `${ordersToInsert.length} ordens importadas com sucesso.`,
      });

      setParsedData([]);
      return { success: true, count: ordersToInsert.length };
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
