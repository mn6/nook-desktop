const electron = require('electron')
const ipc = electron.ipcRenderer

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('patreon').addEventListener("click", function () {
    let active_hotspot_id = localStorage.getItem('active_hotspot_id')
    const reply = ipc.sendSync('patreon', active_hotspot_id)
  })
  
  document.getElementById('close').addEventListener("click", function () {
    let active_hotspot_id = localStorage.getItem('active_hotspot_id')
    const reply = ipc.sendSync('close', active_hotspot_id)
  })
})
