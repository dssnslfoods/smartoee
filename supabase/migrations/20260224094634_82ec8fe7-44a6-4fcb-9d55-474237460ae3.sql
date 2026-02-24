
-- Add line_id column to products table (nullable for backward compatibility)
ALTER TABLE public.products ADD COLUMN line_id uuid REFERENCES public.lines(id);

-- Create index for performance
CREATE INDEX idx_products_line_id ON public.products(line_id);
