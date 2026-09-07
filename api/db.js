export async function executeQuery(sql, args = []) {
  const rawUrl = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL || '';
  const token = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN || '';

  if (!rawUrl || !token) {
    throw new Error("Variables TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN manquantes sur Vercel");
  }

  const httpUrl = rawUrl.replace(/^libsql:\/\//, 'https://').replace(/^sqlite:\/\//, 'https://');
  const url = `${httpUrl.replace(/\/$/, '')}/v2/pipeline`;

  const formattedArgs = args.map(arg => {
    if (arg === null || arg === undefined) return { type: 'null' };
    if (typeof arg === 'number') return { type: 'integer', value: String(arg) };
    return { type: 'text', value: String(arg) };
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: formattedArgs } },
        { type: 'close' }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erreur Turso HTTP (${res.status}): ${err}`);
  }

  const data = await res.json();
  const execResult = data.results?.[0]?.response?.result;

  if (!execResult) return { rows: [] };

  const cols = (execResult.cols || []).map(c => c.name);
  const rows = (execResult.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, idx) => {
      obj[cols[idx]] = cell.value;
    });
    return obj;
  });

  return { rows };
}

export default async function handler(req, res) {
  return res.status(200).json({ status: "Connecteur Turso HTTP prêt" });
}
