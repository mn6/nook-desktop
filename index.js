const { app, BrowserWindow, ipcMain, shell, Tray, nativeImage, Menu } = require('electron')
const path = require('node:path')

let tray
const patreonLink = 'https://www.patreon.com/mattu'

const createWindow = () => {
  let tray
  const win = new BrowserWindow({
    width: 400,
    height: 400,
    autoHideMenuBar: true,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.loadFile('./app/index.html')

  const show = () => {
    win.restore()
    win.show()
    win.setSkipTaskbar(false)
    tray.destroy()
  }

  const close = (event) => {
    event.preventDefault()
    win.setSkipTaskbar(true)
    win.hide()

    const trayImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JQAAgIMAAPn/AACA6QAAdTAAAOpgAAA6mAAAF2+SX8VGAAAA8FBMVEWbjv+cj/+cj/+cj/+cj/+cj/+cj/+cj/+cj/+bjv+dkf+gk/+mmv+lmv+dkP+lmf+glP+Hd/+Ief+nnP+uo/+onf+Jef+Gd/+fkv+jl/+ajP93Zf9iTf9mUv9tWf9sWf9nU/+Xif+kmP+fk/+jlv9dSP9dR/9NNf9JMP9cR/+ilv+EdP9gS/+Ke/91Yv9EK/90Yf+LfP9hTP+Dcv+roP9tWv9oVP+3rv+Le/9GLf9GLP+5r/9rV/+sof+qn/9jTv9vXP9uW/9uWv9iTv94Zv+rof+Sg/98a/9YQv9YQf+Qgf+ckP+Jev90Yv+ekv////95hydFAAAACHRSTlMVke/+FZL77vO/azcAAAABYktHRE9uZkFJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5gsODxUaWk1MTgAAAM9JREFUGNNdz1lXwjAQBeDQQMkQWqAQaEkRKQiobC4srqUYFkH6/3+OyXCOD96HOXO+p3sJyVj0L1YmS3I2YwCMXa6dI3n9FZj+gRX0zRPKgBcdF8AtFcvAKKHAyxWvWquJesPnYCBoyrB11b4OZSdC6PZu+oPhcNC/vesiVO9H48l0Ont4fBIIz/PFcvXyWn97n38gfMp4ncTxZv2ltgilnVT7w/deyaODcIp+1DlJzsqLXAO6ogh8zv1AnEwxUx1SrpMCVjfjNGFwXPbf/F+YqxYBVeZ/pwAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMi0xMS0xNFQxNToyMToyNiswMDowMNWlIXUAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjItMTEtMTRUMTU6MjE6MjYrMDA6MDCk+JnJAAAAAElFTkSuQmCC'
    const trayIcon = nativeImage.createFromDataURL(trayImage)
    const trayMenu = Menu.buildFromTemplate([
      { 
        label: 'Exit',
        click: async () => {
          tray.destroy()
          process.kill(0)
        },
      },
      { 
        label: 'Show',
        click: show,
      },
    ])
    tray = new Tray(trayIcon)
    tray.setToolTip('Nook Desktop')
    tray.setTitle('Nook Desktop')
    tray.setContextMenu(trayMenu)
    tray.addListener('click', show)
  }

  win.on('close', close)

  ipcMain.on('patreon', (event, arg) => {
    shell.openExternal(patreonLink)
  })
  
  ipcMain.on('close', (event, arg) => {
    win.close()
  })
}

app.whenReady().then(() => {
  createWindow()
})

try {
  require('electron-reloader')(module)
} catch (_) {}
