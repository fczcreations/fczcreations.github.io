// Détection et installation (pour l'utilisateur courant, sans droits administrateur) des polices sous Windows
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const POLICES = [
  { key: 'harm',  label: 'Harmonica',                 file: 'Harmonica.ttf',                regName: 'Harmonica (TrueType)',                  match: /^harmonica\b/i },
  { key: 'title', label: 'Cinzel Decorative',         file: 'CinzelDecorative-Regular.ttf', regName: 'Cinzel Decorative Regular (TrueType)',  match: /^cinzel decorative\b(?!.*\b(bold|black)\b)/i },
  { key: 'it',    label: 'Cormorant Garamond Italic', file: 'CormorantGaramond-Italic.ttf', regName: 'Cormorant Garamond Italic (TrueType)',  match: /^cormorant garamond\b.*\bitalic\b/i }
];
const CLE_MACHINE = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';
const CLE_UTILISATEUR = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';

function executer(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ err, stdout: stdout || '', stderr: stderr || '' }));
  });
}
// Sortie de « reg query » :   "    Arial (TrueType)    REG_SZ    arial.ttf"
function nomsValeurs(sortie) {
  const noms = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    const m = ligne.match(/^ {2,}(.+?) {2,}REG_[A-Z_]+(?: {2,}(.*))?$/);
    if (m) noms.push(m[1].trim());
  }
  return noms;
}
async function nomsInstalles() {
  const a = await executer('reg', ['query', CLE_MACHINE]);
  const b = await executer('reg', ['query', CLE_UTILISATEUR]);
  return nomsValeurs(a.stdout).concat(nomsValeurs(b.stdout));
}
async function etat() {
  if (process.platform !== 'win32') return { supported: false };
  const noms = await nomsInstalles();
  return { supported: true, fonts: POLICES.map(p => ({ key: p.key, label: p.label, installed: noms.some(n => p.match.test(n)) })) };
}
async function installer(dossierPolices) {
  if (process.platform !== 'win32') return { ok: false, error: "disponible seulement sous Windows" };
  try {
    const st = await etat();
    const manquantes = POLICES.filter(p => !st.fonts.find(f => f.key === p.key).installed);
    if (!manquantes.length) return { ok: true };
    const dest = path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts');
    fs.mkdirSync(dest, { recursive: true });
    const chemins = [];
    for (const p of manquantes) {
      const cible = path.join(dest, p.file);
      try { fs.writeFileSync(cible, fs.readFileSync(path.join(dossierPolices, p.file))); }
      catch (e) { if (!fs.existsSync(cible)) throw e; }   // fichier déjà présent et verrouillé : on le garde
      const r = await executer('reg', ['add', CLE_UTILISATEUR, '/v', p.regName, '/t', 'REG_SZ', '/d', cible, '/f']);
      if (r.err) throw new Error("écriture dans le registre refusée (" + (r.stderr.trim() || r.err.message) + ")");
      chemins.push(cible);
    }
    // Rend les polices visibles tout de suite par les programmes qu'on ouvrira ensuite
    const liste = chemins.map(c => "'" + c.replace(/'/g, "''") + "'").join(',');
    const ps = "$s='[DllImport(\"gdi32.dll\",CharSet=CharSet.Unicode)] public static extern int AddFontResource(string f);" +
      "[DllImport(\"user32.dll\")] public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,IntPtr l,uint f,uint t,out IntPtr r);';" +
      "Add-Type -MemberDefinition $s -Name P -Namespace HarmoFonts;" +
      "foreach($c in @(" + liste + ")){[void][HarmoFonts.P]::AddFontResource($c)};" +
      "$r=[IntPtr]::Zero;[void][HarmoFonts.P]::SendMessageTimeout([IntPtr]0xffff,0x1D,[IntPtr]::Zero,[IntPtr]::Zero,2,2000,[ref]$r)";
    await executer('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
    const apres = await etat();
    const encore = apres.fonts.filter(f => !f.installed).map(f => f.label);
    return encore.length ? { ok: false, error: 'non détectées après installation : ' + encore.join(', ') } : { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
module.exports = { etat, installer, nomsValeurs, POLICES };
