const { app, BrowserWindow, Tray, nativeImage, Menu, ipcMain, shell } = require('electron')

const storage = require('electron-json-storage')
const path = require('path')

const userSettingsPath = path.join(app.getPath('userData'), 'userSettings') // change path for userSettings
storage.setDataPath(userSettingsPath)

const createWindow = () => {
  let tray
  const win = new BrowserWindow({
    width: 400,
    height: 400,
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
    tray.destroy()
  }

  const exit = () => {
    if (tray) tray.destroy()
    app.exit()
  }

  const close = (event) => {
    event.preventDefault()
    win.setSkipTaskbar(true)
    win.hide()

    const trayImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAAB2lBMVEX///8AAAD////////////////19P/Szf/Szv/29f/////Rzf/////49//X0//////9/f/Szf/////m4//m5P/////y8f/z8f/////////////////////29f/9/f/////////Tz//l4v/////////19P/29f/z8v/////6+v/////l4//////////+/v/q6P/////////7+//5+f/o5v/Y1f/Z1f////////////////////+tpf9tX/93af94av9hUv+jmv95bP97bv+Cdv+0rP+8tf+1rv+8tv+yq/+Ac/9yZP+Ddv9+cv9JOP9JN/9IN/9OPf9uYP98b/+Dd//V0f9oWf9GNP8xHv8lEf8mEv82I/+Fef/Z1f+Yj/9CMf92af9yZf8xHf8nE/9zZf9SQv+vp/9VRf+Cdf+Mgf8/Lf8+LP+Iff99cf9YSf9eT/+7tP98cP+EeP88Kf8pFf+Rh/8zIP+9t/+imf87Kf9TQ/+ro/9hU/9kVf9lVv+Gev+flv+nn/90Z/9EMv9fUP80If83JP9mV/9MPP9aSv+akP/v7v/Gwf+Ngv+MgP+Pg/9RQf8wHf8wHP+LgP+6s/+PhP+Og/9/c/9uX//CvP+elP+Qhf+Rhv/////ighgQAAAAPHRSTlMAAAEiRS+38/O3LPMVsP3LqP0j398h2NkRqJoMO9y6GYb+9Geu9fT6t99u8XcTg/IPWK3L8Pz7CRpSY2Ilj+iIAAAAAWJLR0QAiAUdSAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+YLDw8DGWdgz0YAAAETSURBVBjTY2BgYmZhYWZigNMMrGzsHJxcTExcnBzcbKwMDDy8NrZ2fPwCAvyC9g6OvDwMQsJOzi6ubu7uHp5edt4iQgyiYo4+vg5+/gGBQcEhjuKiDBKSoWHhEZFRUVHRfjGxUtIMMrJx8QmJScnJSQkpqWly8gwKiukOGZlZUVHZObl5+UrKDCoFEYUxRcUlJVmlIYll5SoMqhWVVdU1VbV16fWeqUkNagzqjU3N+c4trW3tCR1ZnV3dDBo9vX39mRMmTsrrzZycOUWTQUvbceq0adODZkyfNm2qo7YOg66e/szqWbPnzJk9q3qmvp4uA4OBoZGxiamZmamJsZGhAQMDIwOTuYWllbW1laWFORMDIwCG70dJcn+jWAAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMi0xMS0xNVQxNTowMzoyNSswMDowMBa8w4UAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjItMTEtMTVUMTU6MDM6MjUrMDA6MDBn4Xs5AAAAAElFTkSuQmCC'
    const trayIcon = nativeImage.createFromDataURL(trayImage)
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
    tray.setTitle('Nook Desktop')
    tray.setContextMenu(trayMenu)
    tray.addListener('click', show)
  }

  win.on('close', close)

  ipcMain.addListener('patreon', () => {
    shell.openExternal('https://www.patreon.com/mattu')
  })

  ipcMain.addListener('min', close)
  ipcMain.addListener('close', exit)

  const hiddenWin = new BrowserWindow({
    width: 500,
    height: 500,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  hiddenWin.loadFile('./app/hidden/index.html')

  ipcMain.on('playerLoaded', () => {
    hiddenWin.webContents.send('toPlayer', ['userSettingsPath', userSettingsPath])
  })

  ipcMain.on('toPlayer', (event, args) => {
    hiddenWin.webContents.send('toPlayer', args)
  })

  ipcMain.on('toWindow', (event, args) => {
    win.webContents.send('toWindow', args)
  })
}

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  createWindow()
})

try {
  require('electron-reloader')(module)
} catch (_) {}
