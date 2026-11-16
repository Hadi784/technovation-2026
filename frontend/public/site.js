'use strict';

const root = document.documentElement;
root.classList.add('enhanced');

function storedTheme() {
  try {
    const value = localStorage.getItem('technovation-theme');
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

applyTheme(storedTheme() || 'light');
document.querySelector('.theme-toggle')?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem('technovation-theme', next);
  } catch {
    // The active setting still applies when storage is disabled.
  }
});

const menu = document.querySelector('.menu-button');
const navigation = document.getElementById('main-navigation');
function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
}
if (menu && navigation) {
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menu.focus();
    }
  });
}

if (navigation && location.pathname === '/') {
  const links = [...navigation.querySelectorAll('a')];
  const home = links.find((link) => link.getAttribute('href') === '/');
  function updateSection() {
    const section = location.hash && links.find((link) => link.getAttribute('href') === `/${location.hash}`);
    for (const link of links) {
      if (link === section) link.setAttribute('aria-current', 'location');
      else if (!section && link === home) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
  updateSection();
  window.addEventListener('hashchange', updateSection);
  window.addEventListener('pageshow', updateSection);
}

const passwordToggle = document.querySelector('[data-password-toggle]');
if (passwordToggle) {
  const passwordField = document.getElementById(passwordToggle.getAttribute('aria-controls'));
  if (passwordField) {
    passwordToggle.hidden = false;
    passwordToggle.addEventListener('click', () => {
      const show = passwordField.type === 'password';
      passwordField.type = show ? 'text' : 'password';
      passwordToggle.firstChild.textContent = show ? 'Hide' : 'Show';
    });
  }
}

for (const img of document.querySelectorAll('img[data-logo-fallback]')) {
  const recoverLogo = () => {
    if (img.dataset.logoFallback && !img.dataset.retried) {
      img.dataset.retried = 'true';
      img.src = img.dataset.logoFallback;
    } else {
      img.hidden = true;
      img.nextElementSibling.hidden = false;
    }
  };
  img.addEventListener('error', recoverLogo);
  if (img.complete && img.naturalWidth === 0) recoverLogo();
}
