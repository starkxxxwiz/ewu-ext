document.addEventListener('DOMContentLoaded', function () {
  var manifestVer = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) ? (chrome.runtime.getManifest().version || '1.1.0') : '1.1.0';

  var curEl = document.getElementById('currentVerText');
  if (curEl) curEl.textContent = 'v' + manifestVer;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['ewu_system_update'], function (res) {
      var update = (res && res.ewu_system_update) || {};
      
      if (update.title) {
        var tEl = document.getElementById('updateTitle');
        if (tEl) tEl.textContent = update.title;
      }
      if (update.latestVersion) {
        var lEl = document.getElementById('latestVerText');
        if (lEl) lEl.textContent = 'v' + update.latestVersion;
      }
      if (update.changelog) {
        var cEl = document.getElementById('changelogText');
        var cSec = document.getElementById('changelogSection');
        if (cEl) cEl.textContent = update.changelog;
        if (cSec) cSec.style.display = 'block';
      }
      
      var updateBtn = document.getElementById('updateBtn');
      var targetUrl = update.updateUrl || 'https://t.me/AftabKabir';
      if (updateBtn) {
        updateBtn.href = targetUrl;
        updateBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: targetUrl });
          } else {
            window.open(targetUrl, '_blank');
          }
        });
      }
    });
  } else {
    var updateBtn = document.getElementById('updateBtn');
    if (updateBtn) {
      updateBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.open(updateBtn.href || 'https://t.me/AftabKabir', '_blank');
      });
    }
  }

  // Responsive Ambient Background Slideshow Controller
  (function initBackgroundSlideshow() {
    function isPortrait() {
      return window.matchMedia('(max-width: 768px), (orientation: portrait)').matches;
    }

    var landscapeIndex = 0;
    var portraitIndex = 0;

    function rotateSlides() {
      var portraitMode = isPortrait();
      var selector = portraitMode ? '.bg-slide.portrait' : '.bg-slide.landscape';
      var slides = document.querySelectorAll(selector);
      if (!slides.length) return;

      if (portraitMode) {
        portraitIndex = (portraitIndex + 1) % slides.length;
        slides.forEach(function (s, i) {
          s.classList.toggle('active', i === portraitIndex);
        });
      } else {
        landscapeIndex = (landscapeIndex + 1) % slides.length;
        slides.forEach(function (s, i) {
          s.classList.toggle('active', i === landscapeIndex);
        });
      }
    }

    setInterval(rotateSlides, 7000);
  })();
});

