-- Create import_logs table to track imports
CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id),
  orders_count integer NOT NULL DEFAULT 0,
  batch_number integer NOT NULL DEFAULT 1,
  import_date date NOT NULL DEFAULT CURRENT_DATE
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage import logs
CREATE POLICY "Admins can do everything on import_logs"
ON public.import_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add import_log_id to service_orders
ALTER TABLE public.service_orders 
ADD COLUMN import_log_id uuid REFERENCES public.import_logs(id) ON DELETE SET NULL;

-- Create function to get next batch number for a date
CREATE OR REPLACE FUNCTION public.get_next_batch_number(p_date date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(batch_number), 0) + 1
  FROM public.import_logs
  WHERE import_date = p_date
$$;