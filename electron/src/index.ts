import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, dialog, MenuItem } from 'electron';
import { autoUpdater } from 'electron-updater';
import { ElectronCapacitorApp, setupContentSecurityPolicy } from './setup';
import unhandled from './error';
import { getCustomConfig, CustomConfig } from './env';
// Graceful handling of unhandled errors.
unhandled();
// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
];
// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();
const customConfig: CustomConfig = getCustomConfig();
// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);
// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}
// Run Application
(async () => {
  // Wait for electron app to be ready.
  await app.whenReady();
  // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
  // Initialize our app, build windows, and load content.
  await myCapacitorApp.init();
  // Check for updates if we are in a packaged app.
  try {
    // Setup auto-updater if GitHub configuration is present
    if (customConfig.github) {
      setupAutoUpdater(customConfig);
    }
  } catch (error) {
    console.error('Error during app initialization:', error);
    dialog.showErrorBox('Initialization Error', error.message || 'An unknown error occurred.');
  }
})();
// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
// When the dock icon is clicked.
app.on('activate', async function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});
// Place all ipc or other electron api calls and custom functionality under this line
// Setup and configure the auto-updater
function setupAutoUpdater(config: CustomConfig) {
  const { github } = config;
  if (!github || !github.owner || !github.repo || !github.token) {
    console.error('GitHub configuration is missing for auto-updater.');
  } else {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: github.owner,
      repo: github.repo,
      private: github.private,
      token: github.token,
    });
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('Failed to check for updates:', error);
    });
    handleAutoUpdaterEvents(); // Bind auto-updater events
  }
}
// Handle auto-updater related events
function handleAutoUpdaterEvents() {
  autoUpdater.on('update-available', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: 'A new version of the application is available. Do you want to update now?',
        buttons: ['Update', 'Cancel'],
      })
      .then((response) => {
        if (response.response === 0) {
          autoUpdater.downloadUpdate().catch((error) => {
            console.error('Error downloading update:', error);
          });
        } else {
          myCapacitorApp.getMainWindow().show();
        }
      });
  });
  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'The update has been downloaded. Restart the application to apply the updates.',
        buttons: ['Restart', 'Later'],
      })
      .then((response) => {
        if (response.response === 0) {
          autoUpdater.quitAndInstall();
        } else {
          myCapacitorApp.getMainWindow().show();
        }
      });
  });
}
