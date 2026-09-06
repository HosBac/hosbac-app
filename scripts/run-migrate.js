import fs from 'fs';
import handler from './migrate.js';

if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

handler({}, {
  status: (code) => ({
    json: (data) => {
      console.log("Migration terminée avec succès !", code, data);
      process.exit(0);
    }
  })
}).catch(err => {
  console.error("Erreur lors de la migration :", err);
  process.exit(1);
});
