// Read-only source inventory. This does not connect to Supabase or execute workflows.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]);
const sqlFunctions = new Map();
for (const file of files('database/applied').filter(f => f.endsWith('.sql')).sort()) {
  const text = fs.readFileSync(file,'utf8');
  for (const match of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*returns/gi)) {
    const parameters = [...match[2].matchAll(/\b(p_\w+)\s+(?:uuid|text|boolean|jsonb|numeric|integer|int|date|timestamptz|bigint)/gi)].map(m=>m[1]);
    sqlFunctions.set(match[1], { file, parameters });
  }
}
const calls = [];
for (const file of [...files('lib'),...files('app')].filter(f => /\.tsx?$/.test(f))) {
  const source = ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text==='rpc') {
      const name = node.arguments[0];
      const payload = node.arguments[1];
      const rpc = name && ts.isStringLiteral(name) ? name.text : '<dynamic>';
      const params = payload && ts.isObjectLiteralExpression(payload) ? payload.properties.flatMap(p=>p.name && (ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)) ? [p.name.text] : []) : [];
      const definition = sqlFunctions.get(rpc);
      calls.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line+1, rpc,
        status: rpc==='<dynamic>' ? 'dynamic: manual check' : !definition ? 'no checked-in definition' : params.some(p=>!definition.parameters.includes(p)) ? 'parameter mismatch' : 'name/parameter names match',
        unexpected: definition ? params.filter(p=>!definition.parameters.includes(p)) : params });
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
}
console.log(JSON.stringify({scope:'static name/parameter-name inventory only; no grants, types, live signatures or runtime verification', totalCallSites:calls.length, matched:calls.filter(c=>c.status==='name/parameter names match').length, attention:calls.filter(c=>c.status!=='name/parameter names match')},null,2));
