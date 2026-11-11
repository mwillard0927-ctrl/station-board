/**
 * Station Sheets watcher — Google Apps Script (runs in Matt's Gmail).
 * Every day 8:55–9:20 AM Eastern it checks Gmail about every 15 seconds for the
 * boss's email with the driver list + pick sheet PDFs, then saves them to the
 * station-board repo's inbox/ folder. GitHub then updates the app by itself.
 *
 * SETUP (once):
 *  1. Fill in SENDER and/or SUBJECT_WORD below (leave the other one '').
 *  2. Project Settings (gear) → Script Properties → add  GH_TOKEN = <your GitHub token>
 *  3. Run setup() once and allow access when Google asks.
 *  Test anytime: run testSearch() and check the log.
 */
const CONFIG = {
  SENDER: '',            // e.g. 'boss@example.com'   ← fill in later
  SUBJECT_WORD: '',      // e.g. 'Station Sheets'     ← fill in later
  REPO: 'mwillard0927-ctrl/station-board',
  BRANCH: 'main',
  DONE_LABEL: 'Station Sheets/done',
  START: '08:55', END: '09:20',     // Eastern time window
  EVERY_SEC: 15,                     // how often to check inside the window
  RUN_SEC: 50                        // each 1-minute run keeps checking this long
};

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  GmailApp.createLabel('Station Sheets'); GmailApp.createLabel(CONFIG.DONE_LABEL);
  Logger.log('Watcher is on. It checks %s–%s ET every %s seconds.', CONFIG.START, CONFIG.END, CONFIG.EVERY_SEC);
}

function stop() { ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t)); Logger.log('Watcher is off.'); }

function inWindow_() {
  const hm = Utilities.formatDate(new Date(), 'America/New_York', 'HH:mm');
  return hm >= CONFIG.START && hm < CONFIG.END;
}

function query_() {
  const q = ['has:attachment', 'filename:pdf', 'newer_than:1d', '-label:"' + CONFIG.DONE_LABEL + '"'];
  if (CONFIG.SENDER) q.push('from:' + CONFIG.SENDER);
  if (CONFIG.SUBJECT_WORD) q.push('subject:"' + CONFIG.SUBJECT_WORD + '"');
  return q.join(' ');
}

function tick() {
  if (!inWindow_()) return;
  if (!CONFIG.SENDER && !CONFIG.SUBJECT_WORD) { Logger.log('Fill in SENDER or SUBJECT_WORD first.'); return; }
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return;
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < CONFIG.RUN_SEC * 1000 && inWindow_()) {
      if (checkOnce_()) return;
      Utilities.sleep(CONFIG.EVERY_SEC * 1000);
    }
  } finally { lock.releaseLock(); }
}

/** Returns true when PDFs were found and sent to GitHub. */
function checkOnce_() {
  const threads = GmailApp.search(query_(), 0, 5);
  if (!threads.length) return false;
  const done = GmailApp.getUserLabelByName(CONFIG.DONE_LABEL) || GmailApp.createLabel(CONFIG.DONE_LABEL);
  const stamp = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd-HHmmss');
  const files = [];
  threads.forEach(th => th.getMessages().forEach(m => m.getAttachments().forEach((a, i) => {
    if (!/\.pdf$/i.test(a.getName()) && a.getContentType() !== 'application/pdf') return;
    files.push({ path: 'inbox/' + stamp + '-' + files.length + '-' + a.getName().replace(/[^\w.-]+/g, '_'), b64: Utilities.base64Encode(a.getBytes()) });
  })));
  if (files.length) commitFiles_(files, 'Station sheets from Gmail');
  threads.forEach(th => th.addLabel(done));
  Logger.log('Sent %s PDF(s) to GitHub in one commit.', files.length);
  return files.length > 0;
}

/** Saves all files in ONE commit, so GitHub runs the update once with everything. */
function commitFiles_(files, msg) {
  const gh = (method, path, body) => {
    const token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
    if (!token) throw new Error('Add GH_TOKEN in Script Properties.');
    const r = UrlFetchApp.fetch('https://api.github.com/repos/' + CONFIG.REPO + path, {
      method: method, contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      payload: body ? JSON.stringify(body) : undefined
    });
    if (r.getResponseCode() >= 300) throw new Error('GitHub said ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
    return JSON.parse(r.getContentText());
  };
  const head = gh('get', '/git/ref/heads/' + CONFIG.BRANCH).object.sha;
  const baseTree = gh('get', '/git/commits/' + head).tree.sha;
  const tree = gh('post', '/git/trees', { base_tree: baseTree, tree: files.map(f => ({
    path: f.path, mode: '100644', type: 'blob', sha: gh('post', '/git/blobs', { content: f.b64, encoding: 'base64' }).sha })) }).sha;
  const commit = gh('post', '/git/commits', { message: msg, tree: tree, parents: [head] }).sha;
  gh('patch', '/git/refs/heads/' + CONFIG.BRANCH, { sha: commit });
}

/** Shows what the watcher would pick up right now (doesn't send anything). */
function testSearch() {
  Logger.log('Search: %s', query_());
  GmailApp.search(query_(), 0, 5).forEach(th => Logger.log('%s | %s | %s', th.getLastMessageDate(), th.getFirstMessageSubject(),
    th.getMessages().map(m => m.getAttachments().map(a => a.getName()).join(', ')).join(' / ')));
}
