import fs from 'fs';
if (fs.existsSync('.env')) {
  let content = fs.readFileSync('.env', 'utf8');
  content = content.replace(/"/g, ''); // Supprime tous les guillemets
  fs.writeFileSync('.env', content);
  console.log("Fichier .env nettoyé des guillemets !");
}
