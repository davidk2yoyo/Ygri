-- RPC Function: Upsert Email Thread (PostgREST compatible)
-- Using single JSON parameter

CREATE OR REPLACE FUNCTION rpc_upsert_email_thread(params JSONB)
RETURNS JSON AS $$
DECLARE
  v_existing_thread_id UUID;
  v_result JSON;
  v_supplier_id UUID;
  v_client_id UUID;
BEGIN
  -- Extract params from JSONB
  IF (params->>'p_entity_type') = 'supplier' THEN
    v_supplier_id := (params->>'p_entity_id')::UUID;
    v_client_id := NULL;
  ELSE
    v_client_id := (params->>'p_entity_id')::UUID;
    v_supplier_id := NULL;
  END IF;

  -- Check if thread exists (by subject + entity)
  SELECT id INTO v_existing_thread_id
  FROM email_threads
  WHERE subject = (params->>'p_subject')
    AND type = (params->>'p_entity_type')
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
      last_message = (params->>'p_body'),
      last_received_at = (params->>'p_received_at')::TIMESTAMPTZ,
      message_count = message_count + 1,
      priority = CASE
        WHEN (params->>'p_is_urgent')::BOOLEAN = true THEN 'urgent'
        ELSE (params->>'p_priority')
      END,
      sentiment = CASE
        WHEN (params->>'p_is_urgent')::BOOLEAN = true THEN 'urgent'
        ELSE sentiment
      END,
      needs_response = CASE
        WHEN (params->>'p_direction') = 'incoming' THEN true
        ELSE needs_response
      END,
      summary = COALESCE(summary, (params->>'p_ai_summary')),
      updated_at = NOW()
    WHERE id = v_existing_thread_id;

    -- Insert individual message
    INSERT INTO email_messages (
      thread_id, message_id, from_email, from_name, to_email,
      subject, body_text, is_from_me, received_at
    ) VALUES (
      v_existing_thread_id,
      (params->>'p_gmail_message_id'),
      (params->>'p_from_email'),
      (params->>'p_from_name'),
      (params->>'p_to_email'),
      (params->>'p_subject'),
      (params->>'p_body'),
      (params->>'p_direction') = 'outgoing',
      (params->>'p_received_at')::TIMESTAMPTZ
    )
    ON CONFLICT (message_id) DO NOTHING;

    v_result := json_build_object(
      'success', true,
      'action', 'updated',
      'thread_id', v_existing_thread_id,
      'message_count', (SELECT message_count FROM email_threads WHERE id = v_existing_thread_id)
    );

  ELSE
    -- INSERT new thread
    INSERT INTO email_threads (
      thread_id, type, supplier_id, client_id, subject, from_email,
      from_name, to_email, last_message, last_received_at, message_count,
      summary, sentiment, priority, needs_response
    ) VALUES (
      (params->>'p_thread_id'),
      (params->>'p_entity_type'),
      v_supplier_id,
      v_client_id,
      (params->>'p_subject'),
      (params->>'p_from_email'),
      (params->>'p_from_name'),
      (params->>'p_to_email'),
      (params->>'p_body'),
      (params->>'p_received_at')::TIMESTAMPTZ,
      1,
      (params->>'p_ai_summary'),
      CASE WHEN (params->>'p_is_urgent')::BOOLEAN THEN 'urgent' ELSE 'neutral' END,
      CASE WHEN (params->>'p_is_urgent')::BOOLEAN THEN 'urgent' ELSE (params->>'p_priority') END,
      (params->>'p_direction') = 'incoming'
    )
    RETURNING id INTO v_existing_thread_id;

    -- Insert first message
    INSERT INTO email_messages (
      thread_id, message_id, from_email, from_name, to_email,
      subject, body_text, is_from_me, received_at
    ) VALUES (
      v_existing_thread_id,
      (params->>'p_gmail_message_id'),
      (params->>'p_from_email'),
      (params->>'p_from_name'),
      (params->>'p_to_email'),
      (params->>'p_subject'),
      (params->>'p_body'),
      (params->>'p_direction') = 'outgoing',
      (params->>'p_received_at')::TIMESTAMPTZ
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rpc_upsert_email_thread TO anon;
GRANT EXECUTE ON FUNCTION rpc_upsert_email_thread TO authenticated;
