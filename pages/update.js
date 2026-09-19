document.addEventListener('DOMContentLoaded', function () {
  var manifest = chrome.runtime.getManifest();
  var currentVersion = manifest.version || '1.1.0';

  document.getElementById('currentVerText').textContent = 'v' + currentVersion;

  chrome.storage.local.get(['ewu_system_update'], function (res) {
    var update = res.ewu_system_update || {};
    
    if (update.title) {
      document.getElementById('updateTitle').textContent = update.title;
    }
    if (update.latestVersion) {
      document.getElementById('latestVerText').textContent = 'v' + update.latestVersion;
    }
    if (update.changelog) {
      document.getElementById('changelogText').textContent = update.changelog;
      document.getElementById('changelogSection').style.display = 'block';
    }
    
    var updateBtn = document.getElementById('updateBtn');
    var targetUrl = update.updateUrl || 'https://t.me/AftabKabir';
    updateBtn.href = targetUrl;
    
    updateBtn.addEventListener('click', function () {
      chrome.tabs.create({ url: targetUrl });
    });
  });

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

