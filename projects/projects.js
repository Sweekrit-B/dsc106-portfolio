import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/project.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const numProjects = projects.length;
const projectsTitle = document.querySelector('#projects-title');
projectsTitle.textContent = `${numProjects} Projects`;

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
let colors = d3.scaleOrdinal(d3.schemeCategory10);
let selectedIndex = null;
let selectedYear = null;

function updateUI() {
    let baseProjects = selectedIndex === null ? projects : projects.filter(p => p.year === selectedYear );
    let filteredProjects = baseProjects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });
    renderProjects(filteredProjects, projectsContainer, 'h2');

    // Reset condition
    if (query === '' && selectedIndex === null) {
        renderPieChart(projects);
    } else if (selectedIndex == null) {
        renderPieChart(filteredProjects);
    }
}

function renderPieChart(projectsGiven) {
    let newRolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year,
    );
    if (newRolledData.length === 0) {
        d3.select('#projects-plot').selectAll('path').remove();
        d3.select('#projects-plot').selectAll('text').remove();
        d3.select('.legend').selectAll('li').remove();
        
        // Add centered text for empty state
        d3.select('svg').append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '12px')
            .attr('font-style', 'italic')
            .attr('fill', '#999')
            .text('No projects');
        
        return;
    }
    let newData = newRolledData.map(([year, count]) => ({ label: year, value: count }));
    let newSliceGenerator = d3.pie().value((d) => d.value);
    let newArcData = newSliceGenerator(newData);
    let newArcs = newArcData.map((d) => arcGenerator(d));
    
    // Clear and redraw SVG paths (use explicit #projects-plot)
    const svg = d3.select('#projects-plot');
    svg.selectAll('path').remove();
    svg.selectAll('text').remove();
    newArcs.forEach((arc, i) => {
        svg.append('path')
           .attr('d', arc)
           .attr('fill', colors(i))
           .attr('style', `--color:${colors(i)}`)
           .classed('selected', selectedIndex === i)
           .on('click', () => {
               selectedIndex = selectedIndex === i ? null : i;
               selectedYear = selectedIndex !== null ? newData[selectedIndex].label : null;
               svg.selectAll('path').classed('selected', (_, idx) => idx === selectedIndex);
               updateUI();
           });
    });
    
    // Clear and redraw legend
    let legend = d3.select('.legend');
    legend.selectAll('li').remove();
    newData.forEach((d, idx) => {
        legend
            .append('li')
            .attr('class', 'legend-item')
            .attr('style', `--color:${colors(idx)}`)
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
    });
}

renderPieChart(projects);

let query = '';
let searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('input', (event) => {
    query = event.target.value.toLowerCase();
    updateUI();
});

// Clear button handler
let clearButton = document.querySelector('.clearButton');
if (clearButton) {
    clearButton.addEventListener('click', () => {
        query = '';
        selectedIndex = null;
        selectedYear = null;
        searchInput.value = '';
        updateUI();
    });
}