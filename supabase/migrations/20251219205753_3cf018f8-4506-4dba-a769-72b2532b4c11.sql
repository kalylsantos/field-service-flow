-- Add new fields for technician validation
ALTER TABLE public.service_orders 
ADD COLUMN IF NOT EXISTS enrollment_id TEXT,
ADD COLUMN IF NOT EXISTS meter_number TEXT;