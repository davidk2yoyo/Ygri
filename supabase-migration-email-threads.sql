-- Migration: Email Threads Tracking System
-- Description: Sistema para trackear conversaciones de email con clientes y proveedores
-- Date: 2026-02-28

-- Tabla principal de threads de email
CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id text UNIQUE NOT NULL, -- Gmail thread ID
  type text CHECK (type IN ('supplier', 'client')) NOT NULL,

  -- Relations
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,

  -- Email data
  subject text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL, -- suppliers@ o proyectos@
  last_message text,
  last_received_at timestamp NOT NULL,
  message_count integer DEFAULT 1,

  -- AI Analysis
  summary text, -- Resumen general del thread
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  key_topics jsonb DEFAULT '[]'::jsonb, -- ["pricing", "delivery", "quality"]
  action_items jsonb DEFAULT '[]'::jsonb, -- [{"task": "...", "deadline": "...", "completed": false}]

  -- Extracted data (específico según tipo)
  extracted_data jsonb DEFAULT '{}'::jsonb,

  -- Status
  status text DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  needs_response boolean DEFAULT false,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Timestamps
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Tabla de mensajes individuales (opcional, para historial completo)
CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id uuid REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id text UNIQUE NOT NULL, -- Gmail message ID

  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  subject text,
  body_text text,
  body_html text,

  -- Attachments
  has_attachments boolean DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb, -- [{"filename": "...", "size": ..., "type": "..."}]

  -- Metadata
  is_from_me boolean DEFAULT false,
  received_at timestamp NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_email_threads_supplier ON email_threads(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_email_threads_client ON email_threads(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_email_threads_type ON email_threads(type);
CREATE INDEX idx_email_threads_status ON email_threads(status);
CREATE INDEX idx_email_threads_needs_response ON email_threads(needs_response) WHERE needs_response = true;
CREATE INDEX idx_email_threads_priority ON email_threads(priority);
CREATE INDEX idx_email_threads_last_received ON email_threads(last_received_at DESC);
CREATE INDEX idx_email_messages_thread ON email_messages(thread_id, received_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_email_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_threads_updated_at
  BEFORE UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_email_threads_updated_at();

-- Row Level Security (RLS)
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (ajustar según tu auth setup)
CREATE POLICY "Enable read access for authenticated users" ON email_threads
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON email_threads
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON email_threads
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON email_messages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON email_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Agregar campos a tablas existentes
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_email_at timestamp;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email_thread_count integer DEFAULT 0;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_email_at timestamp;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_thread_count integer DEFAULT 0;

-- Comentarios para documentación
COMMENT ON TABLE email_threads IS 'Threads de conversaciones de email con clientes y proveedores';
COMMENT ON COLUMN email_threads.type IS 'Tipo: supplier (suppliers@) o client (proyectos@)';
COMMENT ON COLUMN email_threads.extracted_data IS 'Datos extraídos por AI según tipo. Suppliers: prices, lead_time, tracking. Clients: budget, deadline, products';
COMMENT ON TABLE email_messages IS 'Mensajes individuales dentro de cada thread para historial completo';

-- Función helper para actualizar contador de emails
CREATE OR REPLACE FUNCTION update_email_thread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    UPDATE suppliers
    SET
      email_thread_count = (SELECT COUNT(*) FROM email_threads WHERE supplier_id = NEW.supplier_id),
      last_email_at = NEW.last_received_at
    WHERE id = NEW.supplier_id;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    UPDATE clients
    SET
      email_thread_count = (SELECT COUNT(*) FROM email_threads WHERE client_id = NEW.client_id),
      last_email_at = NEW.last_received_at
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_thread_count
  AFTER INSERT OR UPDATE ON email_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_email_thread_count();

-- Ejemplos de queries útiles
COMMENT ON TABLE email_threads IS
'Ejemplos de uso:
-- Threads que necesitan respuesta urgente
SELECT * FROM email_threads WHERE needs_response = true AND priority = ''urgent'';

-- Últimas conversaciones con un proveedor
SELECT * FROM email_threads WHERE supplier_id = ''xxx'' ORDER BY last_received_at DESC;

-- Threads con problemas de calidad mencionados
SELECT * FROM email_threads WHERE extracted_data->>''quality_issue'' = ''true'';

-- Action items pendientes
SELECT subject, action_items FROM email_threads
WHERE jsonb_array_length(action_items) > 0
AND status = ''active'';
';
