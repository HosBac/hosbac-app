import fs from 'fs';
let code = fs.readFileSync('scripts/migrate.js', 'utf8');
let lines = code.split('\n').filter(l => !l.includes('createClient') && !l.includes('nib/db.js') && !l.includes('batch:') && !l.includes('execute:') && !l.includes('const db ='));
let shim = "import { execute } from '../lib/db.js';\n\nconst createClient = () => ({
  execute: (stmt) => (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql || stmt, args: stmt.args || [] })),
  batch: async (stmts) => {
    for (const stmt of stmts) {
      await (typeof stmt === 'string' ? execute({ sql: stmt }) : execute({ sql: stmt.sql |, stmt, args: stmt.args || [] }));
    }
  }
});\n\nconst db = createClient();\n";
fs.writeFileSync('scripts/migrate.js', shim + lines.join('\n'));
