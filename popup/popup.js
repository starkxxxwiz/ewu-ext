/* =============================================================
   EWU Buddy - Settings Popup Script
   ============================================================= */

(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONSTANTS & DEFAULTS
     ----------------------------------------------------------- */
  const STORAGE_KEY = 'ewu_portal_helper_settings';
  const LOG_PREFIX = '[EWU Settings]';

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
    emptySearchState: document.getElementById('emptySearchState'),
    btnClearSearch: document.getElementById('btnClearSearch'),

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

    // General Actions
    btnViewFeatures: document.getElementById('btnViewFeatures'),

    // License Badge & Button
    licBadgeDot: document.getElementById('licBadgeDot'),
    licStatusText: document.getElementById('licStatusText'),
    btnManageLicense: document.getElementById('btnManageLicense'),

    // Dedicated Licence Tab Elements
    tabLicDot: document.getElementById('tabLicDot'),
    tabLicStatusText: document.getElementById('tabLicStatusText'),
    tabLicTypeBadge: document.getElementById('tabLicTypeBadge'),
    tabLicPrefix: document.getElementById('tabLicPrefix'),
    tabLicExpiry: document.getElementById('tabLicExpiry'),
    btnManageLicPage: document.getElementById('btnManageLicPage'),
    btnChangeLicenseKey: document.getElementById('btnChangeLicenseKey'),
    btnRefreshLicense: document.getElementById('btnRefreshLicense'),
    btnContactSupport: document.getElementById('btnContactSupport'),

    // Toast
    toast: document.getElementById('toast'),
  };

  /* -----------------------------------------------------------
     UTILITY HELPERS
     ----------------------------------------------------------- */
  function log(...args) { console.log(LOG_PREFIX, ...args); }

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
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
    duration = duration || 2200;
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
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          try { resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), JSON.parse(local))); return; } catch (_) {}
        }
        resolve(structuredClone(DEFAULT_SETTINGS));
        return;
      }
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = result && result[STORAGE_KEY] ? result[STORAGE_KEY] : {};
        resolve(deepMerge(structuredClone(DEFAULT_SETTINGS), stored));
      });
    });
  }

  function saveSettings(settings) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        resolve();
        return;
      }
      chrome.storage.local.set({ [STORAGE_KEY]: settings }, resolve);
    });
  }

  function broadcastSettings(settings) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.query({ url: 'https://portal.ewubd.edu/*' }, (tabs) => {
      if (!tabs) return;
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
      if (els.emptySearchState) els.emptySearchState.style.display = 'none';
    }

    // Header Manage Licence Button -> Navigate to Licence tab
    if (els.btnManageLicense) {
      els.btnManageLicense.addEventListener('click', (e) => {
        e.preventDefault();
        if (els.settingsSearch) els.settingsSearch.value = '';
        applyTabFilter('license');
      });
    }

    // Dedicated Licence Tab Action Buttons
    if (els.btnChangeLicenseKey) {
      els.btnChangeLicenseKey.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: chrome.runtime.getURL('pages/activation.html') });
        } else {
          window.open('pages/activation.html', '_blank');
        }
      });
    }

    if (els.btnRefreshLicense) {
      els.btnRefreshLicense.addEventListener('click', () => {
        showToast('Syncing licence status...');
        updateLicenseStatusUI();
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'CHECK_REMOTE_STATUS' }).catch(() => {});
        }
      });
    }

    if (els.btnContactSupport) {
      els.btnContactSupport.addEventListener('click', () => {
        window.open('https://t.me/AftabKabir', '_blank');
      });
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

        let totalVisibleCards = 0;
        els.settingCards.forEach((card) => {
          const text = card.textContent.toLowerCase();
          const match = text.includes(query);
          card.style.display = match ? 'block' : 'none';
          if (match) totalVisibleCards++;
        });

        els.settingGroups.forEach((grp) => {
          const hasVisible = Array.from(grp.querySelectorAll('.setting-card')).some(c => c.style.display !== 'none');
          grp.style.display = hasVisible ? 'block' : 'none';
        });

        if (els.emptySearchState) {
          els.emptySearchState.style.display = totalVisibleCards === 0 ? 'block' : 'none';
        }
      });
    }

    if (els.btnClearSearch) {
      els.btnClearSearch.addEventListener('click', () => {
        if (els.settingsSearch) els.settingsSearch.value = '';
        applyTabFilter(currentTab);
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
        updateSetting(s => { s.modules.routineBlueIntensity = els.selectBlueIntensity.value; }, 'Theme palette saved');
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

    // View Features Guide
    if (els.btnViewFeatures) {
      els.btnViewFeatures.addEventListener('click', () => {
        const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
          ? chrome.runtime.getURL('pages/activation.html?mode=features')
          : 'pages/activation.html?mode=features';
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url });
        } else {
          window.open(url, '_blank');
        }
      });
    }

    // License Management Actions
    function openLicensePage(action) {
      const query = action ? `?mode=license&action=${action}` : '?mode=license';
      const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL(`pages/activation.html${query}`)
        : `pages/activation.html${query}`;
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    }

    if (els.btnManageLicense) {
      els.btnManageLicense.addEventListener('click', () => openLicensePage());
    }
    if (els.btnManageLicPage) {
      els.btnManageLicPage.addEventListener('click', () => openLicensePage());
    }
    if (els.btnChangeLicenseKey) {
      els.btnChangeLicenseKey.addEventListener('click', () => openLicensePage('change'));
    }
    if (els.btnRefreshLicense) {
      els.btnRefreshLicense.addEventListener('click', () => {
        showToast('Syncing licence status...');
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ type: 'CHECK_REMOTE_STATUS' }).then(() => {
            setTimeout(updateLicenseStatusUI, 600);
          }).catch(() => {
            updateLicenseStatusUI();
          });
        } else {
          updateLicenseStatusUI();
        }
      });
    }
    if (els.btnContactSupport) {
      els.btnContactSupport.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.create({ url: 'https://t.me/AftabKabir' });
        } else {
          window.open('https://t.me/AftabKabir', '_blank');
        }
      });
    }
  }

  /* -----------------------------------------------------------
     LICENSING & REMOTE STATUS ENFORCEMENT
     ----------------------------------------------------------- */
  function isLicenseAuthorizedLocally(res) {
    if (!res || !res.ewu_license_token) return false;
    if (res.ewu_license_status === 'inactive' || res.ewu_license_status === 'revoked' || res.ewu_license_status === 'expired') {
      return false;
    }
    const licExp = res.ewu_license_expiry;
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
      'ewu_license_prefix',
      'ewu_system_shutdown',
      'ewu_system_update',
      'ewu_system_notice'
    ], (res) => {
      const shutdown = res.ewu_system_shutdown || { enabled: false };
      const update = res.ewu_system_update || { isMandatory: false, minVersion: '1.2.0' };
      const notice = res.ewu_system_notice || { enabled: false };

      const navContainer = document.querySelector('.nav-container');
      const content = document.querySelector('.content-body');

      // Clear any prior lock overlays or notice banners
      const oldOverlay = document.getElementById('ewu-popup-lock-overlay');
      if (oldOverlay) oldOverlay.remove();
      const oldNotice = document.getElementById('ewu-popup-broadcast-banner');
      if (oldNotice) oldNotice.remove();
      const oldUpNotice = document.getElementById('ewu-popup-update-banner');
      if (oldUpNotice) oldUpNotice.remove();

      if (navContainer) { navContainer.style.filter = ''; navContainer.style.pointerEvents = ''; }
      if (content) { content.style.filter = ''; content.style.pointerEvents = ''; }

      const manifestVer = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '1.2.0';
      const isOutdated = isVersionOutdated(manifestVer, update.minVersion);
      const isUpdateAvailable = update.latestVersion && isVersionOutdated(manifestVer, update.latestVersion);

      // PRIORITY 1: Emergency Remote Killswitch
      if (shutdown.enabled) {
        if (els.licBadgeDot) {
          els.licBadgeDot.className = 'status-dot inactive';
        }
        if (els.licStatusText) els.licStatusText.textContent = 'System Shutdown';

        if (navContainer) { navContainer.style.filter = 'blur(5px)'; navContainer.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(5px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:110px; left:0; width:100%; height:calc(100% - 110px); background:rgba(11,15,25,0.92); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; text-align:center;';
        overlay.innerHTML = `
          <div style="width:100%; max-width:320px; background:#111827; border:1px solid rgba(239,68,68,0.3); border-radius:12px; padding:20px 16px; box-sizing:border-box;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#ef4444;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 style="color:#fff; font-size:14px; font-weight:700; margin-bottom:6px;">${shutdown.title || 'System Temporarily Offline'}</h3>
            <p style="color:#9ca3af; font-size:11.5px; line-height:1.5; margin-bottom:12px;">${shutdown.message || 'EWU Buddy is currently disabled by administrator.'}</p>
            <span style="font-size:10.5px; font-weight:600; color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:3px 10px; border-radius:10px;">Modules Locked</span>
          </div>
        `;
        document.body.appendChild(overlay);
        return;
      }

      // PRIORITY 2: Mandatory Extension Update
      if (update.isMandatory && isOutdated) {
        if (els.licBadgeDot) {
          els.licBadgeDot.className = 'status-dot inactive';
        }
        if (els.licStatusText) els.licStatusText.textContent = 'Update Required';

        if (navContainer) { navContainer.style.filter = 'blur(5px)'; navContainer.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(5px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:110px; left:0; width:100%; height:calc(100% - 110px); background:rgba(11,15,25,0.92); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; text-align:center;';
        overlay.innerHTML = `
          <div style="width:100%; max-width:320px; background:#111827; border:1px solid rgba(217,78,52,0.3); border-radius:12px; padding:20px 16px; box-sizing:border-box;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(217,78,52,0.15); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#fda4af;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            </div>
            <h3 style="color:#fff; font-size:14px; font-weight:700; margin-bottom:6px;">${update.title || 'Update Required'}</h3>
            <p style="color:#9ca3af; font-size:11.5px; line-height:1.5; margin-bottom:14px;">A required update is available (v${update.latestVersion || update.minVersion}). Please update to continue using EWU Buddy.</p>
            <button id="btnPopupUpdateAction" class="btn-action" style="width:100%; background:var(--primary); border:none; justify-content:center;">
              Download Update Now
            </button>
          </div>
        `;
        document.body.appendChild(overlay);
        const btnUp = document.getElementById('btnPopupUpdateAction');
        if (btnUp) {
          btnUp.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
              chrome.tabs.create({ url: chrome.runtime.getURL('pages/update.html') });
            } else if (update.updateUrl) {
              window.open(update.updateUrl, '_blank');
            } else {
              window.open('pages/update.html', '_blank');
            }
          });
        }
        return;
      }

      // PRIORITY 3: License Authorization Check
      const hasValidLicense = isLicenseAuthorizedLocally(res);

      if (!hasValidLicense) {
        if (els.licBadgeDot) {
          els.licBadgeDot.className = 'status-dot inactive';
        }
        if (els.licStatusText) els.licStatusText.textContent = 'Licence Inactive';

        if (els.tabLicDot) els.tabLicDot.className = 'status-dot inactive';
        if (els.tabLicStatusText) els.tabLicStatusText.textContent = 'Licence Inactive';
        if (els.tabLicTypeBadge) { els.tabLicTypeBadge.textContent = 'INACTIVE'; els.tabLicTypeBadge.style.color = 'var(--rose)'; }
        if (els.tabLicPrefix) els.tabLicPrefix.textContent = 'None';
        if (els.tabLicExpiry) els.tabLicExpiry.textContent = 'Activation Required';

        if (navContainer) { navContainer.style.filter = 'blur(5px)'; navContainer.style.pointerEvents = 'none'; }
        if (content) { content.style.filter = 'blur(5px)'; content.style.pointerEvents = 'none'; }

        const overlay = document.createElement('div');
        overlay.id = 'ewu-popup-lock-overlay';
        overlay.style.cssText = 'position:absolute; top:110px; left:0; width:100%; height:calc(100% - 110px); background:rgba(11,15,25,0.92); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:18px; box-sizing:border-box; text-align:center;';
        overlay.innerHTML = `
          <div style="width:100%; max-width:320px; background:#111827; border:1px solid var(--border); border-radius:12px; padding:22px 18px; box-sizing:border-box;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(217,78,52,0.12); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; color:#fda4af;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 style="color:#ffffff; font-size:14px; font-weight:700; margin-bottom:6px;">Licence Activation Required</h3>
            <p style="color:#9ca3af; font-size:11.5px; line-height:1.5; margin-bottom:16px;">Activate your licence key to unlock automatic captcha solving, class routines, and advising planner.</p>
            <button id="btnPopupActivateAction" class="btn-action" style="width:100%; background:var(--primary); border:none; justify-content:center;">
              Activate Licence Key
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

      // User is Authorized
      if (els.licBadgeDot) {
        els.licBadgeDot.className = 'status-dot';
      }
      if (els.licStatusText) els.licStatusText.textContent = 'Licence Active';

      if (els.tabLicDot) els.tabLicDot.className = 'status-dot';
      if (els.tabLicStatusText) els.tabLicStatusText.textContent = 'Licence Active & Verified';
      if (els.tabLicTypeBadge) { els.tabLicTypeBadge.textContent = 'ACTIVE'; els.tabLicTypeBadge.style.color = 'var(--emerald)'; }
      if (els.tabLicPrefix) els.tabLicPrefix.textContent = res.ewu_license_prefix || 'XXXX-...';
      if (els.tabLicExpiry) {
        if (res.ewu_license_expiry && Number(res.ewu_license_expiry) > 0) {
          const d = new Date(Number(res.ewu_license_expiry));
          els.tabLicExpiry.textContent = isNaN(d.getTime()) ? 'Lifetime Access' : d.toLocaleDateString();
        } else {
          els.tabLicExpiry.textContent = 'Lifetime Access (Never Expires)';
        }
      }

      const headerEl = document.querySelector('.header');

      // Optional Update Available Banner
      const showUpdateNotice = (typeof update.showNotice === 'boolean') ? update.showNotice : (update.show_update_notice !== false);
      if (isUpdateAvailable && !update.isMandatory && showUpdateNotice) {
        const upBanner = document.createElement('div');
        upBanner.id = 'ewu-popup-update-banner';
        upBanner.style.cssText = 'margin:8px 14px 0 14px; background:rgba(59,130,246,0.14); border:1px solid rgba(59,130,246,0.35); border-radius:10px; padding:8px 12px; font-size:11.5px; line-height:1.4; color:#f1f5f9; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.15s ease;';
        upBanner.innerHTML = `
          <div style="display:flex; align-items:center; gap:7px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            <span style="font-weight:600;"><strong style="color:#60a5fa;">Update v${update.latestVersion}</strong> available</span>
          </div>
          <span style="color:#38bdf8; font-weight:700; font-size:11.5px; display:inline-flex; align-items:center; gap:3px;">Update &rarr;</span>
        `;
        upBanner.addEventListener('click', () => {
          if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/update.html') });
          } else if (update.updateUrl) {
            window.open(update.updateUrl, '_blank');
          } else {
            window.open('pages/update.html', '_blank');
          }
        });
        if (headerEl && headerEl.nextSibling) {
          headerEl.parentNode.insertBefore(upBanner, headerEl.nextSibling);
        }
      }

      // Broadcast Notice Banner
      if (notice.enabled && (notice.title || notice.message)) {
        let bannerBg = 'rgba(59, 130, 246, 0.12)';
        let bannerBorder = 'rgba(59, 130, 246, 0.3)';
        let bannerColor = '#60a5fa';
        if (notice.type === 'warning') {
          bannerBg = 'rgba(245, 158, 11, 0.12)';
          bannerBorder = 'rgba(245, 158, 11, 0.3)';
          bannerColor = '#f59e0b';
        } else if (notice.type === 'alert') {
          bannerBg = 'rgba(239, 68, 68, 0.12)';
          bannerBorder = 'rgba(239, 68, 68, 0.3)';
          bannerColor = '#ef4444';
        }

        const banner = document.createElement('div');
        banner.id = 'ewu-popup-broadcast-banner';
        banner.style.cssText = `margin:8px 14px 0 14px; background:${bannerBg}; border:1px solid ${bannerBorder}; border-radius:8px; padding:8px 10px; font-size:11.5px; line-height:1.45; color:#f1f5f9; position:relative;`;
        banner.innerHTML = `
          <button style="position:absolute; top:4px; right:6px; background:transparent; border:none; color:#9ca3af; font-size:12px; cursor:pointer;" onclick="this.parentElement.remove()">✕</button>
          ${notice.title ? `<strong style="display:block; color:${bannerColor}; font-size:11.5px; margin-bottom:2px;">${notice.title}</strong>` : ''}
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
    log('Initializing Settings UI...');
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
