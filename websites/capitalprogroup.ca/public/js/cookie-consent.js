window.addEventListener('load', function () {
  if (typeof window.cookieconsent === 'undefined') return;
  window.cookieconsent.initialise({
    palette: {
      popup: { background: '#11409b', text: '#ffffff' },
      button: { background: '#f97c4b', text: '#ffffff' }
    },
    content: {
      message: 'In order to give you the best user experience, we use cookies on our website.',
      dismiss: 'Continue',
      link: 'More Information',
      href: '/privacy-policy'
    }
  });
});
