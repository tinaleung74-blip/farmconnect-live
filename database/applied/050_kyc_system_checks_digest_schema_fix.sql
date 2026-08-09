-- FarmConnect KYC system-check digest schema repair.
-- Preserves the live run_kyc_system_checks function and only schema-qualifies
-- its pgcrypto digest() calls. No KYC/customer row is changed by this migration.

do $repair$
declare
  v_signature regprocedure := to_regprocedure(
    'public.run_kyc_system_checks(uuid,text,date,text,text,text,text,text,text,text,text,text)'
  );
  v_crypto_schema text;
  v_definition text;
  v_repaired_definition text;
  v_qualified_call text;
begin
  if v_signature is null then
    raise exception 'RUN_KYC_SYSTEM_CHECKS_NOT_FOUND';
  end if;

  select e.extnamespace::regnamespace::text
    into v_crypto_schema
  from pg_extension e
  where e.extname = 'pgcrypto';

  if v_crypto_schema is null then
    raise exception 'PGCRYPTO_EXTENSION_NOT_FOUND';
  end if;

  select pg_get_functiondef(v_signature::oid)
    into v_definition;

  v_qualified_call := quote_ident(v_crypto_schema) || '.digest(';
  v_repaired_definition := regexp_replace(
    v_definition,
    '(^|[^.[:alnum:]_])digest[[:space:]]*\(',
    '\1' || v_qualified_call,
    'gi'
  );

  if v_repaired_definition <> v_definition then
    execute v_repaired_definition;
  end if;

  select pg_get_functiondef(v_signature::oid)
    into v_repaired_definition;

  if position(v_qualified_call in v_repaired_definition) = 0 then
    raise exception 'KYC_SYSTEM_CHECKS_DIGEST_SCHEMA_REPAIR_NOT_VERIFIED';
  end if;

  if v_repaired_definition ~* '(^|[^.[:alnum:]_])digest[[:space:]]*\(' then
    raise exception 'UNQUALIFIED_KYC_SYSTEM_CHECKS_DIGEST_REMAINS';
  end if;
end
$repair$;
