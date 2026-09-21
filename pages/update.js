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

  // Responsive Ambient Background Slideshow Controller with Lifecycle Management
  (function initBackgroundSlideshow() {
    var mediaQuery = window.matchMedia('(max-width: 768px), (orientation: portrait)');
    function isPortrait() {
      return mediaQuery.matches;
    }

    var landscapeIndex = 0;
    var portraitIndex = 0;
    var timerId = null;

    function getActiveSlides() {
      var portraitMode = isPortrait();
      var selector = portraitMode ? '.bg-slide.portrait' : '.bg-slide.landscape';
      return document.querySelectorAll(selector);
    }

    function rotateSlides() {
      if (document.hidden) return; // Pause while tab is hidden
      var portraitMode = isPortrait();
      var slides = getActiveSlides();
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

    function startTimer() {
      if (timerId) clearInterval(timerId);
      timerId = setInterval(rotateSlides, 7500);
    }

    function stopTimer() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function handleOrientationChange() {
      var portraitMode = isPortrait();
      var slides = getActiveSlides();
      var activeIdx = portraitMode ? portraitIndex : landscapeIndex;
      slides.forEach(function (s, i) {
        s.classList.toggle('active', i === (activeIdx % (slides.length || 1)));
      });
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleOrientationChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleOrientationChange);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    });

    startTimer();
  })();
});

