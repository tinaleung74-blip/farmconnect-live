-- Based on actual function definitions supplied 2026-08-27.
-- Replaces four functions only; no historical business rows are modified.
-- Test on an isolated copy first. Existing signatures and grants are preserved,
-- except anonymous/PUBLIC execution is explicitly revoked.
begin;
CREATE OR REPLACE FUNCTION public.kafarm_support_send_message(p_session_id uuid, p_body text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session public.support_chat_sessions%rowtype;
  v_message_id uuid;
  v_profile_id uuid;
  v_caretaker_id uuid;
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_session_id is null then
    raise exception 'Chat session is required';
  end if;

  if nullif(trim(p_body), '') is null then
    raise exception 'KaFarm reply is required';
  end if;

  v_profile_id := public.current_profile_id();
  v_caretaker_id := public.current_caretaker_id();

  select *
  into v_session
  from public.support_chat_sessions
  where id = p_session_id for update;

  if not found then
    raise exception 'Chat session not found';
  end if;

  if not (
    coalesce(public.is_admin(), false)
    or coalesce(v_session.owner_profile_id = v_profile_id, false)
    or coalesce(v_session.owner_caretaker_id = v_caretaker_id, false)
  ) then
    raise exception 'Not allowed to add KaFarm reply to this chat';
  end if;

  if v_session.status in ('ended', 'completed') then
    raise exception 'Chat is already closed';
  end if;

  insert into public.support_chat_messages (
    session_id,
    sender_role,
    body,
    metadata
  )
  values (
    p_session_id,
    'kafarm',
    trim(p_body),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'kafarm_rule_reply',
        'saved_by', 'kafarm_support_send_message'
      )
  )
  returning id into v_message_id;

  update public.support_chat_sessions
  set updated_at = now()
  where id = p_session_id;

  return v_message_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_submit_kyc(p_legal_name text, p_birthdate date, p_address_line text, p_city text, p_province text, p_postal_code text, p_id_type text, p_id_number_last4 text, p_payout_name_to_match text, p_valid_id_front_url text, p_selfie_url text, p_valid_id_back_url text DEFAULT NULL::text, p_address_proof_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile_id uuid;
  v_kyc_id uuid;
  v_existing_status text;
  v_id_number text := public.normalize_kyc_id_number(p_id_type, p_id_number_last4);
  v_id_hash text := encode(extensions.digest(coalesce(p_id_type, '') || ':' || v_id_number, 'sha256'), 'hex');
  v_system_checks jsonb;
  v_has_failed_required boolean := false;
  v_has_duplicate boolean := false;
  v_auto_status text := 'passed';
  v_submit_status text := 'ready_for_review';
  v_auto_notes jsonb := '{}'::jsonb;
begin
  select id into v_profile_id
  from public.profiles
  where auth_user_id = auth.uid() and role = 'customer';

  if v_profile_id is null then
    raise exception 'Login required';
  end if;

  -- Serialize even the first submission; lock the review row before any update.
  perform pg_advisory_xact_lock(hashtextextended('kyc-submit:' || v_profile_id::text,0));
  select status::text into v_existing_status
  from public.customer_kyc_profiles where profile_id=v_profile_id for update;
  if found and coalesce(v_existing_status,'') not in ('rejected','declined','denied','needs_info','not_submitted','draft') then
    raise exception 'KYC_ALREADY_SUBMITTED_OR_APPROVED';
  end if;

  if nullif(trim(p_legal_name), '') is null then
    raise exception 'Legal name is required';
  end if;

  if nullif(trim(coalesce(p_valid_id_front_url, '')), '') is null
     or nullif(trim(coalesce(p_valid_id_back_url, '')), '') is null
     or nullif(trim(coalesce(p_selfie_url, '')), '') is null then
    raise exception 'ID front, ID back, and selfie are required';
  end if;

  v_system_checks := public.run_kyc_system_checks(
    v_profile_id,
    p_legal_name,
    p_birthdate,
    p_address_line,
    p_city,
    p_province,
    p_postal_code,
    p_id_type,
    v_id_number,
    p_valid_id_front_url,
    p_valid_id_back_url,
    p_selfie_url
  );

  v_has_duplicate := coalesce((v_system_checks->>'duplicate_id_number')::boolean, false)
                     or coalesce((v_system_checks->>'duplicate_name_birthdate')::boolean, false);

  v_has_failed_required :=
    not coalesce((v_system_checks #>> '{id_number,ok}')::boolean, false)
    or not coalesce((v_system_checks #>> '{postal_code,ok}')::boolean, false)
    or not coalesce((v_system_checks #>> '{address,ok}')::boolean, false);

  if v_has_duplicate then
    v_auto_status := 'needs_review';
    v_submit_status := 'duplicate_risk';
  elsif v_has_failed_required then
    v_auto_status := 'needs_review';
    v_submit_status := 'high_risk';
  else
    v_auto_status := 'passed';
    v_submit_status := 'ready_for_review';
  end if;

  v_auto_notes := jsonb_build_object(
    'system_checks', v_system_checks,
    'customer_can_submit_even_if_flagged', true,
    'admin_final_review_required', true
  );

  insert into public.customer_kyc_profiles(
    profile_id,
    legal_name,
    birthdate,
    address_line,
    city,
    province,
    postal_code,
    id_type,
    id_number_last4,
    id_number,
    id_number_hash,
    payout_name_to_match,
    status,
    auto_check_status,
    auto_check_notes,
    system_check_status,
    system_check_results,
    customer_confirmed,
    submitted_at,
    face_match_status,
    name_match_status,
    birthday_match_status
  )
  values (
    v_profile_id,
    trim(p_legal_name),
    p_birthdate,
    nullif(trim(p_address_line), ''),
    nullif(trim(p_city), ''),
    nullif(trim(p_province), ''),
    nullif(trim(p_postal_code), ''),
    nullif(trim(p_id_type), ''),
    right(v_id_number, 4),
    v_id_number,
    v_id_hash,
    nullif(trim(p_payout_name_to_match), ''),
    v_submit_status,
    v_auto_status,
    v_auto_notes,
    case when v_auto_status = 'passed' then 'passed' else 'needs_review' end,
    v_system_checks,
    true,
    now(),
    'admin_review',
    case when coalesce((v_system_checks #>> '{registered_name,ok}')::boolean, false) then 'matched' else 'admin_review' end,
    case when coalesce((v_system_checks #>> '{birthdate,ok}')::boolean, false) then 'matched' else 'admin_review' end
  )
  on conflict (profile_id) do update set
    legal_name = excluded.legal_name,
    birthdate = excluded.birthdate,
    address_line = excluded.address_line,
    city = excluded.city,
    province = excluded.province,
    postal_code = excluded.postal_code,
    id_type = excluded.id_type,
    id_number_last4 = excluded.id_number_last4,
    id_number = excluded.id_number,
    id_number_hash = excluded.id_number_hash,
    payout_name_to_match = excluded.payout_name_to_match,
    status = excluded.status,
    auto_check_status = excluded.auto_check_status,
    auto_check_notes = excluded.auto_check_notes,
    system_check_status = excluded.system_check_status,
    system_check_results = excluded.system_check_results,
    customer_confirmed = true,
    submitted_at = now(),
    admin_note = null,
    face_match_status = excluded.face_match_status,
    name_match_status = excluded.name_match_status,
    birthday_match_status = excluded.birthday_match_status
  returning id into v_kyc_id;

  delete from public.kyc_documents
  where kyc_profile_id = v_kyc_id
    and document_type in ('valid_id_front','valid_id_back','selfie','address_proof');

  insert into public.kyc_documents(kyc_profile_id, profile_id, document_type, file_url, metadata)
  values
    (v_kyc_id, v_profile_id, 'valid_id_front', p_valid_id_front_url, jsonb_build_object('system_check', 'received')),
    (v_kyc_id, v_profile_id, 'valid_id_back', p_valid_id_back_url, jsonb_build_object('system_check', 'received')),
    (v_kyc_id, v_profile_id, 'selfie', p_selfie_url, jsonb_build_object('system_check', 'face_match_admin_final'));

  if nullif(trim(coalesce(p_address_proof_url, '')), '') is not null then
    insert into public.kyc_documents(kyc_profile_id, profile_id, document_type, file_url)
    values (v_kyc_id, v_profile_id, 'address_proof', p_address_proof_url);
  end if;

  update public.profiles
  set verification_status = 'needs_review',
      kyc_notes = case
        when v_submit_status = 'duplicate_risk' then 'KYC submitted with duplicate risk. Admin review required.'
        when v_submit_status = 'high_risk' then 'KYC submitted with system check flags. Admin review required.'
        else 'KYC submitted and waiting for admin review'
      end
  where id = v_profile_id;

  perform public.log_customer_evidence(
    v_profile_id,
    'kyc_submitted',
    'Customer submitted KYC with system checks',
    'Customer submitted KYC. System checks ran first; admin remains final reviewer.',
    'customer_kyc_profiles',
    v_kyc_id,
    null,
    v_auto_notes
  );

  insert into public.inbox_items(profile_id, category, title, body, source_table, source_id)
  values (
    v_profile_id,
    'kyc',
    case
      when v_submit_status = 'duplicate_risk' then 'KYC sent for review'
      when v_submit_status = 'high_risk' then 'KYC sent with items to review'
      else 'KYC submitted'
    end,
    case
      when v_submit_status in ('duplicate_risk','high_risk')
        then 'Your KYC was sent, but some details need admin review. Withdrawals stay locked until approval.'
      else 'Your verification is now waiting for admin review. Withdrawals stay locked until approval.'
    end,
    'customer_kyc_profiles',
    v_kyc_id
  );

  return v_kyc_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_support_send_message(p_session_id uuid DEFAULT NULL::uuid, p_body text DEFAULT ''::text, p_force_escalate boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile_id uuid;
  v_session_id uuid;
  v_needs_escalation boolean;
  v_risk text;
  v_related text;
begin
  v_profile_id := public.current_profile_id();

  if v_profile_id is null then
    raise exception 'Login required';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception 'Message is required';
  end if;

  v_needs_escalation := p_force_escalate or public.kafarm_support_needs_escalation(p_body);
  v_risk := public.kafarm_support_risk_level(p_body);
  v_related := public.kafarm_support_related_record(p_body);

  if p_session_id is null then
    insert into public.support_chat_sessions(
      owner_profile_id,
      role,
      title,
      issue_summary,
      risk_level,
      related_record_label,
      suggested_reply,
      status,
      escalated_at,
      metadata
    )
    values (
      v_profile_id,
      'customer',
      'Customer support chat',
      left(trim(p_body), 160),
      v_risk,
      v_related,
      'Hi, admin joined the chat. I will review the related records first before making any decision.',
      case when v_needs_escalation then 'escalated' else 'open' end,
      case when v_needs_escalation then now() else null end,
      jsonb_build_object('created_by', 'customer_support_send_message')
    )
    returning id into v_session_id;
  else
    select id into v_session_id
    from public.support_chat_sessions
    where id = p_session_id
      and owner_profile_id = v_profile_id
    for update;

    if v_session_id is null then
      raise exception 'Chat session not found';
    end if;

    if exists(select 1 from public.support_chat_sessions where id=v_session_id and status in ('ended','completed')) then
      raise exception 'CHAT_CLOSED';
    end if;

    update public.support_chat_sessions
    set updated_at = now(),
        risk_level = case
          when v_risk = 'high' then 'high'
          when risk_level = 'low' and v_risk = 'medium' then 'medium'
          else risk_level
        end,
        status = case when v_needs_escalation and status in ('open','kafarm_solved') then 'escalated' else status end,
        escalated_at = case when v_needs_escalation and escalated_at is null then now() else escalated_at end,
        issue_summary = coalesce(issue_summary, left(trim(p_body), 160)),
        related_record_label = coalesce(related_record_label, v_related)
    where id = v_session_id;
  end if;

  insert into public.support_chat_messages(
    session_id,
    sender_role,
    sender_profile_id,
    body,
    metadata
  )
  values (
    v_session_id,
    'customer',
    v_profile_id,
    trim(p_body),
    jsonb_build_object('needs_escalation', v_needs_escalation)
  );

  if v_needs_escalation then
    insert into public.support_chat_messages(session_id, sender_role, body, metadata)
    values (
      v_session_id,
      'kafarm',
      'I escalated this to live admin. I included the issue summary, risk reason, and chat trail. Admin must approve any sensitive action.',
      jsonb_build_object('auto_message', true)
    );

    perform public.log_support_chat_evidence(
      v_session_id,
      'support_chat_escalated',
      'Customer support chat escalated',
      'KaFarm escalated a customer support chat for admin review.',
      jsonb_build_object('risk_level', v_risk, 'related_record', v_related)
    );
  end if;

  return v_session_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.caretaker_support_send_message(p_session_id uuid DEFAULT NULL::uuid, p_body text DEFAULT ''::text, p_force_escalate boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caretaker_id uuid;
  v_session_id uuid;
  v_needs_escalation boolean;
  v_risk text;
  v_related text;
begin
  v_caretaker_id := public.current_caretaker_id();

  if v_caretaker_id is null then
    raise exception 'Caretaker login required';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception 'Message is required';
  end if;

  v_needs_escalation := p_force_escalate or public.kafarm_support_needs_escalation(p_body);
  v_risk := public.kafarm_support_risk_level(p_body);
  v_related := public.kafarm_support_related_record(p_body);

  if p_session_id is null then
    insert into public.support_chat_sessions(
      owner_caretaker_id,
      role,
      title,
      issue_summary,
      risk_level,
      related_record_label,
      suggested_reply,
      status,
      escalated_at,
      metadata
    )
    values (
      v_caretaker_id,
      'caretaker',
      'Caretaker support chat',
      left(trim(p_body), 160),
      v_risk,
      v_related,
      'Admin here. Send requester name, rooster tag, pen, and current proof status before I release any exception.',
      case when v_needs_escalation then 'escalated' else 'open' end,
      case when v_needs_escalation then now() else null end,
      jsonb_build_object('created_by', 'caretaker_support_send_message')
    )
    returning id into v_session_id;
  else
    select id into v_session_id
    from public.support_chat_sessions
    where id = p_session_id
      and owner_caretaker_id = v_caretaker_id
    for update;

    if v_session_id is null then
      raise exception 'Chat session not found';
    end if;

    if exists(select 1 from public.support_chat_sessions where id=v_session_id and status in ('ended','completed')) then
      raise exception 'CHAT_CLOSED';
    end if;

    update public.support_chat_sessions
    set updated_at = now(),
        risk_level = case
          when v_risk = 'high' then 'high'
          when risk_level = 'low' and v_risk = 'medium' then 'medium'
          else risk_level
        end,
        status = case when v_needs_escalation and status in ('open','kafarm_solved') then 'escalated' else status end,
        escalated_at = case when v_needs_escalation and escalated_at is null then now() else escalated_at end,
        issue_summary = coalesce(issue_summary, left(trim(p_body), 160)),
        related_record_label = coalesce(related_record_label, v_related)
    where id = v_session_id;
  end if;

  insert into public.support_chat_messages(
    session_id,
    sender_role,
    sender_caretaker_id,
    body,
    metadata
  )
  values (
    v_session_id,
    'caretaker',
    v_caretaker_id,
    trim(p_body),
    jsonb_build_object('needs_escalation', v_needs_escalation)
  );

  if v_needs_escalation then
    insert into public.support_chat_messages(session_id, sender_role, body, metadata)
    values (
      v_session_id,
      'kafarm',
      'I escalated this to admin. No serial exception, QR bypass, or customer update should happen until admin reviews it.',
      jsonb_build_object('auto_message', true)
    );

    perform public.log_support_chat_evidence(
      v_session_id,
      'support_chat_escalated',
      'Caretaker support chat escalated',
      'KaFarm escalated a caretaker support chat for admin review.',
      jsonb_build_object('risk_level', v_risk, 'related_record', v_related)
    );
  end if;

  return v_session_id;
end;
$function$;

revoke all on function public.kafarm_support_send_message(uuid,text,jsonb) from public,anon;
revoke all on function public.customer_submit_kyc(text,date,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.customer_support_send_message(uuid,text,boolean) from public,anon;
revoke all on function public.caretaker_support_send_message(uuid,text,boolean) from public,anon;
grant execute on function public.kafarm_support_send_message(uuid,text,jsonb) to authenticated;
grant execute on function public.customer_submit_kyc(text,date,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.customer_support_send_message(uuid,text,boolean) to authenticated;
grant execute on function public.caretaker_support_send_message(uuid,text,boolean) to authenticated;
commit;
select jsonb_build_object(
 'migration','092_kyc_and_support_state_guards',
 'reply_null_guard',position('coalesce(public.is_admin(), false)' in pg_get_functiondef('public.kafarm_support_send_message(uuid,text,jsonb)'::regprocedure))>0,
 'kyc_state_guard',position('KYC_ALREADY_SUBMITTED_OR_APPROVED' in pg_get_functiondef('public.customer_submit_kyc(text,date,text,text,text,text,text,text,text,text,text,text,text)'::regprocedure))>0,
 'customer_closed_guard',position('CHAT_CLOSED' in pg_get_functiondef('public.customer_support_send_message(uuid,text,boolean)'::regprocedure))>0,
 'caretaker_closed_guard',position('CHAT_CLOSED' in pg_get_functiondef('public.caretaker_support_send_message(uuid,text,boolean)'::regprocedure))>0,
 'business_records_changed',false
) as verification;
