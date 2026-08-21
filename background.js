var WORKER_URL = 'https://ewu-helper-license-worker.tonystarkxxx31.workers.dev';

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    chrome.storage.local.get(['ewu_license_token', 'ewu_license_exp'], function (res) {
      var hasValidToken = res.ewu_license_token && res.ewu_license_exp && Date.now() < res.ewu_license_exp;
      if (!hasValidToken) {
        chrome.tabs.create({ url: chrome.runtime.getURL('activation.html') });
      }
    });
  }
});

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
    chrome.storage.local.get(['ewu_license_token', 'ewu_license_exp', 'ewu_device_id'], async function (res) {
      var token = res.ewu_license_token;
      var exp = res.ewu_license_exp;
      var deviceId = res.ewu_device_id || await getDeviceId();
      if (!token || !exp || Date.now() > exp) {
        resolve({ authorized: false, reason: 'No active license token found.' });
        return;
      }
      try {
        var response = await fetch(WORKER_URL + '/api/license/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, deviceId: deviceId })
        });
        var data = await response.json();
        if (response.ok && data.valid) {
          resolve({ authorized: true, expiresAt: data.expiresAt });
        } else {
          chrome.storage.local.remove(['ewu_license_token', 'ewu_license_exp']);
          resolve({ authorized: false, reason: data.reason || 'License token invalidated by server.' });
        }
      } catch (err) {
        if (Date.now() < exp) {
          resolve({ authorized: true, offlineFallback: true });
        } else {
          resolve({ authorized: false, reason: 'Server verification unavailable.' });
        }
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
  if (message && message.type === 'OPEN_ACTIVATION_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL('activation.html') });
    sendResponse({ success: true });
  }
});


