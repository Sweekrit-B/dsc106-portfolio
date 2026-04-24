import { fetchJSON, renderProjects } from "../global.js";

const projects = await fetchJSON('../lib/project.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const numProjects = projects.length;
const projectsTitle = document.querySelector('#projects-title');
projectsTitle.textContent = `${numProjects} Projects`;