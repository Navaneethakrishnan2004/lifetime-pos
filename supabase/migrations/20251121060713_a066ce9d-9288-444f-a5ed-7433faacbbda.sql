-- Add category column to menu_items table
ALTER TABLE public.menu_items 
ADD COLUMN category TEXT DEFAULT 'Uncategorized';