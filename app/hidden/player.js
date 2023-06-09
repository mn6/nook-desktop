const ipc = require('electron').ipcRenderer
const storage = require('electron-json-storage')
const fs = require('fs')
const superagent = require('superagent')
const Wad = window.Wad
const AudioContext = window.AudioContext
const kkSongs = require('../kk.json')

const baseUrl = 'https://d17orwheorv96d.cloudfront.net'
let chime
let beep
let sound
let soundVol
let soundSources = []
let soundGain
let rain
let rainVol
let rainSources = []
let rainGain
let game
let grandFather = false
let hour
let chimeInt
let userSettingsPath
let lang
let keys
let offlineFiles
let offlineKKFiles
let tune
let tuneEnabled
let beepTimeout
let paused = false
let gameRain
let peacefulRain
let kkEnabled
let kkSaturday
let openOnStartup
let preferNoDownload
let latestVersion
let currentVersion

const tunes = [
  'G0',
  'A1',
  'B1',
  'C1',
  'D1',
  'E1',
  'F1',
  'G1',
  'A2',
  'B2',
  'C2',
  'D2',
  'E2'
]
const tunesBeepMap = [
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
  'G5',
  'A5',
  'B5',
  'C6',
  'D6',
  'E6'
]
const games = [
  'population-growing', 'population-growing-snowy', 'population-growing-cherry', 'population-growing-rainy', 'wild-world', 'wild-world-rainy', 'wild-world-snowy', 'new-leaf', 'new-leaf-rainy', 'new-leaf-snowy', 'new-horizons', 'new-horizons-rainy', 'new-horizons-snowy', 'pocket-camp'
]

const convertGameToHuman = (game) => {
  const g = game.split('-')
  const finalGame = []
  g.forEach(gameName => {
    finalGame.push(gameName.substring(0, 1).toUpperCase() + gameName.substring(1))
  })
  return finalGame.join(' ')
}

const soundLoaded = async (a, isSound = true, url) => {
  return new Promise(async resolve => { // eslint-disable-line no-async-promise-executor
    if (paused) {
      resolve()
    } else {
      if (isSound) {
        sound = a
        sound.isSound = isSound
        sound.start()
        await fadeSound('sound', true)
        url = url.replace('kk-slider-desktop', 'kk-slider')
        const friendlyHour = url.substring(url.lastIndexOf('/') + 1)
        ipc.send('playing', [convertGameToHuman(friendlyHour.substring(0, friendlyHour.lastIndexOf('-'))), friendlyHour.substring(friendlyHour.lastIndexOf('-') + 1).replace('.ogg', '')])
      } else {
        rain = a
        rain.start()
        await fadeSound('rain', true)
      }
      resolve()
    }
  })
}

const startAudio = async () => {
  hour = null
  paused = false
  return timeCheck()
}

const stopAudio = async (mode = 'sound') => {
  return new Promise(async resolve => { // eslint-disable-line no-async-promise-executor
    if (mode === 'rain' || mode === 'all') {
      if (!rain) {
        resolve('skip stop')
      } else {
        await fadeSound('rain', false)
        if (rain) {
          rain.stop()
          rain = null
          for (const s of rainSources) {
            try { s.stop() } catch (err) {}
          }
          rainSources = []
        }
        if (mode === 'rain') resolve('stopped')
      }
    }
    if (mode === 'sound' || mode === 'all') {
      ipc.send('playing', [])
      if (!sound) {
        resolve('skip stop')
      } else {
        await fadeSound('sound', false)
        if (sound) {
          sound.removeEventListener('ended', kkEnded)
          sound.stop()
          sound = null
          for (const s of soundSources) {
            try { s.stop() } catch (err) {}
          }
          soundSources = []
        }
        resolve('stopped')
      }
    }
  })
}

const pauseClicked = async () => {
  if (!paused) {
    paused = true
    await stopAudio('all')
    return 'done'
  } else {
    paused = false
    playRain()
    await startAudio()
    return 'done'
  }
}

const fadeSound = async (mode = 'sound', fadeIn = true) => {
  return new Promise(async resolve => { // eslint-disable-line no-async-promise-executor
    for (let i = 0; i <= (mode === 'sound' ? (soundVol * 100) : (rainVol * 100)); i += 1) {
      await new Promise(resolve => setTimeout(resolve, 2))
      if ((fadeIn && (mode === 'sound' ? sound : rain)) || !fadeIn) {
        if (mode === 'sound') soundGain.gain.value = fadeIn ? (i / 100) : (soundVol - (i / 100))
        if (mode === 'rain') rainGain.gain.value = fadeIn ? (i / 100) : (rainVol - (i / 100))
      } else {
        resolve('skip')
      }

      if ((fadeIn && (i / 100) === (mode === 'sound' ? soundVol : rainVol)) || (!fadeIn && ((mode === 'sound' ? soundGain.gain.value : rainGain.gain.value) === 0))) {
        resolve('done')
      }
    }
  })
}

const playSound = async url => {
  if (!url) return
  const context = new AudioContext()
  const audioBuffer = await fetch(url)
    .then(res => res.arrayBuffer())
    .then(ArrayBuffer => context.decodeAudioData(ArrayBuffer))
    .catch(err => console.error(err))

  if (!audioBuffer) {
    if (preferNoDownload) {
      ipc.send('toWindow', ['error', 'failedToLoadSound'])
    } else {
      // Delete corrupted file if it exists
      fs.unlink(url, err => {
        console.error(err)
        storage.remove(`meta-${url.split('/sound/')[1].replace('.ogg', '')}`)
        ipc.send('toWindow', ['downloadRemoved', url.includes('kk-slider') ? 'kk' : 'hourly'])
        ipc.send('toWindow', ['error', 'failedToLoadSound'])
      })
    }
  } else {
    const source = context.createBufferSource()
    soundSources.push(source)
    source.buffer = audioBuffer
    soundGain = context.createGain()
    soundGain.gain.value = 0
    source.connect(soundGain).connect(context.destination)
    source.loop = !grandFather && game !== 'kk-slider-desktop'
    if (game === 'kk-slider-desktop') {
      source.addEventListener('ended', kkEnded)
    }

    await soundLoaded(source, true, url)
  }
}

const kkEnded = () => {
  hour = null
  timeCheck()
}

const playRain = async () => {
  const url = await getUrl(`${baseUrl}/rain/${gameRain ? 'game-rain' : peacefulRain ? 'no-thunder-rain' : 'rain'}.ogg`)
  if (!url) return
  const context = new AudioContext()
  const source = context.createBufferSource()
  rainSources.push(source)
  const audioBuffer = await fetch(url)
    .then(res => res.arrayBuffer())
    .then(ArrayBuffer => context.decodeAudioData(ArrayBuffer))
    .catch(err => console.error(err))

  source.buffer = audioBuffer
  rainGain = context.createGain()
  rainGain.gain.value = 0
  source.connect(rainGain).connect(context.destination)
  source.loop = !grandFather

  await soundLoaded(source, false)
}

const timeCheck = async () => {
  return new Promise(async resolve => { // eslint-disable-line no-async-promise-executor
    const newHour = getHour()
    if (paused || newHour === hour) {
      resolve('paused || grandFather || newHour === hour')
    } else {
      await stopAudio('sound')
      // Play town tune here
      if (hour && hour !== newHour) await playChime(tuneEnabled)
      hour = newHour

      if (kkSaturday && ~['8pm', '9pm', '10pm', '11pm'].indexOf(newHour) && (new Date().getDay() === 6)) {
        game = 'kk-slider-desktop'
        ipc.send('toWindow', ['updateGame', game])
      } else if (kkSaturday && (newHour === '12am') && (new Date().getDay() === 0)) {
        game = storage.getSync('game').game || 'new-leaf'
        ipc.send('toWindow', ['updateGame', game])
      }

      const gameUrl = game === 'random' ? games[~~(Math.random() * games.length)] : game
      await playSound(await getUrl(`${baseUrl}/${gameUrl}/${gameUrl === 'kk-slider-desktop' ? kkEnabled[~~(Math.random() * kkEnabled.length)] : gameUrl === 'pocket-camp' ? hourToPocketCamp(hour) : hour}.ogg`))
      resolve('played')
    }
  })
}

const toNewUrl = oldUrl => {
  let newUrl = oldUrl.split('/')
  newUrl = `${newUrl[newUrl.length - 2]}-${newUrl[newUrl.length - 1]}`.replace('.ogg', '')
  return newUrl
}

const getUrl = async (oldUrl) => {
  const newUrl = toNewUrl(oldUrl)
  const lastModified = storage.getSync(`meta-${newUrl}`).lastModified
  const s = await localSave(oldUrl, newUrl, lastModified)

  if ((s === 'err' || s === 'head fail' || s === 'no headers error') && !lastModified) {
    if (newUrl.includes('rain-')) {
      ipc.send('toWindow', ['error', 'failedToLoadRainSound'])
    } else {
      ipc.send('toWindow', ['error', 'failedToLoadSound'])
    }

    return ''
  }

  if (s === 'prefer no download') {
    return oldUrl
  }

  return `${userSettingsPath}/sound/${newUrl}.ogg`
}

const handleIpc = async (event, arg) => {
  const command = arg[0]
  arg.shift()

  if (command === 'userSettingsPath') {
    userSettingsPath = arg[0]
    currentVersion = arg[1]
    storage.setDataPath(arg[0])
    storage.keys((err, k) => {
      if (!err) keys = k
      else keys = []
      doMain()
    })
  } else if (command === 'musicVol') {
    soundGain.gain.value = +arg[0] / 100
    chime.setVolume(+arg[0] / 100)
    soundVol = +arg[0] / 100
    storage.set('soundVol', { volume: +arg[0] })
  } else if (command === 'rainVol') {
    rainGain.gain.value = +arg[0] / 100
    rainVol = +arg[0] / 100
    storage.set('rainVol', { volume: +arg[0] })
  } else if (command === 'grandFather') {
    grandFather = arg[0]
    storage.set('grandFather', { enabled: arg[0] })
    const newHour = getHour()
    hour = newHour
    const gameUrl = game === 'random' ? games[~~(Math.random() * games.length)] : game
    await stopAudio('sound')
    await playSound(await getUrl(`${baseUrl}/${gameUrl}/${gameUrl === 'kk-slider-desktop' ? kkEnabled[~~(Math.random() * kkEnabled.length)] : gameUrl === 'pocket-camp' ? hourToPocketCamp(hour) : hour}.ogg`))
  } else if (command === 'game') {
    game = arg[0]
    storage.set('game', { game })
    const newHour = getHour()
    hour = newHour
    const gameUrl = game === 'random' ? games[~~(Math.random() * games.length)] : game
    await stopAudio('sound')
    await playSound(await getUrl(`${baseUrl}/${gameUrl}/${gameUrl === 'kk-slider-desktop' ? kkEnabled[~~(Math.random() * kkEnabled.length)] : gameUrl === 'pocket-camp' ? hourToPocketCamp(hour) : hour}.ogg`))
  } else if (command === 'tuneEnabled') {
    tuneEnabled = arg[0]
    storage.set('tuneEnabled', { tuneEnabled: arg[0] })
  } else if (command === 'preferNoDownload') {
    preferNoDownload = arg[0]
    storage.set('preferNoDownload', { preferNoDownload: arg[0] })
  } else if (command === 'tune') {
    tune = arg[0]
    storage.set('tune', { tune })
  } else if (command === 'playNote') {
    await playBeep(arg[0], 350)
  } else if (command === 'playTune') {
    await playBeeps(arg[0])
  } else if (command === 'paused') {
    storage.set('paused', { paused: arg[0] })
    pauseClicked()
  } else if (command === 'pauseIfPlaying') {
    if (!paused) {
      storage.set('paused', { paused: true })
      pauseClicked()
      ipc.send('toWindow', ['pause'])
    }
  } else if (command === 'downloadHourly') {
    await downloadHourly()
  } else if (command === 'downloadKK') {
    await downloadKK()
  } else if (command === 'gameRain') {
    gameRain = arg[0]
    peacefulRain = false
    storage.set('gameRain', { enabled: arg[0] })
    storage.set('peacefulRain', { enabled: false })
    await stopAudio('rain')
    await playRain()
  } else if (command === 'peacefulRain') {
    peacefulRain = arg[0]
    gameRain = false
    storage.set('peacefulRain', { enabled: arg[0] })
    storage.set('gameRain', { enabled: false })
    await stopAudio('rain')
    await playRain()
  } else if (command === 'kkEnabled') {
    kkEnabled = arg[0]
    storage.set('kkEnabled', { songs: arg[0] })
    if (game === 'kk-slider-desktop') {
      const newHour = getHour()
      hour = newHour
      const gameUrl = game === 'random' ? games[~~(Math.random() * games.length)] : game
      await stopAudio('sound')
      await playSound(await getUrl(`${baseUrl}/${gameUrl}/${gameUrl === 'kk-slider-desktop' ? kkEnabled[~~(Math.random() * kkEnabled.length)] : gameUrl === 'pocket-camp' ? hourToPocketCamp(hour) : hour}.ogg`))
    }
  } else if (command === 'kkSaturday') {
    kkSaturday = arg[0]
    storage.set('kkSaturday', { enabled: arg[0] })
    const newHour = getHour()
    hour = newHour
    const gameUrl = game === 'random' ? games[~~(Math.random() * games.length)] : game
    await stopAudio('sound')
    await playSound(await getUrl(`${baseUrl}/${gameUrl}/${gameUrl === 'kk-slider-desktop' ? kkEnabled[~~(Math.random() * kkEnabled.length)] : gameUrl === 'pocket-camp' ? hourToPocketCamp(hour) : hour}.ogg`))
  } else if (command === 'openOnStartup') {
    openOnStartup = arg[0]
    storage.set('openOnStartup', { enabled: arg[0] })
    ipc.send('openOnStartup', [arg[0]])
  } else if (command === 'lang') {
    lang = arg[0]
    storage.set('lang', { lang: arg[0] })
  }
}

const localSave = async (oldUrl, newUrl, lastModified) => {
  return await new Promise(resolve => {
    if (preferNoDownload) {
      resolve('prefer no download')
    } else {
      // Check HEAD first
      superagent
        .head(oldUrl)
        .then(res => {
          if (res.headers && res.headers['last-modified']) {
            if (!lastModified) lastModified = 0
            if (+new Date(lastModified) !== +new Date(res.headers['last-modified'])) {
              // Download
              superagent
                .get(oldUrl)
                .then(res => {
                  if (res.body && userSettingsPath) {
                    fs.mkdir(userSettingsPath + '/sound', { recursive: true }, err => {
                      if (err) return
                      const ws = fs.createWriteStream(`${userSettingsPath}/sound/${newUrl}.ogg`)
                      ws.write(res.body, 'binary')
                      ws.end()
                      ws.on('finish', () => {
                        storage.set(`meta-${newUrl}`, { lastModified: res.headers['last-modified'] })
                        ipc.send('toWindow', ['downloadDone', newUrl.includes('kk-slider') ? 'kk' : 'hourly'])
                        resolve('good!')
                      })
                      ws.on('error', err => {
                        resolve('err')
                        console.error(err)
                      })
                    })
                  }
                })
                .catch(err => {
                  resolve('err')
                  console.error(err)
                })
            } else {
              resolve('already obtained')
            }
          } else {
            resolve('no headers err')
          }
        })
        .catch(err => {
          resolve('head fail')
          console.error(err)
        })
    }
  })
}

const progress = num => {
  ipc.send('toWindow', ['bar', num])
}

const getHour = () => {
  const d = new Date()
  const hrs = d.getHours()
  return game === 'population-growing-rainy' ? '12am' : `${(hrs + 24) % 12 || 12}${hrs >= 12 ? 'pm' : 'am'}`
}

const doTick = async () => {
  if (!paused) {
    await timeCheck()
  }
  setTimeout(() => {
    doTick()
  }, 5000)
}

const doMain = () => {
  soundVol = storage.getSync('soundVol').volume
  rainVol = storage.getSync('rainVol').volume
  grandFather = storage.getSync('grandFather').enabled
  game = storage.getSync('game').game
  lang = storage.getSync('lang').lang
  tuneEnabled = storage.getSync('tuneEnabled').tuneEnabled
  preferNoDownload = storage.getSync('preferNoDownload').preferNoDownload
  tune = storage.getSync('tune').tune
  paused = storage.getSync('paused').paused
  gameRain = storage.getSync('gameRain').enabled
  peacefulRain = storage.getSync('peacefulRain').enabled
  kkEnabled = storage.getSync('kkEnabled').songs
  kkSaturday = storage.getSync('kkSaturday').enabled
  openOnStartup = storage.getSync('openOnStartup').enabled
  latestVersion = storage.getSync('latestVersion').version
  let showChangelog = false

  offlineFiles = keys.filter(e => e.includes('meta-') && !e.includes('meta-kk-slider') && !e.includes('meta-rain')).length
  offlineKKFiles = keys.filter(e => e.includes('meta-kk-slider')).length

  if (latestVersion !== currentVersion) {
    storage.set('latestVersion', { version: currentVersion })
    showChangelog = true
  }
  if (paused === undefined) paused = false
  if (soundVol === undefined) soundVol = 0.50
  else soundVol = soundVol / 100
  if (rainVol === undefined) rainVol = 0.50
  else rainVol = rainVol / 100
  if (grandFather === undefined) grandFather = false
  if (game === undefined) game = 'new-leaf'
  if (lang === undefined) lang = 'en'
  if (tuneEnabled === undefined) tuneEnabled = true
  if (preferNoDownload === undefined) preferNoDownload = false
  if (gameRain === undefined) gameRain = false
  if (peacefulRain === undefined) peacefulRain = false
  if (kkEnabled === undefined) kkEnabled = kkSongs
  if (kkSaturday === undefined) kkSaturday = false
  if (openOnStartup === undefined) openOnStartup = false
  if (tune === undefined) {
    tune = [
      'G1',
      'E2',
      '-',
      'G1',
      'F1',
      'D2',
      '-',
      'B2',
      'C2',
      'zZz',
      '?',
      'zZz',
      'C1',
      '-',
      'zZz',
      'zZz'
    ]
  }

  ipc.send('toWindow', ['configs', { soundVol: soundVol * 100, rainVol: rainVol * 100, grandFather, game, lang, offlineFiles, offlineKKFiles, tune, tuneEnabled, preferNoDownload, paused, gameRain, peacefulRain, kkEnabled, kkSaturday, openOnStartup, showChangelog }])

  superagent
    .get('https://cms.mat.dog/getSupporters')
    .then(res => {
      if (res && res.text) {
        ipc.send('toWindow', ['patreon', JSON.parse(res.text)])
      } else {
        ipc.send('toWindow', ['patreon', []])
      }
    }).catch(err => {
      console.log(err)
      ipc.send('toWindow', ['patreon', []])
    })

  chime = new Wad({
    source: 'chime.ogg',
    sprite: {
      G0: [0, 4],
      A1: [4, 8],
      B1: [8, 12],
      C1: [12, 16],
      D1: [16, 20],
      E1: [20, 24],
      F1: [24, 28],
      G1: [28, 32],
      A2: [32, 36],
      B2: [36, 40],
      C2: [40, 44],
      D2: [44, 48],
      E2: [48, 52]
    },
    volume: soundVol
  })
  beep = new Wad({
    source: 'triangle',
    env: { hold: -1, release: 0.2, sustain: 0.1 },
    pitch: 'G4',
    volume: 0.50
  })

  setTimeout(async () => {
    await playRain()
    doTick()
  }, 0)
}

const hourToPocketCamp = (hour) => {
  const morning = ['5am', '6am', '7am', '8am']
  const day = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm']
  const evening = ['5pm', '6pm']
  const night = ['7pm', '8pm', '9pm', '10pm', '11pm', '12am', '1am', '2am', '3am', '4am']

  if (~morning.indexOf(hour)) return 'morning'
  if (~day.indexOf(hour)) return 'day'
  if (~evening.indexOf(hour)) return 'evening'
  if (~night.indexOf(hour)) return 'night'
}

const downloadHourly = async () => {
  let total = 0
  let errs = 0
  const increment = 100 / (((games.length - 1) * 24) + 4) // + 4 is pocket camp
  const hours = ['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm']
  const pcHours = ['morning', 'day', 'evening', 'night']
  let delay = 1000
  let stop = false
  for (const g of games) {
    if (stop) return
    await new Promise(resolve => {
      setTimeout(async () => {
        for (let i = 0; i < (g === 'pocket-camp' ? 4 : 24); i++) {
          if (errs >= 3) {
            stop = true
            ipc.send('toWindow', ['error', 'failedToDownload'])
            resolve()
            break
          }

          await new Promise(resolve => setTimeout(() => resolve(), delay))
          const oldUrl = `${baseUrl}/${g}/${g === 'pocket-camp' ? pcHours[i] : hours[i]}.ogg`
          const newUrl = toNewUrl(oldUrl)
          const lastModified = storage.getSync(`meta-${newUrl}`).lastModified
          if (lastModified) {
            delay = 0
          } else {
            delay = 1000
            const res = await localSave(oldUrl, newUrl, lastModified)

            if (res === 'err') {
              errs++
            }
          }

          total += increment
          progress(total)

          if ((g === 'pocket-camp' && i === 3) || (i === 23)) {
            resolve()
          }
        }
      }, 0)
    })
  }

  ipc.send('toWindow', ['downloadDoneAll'])
  progress(100)
}

const downloadKK = async () => {
  let total = 0
  let errs = 0
  const increment = 100 / kkSongs.length
  let delay = 1000
  for (const s of kkSongs) {
    if (errs >= 3) {
      ipc.send('toWindow', ['error', 'failedToDownload'])
      break
    }
    await new Promise(resolve => {
      setTimeout(async () => {
        await new Promise(resolve => setTimeout(() => resolve(), delay))

        const oldUrl = `${baseUrl}/kk-slider-desktop/${s}.ogg`
        const newUrl = toNewUrl(oldUrl)
        const lastModified = storage.getSync(`meta-${newUrl}`).lastModified
        if (lastModified) {
          delay = 0
        } else {
          delay = 1000
          const res = await localSave(oldUrl, newUrl, lastModified)

          if (res === 'err') {
            errs++
          }
        }

        total += increment
        progress(total)
        resolve()
      }, 0)
    })
  }

  ipc.send('toWindow', ['downloadDoneAll'])
  progress(100)
}

const playChime = async (play) => {
  return await new Promise(resolve => {
    if (!play) return resolve('done')
    let i = 0
    chimeInt = setInterval(() => {
      chime.setVolume(soundVol)
      if (tune[i] !== 'zZz' && tune[i] !== '-' && tune[i] !== '?') {
        chime[tune[i]].play()
      } else if (tune[i] === '?') {
        chime[tunes[~~(Math.random() * tunes.length)]].play()
      }
      i++
      if (i === tune.length) {
        fadeAndStopChime()
        resolve('done')
        clearInterval(chimeInt)
      }
    }, 900)
  })
}

const fadeAndStopChime = async () => {
  for (let i = (soundVol * 100); i >= 0; i--) {
    await new Promise(resolve => setTimeout(() => resolve(), 5))
    chime.setVolume(i / 100)
  }
  chime.stop()
}

const playBeeps = async (beeps) => {
  for (const [index, value] of beeps.entries()) {
    let delay = 350
    if (beeps[index + 1] && beeps[index + 1] === '2') {
      // Figure out how long to delay
      const post = beeps.slice(index + 1)
      let count = 1
      for (const b of post) {
        if (b === '2') count++
        else break
      }

      delay = 350 * count
    }
    await playBeep(value, delay)
  }
}

const playBeep = async (note, delay) => {
  return await new Promise(resolve => {
    let pitchIndex = 0
    if (note === '1') {
      beepTimeout = setTimeout(() => {
        beep.stop()
        clearTimeout(beepTimeout)
        resolve('done')
      }, delay)
    } else if (note === '2') {
      resolve('done')
    } else {
      if (note === '16') pitchIndex = ~~(Math.random() * 13)
      else pitchIndex = +note - 3

      clearTimeout(beepTimeout)
      beep.stop()
      beep.play({ pitch: tunesBeepMap[pitchIndex] })
      beepTimeout = setTimeout(() => {
        beep.stop()
        clearTimeout(beepTimeout)
        resolve('done')
      }, delay)
    }
  })
}

ipc.on('toPlayer', handleIpc)
ipc.send('playerLoaded')
