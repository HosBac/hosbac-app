export async function execute({ sql, args = [] }) {
  const baseUrl = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://');
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Variables Turso manquantes (TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN)");
  }

  const formattedArgs = args.map(arg => {
    if (typeof arg === 'number') return { type: 'integer', value: String(arg) };
    if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
    return { type: 'text', value: String(arg ?? '') };
  });

  const res = await fetch(`${baseUrl}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: formattedArgs } },
        { type: 'close' }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur Turso (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const result = data.results?.[0]?.response?.result;

  if (!result) return { rows: [] };

  const cols = result.cols.map(c => c.name);
  const rows = (result.rows || []).map(row => {
    const obj = {};
    row.forEach((val, i) => {
      obj[cols[i]] = val.value !== undefined ? val.value : null;
    });
    return obj;
  });

  return { rows };
}
