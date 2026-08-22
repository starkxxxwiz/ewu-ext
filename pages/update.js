document.addEventListener('DOMContentLoaded', function () {
  var manifest = chrome.runtime.getManifest();
  var currentVersion = manifest.version || '2.0.0';

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
});
