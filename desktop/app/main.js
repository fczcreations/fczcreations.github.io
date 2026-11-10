const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const polices = require('./polices');

function creerFenetre() {
  const win = new BrowserWindow({
    width: 1400, height: 920, minWidth: 420, minHeight: 500,
    title: "Harmo Tabs",
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#e9ecef',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  // Enregistrement des fichiers : fenêtre « Enregistrer sous » de Windows
  win.webContents.session.on('will-download', (event, item) => {
    if (process.env.TAB_TEST_DIR) { item.setSavePath(path.join(process.env.TAB_TEST_DIR, item.getFilename())); return; }
    const chemin = dialog.showSaveDialogSync(win, {
      title: textes()[0],
      defaultPath: path.join(app.getPath('documents'), item.getFilename()),
      filters: filtres(item.getFilename())
    });
    if (chemin) {
      item.setSavePath(chemin);
      item.once('done', (e, etat) => { if (etat === 'completed') shell.openPath(chemin); });
    } else item.cancel();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto):/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { e.preventDefault(); if (/^mailto:/.test(url)) shell.openExternal(url); });
  win.on('focus', () => win.webContents.send('fonts:changed'));   // revérifie si on a installé les polices entre-temps
  win.loadFile(path.join(__dirname, 'index.html'));
}
const TEXTES = {
  fr: ['Enregistrer', 'Document PDF', 'Classeur Excel', 'Police TrueType'],
  en: ['Save', 'PDF document', 'Excel workbook', 'TrueType font'],
  es: ['Guardar', 'Documento PDF', 'Libro de Excel', 'Fuente TrueType'],
  pt: ['Salvar', 'Documento PDF', 'Pasta de trabalho do Excel', 'Fonte TrueType'],
  de: ['Speichern', 'PDF-Dokument', 'Excel-Arbeitsmappe', 'TrueType-Schrift'],
  it: ['Salva', 'Documento PDF', 'Cartella di lavoro Excel', 'Font TrueType'],
  ru: ['Сохранить', 'Документ PDF', 'Книга Excel', 'Шрифт TrueType'],
  ja: ['保存', 'PDF ドキュメント', 'Excel ブック', 'TrueType フォント'],
  zh: ['保存', 'PDF 文档', 'Excel 工作簿', 'TrueType 字体'],
  ko: ['저장', 'PDF 문서', 'Excel 통합 문서', 'TrueType 글꼴']
};
function textes() { const l = (app.getLocale() || 'en').toLowerCase().split('-')[0]; return TEXTES[l] || TEXTES.en; }
function filtres(nom) {
  const ext = path.extname(nom).slice(1).toLowerCase();
  const tx = textes();
  const n = { pdf: tx[1], xlsx: tx[2], ttf: tx[3] }[ext] || ext;
  return [{ name: n, extensions: [ext] }];
}
ipcMain.handle('fonts:status', () => polices.etat());
ipcMain.handle('fonts:install', () => polices.installer(path.join(__dirname, 'fonts')));
app.whenReady().then(creerFenetre);
app.on('window-all-closed', () => app.quit());
