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

async function checkRemoteSystemState() {
  try {
    var response = await fetch(WORKER_URL + '/api/system/status');
    if (!response.ok) return;
    var data = await response.json();
    if (!data || !data.success) return;

    var shutdown = data.shutdown || { enabled: false };
    var notice = data.notice || { enabled: false };
    var update = data.update || { is_mandatory: false, min_version: '2.0.0' };

    chrome.storage.local.set({
      ewu_system_shutdown: shutdown,
      ewu_system_notice: notice,
      ewu_system_update: {
        minVersion: update.min_version,
        latestVersion: update.latest_version,
        title: update.title,
        changelog: update.changelog,
        updateUrl: update.update_url,
        isMandatory: Boolean(update.is_mandatory)
      }
    });

    // If update is mandatory and current version is outdated, trigger update tab
    var currentVer = chrome.runtime.getManifest().version || '2.0.0';
    if (update.is_mandatory && isVersionOutdated(currentVer, update.min_version)) {
      chrome.storage.local.get(['ewu_update_tab_opened'], function (res) {
        if (!res.ewu_update_tab_opened) {
          chrome.tabs.create({ url: chrome.runtime.getURL('update.html') });
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
    chrome.storage.local.get(['ewu_license_token', 'ewu_license_exp'], function (res) {
      var hasValidToken = res.ewu_license_token && res.ewu_license_exp && Date.now() < res.ewu_license_exp;
      if (!hasValidToken) {
        chrome.tabs.create({ url: chrome.runtime.getURL('activation.html') });
      }
    });
  }
  // Setup periodic alarm
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
    chrome.storage.local.get(['ewu_license_token', 'ewu_license_exp', 'ewu_device_id'], function (res) {
      var token = res.ewu_license_token;
      var exp = res.ewu_license_exp;
      var deviceId = res.ewu_device_id;
      if (!token || !exp || Date.now() > exp) {
        resolve({ authorized: false, reason: 'No active license token found.' });
        return;
      }

      // Resolve immediately for 0ms latency in UI
      resolve({ authorized: true, expiresAt: exp });

      // Async background server sync
      var checkServer = function (devId) {
        fetch(WORKER_URL + '/api/license/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, deviceId: devId })
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (data && data.valid) {
            if (data.system) {
              chrome.storage.local.set({
                ewu_system_shutdown: data.system.shutdown || { enabled: false },
                ewu_system_notice: data.system.notice || { enabled: false },
                ewu_system_update: {
                  minVersion: data.system.update?.min_version || '2.0.0',
                  latestVersion: data.system.update?.latest_version || '2.0.0',
                  title: data.system.update?.title || '',
                  changelog: data.system.update?.changelog || '',
                  updateUrl: data.system.update?.update_url || '',
                  isMandatory: Boolean(data.system.update?.is_mandatory)
                }
              });
            }
          } else if (data && !data.valid) {
            chrome.storage.local.remove(['ewu_license_token', 'ewu_license_exp']);
          }
        }).catch(function () {});
      };

      if (!deviceId) {
        getDeviceId().then(checkServer);
      } else {
        checkServer(deviceId);
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
    chrome.tabs.create({ url: chrome.runtime.getURL('activation.html') });
    sendResponse({ success: true });
  }
  if (message && message.type === 'OPEN_UPDATE_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL('update.html') });
    sendResponse({ success: true });
  }
});


