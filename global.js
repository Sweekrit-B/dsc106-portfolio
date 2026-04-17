console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let navLinks = $$('nav a');
let currentLink = navLinks.find(
    (a) => a.host === location.host && a.pathname === location.pathname,
);
currentLink?.classList.add('current');

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/dsc106/labs/dsc106-portfolio/"                  // Local server
  : "/website/";         // GitHub Pages repo name

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'resume/', title: 'Resume' },
    { url: 'https://github.com/Sweekrit-B', title: 'GitHub' }
];

let nav = document.createElement('nav');
document.body.prepend(nav);
document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <label class="color-scheme" style="position: absolute; top: 4rem; right: 1rem; display: flex; align-items: center; gap: 0.5em;">
      <span>Theme:</span>
      <select id="color-scheme-select">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `
);

const select = document.querySelector('#color-scheme-select');
select.addEventListener('input', function(event) {
  console.log('color scheme changed to', event.target.value);
  localStorage.colorScheme = event.target.value;
  document.documentElement.style.setProperty('color-scheme', event.target.value);
});

// Set the initial color scheme based on localStorage or default to 'light'
const savedColorScheme = localStorage.colorScheme;
if (savedColorScheme) {
  select.value = savedColorScheme;
  document.documentElement.style.setProperty('color-scheme', savedColorScheme);
}

for (let p of pages) {
    let url = p.url;
    url = !url.startsWith('http') ? BASE_PATH + url : url;
    let title = p.title;
    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;
    nav.append(a);
    if (a.host === location.host && a.pathname === location.pathname) {
        a.classList.add('current');
    }
    if (a.host !== location.host) {
        a.target = '_blank';
    }
}

let form = document.querySelector('#contact-form');
const contact = form?.addEventListener('submit', function(event) {
    event.preventDefault();
    for (let [name, value] of new FormData(form)) {
        console.log(name, encodeURIComponent(value));
        location.href = `mailto:sbhatnagar@ucsd.edu?subject=${encodeURIComponent(document.querySelector('input[name="subject"]').value)}&body=${encodeURIComponent(document.querySelector('textarea[name="body"]').value)}`;
    }
});