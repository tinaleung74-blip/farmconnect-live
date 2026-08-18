-- Keep QR/system setup tasks out of the manual-care conflict signal.
-- This migration changes only the read-only KaFarm health classifier. It does
-- not update, cancel, approve, assign, or delete any business record.

begin;

create or replace function public.kafarm_care_plan_health_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select jsonb_build_object(
    'catalog_days',(select count(*) from public.care_mission_templates where catalog_version='farmconnect-premium-rooster-180-v1'),
    'open_plans',(select count(*) from public.rooster_care_plans where status in ('draft','payment_for_review','payment_submitted','paid_pending_setup','ready','active','paused')),
    'active_plans',(select count(*) from public.rooster_care_plans where status='active'),
    'overdue_missions',(select count(*) from public.rooster_daily_missions where status='overdue'),
    'unreviewed_proofs',(select count(*) from public.task_proofs where daily_mission_id is not null and admin_review_status='pending'),
    'active_supply_conversion_missing',(select count(*) from public.care_plan_supply_requirements requirement
      join public.rooster_care_plans plan on plan.id=requirement.care_plan_id
      where plan.status='active' and coalesce(requirement.kg_per_inventory_unit,0)<=0),
    'negative_inventory',(select count(*) from public.customer_inventory_items where quantity<0),
    'pending_refunds',(select count(*) from public.rooster_care_plans where refund_status='pending'),
    'manual_expired_reservations',(select count(*) from public.manual_care_inventory_reservations
      where status='active' and expires_at is not null and expires_at<now()),
    'manual_unreviewed_proofs',(select count(*) from public.task_proofs proof
      join public.caretaker_tasks task on task.id=coalesce(proof.caretaker_task_id,proof.task_id)
      where task.workflow_type='manual_standard_mission' and proof.admin_review_status='pending'),
    'manual_consumed_without_usage',(select count(*) from public.manual_care_inventory_reservations reservation
      where reservation.status='consumed' and not exists (
        select 1 from public.manual_care_inventory_usage usage
        where usage.care_request_id=reservation.care_request_id
          and usage.inventory_item_id=reservation.inventory_item_id
      )),
    'manual_approved_with_active_reservation',(select count(*) from public.task_proofs proof
      join public.caretaker_tasks task on task.id=coalesce(proof.caretaker_task_id,proof.task_id)
      join public.manual_care_inventory_reservations reservation on reservation.care_request_id=task.care_request_id
      where task.workflow_type='manual_standard_mission' and proof.admin_review_status='approved'
        and reservation.status='active'),
    'paid_manual_open_conflicts',(select count(*) from public.farm_care_requests request
      join public.rooster_care_plans plan on plan.customer_animal_id=request.customer_animal_id
      where request.workflow_type='manual_standard_mission'
        and request.status in ('payment_for_review','paid_pending_assignment','assigned','in_progress','proof_submitted')
        and plan.status in ('paid_pending_setup','ready','active','paused')),
    'generated_at',now()
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.kafarm_care_plan_health_classifier_version()
returns text
language sql
immutable
set search_path=public
as $$
  select '070_kafarm_care_plan_health_qr_classification_v1'::text;
$$;

revoke all on function public.kafarm_care_plan_health_snapshot() from public,anon;
grant execute on function public.kafarm_care_plan_health_snapshot() to authenticated;
revoke all on function public.kafarm_care_plan_health_classifier_version() from public,anon,authenticated;

commit;

select jsonb_build_object(
  'migration','070_kafarm_care_plan_health_qr_classification',
  'health_rpc',to_regprocedure('public.kafarm_care_plan_health_snapshot()') is not null,
  'version_rpc',to_regprocedure('public.kafarm_care_plan_health_classifier_version()') is not null,
  'qr_system_tasks_excluded',true
) verification;
