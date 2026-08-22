/* =============================================================
   EWU Buddy - Cyber Command Settings Popup Script
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONSTANTS & DEFAULTS
     ----------------------------------------------------------- */
  const STORAGE_KEY = 'ewu_portal_helper_settings';
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

  /* -----------------------------------------------------------
     SETTINGS STORAGE & BROADCAST
     ----------------------------------------------------------- */
  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = result[STORAGE_KEY] || {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
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
    els.toggleEnabled.checked = settings.enabled !== false;
    els.toggleToast.checked = settings.toastNotifications !== false;
    els.toggleAnimations.checked = settings.animations !== false;

    // Advising Offline
    els.toggleAdvisingOffline.checked = mods.advisingOffline !== false;
    els.toggleOfflineRecommended.checked = mods.advisingOfflineRecommended !== false;
    els.toggleOfflinePlanner.checked = mods.advisingOfflinePlanner !== false;
    els.inputPlannerCreditLimit.value = typeof mods.plannerCreditLimit === 'number' ? mods.plannerCreditLimit : 15.0;
    updateSubVisibility(els.subAdvisingOffline, mods.advisingOffline !== false);

    // Online Advising
    els.toggleAdvisingEnhancer.checked = mods.advisingTableEnhancer !== false;
    els.toggleAdvColorLeft.checked = mods.advisingColorLeft !== false;
    els.toggleAdvSearchBox.checked = mods.advisingSearchBox !== false;
    updateSubVisibility(els.subAdvisingOnline, mods.advisingTableEnhancer !== false);

    // Offered Courses
    els.toggleOfferedCourses.checked = mods.offeredCoursesEnhancer !== false;
    els.toggleOCStickyHeader.checked = mods.offeredCoursesStickyHeader !== false;
    els.toggleOCColorLeft.checked = mods.offeredCoursesColorLeft !== false;
    els.toggleOCSearchBox.checked = mods.offeredCoursesSearchBox !== false;
    els.inputOCSearchPlaceholder.value = mods.offeredCoursesSearchPlaceholder || 'Search by course or faculty...';
    updateSubVisibility(els.subOfferedCourses, mods.offeredCoursesEnhancer !== false);

    // Routine Generator & Schedule Enhancer
    els.toggleRoutine.checked = mods.routineGenerator !== false;
    els.toggleCompact.checked = !!mods.routineCompact;
    els.toggleShowLogo.checked = mods.routineShowLogo !== false;
    els.selectBlueIntensity.value = mods.routineBlueIntensity || 'medium';
    els.selectExportQuality.value = mods.routineExportQuality || 'standard';
    updateSubVisibility(els.subRoutine, mods.routineGenerator !== false);

    els.toggleScheduleEnhancer.checked = mods.scheduleEnhancer !== false;
    els.toggleScheduleEmailLink.checked = mods.scheduleEmailLink !== false;
    els.toggleScheduleSummaryCard.checked = mods.scheduleSummaryCard !== false;
    updateSubVisibility(els.subScheduleEnhancer, mods.scheduleEnhancer !== false);

    // Login Helper
    els.toggleLoginHelper.checked = mods.loginHelper !== false;
    els.toggleAutoFill.checked = mods.loginHelperAutoFill !== false;
    els.inputDelay.value = typeof mods.loginHelperDelay === 'number' ? mods.loginHelperDelay : 300;
    els.toggleDebug.checked = !!mods.loginHelperDebug;
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
    els.toggleEnabled.addEventListener('change', () => {
      updateSetting(s => { s.enabled = els.toggleEnabled.checked; }, els.toggleEnabled.checked ? 'Extension Enabled' : 'Extension Paused');
    });
    els.toggleToast.addEventListener('change', () => {
      updateSetting(s => { s.toastNotifications = els.toggleToast.checked; }, 'Toast setting saved');
    });
    els.toggleAnimations.addEventListener('change', () => {
      updateSetting(s => { s.animations = els.toggleAnimations.checked; }, 'Animations updated');
    });

    // Advising Offline Suite
    els.toggleAdvisingOffline.addEventListener('change', () => {
      const checked = els.toggleAdvisingOffline.checked;
      updateSubVisibility(els.subAdvisingOffline, checked);
      updateSetting(s => { s.modules.advisingOffline = checked; }, checked ? 'Advising Offline Enabled' : 'Advising Offline Disabled');
    });
    els.toggleOfflineRecommended.addEventListener('change', () => {
      updateSetting(s => { s.modules.advisingOfflineRecommended = els.toggleOfflineRecommended.checked; }, 'Recommended Course updated');
    });
    els.toggleOfflinePlanner.addEventListener('change', () => {
      updateSetting(s => { s.modules.advisingOfflinePlanner = els.toggleOfflinePlanner.checked; }, 'Course Planner updated');
    });
    els.inputPlannerCreditLimit.addEventListener('change', () => {
      const limit = parseFloat(els.inputPlannerCreditLimit.value) || 15.0;
      updateSetting(s => { s.modules.plannerCreditLimit = limit; }, `Credit limit set to ${limit}`);
    });

    // Online Advising
    els.toggleAdvisingEnhancer.addEventListener('change', () => {
      const checked = els.toggleAdvisingEnhancer.checked;
      updateSubVisibility(els.subAdvisingOnline, checked);
      updateSetting(s => { s.modules.advisingTableEnhancer = checked; }, 'Advising Enhancer updated');
    });
    els.toggleAdvColorLeft.addEventListener('change', () => {
      updateSetting(s => { s.modules.advisingColorLeft = els.toggleAdvColorLeft.checked; }, 'Seat indicators updated');
    });
    els.toggleAdvSearchBox.addEventListener('change', () => {
      updateSetting(s => { s.modules.advisingSearchBox = els.toggleAdvSearchBox.checked; }, 'Advising Search updated');
    });

    // Offered Courses
    els.toggleOfferedCourses.addEventListener('change', () => {
      const checked = els.toggleOfferedCourses.checked;
      updateSubVisibility(els.subOfferedCourses, checked);
      updateSetting(s => { s.modules.offeredCoursesEnhancer = checked; }, 'Offered Courses updated');
    });
    els.toggleOCStickyHeader.addEventListener('change', () => {
      updateSetting(s => { s.modules.offeredCoursesStickyHeader = els.toggleOCStickyHeader.checked; }, 'Sticky header updated');
    });
    els.toggleOCColorLeft.addEventListener('change', () => {
      updateSetting(s => { s.modules.offeredCoursesColorLeft = els.toggleOCColorLeft.checked; }, 'Seat indicators updated');
    });
    els.toggleOCSearchBox.addEventListener('change', () => {
      updateSetting(s => { s.modules.offeredCoursesSearchBox = els.toggleOCSearchBox.checked; }, 'Course search updated');
    });
    els.inputOCSearchPlaceholder.addEventListener('change', () => {
      updateSetting(s => { s.modules.offeredCoursesSearchPlaceholder = els.inputOCSearchPlaceholder.value.trim(); }, 'Placeholder saved');
    });

    // Routine Generator
    els.toggleRoutine.addEventListener('change', () => {
      const checked = els.toggleRoutine.checked;
      updateSubVisibility(els.subRoutine, checked);
      updateSetting(s => { s.modules.routineGenerator = checked; }, 'Routine Generator updated');
    });
    els.toggleCompact.addEventListener('change', () => {
      updateSetting(s => { s.modules.routineCompact = els.toggleCompact.checked; }, 'Compact mode updated');
    });
    els.toggleShowLogo.addEventListener('change', () => {
      updateSetting(s => { s.modules.routineShowLogo = els.toggleShowLogo.checked; }, 'Logo visibility updated');
    });
    els.selectBlueIntensity.addEventListener('change', () => {
      updateSetting(s => { s.modules.routineBlueIntensity = els.selectBlueIntensity.value; }, 'Theme intensity saved');
    });
    els.selectExportQuality.addEventListener('change', () => {
      updateSetting(s => { s.modules.routineExportQuality = els.selectExportQuality.value; }, 'Export quality saved');
    });

    // Schedule Enhancer
    els.toggleScheduleEnhancer.addEventListener('change', () => {
      const checked = els.toggleScheduleEnhancer.checked;
      updateSubVisibility(els.subScheduleEnhancer, checked);
      updateSetting(s => { s.modules.scheduleEnhancer = checked; }, checked ? 'Schedule Enhancer Enabled' : 'Schedule Enhancer Disabled');
    });
    els.toggleScheduleEmailLink.addEventListener('change', () => {
      updateSetting(s => { s.modules.scheduleEmailLink = els.toggleScheduleEmailLink.checked; }, 'Faculty email links updated');
    });
    els.toggleScheduleSummaryCard.addEventListener('change', () => {
      updateSetting(s => { s.modules.scheduleSummaryCard = els.toggleScheduleSummaryCard.checked; }, 'Summary card updated');
    });

    // Login Helper
    els.toggleLoginHelper.addEventListener('change', () => {
      const checked = els.toggleLoginHelper.checked;
      updateSubVisibility(els.subLogin, checked);
      updateSetting(s => { s.modules.loginHelper = checked; }, 'Login Helper updated');
    });
    els.toggleAutoFill.addEventListener('change', () => {
      updateSetting(s => { s.modules.loginHelperAutoFill = els.toggleAutoFill.checked; }, 'Auto-fill updated');
    });
    els.inputDelay.addEventListener('change', () => {
      const delay = parseInt(els.inputDelay.value, 10) || 300;
      updateSetting(s => { s.modules.loginHelperDelay = delay; }, `Delay set to ${delay}ms`);
    });
    els.toggleDebug.addEventListener('change', () => {
      updateSetting(s => { s.modules.loginHelperDebug = els.toggleDebug.checked; }, 'Debug mode updated');
    });

    // Export Data
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

    // Import Data
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

    // Reset Defaults
    els.btnReset.addEventListener('click', async () => {
      if (confirm('Reset all EWU Buddy settings to factory default?')) {
        const defaults = structuredClone(DEFAULT_SETTINGS);
        await saveSettings(defaults);
        broadcastSettings(defaults);
        renderUI(defaults);
        showToast('Settings reset to default!');
      }
    });

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

  async function updateLicenseStatusUI() {
    const dot = document.getElementById('licBadgeDot');
    const text = document.getElementById('licStatusText');
    const sub = document.getElementById('licSubText');
    const btn = document.getElementById('btnManageLicense');
    
    if (btn) {
      btn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'OPEN_ACTIVATION_PAGE' });
        }
      });
    }
    
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    // Check remote system status (Shutdown, Update, Notice)
    chrome.storage.local.get(['ewu_system_shutdown', 'ewu_system_update', 'ewu_system_notice'], (sysRes) => {
      const shutdown = sysRes.ewu_system_shutdown || { enabled: false };
      const update = sysRes.ewu_system_update || { isMandatory: false, minVersion: '2.0.0' };
      const notice = sysRes.ewu_system_notice || { enabled: false };

      const container = document.querySelector('.search-nav-container');
      const content = document.querySelector('.content-body');
      
      // Remove any existing lock overlay or notice banner first
      const oldOverlay = document.getElementById('ewu-popup-lock-overlay');
      if (oldOverlay) oldOverlay.remove();
      const oldNotice = document.getElementById('ewu-popup-broadcast-banner');
      if (oldNotice) oldNotice.remove();
      
      if (container) { container.style.filter = ''; container.style.pointerEvents = ''; }
      if (content) { content.style.filter = ''; content.style.pointerEvents = ''; }

      const manifestVer = chrome.runtime.getManifest().version || '2.0.0';

      // 1. Check for Emergency Shutdown
      if (shutdown.enabled) {
        if (dot) dot.style.background = '#f43f5e';
        if (text) text.textContent = 'System Shutdown';
        if (sub) sub.textContent = 'Disabled by administrator';

        if (container) { container.style.filter = 'blur(6px)'; container.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(6px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:120px; left:0; width:100%; height:calc(100% - 120px); background:rgba(7,10,19,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); box-sizing:border-box; text-align:center;';
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

      // 2. Check for Mandatory Update
      if (update.isMandatory && isVersionOutdated(manifestVer, update.minVersion)) {
        if (dot) dot.style.background = '#f59e0b';
        if (text) text.textContent = 'Update Required';
        if (sub) sub.textContent = `v${manifestVer} -> v${update.latestVersion || update.minVersion}`;

        if (container) { container.style.filter = 'blur(6px)'; container.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(6px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:120px; left:0; width:100%; height:calc(100% - 120px); background:rgba(7,10,19,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); box-sizing:border-box; text-align:center;';
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
            } else {
              chrome.runtime.sendMessage({ type: 'OPEN_UPDATE_PAGE' });
            }
          });
        }
        return;
      }

      // 3. Render Broadcast Notice Banner if active
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
        banner.style.cssText = `margin:8px 12px 0 12px; background:${bannerBg}; border:1px solid ${bannerBorder}; border-radius:10px; padding:10px 12px; font-size:11.5px; line-height:1.5; color:#f1f5f9;`;
        banner.innerHTML = `
          ${notice.title ? `<strong style="display:block; color:${bannerColor}; font-size:12px; margin-bottom:2px;">${notice.title}</strong>` : ''}
          <span>${notice.message}</span>
        `;
        const headerEl = document.querySelector('.header');
        if (headerEl && headerEl.nextSibling) {
          headerEl.parentNode.insertBefore(banner, headerEl.nextSibling);
        }
      }

      // 4. Verify License Authentication Token
      chrome.runtime.sendMessage({ type: 'GET_LICENSE_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.authorized) {
          if (dot) dot.style.background = '#f87171';
          if (text) text.textContent = 'Unactivated License';
          if (sub) sub.textContent = 'Enter key to unlock settings';
          
          if (container) { container.style.filter = 'blur(6px)'; container.style.pointerEvents = 'none'; }
          if (content) { content.style.filter = 'blur(6px)'; content.style.pointerEvents = 'none'; }
          
          const overlay = document.createElement('div');
          overlay.id = 'ewu-popup-lock-overlay';
          overlay.style.cssText = 'position:absolute; top:120px; left:0; width:100%; height:calc(100% - 120px); background:rgba(7,10,19,0.7); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(2px); box-sizing:border-box;';
          overlay.innerHTML = `
            <div style="width:100%; max-width:320px; background:rgba(15,23,42,0.95); border:1px solid rgba(99,102,241,0.25); border-radius:12px; padding:24px 20px; text-align:center; box-shadow:0 12px 32px rgba(0,0,0,0.6); box-sizing:border-box;">
              <div style="display:flex; justify-content:center; margin-bottom:14px; filter:drop-shadow(0 0 10px rgba(99,102,241,0.3));">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9m-1.5 1.5L10 13l-4 4-4-4 4-4 2.5-2.5m1.5-1.5L16.5 3.5 18 2z"/><circle cx="7.5" cy="16.5" r="1.5"/></svg>
              </div>
              <h3 style="color:#f3f4f6; font-size:14px; font-weight:700; margin-bottom:6px; font-family:sans-serif;">Activate EWU Buddy</h3>
              <p style="color:#9ca3af; font-size:11px; margin-bottom:14px; line-height:1.4; font-family:sans-serif;">Enter a valid license key to unlock your settings console and premium features.</p>
              <input type="text" id="popupLicenseKey" placeholder="XXXX-XXXX-XXXX-XXXX" style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.4); color:#fff; font-family:monospace; font-size:14px; text-align:center; outline:none; text-transform:uppercase; box-sizing:border-box;" />
              <div id="popupVerifyStatus" style="font-size:11px; color:#ef4444; margin-top:8px; display:none; font-family:sans-serif;"></div>
              <button id="btnPopupVerify" class="cyber-btn" style="width:100%; margin-top:14px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; border-radius:8px; font-weight:600; padding:10px; cursor:pointer; font-size:12px;">Verify & Activate</button>
              <div style="font-size:11px; margin-top:16px; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px; line-height:1.4; font-family:sans-serif;">
                <span style="color:#6b7280;">Don't have a license key?</span><br/>
                <button id="btnGetLicense" class="cyber-btn" style="width:100%; margin-top:8px; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.4); color:#a5b4fc; border-radius:8px; font-weight:600; padding:8px; cursor:pointer; font-size:11px;">Get License / Contact Owner</button>
              </div>
            </div>
          `;
          
          document.body.appendChild(overlay);

          const btnGetLicense = document.getElementById('btnGetLicense');
          if (btnGetLicense) {
            btnGetLicense.addEventListener('click', () => {
              window.open('https://t.me/AftabKabir', '_blank');
            });
          }

          const keyInput = document.getElementById('popupLicenseKey');
          if (keyInput) {
            keyInput.addEventListener('input', (e) => {
              const raw = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
              let formatted = '';
              for (let i = 0; i < raw.length && i < 16; i++) {
                if (i > 0 && i % 4 === 0) formatted += '-';
                formatted += raw[i];
              }
              e.target.value = formatted;
            });
          }

          const btnVerify = document.getElementById('btnPopupVerify');
          const statusBox = document.getElementById('popupVerifyStatus');
          
          if (btnVerify && keyInput) {
            btnVerify.addEventListener('click', async () => {
              const key = keyInput.value.trim();
              if (!key) return;
              
              btnVerify.disabled = true;
              btnVerify.textContent = 'Verifying key...';
              if (statusBox) statusBox.style.display = 'none';

              try {
                const deviceId = await getDeviceId();
                const response = await fetch(WORKER_URL + '/api/license/activate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ licenseKey: key, deviceId: deviceId })
                });
                const data = await response.json();
                
                if (response.ok && data.success) {
                  chrome.storage.local.set({
                    ewu_license_token: data.token,
                    ewu_license_exp: data.expiresAt,
                    ewu_license_prefix: data.licenseInfo ? data.licenseInfo.keyPrefix : ''
                  }, () => {
                    chrome.storage.local.get(STORAGE_KEY, (result) => {
                      const activeSettings = result[STORAGE_KEY] || DEFAULT_SETTINGS;
                      chrome.runtime.sendMessage({ type: 'EWU_SETTINGS_UPDATED', settings: activeSettings });
                    });
                    
                    showToast('License activated successfully!');
                    updateLicenseStatusUI();
                  });
                } else {
                  if (statusBox) {
                    statusBox.textContent = data.message || 'Invalid license key.';
                    statusBox.style.display = 'block';
                  }
                  btnVerify.disabled = false;
                  btnVerify.textContent = 'Verify & Activate';
                }
              } catch (err) {
                if (statusBox) {
                  statusBox.textContent = 'Verification server unreachable.';
                  statusBox.style.display = 'block';
                }
                btnVerify.disabled = false;
                btnVerify.textContent = 'Verify & Activate';
              }
            });
          }
        } else {
          if (dot) dot.style.background = '#34d399';
          if (text) text.textContent = 'Active Production License';
          const expStr = (res.licenseExpiresAt && Number(res.licenseExpiresAt) > 0) ? `Valid until ${new Date(Number(res.licenseExpiresAt)).toLocaleDateString()}` : 'Lifetime Access (Never Expires)';
          if (sub) sub.textContent = expStr;
        }
      });
    });
  }

  /* -----------------------------------------------------------
     INITIALIZATION
     ----------------------------------------------------------- */
  async function init() {
    log('Initializing Cyber Settings UI...');
    const settings = await loadSettings();
    renderUI(settings);
    bindEvents();
    updateLicenseStatusUI();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose for updates
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'EWU_SETTINGS_UPDATED') {
        updateLicenseStatusUI();
      }
    });
  }

})();
