/* GOLDI — форма «Заявка на прорахунок» надсилає заявку прямо в Telegram.

   Налаштування — два рядки нижче: токен бота (від @BotFather) і id чату,
   куди мають падати заявки.

   Токен при цьому видно в коді сторінки. Щоб сховати його, досить поставити
   в ENDPOINT адресу власної пересилки (PHP на хостингу чи Cloudflare Worker),
   яка приймає ті самі поля, що й Telegram: chat_id, text, parse_mode. */
(function(){
  var TG_TOKEN   = '';
  var TG_CHAT_ID = '';

  var ENDPOINT = TG_TOKEN ? 'https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage' : '';
  var PHONE = '066 744 00 55';
  var PHONE_TEL = '+380667440055';
  var ORDER_KEY = 'goldi:order-list';
  var LAST_KEY = 'goldi:lead-sent-at';
  var MIN_FILL_MS = 3000;       // людина не заповнить форму швидше
  var RESEND_GAP_MS = 45000;    // одна заявка з браузера не частіше
  var TIMEOUT_MS = 12000;

  var openedAt = Date.now();

  function esc(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function storeGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function storeSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

  function orderList(){
    try{
      var list = JSON.parse(storeGet(ORDER_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }

  // один вигляд для українських номерів: +380XXXXXXXXX; інші лишаються як є
  function normalizePhone(raw){
    var d = String(raw).replace(/\D/g, '');
    if(/^380\d{9}$/.test(d)) return '+' + d;
    if(/^80\d{9}$/.test(d))  return '+3' + d;
    if(/^0\d{9}$/.test(d))   return '+38' + d;
    if(/^\d{9}$/.test(d))    return '+380' + d;
    return (String(raw).trim().charAt(0) === '+' ? '+' : '') + d;
  }

  function buildText(name, phone, message){
    // позиції зі «Списку замовлення», яких клієнт не вписав сам, ідуть у той самий блок
    var extra = orderList().filter(function(e){ return e && e.name && message.indexOf(e.name) === -1; })
                           .slice(0, 40).map(function(e){ return '• ' + e.name; });
    var need = [message.slice(0, 2500)].concat(extra).filter(Boolean).join('\n');

    return ['🟠🔵 <b>Нова заявка з сайту</b> 🟠🔵',
            '',
            '<b>Ім’я:</b> ' + esc(name),
            '<b>Телефон:</b> ' + esc(normalizePhone(phone)),
            '',
            '<b>Що потрібно:</b>',
            need ? esc(need) : '—'].join('\n');
  }

  function send(text){
    if(!ENDPOINT || !TG_CHAT_ID) return Promise.reject(new Error('not configured'));
    // звичайний формат форми, а не JSON: так браузер не робить попереднього
    // запиту, на який Telegram відповідає помилкою
    var body = new URLSearchParams({ chat_id: TG_CHAT_ID, text: text, parse_mode: 'HTML',
                                     disable_web_page_preview: 'true' });
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(ENDPOINT, { method: 'POST', body: body, signal: ctrl ? ctrl.signal : undefined })
      .then(function(r){ return r.json().catch(function(){ return { ok: false }; }); })
      .then(function(data){
        if(timer) clearTimeout(timer);
        if(!data || !data.ok) throw new Error((data && data.description) || 'rejected');
        return data;
      }, function(err){ if(timer) clearTimeout(timer); throw err; });
  }

  function setup(form){
    var button = form.querySelector('button[type="submit"]');
    var success = form.querySelector('#leadSuccess');
    var label = button ? button.innerHTML : '';

    // поле-пастка: людина його не бачить, а спам-бот заповнює
    var trap = document.createElement('input');
    trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off';
    trap.setAttribute('aria-hidden', 'true');
    trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    form.appendChild(trap);

    var note = document.createElement('p');
    note.className = 'lead-note';
    note.setAttribute('role', 'alert');
    note.style.cssText = 'display:none;margin:4px 0 0;padding:12px 14px;border-radius:12px;' +
      'background:rgba(255,120,80,.14);border:1px solid rgba(255,140,100,.45);color:#ffd9cc;font-size:13.5px;line-height:1.5;';
    if(button) button.insertAdjacentElement('afterend', note);

    function say(html){ note.innerHTML = html; note.style.display = html ? 'block' : 'none'; }
    function busy(on){
      if(!button) return;
      button.disabled = on;
      button.style.opacity = on ? '.7' : '';
      button.innerHTML = on ? 'Надсилаємо…' : label;
    }
    function done(){
      form.classList.add('hide-fields');
      if(success) success.classList.add('show');
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      say('');

      var name = (form.elements.name.value || '').trim();
      var phone = (form.elements.phone.value || '').trim();
      var message = (form.elements.message ? form.elements.message.value : '').trim();

      if(!name){ say('Вкажіть, будь ласка, ім’я.'); form.elements.name.focus(); return; }
      if(phone.replace(/\D/g, '').length < 9){
        say('Перевірте номер телефону — у ньому має бути щонайменше 9 цифр.');
        form.elements.phone.focus(); return;
      }

      // схоже на бота — показуємо «надіслано», але нічого не шлемо
      if(trap.value || Date.now() - openedAt < MIN_FILL_MS){ done(); return; }

      var last = +storeGet(LAST_KEY) || 0;
      if(Date.now() - last < RESEND_GAP_MS){
        say('Заявку щойно надіслано. Якщо потрібно щось додати, зачекайте хвилину або зателефонуйте: ' +
            '<a href="tel:' + PHONE_TEL + '" style="color:#fff;text-decoration:underline">' + PHONE + '</a>.');
        return;
      }

      busy(true);
      send(buildText(name, phone, message)).then(function(){
        storeSet(LAST_KEY, String(Date.now()));
        if(window.GoldiOrderList && window.GoldiOrderList.clear) window.GoldiOrderList.clear();
        form.reset();
        busy(false);
        done();
      }).catch(function(){
        busy(false);
        say('Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте: ' +
            '<a href="tel:' + PHONE_TEL + '" style="color:#fff;text-decoration:underline">' + PHONE + '</a>.');
      });
    });
  }

  function init(){
    var form = document.getElementById('leadForm');
    if(form) setup(form);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
