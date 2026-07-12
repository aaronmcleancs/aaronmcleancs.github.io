// Contact form: async submit with in-button state feedback
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contact-form');
  if (!form || !window.fetch) return;

  var button = form.querySelector('button.contact-send');
  var label = form.querySelector('.send-label');
  var icon = button ? button.querySelector('i') : null;
  if (!button || !label) return;

  function setState(text, iconClass, disabled, sent) {
    label.textContent = text;
    if (icon) icon.className = iconClass;
    button.disabled = disabled;
    button.classList.toggle('sent', !!sent);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setState('Sending', 'fas fa-circle-notch fa-spin', true, false);

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (res.ok) {
        form.reset();
        setState('Sent', 'fas fa-check', true, true);
        setTimeout(function () {
          setState('Send', 'fas fa-arrow-right', false, false);
        }, 4000);
      } else {
        throw new Error('bad response');
      }
    }).catch(function () {
      setState('Failed \u2014 try email above', 'fas fa-triangle-exclamation', false, false);
      setTimeout(function () {
        setState('Send', 'fas fa-arrow-right', false, false);
      }, 4000);
    });
  });
});
