-- Staff could only advance a track's workflow one stage at a time
-- (complete_stage_and_advance), so jumping 2-3 stages ahead meant clicking
-- "Complete & Advance" three separate times. This adds a sibling RPC that
-- jumps straight to any later stage in one action, marking every stage in
-- between (and the current one) as done. Mirrors complete_stage_and_advance's
-- logic/shape (same p_track_stage_id-style param — here it's the TARGET
-- stage's track_stages.id, same return columns) so the two stay consistent.
--
-- Deliberately forward-only (raises if the target isn't ahead of the
-- current stage) — this is "skip ahead", not "rewind" or "reorder the
-- workflow template", which is a different, riskier feature not requested.
CREATE OR REPLACE FUNCTION public.jump_to_stage(p_target_track_stage_id uuid)
 RETURNS TABLE(track_id uuid, old_stage uuid, new_stage uuid, track_status track_status)
 LANGUAGE plpgsql
AS $function$
declare
  v_track uuid;
  v_target_template uuid;
  v_target_order int;
  v_current_template uuid;
  v_current_order int;
  v_workflow uuid;
begin
  select ts.track_id, ts.stage_template_id
    into v_track, v_target_template
  from public.track_stages ts
  where ts.id = p_target_track_stage_id;

  if v_track is null then
    raise exception 'Target track stage not found: %', p_target_track_stage_id;
  end if;

  select t.workflow_template_id, t.current_stage_template_id
    into v_workflow, v_current_template
  from public.tracks t
  where t.id = v_track;

  select order_index into v_target_order
  from public.stage_templates
  where id = v_target_template;

  if v_current_template is not null then
    select order_index into v_current_order
    from public.stage_templates
    where id = v_current_template;
  else
    v_current_order := -1;
  end if;

  if v_target_order <= v_current_order then
    raise exception 'Target stage must be ahead of the current stage';
  end if;

  -- mark the current stage and everything in between as done
  update public.track_stages ts
  set status = 'done',
      completed_at = now()
  from public.stage_templates st
  where ts.track_id = v_track
    and ts.stage_template_id = st.id
    and st.workflow_template_id = v_workflow
    and st.order_index >= v_current_order
    and st.order_index < v_target_order
    and ts.status <> 'done';

  -- activate the target stage
  update public.track_stages ts
  set status = 'in_progress',
      started_at = coalesce(ts.started_at, now()),
      due_date = coalesce(
        (select (current_date + (st.sla_days || ' days')::interval)::date
           from public.stage_templates st where st.id = v_target_template),
        ts.due_date)
  where ts.id = p_target_track_stage_id;

  update public.tracks t
  set current_stage_template_id = v_target_template,
      status = 'active'
  where t.id = v_track;

  return query
  select v_track, v_current_template, v_target_template, 'active'::track_status;
end;
$function$;

REVOKE ALL ON FUNCTION public.jump_to_stage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jump_to_stage(uuid) TO authenticated;
