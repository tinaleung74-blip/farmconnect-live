import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function envFile(file){
  if(!fs.existsSync(file))return {};
  return Object.fromEntries(fs.readFileSync(file,"utf8").split(/\r?\n/)
    .map(line=>line.match(/^([^#=]+)=(.*)$/)).filter(Boolean)
    .map(match=>[match[1].trim(),match[2].trim().replace(/^['"]|['"]$/g,"")]));
}
const env={...envFile(path.join(process.cwd(),".env.local")),...process.env};
const url=env.NEXT_PUBLIC_SUPABASE_URL;
const key=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const customerEmail=env.E2E_CUSTOMER_EMAIL;
const customerPassword=env.E2E_CUSTOMER_PASSWORD;
const adminEmail=env.E2E_ADMIN_EMAIL;
const adminPassword=env.E2E_ADMIN_PASSWORD;
if(!url||!key||!customerEmail||!customerPassword||!adminEmail||!adminPassword){
  console.error("Recovery Guard E2E requires Supabase URL/anon key and isolated E2E customer/admin credentials.");
  process.exit(2);
}
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function login(email,password){const value=client();const auth=await value.auth.signInWithPassword({email,password});if(auth.error)throw auth.error;return value;}
async function rpc(db,name,args){const result=await db.rpc(name,args);if(result.error)throw result.error;return result.data;}

const customer=await login(customerEmail,customerPassword);
const operation=crypto.randomUUID();
const correlation=crypto.randomUUID();
const input={p_operation_id:operation,p_correlation_id:correlation,p_workflow:"support_delivery",p_action:"send_message",
  p_route:"/e2e/recovery-guard",p_target_type:"support_session",p_target_id:null,p_request_fingerprint:"e2e-safe-fingerprint"};
const first=await rpc(customer,"kafarm_recovery_begin",input);
if(first.duplicate!==false||first.status!=="created")throw Error("first begin was not created");
const duplicate=await rpc(customer,"kafarm_recovery_begin",input);
if(duplicate.duplicate!==true||duplicate.status!=="created")throw Error("same operation was not idempotent");
const changed=await customer.rpc("kafarm_recovery_begin",{...input,p_request_fingerprint:"changed"});
if(!changed.error||!String(changed.error.message).includes("OPERATION_PAYLOAD_CHANGED"))throw Error("changed payload was not rejected");
const sending=await rpc(customer,"kafarm_recovery_mark_sending",{p_operation_id:operation});
if(sending.status!=="sending")throw Error("operation did not enter sending");
const failed=await rpc(customer,"kafarm_recovery_mark_error",{p_operation_id:operation,p_retryable:true,
  p_error_code:"E2E_TIMEOUT",p_error_source:"network",p_error_message_safe:"The isolated E2E request timed out.",p_technical_error_ref:null});
if(failed.status!=="failed_retryable")throw Error("retryable error was misclassified");
const reconciled=await rpc(customer,"kafarm_recovery_reconcile",{p_operation_id:operation});
if(reconciled.state!=="manual_review"||reconciled.verified!==true)throw Error("uncommitted operation did not reach verified manual review");

const admin=await login(adminEmail,adminPassword);
const dead=await rpc(admin,"kafarm_recovery_admin_action",{p_operation_id:operation,p_action:"dead_letter",p_reason:"E2E verified unresolved operation"});
if(dead.status!=="dead_letter")throw Error("admin dead-letter action failed");
const rows=await admin.from("kafarm_recovery_operations").select("status,error_code,error_source").eq("operation_id",operation).single();
if(rows.error||rows.data.status!=="dead_letter"||rows.data.error_code!=="E2E_TIMEOUT")throw Error("ledger did not preserve final state/error");
const audit=await admin.from("kafarm_recovery_audit").select("action,to_status,verified").eq("operation_id",operation);
if(audit.error||!audit.data?.some(row=>row.action==="dead_letter"&&row.to_status==="dead_letter"&&row.verified))throw Error("audited admin action missing");
const incident=await admin.from("kafarm_recovery_incidents").select("status,occurrence_count,operation_ids").contains("operation_ids",[operation]);
if(incident.error||!incident.data?.length)throw Error("incident queue record missing");
console.log(JSON.stringify({passed:true,operation_id:operation,checks:[
  "unique operation ID","changed payload rejected","strict transition","safe error classification",
  "verified reconciliation","dead letter","incident queue","audit log"
]},null,2));
