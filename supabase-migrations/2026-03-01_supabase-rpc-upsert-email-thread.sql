-- RPC Function: Upsert Email Thread
-- Description: Inserta o actualiza un thread de email basado en subject y entity
-- Usage: Called from n8n workflow to save email threads

CREATE OR REPLACE FUNCTION rpc_upsert_email_thread(
  p_thread_id TEXT,
  p_gmail_message_id TEXT,
  p_subject TEXT,
  p_from_email TEXT,
  p_from_name TEXT,
  p_to_email TEXT,
  p_body TEXT,
  p_received_at TIMESTAMPTZ,
  p_entity_type TEXT, -- 'client' or 'supplier'
  p_entity_id UUID,
  p_direction TEXT, -- 'incoming' or 'outgoing'
  p_is_urgent BOOLEAN,
  p_priority TEXT,
  p_ai_summary TEXT
)
RETURNS JSON AS $$
DECLARE
  v_existing_thread_id UUID;
  v_result JSON;
  v_supplier_id UUID;
  v_client_id UUID;
BEGIN
  -- Set supplier_id or client_id based on entity_type
  IF p_entity_type = 'supplier' THEN
    v_supplier_id := p_entity_id;
    v_client_id := NULL;
  ELSE
    v_client_id := p_entity_id;
    v_supplier_id := NULL;
  END IF;

  -- Check if thread exists (by subject + entity)
  SELECT id INTO v_existing_thread_id
  FROM email_threads
  WHERE subject = p_subject
    AND type = p_entity_type
    AND (
      (supplier_id = v_supplier_id AND v_supplier_id IS NOT NULL)
      OR
      (client_id = v_client_id AND v_client_id IS NOT NULL)
    )
  LIMIT 1;

  IF v_existing_thread_id IS NOT NULL THEN
    -- UPDATE existing thread
    UPDATE email_threads
    SET
      last_message = p_body,
      last_received_at = p_received_at,
      message_count = message_count + 1,
      priority = CASE
        WHEN p_is_urgent = true THEN 'urgent'
        ELSE p_priority
      END,
      sentiment = CASE
        WHEN p_is_urgent = true THEN 'urgent'
        ELSE sentiment
      END,
      needs_response = CASE
        WHEN p_direction = 'incoming' THEN true
        ELSE needs_response
      END,
      summary = COALESCE(summary, p_ai_summary),
      updated_at = NOW()
    WHERE id = v_existing_thread_id;

    -- Insert individual message
    INSERT INTO email_messages (
      thread_id,
      message_id,
      from_email,
      from_name,
      to_email,
      subject,
      body_text,
      is_from_me,
      received_at
    ) VALUES (
      v_existing_thread_id,
      p_gmail_message_id,
      p_from_email,
      p_from_name,
      p_to_email,
      p_subject,
      p_body,
      p_direction = 'outgoing',
      p_received_at
    )
    ON CONFLICT (message_id) DO NOTHING; -- Avoid duplicates

    v_result := json_build_object(
      'success', true,
      'action', 'updated',
      'thread_id', v_existing_thread_id,
      'message_count', (SELECT message_count FROM email_threads WHERE id = v_existing_thread_id)
    );

  ELSE
    -- INSERT new thread
    INSERT INTO email_threads (
      thread_id,
      type,
      supplier_id,
      client_id,
      subject,
      from_email,
      from_name,
      to_email,
      last_message,
      last_received_at,
      message_count,
      summary,
      sentiment,
      priority,
      needs_response
    ) VALUES (
      p_thread_id,
      p_entity_type,
      v_supplier_id,
      v_client_id,
      p_subject,
      p_from_email,
      p_from_name,
      p_to_email,
      p_body,
      p_received_at,
      1,
      p_ai_summary,
      CASE WHEN p_is_urgent THEN 'urgent' ELSE 'neutral' END,
      CASE WHEN p_is_urgent THEN 'urgent' ELSE p_priority END,
      p_direction = 'incoming'
    )
    RETURNING id INTO v_existing_thread_id;

    -- Insert first message
    INSERT INTO email_messages (
      thread_id,
      message_id,
      from_email,
      from_name,
      to_email,
      subject,
      body_text,
      is_from_me,
      received_at
    ) VALUES (
      v_existing_thread_id,
      p_gmail_message_id,
      p_from_email,
      p_from_name,
      p_to_email,
      p_subject,
      p_body,
      p_direction = 'outgoing',
      p_received_at
    );

    v_result := json_build_object(
      'success', true,
      'action', 'created',
      'thread_id', v_existing_thread_id,
      'message_count', 1
    );

  END IF;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_upsert_email_thread TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_upsert_email_thread TO anon;
