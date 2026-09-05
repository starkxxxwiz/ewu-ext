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
  var btnVisitPortal = document.getElementById('btnVisitPortal');

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

  function isLicenseValid(licStatus, licExp) {
    if (licStatus !== 'active') return false;
    if (licExp && typeof licExp === 'number' && licExp > 0) {
      if (Date.now() > licExp) return false;
    }
    return true;
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
    if (typeof chrome === 'undefined' || !chrome.storage) {
      var localToken = localStorage.getItem('ewu_license_token');
      var localStatus = localStorage.getItem('ewu_license_status') || (localToken ? 'active' : '');
      var localExp = localStorage.getItem('ewu_license_expiry');
      if (localToken && isLicenseValid(localStatus, localExp ? Number(localExp) : null)) {
        currentLicenseState = {
          prefix: localStorage.getItem('ewu_license_prefix') || 'XXXX-...',
          expiresAt: localExp ? Number(localExp) : null
        };
        renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
      }
      return;
    }

    chrome.storage.local.get([
      'ewu_license_token',
      'ewu_license_status',
      'ewu_license_expiry',
      'ewu_license_exp', // backward compat
      'ewu_license_prefix',
      'ewu_device_id'
    ], async function (res) {
      var token = res.ewu_license_token;
      var status = res.ewu_license_status || (token ? 'active' : 'inactive');
      var expiry = (res.ewu_license_expiry !== undefined) ? res.ewu_license_expiry : null;

      if (token && isLicenseValid(status, expiry)) {
        currentLicenseState = {
          prefix: res.ewu_license_prefix || 'XXXX-...',
          expiresAt: expiry
        };
        renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);

        // Revalidate in background without blocking
        try {
          var deviceId = res.ewu_device_id || await getDeviceId();
          var response = await fetch(WORKER_URL + '/api/license/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token, deviceId: deviceId })
          });
          var data = await response.json();
          if (response.ok && data.valid) {
            currentLicenseState.expiresAt = data.licenseExpiresAt;
            chrome.storage.local.set({
              ewu_license_status: 'active',
              ewu_license_expiry: data.licenseExpiresAt,
              ewu_license_prefix: data.licensePrefix || currentLicenseState.prefix
            });
            renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
          } else if (data && data.valid === false) {
            // License explicitly revoked or expired on server
            chrome.storage.local.set({ ewu_license_status: 'inactive' });
            document.getElementById('subscribedView').style.display = 'none';
            document.getElementById('activationMainView').style.display = 'block';
            showStatus(data.reason || 'License is no longer active. Please enter a valid license key.', 'error');
          }
        } catch (_) {
          // Network drop: keep user active offline!
        }
      }
    });
  }

  checkExistingActivation();

  if (btnVisitPortal) {
    btnVisitPortal.addEventListener('click', function () {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: 'https://portal.ewubd.edu' });
      } else {
        window.open('https://portal.ewubd.edu', '_blank');
      }
    });
  }

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
        var licExp = (data.licenseInfo && data.licenseInfo.expiresAt !== undefined) ? data.licenseInfo.expiresAt : (data.licenseExpiresAt || null);

        var savePayload = {
          ewu_license_token: data.token,
          ewu_license_status: 'active',
          ewu_license_expiry: licExp,
          ewu_token_exp: data.expiresAt || data.tokenExpiresAt,
          ewu_license_prefix: licPrefix
        };

        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set(savePayload, function () {
            if (chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'EWU_SETTINGS_UPDATED' });
            }
          });
        } else {
          localStorage.setItem('ewu_license_token', data.token);
          localStorage.setItem('ewu_license_status', 'active');
          localStorage.setItem('ewu_license_expiry', licExp ? String(licExp) : '');
          localStorage.setItem('ewu_license_prefix', licPrefix);
        }

        currentLicenseState = {
          prefix: licPrefix,
          expiresAt: licExp
        };

        showStatus('License activated successfully! Full access unlocked.', 'success');
        keyInput.value = '';
        setTimeout(function () {
          renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
        }, 800);
      } else {
        showStatus(data.message || 'Invalid or inactive license key. Please check your key or contact support.', 'error');
      }
    } catch (err) {
      showStatus('Unable to reach verification server. Please check your internet connection and try again.', 'error');
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
