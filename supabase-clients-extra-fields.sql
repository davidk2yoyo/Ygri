-- Add missing columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS rut_nit text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS tags    text[] DEFAULT '{}';
