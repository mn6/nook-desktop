const request = require('superagent')
const uuid = require('uuid')
const ipc = require('electron').ipcRenderer
const $ = window.jQuery
const Nanobar = window.Nanobar
const CustomEvent = window.CustomEvent
const confirm = window.confirm
const u = uuid.v4()
let i18n
let blinkers
let paused = false
let language = 'en'

// Load translations here
const translations = {
  en: require('./i18n/Nook_English.json'),
  es: require('./i18n/Nook_Spanish.json'),
  de: require('./i18n/Nook_German.json'),
  it: require('./i18n/Nook_Italian.json'),
  fr: require('./i18n/Nook_French.json'),
  cn: require('./i18n/Nook_Chinese.json')
}

const changelog = require('../release-log.json')

const kkSongs = require('../kk.json')
const kkHtml = () => {
  let res = ''
  kkSongs.forEach(song => {
    res += `<label><input type="checkbox" class="kkSong" data-title="${song}" />${song}</label>`
  })

  return res
}

const replaceDataInit = {
  offlineKKFiles: 0,
  offlineFiles: 0,
  totalKKFiles: 193,
  totalFiles: 294
}

const replaceDataObs = {
  set (obj, prop, value) {
    obj[prop] = value

    $(`[data-i18n*="${prop}"]`).each((_, e) => {
      $(e).html(i18n($(e).attr('data-i18n')).replace(prop, value))
    })
  }
}

const replaceData = new Proxy(replaceDataInit, replaceDataObs)

const tunes = [
  'zZz',
  '-',
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
  'E2',
  '?'
]

let nanobar

const template = `
<div class="container overlay">
  <div class="error"><div></div></div>
  <div class="header">
      <span class="title"><span id="openGithub" role="link" data-i18n-title="Nook GitHub">nook</span> |
          <button id="settings" data-i18n-title="Settings" role="link"></button>
          <button id="home" class="hidden" data-i18n-title="Home" role="link"></button>
          <button id="pause" data-i18n-title="Pause" data-i18n-title-alt="Play"></button>
      </span>
      <div class="buttonbox">
          <button id="close" data-i18n-title="Minimize to tray"></button>
          <button id="exit" data-i18n-title="Exit Nook"></button>
      </div>
  </div>
  <div class="main">
      <div class="home page">
          <div class="controls">
              <label>
                  <span data-i18n="Music Volume"></span>
                  <input id="music" type="range" step="1" min="0" max="100" />
              </label>
              <label>
                  <span data-i18n="Rain Volume"></span>
                  <input id="rain" type="range" step="1" min="0" max="100" />
              </label>
          </div>
          <div class="game-select">
              <select id="gameSelect">
                  <option value="population-growing" data-i18n="AC: Population Growing (GC)"></option>
                  <option value="population-growing-snowy" data-i18n="AC: Population Growing (GC) [Snowy]"></option>
                  <option value="population-growing-cherry" data-i18n="AC: Population Growing (GC) [Sakura]"></option>
                  <option value="population-growing-rainy" data-i18n="AC: Population Growing (GC) [Rainy Day]"></option>
                  <option value="wild-world" data-i18n="AC: City Folk (Wii)"></option>
                  <option value="wild-world-rainy" data-i18n="AC: City Folk (Wii) [Rainy]"></option>
                  <option value="wild-world-snowy" data-i18n="AC: City Folk (Wii) [Snowy]">}</option>
                  <option value="new-leaf" selected data-i18n="AC: New Leaf (3DS)"></option>
                  <option value="new-leaf-rainy" data-i18n="AC: New Leaf (3DS) [Rainy]"></option>
                  <option value="new-leaf-snowy" data-i18n="AC: New Leaf (3DS) [Snowy]"></option>
                  <option value="new-horizons" data-i18n="AC: New Horizons (Switch)"></option>
                  <option value="new-horizons-rainy" data-i18n="AC: New Horizons (Switch) [Rainy]"></option>
                  <option value="new-horizons-snowy" data-i18n="AC: New Horizons (Switch) [Snowy]"></option>
                  <option value="pocket-camp" data-i18n="AC: Pocket Camp (Mobile)"></option>
                  <optgroup label="&nbsp;"></optgroup>
                  <option value="kk-slider-desktop" data-i18n="K.K. Slider"></option>
                  <option value="random" data-i18n="Random"></option>
              </select>    
          </div>
          <div class="bottom-support">
            <button id="patreon" data-i18n="patreon" data-i18n-title="Patreon list and support links"></button>
            <button id="changelog" data-i18n="changelog" data-i18n-title="changelog"></button>
          </div>
      </div>
      <div class="settings page hidden">
          <p data-i18n="player settings" role="heading" aria-level="1"></p>
          <label>
              <input id="grandFather" type="checkbox"/>
              <span data-i18n="Grandfather clock mode"></span> <span class="tiny" data-i18n="(plays once, no loop)"></span>
          </label>
          <label>
              <input class="rains" id="gameRain" type="checkbox"/>
              <span data-i18n="Use game rain sound"></span>
          </label>
          <label>
              <input class="rains" id="peacefulRain" type="checkbox"/>
              <span data-i18n="Use no-thunder rain sound"></span>
          </label>
          <label>
              <input id="preferNoDownload" type="checkbox"/>
              <span data-i18n="Don't download music"></span> <span class="tiny" data-i18n="(saves space, but no offline)"></span>
          </label>
          <div class="towntune-setting">
            <label>
                <input id="townTune" type="checkbox"/>
                <span data-i18n="Enable town tune"></span>
            </label>
          </div>
          <label class="kk-label">
            <input id="kkSaturday" type="checkbox"/>
            <span data-i18n="Play K.K. music on Saturday nights"></span>
          </label>
          <label>
              <input id="openOnStartup" type="checkbox"/>
              <span data-i18n="Open on startup"></span>
          </label>
          <div class="btnContainer">
            <button id="kkCustomize" data-i18n="customize k.k. playlist"></button>
            <button class="towntune-custom" id="towntune_customize" data-i18n="customize town tune"></button>
          </div>
          <label class="lang-label">
            <p data-i18n="language"></p>
              <select id="langSelect">
                <option value="en">
                    English (US)
                </option>
                <option value="es">
                    Spanish/Español (ES)
                </option>
                <option value="de">
                    German/Deutsch (DE)
                </option>
                <option value="it">
                    Italian/Italiano (IT)
                </option>
                <option value="fr">
                    French/Français (FR)
                </option>
                <option value="cn">
                    Chinese/中文 (CN)
                </option>
              </select>
          </label>
          <p class="offline" data-i18n="offline" role="heading" aria-level="2"></p>
          <span class="offlineCount" data-i18n="{{offlineFiles}}/{{totalFiles}} offline hourly music files downloaded"></span>
          <span class="offlineCount" data-i18n="{{offlineKKFiles}}/{{totalKKFiles}} offline k.k. music files downloaded"></span>
          <div class="btnContainer">
            <button class="download" id="downloadHourly" data-i18n="download all hourly music" data-i18n-alt="downloading..."></button>
            <button class="download" id="downloadKK" data-i18n="download all k.k. music" data-i18n-alt="downloading..."></button>
          </div>
          <div class="btnContainer">
              <button id="clearSettings" data-i18n="clear local files and settings"></button>
          </div>
      </div>
      <div class="kk-customize page hidden">
          <p data-i18n="k.k. playlist" role="heading" aria-level="1"></p>
          <div class="kk-btn btnContainer">
            <button id="save_kk" data-i18n="save" data-i18n-alt="saved!"></button>
            <button id="check_kk" data-i18n="check all"></button>
            <button id="uncheck_kk" data-i18n="uncheck all"></button>
            <button id="radio_kk" data-i18n="radio only"></button>
            <button id="live_kk" data-i18n="live only"></button>
          </div>
          <div class="playlist">
            ${kkHtml()}
          </div>
      </div>
      <div class="tune-settings page hidden">
          <p data-i18n="tune settings" role="heading" aria-level="1"></p>
          <div class="creator">
            <div class="inputs">
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
              <label>
                <input type="range" class="tune-slider" step="1" min="1" max="16">
                <span></span>
              </label>
            </div>
          </div>
          <div class="tips">
            <p data-i18n="tip: you can use the mouse wheel to adjust notes!"></p>
          </div>
          <div class="save-tune-btn btnContainer">
            <button id="save_tune" data-i18n="save" data-i18n-alt="saved!"></button>
            <button id="play_tune" data-i18n="play" data-i18n-alt="playing..."></button>
          </div>
      </div>
      <div class="patreon page hidden">
          <div class="head">
              <p data-i18n="patreon supporters" role="heading" aria-level="1"></p>
              <button id="supportme" data-i18n="(support me!)" data-i18n-title="Opens developer's Patreon page"></button>
          </div>
          <div class="supporters">
              <div class="gold">
                  <p data-i18n="gold supporters" role="heading" aria-level="2"></p>
                  <ul>
                  </ul>
              </div>
              <div class="silver">
                  <p data-i18n="silver supporters" role="heading" aria-level="2"></p>
                  <ul>
                  </ul>
              </div>
              <div class="bronze">
                  <p data-i18n="bronze supporters" role="heading" aria-level="2"></p>
                  <ul>
                  </ul>
              </div>
          </div>
      </div>
      <div class="changelog page hidden">
          <p data-i18n="changelog" role="heading" aria-level="1"></p>
          <div class="log"></div>
      </div>
  </div>
</div>
`

const pause = (state) => {
  const btn = $('#pause')
  if (!state) {
    btn.removeClass('paused')
    btn.text('')
    btn.attr('title', i18n(btn.attr('data-i18n-title')))
  } else {
    btn.addClass('paused')
    btn.text('')
    btn.attr('title', i18n(btn.attr('data-i18n-title-alt')))
  }
}

const setCooldown = () => {
  $('.settings').find('input, button, select').attr('disabled', true)
  setTimeout(() => {
    $('.settings').find('input, button, select').removeAttr('disabled')
  }, 300)
}

const changeLang = (lang, manual, arg) => {
  language = lang
  i18n = key => {
    let t = translations[lang][key]
    if (!t) {
      console.error(`${lang} translation missing for "${key}"`)
      t = translations.en[key]
    }
    if (!t) {
      console.error(`translation missing for "${key}"`)
      t = key
    }

    Object.entries(replaceData).forEach(entry => {
      t = t.replaceAll(`{{${entry[0]}}}`, entry[1])
    })
    return t
  }

  let obj
  if (manual) obj = $('body')
  else obj = $(template)

  obj.find('[data-i18n-title]').each((i, e) => {
    $(e).attr('title', i18n($(e).attr('data-i18n-title')))
  })
  obj.find('[data-i18n]').each((i, e) => {
    $(e).html(i18n($(e).attr('data-i18n')))
  })

  let changelogHtml = ''
  Object.keys(changelog).forEach(e => {
    changelogHtml += `<p>${e}</p><ul><li>${changelog[e].join('</li><li>')}</li></ul>`
  })
  obj.find('.log').html(changelogHtml)

  if (!manual) $('body').append(obj)

  if (!manual) {
    setTimeout(() => {
      exec()

      $('.container').addClass('visible')

      $('#music').val(arg.soundVol)
      $('#rain').val(arg.rainVol)
      $('#grandFather').prop('checked', arg.grandFather)
      $('#gameRain').prop('checked', arg.gameRain)
      $('#peacefulRain').prop('checked', arg.peacefulRain)
      $('#gameSelect').val(arg.game)
      $('#langSelect').val(arg.lang)
      $('#townTune').prop('checked', arg.tuneEnabled)
      $('#preferNoDownload').prop('checked', arg.preferNoDownload)
      $('#kkSaturday').prop('checked', arg.kkSaturday)
      $('#openOnStartup').prop('checked', arg.openOnStartup)

      arg.kkEnabled.forEach((song) => {
        $(`.kk-customize input[data-title="${song}"]`).prop('checked', true)
      })

      paused = arg.paused
      pause(arg.paused)

      $('.creator .inputs label').each((i, e) => {
        const el = $(e)
        el.find('input').val(tunes.indexOf(arg.tune[i]) + 1)
        el.find('input').attr('c', el.find('input').val())
      })

      if (arg.showChangelog) {
        showChangelog()
      }
    }, 0)
  }
}

const showChangelog = () => {
  $('#changelog').click()
}

const logVis = (page) => {
  request
    .post('https://www.google-analytics.com/mp/collect')
    .query({
      api_secret: 'V8GvDmXcQmWaAM6HGa0nDg',
      measurement_id: 'G-3Y8P169K9E'
    })
    .send(JSON.stringify({
      client_id: u,
      user_properties: {
        language: {
          value: language
        }
      },
      events: [
        {
          name: 'page_view',
          params: {
            page_title: page,
            page_location: `https://mat.dog/nook/${page}`,
            engagement_time_msec: '5',
            session_id: u
          }
        }
      ]
    }))
    .then(() => {})
    .catch(() => {})
}

const exec = () => {
  logVis('home')

  $('#close').on('click', () => {
    ipc.send('min')
  })

  $('#exit').on('click', () => {
    ipc.send('close')
  })

  $('#pause').on('click', () => {
    paused = !paused
    pause(paused)
    // Change class or somethin
    ipc.send('toPlayer', ['paused', paused])
  })

  $('.patreon #supportme').on('click', (e) => {
    logVis('patreonLink')
    ipc.send('patreon')
  })

  $('.title #openGithub').on('click', (e) => {
    logVis('github')
    ipc.send('github')
  })

  $('#patreon').on('click', () => {
    logVis('patreon')

    $('.page').addClass('hidden')
    $('.patreon.page').removeClass('hidden')

    $('#settings').addClass('hidden')
    $('#home').removeClass('hidden').focus()
  })

  $('#changelog').on('click', () => {
    logVis('changelog')

    $('.page').addClass('hidden')
    $('.changelog.page').removeClass('hidden')

    $('#settings').addClass('hidden')
    $('#home').removeClass('hidden').focus()
  })

  $('#towntune_customize').on('click', () => {
    logVis('towntune')
    $('.page').addClass('hidden')
    $('.tune-settings.page').removeClass('hidden')

    $('#home').addClass('hidden')
    $('#settings').removeClass('hidden').focus()
  })

  $('#kkCustomize').on('click', () => {
    logVis('kkCustomize')
    $('.page').addClass('hidden')
    $('.kk-customize.page').removeClass('hidden')

    $('#home').addClass('hidden')
    $('#settings').removeClass('hidden').focus()
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
    logVis('settings')
    $('.page').addClass('hidden')
    $('.settings.page').removeClass('hidden')

    $('#settings').addClass('hidden')
    $('#home').removeClass('hidden').focus()
  })

  $('#home').on('click', () => {
    logVis('home')
    $('.page').addClass('hidden')
    $('.home.page').removeClass('hidden')

    $('#home').addClass('hidden')
    $('#settings').removeClass('hidden').focus()
  })

  $('.settings #grandFather').on('change', (e) => {
    ipc.send('toPlayer', ['grandFather', e.target.checked])
    setCooldown()
  })

  $('.settings #gameRain').on('change', (e) => {
    ipc.send('toPlayer', ['gameRain', e.target.checked])
    $('#peacefulRain').prop('checked', false)
    setCooldown()
  })

  $('.settings #peacefulRain').on('change', (e) => {
    ipc.send('toPlayer', ['peacefulRain', e.target.checked])
    $('#gameRain').prop('checked', false)
    setCooldown()
  })

  $('.settings #townTune').on('change', (e) => {
    ipc.send('toPlayer', ['tuneEnabled', e.target.checked])
    setCooldown()
  })

  $('.settings #preferNoDownload').on('change', (e) => {
    ipc.send('toPlayer', ['preferNoDownload', e.target.checked])
    setCooldown()
  })

  $('.settings #kkSaturday').on('change', (e) => {
    ipc.send('toPlayer', ['kkSaturday', e.target.checked])
    setCooldown()
  })

  $('.settings #openOnStartup').on('change', (e) => {
    ipc.send('toPlayer', ['openOnStartup', e.target.checked])
    setCooldown()
  })

  $('.settings #langSelect').on('change', (e) => {
    changeLang(e.target.value, true)
    ipc.send('toPlayer', ['lang', e.target.value])
  })

  $('.settings #clearSettings').on('click', async (e) => {
    const r = confirm(`${i18n('Are you sure?')}\n\n${i18n('Click "OK" to proceed and delete all local music files and user settings.')}`)
    if (r) ipc.send('clearSettings')
  })

  $('.settings #downloadHourly').on('click', async (e) => {
    $(e.currentTarget).text(i18n($(e.currentTarget).attr('data-i18n-alt')))
    $('.settings .download').attr('disabled', 'true')
    ipc.send('toPlayer', ['downloadHourly'])
    setCooldown()
  })

  $('.settings #downloadKK').on('click', async (e) => {
    $(e.currentTarget).text(i18n($(e.currentTarget).attr('data-i18n-alt')))
    $('.settings .download').attr('disabled', 'true')
    ipc.send('toPlayer', ['downloadKK'])
    setCooldown()
  })

  $('.kk-customize #save_kk').on('click', (e) => {
    const list = []
    $('.kk-customize input').each((i, e) => {
      if ($(e).prop('checked') === true) {
        list.push($(e).attr('data-title'))
      }
    })

    ipc.send('toPlayer', ['kkEnabled', list])

    $(e.currentTarget).text(i18n($(e.currentTarget).attr('data-i18n-alt')))
    setTimeout(() => {
      $(e.currentTarget).text(i18n($(e.currentTarget).attr('data-i18n')))
    }, 1000)
  })

  $('.kk-customize #check_kk').on('click', () => {
    $('.kk-customize input').prop('checked', true)
  })

  $('.kk-customize #uncheck_kk').on('click', () => {
    $('.kk-customize input').prop('checked', false)
  })

  $('.kk-customize #live_kk').on('click', () => {
    $('.kk-customize label').not(':contains(Radio)').find('input').prop('checked', true)
    $('.kk-customize label').filter(':contains(Radio)').find('input').prop('checked', false)
  })

  $('.kk-customize #radio_kk').on('click', () => {
    $('.kk-customize label').filter(':contains(Radio)').find('input').prop('checked', true)
    $('.kk-customize label').not(':contains(Radio)').find('input').prop('checked', false)
  })

  $('.tune-settings input[type="range"]').on('wheel', e => {
    e.preventDefault()
    e.stopPropagation()
    if (e.originalEvent.deltaY < 0) {
      e.currentTarget.valueAsNumber += 1
    } else {
      e.currentTarget.value -= 1
    }
    e.currentTarget.dispatchEvent(new CustomEvent('input'))
  })

  $('.tune-settings input[type="range"]').on('click', e => {
    e.currentTarget.dispatchEvent(new CustomEvent('input'))
  })

  $('.tune-settings input[type="range"]').on('input', e => {
    const el = $(e.currentTarget)
    ipc.send('toPlayer', ['playNote', el.val()])
    el.attr('c', el.val())
  })

  $('#save_tune').on('click', () => {
    const saveTune = $('#save_tune')
    const tune = []
    $('.tune-settings input[type="range"]').each((i, e) => {
      tune.push(tunes[$(e).val() - 1])
    })
    ipc.send('toPlayer', ['tune', tune])
    saveTune.text(i18n(saveTune.attr('data-i18n-alt')))
    setTimeout(() => {
      saveTune.text(i18n(saveTune.attr('data-i18n')))
    }, 1000)
  })

  $('#play_tune').on('click', () => {
    clearInterval(blinkers)
    const tune = []
    $('.tune-settings input[type="range"]').each((i, e) => {
      tune.push($(e).val())
    })
    ipc.send('toPlayer', ['playTune', tune])
    let i = 1
    $('.tune-settings label').eq(0).addClass('blink')
    blinkers = setInterval(() => {
      if (i === tune.length) {
        $('.tune-settings label').removeClass('blink')
        clearInterval(blinkers)
      } else {
        // Add some class
        $('.tune-settings label').removeClass('blink').eq(i).addClass('blink')
      }
      i++
    }, 350)
  })
}

const showErr = (err) => {
  $('.error div').html(err).parent().addClass('show-error')
  setTimeout(() => {
    $('.error').removeClass('show-error')
  }, 4000)
}

$(document).ready(() => {
  ipc.on('toWindow', (event, arg) => {
    if (arg[0] === 'bar') {
      nanobar.go(+arg[1])
    } else if (arg[0] === 'configs') {
      changeLang(arg[1].lang, false, arg[1])

      nanobar = new Nanobar({
        classname: 'nanobar',
        id: 'nanobar',
        target: $('.header')[0]
      })
      nanobar.go(0)

      replaceData.offlineFiles = arg[1].offlineFiles
      replaceData.offlineKKFiles = arg[1].offlineKKFiles
    } else if (arg[0] === 'error') {
      if (arg[1] === 'failedToDownload') {
        nanobar.go(100)
      }
      showErr(i18n(arg[1]))
    } else if (arg[0] === 'downloadDone') {
      if (arg[1] === 'kk') {
        replaceData.offlineKKFiles++
      } else {
        replaceData.offlineFiles++
      }
    } else if (arg[0] === 'downloadRemoved') {
      if (arg[1] === 'kk') {
        replaceData.offlineKKFiles--
      } else {
        replaceData.offlineFiles--
      }
    } else if (arg[0] === 'downloadDoneAll') {
      $('.settings .download').removeAttr('disabled')
      $('.settings #downloadHourly').text(i18n($('.settings #downloadHourly').attr('data-i18n')))
      $('.settings #downloadKK').text(i18n($('.settings #downloadKK').attr('data-i18n')))
    } else if (arg[0] === 'patreon') {
      const template = '<li title="{{fill}}">{{fill}}</li>'
      Object.entries(arg[1]).forEach(thing => {
        thing[1].forEach(name => {
          $(`.${thing[0]} ul`).append(template.replaceAll('{{fill}}', name))
        })
      })
    } else if (arg[0] === 'updateGame') {
      $('#gameSelect').val(arg[1])
    } else if (arg[0] === 'pause') {
      paused = true
      pause(true)
    }
  })
})
