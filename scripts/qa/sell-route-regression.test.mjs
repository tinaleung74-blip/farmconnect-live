import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('lib/farmconnect-v1.tsx','utf8');
const sell=source.slice(source.indexOf('export function CustomerSellRooster()'),source.indexOf('export function CareLogsPage()'));
test('legacy sell route redirects to v2 preserving selected rooster',async()=>{
 const exports={};
 const code=ts.transpileModule(fs.readFileSync('app/customer/sell-rooster/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:()=>({redirect:url=>{throw Error(url)}})});
 await assert.rejects(exports.default({searchParams:Promise.resolve({id:'chosen-rooster'})}),/\/customer-v2\/sell-rooster\?id=chosen-rooster/);
 await assert.rejects(exports.default({searchParams:Promise.resolve({})}),/\/customer-v2\/roosters/);
});
test('older sell-chicken entry uses same redirect rather than old screen',()=>{
 assert.match(fs.readFileSync('app/customer/sell-chicken/page.tsx','utf8'),/export \{ default \} from "\.\.\/sell-rooster\/page"/);
});
test('customer links no longer point at legacy sell route',()=>{
 assert.doesNotMatch(source,/href=\{`\/customer\/sell-rooster/);
});
test('sell screen has separate evaluation and sale actions, without legacy serial/role text',()=>{
 assert.match(sell,/>Evaluate Price<\/button>/);
 assert.match(sell,/act\("sell"\)/);
 assert.doesNotMatch(sell,/Serial ID|Request Price Inspection|Optional note for caretaker|admin verification/);
 assert.match(sell,/requestRoosterSalePrice\(animal.id\)/);
 assert.match(sell,/confirmRoosterSale\(sale.id\)/);
});
test('unknown rooster ID cannot silently select the first owned rooster',async()=>{
 const ast=ts.createSourceFile('sell.tsx',sell,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let fn;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='load')fn=n;ts.forEachChild(n,walk)}walk(ast);
 let selected='unchanged',sale='unchanged',requests=0;
 const load=vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
  animalId:'missing',sequence:{current:0},setLoading(){},setLoadError(){},getCustomerOwnedRoosters:async()=>[{id:'other'}],getCustomerRoosterSaleRequest:async()=>{requests++},setAnimal:v=>selected=v,setSale:v=>sale=v,setMessage(){},
 });
 await load();assert.equal(selected,null);assert.equal(sale,null);assert.equal(requests,0);
});
