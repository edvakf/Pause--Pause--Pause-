var ExtID = chrome.extension.getURL('').match(/chrome-extension:\/\/([^\/]+)\//)[1];

function imgLoad(e) {
  var img = e.target;
  if (img instanceof HTMLImageElement) pauseAnimationImg(img);
}

function pauseAnimationImg(img) {
  //console.log(img);
  if (/\.(jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/.test(img.src) 
    || img.getAttribute('data-original-src')
    || img.getAttribute('data-animation-restarted')) return;

  img.setAttribute('data-original-src', img.src);
  chrome.extension.sendRequest(ExtID, {type: 'img', src: img.src}, function(res) {
    //console.log([img.src, res]);
    if (res.error) {
      img.removeAttribute('data-original-src');
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
}

function restartAnimation(img) {
  img.src = img.getAttribute('data-original-src');
  img.removeAttribute('data-original-src');
  img.setAttribute('data-animation-restarted', 'yes');
}


function pauseAnimationStyleRule(style, dec, url) {
  var a = document.createElement('a');
  a.setAttribute('href', url);

  chrome.extension.sendRequest(ExtID, {type: 'img', src: a.href} , function(res) {
    //console.log(res);
    if (!res.error) {
      style[dec] = style[dec].replace(new RegExp(url.replace(/\W/g,'\\$&'), 'g'), res.dataUrl);
    }
  });
}

function pauseAnimationCSS(sheet) {
  var a = document.createElement('a');
  a.setAttribute('href', sheet.href);

  var base = document.querySelector('base');
  base = base ? base.href : location.href.replace(/[?#].*/,'').replace(/\/[^\/]*$/, '/');

  chrome.extension.sendRequest(ExtID, {type:'css', src: a.href, baseUrl: base}, function(res) {
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
      for (var k = 0; k < style.length; k++) {
        var dec = style[k];
        if (/url\((\S+)\)/.test(style[dec])) { // WebKit normalize the css and remove quotes and whitespaces
          var url = RegExp.$1;
          if (url.lastIndexOf('data:', 0) !== 0 
            && !/\.(?:jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/.test(url)) {
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
