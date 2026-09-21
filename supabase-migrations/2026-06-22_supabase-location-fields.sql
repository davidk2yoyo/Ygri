-- Add structured location fields to suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city    text,
  ADD COLUMN IF NOT EXISTS state   text;

-- Add city and state to clients (country column already exists)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS city  text,
  ADD COLUMN IF NOT EXISTS state text;
