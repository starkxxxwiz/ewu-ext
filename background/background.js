var WORKER_URL = 'https://ewu-helper-license-worker.tonystarkxxx31.workers.dev';

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

function isLicenseAuthorizedLocally(res) {
  if (!res || !res.ewu_license_token) return false;
  if (res.ewu_license_status === 'inactive' || res.ewu_license_status === 'revoked' || res.ewu_license_status === 'expired') {
    return false;
  }
  // Check subscription expiry (null/0/undefined means Lifetime Perpetual)
  var licExp = res.ewu_license_expiry;
  if (licExp && typeof licExp === 'number' && licExp > 0) {
    if (Date.now() > licExp) return false;
  }
  return true;
}

async function checkRemoteSystemState() {
  try {
    var response = await fetch(WORKER_URL + '/api/system/status');
    if (!response.ok) return;
    var data = await response.json();
    if (!data || !data.success) return;

    var shutdown = data.shutdown || { enabled: false };
    var notice = data.notice || { enabled: false };
    var update = data.update || { is_mandatory: false, min_version: '1.1.0' };

    chrome.storage.local.set({
      ewu_system_shutdown: shutdown,
      ewu_system_notice: notice,
      ewu_system_update: {
        minVersion: update.min_version,
        latestVersion: update.latest_version,
        title: update.title,
        changelog: update.changelog,
        updateUrl: update.update_url,
        isMandatory: Boolean(update.is_mandatory),
        showNotice: Boolean(update.show_update_notice !== false)
      }
    });

    // Priority 2: Mandatory Update Enforcer
    var currentVer = chrome.runtime.getManifest().version || '1.1.0';
    if (update.is_mandatory && isVersionOutdated(currentVer, update.min_version)) {
      chrome.storage.local.get(['ewu_update_tab_opened'], function (res) {
        if (!res.ewu_update_tab_opened) {
          chrome.tabs.create({ url: chrome.runtime.getURL('pages/update.html') });
          chrome.storage.local.set({ ewu_update_tab_opened: true });
        }
      });
    } else {
      chrome.storage.local.remove(['ewu_update_tab_opened']);
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(function (details) {
  checkRemoteSystemState();
  if (details.reason === 'install') {
    chrome.storage.local.get(['ewu_license_token', 'ewu_license_status', 'ewu_license_expiry', 'ewu_license_exp'], function (res) {
      if (!isLicenseAuthorizedLocally(res)) {
        chrome.tabs.create({ url: chrome.runtime.getURL('pages/activation.html') });
      }
    });
  }
  // Periodic background check alarm (10 minutes)
  try {
    chrome.alarms.create('check_remote_status', { periodInMinutes: 10 });
  } catch (_) {}
});

chrome.runtime.onStartup.addListener(function () {
  checkRemoteSystemState();
});

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name === 'check_remote_status') {
      checkRemoteSystemState();
    }
  });
}

function getDeviceId() {
  return new Promise(function (resolve) {
    chrome.storage.local.get('ewu_device_id', function (res) {
      var id = res.ewu_device_id;
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        chrome.storage.local.set({ ewu_device_id: id });
      }
      resolve(id);
    });
  });
}

async function verifyLicenseToken() {
  return new Promise(function (resolve) {
    chrome.storage.local.get([
      'ewu_license_token',
      'ewu_license_status',
      'ewu_license_expiry',
      'ewu_license_exp',
      'ewu_license_prefix',
      'ewu_device_id'
    ], function (res) {
      var isLocallyValid = isLicenseAuthorizedLocally(res);
      if (!isLocallyValid) {
        resolve({ authorized: false, reason: 'No active license authorization found.' });
        return;
      }

      // Fast-path: Instant zero-latency authorization for content and popup
      resolve({ authorized: true, expiresAt: res.ewu_license_expiry || null });

      // Silent background server re-verification
      var token = res.ewu_license_token;
      var checkServer = function (devId) {
        fetch(WORKER_URL + '/api/license/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, deviceId: devId })
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (data && data.valid) {
            chrome.storage.local.set({
              ewu_license_status: 'active',
              ewu_license_expiry: data.licenseExpiresAt,
              ewu_license_prefix: data.licensePrefix || res.ewu_license_prefix
            });
            if (data.system) {
              var u = data.system.update || {};
              chrome.storage.local.set({
                ewu_system_shutdown: data.system.shutdown || { enabled: false },
                ewu_system_notice: data.system.notice || { enabled: false },
                ewu_system_update: {
                  minVersion: u.min_version || '1.1.0',
                  latestVersion: u.latest_version || '1.1.0',
                  title: u.title || '',
                  changelog: u.changelog || '',
                  updateUrl: u.update_url || '',
                  isMandatory: Boolean(u.is_mandatory),
                  showNotice: Boolean(u.show_update_notice !== false)
                }
              });
            }
          } else if (data && data.valid === false) {
            // Explicitly revoked or deleted by admin
            chrome.storage.local.set({ ewu_license_status: 'inactive' });
            chrome.storage.local.remove(['ewu_license_token', 'ewu_license_expiry']);
          }
        }).catch(function () {
          // Network drop / offline: DO NOT log out user! Keep authorized!
        });
      };

      if (!res.ewu_device_id) {
        getDeviceId().then(checkServer);
      } else {
        checkServer(res.ewu_device_id);
      }
    });
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message && message.type === 'GET_LICENSE_STATUS') {
    verifyLicenseToken().then(function (result) {
      sendResponse(result);
    });
    return true;
  }
  if (message && message.type === 'CHECK_REMOTE_STATUS') {
    checkRemoteSystemState().then(function () {
      sendResponse({ success: true });
    });
    return true;
  }
  if (message && message.type === 'OPEN_ACTIVATION_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/activation.html') });
    sendResponse({ success: true });
  }
  if (message && message.type === 'OPEN_UPDATE_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/update.html') });
    sendResponse({ success: true });
  }
});
