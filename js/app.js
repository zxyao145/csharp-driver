if (!String.prototype.trim) {
  (function() {
    // Make sure we trim BOM and NBSP
    var rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
    String.prototype.trim = function() {
        return this.replace(rtrim, '');
    };
  })();
}

(function(window) {
  function basePath() {
    var regexp = new RegExp('js/app.js');
    var script = $('script').filter(function(i, el) {
      return el.src.match(regexp);
    })[0]

    var base = script.src.substr(window.location.protocol.length + window.location.host.length + 2, script.src.length);

    return base.replace('/js/app.js', '');
  }

  var app = window.angular.module('docs', ['cfp.hotkeys'])

  app.value('pages', {"/":{"title":"Home","summary":"Home <small class=\"text-muted\">page</small>","path":"/","version":"v3.0"},"/features/address-resolution/":{"title":"Address resolution","summary":"Address resolution <small class=\"text-muted\">page</small>","path":"/features/address-resolution/","version":"v3.0"},"/features/automatic-failover/":{"title":"Automatic failover","summary":"Automatic failover <small class=\"text-muted\">page</small>","path":"/features/automatic-failover/","version":"v3.0"},"/features/components/adonet/":{"title":"ADO.NET","summary":"ADO.NET <small class=\"text-muted\">page</small>","path":"/features/components/adonet/","version":"v3.0"},"/features/components/core/":{"title":"Core component","summary":"Core component <small class=\"text-muted\">page</small>","path":"/features/components/core/","version":"v3.0"},"/features/components/linq/":{"title":"Linq component","summary":"Linq component <small class=\"text-muted\">page</small>","path":"/features/components/linq/","version":"v3.0"},"/features/components/mapper/":{"title":"Mapper component","summary":"Mapper component <small class=\"text-muted\">page</small>","path":"/features/components/mapper/","version":"v3.0"},"/features/components/":{"title":"Driver components","summary":"Driver components <small class=\"text-muted\">page</small>","path":"/features/components/","version":"v3.0"},"/features/connection-heartbeat/":{"title":"Connection heartbeat","summary":"Connection heartbeat <small class=\"text-muted\">page</small>","path":"/features/connection-heartbeat/","version":"v3.0"},"/features/connection-pooling/":{"title":"Connection pooling","summary":"Connection pooling <small class=\"text-muted\">page</small>","path":"/features/connection-pooling/","version":"v3.0"},"/features/datatypes/datetime/":{"title":"Date and time representation","summary":"Date and time representation <small class=\"text-muted\">page</small>","path":"/features/datatypes/datetime/","version":"v3.0"},"/features/datatypes/nulls-unset/":{"title":"Nulls and unset","summary":"Nulls and unset <small class=\"text-muted\">page</small>","path":"/features/datatypes/nulls-unset/","version":"v3.0"},"/features/datatypes/":{"title":"CQL data types to C# types","summary":"CQL data types to C# types <small class=\"text-muted\">page</small>","path":"/features/datatypes/","version":"v3.0"},"/features/paging/":{"title":"Result paging","summary":"Result paging <small class=\"text-muted\">page</small>","path":"/features/paging/","version":"v3.0"},"/features/parametrized-queries/":{"title":"Parameterized queries","summary":"Parameterized queries <small class=\"text-muted\">page</small>","path":"/features/parametrized-queries/","version":"v3.0"},"/features/query-warnings/":{"title":"Query warnings","summary":"Query warnings <small class=\"text-muted\">page</small>","path":"/features/query-warnings/","version":"v3.0"},"/features/":{"title":"Features","summary":"Features <small class=\"text-muted\">page</small>","path":"/features/","version":"v3.0"},"/features/routing-queries/":{"title":"Routing queries","summary":"Routing queries <small class=\"text-muted\">page</small>","path":"/features/routing-queries/","version":"v3.0"},"/features/speculative-retries/":{"title":"Speculative query execution","summary":"Speculative query execution <small class=\"text-muted\">page</small>","path":"/features/speculative-retries/","version":"v3.0"},"/features/tuning-policies/":{"title":"Tuning policies","summary":"Tuning policies <small class=\"text-muted\">page</small>","path":"/features/tuning-policies/","version":"v3.0"},"/features/udfs/":{"title":"User-defined functions and aggregates","summary":"User-defined functions and aggregates <small class=\"text-muted\">page</small>","path":"/features/udfs/","version":"v3.0"},"/features/udts/":{"title":"User-defined types","summary":"User-defined types <small class=\"text-muted\">page</small>","path":"/features/udts/","version":"v3.0"},"/faq/":{"title":"FAQ","summary":"FAQ <small class=\"text-muted\">page</small>","path":"/faq/","version":"v3.0"}})
  app.factory('basePath', basePath)
  app.provider('search', function() {
    function localSearchFactory($http, $timeout, $q, $rootScope, basePath) {
      $rootScope.searchReady = false;

      var fetch = $http.get(basePath + '/json/search-index.json')
                       .then(function(response) {
                         var index = lunr.Index.load(response.data)
                         $rootScope.searchReady = true;
                         return index;
                       });

      // The actual service is a function that takes a query string and
      // returns a promise to the search results
      // (In this case we just resolve the promise immediately as it is not
      // inherently an async process)
      return function(q) {
        return fetch.then(function(index) {
          var results = []
          index.search(q).forEach(function(hit) {
            results.push(hit.ref);
          });
          return results;
        })
      };
    };
    localSearchFactory.$inject = ['$http', '$timeout', '$q', '$rootScope', 'basePath'];

    function webWorkerSearchFactory($q, $rootScope, basePath) {
      $rootScope.searchReady = false;

      var searchIndex = $q.defer();
      var results;
      var worker = new Worker(basePath + '/js/search-worker.js');

      // The worker will send us a message in two situations:
      // - when the index has been built, ready to run a query
      // - when it has completed a search query and the results are available
      worker.onmessage = function(e) {
        switch(e.data.e) {
          case 'ready':
            worker.postMessage({ e: 'load', p: basePath });
            break
          case 'index-ready':
            $rootScope.$apply(function() {
              $rootScope.searchReady = true;
            })
            searchIndex.resolve();
            break;
          case 'query-ready':
            results.resolve(e.data.d);
            break;
        }
      };

      // The actual service is a function that takes a query string and
      // returns a promise to the search results
      return function(q) {

        // We only run the query once the index is ready
        return searchIndex.promise.then(function() {

          results = $q.defer();
          worker.postMessage({ e: 'search', q: q });
          return results.promise;
        });
      };
    };
    webWorkerSearchFactory.$inject = ['$q', '$rootScope', 'basePath'];

    return {
      $get: window.Worker ? webWorkerSearchFactory : localSearchFactory
    };
  })

  app.controller('search', [
    '$scope',
    '$sce',
    '$timeout',
    'search',
    'pages',
    'basePath',
    function($scope, $sce, $timeout, search, pages, basePath) {
      $scope.hasResults = false;
      $scope.results = null;
      $scope.current = null;

      function clear() {
        $scope.hasResults = false;
        $scope.results = null;
        $scope.current = null;
      }

      $scope.search = function(version) {
        if ($scope.q.length >= 2) {
          search($scope.q).then(function(ids) {
            var results = []

            ids.forEach(function(id) {
              var page = pages[id];

              if (page.version == version) {
                results.push(page)
              }
            })

            if (results.length > 0) {
              $scope.hasResults = true;
              $scope.results = results;
              $scope.current = 0;
            } else {
              clear()
            }
          })
        } else {
          clear()
        }
      };

      $scope.basePath = basePath;

      $scope.reset = function() {
        $scope.q = null;
        clear()
      }

      $scope.submit = function() {
        var result = $scope.results[$scope.current]

        if (result) {
          $timeout(function() {
            window.location.href = basePath + result.path;
          })
        }
      }

      $scope.summary = function(item) {
        return $sce.trustAsHtml(item.summary);
      }

      $scope.moveDown = function(e) {
        if ($scope.hasResults && $scope.current < ($scope.results.length - 1)) {
          $scope.current++
          e.stopPropagation()
        }
      }

      $scope.moveUp = function(e) {
        if ($scope.hasResults && $scope.current > 0) {
          $scope.current--
          e.stopPropagation()
        }
      }
    }
  ])

  app.directive('search', [
    '$document',
    'hotkeys',
    function($document, hotkeys) {
      return function(scope, element, attrs) {
        hotkeys.add({
          combo: '/',
          description: 'Search docs...',
          callback: function(event, hotkey) {
            event.preventDefault()
            event.stopPropagation()
            element[0].focus()
          }
        })
      }
    }
  ])

  $(function() {
    $('#content').height(
      Math.max(
        $(".side-nav").height(),
        $('#content').height()
      )
    );

    $('#table-of-contents').on('activate.bs.scrollspy', function() {
      var active = $('#table-of-contents li.active').last().children('a');
      var button = $('#current-section');
      var text   = active.text().trim();

      if (active.length == 0 || text == 'Page Top') {
        button.html('Jump to... <span class="caret"></span><span class="sr-only">Table of Contents</span>')
      } else {
        if (text.length > 30) {
          text = text.slice(0, 30) + '...'
        }
        button.html('Viewing: ' + text + ' <span class="caret"></span><span class="sr-only">Table of Contents</span>')
      }
    })

    // Config ZeroClipboard
    ZeroClipboard.config({
      swfPath: basePath() + '/flash/ZeroClipboard.swf',
      hoverClass: 'btn-clipboard-hover',
      activeClass: 'btn-clipboard-active'
    })

    // Insert copy to clipboard button before .highlight
    $('.highlight').each(function () {
      var btnHtml = '<div class="zero-clipboard"><span class="btn-clipboard">Copy</span></div>'
      $(this).before(btnHtml)
    })

    var zeroClipboard = new ZeroClipboard($('.btn-clipboard'))

    // Handlers for ZeroClipboard

    // Copy to clipboard
    zeroClipboard.on('copy', function (event) {
      var clipboard = event.clipboardData;
      var highlight = $(event.target).parent().nextAll('.highlight').first()
      clipboard.setData('text/plain', highlight.text())
    })

    // Notify copy success and reset tooltip title
    zeroClipboard.on('aftercopy', function (event) {
      $(event.target)
        .attr('title', 'Copied!')
        .tooltip('fixTitle')
        .tooltip('show')
    })

    // Notify copy failure
    zeroClipboard.on('error', function (event) {
      $(event.target)
        .attr('title', 'Flash required')
        .tooltip('fixTitle')
        .tooltip('show')
    })
  })
})(window)
