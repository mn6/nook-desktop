const ipc = require('electron').ipcRenderer
const $ = window.jQuery
const Nanobar = window.Nanobar

$(document).ready(() => {
  $('#close').on('click', () => {
    ipc.send('min')
  })

  $('#exit').on('click', () => {
    ipc.send('close')
  })

  $('#patreon').on('click', () => {
    ipc.send('patreon')
  })

  $('#music').on('change', (e) => {
    ipc.send('toPlayer', ['musicVol', e.target.value])
  })

  $('#rain').on('change', (e) => {
    ipc.send('toPlayer', ['rainVol', e.target.value])
  })

  $('#gameSelect').on('change', (e) => {
    ipc.send('toPlayer', ['game', e.target.value])
  })

  $('#settings').on('click', () => {
    $('.page').addClass('hidden')
    $('.settings.page').removeClass('hidden')

    $('#settings').addClass('hidden')
    $('#home').removeClass('hidden')
  })

  $('#home').on('click', () => {
    $('.page').addClass('hidden')
    $('.home.page').removeClass('hidden')

    $('#home').addClass('hidden')
    $('#settings').removeClass('hidden')
  })

  $('.settings #grandFather').on('change', (e) => {
    ipc.send('toPlayer', ['grandFather', e.target.checked])
  })

  ipc.on('toWindow', (event, arg) => {
    if (arg[0] === 'bar') {
      nanobar.go(+arg[1])
    } else if (arg[0] === 'soundVol') {
      $('#music').val(arg[1])
    } else if (arg[0] === 'rainVol') {
      $('#rain').val(arg[1])
    } else if (arg[0] === 'grandFather') {
      $('#grandFather').prop('checked', arg[1])
    }
  })

  const nanobar = new Nanobar({
    classname: 'nanobar',
    id: 'nanobar',
    target: $('.header')[0]
  })
  nanobar.go(0)
})
