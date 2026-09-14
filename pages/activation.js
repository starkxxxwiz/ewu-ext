(function () {
  'use strict';
  var WORKER_URL = 'https://ewu-helper-license-worker.tonystarkxxx31.workers.dev';

  // Navigation & Step Elements
  var stepIndicator = document.getElementById('stepIndicator');
  var nodeStep1 = document.getElementById('nodeStep1');
  var nodeStep2 = document.getElementById('nodeStep2');
  var nodeStep3 = document.getElementById('nodeStep3');
  var lineStep1 = document.getElementById('lineStep1');
  var lineStep2 = document.getElementById('lineStep2');

  var viewStep1 = document.getElementById('viewStep1Terms');
  var viewStep2 = document.getElementById('viewStep2Features');
  var viewStep3 = document.getElementById('viewStep3Activation');
  var viewStep4 = document.getElementById('viewStep4Ready');

  // Step 1 Elements
  var chkAcceptTerms = document.getElementById('chkAcceptTerms');
  var btnNextToFeatures = document.getElementById('btnNextToFeatures');
  var btnToggleFullTerms = document.getElementById('btnToggleFullTerms');
  var fullTermsBox = document.getElementById('fullTermsBox');
  var expandTermsText = document.getElementById('expandTermsText');

  // Step 2 Elements
  var btnNextToActivation = document.getElementById('btnNextToActivation');

  // Step 3 Elements
  var form = document.getElementById('activationForm');
  var keyInput = document.getElementById('licenseKey');
  var btnActivate = document.getElementById('btnActivate');
  var btnText = document.getElementById('btnText');
  var btnSpinner = document.getElementById('btnSpinner');
  var statusBox = document.getElementById('statusBox');
  var cancelChangeWrap = document.getElementById('cancelChangeWrap');
  var btnCancelChange = document.getElementById('btnCancelChange');
  var btnGetLicensePage = document.getElementById('btnGetLicensePage');

  // Step 4 Elements
  var btnVisitPortal = document.getElementById('btnVisitPortal');
  var btnChangeLicense = document.getElementById('btnChangeLicense');
  var subKeyPrefix = document.getElementById('subKeyPrefix');
  var subExpiryText = document.getElementById('subExpiryText');

  var currentLicenseState = null;
  var currentStep = 1;

  // Format Licence Key as XXXX-XXXX-XXXX-XXXX
  if (keyInput) {
    keyInput.addEventListener('input', function (e) {
      var raw = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      var formatted = '';
      for (var i = 0; i < raw.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += '-';
        formatted += raw[i];
      }
      e.target.value = formatted;
    });
  }

  var _cachedDeviceId = null;
  function getDeviceId() {
    if (_cachedDeviceId) return Promise.resolve(_cachedDeviceId);
    return new Promise(function (resolve) {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        var localId = localStorage.getItem('ewu_device_id');
        if (!localId) {
          localId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('ewu_device_id', localId);
        }
        _cachedDeviceId = localId;
        resolve(localId);
        return;
      }
      chrome.storage.local.get('ewu_device_id', function (res) {
        var deviceId = res && res.ewu_device_id;
        if (!deviceId) {
          deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          chrome.storage.local.set({ ewu_device_id: deviceId }, function () {
            _cachedDeviceId = deviceId;
            resolve(deviceId);
          });
        } else {
          _cachedDeviceId = deviceId;
          resolve(deviceId);
        }
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

  function setStep(step) {
    currentStep = step;
    var views = [viewStep1, viewStep2, viewStep3, viewStep4];
    views.forEach(function (v) {
      if (v) v.classList.remove('active');
    });

    if (step === 1) {
      if (viewStep1) viewStep1.classList.add('active');
      if (stepIndicator) stepIndicator.style.display = 'flex';
      if (nodeStep1) { nodeStep1.className = 'step-node active'; }
      if (nodeStep2) { nodeStep2.className = 'step-node'; }
      if (nodeStep3) { nodeStep3.className = 'step-node'; }
      if (lineStep1) { lineStep1.className = 'step-line'; }
      if (lineStep2) { lineStep2.className = 'step-line'; }
    } else if (step === 2) {
      if (viewStep2) viewStep2.classList.add('active');
      if (stepIndicator) stepIndicator.style.display = 'flex';
      if (nodeStep1) { nodeStep1.className = 'step-node completed'; }
      if (nodeStep2) { nodeStep2.className = 'step-node active'; }
      if (nodeStep3) { nodeStep3.className = 'step-node'; }
      if (lineStep1) { lineStep1.className = 'step-line active'; }
      if (lineStep2) { lineStep2.className = 'step-line'; }
    } else if (step === 3) {
      if (viewStep3) viewStep3.classList.add('active');
      if (stepIndicator) stepIndicator.style.display = 'flex';
      if (nodeStep1) { nodeStep1.className = 'step-node completed'; }
      if (nodeStep2) { nodeStep2.className = 'step-node completed'; }
      if (nodeStep3) { nodeStep3.className = 'step-node active'; }
      if (lineStep1) { lineStep1.className = 'step-line active'; }
      if (lineStep2) { lineStep2.className = 'step-line active'; }
    } else if (step === 4) {
      if (viewStep4) viewStep4.classList.add('active');
      if (stepIndicator) stepIndicator.style.display = 'none';
    }
  }

  function renderSubscribedView(prefix, expiresAt) {
    if (subKeyPrefix) subKeyPrefix.textContent = prefix || 'XXXX-...';
    if (subExpiryText) {
      if (expiresAt && Number(expiresAt) > 0) {
        var d = new Date(Number(expiresAt));
        subExpiryText.textContent = isNaN(d.getTime()) ? 'Lifetime Access' : d.toLocaleDateString();
      } else {
        subExpiryText.textContent = 'Lifetime Access (Never Expires)';
      }
    }
    setStep(4);
    if (cancelChangeWrap) cancelChangeWrap.style.display = 'none';
  }

  function checkExistingActivation() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      var localTerms = localStorage.getItem('ewu_terms_accepted') === 'true';
      var localToken = localStorage.getItem('ewu_license_token');
      var localStatus = localStorage.getItem('ewu_license_status') || (localToken ? 'active' : '');
      var localExp = localStorage.getItem('ewu_license_expiry');

      if (localToken && isLicenseValid(localStatus, localExp ? Number(localExp) : null)) {
        currentLicenseState = {
          prefix: localStorage.getItem('ewu_license_prefix') || 'XXXX-...',
          expiresAt: localExp ? Number(localExp) : null
        };
        renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
        return;
      }
      if (localTerms) {
        setStep(3);
      } else {
        setStep(1);
      }
      return;
    }

    chrome.storage.local.get([
      'ewu_terms_accepted',
      'ewu_license_token',
      'ewu_license_status',
      'ewu_license_expiry',
      'ewu_license_prefix',
      'ewu_device_id'
    ], async function (res) {
      var termsAccepted = Boolean(res && res.ewu_terms_accepted);
      var token = res && res.ewu_license_token;
      var status = res && (res.ewu_license_status || (token ? 'active' : 'inactive'));
      var expiry = (res && res.ewu_license_expiry !== undefined) ? res.ewu_license_expiry : null;

      if (token && isLicenseValid(status, expiry)) {
        currentLicenseState = {
          prefix: res.ewu_license_prefix || 'XXXX-...',
          expiresAt: expiry
        };
        renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);

        // Silent background re-verification
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
          } else if (data && data.valid === false && data.reason && data.reason.toLowerCase().includes('revoked')) {
            chrome.storage.local.set({ ewu_license_status: 'revoked' });
            setStep(3);
            showStatus(data.reason || 'Licence is no longer active. Please enter a valid licence key.', 'error');
          }
        } catch (_) {
          // Keep active offline!
        }
        return;
      }

      if (termsAccepted) {
        setStep(3);
      } else {
        setStep(1);
      }
    });
  }

  // Step 1 Event Listeners
  if (chkAcceptTerms && btnNextToFeatures) {
    chkAcceptTerms.addEventListener('change', function () {
      btnNextToFeatures.disabled = !chkAcceptTerms.checked;
    });
  }

  if (btnToggleFullTerms && fullTermsBox && expandTermsText) {
    btnToggleFullTerms.addEventListener('click', function () {
      var isVisible = fullTermsBox.style.display === 'block';
      fullTermsBox.style.display = isVisible ? 'none' : 'block';
      expandTermsText.textContent = isVisible ? 'Show Complete Terms & Conditions' : 'Hide Complete Terms & Conditions';
    });
  }

  if (btnNextToFeatures) {
    btnNextToFeatures.addEventListener('click', function () {
      if (!chkAcceptTerms || !chkAcceptTerms.checked) return;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ ewu_terms_accepted: true });
      } else {
        localStorage.setItem('ewu_terms_accepted', 'true');
      }
      setStep(2);
    });
  }

  // Step 2 Event Listeners
  if (btnNextToActivation) {
    btnNextToActivation.addEventListener('click', function () {
      setStep(3);
      if (keyInput) keyInput.focus();
    });
  }

  // Step 3 & 4 Navigation
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
      setStep(3);
      if (cancelChangeWrap && currentLicenseState) {
        cancelChangeWrap.style.display = 'block';
      }
      hideStatus();
      if (keyInput) {
        keyInput.value = '';
        keyInput.focus();
      }
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

  // Licence Activation Form Submission
  if (form) {
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
            ewu_terms_accepted: true,
            ewu_license_token: data.token,
            ewu_license_status: 'active',
            ewu_license_expiry: licExp,
            ewu_token_exp: data.expiresAt || data.tokenExpiresAt,
            ewu_license_prefix: licPrefix,
            ewu_device_id: deviceId
          };

          if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set(savePayload, function () {
              if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ type: 'EWU_SETTINGS_UPDATED' });
              }
            });
          } else {
            localStorage.setItem('ewu_terms_accepted', 'true');
            localStorage.setItem('ewu_license_token', data.token);
            localStorage.setItem('ewu_license_status', 'active');
            localStorage.setItem('ewu_license_expiry', licExp ? String(licExp) : '');
            localStorage.setItem('ewu_license_prefix', licPrefix);
            localStorage.setItem('ewu_device_id', deviceId);
          }

          currentLicenseState = {
            prefix: licPrefix,
            expiresAt: licExp
          };

          showStatus('Licence activated successfully! Full access unlocked.', 'success');
          keyInput.value = '';
          setTimeout(function () {
            renderSubscribedView(currentLicenseState.prefix, currentLicenseState.expiresAt);
          }, 700);
        } else {
          showStatus(data.message || 'Invalid or inactive licence key. Please check your key or contact support.', 'error');
        }
      } catch (err) {
        showStatus('Unable to reach verification server. Please check your internet connection and try again.', 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  function setLoading(loading) {
    if (btnActivate) btnActivate.disabled = loading;
    if (btnText) btnText.style.display = loading ? 'none' : 'inline';
    if (btnSpinner) btnSpinner.style.display = loading ? 'inline-block' : 'none';
  }

  function showStatus(msg, type) {
    if (!statusBox) return;
    statusBox.textContent = msg;
    statusBox.className = 'status-box ' + type;
    statusBox.style.display = 'block';
  }

  function hideStatus() {
    if (!statusBox) return;
    statusBox.style.display = 'none';
    statusBox.className = 'status-box';
  }

  // Initialize
  checkExistingActivation();
})();
