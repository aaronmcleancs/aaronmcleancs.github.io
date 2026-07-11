$(document).ready(function() {
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile) {
    ['#card1', '#card2', '#card3', '#card4'].forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        $(element).addClass('animate__fadeInUp visible').removeClass('animate__fadeOutDown');
      }
    });
    const scrollElement = document.querySelector('#scroll');
    if (scrollElement) {
      $('#scroll').addClass('animate__fadeInUp').removeClass('animate__fadeOutDown');
    }
  } else {
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
    const cardSelectors = ['#card1', '#card2', '#card3', '#card4'];
    const animatedCards = new Set();
    const cardObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        const targetCard = entry.target;
        const cardId = targetCard.id;
        if (entry.isIntersecting && !animatedCards.has(cardId)) {
          const index = cardSelectors.indexOf('#' + cardId);
          requestAnimationFrame(() => {
            setTimeout(() => {
              $(targetCard).addClass('animate__fadeInUp visible').removeClass('animate__fadeOutDown');
              animatedCards.add(cardId);
            }, index * 50);
          });
          observer.unobserve(targetCard);
        }
      });
    }, observerOptions);
    cardSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        $(element).removeClass('animate__fadeInUp visible').addClass('animate__fadeOutDown');
        cardObserver.observe(element);
      }
    });
    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          $('#scroll').addClass('animate__fadeInUp').removeClass('animate__fadeOutDown');
        }
      });
    }, observerOptions);
    const scrollElement = document.querySelector('#scroll');
    if (scrollElement) {
      scrollObserver.observe(scrollElement);
    }
  }
});
document.addEventListener('DOMContentLoaded', function() {
  var scrollPill = document.querySelector('.scroll-pill');
  if (scrollPill) {
    scrollPill.addEventListener('click', function() {
      var projectsSection = document.querySelector('#projects');
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
