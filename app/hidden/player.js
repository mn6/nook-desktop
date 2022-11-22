const ipc = require('electron').ipcRenderer
const storage = require('electron-json-storage')
const fs = require('fs')
const superagent = require('superagent')
const Wad = window.Wad

let chime
let beep
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
let chimeInt
let userSettingsPath
let lang
let keys
let offlineFiles
let offlineKKFiles
let tune
let tuneEnabled
let beepTimeout
let paused
let gameRain
let peacefulRain
let kkEnabled
let kkSaturday

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
  'population-growing', 'population-growing-snowy', 'population-growing-cherry', 'wild-world', 'wild-world-rainy', 'wild-world-snowy', 'new-leaf', 'new-leaf-rainy', 'new-leaf-snowy', 'new-horizons', 'new-horizons-rainy', 'new-horizons-snowy', 'pocket-camp'
]
const kkSongs = require('../kk.json')

const getHour = () => {
  const d = new Date()
  const hrs = d.getHours()
  return `${(hrs + 24) % 12 || 12}${hrs >= 12 ? 'pm' : 'am'}`
}

const progress = num => {
  ipc.send('toWindow', ['bar', num])
}

const unloadSound = async () => {
  if (sound) await sound.unload()
  if (rainSound) await rainSound.unload()
  sound = null
  rainSound = null
}

const handleClock = async (kk = false) => {
  return await new Promise(resolve => {
    if (paused) {
      unloadSound()
      return resolve()
    }
    const playSound = async () => {
      const gameUrl = game === 'random' ? games[~~(Math.random() * games.length)] : game
      sound = new Howl({
        src: [await getUrl(`${baseUrl}/${gameUrl}/${gameUrl === 'kk-slider-desktop' ? kkEnabled[~~(Math.random() * kkEnabled.length)] : gameUrl === 'pocket-camp' ? hourToPocketCamp(hour) : hour}.ogg`)],
        loop: gameUrl !== 'kk-slider-desktop',
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

        if (sound) {
          sound.play()
          sound.fade(0, soundVol / 100, 1000)
        }

        resolve('sound loaded')
      })

      sound.on('end', async () => {
        if (game === 'kk-slider-desktop' && !grandFather) {
          hour = null
          await handleClock(true)
        }
      })
    }
    const newHour = getHour()

    if ((hour !== newHour) || kk) {
      if (kkSaturday && ~['8pm', '9pm', '10pm', '11pm'].indexOf(newHour) && (new Date().getDay() === 6)) {
        game = 'kk-slider-desktop'
        ipc.send('toWindow', ['updateGame', game])
      }
      if (kkSaturday && (newHour === '12am') && (new Date().getDay() === 6)) {
        game = storage.getSync('game').game || 'new-leaf'
        ipc.send('toWindow', ['updateGame', game])
      }

      const diffHour = hour !== newHour
      const oldHour = hour
      hour = newHour
      clearTimeout(fadeTimeout)

      if (sound) {
        sound.on('fade', async () => {
          progress(50)

          await unloadSound()

          if (diffHour) await playChime(tuneEnabled && ((oldHour !== null) || kk))

          playSound()
        })
        sound.fade(soundVol / 100, 0, 1000)
      } else {
        playSound()
        replayRain()
      }
    } else {
      resolve('hour same')
    }
  })
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
  lang = storage.getSync('lang').lang
  tuneEnabled = storage.getSync('tuneEnabled').tuneEnabled
  tune = storage.getSync('tune').tune
  paused = storage.getSync('paused').paused
  gameRain = storage.getSync('gameRain').enabled
  peacefulRain = storage.getSync('peacefulRain').enabled
  kkEnabled = storage.getSync('kkEnabled').songs
  kkSaturday = storage.getSync('kkSaturday').enabled

  offlineFiles = keys.filter(e => e.includes('meta-') && !e.includes('meta-kk-slider') && !e.includes('meta-rain')).length
  offlineKKFiles = keys.filter(e => e.includes('meta-kk-slider')).length

  if (paused === undefined) paused = false
  if (soundVol === undefined) soundVol = 50
  if (rainVol === undefined) rainVol = 50
  if (grandFather === undefined) grandFather = false
  if (game === undefined) game = 'new-leaf'
  if (lang === undefined) lang = 'en'
  if (tuneEnabled === undefined) tuneEnabled = true
  if (gameRain === undefined) gameRain = false
  if (peacefulRain === undefined) peacefulRain = false
  if (kkEnabled === undefined) kkEnabled = kkSongs
  if (kkSaturday === undefined) kkSaturday = false
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

  ipc.send('toWindow', ['configs', { soundVol, rainVol, grandFather, game, lang, offlineFiles, offlineKKFiles, tune, tuneEnabled, paused, gameRain, peacefulRain, kkEnabled, kkSaturday }])

  superagent
    .get('https://cms.mat.dog/getSupporters')
    .then(res => {
      if (res && res.text) {
        ipc.send('toWindow', ['patreon', JSON.parse(res.text)])
      }
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
    volume: soundVol / 100
  })
  beep = new Wad({
    source: 'triangle',
    env: { hold: -1, release: 0.2, sustain: 0.1 },
    pitch: 'G4',
    volume: 0.50
  })

  setTimeout(async () => {
    if (paused) return

    await replayRain()
    await handleClock()
    timeHandler()
  }, 0)
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

  if (!lastModified) {
    if (s === 'err' || s === 'head fail' || s === 'no headers error') {
      if (newUrl.includes('rain-')) {
        ipc.send('toWindow', ['error', 'failedToLoadRainSound'])
      } else {
        ipc.send('toWindow', ['error', 'failedToLoadSound'])
        await unloadSound()
      }

      return ''
    }
  }

  return `${userSettingsPath}/sound/${newUrl}.ogg`
}

const localSave = async (oldUrl, newUrl, lastModified) => {
  return await new Promise(resolve => {
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
  })
}

const replay = async () => {
  hour = null
  await handleClock()
  await replayRain()
}

const replayRain = async () => {
  const setupRain = async () => {
    if (rainSound) {
      await rainSound.unload()
      rainSound = null
    }
    rainSound = new Howl({
      src: [await getUrl(`${baseUrl}/rain/${gameRain ? 'game-rain' : peacefulRain ? 'no-thunder-rain' : 'rain'}.ogg`)],
      loop: true,
      volume: 0
    })

    rainSound.on('load', () => {
      progress(100)
      if (rainSound) {
        rainSound.play()
        rainSound.fade(0, rainVol / 100, 1000)
      }
    })
  }

  await setupRain()
}

const handleIpc = (event, arg) => {
  const command = arg[0]
  arg.shift()

  if (command === 'userSettingsPath') {
    userSettingsPath = arg[0]
    storage.setDataPath(arg[0])
    storage.keys((err, k) => {
      if (!err) keys = k
      else keys = []
      doMain()
    })
  } else if (command === 'musicVol') {
    if (sound) sound.volume(+arg[0] / 100)
    soundVol = +arg[0]
    storage.set('soundVol', { volume: +arg[0] })
  } else if (command === 'rainVol') {
    if (rainSound) rainSound.volume(+arg[0] / 100)
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
  } else if (command === 'tuneEnabled') {
    tuneEnabled = arg[0]
    storage.set('tuneEnabled', { tuneEnabled: arg[0] })
  } else if (command === 'tune') {
    tune = arg[0]
    storage.set('tune', { tune })
  } else if (command === 'playNote') {
    setTimeout(async () => {
      await playBeep(arg[0], 350)
    }, 0)
  } else if (command === 'playTune') {
    setTimeout(async () => {
      await playBeeps(arg[0])
    }, 0)
  } else if (command === 'paused') {
    paused = arg[0]
    storage.set('paused', { paused: arg[0] })
    if (!paused) {
      replay()
    } else {
      unloadSound()
    }
  } else if (command === 'downloadHourly') {
    downloadHourly()
  } else if (command === 'downloadKK') {
    downloadKK()
  } else if (command === 'gameRain') {
    gameRain = arg[0]
    peacefulRain = false
    storage.set('gameRain', { enabled: arg[0] })
    storage.set('peacefulRain', { enabled: false })
    replayRain()
  } else if (command === 'peacefulRain') {
    peacefulRain = arg[0]
    gameRain = false
    storage.set('peacefulRain', { enabled: arg[0] })
    storage.set('gameRain', { enabled: false })
    replayRain()
  } else if (command === 'kkEnabled') {
    kkEnabled = arg[0]
    storage.set('kkEnabled', { songs: arg[0] })
    if (game === 'kk-slider-desktop') {
      replay()
    }
  } else if (command === 'kkSaturday') {
    kkSaturday = arg[0]
    storage.set('kkSaturday', { enabled: arg[0] })
  }
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
        console.log(oldUrl)
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
      if (tune[i] !== 'zZz' && tune[i] !== '-' && tune[i] !== '?') {
        chime[tune[i]].play()
      } else if (tune[i] === '?') {
        chime[tunes[~~(Math.random() * tunes.length)]].play()
      }
      i++
      if (i === tune.length) {
        resolve('done')
        clearInterval(chimeInt)
      }
    }, 900)
  })
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

// const stopChime = async () => {
//   return await new Promise(resolve => {
//     clearInterval(chimeInt)
//     chime.stop()
//   })
// }

ipc.on('toPlayer', handleIpc)
ipc.send('playerLoaded')
