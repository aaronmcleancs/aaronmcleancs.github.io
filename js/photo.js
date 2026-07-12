document.addEventListener('DOMContentLoaded', function() {
  const galleries = Array.from(document.querySelectorAll('.image-gallery'));
  if (!galleries.length) return;
  const viewer = document.querySelector('.fullscreen-viewer');
  if (!viewer) return;
  const fullscreenImage = viewer.querySelector('.fullscreen-image');
  const prevButton = viewer.querySelector('.fullscreen-prev');
  const nextButton = viewer.querySelector('.fullscreen-next');
  const closeButton = viewer.querySelector('.fullscreen-close');
  const counter = viewer.querySelector('.fullscreen-counter');
  const caption = viewer.querySelector('.fullscreen-caption');
  if (!fullscreenImage || !prevButton || !nextButton || !closeButton) return;

  // Navigation is scoped to the gallery the clicked image belongs to
  let activeImages = [];
  let currentIndex = 0;
  let swapTimer = null;

  function preloadNeighbors(index) {
    if (activeImages.length < 2) return;
    [index - 1, index + 1].forEach(function (i) {
      const img = activeImages[(i + activeImages.length) % activeImages.length];
      const pre = new Image();
      pre.src = img.src;
    });
  }

  function applyImage(index) {
    const img = activeImages[index];
    fullscreenImage.src = img.src;
    fullscreenImage.alt = img.alt || '';
    if (caption) caption.textContent = img.alt || '';
    if (counter) {
      counter.textContent = activeImages.length > 1
        ? (index + 1) + ' / ' + activeImages.length
        : '';
    }
    preloadNeighbors(index);
  }

  function showImage(index, instant) {
    currentIndex = index;
    if (instant) {
      applyImage(index);
      return;
    }
    // brief crossfade: fade out, swap, fade back once loaded
    clearTimeout(swapTimer);
    fullscreenImage.classList.add('swapping');
    swapTimer = setTimeout(function () {
      applyImage(index);
      if (fullscreenImage.complete) {
        fullscreenImage.classList.remove('swapping');
      } else {
        fullscreenImage.onload = function () {
          fullscreenImage.classList.remove('swapping');
          fullscreenImage.onload = null;
        };
      }
    }, 140);
  }

  function openViewer(images, index) {
    activeImages = images;
    viewer.classList.toggle('single', images.length < 2);
    showImage(index, true);
    viewer.classList.add('active');
    const progressTracker = document.querySelector('.progress-tracker');
    if (progressTracker) {
      progressTracker.style.display = 'none';
    }
  }

  function closeViewer() {
    viewer.classList.remove('active');
    const progressTracker = document.querySelector('.progress-tracker');
    if (progressTracker) {
      progressTracker.style.display = 'flex';
    }
    window.dispatchEvent(new Event('scroll'));
  }

  function showPrev() {
    if (activeImages.length < 2) return;
    showImage((currentIndex - 1 + activeImages.length) % activeImages.length);
  }

  function showNext() {
    if (activeImages.length < 2) return;
    showImage((currentIndex + 1) % activeImages.length);
  }

  galleries.forEach(function (gallery) {
    const images = Array.from(gallery.querySelectorAll('img'));
    images.forEach(function (img, index) {
      img.addEventListener('click', function () {
        openViewer(images, index);
      });
    });
  });

  prevButton.addEventListener('click', showPrev);
  nextButton.addEventListener('click', showNext);
  closeButton.addEventListener('click', closeViewer);

  document.addEventListener('keydown', function (e) {
    if (!viewer.classList.contains('active')) return;

    switch (e.key) {
      case 'ArrowLeft':
        showPrev();
        break;
      case 'ArrowRight':
        showNext();
        break;
      case 'Escape':
        closeViewer();
        break;
    }
  });

  // close on backdrop click (anything that isn't the image, caption, or a control)
  viewer.addEventListener('click', function(e) {
    if (!e.target.closest('.fullscreen-image, .fullscreen-caption, .fullscreen-nav, .fullscreen-topbar')) {
      closeViewer();
    }
  });
});
