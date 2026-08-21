/* =============================================================
   EWU Portal Helper - Page Hook
   Runs in PAGE context (not content script context).
   Intercepts fetch/XHR responses for GetAllOfferedCourses & GetAllRoutine APIs.
   Sends captured data back to content.js via window.postMessage.
   ============================================================= */
(function () {
  'use strict';
  var OC_KEYWORD = 'GetAllOfferedCourses';
  var ADV_KEYWORD = 'GetAllRoutine';
  var CS_KEYWORD = 'GetSemesterStudentWiseAdvisingCourseListStudent';

  /* --- Fetch hook --- */
  if (window.fetch) {
    var _origFetch = window.fetch;
    window.fetch = function () {
      var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
      var promise = _origFetch.apply(this, arguments);
      if (url.indexOf(OC_KEYWORD) !== -1) {
        promise.then(function (res) {
          res.clone().json().then(function (data) {
            window.postMessage({ type: 'EWU_OC_API_DATA', data: data }, '*');
          }).catch(function () {});
        }).catch(function () {});
      } else if (url.indexOf(ADV_KEYWORD) !== -1) {
        promise.then(function (res) {
          res.clone().json().then(function (data) {
            window.postMessage({ type: 'EWU_ADV_API_DATA', data: data }, '*');
          }).catch(function () {});
        }).catch(function () {});
      } else if (url.indexOf(CS_KEYWORD) !== -1) {
        promise.then(function (res) {
          res.clone().json().then(function (data) {
            window.postMessage({ type: 'EWU_CS_API_DATA', data: data }, '*');
          }).catch(function () {});
        }).catch(function () {});
      }
      return promise;
    };
  }

  /* --- XMLHttpRequest hook --- */
  var _origOpen = XMLHttpRequest.prototype.open;
  var _origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._ewu_hook_url = url;
    return _origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    if (xhr._ewu_hook_url) {
      if (xhr._ewu_hook_url.indexOf(OC_KEYWORD) !== -1) {
        xhr.addEventListener('load', function () {
          try {
            var data = JSON.parse(xhr.responseText);
            window.postMessage({ type: 'EWU_OC_API_DATA', data: data }, '*');
          } catch (e) {}
        });
      } else if (xhr._ewu_hook_url.indexOf(ADV_KEYWORD) !== -1) {
        xhr.addEventListener('load', function () {
          try {
            var data = JSON.parse(xhr.responseText);
            window.postMessage({ type: 'EWU_ADV_API_DATA', data: data }, '*');
          } catch (e) {}
        });
      } else if (xhr._ewu_hook_url.indexOf(CS_KEYWORD) !== -1) {
        xhr.addEventListener('load', function () {
          try {
            var data = JSON.parse(xhr.responseText);
            window.postMessage({ type: 'EWU_CS_API_DATA', data: data }, '*');
          } catch (e) {}
        });
      }
    }
    return _origSend.apply(this, arguments);
  };
})();
