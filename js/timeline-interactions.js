document.addEventListener('DOMContentLoaded', () => {
  const timelineItems = document.querySelectorAll('.timeline-content');

  timelineItems.forEach(item => {
    item.addEventListener('click', (e) => {

      if (e.target.tagName === 'A' || e.target.closest('a')) return;

      const wasActive = item.classList.contains('active');

      timelineItems.forEach(other => {
        other.classList.remove('active');
      });

      if (!wasActive) {
        item.classList.add('active');
      }
    });
  });
});
