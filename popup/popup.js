/* =============================================================
   EWU Buddy - Cyber Command Settings Popup Script
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONSTANTS & DEFAULTS
     ----------------------------------------------------------- */
  const STORAGE_KEY = 'ewu_portal_helper_settings';
  const WORKER_URL = 'https://ewu-helper-license-worker.tonystarkxxx31.workers.dev';
  const LOG_PREFIX = '[EWU Cyber Settings]';

  const DEFAULT_SETTINGS = {
    enabled: true,
    theme: 'dark',
    animations: true,
    toastNotifications: true,
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
      plannerCreditLimit: 15.0
    }
  };

  /* -----------------------------------------------------------
     DOM REFERENCES
     ----------------------------------------------------------- */
  const els = {
    // Quick Search & Tabs
    settingsSearch: document.getElementById('settingsSearch'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    settingGroups: document.querySelectorAll('.setting-group'),
    settingCards: document.querySelectorAll('.setting-card'),

    // Master / General
    toggleEnabled: document.getElementById('toggleEnabled'),
    toggleToast: document.getElementById('toggleToast'),
    toggleAnimations: document.getElementById('toggleAnimations'),

    // Advising Offline
    toggleAdvisingOffline: document.getElementById('toggleAdvisingOffline'),
    toggleOfflineRecommended: document.getElementById('toggleOfflineRecommended'),
    toggleOfflinePlanner: document.getElementById('toggleOfflinePlanner'),
    inputPlannerCreditLimit: document.getElementById('inputPlannerCreditLimit'),
    subAdvisingOffline: document.getElementById('subAdvisingOffline'),

    // Online Advising
    toggleAdvisingEnhancer: document.getElementById('toggleAdvisingEnhancer'),
    toggleAdvColorLeft: document.getElementById('toggleAdvColorLeft'),
    toggleAdvSearchBox: document.getElementById('toggleAdvSearchBox'),
    subAdvisingOnline: document.getElementById('subAdvisingOnline'),

    // Offered Courses
    toggleOfferedCourses: document.getElementById('toggleOfferedCourses'),
    toggleOCStickyHeader: document.getElementById('toggleOCStickyHeader'),
    toggleOCColorLeft: document.getElementById('toggleOCColorLeft'),
    toggleOCSearchBox: document.getElementById('toggleOCSearchBox'),
    inputOCSearchPlaceholder: document.getElementById('inputOCSearchPlaceholder'),
    subOfferedCourses: document.getElementById('subOfferedCourses'),

    // Routine Generator & Schedule Enhancer
    toggleRoutine: document.getElementById('toggleRoutine'),
    toggleCompact: document.getElementById('toggleCompact'),
    toggleShowLogo: document.getElementById('toggleShowLogo'),
    selectBlueIntensity: document.getElementById('selectBlueIntensity'),
    selectExportQuality: document.getElementById('selectExportQuality'),
    subRoutine: document.getElementById('subRoutine'),

    toggleScheduleEnhancer: document.getElementById('toggleScheduleEnhancer'),
    toggleScheduleEmailLink: document.getElementById('toggleScheduleEmailLink'),
    toggleScheduleSummaryCard: document.getElementById('toggleScheduleSummaryCard'),
    subScheduleEnhancer: document.getElementById('subScheduleEnhancer'),

    // Login Helper
    toggleLoginHelper: document.getElementById('toggleLoginHelper'),
    toggleAutoFill: document.getElementById('toggleAutoFill'),
    inputDelay: document.getElementById('inputDelay'),
    toggleDebug: document.getElementById('toggleDebug'),
    subLogin: document.getElementById('subLogin'),

    // Data Management
    btnExport: document.getElementById('btnExport'),
    btnImport: document.getElementById('btnImport'),
    btnReset: document.getElementById('btnReset'),
    fileImport: document.getElementById('fileImport'),

    // License Badge & Button
    licBadgeDot: document.getElementById('licBadgeDot'),
    licStatusText: document.getElementById('licStatusText'),
    licSubText: document.getElementById('licSubText'),
    btnManageLicense: document.getElementById('btnManageLicense'),

    // Toast
    toast: document.getElementById('toast'),
  };

  /* -----------------------------------------------------------
     UTILITY HELPERS
     ----------------------------------------------------------- */
  function log(...args) { console.log(LOG_PREFIX, ...args); }

  function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
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

  function showToast(message, duration) {
    duration = duration || 2000;
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => { els.toast.classList.remove('show'); }, duration);
  }

  function isVersionOutdated(currentVer, minVer) {
    if (!minVer || !currentVer) return false;
    const cParts = currentVer.split('.').map(n => parseInt(n, 10) || 0);
    const mParts = minVer.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(cParts.length, mParts.length); i++) {
      const c = cParts[i] || 0;
      const m = mParts[i] || 0;
      if (c < m) return true;
      if (c > m) return false;
    }
    return false;
  }

  /* -----------------------------------------------------------
     SETTINGS STORAGE & BROADCAST
     ----------------------------------------------------------- */
  function loadSettings() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        resolve(structuredClone(DEFAULT_SETTINGS));
        return;
      }
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = result[STORAGE_KEY] || {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [STORAGE_KEY]: settings }, resolve);
    });
  }

  function broadcastSettings(settings) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ url: 'https://portal.ewubd.edu/*' }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EWU_SETTINGS_UPDATED',
          settings: settings,
        }).catch(() => {});
      }
    });
  }

  /* -----------------------------------------------------------
     RENDER UI FROM SETTINGS
     ----------------------------------------------------------- */
  function renderUI(settings) {
    const mods = settings.modules || {};

    // General
    if (els.toggleEnabled) els.toggleEnabled.checked = settings.enabled !== false;
    if (els.toggleToast) els.toggleToast.checked = settings.toastNotifications !== false;
    if (els.toggleAnimations) els.toggleAnimations.checked = settings.animations !== false;

    // Advising Offline
    if (els.toggleAdvisingOffline) els.toggleAdvisingOffline.checked = mods.advisingOffline !== false;
    if (els.toggleOfflineRecommended) els.toggleOfflineRecommended.checked = mods.advisingOfflineRecommended !== false;
    if (els.toggleOfflinePlanner) els.toggleOfflinePlanner.checked = mods.advisingOfflinePlanner !== false;
    if (els.inputPlannerCreditLimit) els.inputPlannerCreditLimit.value = typeof mods.plannerCreditLimit === 'number' ? mods.plannerCreditLimit : 15.0;
    updateSubVisibility(els.subAdvisingOffline, mods.advisingOffline !== false);

    // Online Advising
    if (els.toggleAdvisingEnhancer) els.toggleAdvisingEnhancer.checked = mods.advisingTableEnhancer !== false;
    if (els.toggleAdvColorLeft) els.toggleAdvColorLeft.checked = mods.advisingColorLeft !== false;
    if (els.toggleAdvSearchBox) els.toggleAdvSearchBox.checked = mods.advisingSearchBox !== false;
    updateSubVisibility(els.subAdvisingOnline, mods.advisingTableEnhancer !== false);

    // Offered Courses
    if (els.toggleOfferedCourses) els.toggleOfferedCourses.checked = mods.offeredCoursesEnhancer !== false;
    if (els.toggleOCStickyHeader) els.toggleOCStickyHeader.checked = mods.offeredCoursesStickyHeader !== false;
    if (els.toggleOCColorLeft) els.toggleOCColorLeft.checked = mods.offeredCoursesColorLeft !== false;
    if (els.toggleOCSearchBox) els.toggleOCSearchBox.checked = mods.offeredCoursesSearchBox !== false;
    if (els.inputOCSearchPlaceholder) els.inputOCSearchPlaceholder.value = mods.offeredCoursesSearchPlaceholder || 'Search by course or faculty...';
    updateSubVisibility(els.subOfferedCourses, mods.offeredCoursesEnhancer !== false);

    // Routine Generator & Schedule Enhancer
    if (els.toggleRoutine) els.toggleRoutine.checked = mods.routineGenerator !== false;
    if (els.toggleCompact) els.toggleCompact.checked = !!mods.routineCompact;
    if (els.toggleShowLogo) els.toggleShowLogo.checked = mods.routineShowLogo !== false;
    if (els.selectBlueIntensity) els.selectBlueIntensity.value = mods.routineBlueIntensity || 'medium';
    if (els.selectExportQuality) els.selectExportQuality.value = mods.routineExportQuality || 'standard';
    updateSubVisibility(els.subRoutine, mods.routineGenerator !== false);

    if (els.toggleScheduleEnhancer) els.toggleScheduleEnhancer.checked = mods.scheduleEnhancer !== false;
    if (els.toggleScheduleEmailLink) els.toggleScheduleEmailLink.checked = mods.scheduleEmailLink !== false;
    if (els.toggleScheduleSummaryCard) els.toggleScheduleSummaryCard.checked = mods.scheduleSummaryCard !== false;
    updateSubVisibility(els.subScheduleEnhancer, mods.scheduleEnhancer !== false);

    // Login Helper
    if (els.toggleLoginHelper) els.toggleLoginHelper.checked = mods.loginHelper !== false;
    if (els.toggleAutoFill) els.toggleAutoFill.checked = mods.loginHelperAutoFill !== false;
    if (els.inputDelay) els.inputDelay.value = typeof mods.loginHelperDelay === 'number' ? mods.loginHelperDelay : 300;
    if (els.toggleDebug) els.toggleDebug.checked = !!mods.loginHelperDebug;
    updateSubVisibility(els.subLogin, mods.loginHelper !== false);
  }

  function updateSubVisibility(containerEl, isVisible) {
    if (!containerEl) return;
    containerEl.style.display = isVisible ? 'flex' : 'none';
  }

  /* -----------------------------------------------------------
     BIND EVENTS
     ----------------------------------------------------------- */
  function bindEvents() {
    // Manage License Button Click -> Open Activation Page
    if (els.btnManageLicense) {
      els.btnManageLicense.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: chrome.runtime.getURL('pages/activation.html') });
        } else {
          window.open('pages/activation.html', '_blank');
        }
      });
    }

    // Tab Filter Navigation
    let currentTab = 'general';

    function applyTabFilter(tab) {
      currentTab = tab;
      els.tabBtns.forEach(b => {
        if (b.getAttribute('data-tab') === tab) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      els.settingGroups.forEach((grp) => {
        const groupName = grp.getAttribute('data-group');
        grp.style.display = (groupName === tab) ? 'block' : 'none';
      });

      els.settingCards.forEach(c => { c.style.display = 'block'; });
    }

    els.tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (els.settingsSearch) els.settingsSearch.value = '';
        applyTabFilter(tab);
      });
    });

    // Quick Search Settings
    if (els.settingsSearch) {
      els.settingsSearch.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();
        if (!query) {
          applyTabFilter(currentTab);
          return;
        }

        els.settingCards.forEach((card) => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(query) ? 'block' : 'none';
        });

        els.settingGroups.forEach((grp) => {
          const hasVisible = Array.from(grp.querySelectorAll('.setting-card')).some(c => c.style.display !== 'none');
          grp.style.display = hasVisible ? 'block' : 'none';
        });
      });
    }

    // Helper to mutate & persist
    async function updateSetting(fn, toastMsg) {
      const s = await loadSettings();
      fn(s);
      await saveSettings(s);
      broadcastSettings(s);
      if (toastMsg) showToast(toastMsg);
    }

    // Master & General
    if (els.toggleEnabled) {
      els.toggleEnabled.addEventListener('change', () => {
        updateSetting(s => { s.enabled = els.toggleEnabled.checked; }, els.toggleEnabled.checked ? 'Extension Enabled' : 'Extension Paused');
      });
    }
    if (els.toggleToast) {
      els.toggleToast.addEventListener('change', () => {
        updateSetting(s => { s.toastNotifications = els.toggleToast.checked; }, 'Toast setting saved');
      });
    }
    if (els.toggleAnimations) {
      els.toggleAnimations.addEventListener('change', () => {
        updateSetting(s => { s.animations = els.toggleAnimations.checked; }, 'Animations updated');
      });
    }

    // Advising Offline Suite
    if (els.toggleAdvisingOffline) {
      els.toggleAdvisingOffline.addEventListener('change', () => {
        const checked = els.toggleAdvisingOffline.checked;
        updateSubVisibility(els.subAdvisingOffline, checked);
        updateSetting(s => { s.modules.advisingOffline = checked; }, checked ? 'Advising Offline Enabled' : 'Advising Offline Disabled');
      });
    }
    if (els.toggleOfflineRecommended) {
      els.toggleOfflineRecommended.addEventListener('change', () => {
        updateSetting(s => { s.modules.advisingOfflineRecommended = els.toggleOfflineRecommended.checked; }, 'Recommended Course updated');
      });
    }
    if (els.toggleOfflinePlanner) {
      els.toggleOfflinePlanner.addEventListener('change', () => {
        updateSetting(s => { s.modules.advisingOfflinePlanner = els.toggleOfflinePlanner.checked; }, 'Course Planner updated');
      });
    }
    if (els.inputPlannerCreditLimit) {
      els.inputPlannerCreditLimit.addEventListener('change', () => {
        const limit = parseFloat(els.inputPlannerCreditLimit.value) || 15.0;
        updateSetting(s => { s.modules.plannerCreditLimit = limit; }, `Credit limit set to ${limit}`);
      });
    }

    // Online Advising
    if (els.toggleAdvisingEnhancer) {
      els.toggleAdvisingEnhancer.addEventListener('change', () => {
        const checked = els.toggleAdvisingEnhancer.checked;
        updateSubVisibility(els.subAdvisingOnline, checked);
        updateSetting(s => { s.modules.advisingTableEnhancer = checked; }, 'Advising Enhancer updated');
      });
    }
    if (els.toggleAdvColorLeft) {
      els.toggleAdvColorLeft.addEventListener('change', () => {
        updateSetting(s => { s.modules.advisingColorLeft = els.toggleAdvColorLeft.checked; }, 'Seat indicators updated');
      });
    }
    if (els.toggleAdvSearchBox) {
      els.toggleAdvSearchBox.addEventListener('change', () => {
        updateSetting(s => { s.modules.advisingSearchBox = els.toggleAdvSearchBox.checked; }, 'Advising Search updated');
      });
    }

    // Offered Courses
    if (els.toggleOfferedCourses) {
      els.toggleOfferedCourses.addEventListener('change', () => {
        const checked = els.toggleOfferedCourses.checked;
        updateSubVisibility(els.subOfferedCourses, checked);
        updateSetting(s => { s.modules.offeredCoursesEnhancer = checked; }, 'Offered Courses updated');
      });
    }
    if (els.toggleOCStickyHeader) {
      els.toggleOCStickyHeader.addEventListener('change', () => {
        updateSetting(s => { s.modules.offeredCoursesStickyHeader = els.toggleOCStickyHeader.checked; }, 'Sticky header updated');
      });
    }
    if (els.toggleOCColorLeft) {
      els.toggleOCColorLeft.addEventListener('change', () => {
        updateSetting(s => { s.modules.offeredCoursesColorLeft = els.toggleOCColorLeft.checked; }, 'Seat indicators updated');
      });
    }
    if (els.toggleOCSearchBox) {
      els.toggleOCSearchBox.addEventListener('change', () => {
        updateSetting(s => { s.modules.offeredCoursesSearchBox = els.toggleOCSearchBox.checked; }, 'Course search updated');
      });
    }
    if (els.inputOCSearchPlaceholder) {
      els.inputOCSearchPlaceholder.addEventListener('change', () => {
        updateSetting(s => { s.modules.offeredCoursesSearchPlaceholder = els.inputOCSearchPlaceholder.value.trim(); }, 'Placeholder saved');
      });
    }

    // Routine Generator
    if (els.toggleRoutine) {
      els.toggleRoutine.addEventListener('change', () => {
        const checked = els.toggleRoutine.checked;
        updateSubVisibility(els.subRoutine, checked);
        updateSetting(s => { s.modules.routineGenerator = checked; }, 'Routine Generator updated');
      });
    }
    if (els.toggleCompact) {
      els.toggleCompact.addEventListener('change', () => {
        updateSetting(s => { s.modules.routineCompact = els.toggleCompact.checked; }, 'Compact mode updated');
      });
    }
    if (els.toggleShowLogo) {
      els.toggleShowLogo.addEventListener('change', () => {
        updateSetting(s => { s.modules.routineShowLogo = els.toggleShowLogo.checked; }, 'Logo visibility updated');
      });
    }
    if (els.selectBlueIntensity) {
      els.selectBlueIntensity.addEventListener('change', () => {
        updateSetting(s => { s.modules.routineBlueIntensity = els.selectBlueIntensity.value; }, 'Theme intensity saved');
      });
    }
    if (els.selectExportQuality) {
      els.selectExportQuality.addEventListener('change', () => {
        updateSetting(s => { s.modules.routineExportQuality = els.selectExportQuality.value; }, 'Export quality saved');
      });
    }

    // Schedule Enhancer
    if (els.toggleScheduleEnhancer) {
      els.toggleScheduleEnhancer.addEventListener('change', () => {
        const checked = els.toggleScheduleEnhancer.checked;
        updateSubVisibility(els.subScheduleEnhancer, checked);
        updateSetting(s => { s.modules.scheduleEnhancer = checked; }, checked ? 'Schedule Enhancer Enabled' : 'Schedule Enhancer Disabled');
      });
    }
    if (els.toggleScheduleEmailLink) {
      els.toggleScheduleEmailLink.addEventListener('change', () => {
        updateSetting(s => { s.modules.scheduleEmailLink = els.toggleScheduleEmailLink.checked; }, 'Faculty email links updated');
      });
    }
    if (els.toggleScheduleSummaryCard) {
      els.toggleScheduleSummaryCard.addEventListener('change', () => {
        updateSetting(s => { s.modules.scheduleSummaryCard = els.toggleScheduleSummaryCard.checked; }, 'Summary card updated');
      });
    }

    // Login Helper
    if (els.toggleLoginHelper) {
      els.toggleLoginHelper.addEventListener('change', () => {
        const checked = els.toggleLoginHelper.checked;
        updateSubVisibility(els.subLogin, checked);
        updateSetting(s => { s.modules.loginHelper = checked; }, 'Login Helper updated');
      });
    }
    if (els.toggleAutoFill) {
      els.toggleAutoFill.addEventListener('change', () => {
        updateSetting(s => { s.modules.loginHelperAutoFill = els.toggleAutoFill.checked; }, 'Auto-fill updated');
      });
    }
    if (els.inputDelay) {
      els.inputDelay.addEventListener('change', () => {
        const delay = parseInt(els.inputDelay.value, 10) || 300;
        updateSetting(s => { s.modules.loginHelperDelay = delay; }, `Delay set to ${delay}ms`);
      });
    }
    if (els.toggleDebug) {
      els.toggleDebug.addEventListener('change', () => {
        updateSetting(s => { s.modules.loginHelperDebug = els.toggleDebug.checked; }, 'Debug mode updated');
      });
    }

    // Export Data
    if (els.btnExport) {
      els.btnExport.addEventListener('click', async () => {
        const s = await loadSettings();
        const jsonStr = JSON.stringify(s, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ewu_buddy_settings_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Settings exported successfully!');
      });
    }

    // Import Data
    if (els.btnImport && els.fileImport) {
      els.btnImport.addEventListener('click', () => {
        els.fileImport.click();
      });

      els.fileImport.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            const merged = deepMerge(structuredClone(DEFAULT_SETTINGS), parsed);
            await saveSettings(merged);
            broadcastSettings(merged);
            renderUI(merged);
            showToast('Settings imported successfully!');
          } catch (err) {
            showToast('Invalid JSON settings file!');
          }
        };
        reader.readAsText(file);
        els.fileImport.value = '';
      });
    }

    // Reset Defaults
    if (els.btnReset) {
      els.btnReset.addEventListener('click', async () => {
        if (confirm('Reset all EWU Buddy settings to factory default?')) {
          const defaults = structuredClone(DEFAULT_SETTINGS);
          await saveSettings(defaults);
          broadcastSettings(defaults);
          renderUI(defaults);
          showToast('Settings reset to default!');
        }
      });
    }
  }

  /* -----------------------------------------------------------
     LICENSING & REMOTE STATUS ENFORCEMENT (PRIORITY SYSTEM)
     ----------------------------------------------------------- */
  function isLicenseAuthorizedLocally(res) {
    if (!res || !res.ewu_license_token) return false;
    if (res.ewu_license_status === 'inactive' || res.ewu_license_status === 'revoked' || res.ewu_license_status === 'expired') {
      return false;
    }
    var licExp = res.ewu_license_expiry;
    if (licExp && typeof licExp === 'number' && licExp > 0) {
      if (Date.now() > licExp) return false;
    }
    return true;
  }

  function updateLicenseStatusUI() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.local.get([
      'ewu_license_token',
      'ewu_license_status',
      'ewu_license_expiry',
      'ewu_license_exp',
      'ewu_license_prefix',
      'ewu_system_shutdown',
      'ewu_system_update',
      'ewu_system_notice'
    ], (res) => {
      const shutdown = res.ewu_system_shutdown || { enabled: false };
      const update = res.ewu_system_update || { isMandatory: false, minVersion: '2.0.0' };
      const notice = res.ewu_system_notice || { enabled: false };

      const container = document.querySelector('.search-nav-container');
      const content = document.querySelector('.content-body');

      // Clear any prior lock overlays or notice banners
      const oldOverlay = document.getElementById('ewu-popup-lock-overlay');
      if (oldOverlay) oldOverlay.remove();
      const oldNotice = document.getElementById('ewu-popup-broadcast-banner');
      if (oldNotice) oldNotice.remove();
      const oldUpNotice = document.getElementById('ewu-popup-update-banner');
      if (oldUpNotice) oldUpNotice.remove();

      if (container) { container.style.filter = ''; container.style.pointerEvents = ''; }
      if (content) { content.style.filter = ''; content.style.pointerEvents = ''; }

      const manifestVer = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '2.0.0';
      const isOutdated = isVersionOutdated(manifestVer, update.minVersion);
      const isUpdateAvailable = update.latestVersion && isVersionOutdated(manifestVer, update.latestVersion);

      // ---------------------------------------------------------
      // PRIORITY 1: Emergency Remote Killswitch / Shutdown
      // ---------------------------------------------------------
      if (shutdown.enabled) {
        if (els.licBadgeDot) {
          els.licBadgeDot.style.background = '#f43f5e';
          els.licBadgeDot.style.boxShadow = '0 0 8px rgba(244,63,94,0.7)';
        }
        if (els.licStatusText) els.licStatusText.textContent = 'System Shutdown';
        if (els.licSubText) els.licSubText.textContent = 'Disabled by administrator';

        if (container) { container.style.filter = 'blur(6px)'; container.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(6px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:120px; left:0; width:100%; height:calc(100% - 120px); background:rgba(7,10,19,0.88); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); box-sizing:border-box; text-align:center;';
        overlay.innerHTML = `
          <div style="width:100%; max-width:320px; background:rgba(15,23,42,0.95); border:1px solid rgba(244,63,94,0.4); border-radius:14px; padding:24px 20px; box-shadow:0 12px 32px rgba(0,0,0,0.8), 0 0 20px rgba(244,63,94,0.2); box-sizing:border-box;">
            <div style="width:48px; height:48px; border-radius:12px; background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.3); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; color:#f43f5e;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 style="color:#fff; font-size:15px; font-weight:800; margin-bottom:8px;">${shutdown.title || 'System Temporarily Offline'}</h3>
            <p style="color:#cbd5e1; font-size:12px; line-height:1.6; margin-bottom:16px;">${shutdown.message || 'EWU Portal Helper is currently disabled by administrator.'}</p>
            <span style="display:inline-block; font-size:11px; font-weight:600; color:#f43f5e; background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.25); padding:4px 12px; border-radius:12px;">All Features Locked</span>
          </div>
        `;
        document.body.appendChild(overlay);
        return;
      }

      // ---------------------------------------------------------
      // PRIORITY 2: Mandatory Extension Update Enforced
      // ---------------------------------------------------------
      if (update.isMandatory && isOutdated) {
        if (els.licBadgeDot) {
          els.licBadgeDot.style.background = '#f59e0b';
          els.licBadgeDot.style.boxShadow = '0 0 8px rgba(245,158,11,0.7)';
        }
        if (els.licStatusText) els.licStatusText.textContent = 'Update Required';
        if (els.licSubText) els.licSubText.textContent = `v${manifestVer} -> v${update.latestVersion || update.minVersion}`;

        if (container) { container.style.filter = 'blur(6px)'; container.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(6px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:120px; left:0; width:100%; height:calc(100% - 120px); background:rgba(7,10,19,0.88); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); box-sizing:border-box; text-align:center;';
        overlay.innerHTML = `
          <div style="width:100%; max-width:320px; background:rgba(15,23,42,0.95); border:1px solid rgba(99,102,241,0.4); border-radius:14px; padding:24px 20px; box-shadow:0 12px 32px rgba(0,0,0,0.8), 0 0 20px rgba(99,102,241,0.25); box-sizing:border-box;">
            <div style="width:48px; height:48px; border-radius:12px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.3); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; color:#818cf8;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            </div>
            <h3 style="color:#fff; font-size:15px; font-weight:800; margin-bottom:6px;">${update.title || 'Update Required'}</h3>
            <p style="color:#cbd5e1; font-size:12px; line-height:1.5; margin-bottom:14px;">A required update is available (v${update.latestVersion || update.minVersion}). Please update to continue using EWU Buddy.</p>
            <button id="btnPopupUpdateAction" style="width:100%; padding:11px; border-radius:10px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Update Now
            </button>
          </div>
        `;
        document.body.appendChild(overlay);
        const btnUp = document.getElementById('btnPopupUpdateAction');
        if (btnUp) {
          btnUp.addEventListener('click', () => {
            if (update.updateUrl) {
              window.open(update.updateUrl, '_blank');
            } else if (chrome.tabs) {
              chrome.tabs.create({ url: chrome.runtime.getURL('pages/update.html') });
            }
          });
        }
        return;
      }

      // ---------------------------------------------------------
      // PRIORITY 3: License Authorization Check
      // ---------------------------------------------------------
      const hasValidLicense = isLicenseAuthorizedLocally(res);

      if (!hasValidLicense) {
        if (els.licBadgeDot) {
          els.licBadgeDot.style.background = '#f43f5e';
          els.licBadgeDot.style.boxShadow = '0 0 8px rgba(244, 63, 94, 0.7)';
        }
        if (els.licStatusText) els.licStatusText.textContent = 'License Inactive';
        if (els.licSubText) els.licSubText.style.display = 'none';

        // Blur settings and show centered activation warning overlay
        if (container) { container.style.filter = 'blur(7px)'; container.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(7px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:124px; left:0; width:100%; height:calc(100% - 124px); background:rgba(6,9,19,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:18px; box-sizing:border-box; text-align:center; animation: fadeInOverlay 0.25s ease;';
        overlay.innerHTML = `
          <div style="width:100%; max-width:320px; background:rgba(13,19,33,0.95); border:1px solid rgba(99,102,241,0.35); border-radius:16px; padding:24px 20px; box-shadow:0 12px 35px rgba(0,0,0,0.7), 0 0 20px rgba(99,102,241,0.15); box-sizing:border-box;">
            <div style="width:48px; height:48px; border-radius:14px; background:rgba(99,102,241,0.14); border:1px solid rgba(99,102,241,0.3); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#818cf8;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 style="color:#ffffff; font-size:15px; font-weight:800; margin-bottom:6px; letter-spacing:-0.2px;">License Activation Required</h3>
            <p style="color:#cbd5e1; font-size:12px; line-height:1.55; margin-bottom:18px;">Activate your license key to unlock automatic captcha solving, routine timetables, and advising planner.</p>
            <button id="btnPopupActivateAction" style="width:100%; padding:11px 18px; border-radius:10px; background:linear-gradient(135deg, #4f46e5, #3b82f6); color:#ffffff; border:1px solid rgba(255,255,255,0.15); font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(79,70,229,0.35); transition:transform 0.15s ease;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 2l-2 2m-1.5 1.5L14 9m-1.5 1.5L10 13l-4 4-4-4 4-4 2.5-2.5m1.5-1.5L16.5 3.5 18 2z"/><circle cx="7.5" cy="16.5" r="1.5"/></svg>
              Activate License
            </button>
          </div>
        `;
        document.body.appendChild(overlay);

        const btnAct = document.getElementById('btnPopupActivateAction');
        if (btnAct) {
          btnAct.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.create({ url: chrome.runtime.getURL('pages/activation.html') });
            } else {
              window.open('pages/activation.html', '_blank');
            }
          });
        }
        return;
      }

      // ---------------------------------------------------------
      // PRIORITY 4, 5, 6: User is Authorized! Render Features + Banners
      // ---------------------------------------------------------
      if (els.licBadgeDot) {
        els.licBadgeDot.style.background = '#10b981';
        els.licBadgeDot.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.7)';
      }
      if (els.licStatusText) els.licStatusText.textContent = 'License Active';
      if (els.licSubText) els.licSubText.style.display = 'none';

      const headerEl = document.querySelector('.header');

      // PRIORITY 4: Optional Update Available Banner
      if (isUpdateAvailable && !update.isMandatory) {
        const upBanner = document.createElement('div');
        upBanner.id = 'ewu-popup-update-banner';
        upBanner.style.cssText = 'margin:8px 14px 0 14px; background:rgba(99,102,241,0.14); border:1px solid rgba(99,102,241,0.35); border-radius:10px; padding:8px 12px; font-size:11.5px; line-height:1.4; color:#f1f5f9; display:flex; justify-content:space-between; align-items:center;';
        upBanner.innerHTML = `
          <span><strong style="color:#818cf8;">Update v${update.latestVersion} available!</strong></span>
          <a href="${update.updateUrl || 'https://t.me/AftabKabir'}" target="_blank" style="color:#38bdf8; font-weight:700; text-decoration:underline; margin-left:8px;">Download &rarr;</a>
        `;
        if (headerEl && headerEl.nextSibling) {
          headerEl.parentNode.insertBefore(upBanner, headerEl.nextSibling);
        }
      }

      // PRIORITY 5: Broadcast Notice Announcement Banner
      if (notice.enabled && (notice.title || notice.message)) {
        let bannerBg = 'rgba(56, 189, 248, 0.12)';
        let bannerBorder = 'rgba(56, 189, 248, 0.3)';
        let bannerColor = '#38bdf8';
        if (notice.type === 'warning') {
          bannerBg = 'rgba(245, 158, 11, 0.12)';
          bannerBorder = 'rgba(245, 158, 11, 0.3)';
          bannerColor = '#f59e0b';
        } else if (notice.type === 'alert') {
          bannerBg = 'rgba(244, 63, 94, 0.12)';
          bannerBorder = 'rgba(244, 63, 94, 0.3)';
          bannerColor = '#f43f5e';
        }

        const banner = document.createElement('div');
        banner.id = 'ewu-popup-broadcast-banner';
        banner.style.cssText = `margin:8px 14px 0 14px; background:${bannerBg}; border:1px solid ${bannerBorder}; border-radius:10px; padding:10px 12px; font-size:11.5px; line-height:1.5; color:#f1f5f9; position:relative;`;
        banner.innerHTML = `
          <button style="position:absolute; top:6px; right:8px; background:transparent; border:none; color:#94a3b8; font-size:13px; cursor:pointer;" onclick="this.parentElement.remove()">✕</button>
          ${notice.title ? `<strong style="display:block; color:${bannerColor}; font-size:12px; margin-bottom:2px;">${notice.title}</strong>` : ''}
          <span>${notice.message}</span>
        `;
        if (headerEl && headerEl.nextSibling) {
          headerEl.parentNode.insertBefore(banner, headerEl.nextSibling);
        }
      }
    });
  }

  /* -----------------------------------------------------------
     INITIALIZATION
     ----------------------------------------------------------- */
  async function init() {
    log('Initializing Cyber Settings UI...');
    bindEvents();
    const settings = await loadSettings();
    renderUI(settings);
    updateLicenseStatusUI();

    // Trigger background check for updates & remote status
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'CHECK_REMOTE_STATUS' }).catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Re-render if settings or status updated
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'EWU_SETTINGS_UPDATED') {
        updateLicenseStatusUI();
      }
    });
  }

})();
