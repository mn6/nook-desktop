const ipc = require('electron').ipcRenderer
const storage = require('electron-json-storage')

const baseUrl = 'https://d17orwheorv96d.cloudfront.net'
const Howl = window.Howl
let sound
let soundVol
let rainVol
let rainSound
let game
let grandFather
let hour
let fadeTimeout

const getHour = () => {
  const d = new Date()
  const hrs = d.getHours()
  return `${(hrs + 24) % 12 || 12}${hrs >= 12 ? 'pm' : 'am'}`
}

const progress = num => {
  ipc.send('toWindow', ['bar', num])
}

const unloadSound = () => {
  sound.unload()
  sound = null
}

const handleClock = () => {
  const playSound = () => {
    sound = new Howl({
      src: [`${baseUrl}/${game}/${hour}.ogg`],
      loop: true,
      volume: 0
    })

    sound.on('load', () => {
      progress(100)
      if (grandFather) {
        // Let song play twice (some songs are really short)
        const dur = sound.duration()
        fadeTimeout = setTimeout(() => {
          sound.on('fade', () => {
            unloadSound()
          })
          sound.fade(soundVol / 100, 0, 1000)
          clearTimeout(fadeTimeout)
        }, ((dur * 1000) * 2) - 1100)
      }
      sound.play()
      sound.fade(0, soundVol / 100, 1000)
    })
  }
  const newHour = getHour()

  if (hour !== newHour) {
    hour = newHour
    clearTimeout(fadeTimeout)

    if (sound) {
      sound.on('fade', () => {
        progress(50)

        unloadSound()
        playSound()
      })
      sound.fade(soundVol / 100, 0, 1000)
    } else {
      playSound()
    }
  }
}

const timeHandler = () => {
  setInterval(() => {
    handleClock()
  }, 5000)
}

const doMain = () => {
  soundVol = storage.getSync('soundVol').volume
  rainVol = storage.getSync('rainVol').volume
  grandFather = storage.getSync('grandFather').enabled
  game = storage.getSync('game').game

  if (soundVol === undefined) soundVol = 50
  if (rainVol === undefined) rainVol = 50
  if (grandFather === undefined) grandFather = false
  if (game === undefined) game = 'new-leaf'

  ipc.send('toWindow', ['soundVol', soundVol])
  ipc.send('toWindow', ['rainVol', rainVol])
  ipc.send('toWindow', ['grandFather', grandFather])
  ipc.send('toWindow', ['game', game])

  rainSound = new Howl({
    src: [`${baseUrl}/rain/rain.ogg`],
    loop: true,
    volume: 0
  })
  rainSound.once('load', () => {
    progress(50)
    // wait for sound to load also
    handleClock()
    sound.on('load', function () {
      rainSound.play()
      rainSound.fade(0, rainVol / 100, 1000)
      timeHandler()
    })
  })
}

const replay = () => {
  hour = null
  handleClock()
}

const handleIpc = (event, arg) => {
  const command = arg[0]
  arg.shift()

  if (command === 'userSettingsPath') {
    storage.setDataPath(arg[0])
    doMain()
  } else if (command === 'musicVol') {
    sound.volume(+arg[0] / 100)
    soundVol = +arg[0]
    storage.set('soundVol', { volume: +arg[0] })
  } else if (command === 'rainVol') {
    rainSound.volume(+arg[0] / 100)
    rainVol = +arg[0]
    storage.set('rainVol', { volume: +arg[0] })
  } else if (command === 'grandFather') {
    grandFather = arg[0]
    storage.set('grandFather', { enabled: arg[0] })
    replay()
  } else if (command === 'game') {
    game = arg[0]
    storage.set('game', { game })
    replay()
  }
}

ipc.on('toPlayer', handleIpc)
ipc.send('playerLoaded')
