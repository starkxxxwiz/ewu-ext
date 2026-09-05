/* =============================================================
   EWU Portal Helper v1.1
   Content Script
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONFIGURATION
     ----------------------------------------------------------- */
  var CONFIG = {
    PORTAL_BASE: 'https://portal.ewubd.edu',
    LOG_PREFIX: '[EWU Portal Helper]',
    ROUTINE_LOG: '[EWU Helper][Routine]',
    STORAGE_KEY: 'ewu_portal_helper_settings',
    VERSION: '1.1',
  };

  /* -----------------------------------------------------------
     DEFAULT SETTINGS
     ----------------------------------------------------------- */
  var DEFAULT_SETTINGS = {
    enabled: true,
    theme: 'dark',
    animations: true,
    toastNotifications: true,
    stickyHeader: true,
    compactMode: false,
    modules: {
      loginHelper: true,
      loginHelperAutoFill: true,
      loginHelperDelay: 300,
      loginHelperDebug: false,
      routineGenerator: true,
      routineCompact: false,
      routineShowLogo: true,
      routineBlueIntensity: 'medium',
      routineExportQuality: 'standard',
      scheduleEnhancer: true,
      scheduleEmailLink: true,
      scheduleSummaryCard: true,
      offeredCoursesEnhancer: true,
      offeredCoursesColorLeft: true,
      offeredCoursesStickyHeader: true,
      offeredCoursesSearchBox: true,
      offeredCoursesSearchPlaceholder: 'Search by course or faculty...',
      advisingTableEnhancer: true,
      advisingColorLeft: true,
      advisingSearchBox: true,
      advisingOffline: true,
      advisingOfflineRecommended: true,
      advisingOfflinePlanner: true,
      plannerCreditLimit: 15.0,
    },
  };

  /* -----------------------------------------------------------
     STRICT PAGE DETECTION
     ----------------------------------------------------------- */
  var ALLOWED_PATHS = [
    { path: '/',                          id: 'login',          label: 'Login Page' },
    { path: '/Account/Login',              id: 'login',          label: 'Login Page' },
    { path: '/account/login',              id: 'login',          label: 'Login Page' },
    { path: '/Home/ClassSchedule',         id: 'classSchedule',  label: 'My Class Schedule' },
    { path: '/home/classschedule',         id: 'classSchedule',  label: 'My Class Schedule' },
    { path: '/Home/OfferedCoursesStudent', id: 'offeredCourses', label: 'Offered Courses' },
    { path: '/home/offeredcoursesstudent', id: 'offeredCourses', label: 'Offered Courses' },
    { path: '/Home/Advising',              id: 'advising',       label: 'Advising Page' },
    { path: '/home/advising',              id: 'advising',       label: 'Advising Page' },
    { path: '/Home/AdvisingOffline',       id: 'advisingOffline', label: 'Advising Offline' },
    { path: '/home/advisingoffline',       id: 'advisingOffline', label: 'Advising Offline' },
  ];

  function detectPage() {
    var pn = location.pathname;
    for (var i = 0; i < ALLOWED_PATHS.length; i++) {
      var ap = ALLOWED_PATHS[i];
      if (pn === ap.path || pn.toLowerCase() === ap.path.toLowerCase()) {
        return { id: ap.id, label: ap.label };
      }
      if (ap.path === '/' && (pn === '/' || pn === '')) {
        return { id: ap.id, label: ap.label };
      }
    }
    return null;
  }

  function isVersionOutdated(currentVer, minVer) {
    if (!minVer || !currentVer) return false;
    var cParts = currentVer.split('.').map(function (n) { return parseInt(n, 10) || 0; });
    var mParts = minVer.split('.').map(function (n) { return parseInt(n, 10) || 0; });
    for (var i = 0; i < Math.max(cParts.length, mParts.length); i++) {
      var c = cParts[i] || 0;
      var m = mParts[i] || 0;
      if (c < m) return true;
      if (c > m) return false;
    }
    return false;
  }

  function renderSystemBanners() {
    chrome.storage.local.get(['ewu_system_shutdown', 'ewu_system_update', 'ewu_system_notice'], function (res) {
      var shutdown = res.ewu_system_shutdown || { enabled: false };
      var update = res.ewu_system_update || { isMandatory: false, minVersion: '1.1.0' };
      var notice = res.ewu_system_notice || { enabled: false };

      var existingBanner = document.getElementById('ewu-portal-system-banner');
      if (existingBanner) existingBanner.remove();

      // PRIORITY 1: Emergency Remote Shutdown
      if (shutdown.enabled) {
        var sBanner = document.createElement('div');
        sBanner.id = 'ewu-portal-system-banner';
        sBanner.style.cssText = 'position:fixed; top:18px; right:18px; z-index:999999; max-width:400px; background:rgba(13,19,33,0.95); border:1px solid rgba(244,63,94,0.55); border-radius:16px; padding:16px 20px; box-shadow:0 15px 40px rgba(0,0,0,0.8), 0 0 25px rgba(244,63,94,0.3); color:#fff; font-family:-apple-system,BlinkMacSystemFont,sans-serif; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); transition:all 0.3s ease;';
        sBanner.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><span style="color:#f43f5e; font-weight:800; font-size:13.5px; letter-spacing:0.3px;">' + (shutdown.title || 'System Temporarily Offline') + '</span><button style="background:transparent; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:2px 6px; line-height:1;" onclick="this.closest(\'#ewu-portal-system-banner\').remove()">✕</button></div><div style="font-size:12.5px; color:#cbd5e1; line-height:1.5;">' + (shutdown.message || 'EWU Portal Helper is currently disabled by administrator.') + '</div>';
        document.body.appendChild(sBanner);
        return;
      }

      var manifestVer = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '1.1.0';

      // PRIORITY 2: Mandatory Extension Update
      if (update.isMandatory && isVersionOutdated(manifestVer, update.minVersion)) {
        var uBanner = document.createElement('div');
        uBanner.id = 'ewu-portal-system-banner';
        uBanner.style.cssText = 'position:fixed; top:18px; right:18px; z-index:999999; max-width:400px; background:rgba(13,19,33,0.95); border:1px solid rgba(99,102,241,0.55); border-radius:16px; padding:16px 20px; box-shadow:0 15px 40px rgba(0,0,0,0.8), 0 0 25px rgba(99,102,241,0.3); color:#fff; font-family:-apple-system,BlinkMacSystemFont,sans-serif; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); transition:all 0.3s ease;';
        uBanner.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><span style="color:#818cf8; font-weight:800; font-size:13.5px; letter-spacing:0.3px;">' + (update.title || 'Extension Update Required') + '</span><button style="background:transparent; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:2px 6px; line-height:1;" onclick="this.closest(\'#ewu-portal-system-banner\').remove()">✕</button></div><div style="font-size:12.5px; color:#cbd5e1; line-height:1.5; margin-bottom:12px;">Please update EWU Buddy (v' + (update.latestVersion || update.minVersion) + ') to continue.</div><a href="' + (update.updateUrl || 'https://t.me/AftabKabir') + '" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; font-size:12px; font-weight:700; border-radius:10px; text-decoration:none; box-shadow:0 4px 14px rgba(99,102,241,0.4);">Update Now &rarr;</a>';
        document.body.appendChild(uBanner);
        return;
      }

      // PRIORITY 4: Optional Update Notice (non-blocking)
      if (!update.isMandatory && update.latestVersion && isVersionOutdated(manifestVer, update.latestVersion)) {
        var optBanner = document.createElement('div');
        optBanner.id = 'ewu-portal-opt-update';
        optBanner.style.cssText = 'width:100%; background:rgba(99,102,241,0.18); border-bottom:1px solid rgba(99,102,241,0.4); padding:8px 18px; color:#ffffff; font-size:12.5px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; display:flex; justify-content:space-between; align-items:center; box-sizing:border-box; z-index:99998;';
        optBanner.innerHTML = '<div><strong style="color:#818cf8; margin-right:6px;">EWU Buddy Update Available (v' + update.latestVersion + '):</strong><span>' + (update.title || 'New features & advising updates ready.') + '</span></div><div style="display:flex; align-items:center; gap:10px;"><a href="' + (update.updateUrl || 'https://t.me/AftabKabir') + '" target="_blank" style="color:#38bdf8; font-weight:700; text-decoration:underline; font-size:12px;">Download Update &rarr;</a><button style="background:transparent; border:none; color:#94a3b8; font-size:14px; cursor:pointer; padding:0 4px;" onclick="this.closest(\'#ewu-portal-opt-update\').remove()">✕</button></div>';
        var topBarEl = document.body.firstElementChild;
        if (topBarEl) document.body.insertBefore(optBanner, topBarEl);
        else document.body.appendChild(optBanner);
      }

      // PRIORITY 5: Broadcast Notice Banner (non-blocking)
      if (notice.enabled && (notice.title || notice.message)) {
        var nColor = notice.type === 'alert' ? '#f43f5e' : (notice.type === 'warning' ? '#f59e0b' : '#38bdf8');
        var nBg = notice.type === 'alert' ? 'rgba(244,63,94,0.15)' : (notice.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)');
        var nBorder = notice.type === 'alert' ? 'rgba(244,63,94,0.4)' : (notice.type === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(56,189,248,0.4)');

        var nBanner = document.createElement('div');
        nBanner.id = 'ewu-portal-system-banner';
        nBanner.style.cssText = 'width:100%; background:' + nBg + '; border-bottom:1px solid ' + nBorder + '; padding:10px 20px; color:#ffffff; font-size:13px; font-weight:500; font-family:-apple-system,BlinkMacSystemFont,sans-serif; display:flex; justify-content:space-between; align-items:center; box-sizing:border-box; z-index:99999; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); transition:opacity 0.4s ease;';
        nBanner.innerHTML = '<div>' + (notice.title ? '<strong style="color:' + nColor + '; font-weight:800; margin-right:8px;">' + notice.title + '</strong>' : '') + '<span>' + notice.message + '</span></div><button style="background:transparent; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:0 6px; line-height:1;" onclick="this.parentElement.remove()">✕</button>';
        
        var topBar = document.body.firstElementChild;
        if (topBar) {
          document.body.insertBefore(nBanner, topBar);
        } else {
          document.body.appendChild(nBanner);
        }

        setTimeout(function () {
          if (nBanner && nBanner.parentNode) {
            nBanner.style.opacity = '0';
            setTimeout(function () { if (nBanner.parentNode) nBanner.remove(); }, 400);
          }
        }, 12000);
      }
    });
  }

  function checkLicense(callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      callback(false);
      return;
    }
    chrome.storage.local.get(['ewu_system_shutdown', 'ewu_system_update'], function (res) {
      var shutdown = res.ewu_system_shutdown || { enabled: false };
      var update = res.ewu_system_update || { isMandatory: false, minVersion: '1.1.0' };
      var manifestVer = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '1.1.0';

      renderSystemBanners();

      // PRIORITY 1: Shutdown
      if (shutdown.enabled) {
        log('System Shutdown active. Enhancement halted.');
        callback(false);
        return;
      }

      // PRIORITY 2: Mandatory Update
      if (update.isMandatory && isVersionOutdated(manifestVer, update.minVersion)) {
        log('Mandatory update required. Enhancement halted.');
        callback(false);
        return;
      }

      // PRIORITY 3: License check
      chrome.runtime.sendMessage({ type: 'GET_LICENSE_STATUS' }, function (res) {
        if (chrome.runtime.lastError || !res || !res.authorized) {
          showUnactivatedPrompt();
          callback(false);
        } else {
          callback(true);
        }
      });
    });
  }

  function showUnactivatedPrompt() {
    var existingPrompt = document.getElementById('ewu-unactivated-prompt');
    if (existingPrompt) return;

    var prompt = document.createElement('div');
    prompt.id = 'ewu-unactivated-prompt';
    prompt.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:999999; background:rgba(13,19,33,0.95); border:1px solid rgba(99,102,241,0.45); border-radius:14px; padding:14px 18px; box-shadow:0 12px 35px rgba(0,0,0,0.7), 0 0 20px rgba(99,102,241,0.25); color:#ffffff; font-family:-apple-system,BlinkMacSystemFont,sans-serif; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); display:flex; align-items:center; gap:12px; font-size:13px; max-width:360px;';
    prompt.innerHTML = '<div style="width:34px; height:34px; border-radius:10px; background:rgba(99,102,241,0.2); border:1px solid rgba(99,102,241,0.4); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#818cf8;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><div><strong style="display:block; font-size:13px; margin-bottom:2px;">Activate EWU Portal Helper</strong><span style="font-size:11.5px; color:#cbd5e1;">Enter your license key to unlock automated captcha &amp; advising tools.</span></div><button id="btnPromptActivate" style="padding:7px 12px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; margin-left:4px;">Activate &rarr;</button><button style="background:transparent; border:none; color:#94a3b8; font-size:14px; cursor:pointer; padding:0 2px;" onclick="this.closest(\'#ewu-unactivated-prompt\').remove()">✕</button>';
    
    document.body.appendChild(prompt);

    var btnAct = document.getElementById('btnPromptActivate');
    if (btnAct) {
      btnAct.addEventListener('click', function () {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'OPEN_ACTIVATION_PAGE' });
        }
      });
    }
  }


  /* ===========================================================
     UTILITY HELPERS
     =========================================================== */

  function safeQuery(sel) {
    try { return document.querySelector(sel) || null; }
    catch (_) { return null; }
  }

  function safeQueryAll(sel) {
    try { return document.querySelectorAll(sel) || []; }
    catch (_) { return []; }
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(CONFIG.LOG_PREFIX);
    console.log.apply(console, args);
  }

  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(CONFIG.LOG_PREFIX);
    console.warn.apply(console, args);
  }

  function routineLog() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(CONFIG.ROUTINE_LOG);
    console.log.apply(console, args);
  }

  var _debugEnabled = false;
  function debugLog() {
    if (_debugEnabled) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(CONFIG.LOG_PREFIX, '[DEBUG]');
      console.log.apply(console, args);
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }


  /* ===========================================================
     TOAST NOTIFICATION SYSTEM
     =========================================================== */

  var Toast = {
    _container: null,
    _lastMessages: {},

    _ensureContainer: function () {
      if (this._container) return;
      var el = document.createElement('div');
      el.id = 'ewu-toast-container';
      document.body.appendChild(el);
      this._container = el;
    },

    show: function (message, type, duration) {
      type = type || 'info';
      duration = duration || 3000;
      if (!_settings || !_settings.toastNotifications) return;

      var now = Date.now();
      var lastTime = this._lastMessages[message];
      if (lastTime && (now - lastTime) < 4000) return;
      this._lastMessages[message] = now;

      var keys = Object.keys(this._lastMessages);
      for (var k = 0; k < keys.length; k++) {
        if (now - this._lastMessages[keys[k]] > 10000) delete this._lastMessages[keys[k]];
      }

      this._ensureContainer();

      var toast = document.createElement('div');
      toast.className = 'ewu-toast-item ewu-toast-' + type;
      var icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        error:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info:    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      };
      toast.innerHTML =
        '<span class="ewu-toast-icon">' + (icons[type] || icons.info) + '</span>' +
        '<span class="ewu-toast-text">' + escapeHTML(message) + '</span>';

      this._container.appendChild(toast);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { toast.classList.add('ewu-toast-visible'); });
      });
      setTimeout(function () {
        toast.classList.remove('ewu-toast-visible');
        toast.classList.add('ewu-toast-exit');
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
      }, duration);
    },
  };


  /* ===========================================================
     SETTINGS MANAGEMENT
     =========================================================== */

  var _settings = null;

  function loadSettings() {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        var stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        var parsed = stored ? JSON.parse(stored) : {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), parsed));
        return;
      }
      chrome.storage.local.get(CONFIG.STORAGE_KEY, function (result) {
        var stored = result[CONFIG.STORAGE_KEY] || {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
        resolve();
        return;
      }
      chrome.storage.local.set({ ewu_portal_helper_settings: settings }, resolve);
    });
  }

  function deepMerge(target, source) {
    for (var key in source) {
      if (!source.hasOwnProperty(key)) continue;
      if (
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === 'object'
      ) {
        Object.assign(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }


  /* ===========================================================
     ANIMATION / THEME CLASS MANAGEMENT
     =========================================================== */

  function applyBodyClasses(settings) {
    document.body.classList.toggle('ewu-no-animations', !settings.animations);
  }


  /* ===========================================================
     PAGE HOOK INJECTION (for Offered Courses page)
     Injects pageHook.js into page context to intercept API calls.
     =========================================================== */

  function injectPageHook() {
    if (safeQuery('#ewu-page-hook-loaded')) return;
    var marker = document.createElement('meta');
    marker.id = 'ewu-page-hook-loaded';
    marker.setAttribute('content', '1');
    document.head.appendChild(marker);

    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/pageHook.js');
    script.onload = function () { script.remove(); };
    script.onerror = function () { routineLog('content/pageHook.js failed to load'); script.remove(); };
    (document.head || document.documentElement).appendChild(script);
    routineLog('content/pageHook.js injected');
  }


  /* ===========================================================
     LOGIN HELPER MODULE
     =========================================================== */

  var LoginHelperModule = {
    _hasRun: false,

    init: async function (settings) {
      if (this._hasRun) return;
      var mods = settings.modules || {};
      _debugEnabled = !!mods.loginHelperDebug;
      debugLog('Login Helper: checking...');

      if (!safeQuery('#loginform') && !safeQuery('#lblcaptchaAnswer') && !safeQuery('#username')) {
        debugLog('Not a login page');
        return;
      }

      var fi = safeQuery('input[name="FirstNo"]'), si = safeQuery('input[name="SecondNo"]');
      var firstRaw, secondRaw;
      if (fi && si) {
        firstRaw = fi.getAttribute('value');
        secondRaw = si.getAttribute('value');
      } else {
        var fl = safeQuery('#lblFirstNo'), sl = safeQuery('#lblSecondNo');
        if (!fl || !sl) { debugLog('Sum not found'); Toast.show('Sum question not found', 'error'); return; }
        firstRaw = fl.textContent.trim();
        secondRaw = sl.textContent.trim();
      }

      var a = parseInt(firstRaw, 10), b = parseInt(secondRaw, 10);
      if (isNaN(a) || isNaN(b)) { debugLog('Parse error'); Toast.show('Could not parse sum', 'error'); return; }
      var sum = a + b;

      var el = safeQuery('#lblcaptchaAnswer') || safeQuery('input[name="Answer"]');
      if (!el) { debugLog('Answer field missing'); Toast.show('Answer field not found', 'error'); return; }

      this._hasRun = true;

      if (mods.loginHelperAutoFill !== false) {
        var delay = typeof mods.loginHelperDelay === 'number' ? Math.max(0, mods.loginHelperDelay) : 300;
        setTimeout(function () {
          try {
            el.value = sum;
            var evts = ['focus', 'input', 'change', 'keyup', 'blur'];
            for (var i = 0; i < evts.length; i++) {
              el.dispatchEvent(new Event(evts[i], { bubbles: true, cancelable: evts[i] !== 'blur' && evts[i] !== 'focus' }));
            }
            el.classList.add('ewu-lh-filled');
            setTimeout(function () { el.classList.remove('ewu-lh-filled'); }, 1500);
            debugLog('Sum filled:', sum);
            Toast.show('Sum filled: ' + sum, 'success');
          } catch (_) {
            debugLog('Fill failed');
            Toast.show('Failed to fill sum', 'error');
          }
        }, delay);
      } else {
        debugLog('Sum (manual):', sum);
        Toast.show('Captcha answer: ' + sum, 'info');
      }
    },

    reset: function () { this._hasRun = false; },
  };


  /* ===========================================================
     ROUTINE GENERATOR MODULE
     =========================================================== */

  var RoutineGeneratorModule = {
    DAY_ORDER: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    DAY_MAP: { A: 'Saturday', S: 'Sunday', M: 'Monday', T: 'Tuesday', W: 'Wednesday', R: 'Thursday', F: 'Friday' },
    LOGO_URL: 'https://portal.ewubd.edu/Assets/img/logonn.png',
    API_KW: 'GetSemesterStudentWiseAdvisingCourseListStudent',

    _apiData: null, _tableReady: false, _hooksInstalled: false,
    _observer: null, _modalOpen: false, _currentOpts: null, _btnInjected: false,

    init: async function (settings) {
      var mods = settings.modules || {};
      _debugEnabled = _debugEnabled || !!mods.loginHelperDebug;
      if (location.pathname.toLowerCase().indexOf('/home/classschedule') === -1 &&
          !safeQuery('[ng-controller="ClassScheduleController"]')) return;

      routineLog('Class schedule page detected');
      routineLog('Routine Generator activating');
      this._hookAPI();
      this._listenMessages();
      this._watchTable();
      if (this._apiData || this._tableReady) {
        this._injectButton();
        this._updateBtn(true);
      }
    },

    _hookAPI: function () {
      if (this._hooksInstalled) return;
      this._hooksInstalled = true;
      var self = this;

      if (window.fetch) {
        var orig = window.fetch;
        window.fetch = async function () {
          var res = await orig.apply(this, arguments);
          var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
          if (url.indexOf(self.API_KW) !== -1) {
            try {
              var d = await res.clone().json();
              self._apiData = d;
              routineLog('Schedule API captured via fetch');
              self._tableReady = true;
              self._injectButton();
              self._updateBtn(true);
            } catch (e) {}
          }
          return res;
        };
      }

      var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, url) { this._ewu_url = url; return origOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        if (this._ewu_url && this._ewu_url.indexOf(self.API_KW) !== -1) {
          var xhr = this;
          this.addEventListener('load', function () {
            try {
              self._apiData = JSON.parse(xhr.responseText);
              routineLog('Schedule API captured via XHR');
              self._tableReady = true;
              self._injectButton();
              self._updateBtn(true);
            } catch (e) {}
          });
        }
        return origSend.apply(this, arguments);
      };
    },

    _listenMessages: function () {
      var self = this;
      window.addEventListener('message', function (e) {
        if (e && e.data && e.data.type === 'EWU_CS_API_DATA' && e.data.data) {
          self._apiData = e.data.data;
          routineLog('[Routine] Schedule API received via window postMessage');
          self._tableReady = true;
          self._injectButton();
          self._updateBtn(true);
        }
      });
    },

    _watchTable: function () {
      var container = safeQuery('[ng-show="SemesterAdvData.length"]');
      if (!container) {
        routineLog('Schedule table container not found yet');
        return;
      }
      routineLog('Schedule table container found, observing...');
      var self = this;
      this._observer = new MutationObserver(function () {
        if (!self._tableReady && container.querySelectorAll('table tr').length > 2) {
          self._tableReady = true;
          routineLog('Schedule table detected with ' + container.querySelectorAll('table tr').length + ' rows');
          self._injectButton();
          self._updateBtn(true);
        }
      });
      this._observer.observe(container, { childList: true, subtree: true });
      if (container.querySelectorAll('table tr').length > 2) {
        this._tableReady = true;
        routineLog('Schedule table already visible with ' + container.querySelectorAll('table tr').length + ' rows');
        this._injectButton();
        this._updateBtn(true);
      }
    },

    _injectButton: function () {
      if (safeQuery('#ewu-rg-btn-generate')) return;
      var scheduleDiv = safeQuery('[ng-show="SemesterAdvData.length"]');
      if (!scheduleDiv || !this._tableReady) return;
      if (this._btnInjected) return;
      this._btnInjected = true;
      routineLog('Generate Routine button injected');

      var wrapper = document.createElement('div');
      wrapper.id = 'ewu-rg-btn-wrapper';

      var btn = document.createElement('button');
      btn.id = 'ewu-rg-btn-generate';
      btn.type = 'button';
      btn.className = 'ewu-rg-inject-btn';
      btn.disabled = true;
      btn.textContent = 'Generate Routine';
      wrapper.appendChild(btn);

      var printBtn = safeQuery('button[ng-click="PaySlipPrintBySemesterAndStudentId()"]');
      if (printBtn && printBtn.parentNode) {
        var flexRow = document.createElement('div');
        flexRow.id = 'ewu-rg-btn-row';
        flexRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;';
        printBtn.parentNode.insertBefore(flexRow, printBtn);
        flexRow.appendChild(printBtn);
        flexRow.appendChild(wrapper);
      } else {
        var tableContainer = safeQuery('.table-responsive');
        if (tableContainer && tableContainer.parentNode) {
          tableContainer.parentNode.insertBefore(wrapper, tableContainer);
        } else {
          scheduleDiv.appendChild(wrapper);
        }
      }

      var self = this;
      btn.addEventListener('click', function () { self._onGenerate(); });
    },

    _updateBtn: function (on) {
      var btn = safeQuery('#ewu-rg-btn-generate');
      if (!btn) return;
      btn.disabled = !on;
      btn.classList.toggle('ewu-rg-btn-ready', on);
    },

    _trimRoomName: function (room) {
      if (!room) return '';
      // Removes bracket description, e.g. "638 (Artificial Intelligence Lab)" -> "638"
      // Leaves AB2-601, AB2-502, and other clean codes unchanged
      return String(room).replace(/\s*\([^)]*\)/g, '').trim();
    },

    _extractCourses: function () {
      var self = this;
      var rawItems = this._apiData || (typeof ScheduleEnhancerModule !== 'undefined' && ScheduleEnhancerModule._apiData) || null;
      if (rawItems) {
        var items = rawItems;
        if (Array.isArray(items) && items.length > 0 && Array.isArray(items[0])) items = items[0];
        if (Array.isArray(items)) {
          rawItems = items;
        }
      }

      if (!rawItems || !rawItems.length) {
        var rows = safeQueryAll('table.table-striped tr, [ng-show="SemesterAdvData.length"] table tr, .table-responsive table tr');
        if (rows.length >= 2) {
          var domMergeMap = {};
          var domMergeOrder = [];
          for (var j = 1; j < rows.length; j++) {
            var cells = rows[j].querySelectorAll('td');
            if (cells.length >= 6) {
              var code = (cells[1] || {}).textContent;
              var sec  = ((cells[2] || {}).textContent || '').trim();
              if (code && code.trim()) {
                var cc2 = code.trim();
                var key2 = cc2 + '|' + sec;
                if (!domMergeMap[key2]) {
                  domMergeMap[key2] = { courseCode: cc2, sectionName: sec, slots: [] };
                  domMergeOrder.push(key2);
                }
                var tsName2 = ((cells[4] || {}).textContent || '').trim();
                var rmName2 = self._trimRoomName(((cells[5] || {}).textContent || '').trim());
                if (tsName2) domMergeMap[key2].slots.push({ timeSlotName: tsName2, roomName: rmName2 });
              }
            }
          }
          var domCourses = [];
          for (var di3 = 0; di3 < domMergeOrder.length; di3++) domCourses.push(domMergeMap[domMergeOrder[di3]]);
          if (domCourses.length > 0) {
            routineLog('[Routine] DOM fallback (grouped): ' + domCourses.length + ' unique courses from ' + (rows.length - 1) + ' rows');
            return domCourses;
          }
        }
        return [];
      }

      var mergeMap = {};
      var mergeOrder = [];
      routineLog('[Routine] Raw API items: ' + rawItems.length);

      for (var i = 0; i < rawItems.length; i++) {
        var c = rawItems[i];
        if (!c || !c.CourseCode || !String(c.CourseCode).trim()) continue;
        var cc = String(c.CourseCode).trim();
        var sec = c.SectionName;
        var key = cc + '|' + sec;
        var slotName = (c.TimeSlotName || '').trim();
        var roomName = self._trimRoomName((c.RoomName || '').trim());

        if (!mergeMap[key]) {
          mergeMap[key] = {
            courseCode: cc,
            sectionName: sec,
            shortName: (c.ShortName || '').trim(),
            slots: []
          };
          mergeOrder.push(key);
          routineLog('[Routine] New course key:', key);
        }
        if (slotName) {
          mergeMap[key].slots.push({ timeSlotName: slotName, roomName: roomName });
          routineLog('[Routine]   Slot added to', key, ':', slotName, '@ Room:', roomName);
        }
      }

      var merged = [];
      for (var ki = 0; ki < mergeOrder.length; ki++) {
        merged.push(mergeMap[mergeOrder[ki]]);
      }
      routineLog('[Routine] Merged unique courses: ' + merged.length + ' (from ' + rawItems.length + ' raw items)');
      return merged;
    },

    _parseSlot: function (ts) {
      if (!ts) return null;
      var raw = String(ts).trim();
      if (!raw || raw.toUpperCase() === 'TBA') return null;

      // Extract time range: "8:30AM-10:00AM", "11:50 AM - 01:20 PM", "(11:50AM-1:20PM)", "8:30AM - 10:00AM"
      var timeMatch = raw.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*(?:-|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (!timeMatch) {
        routineLog('[Routine] _parseSlot: no time range match in:', raw);
        return null;
      }

      var startStr = timeMatch[1].trim();
      var endStr   = timeMatch[2].trim();

      // Extract day portion by removing the time string and noise characters
      var dayPart = raw.replace(timeMatch[0], '').replace(/[()•]/g, '').trim();

      var days = [];
      var dayNameMap = {
        'SUN': 'Sunday', 'SUNDAY': 'Sunday', 'S': 'Sunday',
        'MON': 'Monday', 'MONDAY': 'Monday', 'M': 'Monday',
        'TUE': 'Tuesday', 'TUESDAY': 'Tuesday', 'T': 'Tuesday',
        'WED': 'Wednesday', 'WEDNESDAY': 'Wednesday', 'W': 'Wednesday',
        'THU': 'Thursday', 'THURSDAY': 'Thursday', 'R': 'Thursday',
        'FRI': 'Friday', 'FRIDAY': 'Friday', 'F': 'Friday',
        'SAT': 'Saturday', 'SATURDAY': 'Saturday', 'A': 'Saturday'
      };

      // Check if dayPart contains word tokens (e.g. "Mon, Wed" or "Sun,Tue" or "Thursday")
      var tokens = dayPart.split(/[\s,+/]+/).filter(Boolean);
      for (var ti = 0; ti < tokens.length; ti++) {
        var tok = tokens[ti].toUpperCase();
        if (dayNameMap[tok]) {
          if (days.indexOf(dayNameMap[tok]) === -1) days.push(dayNameMap[tok]);
        } else {
          // If token is sequence of characters like "MW", "ST", "SR", "TR", "RA"
          for (var cIdx = 0; cIdx < tok.length; cIdx++) {
            var ch = tok[cIdx];
            if (dayNameMap[ch] && days.indexOf(dayNameMap[ch]) === -1) {
              days.push(dayNameMap[ch]);
            }
          }
        }
      }

      if (!days.length) {
        routineLog('[Routine] _parseSlot: no valid days found in:', raw);
        return null;
      }

      function toMin(t) {
        var clean = t.replace(/\s+/g, '');
        var p = clean.match(/(\d+):(\d+)(AM|PM)/i);
        if (!p) return 0;
        var h = parseInt(p[1], 10);
        if (p[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (p[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + parseInt(p[2], 10);
      }

      function prettyTime(t) {
        var clean = t.replace(/\s+/g, '');
        var p = clean.match(/(\d+:\d+)(AM|PM)/i);
        return p ? (p[1] + ' ' + p[2].toUpperCase()) : t.toUpperCase();
      }

      var parsedResult = {
        days: days,
        startTime: prettyTime(startStr),
        endTime: prettyTime(endStr),
        sortTime: toMin(startStr)
      };

      routineLog('[Routine] _parseSlot parsed:', raw, '-> days:', days.join(','), parsedResult.startTime, '-', parsedResult.endTime);
      return parsedResult;
    },

    _getSemesterName: function () {
      var sel = safeQuery('select[data-ng-model="selectedSemesterId"]');
      if (sel && sel.selectedIndex > 0 && sel.options[sel.selectedIndex]) {
        var t = sel.options[sel.selectedIndex].text.trim();
        if (t && t !== 'Select Semester') return t;
      }
      return '';
    },

    _onGenerate: async function () {
      this._updateBtn(false);
      routineLog('Generate Routine clicked');
      var courses = this._extractCourses();
      if (!courses.length) {
        Toast.show('No course data found', 'error');
        this._updateBtn(this._tableReady || !!this._apiData);
        return;
      }

      routineLog('Extracted ' + courses.length + ' courses');
      var semName = this._getSemesterName();
      var mods = await loadSettings().then(function (s) { return s.modules || {}; });
      this._currentOpts = {
        compact: !!mods.routineCompact,
        showLogo: mods.routineShowLogo !== false,
        blueIntensity: mods.routineBlueIntensity || 'medium',
        exportQuality: mods.routineExportQuality || 'standard'
      };

      var html = this._buildRoutine(courses, semName, this._currentOpts);
      this._renderModal(html);
      this._updateBtn(true);
    },

    _buildRoutine: function (courses, semesterName, opts) {
      if (!courses || !courses.length) return '<div class="ewu-rt-empty">No courses found.</div>';
      var compact = !!opts.compact, showLogo = opts.showLogo !== false, intensity = opts.blueIntensity || 'medium';
      // pad: vertical cell padding in px. Larger = taller rows = taller export image.
      // At 16px: each data row ~80-90px high × 5 rows × 2x scale ≈ 800-900px row area alone.
      var pad = compact ? 6 : 16, fs = compact ? '11px' : '13px';
      // Horizontal padding kept moderate so column widths don't bloat
      var hpad = compact ? 8 : 12;
      var self = this;

      // Calculate sorting weights and detect Saturday/Friday classes
      var hasSaturday = false;
      var hasFriday = false;

      courses.forEach(function (course) {
        var minSortTime = Infinity;
        var minDayIndex = Infinity;

        var courseSlots = course.slots || [];
        if (!courseSlots.length && course.timeSlotName) {
          courseSlots = [{ timeSlotName: course.timeSlotName, roomName: course.roomName || '' }];
        }

        courseSlots.forEach(function (slot) {
          var parsed = self._parseSlot(slot.timeSlotName);
          if (parsed) {
            if (parsed.sortTime < minSortTime) {
              minSortTime = parsed.sortTime;
            }
            parsed.days.forEach(function (day) {
              if (day === 'Saturday') hasSaturday = true;
              if (day === 'Friday') hasFriday = true;

              var fullWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
              var idx = fullWeek.indexOf(day);
              if (idx !== -1 && idx < minDayIndex) {
                minDayIndex = idx;
              }
            });
          }
        });

        course._minSortTime = minSortTime === Infinity ? 9999 : minSortTime;
        course._minDayIndex = minDayIndex === Infinity ? 9999 : minDayIndex;
      });

      // Construct dynamic daysToShow
      var daysToShow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
      if (hasSaturday) {
        daysToShow.unshift('Saturday');
      }
      if (hasFriday) {
        daysToShow.push('Friday');
      }

      // Sort chronologically by earliest daily start time, then day index, then alphabetically
      var sortedRaw = courses.slice().sort(function (a, b) {
        if (a._minSortTime !== b._minSortTime) {
          return a._minSortTime - b._minSortTime;
        }
        if (a._minDayIndex !== b._minDayIndex) {
          return a._minDayIndex - b._minDayIndex;
        }
        var c = a.courseCode.localeCompare(b.courseCode);
        return c !== 0 ? c : (a.sectionName || 0) - (b.sectionName || 0);
      });

      var _seenKeys = {};
      var sorted = [];
      for (var ddi = 0; ddi < sortedRaw.length; ddi++) {
        var _dk = sortedRaw[ddi].courseCode + '|' + String(sortedRaw[ddi].sectionName);
        if (!_seenKeys[_dk]) { _seenKeys[_dk] = true; sorted.push(sortedRaw[ddi]); }
      }
      routineLog('[Routine] Building routine for', sorted.length, 'unique columns (deduplicated from', sortedRaw.length, 'items)');

      // Build day map: for each day, which course+section entries appear
      // Each entry stores all matching slots for that (course, section, day) pair
      // Key structure: dayMap[day] = Array of { courseCode, sectionName, slots:[] }
      var dayMap = {};
      daysToShow.forEach(function (d) { dayMap[d] = []; });

      for (var ci = 0; ci < sorted.length; ci++) {
        var course = sorted[ci];
        var courseSlots = course.slots || [];
        if (!courseSlots.length && course.timeSlotName) {
          // Legacy single-slot fallback
          courseSlots = [{ timeSlotName: course.timeSlotName, roomName: course.roomName || '' }];
        }

        for (var si2 = 0; si2 < courseSlots.length; si2++) {
          var slot = courseSlots[si2];
          var parsed = self._parseSlot(slot.timeSlotName);
          if (!parsed) continue;

          for (var di = 0; di < parsed.days.length; di++) {
            var day = parsed.days[di];
            if (!dayMap[day]) continue; // day not in daysToShow (e.g. Saturday/Friday if not in schedule)

            // Find or create entry for this course on this day
            var existing = null;
            for (var ei2 = 0; ei2 < dayMap[day].length; ei2++) {
              if (dayMap[day][ei2].courseCode === course.courseCode &&
                  String(dayMap[day][ei2].sectionName) === String(course.sectionName)) {
                existing = dayMap[day][ei2]; break;
              }
            }
            if (!existing) {
              existing = { courseCode: course.courseCode, sectionName: course.sectionName, slots: [] };
              dayMap[day].push(existing);
            }
            existing.slots.push({
              startTime: parsed.startTime,
              endTime:   parsed.endTime,
              roomName:  slot.roomName || '',
              sortTime:  parsed.sortTime
            });
            routineLog('[Routine] Mapped', course.courseCode, 'Sec', course.sectionName, '->', day, parsed.startTime + '-' + parsed.endTime, 'Room:', slot.roomName);
          }
        }
      }

      // Sort slots within each day entry by start time
      daysToShow.forEach(function (d) {
        dayMap[d].forEach(function (entry) {
          entry.slots.sort(function (a, b) { return a.sortTime - b.sortTime; });
        });
      });

      var themes = {
        light: { hb: '#D6E4F0', hf: '#1A365D', db: '#EDF2F7', bd: '#B0C4DE' },
        medium: { hb: '#1A73E8', hf: '#FFF', db: '#E8F0FE', bd: '#4285F4' },
        strong: { hb: '#0D47A1', hf: '#FFF', db: '#E3F2FD', bd: '#1565C0' }
      };
      var th = themes[intensity] || themes.medium, bdr = th.bd;

      var h = '<div class="ewu-rt-container" style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">';
      h += '<div style="text-align:center;margin-bottom:16px;padding-top:6px;">';
      if (showLogo) h += '<img src="' + this.LOGO_URL + '" crossorigin="anonymous" style="max-height:58px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;" onerror="this.style.display=\'none\'" />';
      h += '<h2 style="margin:0 0 3px;font-size:16px;font-weight:700;color:#222;letter-spacing:0.5px;">CLASS ROUTINE</h2>';
      if (semesterName) h += '<p style="margin:0;font-size:13px;color:#555;font-weight:500;">' + escapeHTML(semesterName) + '</p>';
      h += '</div>';

      // Day column: fixed, narrow; course columns: auto-width from content.
      // font-size on table sets baseline; cells override with fs for content.
      h += '<table class="ewu-rt-table" style="width:100%;border-collapse:collapse;font-size:' + (compact ? '11px' : '13px') + ';border:2px solid ' + bdr + ';">';
      h += '<thead><tr>';
      h += '<th style="background:' + th.hb + ';color:' + th.hf + ';padding:' + pad + 'px ' + hpad + 'px;border:1px solid ' + bdr + ';font-weight:700;text-align:center;min-width:82px;width:82px;white-space:nowrap;">Day</th>';
      for (var si = 0; si < sorted.length; si++) {
        // min-width per course column: enough to show code + section on two lines comfortably
        h += '<th style="background:' + th.hb + ';color:' + th.hf + ';padding:' + pad + 'px ' + hpad + 'px;border:1px solid ' + bdr + ';font-weight:700;text-align:center;min-width:110px;white-space:nowrap;">';
        h += escapeHTML(sorted[si].courseCode);
        if (sorted[si].sectionName !== undefined && sorted[si].sectionName !== null) {
          h += '<br><span style="font-size:0.82em;opacity:0.88;font-weight:600;">Sec ' + escapeHTML(String(sorted[si].sectionName)) + '</span>';
        }
        h += '</th>';
      }
      h += '</tr></thead><tbody>';

      // Table rows: one per day
      for (var di2 = 0; di2 < daysToShow.length; di2++) {
        var day = daysToShow[di2];
        h += '<tr>';
        // Day label cell: fixed narrow column
        h += '<td style="background:' + th.db + ';padding:' + pad + 'px ' + hpad + 'px;border:1px solid ' + bdr + ';font-weight:700;text-align:center;white-space:nowrap;font-size:' + (compact ? '11px' : '13px') + ';">' + day + '</td>';

        for (var sci = 0; sci < sorted.length; sci++) {
          // Find this course's entry for this day
          var dayEntry = null;
          for (var dei = 0; dei < dayMap[day].length; dei++) {
            if (dayMap[day][dei].courseCode === sorted[sci].courseCode &&
                String(dayMap[day][dei].sectionName) === String(sorted[sci].sectionName)) {
              dayEntry = dayMap[day][dei]; break;
            }
          }

          if (dayEntry && dayEntry.slots.length) {
            h += '<td style="background:#FFF;padding:' + pad + 'px ' + hpad + 'px;border:1px solid ' + bdr + ';text-align:center;vertical-align:middle;">';
            for (var sli = 0; sli < dayEntry.slots.length; sli++) {
              var sl = dayEntry.slots[sli];
              if (sli > 0) h += '<hr style="margin:5px 0;border:none;border-top:1px solid #E2E8F0;">';
              h += '<div style="font-size:' + fs + ';color:#1A73E8;font-weight:700;white-space:nowrap;line-height:1.5;">' + sl.startTime + ' – ' + sl.endTime + '</div>';
              if (sl.roomName) h += '<div style="font-size:' + fs + ';color:#444;margin-top:2px;line-height:1.4;">' + escapeHTML(sl.roomName) + '</div>';
            }
            h += '</td>';
          } else {
            h += '<td style="background:#FAFAFA;padding:' + pad + 'px ' + hpad + 'px;border:1px solid ' + bdr + ';"></td>';
          }
        }
        h += '</tr>';
      }
      h += '</tbody></table>';
      h += '</div>';
      return h;
    },

    _renderModal: function (html) {
      var old = safeQuery('#ewu-rg-modal'); if (old) old.remove();
      routineLog('Routine modal opened');

      var modal = document.createElement('div');
      modal.id = 'ewu-rg-modal';
      modal.className = 'ewu-rg-modal';
      modal.innerHTML =
        '<div class="ewu-rg-overlay"></div>' +
        '<div class="ewu-rg-content">' +
          '<div class="ewu-rg-toolbar">' +
            '<div class="ewu-rg-toolbar-title">Class Routine Preview</div>' +
            '<div class="ewu-rg-toolbar-actions">' +
              '<button class="ewu-rg-btn ewu-rg-btn-pdf" id="ewu-rg-pdf-btn" title="Save as PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF</button>' +
              '<button class="ewu-rg-btn ewu-rg-btn-img" id="ewu-rg-img-btn" title="Save as Image"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</button>' +
              '<button class="ewu-rg-btn ewu-rg-btn-close" id="ewu-rg-close-btn" title="Close">&times;</button>' +
            '</div>' +
          '</div>' +
          '<div class="ewu-rg-body" id="ewu-rg-preview">' + html + '</div>' +
        '</div>' +
        '<div class="ewu-rg-loading" id="ewu-rg-loading" style="display:none;"><div class="ewu-rg-spinner"></div><span>Exporting...</span></div>';

      document.body.appendChild(modal);
      this._modalOpen = true;
      var self = this;
      modal.querySelector('#ewu-rg-close-btn').addEventListener('click', function () { self._closeModal(); });
      modal.querySelector('.ewu-rg-overlay').addEventListener('click', function () { self._closeModal(); });
      modal.querySelector('#ewu-rg-pdf-btn').addEventListener('click', function () { self._exportPDF(); });
      modal.querySelector('#ewu-rg-img-btn').addEventListener('click', function () { self._exportImage(); });
      this._escHandler = function (e) { if (e.key === 'Escape' && self._modalOpen) self._closeModal(); };
      document.addEventListener('keydown', this._escHandler);
      requestAnimationFrame(function () { modal.classList.add('ewu-rg-modal-open'); });
      Toast.show('Routine generated', 'success');
    },

    _closeModal: function () {
      var m = safeQuery('#ewu-rg-modal'); if (!m) return;
      m.classList.remove('ewu-rg-modal-open');
      var self = this;
      setTimeout(function () { if (m.parentNode) m.remove(); self._modalOpen = false; }, 300);
      if (this._escHandler) { document.removeEventListener('keydown', this._escHandler); this._escHandler = null; }
    },

    /**
     * _loadLibs – ensure html2canvas and jsPDF are available.
     * Libraries are pre-loaded via manifest.json content_scripts, so they
     * should already be in the content-script isolated world.
     * As a last resort, attempt dynamic fetch + blob-URL injection.
     */
    _loadLibs: async function () {
      // Fast path – libraries already available from manifest pre-load
      if (typeof html2canvas === 'function' && window.jspdf && typeof window.jspdf.jsPDF === 'function') {
        routineLog('Export libraries ready (pre-loaded)');
        return true;
      }
      // Retry with window-prefixed checks (some bundles attach differently)
      if (typeof window.html2canvas === 'function' && window.jspdf && typeof window.jspdf.jsPDF === 'function') {
        routineLog('Export libraries ready (via window)');
        return true;
      }

      // Fallback: dynamic fetch + eval in content-script context
      routineLog('Libraries not pre-loaded, attempting dynamic fetch...');
      try {
        var base = chrome.runtime.getURL('lib/');
        var h2cURL = base + 'html2canvas.min.js';
        var jspdfURL = base + 'jspdf.umd.min.js';

        var h2cResp = await fetch(h2cURL);
        var h2cText = await h2cResp.text();
        window._ewuH2C = h2cText;
        var h2cBlob = new Blob([h2cText], { type: 'text/javascript' });
        var h2cBlobURL = URL.createObjectURL(h2cBlob);

        await new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = h2cBlobURL;
          s.onload = resolve;
          s.onerror = reject;
          (document.head || document.documentElement).appendChild(s);
        });
        URL.revokeObjectURL(h2cBlobURL);
        window._ewuH2C = null;

        var jsResp = await fetch(jspdfURL);
        var jsText = await jsResp.text();
        var jsBlob = new Blob([jsText], { type: 'text/javascript' });
        var jsBlobURL = URL.createObjectURL(jsBlob);

        await new Promise(function (resolve, reject) {
          var s2 = document.createElement('script');
          s2.src = jsBlobURL;
          s2.onload = resolve;
          s2.onerror = reject;
          (document.head || document.documentElement).appendChild(s2);
        });
        URL.revokeObjectURL(jsBlobURL);

        // Validate after dynamic load
        if (typeof html2canvas === 'function' || typeof window.html2canvas === 'function') {
          routineLog('Dynamic load: html2canvas OK');
        } else {
          routineLog('Dynamic load: html2canvas still not a function');
          return false;
        }
        if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
          routineLog('Dynamic load: jsPDF OK');
        } else {
          routineLog('Dynamic load: jsPDF still not available');
          return false;
        }
        routineLog('Export libraries loaded via dynamic fetch');
        return true;
      } catch (e) {
        warn('Dynamic library load failed:', e.message);
        routineLog('Dynamic library load failed:', e.message);
        return false;
      }
    },

    /** Helper: resolve the actual html2canvas function */
    _getHtml2Canvas: function () {
      if (typeof html2canvas === 'function') return html2canvas;
      if (typeof window.html2canvas === 'function') return window.html2canvas;
      return null;
    },

    /** Helper: resolve the jsPDF constructor */
    _getJsPDF: function () {
      if (window.jspdf && typeof window.jspdf.jsPDF === 'function') return window.jspdf.jsPDF;
      return null;
    },

    _exportPDF: async function () {
      routineLog('PDF export started');
      this._showLoad(true);
      try {
        var loaded = await this._loadLibs();
        if (!loaded) {
          var prev = safeQuery('#ewu-rg-preview');
          if (prev) {
            var w = window.open('', '_blank');
            if (w) {
              w.document.write('<html><head><title>EWU Routine</title></head><body>' + prev.innerHTML + '</body></html>');
              w.document.close();
              w.print();
            }
          }
          this._showLoad(false);
          Toast.show('Print dialog opened (libs unavailable)', 'warning');
          routineLog('PDF export: libs unavailable, using print fallback');
          return;
        }

        var prev = safeQuery('#ewu-rg-preview');
        if (!prev) {
          routineLog('PDF export: preview element not found');
          this._showLoad(false);
          Toast.show('Preview not found', 'error');
          return;
        }
        routineLog('Export target element found. Size: ' + prev.scrollWidth + 'x' + prev.scrollHeight);

        // Hide overlay and loading during capture
        var overlay = safeQuery('.ewu-rg-overlay');
        var loading = safeQuery('.ewu-rg-loading');
        if (overlay) overlay.style.visibility = 'hidden';
        if (loading) loading.style.display = 'none';

        var scale = (this._currentOpts && this._currentOpts.exportQuality === 'high') ? 3 : 2;
        routineLog('PDF export: capturing at scale ' + scale + 'x');

        var h2cFn = this._getHtml2Canvas();
        if (!h2cFn) {
          throw new Error('html2canvas is not available');
        }
        var canvas = await h2cFn(prev, {
          scale: scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          scrollX: 0,
          scrollY: -window.scrollY,
          width: prev.scrollWidth,
          height: prev.scrollHeight,
          windowWidth: prev.scrollWidth,
          windowHeight: prev.scrollHeight,
        });

        routineLog('PDF export: canvas captured, size: ' + canvas.width + 'x' + canvas.height);

        // Restore overlay
        if (overlay) overlay.style.visibility = '';
        if (loading) loading.style.display = 'none';

        var JsPDFCtor = this._getJsPDF();
        if (!JsPDFCtor) {
          throw new Error('jsPDF is not available');
        }
        // A4 PDF with proper fit-to-page scaling
        var orient = canvas.width > canvas.height ? 'landscape' : 'portrait';
        var pdf = new JsPDFCtor({ orientation: orient, unit: 'mm', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
        var margin = 10, uw = pw - margin * 2, uh = ph - margin * 2;
        var ratio = Math.min(uw / canvas.width, uh / canvas.height);
        var sw = canvas.width * ratio, sh = canvas.height * ratio;
        var xOff = (pw - sw) / 2, yOff = (ph - sh) / 2;

        routineLog('PDF export: A4 ' + orient + ', placing at ' + sw.toFixed(1) + 'x' + sh.toFixed(1) + 'mm');

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOff, yOff, sw, sh, undefined, 'FAST');
        var semClean = this._getSemesterName();
        if (semClean) {
          semClean = semClean.replace(/[^a-zA-Z0-9]/g, '');
          semClean = semClean.substring(0, 20);
        }
        var pdfName = semClean ? ('Routine_' + semClean + '.pdf') : 'EWU_Class_Routine.pdf';
        pdf.save(pdfName);
        routineLog('PDF export success');
        Toast.show('PDF saved successfully', 'success');
      } catch (e) {
        routineLog('PDF export failed:', e.message || e);
        warn('PDF export failed:', e);
        Toast.show('PDF export failed: ' + (e.message || 'Unknown error'), 'error');
      }
      this._showLoad(false);
    },

    _exportImage: async function () {
      routineLog('Image export started');
      this._showLoad(true);
      try {
        if (!await this._loadLibs()) {
          Toast.show('Export libraries not available', 'error');
          this._showLoad(false);
          return;
        }
        var prev = safeQuery('#ewu-rg-preview');
        if (!prev) {
          routineLog('Image export: preview element not found');
          this._showLoad(false);
          Toast.show('Preview not found', 'error');
          return;
        }
        routineLog('Image export: target element found. Size: ' + prev.scrollWidth + 'x' + prev.scrollHeight);

        var overlay = safeQuery('.ewu-rg-overlay');
        var loading = safeQuery('.ewu-rg-loading');
        if (overlay) overlay.style.visibility = 'hidden';
        if (loading) loading.style.display = 'none';

        var scale = (this._currentOpts && this._currentOpts.exportQuality === 'high') ? 3 : 2;
        routineLog('Image export: capturing at scale ' + scale + 'x');

        var h2cFn = this._getHtml2Canvas();
        if (!h2cFn) {
          throw new Error('html2canvas is not available');
        }
        var canvas = await h2cFn(prev, {
          scale: scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          scrollX: 0,
          scrollY: -window.scrollY,
          width: prev.scrollWidth,
          height: prev.scrollHeight,
          windowWidth: prev.scrollWidth,
          windowHeight: prev.scrollHeight,
        });

        routineLog('Image export: canvas captured, size: ' + canvas.width + 'x' + canvas.height);

        if (overlay) overlay.style.visibility = '';
        if (loading) loading.style.display = 'none';

        var self = this;
        canvas.toBlob(function (blob) {
          if (!blob) {
            routineLog('Image export: blob generation failed');
            Toast.show('Image generation failed', 'error');
            return;
          }
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          var semClean2 = self._getSemesterName();
          if (semClean2) {
            semClean2 = semClean2.replace(/[^a-zA-Z0-9]/g, '');
            semClean2 = semClean2.substring(0, 20);
          }
          a.download = semClean2 ? ('Routine_' + semClean2 + '.png') : 'EWU_Class_Routine.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          routineLog('Image export success');
          Toast.show('Image saved successfully', 'success');
        }, 'image/png');
      } catch (e) {
        routineLog('Image export failed:', e.message || e);
        warn('Image export failed:', e);
        Toast.show('Image export failed: ' + (e.message || 'Unknown error'), 'error');
      }
      this._showLoad(false);
    },

    _showLoad: function (show) {
      var el = safeQuery('#ewu-rg-loading');
      if (el) el.style.display = show ? 'flex' : 'none';
    },

    reset: function () {
      this._apiData = null;
      this._tableReady = false;
      this._hooksInstalled = false;
      this._modalOpen = false;
      this._currentOpts = null;
      this._btnInjected = false;
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      // If we created a flex row, restore the Print Slip button to its original parent first
      var btnRow = safeQuery('#ewu-rg-btn-row');
      if (btnRow) {
        var printBtn2 = btnRow.querySelector('button[ng-click="PaySlipPrintBySemesterAndStudentId()"]');
        if (printBtn2) btnRow.parentNode.insertBefore(printBtn2, btnRow);
        btnRow.remove();
      }
      document.querySelectorAll('#ewu-rg-btn-wrapper, #ewu-rg-btn-wrapper-inline').forEach(function(el) { el.remove(); });
      var m = safeQuery('#ewu-rg-modal');
      if (m) m.remove();
    },
  };


  /* ===========================================================
     SCHEDULE ENHANCER MODULE (Class Schedule Page)
     =========================================================== */

  var ScheduleEnhancerModule = {
    API_KW: 'GetSemesterStudentWiseAdvisingCourseListStudent',
    _apiData: null,
    _observer: null,
    _isEnhancing: false,
    _settings: null,
    _listenerInstalled: false,

    init: function (settings) {
      this._settings = settings;
      if (location.pathname.toLowerCase().indexOf('/home/classschedule') === -1 &&
          !safeQuery('[ng-controller="ClassScheduleController"]')) return;

      log('Schedule Enhancer Module activating');
      this._hookAPI();
      this._listenMessages();
      this._watchTable();
      this._enhanceTable();
    },

    _hookAPI: function () {
      var self = this;
      if (window.fetch) {
        var orig = window.fetch;
        window.fetch = async function () {
          var res = await orig.apply(this, arguments);
          var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
          if (url.indexOf(self.API_KW) !== -1) {
            try {
              var d = await res.clone().json();
              self._apiData = d;
              log('[ScheduleEnhancer] API data captured via fetch hook');
              setTimeout(function () { self._enhanceTable(); }, 120);
            } catch (e) {}
          }
          return res;
        };
      }

      var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, url) {
        this._ewu_cs_url = url;
        return origOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function () {
        if (this._ewu_cs_url && this._ewu_cs_url.indexOf(self.API_KW) !== -1) {
          var xhr = this;
          this.addEventListener('load', function () {
            try {
              self._apiData = JSON.parse(xhr.responseText);
              log('[ScheduleEnhancer] API data captured via XHR hook');
              setTimeout(function () { self._enhanceTable(); }, 120);
            } catch (e) {}
          });
        }
        return origSend.apply(this, arguments);
      };
    },

    _listenMessages: function () {
      if (this._listenerInstalled) return;
      this._listenerInstalled = true;
      var self = this;
      window.addEventListener('message', function (e) {
        if (e && e.data && e.data.type === 'EWU_CS_API_DATA' && e.data.data) {
          self._apiData = e.data.data;
          log('[ScheduleEnhancer] API data received via window message');
          setTimeout(function () { self._enhanceTable(); }, 120);
        }
      });
    },

    _watchTable: function () {
      var self = this;
      var container = safeQuery('[ng-show="SemesterAdvData.length"]') || safeQuery('.table-responsive');
      if (!container) {
        var parentDiv = safeQuery('[ng-controller="ClassScheduleController"]') || document.body;
        this._observer = new MutationObserver(function () {
          var c = safeQuery('[ng-show="SemesterAdvData.length"]');
          if (c) {
            self._enhanceTable();
          }
        });
        this._observer.observe(parentDiv, { childList: true, subtree: true });
        return;
      }

      this._observer = new MutationObserver(function () {
        if (self._isEnhancing) return;
        self._enhanceTable();
      });
      this._observer.observe(container, { childList: true, subtree: true });
    },

    _formatScheduleTiming: function (ts) {
      if (!ts) return '';
      var str = String(ts).trim();
      var m = str.match(/^([A-Za-z]+)\s*(.*)$/);
      if (!m) return str;
      var dayCodes = m[1].toUpperCase();
      var timePart = m[2];
      var dayMap = { 'S': 'Sun', 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'F': 'Fri', 'A': 'Sat' };
      var mappedDays = [];
      for (var i = 0; i < dayCodes.length; i++) {
        if (dayMap[dayCodes[i]]) {
          mappedDays.push(dayMap[dayCodes[i]]);
        } else {
          return str; // If unknown letter, keep original string
        }
      }
      if (mappedDays.length > 0 && timePart) {
        return mappedDays.join(',') + ' ' + timePart;
      }
      return str;
    },

    _enhanceTable: function () {
      var self = this;
      if (this._isEnhancing) return;

      var table = safeQuery('[ng-show="SemesterAdvData.length"] table') || safeQuery('.table-responsive table');
      if (!table) return;

      var rows = table.querySelectorAll('tr');
      if (rows.length < 2) return;

      this._isEnhancing = true;

      try {
        var rawItems = this._getRawData();

        // 1. Ensure Table Header has all 11 columns
        var headerRow = rows[0];
        var ths = headerRow.querySelectorAll('th');

        // Check if last 3 faculty headers are present
        var hasFacHeaders = false;
        for (var h = 0; h < ths.length; h++) {
          var txt = ths[h].textContent.trim();
          if (txt.indexOf('Faculty') !== -1) {
            hasFacHeaders = true;
            ths[h].classList.remove('ng-hide');
            ths[h].style.display = '';
          }
        }

        if (!hasFacHeaders || ths.length < 11) {
          if (ths.length === 8) {
            var thInitial = document.createElement('th');
            thInitial.textContent = 'Faculty Initial';
            headerRow.appendChild(thInitial);

            var thName = document.createElement('th');
            thName.textContent = 'Faculty Name';
            headerRow.appendChild(thName);

            var thEmail = document.createElement('th');
            thEmail.textContent = 'Faculty Email';
            headerRow.appendChild(thEmail);
          }
        }

        // 2. Enhance Data Rows & Calculate Distinct Course & Credit Totals
        var courseCreditMap = {};

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var cells = row.querySelectorAll('td');
          if (cells.length < 8) continue;

          var courseCode = cells[1] ? cells[1].textContent.trim() : '';
          var sectionName = cells[2] ? cells[2].textContent.trim() : '';
          var creditText = cells[3] ? cells[3].textContent.trim() : '';
          var timingText = cells[4] ? cells[4].textContent.trim() : '';

          // Format Timing cell with day mapping (e.g. MW 8:30AM-10:00AM -> Mon,Wed 8:30AM-10:00AM)
          if (timingText) {
            cells[4].textContent = self._formatScheduleTiming(timingText);
          }

          // Smart course & credit grouping:
          // Group theory and lab entries (e.g. "CSE209 Lab" and "CSE209" -> baseCode "CSE209")
          // and multi-day slot duplicates into a single course entity
          if (courseCode) {
            var baseCode = courseCode.replace(/\s*lab\b/gi, '').trim().toUpperCase();
            var groupKey = baseCode + '_' + sectionName;
            var crNum = parseFloat(creditText);
            if (!isNaN(crNum)) {
              courseCreditMap[groupKey] = Math.max(courseCreditMap[groupKey] || 0, crNum);
            } else if (!courseCreditMap[groupKey]) {
              courseCreditMap[groupKey] = 0;
            }
          }

          // Match with API item
          var matchItem = null;
          if (rawItems && rawItems.length) {
            matchItem = rawItems.find(function (item) {
              return String(item.CourseCode).trim() === courseCode && String(item.SectionName).trim() === sectionName;
            });
            if (!matchItem && rawItems[i - 1]) {
              matchItem = rawItems[i - 1];
            }
          }

          var shortName = matchItem ? (matchItem.ShortName || '-') : '-';
          var facName = matchItem ? (matchItem.FacultyName || matchItem.FacFirstName || '-') : '-';
          var email = matchItem ? (matchItem.Email || '') : '';

          if (cells.length >= 11) {
            for (var cIdx = 8; cIdx < cells.length; cIdx++) {
              cells[cIdx].classList.remove('ng-hide');
              cells[cIdx].style.display = '';
            }
            if (shortName !== '-' && (!cells[8].textContent.trim() || cells[8].textContent.trim() === '-')) {
              cells[8].textContent = shortName;
            }
            if (facName !== '-' && (!cells[9].textContent.trim() || cells[9].textContent.trim() === '-')) {
              cells[9].textContent = facName;
            }

            var currEmail = cells[10].textContent.trim();
            var targetEmail = email || (currEmail !== '-' ? currEmail : '');
            if (targetEmail && targetEmail !== '-') {
              cells[10].innerHTML = '<a href="mailto:' + escapeHTML(targetEmail) + '" class="ewu-fac-email-link" title="Send email to ' + escapeHTML(facName) + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' + escapeHTML(targetEmail) + '</a>';
            } else {
              cells[10].textContent = '-';
            }
          } else if (cells.length === 8) {
            var tdInitial = document.createElement('td');
            tdInitial.textContent = shortName;
            row.appendChild(tdInitial);

            var tdName = document.createElement('td');
            tdName.textContent = facName;
            row.appendChild(tdName);

            var tdEmail = document.createElement('td');
            if (email) {
              tdEmail.innerHTML = '<a href="mailto:' + escapeHTML(email) + '" class="ewu-fac-email-link" title="Send email to ' + escapeHTML(facName) + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' + escapeHTML(email) + '</a>';
            } else {
              tdEmail.textContent = '-';
            }
            row.appendChild(tdEmail);
          }
        }

        // 3. Calculate Grouped Total Courses and Total Credits
        var totalCourses = Object.keys(courseCreditMap).length;
        var totalCredits = 0;
        for (var k in courseCreditMap) {
          if (courseCreditMap.hasOwnProperty(k)) {
            totalCredits += courseCreditMap[k];
          }
        }

        self._updateSummaryCard(table, totalCourses, totalCredits);

      } catch (err) {
        log('[ScheduleEnhancer] Error enhancing table:', err);
      } finally {
        setTimeout(function () {
          self._isEnhancing = false;
        }, 100);
      }
    },

    _getRawData: function () {
      if (!this._apiData) return [];
      var items = this._apiData;
      if (Array.isArray(items) && items.length > 0 && Array.isArray(items[0])) items = items[0];
      return Array.isArray(items) ? items : [];
    },

    _updateSummaryCard: function (table, totalCourses, totalCredits) {
      var container = table.closest('.table-responsive') || table.parentNode;
      if (!container) return;

      var card = safeQuery('#ewu-cs-summary-card');
      if (!card) {
        card = document.createElement('div');
        card.id = 'ewu-cs-summary-card';
        card.className = 'ewu-cs-summary-card';
        if (container.nextSibling) {
          container.parentNode.insertBefore(card, container.nextSibling);
        } else {
          container.parentNode.appendChild(card);
        }
      }

      card.innerHTML =
        '<div class="ewu-cs-stat-item">' +
          '<span class="ewu-cs-stat-label">Total courses:</span>' +
          '<span class="ewu-cs-stat-value" id="ewu-cs-total-courses">' + totalCourses + '</span>' +
        '</div>' +
        '<div class="ewu-cs-stat-divider"></div>' +
        '<div class="ewu-cs-stat-item">' +
          '<span class="ewu-cs-stat-label">Total Credit:</span>' +
          '<span class="ewu-cs-stat-value" id="ewu-cs-total-credits">' + totalCredits.toFixed(2) + '</span>' +
        '</div>';
    },

    reset: function () {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      var card = safeQuery('#ewu-cs-summary-card');
      if (card) card.remove();
      this._apiData = null;
      this._isEnhancing = false;
    }
  };


  /* ===========================================================
     OFFERED COURSES ENHANCER MODULE
     =========================================================== */

  var OfferedCoursesEnhancerModule = {
    API_KW: 'GetAllOfferedCourses',
    TBL: 'tblData',
    CONT: 'courseTable',
    DELAY: 300,
    _apiData: [],
    _extractedData: [],    // last extracted course objects for filtering
    _hasRealData: false,    // only true after API data received
    _hooksInstalled: false,
    _observer: null,
    _timer: null,
    _settings: {},
    _enhanced: false,
    _searchTimer: null,
    _lastBuildHash: '',
    _pageHookListener: null,
    _buttonWatcherAttached: false,
    _showAvailable: false,  // toggle state

    // Known header/placeholder labels from the portal table
    _PLACEHOLDER_LABELS: ['section', 'timing', 'room no', 'room no.', 'dedicated', 'dedicated department'],

    init: async function (settings) {
      this._settings = settings.modules || {};
      if (location.pathname.toLowerCase().indexOf('/home/offeredcoursesstudent') === -1 &&
          !safeQuery('[ng-controller="OfferedCoursesStudentController"]')) return;

      log('Offered Courses Enhancer activating');
      debugLog('OC: active');

      // Inject page hook for API interception
      injectPageHook();

      // Listen for postMessage from pageHook.js
      this._listenForPageHookMessages();

      // Also hook from content script context (as backup)
      this._hookAPI();

      // Watch for table DOM changes
      this._watchTable();

      // Inject controls bar (search, stats, toggle) outside the table scroll container
      this._injectControlsBar();

      // Immediately inject enhanced table headers on page load
      this._injectImmediateHeaders();

      // Attach button watcher for Show Offered Course click
      this._attachButtonWatcher();
    },

    _listenForPageHookMessages: function () {
      if (this._pageHookListener) return;
      this._pageHookListener = true;
      var self = this;
      window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'EWU_OC_API_DATA' && event.data.data) {
          debugLog('OC: Received API data from page hook');
          self._handleData(event.data.data);
        }
      });
    },

    _hookAPI: function () {
      if (this._hooksInstalled) return;
      this._hooksInstalled = true;
      var self = this;

      if (window.fetch) {
        var orig = window.fetch;
        window.fetch = async function () {
          var res = await orig.apply(this, arguments);
          var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
          if (url.indexOf(self.API_KW) !== -1) {
            try { var d = await res.clone().json(); self._handleData(d); } catch (e) {}
          }
          return res;
        };
      }

      var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, url) { this._ewu_oc = url; return origOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        if (this._ewu_oc && this._ewu_oc.indexOf(self.API_KW) !== -1) {
          var xhr = this;
          this.addEventListener('load', function () { try { self._handleData(JSON.parse(xhr.responseText)); } catch (e) {} });
        }
        return origSend.apply(this, arguments);
      };
    },

    _handleData: function (data) {
      var items = data;
      if (Array.isArray(items) && items.length > 0 && Array.isArray(items[0])) items = items[0];
      if (!Array.isArray(items)) return;

      // Always replace with new data on fresh search
      this._apiData = items;
      this._hasRealData = true;

      debugLog('OC: ' + this._apiData.length + ' items captured');
      Toast.show('Enhanced course data loaded (' + this._apiData.length + ' courses)', 'success', 2500);
      this._scheduleEnhance();
    },

    _watchTable: function () {
      var container = safeQuery('#' + this.CONT);
      if (!container) return;
      var self = this;
      this._observer = new MutationObserver(function () {
        if (!self._timer) self._scheduleEnhance();
      });
      this._observer.observe(container, { childList: true, subtree: true });
      var table = safeQuery('#' + this.TBL);
      if (table && table.querySelectorAll('tr').length > 2 && this._hasRealData) this._scheduleEnhance();
    },

    _attachButtonWatcher: function () {
      if (this._buttonWatcherAttached) return;
      this._buttonWatcherAttached = true;
      var self = this;
      document.addEventListener('click', function (event) {
        var btn = event.target.closest ? event.target.closest('[ng-click="search()"], .btn') : null;
        if (!btn) return;
        var text = (btn.innerText || btn.textContent || '').trim();
        if (text.indexOf('Show Offered Courses') !== -1 || text.indexOf('Show Offered Course') !== -1) {
          self._apiData = [];
          self._extractedData = [];
          self._hasRealData = false;
          self._lastBuildHash = '';
          Toast.show('Loading courses...', 'info', 2500);
          debugLog('OC: Show Offered Courses clicked, waiting for API...');
        }
      });
    },

    /* -----------------------------------------------------------
       CONTROLS BAR (search, stats, toggle) – placed OUTSIDE #courseTable
       so it never scrolls with the table.
       ----------------------------------------------------------- */
    _injectControlsBar: function () {
      if (safeQuery('#ewu-oc-controls')) return;
      var container = safeQuery('#' + this.CONT);
      if (!container) return;
      // Insert wrapper ABOVE the courseTable scroll container
      var parent = container.parentNode;
      if (!parent) return;

      var bar = document.createElement('div');
      bar.id = 'ewu-oc-controls';
      bar.className = 'ewu-oc-controls';

      // Search
      if (this._settings.offeredCoursesSearchBox !== false) {
        // Outer group: label above, wrapper below
        var searchGroup = document.createElement('div');
        searchGroup.className = 'ewu-oc-search-group';

        // "Search" label
        var searchLabel = document.createElement('label');
        searchLabel.className = 'ewu-oc-search-label';
        searchLabel.setAttribute('for', 'ewu-oc-search-input');
        searchLabel.textContent = 'Search';
        searchGroup.appendChild(searchLabel);

        var searchWrap = document.createElement('div');
        searchWrap.className = 'ewu-oc-search-wrapper';

        // Magnifier icon inside wrapper (left side)
        var searchIcon = document.createElement('span');
        searchIcon.className = 'ewu-oc-search-icon';
        searchIcon.setAttribute('aria-hidden', 'true');
        searchIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
        searchWrap.appendChild(searchIcon);

        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'ewu-oc-search-input';
        input.className = 'ewu-oc-search-input';
        input.placeholder = this._settings.offeredCoursesSearchPlaceholder || 'Search by course or faculty...';
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');

        var clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.id = 'ewu-oc-search-clear';
        clearBtn.className = 'ewu-oc-search-clear';
        clearBtn.innerHTML = '\u00D7';
        clearBtn.title = 'Clear';

        searchWrap.appendChild(input);
        searchWrap.appendChild(clearBtn);
        searchGroup.appendChild(searchWrap);
        bar.appendChild(searchGroup);

        var self = this;
        input.addEventListener('input', function () {
          if (self._searchTimer) clearTimeout(self._searchTimer);
          self._searchTimer = setTimeout(function () {
            self._searchTimer = null;
            self._applyFilters();
            clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
          }, 200);
        });
        clearBtn.addEventListener('click', function () {
          input.value = '';
          self._applyFilters();
          clearBtn.style.display = 'none';
          input.focus();
        });
      }

      // Right side: stats + toggle
      var rightWrap = document.createElement('div');
      rightWrap.className = 'ewu-oc-controls-right';

      // Total count
      var statsEl = document.createElement('span');
      statsEl.id = 'ewu-oc-stats';
      statsEl.className = 'ewu-oc-stats';
      statsEl.textContent = 'Total Courses: 0';
      rightWrap.appendChild(statsEl);

      // Show Available toggle
      var toggleWrap = document.createElement('label');
      toggleWrap.className = 'ewu-oc-toggle-label';
      toggleWrap.title = 'Show only courses with available seats';

      var toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.id = 'ewu-oc-toggle-available';
      toggleInput.className = 'ewu-oc-toggle-input';

      var toggleTrack = document.createElement('span');
      toggleTrack.className = 'ewu-oc-toggle-track';

      var toggleText = document.createElement('span');
      toggleText.className = 'ewu-oc-toggle-text';
      toggleText.textContent = 'Show available';

      toggleWrap.appendChild(toggleInput);
      toggleWrap.appendChild(toggleTrack);
      toggleWrap.appendChild(toggleText);
      rightWrap.appendChild(toggleWrap);

      bar.appendChild(rightWrap);
      parent.insertBefore(bar, container);

      // Toggle listener
      var self2 = this;
      toggleInput.addEventListener('change', function () {
        self2._showAvailable = toggleInput.checked;
        self2._applyFilters();
      });
    },

    /* -----------------------------------------------------------
       FILTERING (search + show available) + count update
       ----------------------------------------------------------- */
    _applyFilters: function () {
      var searchInput = safeQuery('#ewu-oc-search-input');
      var q = searchInput ? searchInput.value.trim().toLowerCase() : '';

      var rows = safeQueryAll('.ewu-oc-row');
      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var searchText = (rows[i].getAttribute('data-search') || '').toLowerCase();
        var hasLeft = (rows[i].getAttribute('data-left') || '') !== '0';
        var matchSearch = !q || searchText.indexOf(q) !== -1;
        var matchAvail = !this._showAvailable || hasLeft;
        var show = matchSearch && matchAvail;
        rows[i].style.display = show ? '' : 'none';
        if (show) visible++;
      }
      this._updateCount(visible);
    },

    _updateCount: function (count) {
      var el = safeQuery('#ewu-oc-stats');
      if (el) el.textContent = 'Total Courses: ' + count;
    },

    _scheduleEnhance: function () {
      if (this._timer) return;
      var self = this;
      this._timer = setTimeout(function () {
        self._timer = null;
        self._doEnhance();
      }, this.DELAY);
    },

    _doEnhance: function () {
      // Do NOT enhance without real API data
      if (!this._hasRealData) return;

      var data = this._extractData();
      if (!data || !data.length) return;

      this._extractedData = data;

      var hash = data.length + ':' + (data[0] ? data[0].courseCode : '');
      if (hash === this._lastBuildHash && this._enhanced) return;
      this._lastBuildHash = hash;

      var table = safeQuery('#' + this.TBL);
      if (!table) return;

      this._buildTable(data, table);
      this._enhanced = true;
    },

    _extractData: function () {
      if (this._apiData.length > 0) {
        var courses = [];
        for (var i = 0; i < this._apiData.length; i++) {
          var item = this._apiData[i];
          if (!item) continue;
          var cc = safeText(item.CourseCode);
          if (!cc) continue; // skip items without a valid CourseCode
          var cap   = parseInt(item.SeatCapacity, 10) || 0;
          var taken = parseInt(item.SeatTaken, 10)    || 0;
          var left  = Math.max(0, cap - taken);

          // Faculty: use ShortName primarily, fallback to FacultyName
          var faculty = safeText(item.ShortName) || safeText(item.FacultyName) || '-';

          // Parse days and time from TimeSlotName
          var tsName = safeText(item.TimeSlotName);
          var daysParsed = this._parseDaysTime(tsName);

          courses.push({
            courseCode:  cc,
            courseName:  safeText(item.CourseName),
            section:     safeText(item.SectionName),
            faculty:     faculty,
            seatsTaken:  taken,
            seatsTotal:  cap,
            seatsLabel:  taken + ' / ' + cap,   // Seats(A/T) = Taken / Total
            left:        left,
            days:        daysParsed.days,         // e.g. "Mon, Wed"
            time:        daysParsed.time,         // e.g. "08:00 AM - 10:00 AM"
            room:        safeText(item.RoomCode) || safeText(item.RoomName) || '-',
            dedicatedDept: safeText(item.DedicateDepartmentName) || '-'
          });

          if (i < 3) {
            debugLog('OC: item[' + i + '] ' + cc + ' Sec' + item.SectionName +
              ' | TimeSlot:', tsName, '| Days:', daysParsed.days, '| Time:', daysParsed.time +
              ' | Seats:', taken + '/' + cap);
          }
        }
        if (courses.length) return courses;
      }

      // Fallback: parse from DOM – but ONLY if we have real data context
      if (!this._hasRealData) return [];

      var table = safeQuery('#' + this.TBL);
      if (!table) return [];
      var rows = table.querySelectorAll('tr');
      var domCourses = [];
      var self = this;
      for (var j = 1; j < rows.length; j++) {
        var cells = rows[j].querySelectorAll('td');
        if (cells.length < 4) continue;
        var rawCode = cells[0] ? (cells[0].textContent || '') : '';
        var code = rawCode.trim();
        if (!code) continue;
        if (self._isPlaceholderLabel(code)) continue;
        // DOM fallback: cells[5] = seats in old format
        var seatsRaw = ((cells[3] || {}).textContent || '').split('/');
        domCourses.push({
          courseCode:  code,
          courseName:  '',
          section:     ((cells[1] || {}).textContent || '').trim(),
          faculty:     '-',
          seatsTaken:  parseInt(seatsRaw[0], 10) || 0,
          seatsTotal:  parseInt(seatsRaw[1], 10) || 0,
          seatsLabel:  (((cells[3] || {}).textContent || '')).trim() || '-',
          left:        Math.max(0, (parseInt(seatsRaw[1], 10) || 0) - (parseInt(seatsRaw[0], 10) || 0)),
          days:        '-',
          time:        '-',
          room:        ((cells[4] || {}).textContent || '').trim() || '-'
        });
      }
      return domCourses;
    },

    /* -----------------------------------------------------------
       Parse days and time string from a TimeSlotName value.
       E.g. "MW 08:00 AM - 10:00 AM" → { days: "Mon, Wed", time: "08:00 AM - 10:00 AM" }
            "M 4:50PM-6:50PM"        → { days: "Mon",      time: "4:50 PM - 6:50 PM" }
       ----------------------------------------------------------- */
    _DAY_CODE_MAP: {
      'A': 'Sat', 'S': 'Sun', 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'F': 'Fri'
    },
    _parseDaysTime: function (tsName) {
      if (!tsName) return { days: '-', time: '-' };
      // Match: "<dayCodes> <time1> - <time2>"  (flexible spacing, AM/PM with/without space)
      var m = tsName.trim().match(/^([A-Z]+)\s+([\d:]+\s*(?:AM|PM))\s*-\s*([\d:]+\s*(?:AM|PM))$/i);
      if (!m) {
        debugLog('OC: _parseDaysTime could not parse:', tsName);
        return { days: tsName, time: '-' };
      }
      var dayCodes = m[1].toUpperCase();
      var dayNames = [];
      var self = this;
      for (var i = 0; i < dayCodes.length; i++) {
        var dn = self._DAY_CODE_MAP[dayCodes[i]];
        if (dn) dayNames.push(dn);
      }
      // Normalize times: ensure space before AM/PM
      function normTime(t) {
        return t.trim().replace(/(\d)(AM|PM)/i, '$1 $2').toUpperCase();
      }
      var timeStr = normTime(m[2]) + ' - ' + normTime(m[3]);
      return {
        days: dayNames.length ? dayNames.join(', ') : dayCodes,
        time: timeStr
      };
    },

    /* -----------------------------------------------------------
       IMMEDIATE TABLE HEADER INJECTION (on page load, before API data)
       Replaces the portal default table headers with enhanced ones
       immediately, so the new headers are always visible.
       ----------------------------------------------------------- */
    _injectImmediateHeaders: function () {
      var table = safeQuery('#' + this.TBL);
      if (!table) return;
      var existingHeaderRow = table.querySelector('tr');
      if (!existingHeaderRow) return;
      var sticky = this._settings.offeredCoursesStickyHeader !== false ? ' ewu-oc-sticky-header' : '';
      var h = '<thead><tr class="ewu-oc-header-placeholder-row ' + sticky + '">';
      // New headers: Course | Section | Faculty | Seats(A/T) | Left | Days | Time | Room No. | Dedicated Department
      var headers = ['Course', 'Section', 'Faculty', 'Seats(A/T)', 'Left', 'Days', 'Time', 'Room No.', 'Dedicated Department'];
      for (var i = 0; i < headers.length; i++) {
        h += '<th class="ewu-oc-th ewu-oc-th-placeholder">' + escapeHTML(headers[i]) + '</th>';
      }
      h += '</tr></thead><tbody class="ewu-oc-placeholder-body"></tbody>';
      table.innerHTML = h;
      table.className = 'table table-striped grid-table ewu-oc-table';
      if (table.getAttribute('border') !== '1') table.setAttribute('border', '1');
      debugLog('OC: Immediate enhanced headers injected (new structure: Course|Section|Faculty|Seats(A/T)|Left|Days|Time|Room|DedicatedDept)');
    },

    /** Check if a text value matches a known portal placeholder/header label */
    _isPlaceholderLabel: function (text) {
      var lower = (text || '').toLowerCase().trim();
      for (var i = 0; i < this._PLACEHOLDER_LABELS.length; i++) {
        if (lower === this._PLACEHOLDER_LABELS[i]) return true;
      }
      return false;
    },

    _buildTable: function (data, table) {
      var colorLeft = this._settings.offeredCoursesColorLeft !== false;
      var sticky = this._settings.offeredCoursesStickyHeader !== false ? ' ewu-oc-sticky-header' : '';

      // New headers: Course | Section | Faculty | Seats(A/T) | Left | Days | Time | Room No. | Dedicated Department
      var h = '<thead><tr class="' + sticky + '">';
      var headers = ['Course', 'Section', 'Faculty', 'Seats(A/T)', 'Left', 'Days', 'Time', 'Room No.', 'Dedicated Department'];
      for (var i = 0; i < headers.length; i++) {
        h += '<th class="ewu-oc-th">' + escapeHTML(headers[i]) + '</th>';
      }
      h += '</tr></thead><tbody id="ewu-oc-tbody">';

      debugLog('OC: _buildTable rendering', data.length, 'rows with new structure');

      for (var j = 0; j < data.length; j++) {
        var c = data[j];
        var rc = 'ewu-oc-row' + (j % 2 === 0 ? ' ewu-oc-row-even' : ' ewu-oc-row-odd');
        // Search text includes course, section, faculty, days, time, room
        var searchText = [c.courseCode, c.section, c.faculty, c.days, c.time, c.room, c.courseName].join(' ').toLowerCase();
        h += '<tr class="' + rc + '" data-search="' + escapeHTML(searchText) + '" data-left="' + c.left + '">';

        h += '<td class="ewu-oc-td ewu-oc-td-course">'  + escapeHTML(c.courseCode)  + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-section">' + escapeHTML(c.section)     + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-faculty">' + escapeHTML(c.faculty)     + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-seats">'   + escapeHTML(c.seatsLabel)  + '</td>';

        var lc = 'ewu-oc-left';
        if (colorLeft) {
          if (c.left === 0)       lc += ' ewu-oc-left-red';
          else if (c.left <= 10)  lc += ' ewu-oc-left-yellow';
          else                    lc += ' ewu-oc-left-green';
        }
        h += '<td class="ewu-oc-td ' + lc + '">'        + c.left                    + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-days">'    + escapeHTML(c.days)        + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-time">'    + escapeHTML(c.time)        + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-room">'    + escapeHTML(c.room)        + '</td>';
        h += '<td class="ewu-oc-td ewu-oc-td-dept">'    + escapeHTML(c.dedicatedDept || '-') + '</td>';
        h += '</tr>';
      }
      h += '</tbody>';
      table.innerHTML = h;
      table.className = 'table table-striped grid-table ewu-oc-table';
      if (table.getAttribute('border') !== '1') table.setAttribute('border', '1');

      // Apply current filters and update count
      this._applyFilters();

      // Inject Export PDF button after table is built
      this._injectExportPDFButton();
    },

    /* -----------------------------------------------------------
       EXPORT PDF BUTTON for Offered Courses
       Injects a PDF export icon button beside the portal Print button.
       ----------------------------------------------------------- */
    _injectExportPDFButton: function () {
      if (safeQuery('#ewu-oc-export-pdf-btn')) return;
      // Find the Print button in the portal controls
      var printBtn = safeQuery('a[onclick*="printDiv"]');
      if (!printBtn) {
        // Fallback: find by text content
        var allLinks = safeQueryAll('a.btn');
        for (var i = 0; i < allLinks.length; i++) {
          if ((allLinks[i].textContent || '').indexOf('Print') !== -1) {
            printBtn = allLinks[i]; break;
          }
        }
      }
      if (!printBtn) return;

      var parent = printBtn.parentNode;
      if (!parent) return;

      var pdfBtn = document.createElement('a');
      pdfBtn.href = '';
      pdfBtn.id = 'ewu-oc-export-pdf-btn';
      pdfBtn.className = 'btn btn-primary ewu-oc-export-pdf-btn';
      pdfBtn.title = 'Export to PDF';
      pdfBtn.innerHTML = '<span class="fa fa-file-pdf"></span>';
      pdfBtn.style.cssText = 'margin-left:8px;cursor:pointer;';

      var self = this;
      pdfBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self._exportCoursesPDF();
      });

      // Insert after the Print button
      parent.appendChild(pdfBtn);
      debugLog('OC: Export PDF button injected');
    },

    /* -----------------------------------------------------------
       EXPORT COURSES PDF
       Uses jsPDF to create a landscape PDF from currently visible rows.
       ----------------------------------------------------------- */
    _exportCoursesPDF: async function () {
      // Collect currently visible rows: Course | Section | Faculty | Seats(A/T) | Left | Days | Time | Room No.
      var rows = safeQueryAll('.ewu-oc-row');
      var visibleData = [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].style.display === 'none') continue;
        var cells = rows[i].querySelectorAll('.ewu-oc-td');
        if (cells.length < 8) continue;
        visibleData.push({
          course:  ((cells[0] || {}).textContent || '').trim(),
          section: ((cells[1] || {}).textContent || '').trim(),
          faculty: ((cells[2] || {}).textContent || '').trim(),
          seats:   ((cells[3] || {}).textContent || '').trim(),
          left:    ((cells[4] || {}).textContent || '').trim(),
          days:    ((cells[5] || {}).textContent || '').trim(),
          time:    ((cells[6] || {}).textContent || '').trim(),
          room:    ((cells[7] || {}).textContent || '').trim()
        });
      }

      if (!visibleData.length) {
        Toast.show('No course data available to export', 'error');
        return;
      }

      debugLog('OC: PDF export starting with', visibleData.length, 'rows');
      Toast.show('Generating PDF...', 'info', 2000);

      try {
        var JsPDFCtor = null;
        if (window.jspdf && typeof window.jspdf.jsPDF === 'function') JsPDFCtor = window.jspdf.jsPDF;
        if (!JsPDFCtor) { Toast.show('PDF library not available', 'error'); return; }

        // A4 landscape (297 × 210 mm)
        var pdf = new JsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth();
        var ph = pdf.internal.pageSize.getHeight();
        var margin  = 10;
        var usableW = pw - margin * 2;   // ~277 mm
        var headerH = 9;
        var cellPad = 1.8;
        var baseRowH = 7;  // minimum row height (mm)
        var lineH    = 3.8; // height per text line (mm)

        // Column widths (raw): Course and Faculty narrowed; Room significantly widened
        // Course | Section | Faculty | Seats(A/T) | Left | Days | Time | Room No.
        var colWRaw = [24, 16, 26, 22, 14, 28, 36, 54];
        var totalRaw = 0;
        for (var ci = 0; ci < colWRaw.length; ci++) totalRaw += colWRaw[ci];
        var sf = usableW / totalRaw;
        var colW = colWRaw.map(function (w) { return w * sf; });

        var headers = ['Course', 'Section', 'Faculty', 'Seats(A/T)', 'Left', 'Days', 'Time', 'Room No.'];
        var pageNum = 1;

        /* ---- Helper: draw blue header row, return new y ---- */
        function drawHeader(yPos) {
          var xp = margin;
          pdf.setFillColor(26, 115, 232);
          pdf.rect(xp, yPos, usableW, headerH, 'F');
          pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
          xp = margin;
          for (var hi = 0; hi < headers.length; hi++) {
            pdf.text(headers[hi], xp + cellPad, yPos + headerH / 2 + 1.5, { maxWidth: colW[hi] - cellPad * 2 });
            xp += colW[hi];
          }
          return yPos + headerH;
        }

        /* ---- Helper: draw footer for current page ---- */
        function drawFooter() {
          pdf.setFontSize(7); pdf.setTextColor(160, 160, 160); pdf.setFont('helvetica', 'normal');
          pdf.text('Page ' + pageNum + '  |  EWU Portal Helper v' + CONFIG.VERSION, pw / 2, ph - 4, { align: 'center' });
        }

        var y = drawHeader(margin);
        var rowAlt = 0;

        debugLog('OC: PDF col widths (mm):', colW.map(function (w) { return w.toFixed(1); }).join(' | '));

        for (var ri = 0; ri < visibleData.length; ri++) {
          var d = visibleData[ri];
          var vals = [d.course, d.section, d.faculty, d.seats, d.left, d.days, d.time, d.room];

          // Compute word-wrapped lines for every column
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
          var cellLines = vals.map(function (v, idx) {
            return pdf.splitTextToSize((v || '').trim(), colW[idx] - cellPad * 2);
          });
          // Max lines across columns (cap at 3 to avoid oversized rows)
          var maxLines = Math.min(3, cellLines.reduce(function (mx, ls) { return Math.max(mx, ls.length); }, 1));
          var actualRowH = Math.max(baseRowH, maxLines * lineH + 2);

          // Page break: add a new page if this row won't fit
          if (y + actualRowH > ph - 10) {
            drawFooter();
            pdf.addPage();
            pageNum++;
            y = drawHeader(margin);
            rowAlt = 0;
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
          }

          // Alternating row background
          if (rowAlt % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, usableW, actualRowH, 'F');
          }
          // Row border
          pdf.setDrawColor(220, 225, 235);
          pdf.rect(margin, y, usableW, actualRowH, 'S');

          // Draw each column's text (word-wrapped)
          var x = margin;
          pdf.setTextColor(30, 41, 59);
          for (var vi = 0; vi < vals.length; vi++) {
            var lns = cellLines[vi].slice(0, maxLines); // honour the cap
            for (var lli = 0; lli < lns.length; lli++) {
              pdf.text(lns[lli], x + cellPad, y + cellPad + (lli + 0.7) * lineH);
            }
            x += colW[vi];
          }

          y += actualRowH;
          rowAlt++;
        }

        drawFooter();

        var now = new Date();
        var ts = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0') + '_' +
          String(now.getHours()).padStart(2, '0') + '-' +
          String(now.getMinutes()).padStart(2, '0');
        pdf.save('EWU_Offered_Courses_' + ts + '.pdf');
        Toast.show('PDF exported successfully (' + visibleData.length + ' courses)', 'success');
        debugLog('OC: PDF export done —', visibleData.length, 'rows,', pageNum, 'page(s)');
      } catch (e) {
        debugLog('OC: PDF export failed:', e.message || e);
        Toast.show('PDF export failed: ' + (e.message || 'Unknown error'), 'error');
      }
    },

    reset: function () {
      this._apiData = [];
      this._extractedData = [];
      this._hasRealData = false;
      this._hooksInstalled = false;
      this._enhanced = false;
      this._lastBuildHash = '';
      this._pageHookListener = false;
      this._buttonWatcherAttached = false;
      this._showAvailable = false;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (this._searchTimer) { clearTimeout(this._searchTimer); this._searchTimer = null; }
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      var sb = safeQuery('#ewu-oc-search');
      if (sb) sb.remove();
      var ctrl = safeQuery('#ewu-oc-controls');
      if (ctrl) ctrl.remove();
    },
  };


  /* ===========================================================
     ADVISING TABLE ENHANCER MODULE
     =========================================================== */

  var AdvisingTableEnhancerModule = {
    API_KW: 'GetAllRoutine',
    _apiData: [],
    _apiMapBySectionId: {},
    _apiMapByKey: {},
    _hooksInstalled: false,
    _pageHookListener: false,
    _observer: null,
    _settings: null,
    _showAvailable: false,
    _timer: null,
    _searchTimer: null,

    init: async function (settings) {
      this._settings = settings;
      var mods = settings.modules || {};
      if (mods.advisingTableEnhancer === false) return;

      var pn = location.pathname.toLowerCase();
      var isAdvPage = (pn.indexOf('/home/advising') !== -1) ||
                      !!safeQuery('.btn2') ||
                      !!safeQuery('[href*="/Home/Advising"]') ||
                      !!safeQuery('#form_part_1');
      if (!isAdvPage) return;

      routineLog('Advising page detected, activating AdvisingTableEnhancer');
      injectPageHook();
      this._listenForPageHookMessages();
      this._hookAPI();
      this._watchTables();
      this._injectControlsBar();
      this._injectTopPDFButton();
      this._enhanceTables();
    },

    _listenForPageHookMessages: function () {
      if (this._pageHookListener) return;
      this._pageHookListener = true;
      var self = this;
      window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'EWU_ADV_API_DATA' && event.data.data) {
          debugLog('ADV: Received API data from page hook');
          self._handleData(event.data.data);
        }
      });
    },

    _hookAPI: function () {
      if (this._hooksInstalled) return;
      this._hooksInstalled = true;
      var self = this;

      if (window.fetch) {
        var orig = window.fetch;
        window.fetch = async function () {
          var res = await orig.apply(this, arguments);
          var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
          if (url.indexOf(self.API_KW) !== -1) {
            try { var d = await res.clone().json(); self._handleData(d); } catch (e) {}
          }
          return res;
        };
      }

      var origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, url) { this._ewu_adv = url; return origOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () {
        if (this._ewu_adv && this._ewu_adv.indexOf(self.API_KW) !== -1) {
          var xhr = this;
          this.addEventListener('load', function () { try { self._handleData(JSON.parse(xhr.responseText)); } catch (e) {} });
        }
        return origSend.apply(this, arguments);
      };
    },

    _handleData: function (data) {
      var items = data;
      if (Array.isArray(items) && items.length > 0 && Array.isArray(items[0])) items = items[0];
      if (!Array.isArray(items)) return;

      this._apiData = items;
      this._apiMapBySectionId = {};
      this._apiMapByKey = {};

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        if (item.SectionId) {
          this._apiMapBySectionId[item.SectionId] = item;
        }
        var cc = safeText(item.CourseCode);
        var sec = safeText(item.SectionName);
        if (cc && sec) {
          this._apiMapByKey[cc + '_' + sec] = item;
        }
      }

      debugLog('ADV: ' + items.length + ' routine items captured');
      Toast.show('Advising course data loaded (' + items.length + ' sections)', 'success', 2500);
      this._scheduleEnhance();
    },

    _watchTables: function () {
      var targetNode = safeQuery('#form_part_1') || safeQuery('.main-wrapper') || document.body;
      if (!targetNode) return;
      var self = this;

      if (this._observer) this._observer.disconnect();
      this._observer = new MutationObserver(function () {
        if (!self._timer) self._scheduleEnhance();
      });
      this._observer.observe(targetNode, { childList: true, subtree: true });

      // Tab button clicks (.btn1, .btn2, .btn3, .btn4)
      document.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.btn1, .btn2, .btn3, .btn4') : null;
        if (btn) {
          setTimeout(function () {
            self._enhanceTables();
          }, 100);
        }
      });
    },

    _injectControlsBar: function () {
      if (safeQuery('#ewu-adv-controls')) return;
      var container = safeQuery('#form_part_1');
      if (!container) return;

      var bar = document.createElement('div');
      bar.id = 'ewu-adv-controls';
      bar.className = 'ewu-oc-controls';
      bar.style.cssText = 'margin-bottom: 12px; margin-top: 10px;';

      // Search group
      var searchGroup = document.createElement('div');
      searchGroup.className = 'ewu-oc-search-group';

      var searchLabel = document.createElement('label');
      searchLabel.className = 'ewu-oc-search-label';
      searchLabel.setAttribute('for', 'ewu-adv-search-input');
      searchLabel.textContent = 'Search Advising Courses';
      searchGroup.appendChild(searchLabel);

      var searchWrap = document.createElement('div');
      searchWrap.className = 'ewu-oc-search-wrapper';

      var searchIcon = document.createElement('span');
      searchIcon.className = 'ewu-oc-search-icon';
      searchIcon.setAttribute('aria-hidden', 'true');
      searchIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
      searchWrap.appendChild(searchIcon);

      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'ewu-adv-search-input';
      input.className = 'ewu-oc-search-input';
      input.placeholder = 'Search by course, faculty, or timing...';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');

      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.id = 'ewu-adv-search-clear';
      clearBtn.className = 'ewu-oc-search-clear';
      clearBtn.innerHTML = '\u00D7';
      clearBtn.title = 'Clear';

      searchWrap.appendChild(input);
      searchWrap.appendChild(clearBtn);
      searchGroup.appendChild(searchWrap);
      bar.appendChild(searchGroup);

      // Right wrap: stats + toggle
      var rightWrap = document.createElement('div');
      rightWrap.className = 'ewu-oc-controls-right';

      var statsEl = document.createElement('span');
      statsEl.id = 'ewu-adv-stats';
      statsEl.className = 'ewu-oc-stats';
      statsEl.textContent = 'Advising Sections: 0';
      rightWrap.appendChild(statsEl);

      var toggleWrap = document.createElement('label');
      toggleWrap.className = 'ewu-oc-toggle-label';
      toggleWrap.title = 'Show only courses with available seats';

      var toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.id = 'ewu-adv-toggle-available';
      toggleInput.className = 'ewu-oc-toggle-input';

      var toggleTrack = document.createElement('span');
      toggleTrack.className = 'ewu-oc-toggle-track';

      var toggleText = document.createElement('span');
      toggleText.className = 'ewu-oc-toggle-text';
      toggleText.textContent = 'Show available';

      toggleWrap.appendChild(toggleInput);
      toggleWrap.appendChild(toggleTrack);
      toggleWrap.appendChild(toggleText);
      rightWrap.appendChild(toggleWrap);

      // PDF Export button in controls bar
      var pdfBtn = document.createElement('a');
      pdfBtn.href = '';
      pdfBtn.id = 'ewu-adv-export-pdf-btn';
      pdfBtn.className = 'btn btn-primary ewu-oc-export-pdf-btn';
      pdfBtn.title = 'Export Advising Table to PDF';
      pdfBtn.innerHTML = '<span class="fa fa-file-pdf"></span>';
      pdfBtn.style.cssText = 'margin-left: 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 32px; width: 34px; padding: 0; border-radius: 6px;';
      pdfBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self._exportAdvisingPDF();
      });
      rightWrap.appendChild(pdfBtn);

      bar.appendChild(rightWrap);

      // Insert above tab buttons or inside container
      var firstBtnCol = container.querySelector('.col-sm-3');
      if (firstBtnCol && firstBtnCol.parentNode) {
        firstBtnCol.parentNode.parentNode.insertBefore(bar, firstBtnCol.parentNode);
      } else {
        container.insertBefore(bar, container.firstChild);
      }

      var self = this;
      input.addEventListener('input', function () {
        if (self._searchTimer) clearTimeout(self._searchTimer);
        self._searchTimer = setTimeout(function () {
          self._searchTimer = null;
          self._applyFilters();
          clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
        }, 150);
      });
      clearBtn.addEventListener('click', function () {
        input.value = '';
        self._applyFilters();
        clearBtn.style.display = 'none';
        input.focus();
      });
      toggleInput.addEventListener('change', function () {
        self._showAvailable = toggleInput.checked;
        self._applyFilters();
      });
    },

    _injectTopPDFButton: function () {
      if (safeQuery('#ewu-adv-top-pdf-btn')) return;
      var refreshBtn = safeQuery('#btn-refresh-seats') || safeQuery('button[ng-click*="refreshSeatCapacity"]');
      if (!refreshBtn) return;

      var topPdfBtn = document.createElement('a');
      topPdfBtn.href = '';
      topPdfBtn.id = 'ewu-adv-top-pdf-btn';
      topPdfBtn.className = 'btn btn-primary ewu-oc-export-pdf-btn';
      topPdfBtn.title = 'Export to PDF';
      topPdfBtn.innerHTML = '<span class="fa fa-file-pdf"></span>';
      topPdfBtn.style.cssText = 'margin-left: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; height: 32px; width: 34px; border-radius: 20px;';

      var self = this;
      topPdfBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self._exportAdvisingPDF();
      });

      if (refreshBtn.parentNode) {
        refreshBtn.parentNode.insertBefore(topPdfBtn, refreshBtn.nextSibling);
      }
    },

    _scheduleEnhance: function () {
      if (this._timer) return;
      var self = this;
      this._timer = setTimeout(function () {
        self._timer = null;
        self._enhanceTables();
      }, 150);
    },

    _enhanceTables: function () {
      var tables = safeQueryAll('#div1 table, #div2 table, #div3 table, #div4 table, .grid-table');
      if (!tables || !tables.length) return;

      var colorLeft = (this._settings && this._settings.modules && this._settings.modules.advisingColorLeft !== false);

      for (var ti = 0; ti < tables.length; ti++) {
        var table = tables[ti];
        var parentContainer = table.closest ? table.closest('#div1, #div2, #div3, #div4, .One, .Two, .Three, .Four') : null;
        if (!parentContainer) continue;

        table.classList.add('ewu-oc-table');
        if (table.getAttribute('border') !== '1') table.setAttribute('border', '1');

        // Header replacement: Course | Section | Faculty | Seat(C/T) | Left | Timing | Room | Credit | Max cr | Prereq
        var existingThead = table.querySelector('thead');
        var headers = ['Course', 'Section', 'Faculty', 'Seat(C/T)', 'Left', 'Timing', 'Room', 'Credit', 'Max cr', 'Prereq'];
        
        var headerHTML = '<thead><tr class="ewu-oc-sticky-header">';
        for (var hi = 0; hi < headers.length; hi++) {
          headerHTML += '<th class="ewu-oc-th">' + escapeHTML(headers[hi]) + '</th>';
        }
        headerHTML += '</tr></thead>';

        if (existingThead) {
          existingThead.outerHTML = headerHTML;
        } else {
          var firstTr = table.querySelector('tr');
          if (firstTr && firstTr.parentNode.tagName.toLowerCase() !== 'tbody') {
            firstTr.outerHTML = headerHTML;
          } else if (firstTr && firstTr.querySelectorAll('th').length > 0) {
            firstTr.outerHTML = headerHTML;
          }
        }

        // Body rows enhancement
        var tbody = table.querySelector('tbody');
        if (!tbody) {
          tbody = document.createElement('tbody');
          table.appendChild(tbody);
        }
        var dataRows = tbody.querySelectorAll('tr');
        if ((!dataRows || dataRows.length === 0) && this._apiData && this._apiData.length > 0) {
          var html = '';
          for (var itemIndex = 0; itemIndex < this._apiData.length; itemIndex++) {
            var itm = this._apiData[itemIndex];
            if (!itm) continue;
            var cCap = itm.SeatCapacity != null ? itm.SeatCapacity : 0;
            var cTaken = itm.SeatTaken != null ? itm.SeatTaken : 0;
            var cLeft = Math.max(0, cCap - cTaken);
            html += '<tr>' +
              '<td>' + escapeHTML(String(itm.CourseCode || '')) + '</td>' +
              '<td>' + escapeHTML(String(itm.SectionName || '')) + '</td>' +
              '<td>' + escapeHTML(String(itm.ShortName || itm.FacultyName || '-')) + '</td>' +
              '<td>' + cCap + ' / ' + cTaken + '</td>' +
              '<td>' + cLeft + '</td>' +
              '<td>' + escapeHTML(String(itm.TimeSlotName || '')) + '</td>' +
              '<td>' + escapeHTML(String(itm.RoomCode || itm.RoomName || '-')) + '</td>' +
              '<td>' + escapeHTML(String(itm.CreditHour != null ? itm.CreditHour : '-')) + '</td>' +
              '<td>' + escapeHTML(String(itm.MaxCredit != null ? itm.MaxCredit : '-')) + '</td>' +
              '<td>' + escapeHTML(String(itm.PrerequisiteCourseCodes || '-')) + '</td>' +
              '</tr>';
          }
          tbody.innerHTML = html;
        }

        var rows = table.querySelectorAll('tbody tr, tr');
        for (var ri = 0; ri < rows.length; ri++) {
          var tr = rows[ri];
          if (tr.querySelector('th')) continue; // skip header row

          var cells = tr.querySelectorAll('td');
          if (!cells || cells.length < 3) continue;

          // Attempt Angular scope extraction
          var scopeSc = null;
          try {
            if (window.angular) {
              var scope = window.angular.element(tr).scope();
              if (scope && scope.sc) scopeSc = scope.sc;
            }
          } catch (_) {}

          var rawCode = (scopeSc ? scopeSc.CourseCode : (cells[0] ? cells[0].textContent : '')).trim();
          var rawSec  = (scopeSc ? scopeSc.SectionName : (cells[1] ? cells[1].textContent : '')).trim();
          if (!rawCode) continue;

          // Find matching API item
          var apiItem = (scopeSc && scopeSc.SectionId && this._apiMapBySectionId[scopeSc.SectionId]) ||
                        this._apiMapByKey[rawCode + '_' + rawSec] || null;

          var faculty = (scopeSc && scopeSc.ShortName) ? scopeSc.ShortName :
                        (apiItem ? (apiItem.ShortName || apiItem.FacultyName) : '');
          if (!faculty || faculty === 'null' || faculty === 'undefined') {
            for (var ci = 0; ci < cells.length; ci++) {
              var txt = (cells[ci].textContent || '').trim();
              if (txt.length >= 2 && txt.length <= 4 && txt === txt.toUpperCase() && !/\d/.test(txt) && txt !== rawCode) {
                faculty = txt; break;
              }
            }
          }
          if (!faculty) faculty = '-';

          var credit = (scopeSc && scopeSc.CreditHour != null) ? scopeSc.CreditHour :
                       (apiItem ? apiItem.CreditHour : (cells[2] ? cells[2].textContent.trim() : '-'));
          if (credit == null || credit === 'null') credit = '-';

          var maxCr = (scopeSc && scopeSc.MaxCredit != null) ? scopeSc.MaxCredit :
                      (apiItem && apiItem.MaxCredit != null ? apiItem.MaxCredit : '-');
          if (maxCr == null || maxCr === 'null') maxCr = '-';

          var timing = (scopeSc && scopeSc.TimeSlotName) ? scopeSc.TimeSlotName :
                       (apiItem ? apiItem.TimeSlotName : '');
          if (!timing) {
            for (var cj = 0; cj < cells.length; cj++) {
              var tText = (cells[cj].textContent || '').trim();
              if (/AM|PM|\d+:\d+/i.test(tText)) { timing = tText; break; }
            }
          }
          if (!timing) timing = '-';

          var room = (scopeSc && scopeSc.RoomCode) ? scopeSc.RoomCode :
                     (scopeSc && scopeSc.RoomName ? scopeSc.RoomName :
                     (apiItem ? (apiItem.RoomCode || apiItem.RoomName) : ''));
          if (!room || room === 'null') {
            for (var cr = 0; cr < cells.length; cr++) {
              var rTxt = (cells[cr].textContent || '').trim();
              if (/(FUB|AB\d+|\d{3})/i.test(rTxt) && rTxt !== rawCode && rTxt !== faculty) {
                room = rTxt; break;
              }
            }
          }
          if (!room) room = '-';

          var cap = (scopeSc && scopeSc.SeatCapacity != null) ? parseInt(scopeSc.SeatCapacity, 10) :
                    (apiItem ? parseInt(apiItem.SeatCapacity, 10) : 0);
          var taken = (scopeSc && scopeSc.SeatTaken != null) ? parseInt(scopeSc.SeatTaken, 10) :
                      (apiItem ? parseInt(apiItem.SeatTaken, 10) : 0);
          
          if (!cap && cells.length >= 8) {
            for (var ck = 0; ck < cells.length; ck++) {
              var num = parseInt(cells[ck].textContent.trim(), 10);
              if (!isNaN(num) && num > 0 && num <= 200 && !cap) cap = num;
              else if (!isNaN(num) && cap && !taken) taken = num;
            }
          }

          var left = Math.max(0, cap - taken);
          var seatCTLabel = cap + ' / ' + taken;

          var prereq = (scopeSc && scopeSc.PrerequisiteCourseCodes) ? scopeSc.PrerequisiteCourseCodes :
                       (apiItem ? apiItem.PrerequisiteCourseCodes : '');
          if (!prereq || prereq === 'null') prereq = '-';

          var leftClass = 'ewu-oc-left';
          if (colorLeft) {
            if (left === 0)       leftClass += ' ewu-oc-left-red';
            else if (left <= 10)  leftClass += ' ewu-oc-left-yellow';
            else                  leftClass += ' ewu-oc-left-green';
          }

          // Build row HTML: Course | Section | Faculty | Seat(C/T) | Left | Timing | Room | Credit | Max cr | Prereq
          var newRowHTML = '';
          newRowHTML += '<td class="ewu-oc-td ewu-oc-td-course">'  + escapeHTML(String(rawCode)) + '</td>';
          newRowHTML += '<td class="ewu-oc-td ewu-oc-td-section">' + escapeHTML(String(rawSec))  + '</td>';
          newRowHTML += '<td class="ewu-oc-td ewu-oc-td-faculty">' + escapeHTML(String(faculty)) + '</td>';
          newRowHTML += '<td class="ewu-oc-td ewu-oc-td-seats">'   + escapeHTML(seatCTLabel)     + '</td>';
          newRowHTML += '<td class="ewu-oc-td ' + leftClass + '">' + left                        + '</td>';
          newRowHTML += '<td class="ewu-oc-td ewu-oc-td-time">'    + escapeHTML(String(timing))  + '</td>';
          newRowHTML += '<td class="ewu-oc-td">'                   + escapeHTML(String(room))    + '</td>';
          newRowHTML += '<td class="ewu-oc-td ewu-oc-td-seats">'   + escapeHTML(String(credit))  + '</td>';
          newRowHTML += '<td class="ewu-oc-td">'                   + escapeHTML(String(maxCr))   + '</td>';
          newRowHTML += '<td class="ewu-oc-td">'                   + escapeHTML(String(prereq))  + '</td>';

          tr.innerHTML = newRowHTML;

          var searchText = [rawCode, rawSec, faculty, timing, room, prereq].join(' ').toLowerCase();
          tr.setAttribute('data-search', searchText);
          tr.setAttribute('data-left', String(left));
          tr.className = 'ewu-oc-row ' + (ri % 2 === 0 ? 'ewu-oc-row-even' : 'ewu-oc-row-odd');

          // Preserve / attach course add click handler for advising experience
          if (!tr.hasAttribute('data-ewu-click-attached')) {
            tr.setAttribute('data-ewu-click-attached', 'true');
            tr.style.cursor = 'pointer';
            tr.title = 'Click row to add course to selected list';
            (function(c, s, cr, tm, rm) {
              tr.addEventListener('click', function (e) {
                if (e.target.closest('button, input, a, svg, path')) return;
                self._addSelectedCourse(c, s, cr, tm, rm);
              });
            })(rawCode, rawSec, credit, timing, room);
          }
        }
      }

      this._applyFilters();
    },

    _applyFilters: function () {
      var searchInput = safeQuery('#ewu-adv-search-input');
      var q = searchInput ? searchInput.value.trim().toLowerCase() : '';

      var rows = safeQueryAll('#div1 tr.ewu-oc-row, #div2 tr.ewu-oc-row, #div3 tr.ewu-oc-row, #div4 tr.ewu-oc-row');
      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var searchText = (rows[i].getAttribute('data-search') || '').toLowerCase();
        var leftVal = rows[i].getAttribute('data-left');
        var hasLeft = leftVal !== '0';
        var matchSearch = !q || searchText.indexOf(q) !== -1;
        var matchAvail = !this._showAvailable || hasLeft;
        var show = matchSearch && matchAvail;
        rows[i].style.display = show ? '' : 'none';
        if (show) visible++;
      }
      this._updateCount(visible);
    },

    _updateCount: function (count) {
      var el = safeQuery('#ewu-adv-stats');
      if (el) el.textContent = 'Advising Sections: ' + count;
    },

    _exportAdvisingPDF: async function () {
      Toast.show('Generating Advising PDF...', 'info', 2000);

      var rows = safeQueryAll('#div1 tr.ewu-oc-row, #div2 tr.ewu-oc-row, #div3 tr.ewu-oc-row, #div4 tr.ewu-oc-row, .ewu-oc-table tr.ewu-oc-row');
      var visibleData = [];

      for (var i = 0; i < rows.length; i++) {
        var tr = rows[i];
        if (tr.style.display === 'none') continue;
        var cells = tr.querySelectorAll('td');
        if (cells.length >= 10) {
          visibleData.push({
            course:  cells[0].textContent.trim(),
            section: cells[1].textContent.trim(),
            faculty: cells[2].textContent.trim(),
            seats:   cells[3].textContent.trim(),
            left:    cells[4].textContent.trim(),
            timing:  cells[5].textContent.trim(),
            room:    cells[6].textContent.trim(),
            credit:  cells[7].textContent.trim(),
            maxCr:   cells[8].textContent.trim(),
            prereq:  cells[9].textContent.trim()
          });
        }
      }

      if (visibleData.length === 0) {
        Toast.show('No visible advising courses to export', 'warn', 2500);
        return;
      }

      try {
        var JsPDFCtor = null;
        if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
          JsPDFCtor = window.jspdf.jsPDF;
        } else if (typeof window.html2canvas === 'function' && window.jspdf) {
          JsPDFCtor = window.jspdf.jsPDF;
        }

        if (!JsPDFCtor) {
          Toast.show('PDF library not loaded', 'error', 3000);
          return;
        }

        var pdf = new JsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth();
        var ph = pdf.internal.pageSize.getHeight();
        var margin = 10;
        var usableW = pw - margin * 2; // 277 mm
        var headerH = 9;
        var cellPad = 1.8;
        var baseRowH = 7;
        var lineH = 3.8;

        var colWRaw = [24, 15, 20, 22, 14, 38, 20, 15, 15, 25];
        var totalRaw = 0;
        for (var ci = 0; ci < colWRaw.length; ci++) totalRaw += colWRaw[ci];
        var sf = usableW / totalRaw;
        var colW = colWRaw.map(function (w) { return w * sf; });

        var headers = ['Course', 'Section', 'Faculty', 'Seat(C/T)', 'Left', 'Timing', 'Room', 'Credit', 'Max cr', 'Prereq'];
        var pageNum = 1;

        function drawHeader(yPos) {
          var xp = margin;
          pdf.setFillColor(26, 115, 232);
          pdf.rect(xp, yPos, usableW, headerH, 'F');
          pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
          xp = margin;
          for (var hi = 0; hi < headers.length; hi++) {
            pdf.text(headers[hi], xp + cellPad, yPos + headerH / 2 + 1.5, { maxWidth: colW[hi] - cellPad * 2 });
            xp += colW[hi];
          }
          return yPos + headerH;
        }

        function drawFooter() {
          pdf.setFontSize(7); pdf.setTextColor(160, 160, 160); pdf.setFont('helvetica', 'normal');
          pdf.text('Page ' + pageNum + '  |  EWU Portal Helper v' + CONFIG.VERSION + ' (Advising Export)', pw / 2, ph - 4, { align: 'center' });
        }

        var y = drawHeader(margin);
        var rowAlt = 0;

        for (var ri = 0; ri < visibleData.length; ri++) {
          var d = visibleData[ri];
          var vals = [d.course, d.section, d.faculty, d.seats, d.left, d.timing, d.room, d.credit, d.maxCr, d.prereq];

          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
          var cellLines = vals.map(function (v, idx) {
            return pdf.splitTextToSize((v || '').trim(), colW[idx] - cellPad * 2);
          });

          var maxLines = Math.min(3, cellLines.reduce(function (mx, ls) { return Math.max(mx, ls.length); }, 1));
          var actualRowH = Math.max(baseRowH, maxLines * lineH + 2);

          if (y + actualRowH > ph - 10) {
            drawFooter();
            pdf.addPage();
            pageNum++;
            y = drawHeader(margin);
            rowAlt = 0;
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
          }

          if (rowAlt % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, usableW, actualRowH, 'F');
          }
          pdf.setDrawColor(220, 225, 235);
          pdf.rect(margin, y, usableW, actualRowH, 'S');

          var x = margin;
          pdf.setTextColor(30, 41, 59);
          for (var vi = 0; vi < vals.length; vi++) {
            var lns = cellLines[vi].slice(0, maxLines);
            for (var lli = 0; lli < lns.length; lli++) {
              pdf.text(lns[lli], x + cellPad, y + cellPad + (lli + 0.7) * lineH);
            }
            x += colW[vi];
          }

          y += actualRowH;
          rowAlt++;
        }

        drawFooter();

        var now = new Date();
        var ts = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0') + '_' +
          String(now.getHours()).padStart(2, '0') + '-' +
          String(now.getMinutes()).padStart(2, '0');

        pdf.save('EWU_Advising_Courses_' + ts + '.pdf');
        Toast.show('Advising PDF exported successfully (' + visibleData.length + ' courses)', 'success', 3000);
      } catch (err) {
        console.error('Advising PDF Export Error:', err);
        Toast.show('Failed to export PDF: ' + err.message, 'error', 3000);
      }
    },

    _addSelectedCourse: function (code, sec, cr, tm, rm) {
      if (!code) return;
      try {
        var activeRow = document.querySelector('tr[data-search*="' + code.toLowerCase() + '"]');
        if (window.angular && activeRow) {
          var scope = window.angular.element(activeRow).scope();
          if (scope && typeof scope.AddFlowChartSubject === 'function' && scope.sc && scope.sc.SectionId) {
            scope.AddFlowChartSubject(scope.sc.SectionId, 0);
            scope.$apply();
            Toast.show('Added ' + code + ' to selected courses', 'success', 2000);
            return;
          }
        }
      } catch (_) {}

      var selectedTable = safeQuery('.selected-courses-table tbody') || safeQuery('.selected-courses-panel tbody') || safeQuery('.col-md-5 table tbody') || safeQuery('.col-sm-6.col-lg-5 table tbody');
      if (!selectedTable) return;

      var existingRows = selectedTable.querySelectorAll('tr');
      for (var i = 0; i < existingRows.length; i++) {
        var firstTd = existingRows[i].querySelector('td');
        if (firstTd && firstTd.textContent.trim().indexOf(code) !== -1) {
          Toast.show(code + ' is already selected', 'info', 2000);
          return;
        }
      }

      var self = this;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><strong>' + escapeHTML(code) + '</strong></td>' +
                     '<td>' + escapeHTML(sec) + '</td>' +
                     '<td>' + escapeHTML(cr) + '</td>' +
                     '<td>' + escapeHTML(tm) + '</td>' +
                     '<td>' + escapeHTML(rm) + '</td>' +
                     '<td><button type="button" class="btn btn-danger btn-xs ewu-remove-course-btn" title="Drop"><i class="fa fa-trash"></i></button></td>';

      var lastRow = selectedTable.querySelector('tr:last-child');
      if (lastRow && (lastRow.textContent.indexOf('Credits taken') !== -1 || lastRow.textContent.indexOf('total') !== -1)) {
        selectedTable.insertBefore(tr, lastRow);
      } else {
        selectedTable.appendChild(tr);
      }

      var delBtn = tr.querySelector('.ewu-remove-course-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          tr.remove();
          self._recalcTotalCredits();
          Toast.show('Removed ' + code, 'info', 2000);
        });
      }

      self._recalcTotalCredits();
      Toast.show('Added ' + code + ' (Sec ' + sec + ') to selected courses', 'success', 2500);
    },

    _recalcTotalCredits: function () {
      var selectedTable = safeQuery('.selected-courses-table tbody') || safeQuery('.selected-courses-panel tbody') || safeQuery('.col-md-5 table tbody') || safeQuery('.col-sm-6.col-lg-5 table tbody');
      if (!selectedTable) return;
      var rows = selectedTable.querySelectorAll('tr');
      var total = 0;
      var totalRowTd = null;

      for (var i = 0; i < rows.length; i++) {
        var tds = rows[i].querySelectorAll('td');
        if (tds.length >= 3) {
          if (tds[0].textContent.indexOf('Credits taken') !== -1) {
            totalRowTd = tds[tds.length - 1] || tds[2];
          } else {
            var val = parseFloat(tds[2].textContent.trim());
            if (!isNaN(val)) total += val;
          }
        }
      }

      if (totalRowTd) {
        totalRowTd.innerHTML = '<strong>' + total + '</strong>';
      }
    },

    reset: function () {
      this._apiData = [];
      this._apiMapBySectionId = {};
      this._apiMapByKey = {};
      this._hooksInstalled = false;
      this._pageHookListener = false;
      this._showAvailable = false;
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      if (this._searchTimer) { clearTimeout(this._searchTimer); this._searchTimer = null; }
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      var ctrl = safeQuery('#ewu-adv-controls');
      if (ctrl) ctrl.remove();
      var pdfBtn = safeQuery('#ewu-adv-export-pdf-btn');
      if (pdfBtn) pdfBtn.remove();
      if (topPdfBtn) topPdfBtn.remove();
    }
  };


  /* ===========================================================
     ADVISING OFFLINE ORCHESTRATOR MODULE
     =========================================================== */

  var AdvisingOfflineModule = {
    _initialized: false,

    init: function (settings) {
      if (this._initialized) return;
      if (!settings || !settings.enabled || (settings.modules && settings.modules.advisingOffline === false)) return;
      var self = this;

      var btnGroup = safeQuery('.form-group') || safeQuery('center .form-group');
      if (!btnGroup) return;

      var existingRow = safeQuery('#ewu-adv-offline-row');
      if (existingRow) existingRow.remove();

      var showPlanner = !settings.modules || settings.modules.advisingOfflinePlanner !== false;
      var showRecommended = !settings.modules || settings.modules.advisingOfflineRecommended !== false;

      if (!showPlanner && !showRecommended) return;

      var row = document.createElement('div');
      row.id = 'ewu-adv-offline-row';
      row.className = 'ewu-adv-offline-row';

      var buttonsHtml = '';
      if (showPlanner) {
        buttonsHtml +=
          '<button type="button" id="ewu-btn-course-planner" class="ewu-adv-offline-btn-modern ewu-adv-btn-planner">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
            '<span>Course Planner</span>' +
          '</button>';
      }
      if (showRecommended) {
        buttonsHtml +=
          '<button type="button" id="ewu-btn-recommended-course" class="ewu-adv-offline-btn-modern ewu-adv-btn-recommended">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>' +
            '<span>Recommended Course</span>' +
          '</button>';
      }

      row.innerHTML = buttonsHtml;

      // Place as a distinct row below the existing 3 buttons
      if (btnGroup.nextSibling) {
        btnGroup.parentNode.insertBefore(row, btnGroup.nextSibling);
      } else {
        btnGroup.parentNode.appendChild(row);
      }

      var cpBtn = safeQuery('#ewu-btn-course-planner');
      if (cpBtn) {
        cpBtn.addEventListener('click', function (e) {
          e.preventDefault();
          RecommendedCourseModule.hideView();
          CoursePlannerModule.show();
        });
      }

      var rcBtn = safeQuery('#ewu-btn-recommended-course');
      if (rcBtn) {
        rcBtn.addEventListener('click', function (e) {
          e.preventDefault();
          CoursePlannerModule.hideView();
          RecommendedCourseModule.show();
        });
      }

      this._initialized = true;
      log('Advising Offline Module initialized with custom button row.');
    },

    reset: function () {
      this._initialized = false;
      var row = safeQuery('#ewu-adv-offline-row');
      if (row) row.remove();
      RecommendedCourseModule.reset();
      CoursePlannerModule.reset();
    }
  };


  /* ===========================================================
     RECOMMENDED COURSE MODULE
     =========================================================== */

  var RecommendedCourseModule = {
    _active: false,
    _targetContainer: null,
    _coursesData: [],
    _filteredCourses: [],
    _searchTerm: '',
    _selectedCourseCode: 'ALL',
    _availableOnly: false,
    _sortBy: 'default',
    _autoRefreshTimer: null,
    _autoRefreshInterval: 10,
    _autoRefreshEnabled: false,

    _mountView: function () {
      var container = safeQuery('div[ng-controller="AdvisingStudentOfflineController"]') || safeQuery('.common-container');
      if (!container) return null;
      this._targetContainer = container;

      // Non-destructive hide: preserve original DOM and all event listeners
      var children = container.children;
      for (var i = 0; i < children.length; i++) {
        if (!children[i].classList.contains('ewu-feature-view-container')) {
          if (!children[i].hasAttribute('data-ewu-orig-disp')) {
            children[i].setAttribute('data-ewu-orig-disp', children[i].style.display || '');
          }
          children[i].style.display = 'none';
        }
      }

      var existing = container.querySelector('.ewu-feature-view-container');
      if (existing) existing.remove();

      var view = document.createElement('div');
      view.className = 'ewu-feature-view-container';
      container.appendChild(view);
      return view;
    },

    show: function () {
      if (this._active) return;
      this._active = true;

      var view = this._mountView();
      if (!view) {
        Toast.show('Advising content container not found.', 'error');
        this._active = false;
        return;
      }

      this._renderInitialLanding();
    },

    _renderInitialLanding: function () {
      var self = this;
      var view = this._mountView();
      if (!view) return;

      view.innerHTML =
        '<div class="ewu-landing-card">' +
          '<div class="ewu-landing-header">' +
            '<h2 class="ewu-landing-title">Recommended Course</h2>' +
            '<p class="ewu-landing-subtitle">Browse, search, and export official offered courses for this semester.</p>' +
          '</div>' +
          '<div class="ewu-landing-options">' +
            '<div class="ewu-option-card" id="ewu-rc-btn-fetch">' +
              '<div class="ewu-option-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg></div>' +
              '<div class="ewu-option-title">Fetch / Load Courses</div>' +
              '<div class="ewu-option-desc">Load real-time routine dataset directly from portal API.</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align: center;">' +
            '<button type="button" class="ewu-btn-modern ewu-btn-modern-ghost" id="ewu-rc-btn-back" style="min-width:140px;">' +
              '<span>&larr; Back to Advising</span>' +
            '</button>' +
          '</div>' +
        '</div>';

      safeQuery('#ewu-rc-btn-fetch').addEventListener('click', function () {
        self._fetchCoursesData();
      });

      safeQuery('#ewu-rc-btn-back').addEventListener('click', function () {
        self.hideView();
      });
    },

    _fetchCoursesData: async function () {
      var self = this;
      Toast.show('Fetching course data from EWU portal...', 'info', 2000);
      try {
        var resp = await fetch('https://portal.ewubd.edu/api/Advising/GetAllRoutine', {
          method: 'GET',
          headers: { 'Accept': 'application/json, text/plain, */*' },
          credentials: 'include'
        });
        if (!resp.ok) throw new Error('HTTP error ' + resp.status);
        var data = await resp.json();
        if (!Array.isArray(data)) throw new Error('Invalid response format');

        self._coursesData = data;
        Toast.show('Successfully loaded ' + data.length + ' courses.', 'success', 2500);
        self._renderTableView();
      } catch (err) {
        log('Error fetching courses:', err);
        Toast.show('Failed to fetch courses: ' + err.message, 'error', 4000);
      }
    },

    _formatDayName: function (slot) {
      if (!slot) return 'TBA';
      var daysMap = { 'A': 'Sat', 'S': 'Sun', 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'F': 'Fri' };
      var parts = slot.trim().split(/\s+/);
      var dayStr = parts[0] || '';
      var matchedDays = [];
      for (var i = 0; i < dayStr.length; i++) {
        var ch = dayStr[i].toUpperCase();
        if (daysMap[ch] && matchedDays.indexOf(daysMap[ch]) === -1) matchedDays.push(daysMap[ch]);
      }
      return matchedDays.length ? matchedDays.join(', ') : dayStr;
    },

    _formatTimeRange: function (slot) {
      if (!slot) return 'TBA';
      var idx = slot.search(/\d/);
      if (idx !== -1) return slot.substring(idx).trim();
      return slot;
    },

    _renderTableView: function () {
      var self = this;
      var view = this._mountView();
      if (!view) return;

      var distinctCodes = [];
      var codeCounts = {};
      for (var i = 0; i < this._coursesData.length; i++) {
        var cc = safeText(this._coursesData[i].CourseCode);
        if (cc) {
          if (!codeCounts[cc]) {
            codeCounts[cc] = 0;
            distinctCodes.push(cc);
          }
          codeCounts[cc]++;
        }
      }
      distinctCodes.sort();

      var codeOptionsHtml = '<option value="ALL">All Courses (' + this._coursesData.length + ')</option>';
      for (var j = 0; j < distinctCodes.length; j++) {
        var cCode = distinctCodes[j];
        codeOptionsHtml += '<option value="' + escapeHTML(cCode) + '">' + escapeHTML(cCode) + ' (' + codeCounts[cCode] + ')</option>';
      }

      view.innerHTML =
        '<div class="ewu-rc-container">' +
          '<div class="ewu-rc-topbar">' +
            '<div class="ewu-rc-title-area">' +
              '<h3 class="ewu-rc-title">Recommended Courses</h3>' +
              '<span class="ewu-badge ewu-badge-course" id="ewu-rc-count-badge">' + this._coursesData.length + ' courses</span>' +
            '</div>' +
            '<div class="ewu-rc-controls">' +
              '<div class="ewu-rc-search-wrap">' +
                '<input type="text" id="ewu-rc-search" class="ewu-rc-search-input" placeholder="Search course, faculty, room... (Ctrl+K)" autocomplete="off">' +
                '<span id="ewu-rc-search-clear" class="ewu-rc-search-clear">&times;</span>' +
              '</div>' +
              '<select id="ewu-rc-course-filter" class="ewu-rc-select">' + codeOptionsHtml + '</select>' +
              '<select id="ewu-rc-sort-select" class="ewu-rc-select">' +
                '<option value="default">Default Order</option>' +
                '<option value="fac_asc">Faculty (A &rarr; Z)</option>' +
                '<option value="fac_desc">Faculty (Z &rarr; A)</option>' +
                '<option value="seats_desc">Available Seats</option>' +
              '</select>' +
              '<label class="ewu-toggle-wrap" id="ewu-rc-avail-toggle">' +
                '<span class="ewu-toggle-switch"></span>' +
                '<span>Available Only</span>' +
              '</label>' +
              '<button type="button" class="btn btn-primary ewu-oc-export-pdf-btn" id="ewu-rc-export-pdf" title="Export PDF"><span class="fa fa-file-pdf"></span></button>' +
              '<button type="button" class="ewu-btn-modern ewu-btn-modern-ghost" id="ewu-rc-btn-back-top">' +
                '<span>&larr; Back</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="ewu-rc-table-wrapper">' +
            '<table class="ewu-rc-table">' +
              '<thead>' +
                '<tr>' +
                  '<th>Course</th>' +
                  '<th>Section</th>' +
                  '<th>Credit</th>' +
                  '<th>Faculty</th>' +
                  '<th>Seat(C/T)</th>' +
                  '<th>Left</th>' +
                  '<th>Day</th>' +
                  '<th>Time</th>' +
                  '<th>Room</th>' +
                  '<th>Prereq</th>' +
                '</tr>' +
              '</thead>' +
              '<tbody id="ewu-rc-tbody"></tbody>' +
            '</table>' +
          '</div>' +
        '</div>';

      var searchInput = safeQuery('#ewu-rc-search');
      var clearBtn = safeQuery('#ewu-rc-search-clear');
      var courseFilter = safeQuery('#ewu-rc-course-filter');
      var sortSelect = safeQuery('#ewu-rc-sort-select');
      var availToggle = safeQuery('#ewu-rc-avail-toggle');
      var pdfBtn = safeQuery('#ewu-rc-export-pdf');
      var backBtn = safeQuery('#ewu-rc-btn-back-top');

      if (searchInput) {
        searchInput.addEventListener('input', function () {
          self._searchTerm = this.value.trim().toLowerCase();
          if (clearBtn) clearBtn.classList.toggle('visible', self._searchTerm.length > 0);
          self._applyFiltersAndRender();
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          if (searchInput) searchInput.value = '';
          self._searchTerm = '';
          clearBtn.classList.remove('visible');
          self._applyFiltersAndRender();
        });
      }
      if (courseFilter) {
        courseFilter.addEventListener('change', function () {
          self._selectedCourseCode = this.value;
          self._applyFiltersAndRender();
        });
      }
      if (sortSelect) {
        sortSelect.addEventListener('change', function () {
          self._sortBy = this.value;
          self._applyFiltersAndRender();
        });
      }
      if (availToggle) {
        availToggle.addEventListener('click', function () {
          self._availableOnly = !self._availableOnly;
          availToggle.classList.toggle('active', self._availableOnly);
          Toast.show(self._availableOnly ? 'Showing available courses only' : 'Showing all courses', 'info', 1500);
          self._applyFiltersAndRender();
        });
      }
      if (pdfBtn) {
        pdfBtn.addEventListener('click', function () {
          self._exportPDF();
        });
      }
      if (backBtn) {
        backBtn.addEventListener('click', function () {
          self.hideView();
        });
      }

      this._applyFiltersAndRender();
    },

    _applyFiltersAndRender: function () {
      var self = this;
      var list = this._coursesData.slice();

      if (this._selectedCourseCode !== 'ALL') {
        list = list.filter(function (c) {
          return safeText(c.CourseCode) === self._selectedCourseCode;
        });
      }

      if (this._availableOnly) {
        list = list.filter(function (c) {
          var cap = parseInt(c.SeatCapacity, 10) || 0;
          var taken = parseInt(c.SeatTaken, 10) || 0;
          return (cap - taken) > 0;
        });
      }

      if (this._searchTerm) {
        var term = this._searchTerm;
        list = list.filter(function (c) {
          var cc = safeText(c.CourseCode).toLowerCase();
          var fn = safeText(c.ShortName || c.FacultyName).toLowerCase();
          var rm = safeText(c.RoomName).toLowerCase();
          var sec = safeText(c.SectionName).toLowerCase();
          var ts = safeText(c.TimeSlotName).toLowerCase();
          var pre = safeText(c.PrerequisiteCourseCodes).toLowerCase();
          return cc.indexOf(term) !== -1 || fn.indexOf(term) !== -1 || rm.indexOf(term) !== -1 || sec.indexOf(term) !== -1 || ts.indexOf(term) !== -1 || pre.indexOf(term) !== -1;
        });
      }

      if (this._sortBy === 'fac_asc') {
        list.sort(function (a, b) { return safeText(a.ShortName).localeCompare(safeText(b.ShortName)); });
      } else if (this._sortBy === 'fac_desc') {
        list.sort(function (a, b) { return safeText(b.ShortName).localeCompare(safeText(a.ShortName)); });
      } else if (this._sortBy === 'seats_desc') {
        list.sort(function (a, b) {
          var leftA = (parseInt(a.SeatCapacity, 10) || 0) - (parseInt(a.SeatTaken, 10) || 0);
          var leftB = (parseInt(b.SeatCapacity, 10) || 0) - (parseInt(b.SeatTaken, 10) || 0);
          return leftB - leftA;
        });
      }

      this._filteredCourses = list;

      var badge = safeQuery('#ewu-rc-count-badge');
      if (badge) badge.textContent = list.length + ' courses';

      var tbody = safeQuery('#ewu-rc-tbody');
      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:24px; color:#9ca3af;">No courses match your filter criteria.</td></tr>';
        return;
      }

      var rowsHtml = '';
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var cap = parseInt(item.SeatCapacity, 10) || 0;
        var taken = parseInt(item.SeatTaken, 10) || 0;
        var left = Math.max(0, cap - taken);
        var credit = parseFloat(item.CreditHour || item.creditHour) || 3.0;
        var prereq = safeText(item.PrerequisiteCourseCodes || item.prerequisiteCourseCodes || '-');
        var faculty = safeText(item.ShortName || item.FacultyName || '-');

        var seatBadgeClass = 'ewu-badge-green';
        if (left === 0) seatBadgeClass = 'ewu-badge-red';
        else if (left <= 5 || (cap > 0 && (left / cap) <= 0.2)) seatBadgeClass = 'ewu-badge-amber';

        var dayFormatted = this._formatDayName(item.TimeSlotName);
        var timeFormatted = this._formatTimeRange(item.TimeSlotName);

        rowsHtml +=
          '<tr>' +
            '<td><span class="ewu-badge ewu-badge-course">' + escapeHTML(safeText(item.CourseCode)) + '</span></td>' +
            '<td><span class="ewu-badge ewu-badge-sec">' + escapeHTML(safeText(item.SectionName)) + '</span></td>' +
            '<td><span class="ewu-badge ewu-badge-sec">' + credit.toFixed(2) + '</span></td>' +
            '<td title="' + escapeHTML(faculty) + '">' + escapeHTML(faculty) + '</td>' +
            '<td>' + cap + ' / ' + taken + '</td>' +
            '<td><span class="ewu-badge ' + seatBadgeClass + '">' + left + '</span></td>' +
            '<td>' + escapeHTML(dayFormatted) + '</td>' +
            '<td>' + escapeHTML(timeFormatted) + '</td>' +
            '<td>' + escapeHTML(safeText(item.RoomName || '-')) + '</td>' +
            '<td><span style="font-size:12px; color:' + (prereq === '-' ? '#64748b' : '#38bdf8') + '; font-weight:500;">' + escapeHTML(prereq) + '</span></td>' +
          '</tr>';
      }

      tbody.innerHTML = rowsHtml;
    },

    _exportPDF: async function () {
      var visibleData = this._filteredCourses;
      if (!visibleData.length) {
        Toast.show('No course data available to export', 'warning');
        return;
      }

      Toast.show('Generating PDF...', 'info', 2000);

      try {
        var JsPDFCtor = null;
        if (window.jspdf && typeof window.jspdf.jsPDF === 'function') JsPDFCtor = window.jspdf.jsPDF;
        if (!JsPDFCtor) { Toast.show('PDF library not available', 'error'); return; }

        // A4 landscape (297 × 210 mm)
        var pdf = new JsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var pw = pdf.internal.pageSize.getWidth();
        var ph = pdf.internal.pageSize.getHeight();
        var margin  = 10;
        var usableW = pw - margin * 2;   // ~277 mm
        var headerH = 9;
        var cellPad = 1.8;
        var baseRowH = 7;
        var lineH    = 3.8;

        // 10 columns: Course | Section | Credit | Faculty | Seat(C/T) | Left | Day | Time | Room | Prereq
        var colWRaw = [24, 15, 15, 25, 20, 14, 26, 36, 48, 22];
        var totalRaw = 0;
        for (var ci = 0; ci < colWRaw.length; ci++) totalRaw += colWRaw[ci];
        var sf = usableW / totalRaw;
        var colW = colWRaw.map(function (w) { return w * sf; });

        var headers = ['Course', 'Section', 'Credit', 'Faculty', 'Seat(C/T)', 'Left', 'Day', 'Time', 'Room', 'Prereq'];
        var pageNum = 1;

        function drawHeader(yPos) {
          var xp = margin;
          pdf.setFillColor(26, 115, 232);
          pdf.rect(xp, yPos, usableW, headerH, 'F');
          pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
          xp = margin;
          for (var hi = 0; hi < headers.length; hi++) {
            pdf.text(headers[hi], xp + cellPad, yPos + headerH / 2 + 1.5, { maxWidth: colW[hi] - cellPad * 2 });
            xp += colW[hi];
          }
          return yPos + headerH;
        }

        function drawFooter() {
          pdf.setFontSize(7); pdf.setTextColor(160, 160, 160); pdf.setFont('helvetica', 'normal');
          pdf.text('Page ' + pageNum + '  |  EWU Recommended Courses Report  |  Portal Helper v' + CONFIG.VERSION, pw / 2, ph - 4, { align: 'center' });
        }

        var y = drawHeader(margin);
        var rowAlt = 0;

        for (var ri = 0; ri < visibleData.length; ri++) {
          var item = visibleData[ri];
          var cap = parseInt(item.SeatCapacity, 10) || 0;
          var taken = parseInt(item.SeatTaken, 10) || 0;
          var left = Math.max(0, cap - taken);
          var credit = (parseFloat(item.CreditHour || item.creditHour) || 3.0).toFixed(2);
          var prereq = safeText(item.PrerequisiteCourseCodes || item.prerequisiteCourseCodes || '-');
          var faculty = safeText(item.ShortName || item.FacultyName || '-');

          var vals = [
            safeText(item.CourseCode),
            safeText(item.SectionName),
            credit,
            faculty,
            cap + ' / ' + taken,
            String(left),
            this._formatDayName(item.TimeSlotName),
            this._formatTimeRange(item.TimeSlotName),
            safeText(item.RoomName || '-'),
            prereq
          ];

          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
          var cellLines = vals.map(function (v, idx) {
            return pdf.splitTextToSize((v || '').trim(), colW[idx] - cellPad * 2);
          });
          var maxLines = Math.min(3, cellLines.reduce(function (mx, ls) { return Math.max(mx, ls.length); }, 1));
          var actualRowH = Math.max(baseRowH, maxLines * lineH + 2);

          if (y + actualRowH > ph - 10) {
            drawFooter();
            pdf.addPage();
            pageNum++;
            y = drawHeader(margin);
            rowAlt = 0;
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
          }

          if (rowAlt % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y, usableW, actualRowH, 'F');
          }
          pdf.setDrawColor(220, 225, 235);
          pdf.rect(margin, y, usableW, actualRowH, 'S');

          var x = margin;
          pdf.setTextColor(30, 41, 59);
          for (var vi = 0; vi < vals.length; vi++) {
            var lns = cellLines[vi].slice(0, maxLines);
            for (var lli = 0; lli < lns.length; lli++) {
              pdf.text(lns[lli], x + cellPad, y + cellPad + (lli + 0.7) * lineH);
            }
            x += colW[vi];
          }

          y += actualRowH;
          rowAlt++;
        }

        drawFooter();

        var now = new Date();
        var ts = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0') + '_' +
          String(now.getHours()).padStart(2, '0') + '-' +
          String(now.getMinutes()).padStart(2, '0');
        pdf.save('EWU_Recommended_Courses_' + ts + '.pdf');
        Toast.show('PDF exported successfully (' + visibleData.length + ' courses)', 'success');
      } catch (err) {
        log('PDF export error:', err);
        Toast.show('PDF export failed: ' + (err.message || err), 'error');
      }
    },

    hideView: function () {
      if (!this._active) return;
      this._active = false;
      if (this._autoRefreshTimer) {
        clearInterval(this._autoRefreshTimer);
        this._autoRefreshTimer = null;
      }
      if (this._targetContainer) {
        var view = this._targetContainer.querySelector('.ewu-feature-view-container');
        if (view) view.remove();
        var children = this._targetContainer.children;
        for (var i = 0; i < children.length; i++) {
          if (!children[i].classList.contains('ewu-feature-view-container')) {
            var orig = children[i].getAttribute('data-ewu-orig-disp');
            children[i].style.display = orig !== null ? orig : '';
            children[i].removeAttribute('data-ewu-orig-disp');
          }
        }
      }
      log('Recommended Course view closed.');
    },

    reset: function () {
      this.hideView();
    }
  };


  /* ===========================================================
     COURSE PLANNER MODULE
     =========================================================== */

  var CoursePlannerModule = {
    _active: false,
    _targetContainer: null,
    _rawRoutineData: [],
    _groupedCourses: [],
    _combinations: {},
    _activeComboId: 'combo_1',
    _nextComboIndex: 2,
    _searchTerm: '',

    _mountView: function () {
      var container = safeQuery('div[ng-controller="AdvisingStudentOfflineController"]') || safeQuery('.common-container');
      if (!container) return null;
      this._targetContainer = container;

      // Non-destructive hide: preserve original DOM and all event listeners
      var children = container.children;
      for (var i = 0; i < children.length; i++) {
        if (!children[i].classList.contains('ewu-feature-view-container')) {
          if (!children[i].hasAttribute('data-ewu-orig-disp')) {
            children[i].setAttribute('data-ewu-orig-disp', children[i].style.display || '');
          }
          children[i].style.display = 'none';
        }
      }

      var existing = container.querySelector('.ewu-feature-view-container');
      if (existing) existing.remove();

      var view = document.createElement('div');
      view.className = 'ewu-feature-view-container';
      container.appendChild(view);
      return view;
    },

    show: function () {
      if (this._active) return;
      this._active = true;

      var view = this._mountView();
      if (!view) {
        Toast.show('Advising content container not found.', 'error');
        this._active = false;
        return;
      }

      this._renderLanding();
    },

    _renderLanding: function () {
      var self = this;
      var view = this._mountView();
      if (!view) return;

      view.innerHTML =
        '<div class="ewu-landing-card">' +
          '<div class="ewu-landing-header">' +
            '<h2 class="ewu-landing-title">EWU Course Planner</h2>' +
            '<p class="ewu-landing-subtitle">Build, customize, and analyze conflict-free schedule combinations for your advising.</p>' +
          '</div>' +
          '<div class="ewu-landing-options">' +
            '<div class="ewu-option-card" id="ewu-cp-btn-fetch">' +
              '<div class="ewu-option-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg></div>' +
              '<div class="ewu-option-title">Fetch Courses from Portal</div>' +
              '<div class="ewu-option-desc">Automatically fetch current semester routine data via portal API.</div>' +
            '</div>' +
            '<label class="ewu-option-card" style="margin:0;">' +
              '<input type="file" id="ewu-cp-file-json" accept=".json" style="display:none;">' +
              '<div class="ewu-option-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>' +
              '<div class="ewu-option-title">Upload Custom JSON</div>' +
              '<div class="ewu-option-desc">Upload a pre-saved routine JSON file from your computer.</div>' +
            '</label>' +
            '<label class="ewu-option-card" style="margin:0;">' +
              '<input type="file" id="ewu-cp-file-pdf" accept=".pdf" style="display:none;">' +
              '<div class="ewu-option-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
              '<div class="ewu-option-title">Upload Routine PDF</div>' +
              '<div class="ewu-option-desc">Parse course routine tables directly from a PDF file locally.</div>' +
            '</label>' +
          '</div>' +
          '<div style="text-align: center;">' +
            '<button type="button" class="ewu-btn-modern ewu-btn-modern-ghost" id="ewu-cp-btn-back" style="min-width:140px;">' +
              '<span>&larr; Back to Advising</span>' +
            '</button>' +
          '</div>' +
        '</div>';

      safeQuery('#ewu-cp-btn-fetch').addEventListener('click', function () {
        self._fetchCoursesData();
      });

      safeQuery('#ewu-cp-file-json').addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          self._parseJSONFile(e.target.files[0]);
        }
      });

      safeQuery('#ewu-cp-file-pdf').addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          self._parsePDFFile(e.target.files[0]);
        }
      });

      safeQuery('#ewu-cp-btn-back').addEventListener('click', function () {
        self.hideView();
      });
    },

    _fetchCoursesData: async function () {
      var self = this;
      Toast.show('Fetching routine data from EWU portal...', 'info', 2000);
      try {
        var resp = await fetch('https://portal.ewubd.edu/api/Advising/GetAllRoutine', {
          method: 'GET',
          headers: { 'Accept': 'application/json, text/plain, */*' },
          credentials: 'include'
        });
        if (!resp.ok) throw new Error('HTTP error ' + resp.status);
        var data = await resp.json();
        if (!Array.isArray(data)) throw new Error('Invalid JSON structure');

        self._processRawData(data);
      } catch (err) {
        log('Course Planner fetch error:', err);
        Toast.show('Fetch failed: ' + err.message, 'error');
      }
    },

    _parseJSONFile: function (file) {
      var self = this;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          if (!Array.isArray(data)) throw new Error('JSON content is not a valid routine array.');
          Toast.show('JSON routine loaded successfully.', 'success', 2500);
          self._processRawData(data);
        } catch (err) {
          Toast.show('Failed to parse JSON file: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    },

    _parsePDFFile: async function (file) {
      var self = this;
      Toast.show('Parsing PDF routine file...', 'info', 3000);

      if (typeof window.pdfjsLib === 'undefined') {
        Toast.show('PDF.js library unavailable.', 'error');
        return;
      }

      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
        var arrayBuffer = await file.arrayBuffer();
        var pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        var extractedLines = [];
        for (var i = 1; i <= pdf.numPages; i++) {
          var page = await pdf.getPage(i);
          var textContent = await page.getTextContent();
          
          var lineMap = {};
          for (var j = 0; j < textContent.items.length; j++) {
            var item = textContent.items[j];
            var y = Math.round(item.transform[5]);
            if (!lineMap[y]) lineMap[y] = [];
            lineMap[y].push({ x: item.transform[4], str: item.str });
          }

          var sortedYs = Object.keys(lineMap).sort(function (a, b) { return b - a; });
          for (var k = 0; k < sortedYs.length; k++) {
            var items = lineMap[sortedYs[k]];
            items.sort(function (a, b) { return a.x - b.x; });
            var lineStr = items.map(function (it) { return it.str; }).join('   ').trim();
            if (lineStr) extractedLines.push(lineStr);
          }
        }

        var courses = [];
        for (var l = 0; l < extractedLines.length; l++) {
          var line = extractedLines[l].trim();
          if (!line) continue;
          if (/^(Course|Code|Student ID|EWU|Generated|Department|Semester|Updated|EAST WEST)/i.test(line)) continue;

          var m = line.match(/^([A-Z]{2,4}\s*\d{3,4}(?:\s*Lab)?)\s+(\d{1,3})\s+(.+)$/i);
          if (!m) continue;

          var rawCode = m[1].trim();
          var section = m[2].trim();
          var rest = m[3].trim();

          var timeMatch = rest.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (!timeMatch) continue;

          var timeStr = timeMatch[1];
          var timeIdx = rest.indexOf(timeStr);
          var beforeTime = rest.substring(0, timeIdx).trim();
          var afterTime = rest.substring(timeIdx + timeStr.length).trim();
          var room = afterTime || 'TBA';

          var daysRegex = /((?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]*)+|[A-Z]{1,3})\s*$/i;
          var daysMatch = beforeTime.match(daysRegex);

          var daysStr = '';
          var metaBeforeDays = beforeTime;
          if (daysMatch) {
            daysStr = daysMatch[1].trim();
            metaBeforeDays = beforeTime.substring(0, beforeTime.length - daysMatch[0].length).trim();
          }

          var faculty = 'TBA';
          var tokens = metaBeforeDays.split(/\s+/).filter(Boolean);
          if (tokens.length > 0) {
            if (!/^[\d\/\-]+$/.test(tokens[0])) {
              faculty = tokens[0];
            }
          }

          courses.push({
            CourseCode: rawCode,
            SectionName: section,
            ShortName: faculty === '-' || faculty === 'N/A' ? 'TBA' : faculty,
            TimeSlotName: daysStr ? (daysStr + ' ' + timeStr) : timeStr,
            RoomName: room
          });
        }

        if (!courses.length) throw new Error('Could not detect valid course sections in PDF.');
        Toast.show('Parsed ' + courses.length + ' course entries from PDF file.', 'success', 2500);
        self._processRawData(courses);
      } catch (err) {
        log('PDF parse error:', err);
        Toast.show('PDF Parsing Error: ' + err.message, 'error', 4000);
      }
    },

    _normalizeDays: function (dayStr) {
      if (!dayStr) return [];
      dayStr = dayStr.trim();
      var dayCodeMap = { 'A': 'Sat', 'S': 'Sun', 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'F': 'Fri' };
      var fullDayMap = {
        'SATURDAY': 'Sat', 'SUNDAY': 'Sun', 'MONDAY': 'Mon', 'TUESDAY': 'Tue', 'WEDNESDAY': 'Wed', 'THURSDAY': 'Thu', 'FRIDAY': 'Fri',
        'SAT': 'Sat', 'SUN': 'Sun', 'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed', 'THU': 'Thu', 'FRI': 'Fri'
      };

      if (/,/.test(dayStr) || /\s+/.test(dayStr)) {
        var parts = dayStr.split(/[\s,]+/).map(function (p) { return p.toUpperCase().trim(); }).filter(Boolean);
        var result = [];
        for (var p = 0; p < parts.length; p++) {
          var word = parts[p];
          if (fullDayMap[word] && result.indexOf(fullDayMap[word]) === -1) result.push(fullDayMap[word]);
          else if (dayCodeMap[word] && result.indexOf(dayCodeMap[word]) === -1) result.push(dayCodeMap[word]);
        }
        if (result.length) return result;
      }

      var upper = dayStr.toUpperCase();
      if (fullDayMap[upper]) return [fullDayMap[upper]];

      var res = [];
      for (var i = 0; i < upper.length; i++) {
        var ch = upper[i];
        if (dayCodeMap[ch] && res.indexOf(dayCodeMap[ch]) === -1) res.push(dayCodeMap[ch]);
      }
      return res.length ? res : [dayStr];
    },

    _parseDaysTime: function (slot) {
      if (!slot) return { days: ['TBA'], timeStr: 'TBA' };
      var timeMatch = slot.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (timeMatch) {
        var idx = slot.indexOf(timeMatch[1]);
        var dayPart = slot.substring(0, idx).trim();
        return {
          days: this._normalizeDays(dayPart),
          timeStr: timeMatch[1].trim()
        };
      }
      return { days: ['TBA'], timeStr: slot.trim() };
    },

    _processRawData: function (rawList) {
      this._rawRoutineData = rawList;
      var groupsMap = {};
      var groupOrder = [];

      for (var i = 0; i < rawList.length; i++) {
        var item = rawList[i];
        var rawCode = safeText(item.CourseCode || item.courseCode).trim();
        var secName = safeText(item.SectionName || item.sectionName || item.section).trim();
        if (!rawCode || !secName) continue;

        var isLab = /\blab\b/i.test(rawCode) || rawCode.toUpperCase().endsWith('LAB');
        var baseCode = rawCode.replace(/\s*lab\b/gi, '').replace(/\s+/g, '').toUpperCase();
        var groupKey = baseCode + '_' + secName;

        var facName = safeText(item.ShortName || item.faculty || item.FacultyName || 'N/A').trim();
        if (facName === '-' || facName === 'N/A' || !facName || facName === 'TBA') facName = 'N/A';

        var rawTimeSlot = safeText(item.TimeSlotName || item.timeSlot || item.time).trim();
        var roomName = safeText(item.RoomName || item.room || '-').trim();
        var credit = parseFloat(item.CreditHour || item.creditHour) || (isLab ? 1.0 : 3.0);

        if (!groupsMap[groupKey]) {
          groupsMap[groupKey] = {
            id: 'course_' + groupKey,
            courseCode: baseCode,
            section: secName,
            faculties: [facName],
            creditHour: credit,
            rawTheoryEntries: [],
            rawLabEntries: []
          };
          groupOrder.push(groupKey);
        } else {
          if (facName !== 'N/A' && groupsMap[groupKey].faculties.indexOf(facName) === -1) {
            if (groupsMap[groupKey].faculties[0] === 'N/A') {
              groupsMap[groupKey].faculties = [facName];
            } else {
              groupsMap[groupKey].faculties.push(facName);
            }
          }
          if (credit > groupsMap[groupKey].creditHour) {
            groupsMap[groupKey].creditHour = credit;
          }
        }

        var entryObj = { rawTimeSlot: rawTimeSlot, room: roomName };
        if (isLab) {
          groupsMap[groupKey].rawLabEntries.push(entryObj);
        } else {
          groupsMap[groupKey].rawTheoryEntries.push(entryObj);
        }
      }

      var self = this;
      function mergeScheduleSlots(rawEntries, defaultType) {
        if (!rawEntries || !rawEntries.length) return [];
        var timeSlotGroups = {};
        var slotOrder = [];

        for (var e = 0; e < rawEntries.length; e++) {
          var raw = rawEntries[e];
          var parsed = self._parseDaysTime(raw.rawTimeSlot);
          var timeKey = parsed.timeStr;
          var room = raw.room || 'TBA';

          if (!timeSlotGroups[timeKey]) {
            timeSlotGroups[timeKey] = {
              days: parsed.days.slice(),
              timeStr: parsed.timeStr,
              rooms: [room],
              type: defaultType
            };
            slotOrder.push(timeKey);
          } else {
            for (var d = 0; d < parsed.days.length; d++) {
              if (timeSlotGroups[timeKey].days.indexOf(parsed.days[d]) === -1) {
                timeSlotGroups[timeKey].days.push(parsed.days[d]);
              }
            }
            if (room !== 'TBA' && timeSlotGroups[timeKey].rooms.indexOf(room) === -1) {
              timeSlotGroups[timeKey].rooms.push(room);
            }
          }
        }

        var result = [];
        for (var j = 0; j < slotOrder.length; j++) {
          var sg = timeSlotGroups[slotOrder[j]];
          result.push({
            type: sg.type,
            days: sg.days,
            timeStr: sg.timeStr,
            room: sg.rooms.join(', ')
          });
        }
        return result;
      }

      this._groupedCourses = [];
      for (var k = 0; k < groupOrder.length; k++) {
        var g = groupsMap[groupOrder[k]];
        var facultyStr = g.faculties.join(' / ');
        var theorySchedules = mergeScheduleSlots(g.rawTheoryEntries, 'theory');
        var labSchedules = mergeScheduleSlots(g.rawLabEntries, 'lab');
        var allSchedules = theorySchedules.concat(labSchedules);
        if (!allSchedules.length) {
          allSchedules = [{ type: 'tba', days: ['TBA'], timeStr: 'Schedule TBA', room: 'TBA' }];
        }

        this._groupedCourses.push({
          id: g.id,
          courseCode: g.courseCode,
          section: g.section,
          faculty: facultyStr,
          creditHour: g.creditHour,
          schedules: allSchedules,
          theorySchedules: theorySchedules,
          labSchedules: labSchedules
        });
      }

      this._combinations = {
        'combo_1': { id: 'combo_1', name: 'Combination 1', selectedIds: [] }
      };
      this._activeComboId = 'combo_1';
      this._nextComboIndex = 2;

      this._renderDashboard();
    },

    _renderDashboard: function () {
      var self = this;
      var view = this._mountView();
      if (!view) return;

      view.innerHTML =
        '<div class="ewu-cp-dashboard">' +
          '<div class="ewu-cp-header">' +
            '<div class="ewu-cp-brand">' +
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
              '<span>EWU Course Planner</span>' +
            '</div>' +
            '<div style="display:flex; gap:10px; align-items:center;">' +
              '<button type="button" class="ewu-btn-modern ewu-btn-modern-ghost" id="ewu-cp-btn-change-file">' +
                '<span>Change Source</span>' +
              '</button>' +
              '<button type="button" class="ewu-btn-modern ewu-btn-modern-ghost" id="ewu-cp-btn-back-dash">' +
                '<span>&larr; Back</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="ewu-cp-grid">' +
            '<!-- Left Panel: Catalog -->' +
            '<div class="ewu-cp-panel">' +
              '<div class="ewu-cp-panel-header">' +
                '<span class="ewu-cp-panel-title">Available Courses Catalog</span>' +
                '<span class="ewu-badge ewu-badge-sec" id="ewu-cp-catalog-count">' + this._groupedCourses.length + ' courses shown</span>' +
              '</div>' +
              '<div class="ewu-rc-search-wrap">' +
                '<input type="text" id="ewu-cp-search" class="ewu-rc-search-input" placeholder="Filter by course or faculty... (Ctrl+K)" autocomplete="off">' +
                '<span id="ewu-cp-search-clear" class="ewu-rc-search-clear">&times;</span>' +
              '</div>' +
              '<div class="ewu-cp-card-list" id="ewu-cp-catalog-list"></div>' +
            '</div>' +
            '<!-- Right Panel: Active Combination -->' +
            '<div class="ewu-cp-panel">' +
              '<div class="ewu-cp-panel-header">' +
                '<span class="ewu-cp-panel-title">My Course Combination</span>' +
                '<button type="button" class="ewu-btn-modern ewu-btn-modern-danger" id="ewu-cp-btn-delete-all" style="padding:4px 10px; font-size:12px;">Delete All</button>' +
              '</div>' +
              '<div class="ewu-cp-combo-bar" id="ewu-cp-combo-bar"></div>' +
              '<div class="ewu-cp-metrics-grid">' +
                '<div class="ewu-cp-metric-card"><div class="ewu-cp-metric-val" id="ewu-cp-metric-courses">0</div><div class="ewu-cp-metric-lbl">Courses</div></div>' +
                '<div class="ewu-cp-metric-card"><div class="ewu-cp-metric-val" id="ewu-cp-metric-theory">0</div><div class="ewu-cp-metric-lbl">Theory Hrs</div></div>' +
                '<div class="ewu-cp-metric-card"><div class="ewu-cp-metric-val" id="ewu-cp-metric-labs">0</div><div class="ewu-cp-metric-lbl">Labs</div></div>' +
                '<div class="ewu-cp-metric-card"><div class="ewu-cp-metric-val" id="ewu-cp-metric-credits">0.0</div><div class="ewu-cp-metric-lbl">Credits</div></div>' +
              '</div>' +
              '<div class="ewu-cp-card-list" id="ewu-cp-plan-list"></div>' +
              '<div style="display:flex; gap:10px; margin-top:8px;">' +
                '<button type="button" class="ewu-btn-modern ewu-btn-modern-primary" id="ewu-cp-btn-export-img" style="flex:1;">Save Combination as Image</button>' +
                '<button type="button" class="ewu-btn-modern ewu-btn-modern-ghost" id="ewu-cp-btn-export-all" style="flex:1;">Save All as Image</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      safeQuery('#ewu-cp-btn-change-file').addEventListener('click', function () {
        self._renderLanding();
      });

      safeQuery('#ewu-cp-btn-back-dash').addEventListener('click', function () {
        self.hideView();
      });

      safeQuery('#ewu-cp-btn-delete-all').addEventListener('click', function () {
        self._clearActivePlan();
      });

      safeQuery('#ewu-cp-btn-export-img').addEventListener('click', function () {
        self._exportActiveComboImage();
      });

      safeQuery('#ewu-cp-btn-export-all').addEventListener('click', function () {
        self._exportAllCombosImage();
      });

      var searchInput = safeQuery('#ewu-cp-search');
      var clearBtn = safeQuery('#ewu-cp-search-clear');
      var debounceTimer = null;
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          var val = this.value.trim().toLowerCase();
          if (clearBtn) clearBtn.classList.toggle('visible', val.length > 0);
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function () {
            self._searchTerm = val;
            self._renderCatalog();
          }, 80);
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          if (searchInput) searchInput.value = '';
          self._searchTerm = '';
          clearBtn.classList.remove('visible');
          self._renderCatalog();
        });
      }

      var catalogListEl = safeQuery('#ewu-cp-catalog-list');
      if (catalogListEl) {
        catalogListEl.addEventListener('click', function (e) {
          var btn = e.target.closest('.ewu-cp-btn-add-sec');
          if (btn) {
            var sid = btn.getAttribute('data-id');
            if (sid) self._addCourseToPlan(sid);
          }
        });
      }

      var planListEl = safeQuery('#ewu-cp-plan-list');
      if (planListEl) {
        planListEl.addEventListener('click', function (e) {
          var btn = e.target.closest('.ewu-cp-btn-remove-sec');
          if (btn) {
            var sid = btn.getAttribute('data-id');
            if (sid) self._removeCourseFromPlan(sid);
          }
        });
      }

      this._renderComboBar();
      this._renderCatalog();
      this._renderPlanView();
    },

    _renderComboBar: function () {
      var self = this;
      var bar = safeQuery('#ewu-cp-combo-bar');
      if (!bar) return;

      var comboIds = Object.keys(this._combinations);
      var html = '';
      for (var i = 0; i < comboIds.length; i++) {
        var id = comboIds[i];
        var combo = this._combinations[id];
        var isActive = id === this._activeComboId;
        html += '<div class="ewu-cp-combo-tab ' + (isActive ? 'active' : '') + '" data-id="' + id + '">' + escapeHTML(combo.name) + '</div>';
      }
      html += '<div class="ewu-cp-add-tab" id="ewu-cp-btn-add-combo">+ New Plan</div>';
      bar.innerHTML = html;

      var tabs = bar.querySelectorAll('.ewu-cp-combo-tab');
      for (var j = 0; j < tabs.length; j++) {
        tabs[j].addEventListener('click', function () {
          var cid = this.getAttribute('data-id');
          self._activeComboId = cid;
          self._renderComboBar();
          self._renderCatalog();
          self._renderPlanView();
        });
      }

      var addBtn = safeQuery('#ewu-cp-btn-add-combo');
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var newId = 'combo_' + self._nextComboIndex;
          var newName = 'Combination ' + self._nextComboIndex;
          self._nextComboIndex++;
          self._combinations[newId] = { id: newId, name: newName, selectedIds: [] };
          self._activeComboId = newId;
          Toast.show('Created ' + newName, 'info', 1500);
          self._renderComboBar();
          self._renderCatalog();
          self._renderPlanView();
        });
      }
    },

    _getActiveCombo: function () {
      if (!this._combinations[this._activeComboId]) {
        this._activeComboId = Object.keys(this._combinations)[0] || 'combo_1';
      }
      return this._combinations[this._activeComboId];
    },

    _renderCatalog: function () {
      var self = this;
      var listEl = safeQuery('#ewu-cp-catalog-list');
      var badgeEl = safeQuery('#ewu-cp-catalog-count');
      if (!listEl) return;

      var activeCombo = this._getActiveCombo();
      var activeSelectedSet = {};
      for (var k = 0; k < activeCombo.selectedIds.length; k++) {
        activeSelectedSet[activeCombo.selectedIds[k]] = true;
      }

      var filtered = this._groupedCourses;
      if (this._searchTerm) {
        var term = this._searchTerm;
        filtered = filtered.filter(function (s) {
          return s.courseCode.toLowerCase().indexOf(term) !== -1 || s.faculty.toLowerCase().indexOf(term) !== -1;
        });
      }

      if (badgeEl) badgeEl.textContent = filtered.length + ' courses shown';

      if (!filtered.length) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#9ca3af;">No courses match filter.</div>';
        return;
      }

      var html = '';
      for (var i = 0; i < filtered.length; i++) {
        var item = filtered[i];
        var isAdded = activeSelectedSet[item.id] === true;

        var schedHtml = '';
        for (var s = 0; s < item.schedules.length; s++) {
          var sch = item.schedules[s];
          var iconSvg = '';
          if (sch.type === 'lab') {
            iconSvg = '<svg class="sched-icon lab-icon" title="Lab" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L3.39 17c-.77.87-.29 2.23.87 2.23h15.48c1.15 0 1.63-1.36.87-2.23L14 9.31V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/><line x1="6.5" y1="13.5" x2="17.5" y2="13.5"/></svg>';
          } else if (sch.type === 'theory') {
            iconSvg = '<svg class="sched-icon theory-icon" title="Theory" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
          } else {
            iconSvg = '<svg class="sched-icon tba-icon" title="TBA" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
          }

          schedHtml +=
            '<div class="ewu-cp-schedule-item">' +
              iconSvg +
              '<span>' + escapeHTML(sch.days.join(', ')) + ' • ' + escapeHTML(sch.timeStr) + '</span>' +
            '</div>';
        }

        html +=
          '<div class="ewu-cp-card ' + (isAdded ? 'in-plan' : '') + '">' +
            '<div class="ewu-cp-card-main">' +
              '<div class="ewu-cp-card-badges">' +
                '<span class="ewu-badge ewu-badge-course">' + escapeHTML(item.courseCode) + '</span>' +
                '<span class="ewu-badge ewu-badge-sec">Sec ' + escapeHTML(item.section) + '</span>' +
                '<span class="ewu-badge" style="background:rgba(99,102,241,0.1); color:#818cf8; border:1px solid rgba(99,102,241,0.3);">' + escapeHTML(item.faculty) + '</span>' +
              '</div>' +
              '<div class="ewu-cp-schedules">' + schedHtml + '</div>' +
            '</div>' +
            '<div>' +
              (isAdded
                ? '<button type="button" class="ewu-btn-modern" disabled style="background:#22c55e; color:#fff; font-size:12px; padding:6px 12px; cursor:default; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Added</button>'
                : '<button type="button" class="ewu-btn-modern ewu-btn-modern-primary ewu-cp-btn-add-sec" data-id="' + item.id + '" style="font-size:12px; padding:6px 12px;">+ Add</button>'
              ) +
            '</div>' +
          '</div>';
      }

      listEl.innerHTML = html;
    },

    _addCourseToPlan: function (courseId) {
      var course = this._groupedCourses.find(function (s) { return s.id === courseId; });
      if (!course) return;

      var combo = this._getActiveCombo();
      var selectedCourses = combo.selectedIds.map(function (id) {
        return CoursePlannerModule._groupedCourses.find(function (s) { return s.id === id; });
      }).filter(Boolean);

      var dup = selectedCourses.find(function (s) { return s.courseCode === course.courseCode; });
      if (dup) {
        Toast.show('Duplicate Course: ' + course.courseCode + ' is already added in this plan.', 'error', 3000);
        return;
      }

      var currentCredits = selectedCourses.reduce(function (acc, s) { return acc + s.creditHour; }, 0);
      var maxCredits = (_settings && _settings.modules && typeof _settings.modules.plannerCreditLimit === 'number') ? _settings.modules.plannerCreditLimit : 15.0;
      if (currentCredits + course.creditHour > maxCredits) {
        Toast.show('Credit Limit Exceeded: Max ' + maxCredits.toFixed(1) + ' credits allowed.', 'warning', 3000);
        return;
      }

      for (var i = 0; i < selectedCourses.length; i++) {
        var existing = selectedCourses[i];
        if (this._checkOverlap(course, existing)) {
          Toast.show('Schedule Conflict with ' + existing.courseCode + ' (Sec ' + existing.section + ').', 'error', 3500);
          return;
        }
      }

      combo.selectedIds.push(course.id);
      Toast.show('Added ' + course.courseCode + ' (Sec ' + course.section + ') to plan.', 'success', 2000);
      this._renderCatalog();
      this._renderPlanView();
    },

    _parseTimeInterval: function (timeStr) {
      if (!timeStr || typeof timeStr !== 'string') return null;
      var cleanStr = timeStr.trim();
      if (!cleanStr || cleanStr.toUpperCase().indexOf('TBA') !== -1) return null;

      var m = cleanStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(?:-|to)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!m) return null;

      var startH = parseInt(m[1], 10);
      var startM = parseInt(m[2], 10);
      var startAmpm = m[3] ? m[3].toUpperCase() : null;

      var endH = parseInt(m[4], 10);
      var endM = parseInt(m[5], 10);
      var endAmpm = m[6] ? m[6].toUpperCase() : null;

      if (!endAmpm && startAmpm) endAmpm = startAmpm;
      if (!startAmpm && endAmpm) {
        startAmpm = endAmpm;
        if (endAmpm === 'PM' && startH >= 8 && startH < 12 && startH > endH) {
          startAmpm = 'AM';
        }
      }

      if (!startAmpm || !endAmpm) return null;

      if (startAmpm === 'PM' && startH !== 12) startH += 12;
      if (startAmpm === 'AM' && startH === 12) startH = 0;
      var startMin = startH * 60 + startM;

      if (endAmpm === 'PM' && endH !== 12) endH += 12;
      if (endAmpm === 'AM' && endH === 12) endH = 0;
      var endMin = endH * 60 + endM;

      return { start: startMin, end: endMin };
    },

    _schedulesOverlap: function (schA, schB) {
      if (!schA || !schB || !schA.days || !schB.days) return false;

      var sharedDay = schA.days.some(function (d) {
        return d && d !== 'TBA' && schB.days.indexOf(d) !== -1;
      });
      if (!sharedDay) return false;

      var intA = this._parseTimeInterval(schA.timeStr);
      var intB = this._parseTimeInterval(schB.timeStr);
      if (!intA || !intB) return false;

      return intA.start < intB.end && intA.end > intB.start;
    },

    _checkOverlap: function (cA, cB) {
      if (!cA || !cB || !cA.schedules || !cB.schedules) return false;
      for (var i = 0; i < cA.schedules.length; i++) {
        var schA = cA.schedules[i];
        for (var j = 0; j < cB.schedules.length; j++) {
          var schB = cB.schedules[j];
          if (this._schedulesOverlap(schA, schB)) {
            return true;
          }
        }
      }
      return false;
    },

    _renderPlanView: function () {
      var self = this;
      var planListEl = safeQuery('#ewu-cp-plan-list');
      if (!planListEl) return;

      var combo = this._getActiveCombo();
      var selectedCourses = combo.selectedIds.map(function (id) {
        return CoursePlannerModule._groupedCourses.find(function (s) { return s.id === id; });
      }).filter(Boolean);

      var totalCourses = selectedCourses.length;
      var totalLabs = 0;
      var totalTheoryHrs = 0;
      var totalCredits = 0;

      for (var i = 0; i < selectedCourses.length; i++) {
        var c = selectedCourses[i];
        totalCredits += c.creditHour;
        for (var s = 0; s < c.schedules.length; s++) {
          if (c.schedules[s].type === 'lab') totalLabs++;
          else if (c.schedules[s].type === 'theory') totalTheoryHrs += 3;
        }
      }

      safeQuery('#ewu-cp-metric-courses').textContent = totalCourses;
      safeQuery('#ewu-cp-metric-theory').textContent = totalTheoryHrs;
      safeQuery('#ewu-cp-metric-labs').textContent = totalLabs;
      safeQuery('#ewu-cp-metric-credits').textContent = totalCredits.toFixed(1);

      if (!selectedCourses.length) {
        planListEl.innerHTML = '<div style="padding:30px; text-align:center; color:#9ca3af;">Your plan is empty. Click <strong>+ Add</strong> on catalog cards to build schedule.</div>';
        return;
      }

      var html = '';
      for (var j = 0; j < selectedCourses.length; j++) {
        var item = selectedCourses[j];
        var schedHtml = '';
        for (var k = 0; k < item.schedules.length; k++) {
          var sch = item.schedules[k];
          var iconSvg = '';
          if (sch.type === 'lab') {
            iconSvg = '<svg class="sched-icon lab-icon" title="Lab" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L3.39 17c-.77.87-.29 2.23.87 2.23h15.48c1.15 0 1.63-1.36.87-2.23L14 9.31V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/><line x1="6.5" y1="13.5" x2="17.5" y2="13.5"/></svg>';
          } else if (sch.type === 'theory') {
            iconSvg = '<svg class="sched-icon theory-icon" title="Theory" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
          } else {
            iconSvg = '<svg class="sched-icon tba-icon" title="TBA" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
          }
          schedHtml += '<div class="ewu-cp-schedule-item">' + iconSvg + '<span>' + escapeHTML(sch.days.join(', ')) + ' • ' + escapeHTML(sch.timeStr) + '</span></div>';
        }

        html +=
          '<div class="ewu-cp-card">' +
            '<div class="ewu-cp-card-main">' +
              '<div class="ewu-cp-card-badges">' +
                '<span class="ewu-badge ewu-badge-course">' + escapeHTML(item.courseCode) + '</span>' +
                '<span class="ewu-badge ewu-badge-sec">Sec ' + escapeHTML(item.section) + '</span>' +
                '<span class="ewu-badge" style="background:rgba(99,102,241,0.1); color:#818cf8; border:1px solid rgba(99,102,241,0.3);">' + escapeHTML(item.faculty) + '</span>' +
              '</div>' +
              '<div class="ewu-cp-schedules">' + schedHtml + '</div>' +
            '</div>' +
            '<div>' +
              '<button type="button" class="ewu-btn-modern ewu-btn-modern-danger ewu-cp-btn-remove-sec" data-id="' + item.id + '" style="font-size:12px; padding:6px 12px;">Remove</button>' +
            '</div>' +
          '</div>';
      }

      planListEl.innerHTML = html;
    },

    _removeCourseFromPlan: function (courseId) {
      var combo = this._getActiveCombo();
      combo.selectedIds = combo.selectedIds.filter(function (id) { return id !== courseId; });
      Toast.show('Removed course from plan.', 'info', 1500);
      this._renderCatalog();
      this._renderPlanView();
    },

    _clearActivePlan: function () {
      var combo = this._getActiveCombo();
      if (!combo.selectedIds.length) return;
      combo.selectedIds = [];
      Toast.show('Plan cleared.', 'info', 1500);
      this._renderCatalog();
      this._renderPlanView();
    },

    _exportActiveComboImage: function () {
      var combo = this._getActiveCombo();
      if (!combo.selectedIds.length) {
        Toast.show('Plan is empty. Add courses before exporting.', 'warning');
        return;
      }

      var canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('EWU Course Planner - ' + combo.name, 40, 60);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#818cf8';
      ctx.fillText('Generated on: ' + new Date().toLocaleString(), 40, 95);

      var y = 140;
      var selectedCourses = combo.selectedIds.map(function (id) {
        return CoursePlannerModule._groupedCourses.find(function (s) { return s.id === id; });
      }).filter(Boolean);

      for (var i = 0; i < selectedCourses.length; i++) {
        var c = selectedCourses[i];
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(40, y, 1120, 70);

        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(c.courseCode + ' (Sec ' + c.section + ')', 60, y + 42);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '18px sans-serif';
        ctx.fillText('Faculty: ' + c.faculty, 380, y + 42);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px sans-serif';
        var schedStr = c.schedules.map(function (s) { return s.days.join(', ') + ' • ' + s.timeStr; }).join('; ');
        ctx.fillText(schedStr, 700, y + 42);

        y += 85;
      }

      var link = document.createElement('a');
      link.download = combo.name.toLowerCase().replace(/\s+/g, '_') + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      Toast.show('Combination exported as PNG.', 'success', 2500);
    },

    _exportAllCombosImage: function () {
      var comboIds = Object.keys(this._combinations);
      var validCombos = comboIds.map(function (id) { return CoursePlannerModule._combinations[id]; }).filter(function (c) { return c.selectedIds.length > 0; });

      if (!validCombos.length) {
        Toast.show('No active course plans to export.', 'warning');
        return;
      }

      var canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 300 + (validCombos.length * 300);
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('EWU Course Planner - All Combinations', 40, 60);

      var y = 120;
      for (var c = 0; c < validCombos.length; c++) {
        var combo = validCombos[c];
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(combo.name, 40, y);
        y += 35;

        var selectedCourses = combo.selectedIds.map(function (id) {
          return CoursePlannerModule._groupedCourses.find(function (s) { return s.id === id; });
        }).filter(Boolean);

        for (var i = 0; i < selectedCourses.length; i++) {
          var item = selectedCourses[i];
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(40, y, 1120, 50);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText(item.courseCode + ' (Sec ' + item.section + ') - ' + item.faculty, 60, y + 32);

          ctx.fillStyle = '#9ca3af';
          ctx.font = '15px sans-serif';
          var schedStr = item.schedules.map(function (s) { return s.days.join(', ') + ' • ' + s.timeStr; }).join('; ');
          ctx.fillText(schedStr, 700, y + 32);

          y += 60;
        }
        y += 30;
      }

      var link = document.createElement('a');
      link.download = 'all_course_combinations.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      Toast.show('All combinations exported as PNG.', 'success', 2500);
    },

    hideView: function () {
      if (!this._active) return;
      this._active = false;
      if (this._targetContainer) {
        var view = this._targetContainer.querySelector('.ewu-feature-view-container');
        if (view) view.remove();
        var children = this._targetContainer.children;
        for (var i = 0; i < children.length; i++) {
          if (!children[i].classList.contains('ewu-feature-view-container')) {
            var orig = children[i].getAttribute('data-ewu-orig-disp');
            children[i].style.display = orig !== null ? orig : '';
            children[i].removeAttribute('data-ewu-orig-disp');
          }
        }
      }
      log('Course Planner view closed.');
    },

    reset: function () {
      this.hideView();
    }
  };


  /* ===========================================================
     KEYBOARD SHORTCUTS (Ctrl+K for search)
     =========================================================== */

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      var searchInput = safeQuery('#ewu-oc-search-input') || safeQuery('#ewu-adv-search-input') || safeQuery('#ewu-rc-search') || safeQuery('#ewu-cp-search');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });


  /* ===========================================================
     MODULE LOADER
     =========================================================== */

  function loadModules(pageInfo, settings) {
    if (!settings.enabled || !pageInfo) return;
    if (pageInfo.id === 'login' && settings.modules.loginHelper) {
      LoginHelperModule.reset();
      LoginHelperModule.init(settings);
    }
    if (pageInfo.id === 'classSchedule') {
      if (settings.modules.routineGenerator !== false) {
        RoutineGeneratorModule.reset();
        RoutineGeneratorModule.init(settings);
      }
      if (settings.modules.scheduleEnhancer !== false) {
        ScheduleEnhancerModule.reset();
        ScheduleEnhancerModule.init(settings);
      }
    }
    if (pageInfo.id === 'offeredCourses' && settings.modules.offeredCoursesEnhancer) {
      OfferedCoursesEnhancerModule.reset();
      OfferedCoursesEnhancerModule.init(settings);
    }
    if (pageInfo.id === 'advising' && settings.modules.advisingTableEnhancer !== false) {
      AdvisingTableEnhancerModule.reset();
      AdvisingTableEnhancerModule.init(settings);
    }
    if (pageInfo.id === 'advisingOffline') {
      AdvisingOfflineModule.reset();
      AdvisingOfflineModule.init(settings);
    }
  }


  /* ===========================================================
     SETTINGS LISTENER (from popup)
     =========================================================== */

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function (msg, _s, respond) {
      if (msg && msg.type === 'EWU_SETTINGS_UPDATED') {
        handleSettingsUpdate(msg.settings);
        respond({ ok: true });
      }
    });
  }

  async function handleSettingsUpdate(ns) {
    _settings = ns;
    applyBodyClasses(ns);
    checkLicense(function (authorized) {
      if (!authorized) {
        log('License verification failed. Settings updates blocked.');
        return;
      }
      if (!ns.enabled) {
        LoginHelperModule.reset();
        RoutineGeneratorModule.reset();
        ScheduleEnhancerModule.reset();
        OfferedCoursesEnhancerModule.reset();
        AdvisingTableEnhancerModule.reset();
        AdvisingOfflineModule.reset();
      } else {
        var pi = detectPage();
        loadModules(pi, ns);
      }
    });
  }


  /* ===========================================================
     SPA NAVIGATION HANDLER
     =========================================================== */

  function setupSPA() {
    var origPS = history.pushState, origRS = history.replaceState;
    history.pushState = function () {
      var r = origPS.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return r;
    };
    history.replaceState = function () {
      var r = origRS.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
      return r;
    };
    window.addEventListener('popstate', function () {
      window.dispatchEvent(new Event('locationchange'));
    });
    window.addEventListener('locationchange', function () {
      log('SPA nav:', location.pathname);
      handleNav();
    });
  }

  var _navTimer = null;
  async function handleNav() {
    if (_navTimer) clearTimeout(_navTimer);
    _navTimer = setTimeout(async function () {
      _navTimer = null;
      checkLicense(function (authorized) {
        if (!authorized) {
          log('License verification failed. Navigation enhancements blocked.');
          return;
        }
        LoginHelperModule.reset();
        RoutineGeneratorModule.reset();
        OfferedCoursesEnhancerModule.reset();
        AdvisingTableEnhancerModule.reset();
        AdvisingOfflineModule.reset();

        var pi = detectPage();
        log('Nav ->', pi ? pi.id : 'not a target page');

        if (_settings && _settings.enabled) loadModules(pi, _settings);
      });
    }, 500);
  }


  /* ===========================================================
     MAIN INITIALIZATION
     ========================================================== */

  async function main() {
    log('EWU Portal Helper v' + CONFIG.VERSION + ' starting...');
    
    checkLicense(function (authorized) {
      if (!authorized) {
        log('License verification failed. Extension enhancements are disabled.');
        return;
      }
      initApp();
    });
  }

  async function initApp() {
    _settings = await loadSettings();

    if (!location.href.startsWith(CONFIG.PORTAL_BASE)) return;

    var pageInfo = detectPage();
    if (!pageInfo) {
      log('Not a target page, extension idle.');
      return;
    }

    log('Target page:', pageInfo.id, '-', pageInfo.label);
    applyBodyClasses(_settings);

    if (_settings.enabled && pageInfo.id === 'login') {
      Toast.show('Extension active', 'success', 2500);
    }

    loadModules(pageInfo, _settings);
    setupSPA();
    log('Ready');
  }

  main();

})();
