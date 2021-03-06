// ==UserScript==
// @name         Recover fake preview on Plurk
// @name:zh-tw   還原在噗浪上的偽裝預覽連結
// @version      0.3.0
// @description  Let the links which have fake preview show their original links
// @description:zh-tw 還原在噗浪上的偽裝預覽連結
// @match        https://www.plurk.com/*
// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @license      MIT
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        window.onurlchange
// @connect      www.youtube.com
// @connect      youtu.be
// @connect      tinyurl.com
// @connect      viglink.com
// @connect      reurl.cc
// @connect      is.gd
// @connect      bit.ly
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
    detect: true,
    revert: true,
    hide: true,
    blacklist: []
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

  /* ============== */
  const REG_SHORTURL = [
    /^https?:\/\/tinyurl.com\/.*$/,
    /^https?:\/\/reurl.cc\/.*$/,
    /^https?:\/\/is.gd\/.*$/,
    /^https?:\/\/bit.ly\/.*$/,
    /^https?:\/\/.*\.piee.pw\/.*$/,
    /^https?:\/\/.*\.pse.is\/.*$/
  ];
  const REG_PICSEE = [
    // /http[s ]:\/\/pics.ee\/.*/,
    // /http[s ]:\/\/pse.ee\/.*/,
    /^https?:\/\/.*\.piee.pw\/.*$/,
    /^https?:\/\/.*\.pse.is\/.*$/
  ];

  async function detectUrl (url) {
    const urlList = valueGetSet('blacklist');
    let m = null;
    REG_SHORTURL.forEach(r => { if (!m) m = url.match(r); });
    if (m) {
      await getFinalURL(url).then(finalURL => { url = finalURL; });
      m = null;
      REG_PICSEE.forEach(r => { if (!m) m = url.match(r); });
      if (m) {
        await getHtmlText(url).then(function (res) {
          const m = res.text.match(/location.replace\('([:/\w.&=?]+)'\)/);
          url = m ? m[1] : res.url;
        });
        await getFinalURL(url).then(finalURL => { url = finalURL; });
      }
    }
    let pass = true;
    urlList.forEach(u => {
      u = u.replaceAll('*', '.*');
      pass = pass && !url.match(new RegExp('^' + u + '$'));
    });
    if (pass) return null;
    return getHtmlText(url).then(res => {
      const m = res.text.match(/<title>(.+)<\/title>/);
      return { url: res.url, title: m ? m[1] : res.url };
    }).catch(function () { return null; });
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

  function getFinalURL (url) {
    return new Promise(function (resolve, reject) {
      try {
        GM_xmlhttpRequest({
          method: 'HEAD',
          url: url,
          onload: function (res) {
            if (res.status === 200) resolve(res.finalUrl);
            else reject(url);
          }
        });
      } catch (e) { reject(e.message); }
    });
  }

  window.onurlchange = function () { setTimeout(detectPage, 100); };
  setTimeout(detectPage, 100);

  GM_addStyle('.hidden {display:none}');

  function detectPage () {
    if (window.location.pathname === '/settings/timeline') {
      atSetting();
    } else if (window.location.pathname.match(/^\/p\/[A-Za-z\d]+$/)) {
      handlePlurk(document.querySelector('.bigplurk'));
      const respMo = new MutationObserver(responseMutationHandler);
      respMo.observe($('#plurk_responses .list')[0], { childList: true });
      // pop window
      const popMo = new MutationObserver(
        records => records.forEach(mu => mu.addedNodes.forEach(handlePlurk))
      );
      popMo.observe($('.pop-window-view .cbox_plurk_holder')[0],
        { childList: true });
      const cboxMo = new MutationObserver(responseMutationHandler);
      cboxMo.observe($('#cbox_response .list')[0], { childList: true });
    } else if ($('#dash-profile .nick_name').text() ===
        window.location.pathname.replace('/', '@')) {
      // timeline
      const timelineMo = new MutationObserver(
        records => records.forEach(mu => mu.addedNodes.forEach(handlePlurk))
      );
      timelineMo.observe($('div.block_cnt')[0], { childList: true });
      const formMo = new MutationObserver(responseMutationHandler);
      formMo.observe($('#form_holder .list')[0], { childList: true });
      // pop window
      const popMo = new MutationObserver(
        records => records.forEach(mu => mu.addedNodes.forEach(handlePlurk))
      );
      popMo.observe($('.pop-window-view .cbox_plurk_holder')[0],
        { childList: true });
      const cboxMo = new MutationObserver(responseMutationHandler);
      cboxMo.observe($('#cbox_response .list')[0], { childList: true });
    }
  }

  function responseMutationHandler (records) {
    records.forEach(mu => mu.addedNodes.forEach(resp => {
      handlePlurk(resp).then(pass => {
        if (!pass && valueGetSet('hide')) {
          $(resp).children().addClass('hidden');
          $('<div>此回應已隱藏</div>').on('click', function () {
            $(resp).children().toggleClass('hidden');
          }).css('font-style', 'italic').appendTo(resp);
        }
      });
    }));
  }

  function handlePlurk (plurk) {
    const detect = valueGetSet('detect');
    const revert = valueGetSet('revert');
    const anchors = $(plurk).find('.text_holder a.ex_link').toArray();
    const promises = [];
    anchors.forEach(a => {
      if (detect) promises.push(detectUrl(a.href));
      else {
        a.onclick = function (e) {
          if (a.classList.contains('pass')) return;
          e.preventDefault();
          e.stopPropagation();
          detectUrl(a.href).then(res => {
            if (res) {
              console.debug(res);
              if (window.confirm('此連結導向之目標\n\n' + res.title + '\n' +
                  res.url + '\n\n在黑名單中，確定要開起？')) {
                $('<a target="_blank" href="' + res.url + '"></a>')[0].click();
              }
            } else {
              a.classList.add('pass');
              a.click();
            }
          });
        };
      }
    });
    return Promise.all(promises).then(res => {
      let pass = true;
      for (let i = 0; i < res.length; ++i) {
        pass = pass && !res[i];
        if (res[i] && revert) {
          anchors[i].title = '原始假連結:' + anchors[i].href;
          anchors[i].href = res[i].url;
          anchors[i].innerHTML = res[i].title;
        }
      }
      return pass;
    });
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
      '<div class="desc">還原偽裝預覽連結</div>' +
      '<div class="switch-holder"><div id="detect" class="switch"><div></div>' +
      ' </div><label>主動檢查網址</label></div>' +
      '<div class="switch-holder"><div id="revert" class="switch"><div></div>' +
      ' </div><label>還原網址</label></div>' +
      '<div class="switch-holder"><div id="hide" class="switch"><div></div>' +
      ' </div><label>隱藏回應</label></div>' +
      '<div class="switch-holder"><div>黑名單（一行一個網址）</div>' +
      ' <textarea></textarea><button>儲存黑名單</button></div>' +
      '</div></div>'
    );
    $setting.find('.switch, .switch>div').css('transition', '400ms');
    $setting.find('.switch').each(function () {
      if (valueGetSet(this.id) && valueGetSet('detect')) {
        this.classList.add('checked');
      }
      this.addEventListener('click', function () {
        if (valueGetSet('detect') || this.id === 'detect') {
          this.classList.toggle('checked');
          valueGetSet(this.id, this.classList.contains('checked'));
        }
      }, false);
    });
    $setting.find('#detect')[0].addEventListener('click', function () {
      if (valueGetSet('detect')) {
        $setting.find('.switch').each(function () {
          if (valueGetSet(this.id)) this.classList.add('checked');
        });
      } else { $setting.find('.switch').removeClass('checked'); }
    }, false);
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
