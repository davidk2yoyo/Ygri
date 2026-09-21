-- RPC Function: Match Email Bidirectional
-- Description: Determina si un email es de cliente o proveedor analizando From y To
-- Date: 2026-02-28

-- Primero agregar campo direction a la tabla email_threads si no existe
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS direction text
  CHECK (direction IN ('incoming', 'outgoing'));

-- Crear índice para direction
CREATE INDEX IF NOT EXISTS idx_email_threads_direction ON email_threads(direction);

-- Función RPC para matching bidireccional
CREATE OR REPLACE FUNCTION rpc_match_email_bidirectional(
  p_from_email text,
  p_to_email text
)
RETURNS json AS $$
DECLARE
  v_external_email text;
  v_direction text;
  v_domain text;
  v_is_public boolean;
  v_result json;

  -- INTERASIA emails/domain
  v_interasia_emails text[] := ARRAY[
    'interasiagerencia@gmail.com',
    'gerencia@interasia.com.co',
    'operations@interasia.com.co',
    'ygri@interasia.com.co',
    'suppliers@interasia.com.co',
    'proyectos@interasia.com.co'
  ];
  v_interasia_domain text := 'interasia.com.co';
  v_from_lower text;
  v_to_lower text;
  v_is_from_interasia boolean;
BEGIN
  -- Normalize emails
  v_from_lower := lower(trim(p_from_email));
  v_to_lower := lower(trim(p_to_email));

  -- Check if From is INTERASIA
  v_is_from_interasia := (
    v_from_lower = ANY(v_interasia_emails) OR
    v_from_lower LIKE '%@' || v_interasia_domain
  );

  -- Determine which email is external (not INTERASIA)
  IF v_is_from_interasia THEN
    -- From is INTERASIA → To is external (outgoing)
    v_external_email := v_to_lower;
    v_direction := 'outgoing';
  ELSE
    -- From is external (incoming)
    v_external_email := v_from_lower;
    v_direction := 'incoming';
  END IF;

  -- Extract domain from external email
  v_domain := split_part(v_external_email, '@', 2);

  -- Check if domain is public
  v_is_public := v_domain IN (
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'yahoo.com',
    'qq.com',
    '163.com',
    '126.com',
    'icloud.com',
    'live.com',
    'msn.com'
  );

  -- ============================================================
  -- Search in SUPPLIERS
  -- ============================================================
  IF v_is_public THEN
    -- Public domain: EXACT match required
    SELECT json_build_object(
      'found', true,
      'type', 'supplier',
      'entity_id', id,
      'entity_name', name,
      'matched_email', email,
      'external_email', v_external_email,
      'direction', v_direction,
      'is_public_domain', v_is_public
    ) INTO v_result
    FROM suppliers
    WHERE lower(trim(email)) = v_external_email
    LIMIT 1;
  ELSE
    -- Corporate domain: match by DOMAIN
    SELECT json_build_object(
      'found', true,
      'type', 'supplier',
      'entity_id', id,
      'entity_name', name,
      'matched_email', email,
      'external_email', v_external_email,
      'direction', v_direction,
      'is_public_domain', v_is_public
    ) INTO v_result
    FROM suppliers
    WHERE lower(trim(email)) LIKE '%@' || v_domain
    LIMIT 1;
  END IF;

  -- If found in suppliers, return immediately
  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- ============================================================
  -- Search in CLIENTS
  -- ============================================================
  IF v_is_public THEN
    -- Public domain: EXACT match required
    SELECT json_build_object(
      'found', true,
      'type', 'client',
      'entity_id', id,
      'entity_name', company_name,
      'matched_email', email,
      'external_email', v_external_email,
      'direction', v_direction,
      'is_public_domain', v_is_public
    ) INTO v_result
    FROM clients
    WHERE lower(trim(email)) = v_external_email
    LIMIT 1;
  ELSE
    -- Corporate domain: match by DOMAIN
    SELECT json_build_object(
      'found', true,
      'type', 'client',
      'entity_id', id,
      'entity_name', company_name,
      'matched_email', email,
      'external_email', v_external_email,
      'direction', v_direction,
      'is_public_domain', v_is_public
    ) INTO v_result
    FROM clients
    WHERE lower(trim(email)) LIKE '%@' || v_domain
    LIMIT 1;
  END IF;

  -- If found in clients, return
  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- ============================================================
  -- NOT FOUND
  -- ============================================================
  RETURN json_build_object(
    'found', false,
    'external_email', v_external_email,
    'direction', v_direction,
    'domain', v_domain,
    'is_public_domain', v_is_public,
    'from_email', v_from_lower,
    'to_email', v_to_lower
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION rpc_match_email_bidirectional(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_match_email_bidirectional(text, text) TO service_role;

-- Comentarios
COMMENT ON FUNCTION rpc_match_email_bidirectional IS
'Determina si un email pertenece a un cliente o proveedor analizando From y To.
Retorna: {found, type, entity_id, entity_name, direction, external_email}

Ejemplos:
- From: proveedor@china.com, To: suppliers@interasia.com.co
  → {found: true, type: "supplier", direction: "incoming"}

- From: gerencia@interasia.com.co, To: cliente@empresa.com
  → {found: true, type: "client", direction: "outgoing"}

Reglas de matching:
- Dominios públicos (gmail, hotmail, etc): Match EXACTO
- Dominios corporativos: Match por DOMINIO completo
';

-- Función de prueba
CREATE OR REPLACE FUNCTION test_rpc_match_email()
RETURNS TABLE(test_name text, result json) AS $$
BEGIN
  -- Test 1: Incoming from supplier
  RETURN QUERY SELECT
    'Test 1: Incoming from supplier'::text,
    rpc_match_email_bidirectional('sales@supplier.com', 'suppliers@interasia.com.co');

  -- Test 2: Outgoing to client
  RETURN QUERY SELECT
    'Test 2: Outgoing to client'::text,
    rpc_match_email_bidirectional('gerencia@interasia.com.co', 'contact@client.com');

  -- Test 3: Gmail exact match needed
  RETURN QUERY SELECT
    'Test 3: Gmail exact match'::text,
    rpc_match_email_bidirectional('someone@gmail.com', 'proyectos@interasia.com.co');

  -- Test 4: Not found
  RETURN QUERY SELECT
    'Test 4: Not found'::text,
    rpc_match_email_bidirectional('unknown@unknown.com', 'proyectos@interasia.com.co');
END;
$$ LANGUAGE plpgsql;

-- Para probar, ejecuta:
-- SELECT * FROM test_rpc_match_email();
