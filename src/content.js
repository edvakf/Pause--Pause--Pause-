
var Cache = {};
var CacheList = [];
var CacheCount = 20;

function imgLoad(e) {
  var img = e.target;
  if (img instanceof HTMLImageElement) pauseAnimationImg(img);
}

var re_NONGIF = /\.(jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/;

function pauseAnimationImg(img) {
  var src = img.src, cache;
  if (re_NONGIF.test(src)
    || img.dataset.originalSrc
    || img.dataset.animationRestarted) return;

  img.dataset.originalSrc = src;
  if (cache = Cache[src]) {
    if (cache.waiting) {
      cache.images.push(img);
    } else if (cache.dataUrl) {
      img.src = cache.dataUrl;
    } else { // error or not gif
      delete img.dataset.originalSrc;
    }
    return;
  } else {
    CacheList.push(src);
    Cache[src] = {
      images: [img],
      waiting: true
    };
    if (CacheList.length > CacheCount) {
      for (var i = 0; i < CacheList.length - CacheCount; i++) {
        var url = CacheList[i];
        if (!Cache[url].waiting) {
          delete Cache[url];
          CacheList.splice(i, 1);
          i--;
        }
      }
    }
  }
  chrome.extension.sendRequest({type: 'img', src: src}, function(res) {
    //console.log([src, res]);
    if (cache = Cache[src]) {
      cache.images.forEach(function(img) {
        if (res.error) {
          delete img.dataset.originalSrc;
        } else {
          img.addEventListener('error', function() {
            restartAnimation(img);
          }, false);
          img.addEventListener('click', function handleClick(e) {
            e.preventDefault();
            restartAnimation(img);
            img.removeEventListener('click', handleClick, false);
          }, false);
          img.src = res.dataUrl;
        }
      });
      cache.images = [];
      cache.dataUrl = res.dataUrl; // is undefined if res.error is there
      cache.waiting = false;
    } else { // shouldn't occur
      throw 'unawaited image loaded background: ' + src;
    }
  });
}

function restartAnimation(img) {
  img.src = img.dataset.originalSrc;
  delete img.dataset.originalSrc;
  img.dataset.animationRestarted = 'yes';
}


function pauseAnimationStyleRule(style, dec, url) {
  var a = document.createElement('a');
  a.setAttribute('href', url);

  chrome.extension.sendRequest({type: 'img', src: a.href} , function(res) {
    //console.log(res);
    if (!res.error) {
      style[dec] = style[dec].replace(new RegExp(url.replace(/\W/g,'\\$&'), 'g'), res.dataUrl);
    }
  });
}

function pauseAnimationCSS(sheet) {
  chrome.extension.sendRequest({type:'css', src: sheet.href}, function(res) {
    //console.log(res);
    if (sheet && sheet.parentNode) {
      if (!res.error) {
        var style = document.createElement('style');
        style.textContent = res.cssText;
        sheet.parentNode.insertBefore(style, sheet.nextSibling);
      }
    }
  });
}


(function init() {
  var imgs = document.images;
  for (var i = 0; i < imgs.length; i++) {
    pauseAnimationImg(imgs[i]);
  }
  document.addEventListener('load', imgLoad, true);

  var sheets = document.styleSheets;
  for (var i = 0; i < sheets.length; i++) {
    var rules = sheets[i].cssRules;
    if (!rules) continue; // cross origin request (cannot get any more?)

    for (var j = 0; j < rules.length; j++) {
      var style = rules[j].style;
      if (!style) continue; // style is undefined if rules[j] is a CSSImportRule
      for (var k = 0; k < style.length; k++) {
        var dec = style[k];
        if (/url\((\S+)\)/.test(style[dec])) { // WebKit normalize the css and remove quotes and whitespaces
          var url = RegExp.$1;
          if (url.lastIndexOf('data:', 0) !== 0 
            && !re_NONGIF.test(url)) {
            pauseAnimationStyleRule(style, dec, url);
          }
        }
      }
    }
  }

  var links = document.getElementsByTagName('link');
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute('rel') === 'stylesheet') {
      pauseAnimationCSS(links[i]);
    }
  }
})();
