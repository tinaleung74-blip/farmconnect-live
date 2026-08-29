import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql=fs.readFileSync("database/applied/094_kafarm_recovery_guard_mvp.sql","utf8");
const client=fs.readFileSync("lib/recovery-guard.ts","utf8");
const support=fs.readFileSync("lib/support-conversation.tsx","utf8");
const admin=fs.readFileSync("app/admin/kafarm/recovery-guard/page.tsx","utf8");

test("database enforces one operation ID and immutable operation identity",()=>{
  assert.match(sql,/operation_id uuid primary key/);
  assert.match(sql,/unique \(actor_auth_id, workflow, operation_id\)/);
  assert.match(sql,/OPERATION_PAYLOAD_CHANGED/);
  assert.match(sql,/RECOVERY_OPERATION_IDENTITY_IMMUTABLE/);
  assert.match(sql,/pg_advisory_xact_lock/);
});

test("strict recovery states include retry, reconciliation, terminal and dead letter",()=>{
  for(const state of ["created","sending","received","processing","completed","failed_retryable","retrying","reconciling","failed_terminal","manual_review","dead_letter"]){
    assert.ok(sql.includes("'"+state+"'"),state);
  }
  assert.match(sql,/RECOVERY_STATUS_TRANSITION_NOT_ALLOWED/);
  assert.match(sql,/kafarm_recovery_transition_allowed/);
});

test("safe error model separates public error data from technical reference",()=>{
  for(const column of ["error_code text","error_source text","error_message_safe text","technical_error_ref uuid","last_attempt_at timestamptz"]){
    assert.ok(sql.includes(column),column);
  }
  assert.doesNotMatch(sql,/stack_trace|authorization_header|service_role_key|raw_secret/i);
  assert.match(sql,/safe_error_length/);
});

test("reconciliation verifies authoritative support records before success",()=>{
  assert.match(sql,/from public\.support_delivery_operations/);
  assert.match(sql,/from public\.support_delivery_cancellations/);
  assert.match(sql,/Authoritative support delivery receipt verified/);
  assert.match(sql,/No authoritative committed result was found/);
  assert.match(sql,/status='manual_review'/);
});

test("dead letter, incidents, and recovery audit are durable and admin guarded",()=>{
  assert.match(sql,/create table if not exists public\.kafarm_recovery_audit/);
  assert.match(sql,/create table if not exists public\.kafarm_recovery_incidents/);
  assert.match(sql,/public\.is_admin\(\)/);
  assert.match(sql,/RECOVERY_REASON_REQUIRED/);
  assert.match(sql,/revoke all on public\.kafarm_recovery_operations from public,anon,authenticated/);
});

test("support records ledger before send and reconciles before declaring Sent",()=>{
  const begin=support.indexOf("beginRecoveryOperation");
  const send=support.indexOf('supabase.rpc("support_send_guarded"');
  const verify=support.indexOf("reconcileRecoveryOperation",send);
  const sent=support.indexOf('setNote("Sent")',verify);
  assert.ok(begin>0 && begin<send);
  assert.ok(send<verify && verify<sent);
  assert.match(support,/safeFingerprint/);
  assert.match(support,/draft\.correlation \|\| crypto\.randomUUID/);
});

test("safe reads retry at most three times and sensitive helper has no blind write retry",()=>{
  assert.match(client,/Math\.min\(3/);
  assert.match(client,/retrySafeRead/);
  assert.doesNotMatch(client,/retry.*support_send_guarded|retry.*payment|retry.*withdrawal/i);
});

test("admin recovery screen exposes verification and audited review, not business mutation",()=>{
  assert.match(admin,/Checking…":"Verify DB"/);
  assert.match(admin,/Manual Review/);
  assert.match(admin,/Dead Letter/);
  assert.match(admin,/kafarm_recovery_admin_action/);
  assert.doesNotMatch(admin,/approve.*payment|complete.*withdrawal|transfer.*ownership/i);
});
