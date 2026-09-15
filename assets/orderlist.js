/* GOLDI — список замовлення. Stores picked positions in localStorage and
   hands them over to the request form on the same page. */
(function(){
  var KEY = 'goldi:order-list';

  function read(){
    try{
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }
  function write(list){
    try{ localStorage.setItem(KEY, JSON.stringify(list)); }catch(e){}
  }

  var dock, badge, panel, backdrop, items, empty, actions;

  function buildUI(){
    dock = document.createElement('button');
    dock.type = 'button';
    dock.className = 'ol-dock';
    dock.innerHTML = 'Список замовлення <span class="ol-badge">0</span>';
    badge = dock.querySelector('.ol-badge');

    backdrop = document.createElement('div');
    backdrop.className = 'ol-backdrop';

    panel = document.createElement('div');
    panel.className = 'ol-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Список замовлення');
    panel.innerHTML =
      '<button type="button" class="ol-close" aria-label="Закрити">×</button>' +
      '<h3>Список замовлення</h3>' +
      '<p class="ol-note">Ціна та наявність підтверджуються менеджером після заявки.</p>' +
      '<ul class="ol-items"></ul>' +
      '<p class="ol-empty">Список поки порожній.</p>' +
      '<div class="ol-actions">' +
        '<a class="btn btn-dark ol-send" href="#request">Надіслати заявку →</a>' +
        '<button type="button" class="ol-clear">Очистити список</button>' +
      '</div>';

    items = panel.querySelector('.ol-items');
    empty = panel.querySelector('.ol-empty');
    actions = panel.querySelector('.ol-actions');

    document.body.appendChild(dock);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    dock.addEventListener('click', open);
    backdrop.addEventListener('click', close);
    panel.querySelector('.ol-close').addEventListener('click', close);
    panel.querySelector('.ol-clear').addEventListener('click', function(){
      write([]); render();
    });
    panel.querySelector('.ol-send').addEventListener('click', function(){
      handOver();
      close();
    });
  }

  function open(){ backdrop.classList.add('show'); panel.classList.add('show'); }
  function close(){ backdrop.classList.remove('show'); panel.classList.remove('show'); }

  function render(){
    var list = read();
    badge.textContent = list.length;
    dock.classList.toggle('show', list.length > 0);
    empty.style.display = list.length ? 'none' : '';
    actions.style.display = list.length ? '' : 'none';

    items.innerHTML = '';
    list.forEach(function(entry, i){
      var li = document.createElement('li');
      var text = document.createElement('div');
      text.textContent = entry.name;
      if(entry.category){
        var cat = document.createElement('span');
        cat.className = 'ol-cat';
        cat.textContent = entry.category;
        text.appendChild(cat);
      }
      var del = document.createElement('button');
      del.type = 'button';
      del.setAttribute('aria-label', 'Прибрати зі списку');
      del.textContent = '×';
      del.addEventListener('click', function(){
        var next = read();
        next.splice(i, 1);
        write(next);
        render();
      });
      li.appendChild(text);
      li.appendChild(del);
      items.appendChild(li);
    });

    if(!list.length) close();
    syncButtons(list);
  }

  function syncButtons(list){
    var names = list.map(function(e){ return e.name; });
    document.querySelectorAll('[data-order-item]').forEach(function(btn){
      var added = names.indexOf(btn.dataset.orderItem) !== -1;
      btn.classList.toggle('added', added);
      // chips carry their own label and show state through CSS instead
      if(btn.dataset.keepLabel === undefined){
        btn.textContent = added ? '✓ У списку замовлення' : 'Додати до списку замовлення';
      }
    });
  }

  function handOver(){
    var list = read();
    if(!list.length) return;
    var field = document.querySelector('#leadForm [name="message"]');
    if(field){
      field.value = list.map(function(e){ return '• ' + e.name; }).join('\n');
    }
    var target = document.getElementById('request');
    if(target) target.scrollIntoView({behavior:'smooth', block:'start'});
  }

  document.addEventListener('DOMContentLoaded', function(){
    buildUI();

    document.querySelectorAll('[data-order-item]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var name = btn.dataset.orderItem;
        var list = read();
        var at = list.map(function(e){ return e.name; }).indexOf(name);
        if(at === -1){
          list.push({name:name, category: btn.dataset.orderCategory || ''});
        }else{
          list.splice(at, 1);
        }
        write(list);
        render();
      });
    });

    render();
  });
})();
