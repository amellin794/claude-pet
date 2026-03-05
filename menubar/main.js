const { app, nativeImage, BrowserWindow } = require('electron');
const { menubar } = require('menubar');
const { fork } = require('child_process');
const http = require('http');
const path = require('path');
const { createTrayIcon } = require('./icon');

const SERVER_URL = 'http://localhost:7742';
const SERVER_SCRIPT = path.join(__dirname, '..', 'dashboard', 'server.js');

let serverChild = null;

// Check if the dashboard server is already running
function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL + '/api/state', (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

// Start the dashboard server as a child process
function startServer() {
  serverChild = fork(SERVER_SCRIPT, [], { detached: true, stdio: 'ignore' });
  serverChild.unref();
}

// Wait for the server to actually respond (up to 10 seconds)
function waitForServer(maxMs = 10000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function check() {
      if (Date.now() - start > maxMs) return resolve(false);
      isServerRunning().then((ok) => {
        if (ok) resolve(true);
        else setTimeout(check, 300);
      });
    }
    check();
  });
}

app.on('ready', async () => {
  // Don't show in dock
  app.dock?.hide();

  // Ensure server is running
  const running = await isServerRunning();
  if (!running) {
    startServer();
  }
  await waitForServer();

  const icon = createTrayIcon();

  const mb = menubar({
    icon,
    index: SERVER_URL,
    browserWindow: {
      width: 320,
      height: 620,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    },
    preloadWindow: true,
    showDockIcon: false,
    showOnAllWorkspaces: false,
  });

  mb.on('ready', () => {
    console.log('claude-pet menu bar app ready');
  });

  // Refresh on show — reload page if it's blank (failed initial load)
  mb.on('after-show', () => {
    const wc = mb.window?.webContents;
    if (!wc) return;
    wc.executeJavaScript('document.querySelector(".container.ready") !== null')
      .then((hasContent) => {
        if (!hasContent) {
          wc.loadURL(SERVER_URL);
        } else {
          wc.executeJavaScript('poll()').catch(() => {});
        }
      })
      .catch(() => wc.loadURL(SERVER_URL));
  });
});

// Kill server child on quit if we started it
app.on('will-quit', () => {
  if (serverChild) {
    try { process.kill(serverChild.pid); } catch {}
    serverChild = null;
  }
});
