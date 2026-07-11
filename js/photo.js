document.addEventListener('DOMContentLoaded', function() {
  const galleries = Array.from(document.querySelectorAll('.image-gallery'));
  if (!galleries.length) return;
  const viewer = document.querySelector('.fullscreen-viewer');
  if (!viewer) return;
  const fullscreenImage = viewer.querySelector('.fullscreen-image');
  const prevButton = viewer.querySelector('.fullscreen-prev');
  const nextButton = viewer.querySelector('.fullscreen-next');
  const closeButton = viewer.querySelector('.fullscreen-close');
  if (!fullscreenImage || !prevButton || !nextButton || !closeButton) return;

  // Navigation is scoped to the gallery the clicked image belongs to
  let activeImages = [];
  let currentIndex = 0;

  function openViewer(images, index) {
    activeImages = images;
    currentIndex = index;
    fullscreenImage.src = activeImages[currentIndex].src;
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
    if (!activeImages.length) return;
    currentIndex = (currentIndex - 1 + activeImages.length) % activeImages.length;
    fullscreenImage.src = activeImages[currentIndex].src;
  }

  function showNext() {
    if (!activeImages.length) return;
    currentIndex = (currentIndex + 1) % activeImages.length;
    fullscreenImage.src = activeImages[currentIndex].src;
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

  viewer.addEventListener('click', function(e) {
    if (e.target === viewer) {
      closeViewer();
    }
  });
});
