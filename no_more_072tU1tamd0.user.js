// ==UserScript==
// @name         No more 072tU1tamd0 on Plurk
// @name:zh-tw   不要在噗浪端火鍋
// @version      0.1.1
// @description  No more 072tU1tamd0 on Plurk
// @description:zh-tw 讓統神端火鍋連結現出原形
// @match        https://www.plurk.com/*
// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        window.onurlchange
// @connect      www.youtube.com
// @connect      youtu.be
// @connect      piee.pw
// @connect      pse.ee
// @connect      *
// ==/UserScript==

/* jshint esversion: 6 */
/* global $ */

(function () {
  'use strict';
  /* ======= storage ======= */
  const DEFAULT_VALUE = {
    revert: true,
    hide: true,
    blacklist: [
      'https://www.youtube.com/watch?*v=072tU1tamd0*',
      'https://youtu.be/072tU1tamd0*',
      'https://www.youtube.com/watch?*v=dMTy6C4UiQ4*',
      'https://youtu.be/dMTy6C4UiQ4*'
    ]
  };
  Object.keys(DEFAULT_VALUE).forEach(k => {
    if (typeof GM_getValue(k) !== typeof DEFAULT_VALUE[k]) {
      GM_setValue(k, DEFAULT_VALUE[k]);
    }
  });
  function valueGetSet (key, val = null) {
    if (val != null) GM_setValue(key, val);
    return GM_getValue(key);
  }

  /* ======= utils ======= */
  const REG_PICSEE = [
    // /http[s ]:\/\/pics.ee\/.*/,
    // /http[s ]:\/\/pse.ee\/.*/,
    /^https?:\/\/.*\.piee.pw\/.*$/,
    /^https?:\/\/.*\.pse.is\/.*$/
  ];
  async function detectUrl (url, urlList) {
    let m = null;
    REG_PICSEE.forEach(r => { if (!m) m = url.match(r); });
    if (m) {
      await getHtmlText(url).then(function (res) {
        const m = res.text.match(/location.replace\('([:/\w.&=?]+)'\)/) ||
          res.text.match(
            /<link rel="shortlink(?:Url|)" href="(https:\/\/youtu\.be\/\w+)"/);
        url = m ? m[1] : url;
      });
    }
    return new Promise(function (resolve, reject) {
      let pass = true;
      urlList.forEach(u => {
        u = u.replaceAll('*', '.*');
        pass = pass && !url.match(new RegExp('^' + u + '$'));
      });
      if (!pass) {
        getHtmlText(url).then(function (res) {
          const m = res.text.match(/<title>(.+)<\/title>/);
          resolve({ url: res.url, title: m ? m[1] : res.url });
        }).catch(function () { resolve(null); });
        return;
      }
      resolve(null);
    });
  }
  function getHtmlText (url) {
    return new Promise(function (resolve, reject) {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          onload: function (res) {
            if (res.status === 200 &&
                res.responseHeaders.match(/content-type: text\/html/i)) {
              resolve({ text: res.responseText, url: res.finalUrl });
            } else { reject(res.statusText); }
          }
        });
      } catch (e) { reject(e.message); }
    });
  }

  /**/
  window.onurlchange = function () { setTimeout(detectPage, 100); };
  setTimeout(detectPage, 100);

  GM_addStyle('.hidden {display:none}');

  function detectPage () {
    if (window.location.pathname === '/settings/timeline') {
      console.debug('At setting');
      atSetting();
    } else if (window.location.pathname.match(/^\/p\/[A-Za-z\d]+$/)) {
      console.debug('At plurk');
      atBigPlurk();
    } else {
      const uid = $('#dash-profile .nick_name');
      if (uid.length &&
          uid[0].innerText.replace('@', '/') === window.location.pathname) {
        console.debug('At home');
        atHome();
      }
      console.debug('not match');
    }
  }
  function atHome () {
    const blacklist = valueGetSet('blacklist');
    const revert = valueGetSet('revert');
    const hide = valueGetSet('hide');
    const mo = new MutationObserver(r => r.forEach(mu => {
      if (mu.addedNodes.length > 0 &&
          mu.target.classList.contains('block_cnt')) {
        mu.addedNodes.forEach(plurk => {
          const $a = $(plurk).find('.text_holder a.ex_link').toArray();
          const promises = [];
          $a.forEach(a => promises.push(detectUrl(a.href, blacklist)));
          Promise.all(promises).then(function (res) {
            for (let i = 0; i < res.length; ++i) {
              if (res[i] && revert) {
                $a[i].title = ['原始假連結:', $a[i].href].join(' ');
                $a[i].href = res[i].url;
                $a[i].innerHTML = res[i].title;
              }
            }
          });
        });
      } else if (mu.addedNodes.length > 0 &&
          mu.target.classList.contains('list')) {
        mu.addedNodes.forEach(resp => {
          const $a = $(resp).find('.text_holder a.ex_link').toArray();
          const promises = [];
          $a.forEach(a => promises.push(detectUrl(a.href, blacklist)));
          Promise.all(promises).then(function (res) {
            let pass = true;
            for (let i = 0; i < res.length; ++i) {
              pass = pass && !res[i];
              if (res[i] && revert) {
                $a[i].title = ['原始假連結:', $a[i].href].join(' ');
                $a[i].href = res[i].url;
                $a[i].innerHTML = res[i].title;
              }
            }
            if (!pass && hide) {
              $(resp).children().addClass('hidden');
              $('<div>此回應已隱藏</div>').on('click', function () {
                $(resp).children().toggleClass('hidden');
              }).css('font-style', 'italic').appendTo(resp);
            }
          });
        });
      }
    }));
    mo.observe(document.body, { childList: true, subtree: true });
  }
  function atBigPlurk () {
    const blacklist = valueGetSet('blacklist');
    const revert = valueGetSet('revert');
    const hide = valueGetSet('hide');
    // 噗首
    const $a = $('.text_holder a.ex_link').toArray();
    const promises = [];
    $a.forEach(a => promises.push(detectUrl(a.href, blacklist)));
    Promise.all(promises).then(function (res) {
      for (let i = 0; i < res.length; ++i) {
        if (res[i] && revert) {
          $a[i].title = ['原始假連結:', $a[i].href].join(' ');
          $a[i].href = res[i].url;
          $a[i].innerHTML = res[i].title;
        }
      }
    });
    // 回應
    const mo = new MutationObserver(r => r.forEach(mu => {
      if (mu.addedNodes.length > 0 && mu.target.classList.contains('list')) {
        mu.addedNodes.forEach(resp => {
          const $a = $(resp).find('.text_holder a.ex_link').toArray();
          const promises = [];
          $a.forEach(a => promises.push(detectUrl(a.href, blacklist)));
          Promise.all(promises).then(function (res) {
            let pass = true;
            for (let i = 0; i < res.length; ++i) {
              pass = pass && !res[i];
              if (res[i] && revert) {
                $a[i].title = ['原始假連結:', $a[i].href].join(' ');
                $a[i].href = res[i].url;
                $a[i].innerHTML = res[i].title;
              }
            }
            if (!pass && hide) {
              $(resp).children().addClass('hidden');
              $('<div>此回應已隱藏</div>').on('click', function () {
                $(resp).children().toggleClass('hidden');
              }).css('font-style', 'italic').appendTo(resp);
            }
          });
        });
      }
    }));
    mo.observe(document.body, { childList: true, subtree: true });
  }
  function atSetting () {
    GM_addStyle(
      '.switch-holder {display: block; padding: 4px 1px; margin-left: 8px;}' +
      '.switch-holder label {padding-left: 8px; }' +
      '.switch-holder textarea {display: block; width: 100%}' +
      '.switch {width: 50px; height: 20px; background: #E3E3E3;' +
      '  border-radius: 5px; display: inline-block; vertical-align: middle}' +
      '.switch.checked {background: #9CE03E}' +
      '.switch div {width: 24px; height: 16px; background: #FFF;' +
      '  border-radius: 3px; margin: 2px; display: inline-block;}' +
      '.switch.checked div {margin-left: 24px}'
    );
    const $setting = $(
      '<div class="form-table"><div class="form-item">' +
      '<div class="desc">不要在噗浪端鍋</div>' +
      '<div class="switch-holder"><div id="revert" class="switch"><div></div>' +
      ' </div><label>還原網址</label></div>' +
      '<div class="switch-holder"><div id="hide" class="switch"><div></div>' +
      ' </div><label>隱藏回應</label></div>' +
      '<div class="switch-holder"><div>黑名單（一行一個網址）</div>' +
      ' <textarea></textarea><button>儲存黑名單</button></div>' +
      '</div></div>'
    );
    $setting.find('.switch').each(function () {
      if (valueGetSet(this.id)) this.classList.add('checked');
      this.onclick = function () {
        this.classList.toggle('checked');
        valueGetSet(this.id, this.classList.contains('checked'));
      };
    });
    const blacklist = $setting.find('textarea')[0];
    valueGetSet('blacklist').forEach(url => { blacklist.value += url + '\n'; });
    $setting.find('button').on('click', function () {
      const urls = [];
      blacklist.value.split('\n').forEach(url => {
        url = url.trim();
        if (url) urls.push(url);
      });
      valueGetSet('blacklist', urls);
    });

    if (document.querySelector('div.form-holder')) {
      console.debug('`form-holder` is found');
      $('div.form-holder').after($setting);
    } else {
      const mo = new MutationObserver(r => r.forEach(mu => {
        if (mu.target.id === 'setting-holder' && mu.addedNodes.length > 0) {
          console.debug('`form-holder` is inserted');
          mo.disconnect();
          $('div.form-holder').after($setting);
        }
      }));
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }
})();
