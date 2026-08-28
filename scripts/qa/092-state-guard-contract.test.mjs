import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync('database/applied/092_kyc_and_support_state_guards.sql','utf8');
const definitions=sql.split('CREATE OR REPLACE FUNCTION public.').slice(1);
const fn=name=>definitions.find(s=>s.startsWith(name+'('));
test('092 SQL source: four terminated replacements inside a transaction',()=>{
 assert.equal(definitions.length,4);assert.equal((sql.match(/^\$function\$;/gm)||[]).length,4);assert.match(sql,/begin;[\s\S]*commit;/);
});
test('092 SQL source: reply permission rejects null results',()=>{
 const reply=fn('kafarm_support_send_message');
 assert.match(reply,/auth.uid\(\) is null/);
 for(const expr of ['public.is_admin()', 'v_session.owner_profile_id = v_profile_id','v_session.owner_caretaker_id = v_caretaker_id'])assert.ok(reply.includes(`coalesce(${expr}, false)`));
 assert.match(reply,/where id = p_session_id for update/);
});
test('092 SQL source: KYC state check happens under lock before overwrite',()=>{
 const kyc=fn('customer_submit_kyc');
 assert.match(kyc,/pg_advisory_xact_lock/);assert.match(kyc,/where profile_id=v_profile_id for update/);
 assert.ok(kyc.indexOf('KYC_ALREADY_SUBMITTED_OR_APPROVED')<kyc.indexOf('insert into public.customer_kyc_profiles'));
 assert.match(kyc,/role = 'customer'/);
});
for(const name of ['customer_support_send_message','caretaker_support_send_message'])test(`092 SQL source: ${name} checks closed state before message insert`,()=>{
 const body=fn(name);assert.match(body,/for update;/);assert.ok(body.indexOf('CHAT_CLOSED')<body.indexOf('insert into public.support_chat_messages'));
});
