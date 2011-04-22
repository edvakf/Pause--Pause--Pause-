
function imgLoad(e) {
  var img = e.target;
  if (img instanceof HTMLImageElement) pauseAnimationImg(img);
}

function pauseAnimationImg(img) {
  if (/\.(jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/.test(img.src) 
    || img.dataset.originalSrc
    || img.dataset.animationRestarted) return;

  img.dataset.originalSrc = img.src;
  chrome.extension.sendRequest({type: 'img', src: img.src}, function(res) {
    //console.log([img.src, res]);
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
