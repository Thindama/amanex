// ── ADMIN-PASSWORT GENERATOR
// Ausfuehren mit: node scripts/create-admin.js
// Generiert einen sicheren bcrypt-Hash und gibt den SQL-Befehl aus

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('\n=== Amanex Admin-Passwort Generator ===\n');

rl.question('E-Mail des Admins: ', (email) => {
  rl.question('Passwort waehlen (min. 8 Zeichen): ', async (password) => {
    if (!email || !email.includes('@')) {
      console.log('\nFehler: Ungueltige E-Mail.');
      rl.close();
      return;
    }
    if (password.length < 8) {
      console.log('\nFehler: Passwort muss mindestens 8 Zeichen haben.');
      rl.close();
      return;
    }

    console.log('\nHash wird generiert...');
    const hash = await bcrypt.hash(password, 12);

    console.log('\n=== SQL fuer Supabase SQL-Editor ===\n');
    console.log('-- Admin-User anlegen oder Passwort aktualisieren:');
    console.log(`INSERT INTO users (email, password_hash, role)`);
    console.log(`VALUES ('${email}', '${hash}', 'admin')`);
    console.log(`ON CONFLICT (email) DO UPDATE SET password_hash = '${hash}', role = 'admin';`);
    console.log('\n=== Fertig ===');
    console.log('1. Den obigen SQL-Befehl in Supabase einfuegen und ausfuehren.');
    console.log('2. Mit der E-Mail und dem Passwort im Dashboard anmelden.\n');

    rl.close();
  });
});
