const {
  app,
  BrowserWindow,
  Tray,
  nativeImage,
  Menu,
  ipcMain,
  shell,
  powerMonitor
} = require('electron')

const os = require('os')
const storage = require('electron-json-storage')
const path = require('path')
const fs = require('fs')

const userSettingsPath = path.join(app.getPath('userData'), 'userSettings') // change path for userSettings
storage.setDataPath(userSettingsPath)
const assets = app.isPackaged
  ? path.join(process.resourcesPath, '/build/icons/')
  : path.join(__dirname, '/build/icons/')

const { autoUpdater } = require('electron-updater')

const progress = (win, num) => {
  win.webContents.send('toWindow', ['bar', num])
}

let myWindow

const createWindow = () => {
  let tray
  const win = new BrowserWindow({
    width: 400,
    height: 500,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    resizable: false,
    icon: './icons/nook.png',
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('./app/main/index.html')

  const show = () => {
    win.restore()
    win.show()
    win.setSkipTaskbar(false)
    if (app.dock) app.dock.show()
    if (tray) tray.destroy()
  }

  const exit = () => {
    if (tray) tray.destroy()
    app.exit()
  }

  const close = (event) => {
    if (tray) tray.destroy()
    if (app.dock) app.dock.hide()
    event.preventDefault()
    win.setSkipTaskbar(true)
    win.hide()

    const macTrayImage = 'nookTemplate.png'
    const trayImage = 'nookTray.png'
    const trayIcon =
      os.platform() === 'darwin'
        ? nativeImage.createFromPath(path.join(assets, macTrayImage))
        : nativeImage.createFromPath(path.join(assets, trayImage))
    const trayMenu = Menu.buildFromTemplate([
      {
        label: 'Exit',
        click: exit
      },
      {
        label: 'Show',
        click: show
      }
    ])
    tray = new Tray(trayIcon)
    tray.setToolTip('Nook Desktop')
    tray.setContextMenu(trayMenu)
    tray.addListener('click', show)
  }

  ipcMain.addListener('patreon', () => {
    shell.openExternal('https://www.patreon.com/mattu')
  })
  ipcMain.addListener('github', () => {
    shell.openExternal('https://nook.camp')
  })

  ipcMain.addListener('min', close)
  ipcMain.addListener('close', exit)

  win.on('close', exit)

  const hiddenWin = new BrowserWindow({
    width: 500,
    height: 500,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: true,
      contextIsolation: false
    },
    skipTaskbar: false,
    excludedFromShownWindowsMenu: true,
    focusable: false
  })
  hiddenWin.setSkipTaskbar(true)
  hiddenWin.loadFile('./app/hidden/index.html')

  powerMonitor.addListener('suspend', () => {
    hiddenWin.webContents.send('toPlayer', ['pauseIfPlaying'])
  })

  ipcMain.on('playerLoaded', () => {
    hiddenWin.webContents.send('toPlayer', [
      'userSettingsPath',
      userSettingsPath
    ])
  })

  ipcMain.on('toPlayer', (event, args) => {
    hiddenWin.webContents.send('toPlayer', args)
  })

  ipcMain.on('toWindow', (event, args) => {
    win.webContents.send('toWindow', args)
  })

  ipcMain.addListener('clearSettings', async (event) => {
    progress(win, 1)
    await new Promise((resolve) => storage.clear((err) => resolve(err)))
    progress(win, 50)
    await new Promise((resolve) =>
      fs.rm(
        userSettingsPath + '/sound',
        { recursive: true, force: true },
        (err) => resolve(err)
      )
    )
    progress(win, 100)

    app.relaunch()
    app.exit()
  })
}

app.disableHardwareAcceleration()

if (process.platform === 'win32') {
  app.setAppUserModelId(app.name)
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) app.quit()
else {
  app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
    if (myWindow) {
      if (myWindow.isMinimized()) myWindow.restore()
      myWindow.focus()
    }
  })

  app.whenReady().then(() => {
    myWindow = createWindow()
  })
}

autoUpdater.logger = require('electron-log')
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.checkForUpdatesAndNotify()
