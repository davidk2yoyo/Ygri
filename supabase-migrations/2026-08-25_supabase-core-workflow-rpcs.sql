-- Ygri core workflow RPCs — extracted from the live Supabase project via
-- the Supabase MCP server (read-only) on 2026-08-25, for the Copilot
-- Blueprint's Phase 0B ("recover/version core RPCs" — see docs/ai-copilot.md
-- and supabase-ai-readiness / ygri-copilot-v1-report). These bodies were
-- NOT written here — this file documents what is already live, verbatim,
-- so future changes are diffable and this repo stops being blind to them.
--
-- CREATE OR REPLACE is safe to run — it re-asserts the exact behavior
-- already in production, changing nothing.

CREATE OR REPLACE FUNCTION public.create_track_rpc(
  p_client_id uuid,
  p_name text,
  p_remarks text,
  p_workflow workflow_kind,
  p_owner_id uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_wf uuid;
  v_creator uuid := auth.uid();
  v_track_id uuid;
begin
  select id into v_wf
  from public.workflow_templates
  where name = p_workflow;

  if v_wf is null then
    raise exception 'Unknown workflow kind: %', p_workflow;
  end if;

  if v_creator is null then
    -- if called from SQL editor, fall back to owner
    v_creator := p_owner_id;
  end if;

  insert into public.tracks (id, client_id, name, remarks, workflow_template_id, owner_user_id, created_by)
  values (gen_random_uuid(), p_client_id, p_name, p_remarks, v_wf, p_owner_id, v_creator)
  returning id into v_track_id;

  return v_track_id;
end;
$function$;

-- Note (confirmed by reading the body, not assumed): this RPC ONLY inserts
-- a tracks row. It does not create any track_stages rows and leaves
-- current_stage_template_id null. Whatever gives a fresh project its first
-- stage happens elsewhere (not yet located) — worth confirming before
-- assuming a newly AI-created project behaves identically to one created
-- through the "New Project" UI beyond this RPC's own scope.

CREATE OR REPLACE FUNCTION public.complete_stage_and_advance(p_track_stage_id uuid)
 RETURNS TABLE(track_id uuid, old_stage uuid, new_stage uuid, track_status track_status)
 LANGUAGE plpgsql
AS $function$
declare
  v_track uuid;
  v_stage_template uuid;
  v_workflow uuid;
  v_next_stage uuid;
begin
  -- finish current stage
  update public.track_stages ts
  set status = 'done',
      completed_at = now()
  where ts.id = p_track_stage_id
  returning ts.track_id, ts.stage_template_id into v_track, v_stage_template;

  -- next stage from template order
  select t.workflow_template_id into v_workflow
  from public.tracks t
  where t.id = v_track;

  select st2.id into v_next_stage
  from public.stage_templates st1
  join public.stage_templates st2
    on st2.workflow_template_id = st1.workflow_template_id
   and st2.order_index = st1.order_index + 1
  where st1.id = v_stage_template
  limit 1;

  if v_next_stage is null then
    update public.tracks t
    set status = 'completed',
        current_stage_template_id = null
    where t.id = v_track;

    return query
    select v_track, v_stage_template, null::uuid, 'completed'::track_status;
  else
    update public.track_stages ts
    set status = 'in_progress',
        started_at = coalesce(ts.started_at, now()),
        due_date = coalesce(
          (select (current_date + (st.sla_days || ' days')::interval)::date
             from public.stage_templates st where st.id = v_next_stage),
          ts.due_date)
    where ts.track_id = v_track and ts.stage_template_id = v_next_stage;

    update public.tracks t
    set current_stage_template_id = v_next_stage
    where t.id = v_track;

    return query
    select v_track, v_stage_template, v_next_stage, 'active'::track_status;
  end if;
end;
$function$;

-- Notes (confirmed by reading the body):
-- * v_workflow is computed but never used in the join below it — dead
--   variable, not a functional bug (the join is already implicitly scoped
--   to the same workflow via st2.workflow_template_id = st1.workflow_template_id).
-- * started_at IS reliably set (coalesce(ts.started_at, now())) whenever a
--   stage becomes in_progress THROUGH THIS RPC — confirms
--   api/_lib/ai/context/projectStatusEngine.js's days_in_stage fact is
--   trustworthy for stages that advanced this way. The still-open risk is
--   the Kanban drag-and-drop path (ProjectsPage.jsx handleMoveProject),
--   which updates track_stages.status directly and does NOT call this RPC
--   — so it does not set started_at/due_date the same way. This is the
--   exact "two divergent paths" gap the Copilot Blueprint flags; advance_stage
--   stays disabled as an AI tool until the two are unified into one
--   canonical operation.
