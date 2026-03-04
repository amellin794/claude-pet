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

app.on('ready', async () => {
  // Don't show in dock
  app.dock?.hide();

  // Start server if not already running
  const running = await isServerRunning();
  if (!running) {
    startServer();
    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const icon = createTrayIcon();

  const mb = menubar({
    icon,
    index: SERVER_URL,
    browserWindow: {
      width: 320,
      height: 460,
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

  // Refresh state (not full reload) every time the popover shows
  mb.on('after-show', () => {
    mb.window?.webContents.executeJavaScript('poll()').catch(() => {});
  });
});

// Kill server child on quit if we started it
app.on('will-quit', () => {
  if (serverChild) {
    try { process.kill(serverChild.pid); } catch {}
    serverChild = null;
  }
});
