export type UserRole = 'admin' | 'technician';

export type ServiceOrderStatus = 'pending' | 'in_progress' | 'completed' | 'not_executed';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserWithRole extends Profile {
  role: UserRole;
}

export interface ServiceOrder {
  id: string;
  sequencial: string | null;
  protocol: string | null;
  service_type: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
  municipality: string | null;
  description: string | null;
  client_lat: number | null;
  client_long: number | null;
  scheduled_date: string | null;
  status: ServiceOrderStatus;
  assigned_to: string | null;
  started_at: string | null;
  finished_at: string | null;
  meter_reading: string | null;
  seal_number: string | null;
  resolution_type: string | null;
  notes: string | null;
  enrollment_id: string | null;
  meter_number: string | null;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile | null;
}

export interface Photo {
  id: string;
  service_order_id: string;
  url: string;
  taken_at: string;
  gps_lat: number | null;
  gps_long: number | null;
}

export interface ExcelRow {
  // Campos conforme planilha real
  PROTOCOLO?: string;
  Sequencial?: string;
  Serviço?: string;
  'Descrição Serviço'?: string;
  Endereço?: string;
  Número?: string;
  Bairro?: string;
  Município?: string;
  'Data Programada'?: string;
  Latitude?: number | string;
  Longitude?: number | string;
  Matrícula?: string;
  Hidrômetro?: string;
  'HD Vinculado'?: string;
  // Campos legados (compatibilidade)
  SEQUENCIAL?: string;
  SERVICO?: string;
  ENDERECO?: string;
  NUMERO?: string;
  BAIRRO?: string;
  MUNICIPIO?: string;
  DATA?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
}

export const RESOLUTION_TYPES = [
  'Executado (Cavalete/Sem Escavação)',
  'Executado (Ramal/Com Escavação)',
  'Não Localizado',
  'Impedido pelo Cliente',
  'Já estava cortado',
  'Precisa de outra visita',
  'Escavação feita e não encontrado',
] as const;

export type ResolutionType = typeof RESOLUTION_TYPES[number];

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  not_executed: 'Não Executado',
};
