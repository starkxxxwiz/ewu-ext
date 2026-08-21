(function () {
'use strict';
var WORKER_URL = 'https://ewu-helper-license-worker.tonystarkxxx31.workers.dev';
var form = document.getElementById('activationForm');
var keyInput = document.getElementById('licenseKey');
var btnActivate = document.getElementById('btnActivate');
var btnText = document.getElementById('btnText');
var btnSpinner = document.getElementById('btnSpinner');
var statusBox = document.getElementById('statusBox');

keyInput.addEventListener('input', function (e) {
  var raw = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  var formatted = '';
  for (var i = 0; i < raw.length && i < 16; i++) {
    if (i > 0 && i % 4 === 0) formatted += '-';
    formatted += raw[i];
  }
  e.target.value = formatted;
});

function getDeviceId() {
  return new Promise(function (resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      var localId = localStorage.getItem('ewu_device_id');
      if (!localId) {
        localId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('ewu_device_id', localId);
      }
      resolve(localId);
      return;
    }
    chrome.storage.local.get('ewu_device_id', function (res) {
      var deviceId = res.ewu_device_id;
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        chrome.storage.local.set({ ewu_device_id: deviceId });
      }
      resolve(deviceId);
    });
  });
}

function checkExistingActivation() {
  if (typeof chrome === 'undefined' || !chrome.storage) return;
  chrome.storage.local.get(['ewu_license_token', 'ewu_license_exp'], function (res) {
    if (res.ewu_license_token && res.ewu_license_exp && Date.now() < res.ewu_license_exp) {
      showStatus('Extension is currently activated! You can close this tab and return to the portal.', 'success');
    }
  });
}

checkExistingActivation();

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  var licenseKey = keyInput.value.trim();
  if (!licenseKey) return;
  setLoading(true);
  hideStatus();
  try {
    var deviceId = await getDeviceId();
    var response = await fetch(WORKER_URL + '/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: licenseKey,
        deviceId: deviceId
      })
    });
    var data = await response.json();
    if (response.ok && data.success) {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({
          ewu_license_token: data.token,
          ewu_license_exp: data.expiresAt,
          ewu_license_prefix: data.licenseInfo ? data.licenseInfo.keyPrefix : ''
        });
      } else {
        localStorage.setItem('ewu_license_token', data.token);
        localStorage.setItem('ewu_license_exp', data.expiresAt);
      }
      showStatus('🎉 License activated successfully! Thank you for using EWU Portal Helper.', 'success');
      keyInput.value = '';
      setTimeout(function () {
        window.close();
      }, 3000);
    } else {
      showStatus(data.message || 'Invalid or inactive license key. Please check your key or contact the owner.', 'error');
    }
  } catch (err) {
    showStatus('Unable to reach verification server. Please check your internet connection or try again later.', 'error');
  } finally {
    setLoading(false);
  }
});

function setLoading(loading) {
  btnActivate.disabled = loading;
  btnText.style.display = loading ? 'none' : 'inline';
  btnSpinner.style.display = loading ? 'inline-block' : 'none';
}

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = 'status-box status-' + type;
  statusBox.style.display = 'block';
}

function hideStatus() {
  statusBox.style.display = 'none';
}
})();
