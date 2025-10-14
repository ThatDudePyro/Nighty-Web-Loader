const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Initialize remote module
require('@electron/remote/main').initialize();

const configPath = path.join(app.getPath('userData'), 'config.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 835,
    minWidth: 800,
    minHeight: 600,
    title: "Nighty",
    resizable: true,
    backgroundColor: "#0a0a0a",
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff',
      height: 35
    },
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      enableRemoteModule: true 
    }
  });

  // Enable remote for this window
  require('@electron/remote/main').enable(mainWindow.webContents);

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  // Windows-specific: Enable resize and snap with WM_NCHITTEST
  if (process.platform === 'win32') {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        window.addEventListener('DOMContentLoaded', () => {
          const { ipcRenderer } = require('electron');
          
          // Send mouse position to main process for hit testing
          let isResizing = false;
          
          document.addEventListener('mousemove', (e) => {
            if (isResizing) return;
            
            const x = e.clientX;
            const y = e.clientY;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const margin = 5;
            
            let cursor = 'default';
            let hitTest = 'client';
            
            // Corners first (higher priority)
            if (x <= margin && y <= margin) {
              cursor = 'nwse-resize';
              hitTest = 'top-left';
            } else if (x >= w - margin && y <= margin) {
              cursor = 'nesw-resize';
              hitTest = 'top-right';
            } else if (x <= margin && y >= h - margin) {
              cursor = 'nesw-resize';
              hitTest = 'bottom-left';
            } else if (x >= w - margin && y >= h - margin) {
              cursor = 'nwse-resize';
              hitTest = 'bottom-right';
            }
            // Edges
            else if (y <= margin) {
              cursor = 'ns-resize';
              hitTest = 'top';
            } else if (y >= h - margin) {
              cursor = 'ns-resize';
              hitTest = 'bottom';
            } else if (x <= margin) {
              cursor = 'ew-resize';
              hitTest = 'left';
            } else if (x >= w - margin) {
              cursor = 'ew-resize';
              hitTest = 'right';
            }
            
            document.body.style.cursor = cursor;
            ipcRenderer.send('window-hit-test', hitTest);
          });
          
          document.addEventListener('mousedown', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const margin = 5;
            
            if (x <= margin || x >= w - margin || y <= margin || y >= h - margin) {
              isResizing = true;
            }
          });
          
          document.addEventListener('mouseup', () => {
            isResizing = false;
          });
        });
      `);
    });
  }

  if (fs.existsSync(configPath)) {
    mainWindow.loadFile('webview.html');
  } else {
    mainWindow.loadFile('index.html');
  }
}

ipcMain.on('save-config', (event, data) => {
  fs.writeFileSync(configPath, JSON.stringify(data));
  mainWindow.loadFile('webview.html');
});

ipcMain.on('reset-config', () => {
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
  mainWindow.loadFile('index.html');
});

ipcMain.on('window-minimize', () => {
  console.log('Minimize triggered');
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  console.log('Maximize triggered, current state:', mainWindow.isMaximized());
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  console.log('Close triggered');
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle hit testing for resize zones
let currentHitTest = 'client';
ipcMain.on('window-hit-test', (event, hitTest) => {
  currentHitTest = hitTest;
});

app.whenReady().then(createWindow);