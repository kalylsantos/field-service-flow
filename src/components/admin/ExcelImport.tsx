import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExcelImport } from '@/hooks/useExcelImport';
import { Upload, MapPin, Check, X, Loader2, FileSpreadsheet } from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ExcelImportProps {
  onImportComplete: () => void;
}

export function ExcelImport({ onImportComplete }: ExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const {
    parseExcel,
    geocodeData,
    importToDatabase,
    parsedData,
    setParsedData,
    importing,
    geocoding,
  } = useExcelImport();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    await parseExcel(file);
  };

  const handleGeocode = async () => {
    await geocodeData(parsedData);
  };

  const handleImport = async () => {
    const result = await importToDatabase(parsedData);
    if (result.success) {
      setFileName(null);
      onImportComplete();
    }
  };

  const handleCancel = () => {
    setParsedData([]);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const needsGeocoding = parsedData.some((row) => {
    const lat = row.Latitude || row.LATITUDE;
    const lon = row.Longitude || row.LONGITUDE;
    return !lat || !lon;
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar Planilha Excel
        </CardTitle>
        <CardDescription>
          Faça upload de um arquivo .xlsx com colunas como: PROTOCOLO, Sequencial, Serviço, Endereço, Número, Bairro, Município, Data Programada, Latitude, Longitude
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        {parsedData.length === 0 ? (
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full h-24 border-dashed border-2 hover:border-primary hover:bg-primary/5"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground">Clique para selecionar arquivo</span>
            </div>
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">({parsedData.length} linhas)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {needsGeocoding && (
              <Button
                onClick={handleGeocode}
                variant="outline"
                className="w-full"
                disabled={geocoding}
              >
                {geocoding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Geocodificando... (pode demorar)
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Geocodificar Endereços (Sem Lat/Long)
                  </>
                )}
              </Button>
            )}

            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Sequencial</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead className="w-24">Bairro</TableHead>
                    <TableHead className="w-20 text-center">GPS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((row, i) => {
                    const seq = row.Sequencial || row.SEQUENCIAL || '-';
                    const addr = row.Endereço || row.ENDERECO || '';
                    const num = row.Número || row.NUMERO || '';
                    const bairro = row.Bairro || row.BAIRRO || '';
                    const lat = row.Latitude || row.LATITUDE;
                    const lon = row.Longitude || row.LONGITUDE;
                    
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{seq}</TableCell>
                        <TableCell className="text-sm">{addr}, {num}</TableCell>
                        <TableCell className="text-sm">{bairro}</TableCell>
                        <TableCell className="text-center">
                          {lat && lon ? (
                            <Check className="h-4 w-4 text-status-completed mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-status-not-executed mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {parsedData.length > 10 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                  ... e mais {parsedData.length - 10} linhas
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleImport} className="flex-1" disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Importar {parsedData.length} Ordens
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
