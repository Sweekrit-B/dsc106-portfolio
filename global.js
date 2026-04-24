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
  : "/dsc106-portfolio/";         // GitHub Pages repo name

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'contact/', title: 'Contact' },
    { url: 'resume/', title: 'Resume' },
    { url: 'https://github.com/Sweekrit-B', title: 'GitHub' }
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const osPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const osPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
let autoLabel = 'Automatic';
if (osPrefersDark) autoLabel = 'Automatic (Dark)';
else if (osPrefersLight) autoLabel = 'Automatic (Light)';

document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <select id="color-scheme-select" aria-label="Theme">
      <option value="auto">${autoLabel}</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  `
);

const select = document.querySelector('#color-scheme-select');
function applyColorScheme(value) {
  // CSS color-scheme accepts: normal | light | dark | light dark
  const cssValue = value === 'auto' ? 'light dark' : value;
  document.documentElement.style.setProperty('color-scheme', cssValue);
}

select.addEventListener('input', function(event) {
  console.log('color scheme changed to', event.target.value);
  localStorage.colorScheme = event.target.value;
  applyColorScheme(event.target.value);
});

// Set the initial color scheme based on localStorage or default to 'light'
const savedColorScheme = localStorage.colorScheme;
if (savedColorScheme) {
  select.value = savedColorScheme;
  applyColorScheme(savedColorScheme);
} else {
  // Default to following the OS theme.
  select.value = 'auto';
  applyColorScheme('auto');
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

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
};

export function renderProjects(projects, containerElement, headingLevel = 'h3') {
  if (!containerElement) return;
  if (!projects) return;

  const projectList = Array.isArray(projects) ? projects : [projects];
  containerElement.innerHTML = ''; // Clear existing content

  for (const project of projectList) {
    const article = document.createElement('article');
    const skills = Array.isArray(project.skills) && project.skills.length > 0
      ? `
        <section class="project-section project-skills-section">
          <h3>Skills</h3>
          <ul class="project-skills">
            ${project.skills.map((skill) => `<li>${skill}</li>`).join('')}
          </ul>
        </section>
      `
      : '';
    const links = Array.isArray(project.links) && project.links.length > 0
      ? `
        <section class="project-section project-links-section">
          <h3>Links</h3>
          <ul class="project-links">
            ${project.links.map((link) => `
              <li>
                <a href="${link.href}"${link.href.startsWith('http') ? ' target="_blank" rel="noreferrer"' : ''}>
                  ${link.label}
                </a>
              </li>
            `).join('')}
          </ul>
        </section>
      `
      : '';

    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      <p class="project-year">${project.year ?? ''}</p>
      <img src="${project.image}" alt="${project.title}">
      <p>${project.description}</p>
      ${skills}
      ${links}
    `;
    containerElement.appendChild(article);
  }
};

export function renderResumeComponents(resume) {
  if (!resume) return;

  const educationPanel = document.querySelector('#education-panel');
  if (educationPanel) {
    const coursework = Array.isArray(resume.education?.coursework)
      ? resume.education.coursework.join(', ')
      : '';

    educationPanel.innerHTML = `
      <section class="resume-education">
      <p class="resume-school">${resume.education?.school ?? ''}</p>
      <p>
        ${resume.education?.degree ?? ''}
        <time datetime="${resume.education?.graduationDate ?? ''}">${resume.education?.graduation ?? ''}</time>
      </p>
      <p><b>Relevant Coursework:</b> ${coursework}</p>
      </section>
    `;
  }

  const experienceGrid = document.querySelector('#experience-grid');
  if (experienceGrid && Array.isArray(resume.experience)) {
    experienceGrid.innerHTML = '';

    for (const role of resume.experience) {
      const article = document.createElement('article');
      const bullets = Array.isArray(role.bullets)
        ? role.bullets.map((bullet) => `<li>${bullet}</li>`).join('')
        : '';
      const endMarkup = role.endDate
        ? `<time datetime="${role.endDate}">${role.end}</time>`
        : role.end ?? '';

      article.innerHTML = `
        <header>
          <h3>${role.role}</h3>
          <p class="resume-meta"><time datetime="${role.startDate ?? ''}">${role.start ?? ''}</time> - ${endMarkup}</p>
          <p class="resume-meta">${role.company}, ${role.location}</p>
        </header>
        <ul>${bullets}</ul>
      `;

      experienceGrid.appendChild(article);
    }
  }

  const skillsPanel = document.querySelector('#skills-panel');
  if (skillsPanel && Array.isArray(resume.technicalSkills)) {
    skillsPanel.innerHTML = `
      <section class="resume-skills-grid">
        ${resume.technicalSkills
          .map(
            (group) => `
              <article class="resume-skill-group">
                <h3>${group.category}</h3>
                <ul class="project-skills">
                  ${(group.items ?? []).map((item) => `<li>${item}</li>`).join('')}
                </ul>
              </article>
            `
          )
          .join('')}
      </section>
    `;
  }
}

export function fetchGithubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}