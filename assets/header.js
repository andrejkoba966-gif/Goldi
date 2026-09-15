// ======================================================================
// Shared site header behavior — single source of truth for every page.
// Mirrors index.html's header scripts exactly (sticky glass, mobile menu
// toggle, pinned mobile header, catalog dropdown), plus a path-aware
// "Головна" handler so it scrolls to top on the homepage but navigates
// normally from every other page.
// ======================================================================

// ---- Sticky nav: frosted-glass background once actually scrolled ----
(function(){
  const bar = document.querySelector('.headbottom');
  if(!bar) return;
  function updateStuck(){
    bar.classList.toggle('is-stuck', window.scrollY > 4);
  }
  updateStuck();
  window.addEventListener('scroll', updateStuck, { passive: true });
})();

// ---- Mobile menu toggle (two buttons: initial-header + pinned-bar, same panel) ----
(function(){
  const btns = Array.from(document.querySelectorAll('.menu-toggle'));
  const panel = document.getElementById('mobileNavPanel');
  if(!btns.length || !panel) return;
  function setOpen(isOpen){
    panel.classList.toggle('open', isOpen);
    btns.forEach(function(b){
      b.classList.toggle('active', isOpen);
      b.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
  btns.forEach(function(btn){
    btn.addEventListener('click', function(){
      setOpen(!panel.classList.contains('open'));
    });
  });
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', function(){
    setOpen(false);
  }));
})();

// ---- Mobile header: swap initial (logo+menu) for the pinned bar
//      (menu+Telegram+Viber+Заявка) once the initial header has fully
//      scrolled out of view. Desktop/tablet (>620px) is unaffected —
//      this only toggles a class the mobile media query reacts to. ----
(function(){
  const bar = document.querySelector('.headbottom');
  const headtop = document.querySelector('.headtop');
  if(!bar || !headtop) return;
  const HYSTERESIS = 10;
  let pinned = false;
  function update(){
    if(window.innerWidth > 620){
      if(pinned){ bar.classList.remove('pinned'); pinned = false; }
      return;
    }
    const threshold = headtop.offsetHeight;
    const y = window.scrollY;
    if(!pinned && y > threshold + HYSTERESIS){
      pinned = true;
      bar.classList.add('pinned');
    } else if(pinned && y < threshold - HYSTERESIS){
      pinned = false;
      bar.classList.remove('pinned');
    }
  }
  update();
  window.addEventListener('scroll', update, { passive:true });
  window.addEventListener('resize', update);
})();

// ---- "Головна" nav link: scroll to top when already on that page,
//      otherwise navigate to it normally ----
document.querySelectorAll('.nav-home').forEach(function(a){
  a.addEventListener('click', function(e){
    const linkUrl = new URL(a.href, location.href);
    if(linkUrl.pathname === location.pathname){
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
});

// ---- Catalog nav dropdown ----
(function(){
  const drops = Array.from(document.querySelectorAll('.nav-drop'));
  if(!drops.length) return;
  function closeDrop(drop){
    drop.classList.remove('open');
    const t = drop.querySelector('.nav-drop-toggle');
    if(t) t.setAttribute('aria-expanded', 'false');
  }
  drops.forEach(function(drop){
    const toggle = drop.querySelector('.nav-drop-toggle');
    if(!toggle) return;
    toggle.addEventListener('click', function(e){
      e.stopPropagation();
      const isOpen = drop.classList.contains('open');
      drops.forEach(closeDrop);
      if(!isOpen){
        drop.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', function(e){
    drops.forEach(function(drop){
      if(!drop.contains(e.target)) closeDrop(drop);
    });
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') drops.forEach(closeDrop);
  });
})();
