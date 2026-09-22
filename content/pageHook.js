/* =============================================================
   EWU Buddy - Page Hook
   Runs in PAGE context (not content script context).
   Intercepts fetch/XHR responses for GetAllOfferedCourses & GetAllRoutine APIs.
   Sends captured data back to content.js via window.postMessage.
   ============================================================= */
(function () {
  'use strict';
  function isOcUrl(url) {
    if (!url) return false;
    var u = url.toLowerCase();
    return u.indexOf('getallofferedcourses') !== -1 || u.indexOf('get_offered_courses') !== -1;
  }
  function isAdvUrl(url) {
    if (!url) return false;
    var u = url.toLowerCase();
    return u.indexOf('getallroutine') !== -1 || u.indexOf('get_routine') !== -1;
  }
  function isCsUrl(url) {
    if (!url) return false;
    var u = url.toLowerCase();
    return u.indexOf('getsemesterstudentwiseadvisingcourseliststudent') !== -1 || u.indexOf('get_schedule') !== -1;
  }

  /* --- Fetch hook --- */
  if (window.fetch) {
    var _origFetch = window.fetch;
    window.fetch = function () {
      var url = (typeof arguments[0] === 'string') ? arguments[0] : (arguments[0] && arguments[0].url) || '';
      var promise = _origFetch.apply(this, arguments);
      if (isOcUrl(url)) {
        promise.then(function (res) {
          res.clone().json().then(function (data) {
            window.postMessage({ type: 'EWU_OC_API_DATA', data: data }, '*');
          }).catch(function () {});
        }).catch(function () {});
      } else if (isAdvUrl(url)) {
        promise.then(function (res) {
          res.clone().json().then(function (data) {
            window.postMessage({ type: 'EWU_ADV_API_DATA', data: data }, '*');
          }).catch(function () {});
        }).catch(function () {});
      } else if (isCsUrl(url)) {
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
      if (isOcUrl(xhr._ewu_hook_url)) {
        xhr.addEventListener('load', function () {
          try {
            var data = JSON.parse(xhr.responseText);
            window.postMessage({ type: 'EWU_OC_API_DATA', data: data }, '*');
          } catch (e) {}
        });
      } else if (isAdvUrl(xhr._ewu_hook_url)) {
        xhr.addEventListener('load', function () {
          try {
            var data = JSON.parse(xhr.responseText);
            window.postMessage({ type: 'EWU_ADV_API_DATA', data: data }, '*');
          } catch (e) {}
        });
      } else if (isCsUrl(xhr._ewu_hook_url)) {
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

  /* --- Initial Angular Scope Check --- */
  function extractAngularAdvising() {
    try {
      if (typeof window.angular !== 'undefined') {
        var ctrlEl = document.querySelector('[ng-controller="AdvisingStudentController"]') ||
                     document.querySelector('[ng-controller="OfferedCourseStudentController"]') ||
                     document.querySelector('[ng-app="ERMApp"]') ||
                     document.body;
        if (ctrlEl) {
          var scope = window.angular.element(ctrlEl).scope();
          if (scope) {
            var advList = [];
            if (Array.isArray(scope.FlowChartDataList)) advList = advList.concat(scope.FlowChartDataList);
            if (Array.isArray(scope.FGradeDataList)) advList = advList.concat(scope.FGradeDataList);
            if (Array.isArray(scope.DDplusList)) advList = advList.concat(scope.DDplusList);
            if (Array.isArray(scope.RetakeList)) advList = advList.concat(scope.RetakeList);
            if (Array.isArray(scope.AllRoutineList)) advList = advList.concat(scope.AllRoutineList);
            if (advList.length > 0) {
              window.postMessage({ type: 'EWU_ADV_API_DATA', data: advList }, '*');
            }

            if (Array.isArray(scope.OfferedCourseList) && scope.OfferedCourseList.length > 0) {
              window.postMessage({ type: 'EWU_OC_API_DATA', data: scope.OfferedCourseList }, '*');
            }
          }
        }
      }
    } catch (_) {}
  }

  // Check immediately and on DOM updates
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      extractAngularAdvising();
      setTimeout(extractAngularAdvising, 300);
      setTimeout(extractAngularAdvising, 1000);
    });
  } else {
    extractAngularAdvising();
    setTimeout(extractAngularAdvising, 300);
    setTimeout(extractAngularAdvising, 1000);
  }
})();

