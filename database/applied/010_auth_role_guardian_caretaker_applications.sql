-- FarmConnect Auth Role Guardian + Caretaker Applications
-- Safer model: applicants submit an application only.
-- No applicant can assign their own caretaker/admin role.
-- Admin approval is the only path that creates/activates a caretaker profile.

create table if not exists public.caretaker_applications (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  email text not null,
  full_name text not null,
  display_name text,
  phone text not null,
  birthdate date,
  address_line text,
  avatar_url text,
  resume_url text not null,
  farm_role text,
  payment_method text,
  payment_account_name text,
  payment_account_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  work_pin_set boolean not null default false,
  status text not null default 'pending_approval',
  admin_note text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_profile_id uuid references public.profiles(id) on delete set null,
  created_caretaker_id uuid references public.caretakers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint caretaker_applications_status_check
    check (status in ('pending_approval', 'needs_info', 'approved', 'rejected'))
);

create unique index if not exists caretaker_applications_auth_user_pending_key
on public.caretaker_applications(auth_user_id)
where status in ('pending_approval', 'needs_info');

create table if not exists public.caretaker_application_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.caretaker_applications(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.caretaker_applications enable row level security;
alter table public.caretaker_application_logs enable row level security;

drop policy if exists "caretaker applications read own or admin" on public.caretaker_applications;
create policy "caretaker applications read own or admin"
on public.caretaker_applications
for select
to authenticated
using (auth_user_id = auth.uid() or is_admin());

drop policy if exists "caretaker application logs read admin" on public.caretaker_application_logs;
create policy "caretaker application logs read admin"
on public.caretaker_application_logs
for select
to authenticated
using (is_admin());

create or replace function public.submit_caretaker_application(
  p_full_name text,
  p_display_name text,
  p_phone text,
  p_birthdate date,
  p_address_line text,
  p_avatar_url text,
  p_resume_url text,
  p_farm_role text,
  p_payment_method text,
  p_payment_account_name text,
  p_payment_account_number text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_work_pin_set boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_email text;
  v_application_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'Login required';
  end if;

  select email into v_email
  from auth.users
  where id = v_auth_user_id;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Full name is required';
  end if;

  if nullif(trim(p_phone), '') is null then
    raise exception 'Phone is required';
  end if;

  if nullif(trim(p_resume_url), '') is null then
    raise exception 'Resume is required';
  end if;

  insert into public.caretaker_applications (
    auth_user_id,
    email,
    full_name,
    display_name,
    phone,
    birthdate,
    address_line,
    avatar_url,
    resume_url,
    farm_role,
    payment_method,
    payment_account_name,
    payment_account_number,
    emergency_contact_name,
    emergency_contact_phone,
    work_pin_set,
    status,
    updated_at
  )
  values (
    v_auth_user_id,
    coalesce(v_email, ''),
    trim(p_full_name),
    coalesce(nullif(trim(p_display_name), ''), trim(p_full_name)),
    trim(p_phone),
    p_birthdate,
    nullif(trim(p_address_line), ''),
    nullif(trim(p_avatar_url), ''),
    trim(p_resume_url),
    nullif(trim(p_farm_role), ''),
    nullif(trim(p_payment_method), ''),
    nullif(trim(p_payment_account_name), ''),
    nullif(trim(p_payment_account_number), ''),
    nullif(trim(p_emergency_contact_name), ''),
    nullif(trim(p_emergency_contact_phone), ''),
    coalesce(p_work_pin_set, false),
    'pending_approval',
    now()
  )
  on conflict (auth_user_id) where status in ('pending_approval', 'needs_info')
  do update set
    full_name = excluded.full_name,
    display_name = excluded.display_name,
    phone = excluded.phone,
    birthdate = excluded.birthdate,
    address_line = excluded.address_line,
    avatar_url = excluded.avatar_url,
    resume_url = excluded.resume_url,
    farm_role = excluded.farm_role,
    payment_method = excluded.payment_method,
    payment_account_name = excluded.payment_account_name,
    payment_account_number = excluded.payment_account_number,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    work_pin_set = excluded.work_pin_set,
    status = 'pending_approval',
    updated_at = now()
  returning id into v_application_id;

  insert into public.caretaker_application_logs (
    application_id,
    action,
    note,
    metadata
  )
  values (
    v_application_id,
    'submitted',
    'Caretaker application submitted for admin approval.',
    jsonb_build_object(
      'email', v_email,
      'farm_role', p_farm_role,
      'payment_method', p_payment_method,
      'has_resume', nullif(trim(p_resume_url), '') is not null,
      'has_avatar', nullif(trim(p_avatar_url), '') is not null
    )
  );

  return v_application_id;
end;
$$;

create or replace function public.admin_review_caretaker_application(
  p_application_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_profile_id uuid;
  v_app public.caretaker_applications%rowtype;
  v_profile_id uuid;
  v_caretaker_id uuid;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  if p_decision not in ('approved', 'rejected', 'needs_info') then
    raise exception 'Invalid caretaker review decision';
  end if;

  select current_profile_id() into v_admin_profile_id;

  select * into v_app
  from public.caretaker_applications
  where id = p_application_id
  for update;

  if v_app.id is null then
    raise exception 'Caretaker application not found';
  end if;

  if p_decision = 'approved' then
    select id into v_profile_id
    from public.profiles
    where auth_user_id = v_app.auth_user_id
    limit 1;

    if v_profile_id is null then
      insert into public.profiles (
        auth_user_id,
        email,
        phone,
        full_name,
        display_name,
        avatar_url,
        role,
        account_status,
        verification_status,
        membership_status,
        birthdate
      )
      values (
        v_app.auth_user_id,
        v_app.email,
        v_app.phone,
        v_app.full_name,
        coalesce(v_app.display_name, v_app.full_name),
        v_app.avatar_url,
        'caretaker',
        'active',
        'pending',
        'inactive',
        v_app.birthdate
      )
      returning id into v_profile_id;
    else
      update public.profiles
      set email = v_app.email,
          phone = v_app.phone,
          full_name = v_app.full_name,
          display_name = coalesce(v_app.display_name, v_app.full_name),
          avatar_url = coalesce(v_app.avatar_url, avatar_url),
          role = 'caretaker',
          account_status = 'active',
          verification_status = coalesce(verification_status, 'pending'),
          birthdate = v_app.birthdate,
          updated_at = now()
      where id = v_profile_id;
    end if;

    insert into public.caretakers (
      profile_id,
      caretaker_profile_id,
      email,
      full_name,
      display_name,
      phone,
      avatar_url,
      resume_url,
      farm_role,
      status,
      payment_mode,
      payment_account_name,
      payment_account_number,
      payout_method,
      payout_details,
      work_pin_set,
      resume_review_status,
      resume_reviewed_by,
      resume_reviewed_at,
      created_at,
      updated_at
    )
    values (
      v_profile_id,
      v_profile_id,
      v_app.email,
      v_app.full_name,
      coalesce(v_app.display_name, v_app.full_name),
      v_app.phone,
      v_app.avatar_url,
      v_app.resume_url,
      v_app.farm_role,
      'active',
      v_app.payment_method,
      v_app.payment_account_name,
      v_app.payment_account_number,
      v_app.payment_method,
      jsonb_build_object(
        'method', v_app.payment_method,
        'account_name', v_app.payment_account_name,
        'account_number', v_app.payment_account_number,
        'emergency_contact_name', v_app.emergency_contact_name,
        'emergency_contact_phone', v_app.emergency_contact_phone
      ),
      v_app.work_pin_set,
      'approved',
      v_admin_profile_id,
      now(),
      now(),
      now()
    )
    on conflict (phone) do update
      set profile_id = excluded.profile_id,
          caretaker_profile_id = excluded.caretaker_profile_id,
          email = excluded.email,
          full_name = excluded.full_name,
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url,
          resume_url = excluded.resume_url,
          farm_role = excluded.farm_role,
          status = 'active',
          payment_mode = excluded.payment_mode,
          payment_account_name = excluded.payment_account_name,
          payment_account_number = excluded.payment_account_number,
          payout_method = excluded.payout_method,
          payout_details = excluded.payout_details,
          work_pin_set = excluded.work_pin_set,
          resume_review_status = 'approved',
          resume_reviewed_by = v_admin_profile_id,
          resume_reviewed_at = now(),
          updated_at = now()
    returning id into v_caretaker_id;
  end if;

  update public.caretaker_applications
  set status = p_decision,
      admin_note = p_note,
      reviewed_by_profile_id = v_admin_profile_id,
      reviewed_at = now(),
      created_profile_id = coalesce(v_profile_id, created_profile_id),
      created_caretaker_id = coalesce(v_caretaker_id, created_caretaker_id),
      updated_at = now()
  where id = p_application_id;

  insert into public.caretaker_application_logs (
    application_id,
    profile_id,
    action,
    note,
    metadata,
    created_by_profile_id
  )
  values (
    p_application_id,
    v_profile_id,
    'admin_' || p_decision,
    p_note,
    jsonb_build_object('decision', p_decision, 'caretaker_id', v_caretaker_id),
    v_admin_profile_id
  );

  return p_application_id;
end;
$$;

grant execute on function public.submit_caretaker_application(
  text, text, text, date, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

grant execute on function public.admin_review_caretaker_application(uuid, text, text) to authenticated;

alter table public.caretakers enable row level security;

drop policy if exists "caretakers read own or admin" on public.caretakers;
create policy "caretakers read own or admin"
on public.caretakers
for select
to authenticated
using (
  profile_id = current_profile_id()
  or caretaker_profile_id = current_profile_id()
  or is_admin()
);
