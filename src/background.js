chrome.extension.onRequest.addListener(function(data, sender, response) {
  if (data.type === 'img') {
    request(
      data.src,
      function(xhr) { // callback
        try {
          var singleImageSrc = getSingleImage(xhr);
          response({dataUrl:singleImageSrc});
        } catch(e) {
          //console.log(e);
          response({error:e.message});
        }
      },
      function() { // errorback
        response({errro:'ERROR: Failed loading image.'});
      }
    );
  } else if (data.type === 'css') {
    request(
      data.src,
      function(xhr) { // callback
        var css = xhr.responseText;
        var urls = extractAnimationUrls(css);
        //console.log(urls);
        count = urls.length;
        if (count === 0) return response({error:'No animation images to replace'});
        var replaceUrls = {};

        function finish_if_ok() {
          if (--count !== 0) return;
          css = makeReplacementCSS(css, replaceUrls);
          if (!css) return response({error:'No animation images to replace'});
          return response({cssText: css});
        }

        urls.forEach(function(url) {
          request(makeAbsoluteUrl(url, data.src), 
            function(res) {
              try {
                replaceUrls[url] = getSingleImage(res);
              } catch(e) {
                //console.log(e);
              };
              finish_if_ok();
            }, 
            finish_if_ok
          );
        });
      },
      function() { // errorback
        response({errro:'ERROR: Failed loading image.'});
      }
    );
  }
});

function request(url, callback, errorback) {
  var xhr = new XMLHttpRequest;
  xhr.open('GET', url, true);

  // If this header is present, some non-image files cannot be read from cache
  // but image files cannot be read from cache anyway. so it's better to have this header.
  xhr.setRequestHeader('If-Modified-Since', new Date().toUTCString());

  //XHR binary charset opt by Marcus Granado 2006 [http://mgran.blogspot.com]
  xhr.overrideMimeType('text/plain; charset=x-user-defined');

  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status >= 200 && xhr.status < 300) {
        callback && callback(xhr);
      } else {
        errorback && errorback(xhr);
      }
    }
  }

  xhr.send(null);
}

function getSingleImage(xhr) {
  var type = xhr.getResponseHeader('Content-Type');
  var body = xhr.responseText.replace(/[\u0100-\uffff]/g, function(c){ 
    return String.fromCharCode(c.charCodeAt(0) & 0xff);
  });

  if (type === 'image/gif') {
    // http://www.tohoho-web.com/wwwgif.htm
    // Animated GIF goes like
    //  - Gif Header starts with 'GIF89a', then follows 7-775 Bytes
    //  - Application Extension starts with 0x21 0xff 0x0b 
    //    then 'NETSCAPE2.0'
    //    then the Block Size #2 (1 Byte)
    //    then 0x01 
    //    then number of loops (2 Bytes)
    //    then the Block Terminator 0x00
    //  - Graphic Control starts with 0x21 0xf9, then 5 Bytes, then 0x00
    //    Image Block starts with 0x2c, then ends with 0x00
    //  - Graphic Control and Image Block repeats
    //  - Trailer 0x3b
    //
    // Normal GIF have neither the Application Extension nor the repeating part

    if (/^(GIF8[79]a[\s\S]{7,775})(\x21\xf9[\s\S]{5}\0)*([\s\S]*?)(\x21\xff\x0bNETSCAPE2\.0[\s\S]\x01[\s\S]{2}\0)([\s\S]*?)(\x21\xf9[\s\S]{5}\0)(\x2c[\s\S]*?\0)(\x21\xf9)/.test(body)) {
      var nonAnimatedGif = [
        RegExp.$1, // Gif Header
        RegExp.$2, // Possible graphic control
        RegExp.$6, // Graphic Control
        RegExp.$7, // Image Block
        String.fromCharCode(0x3b)  // ";"
      ].join('');

      var dataURL = 'data:image/gif;base64,' + btoa(nonAnimatedGif);
      //console.log(dataURL);
      return dataURL;
    } else {
      throw new Error('The GIF image is not animated.');
    }
  }
  throw new Error('ERROR: Image is not an animatable format.');
}


function extractAnimationUrls(cssText) {
  var urls = [], m;
  while (m = /url\(\s*('|")?(\S+)\1\s*\)/g.exec(cssText)) {
    var url = m[2];
    if (url.lastIndexOf('data:',0) !== 0 && !/\.(?:jpe?g|jp2|png|tiff?|bmp|dib|svgz?|ico)\b/.test(url)) urls.push(url);
  }
  return urls.filter(function(x, i) {return urls.indexOf(x) === i}); // unique
}

function makeAbsoluteUrl(url, baseUrl) {
  if (/^https?:/.test(url)) return url;
  if (url.indexOf('/') === 0) return baseUrl.replace(/^(https?:\/\/[^\/]*)(.*)$/, function($0,$1,$2) {return $1 + url});
  return baseUrl + url;
}

function makeReplacementCSS(cssText, replaceUrls) {
  var flag = false;
  Object.keys(replaceUrls).forEach(function(url) {
    cssText = cssText.replace(new RegExp(url.replace(/\W/g,'\\$&'), 'g'), function($0) {
      flag = true;
      return replaceUrls[url];
    });
  });
  if (!flag) return '';
  return cssText;
}
