// Reveal expertise cards as they enter the viewport
document.addEventListener('DOMContentLoaded', function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card-props'));
  if (!cards.length) return;
  if (!('IntersectionObserver' in window)) {
    cards.forEach(function (c) { c.classList.add('visible'); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var card = entry.target;
      // stagger by DOM order so the cascade matches visual order
      card.style.transitionDelay = (cards.indexOf(card) % 2) * 60 + 'ms';
      card.classList.add('visible');
      observer.unobserve(card);
    });
  }, { threshold: 0.1 });
  cards.forEach(function (c) { observer.observe(c); });
});
document.addEventListener('DOMContentLoaded', function() {
  var scrollPill = document.querySelector('.scroll-pill');
  if (scrollPill) {
    scrollPill.addEventListener('click', function() {
      var projectsSection = document.querySelector('#expertise');
      if (projectsSection) {
        projectsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
});
// Open Source nav dropdown: click toggle for touch devices, close on outside click / Escape
document.addEventListener('DOMContentLoaded', function () {
  var dropdown = document.querySelector('.nav-dropdown');
  if (!dropdown) return;
  var toggle = dropdown.querySelector('.nav-dropdown-toggle');

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = dropdown.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', function (e) {
    if (dropdown.classList.contains('open') && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
});

// Mobile hamburger menu
document.addEventListener('DOMContentLoaded', function () {
  var hamburger = document.querySelector('.nav-hamburger');
  var menu = document.querySelector('.mobile-menu');
  if (!hamburger || !menu) return;
  var icon = hamburger.querySelector('i');

  function setOpen(open) {
    menu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (icon) {
      icon.classList.toggle('fa-bars', !open);
      icon.classList.toggle('fa-xmark', open);
    }
  }

  hamburger.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });

  // Close when a link is tapped, when tapping outside, or on Escape
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', function (e) {
    if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== hamburger) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false);
  });
});

// Selected work: one shared image frame that follows the hovered / selected project
document.addEventListener('DOMContentLoaded', function () {
  var stage = document.querySelector('[data-stage]');
  if (!stage) return;
  var items = stage.querySelectorAll('.stage__item');
  var imgs = stage.querySelectorAll('.stage__frame img');
  var frame = stage.querySelector('.stage__frame');
  var caption = stage.querySelector('[data-stage-caption]');
  var canHover = window.matchMedia('(hover: hover)').matches;

  function select(n) {
    items.forEach(function (item, i) {
      var on = i === n;
      item.classList.toggle('is-active', on);
      item.querySelector('.stage__toggle').setAttribute('aria-expanded', on ? 'true' : 'false');
      imgs[i].classList.toggle('is-active', on);
    });
    frame.href = items[n].dataset.href;
    caption.innerHTML = items[n].dataset.caption;
  }

  // descriptions stay collapsed until an item is hovered or tapped; the photo keeps the last selection
  function collapse() {
    items.forEach(function (item) {
      item.classList.remove('is-active');
      item.querySelector('.stage__toggle').setAttribute('aria-expanded', 'false');
    });
  }

  items.forEach(function (item, i) {
    item.querySelector('.stage__toggle').addEventListener('click', function () {
      if (item.classList.contains('is-active') && !canHover) collapse();
      else select(i);
    });
    if (canHover) item.addEventListener('mouseenter', function () { select(i); });
  });
  if (canHover) stage.querySelector('.stage__list').addEventListener('mouseleave', collapse);
});

