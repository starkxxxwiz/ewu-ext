(function () {
  'use strict';
  var WORKER_URL = 'https://ewu-helper-license-worker.tonystarkxxx31.workers.dev';
  var form = document.getElementById('activationForm');
  var keyInput = document.getElementById('licenseKey');
  var btnActivate = document.getElementById('btnActivate');
  var btnText = document.getElementById('btnText');
  var btnSpinner = document.getElementById('btnSpinner');
  var statusBox = document.getElementById('statusBox');
  var cancelChangeWrap = document.getElementById('cancelChangeWrap');
  var btnCancelChange = document.getElementById('btnCancelChange');
  var btnChangeLicense = document.getElementById('btnChangeLicense');
  var btnGetLicensePage = document.getElementById('btnGetLicensePage');

  var currentLicenseState = null;

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

  function renderSubscribedView(prefix, expiresAt) {
    var mainView = document.getElementById('activationMainView');
    var subView = document.getElementById('subscribedView');
    var prefixEl = document.getElementById('subKeyPrefix');
    var expiryEl = document.getElementById('subExpiryText');

    if (prefixEl) prefixEl.textContent = prefix || 'XXXX-...';
    if (expiryEl) {
      if (expiresAt && Number(expiresAt) > 0) {
        var d = new Date(Number(expiresAt));
        expiryEl.textContent = isNaN(d.getTime()) ? 'Lifetime Access' : d.toLocaleDateString();
      } else {
        expiryEl.textContent = 'Lifetime Access (Never Expires)';
      }
    }

    if (mainView) mainView.style.display = 'none';
    if (subView) subView.style.display = 'block';
    if (cancelChangeWrap) cancelChangeWrap.style.display = 'none';
  }

  function checkExistingActivation() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;
    chrome.storage.local.get(['ewu_license_token', 'ewu_license_exp', 'ewu_license_prefix', 'ewu_device_id'], async function (res) {
      if (res.ewu_license_token && res.ewu_license_exp && Date.now() < res.ewu_license_exp) {
        try {
          var deviceId = res.ewu_device_id || await getDeviceId();
          var response = await fetch(WORKER_URL + '/api/license/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: res.ewu_license_token, deviceId: deviceId })
          });
          var data = await response.json();
          if (response.ok && data.valid) {
            currentLicenseState = {
              prefix: res.ewu_license_prefix || 'XXXX-...',
              expiresAt: data.licenseExpiresAt
            };
            renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
          }
        } catch (err) {}
      }
    });
  }

  checkExistingActivation();

  if (btnChangeLicense) {
    btnChangeLicense.addEventListener('click', function () {
      document.getElementById('subscribedView').style.display = 'none';
      document.getElementById('activationMainView').style.display = 'block';
      if (cancelChangeWrap && currentLicenseState) {
        cancelChangeWrap.style.display = 'block';
      }
      hideStatus();
      keyInput.value = '';
      keyInput.focus();
    });
  }

  if (btnCancelChange) {
    btnCancelChange.addEventListener('click', function () {
      if (currentLicenseState) {
        renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
      }
    });
  }

  if (btnGetLicensePage) {
    btnGetLicensePage.addEventListener('click', function () {
      window.open('https://t.me/AftabKabir', '_blank');
    });
  }

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
        var licPrefix = (data.licenseInfo && data.licenseInfo.keyPrefix) ? data.licenseInfo.keyPrefix : licenseKey.substring(0, 9) + '...';
        var licExp = data.licenseInfo ? data.licenseInfo.expiresAt : null;

        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({
            ewu_license_token: data.token,
            ewu_license_exp: data.expiresAt,
            ewu_license_prefix: licPrefix
          }, function () {
            if (chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'EWU_SETTINGS_UPDATED' });
            }
          });
        } else {
          localStorage.setItem('ewu_license_token', data.token);
          localStorage.setItem('ewu_license_exp', data.expiresAt);
        }

        currentLicenseState = {
          prefix: licPrefix,
          expiresAt: licExp
        };

        showStatus('🎉 License activated successfully! Thank you for using EWU Portal Helper.', 'success');
        keyInput.value = '';
        setTimeout(function () {
          renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
        }, 1200);
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

  function showStatus(msg, type) {
    statusBox.textContent = msg;
    statusBox.className = 'status-box ' + type;
    statusBox.style.display = 'block';
  }

  function hideStatus() {
    statusBox.style.display = 'none';
    statusBox.className = 'status-box';
  }
})();
