import fs from 'fs';
if (fs.existsSync('.env')) {
  let content = fs.readFileSync('.env', 'utf8');
  content = content.replace(/libsql:\/\//g, 'https://');
  fs.writeFileSync('.env', content);
  console.log("URL Turso convertie en https:// dans le .env !");
}
