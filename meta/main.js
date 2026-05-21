import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// color scale for technology ids / languages
const colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line), // or just +row.line
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false, // hide from console.log
        configurable: true,
        writable: true
      });

      return ret;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function appendStat(dl, label, value) {
  const stat = dl.append('div');
  stat.append('dt').html(label);
  stat.append('dd').text(value);
}

function renderCommitInfo(data, commits) {
  const stats = d3.select('#stats').attr('class', 'github-stats');
  stats.html('');
  stats.append('h2').text('Repository activity');

  const dl = stats.append('dl').attr('class', 'info');

  // compute aggregated lines for the current commit set
  const linesFromCommits = (commits && commits.length) ? commits.flatMap((c) => c.lines) : [];

  const totalLOC = linesFromCommits.length || 0;
  const totalCommits = commits ? commits.length : 0;

  appendStat(dl, 'Total <abbr title="Lines of code">LOC</abbr>', totalLOC);
  appendStat(dl, 'Total commits', totalCommits);

  const avgLines = totalCommits ? d3.mean(commits, (d) => d.totalLines) : 0;
  appendStat(dl, 'Average lines per commit', avgLines ? avgLines.toFixed(2) : '0.00');

  const maxDepth = linesFromCommits.length ? d3.max(linesFromCommits, (d) => d.depth) : 0;
  appendStat(dl, 'Maximum depth', maxDepth || 0);

  const avgLength = linesFromCommits.length ? d3.mean(linesFromCommits, (d) => d.length) : 0;
  appendStat(dl, 'Average file length', avgLength ? avgLength.toFixed(2) : '0.00');

  const [minLines, maxLines] = commits && commits.length ? d3.extent(commits, (d) => d.totalLines) : [0, 0];

  const hourCounts = d3.rollup(
    commits,
    (v) => v.length,
    (d) => Math.floor(d.hourFrac)
  );
  let mostActiveHour = 0;
  if (hourCounts && hourCounts.size) {
    mostActiveHour = Array.from(hourCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  }
  appendStat(dl, 'Most active hour', `${mostActiveHour}:00 - ${mostActiveHour + 1}:00`);

  const dayCounts = d3.rollup(
    commits,
    (v) => v.length,
    (d) => d.datetime.getDay()
  );
  let mostActiveDay = 0;
  if (dayCounts && dayCounts.size) {
    mostActiveDay = Array.from(dayCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  }
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  appendStat(dl, 'Most active day', daysOfWeek[mostActiveDay] || 'N/A');
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

let xScale, yScale;

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);
  const cx = xScale(commit.datetime);
  const cy = yScale(commit.hourFrac);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');
  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Render as a semantic definition list inside the container
  let html = '<dl>';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    html += `<dt>${language}</dt><dd><span class="lines">${count} lines</span><span class="pct">${formatted}</span></dd>`;
  }
  html += '</dl>';
  container.innerHTML = html;
}

function createBrushSelector(svg) {
  svg.call(
    d3
      .brush()
      .on('brush', (event) => {
        brushed(event);
      })
  );
    svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(data, commits) {
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 30 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain(d3.extent(commits, (d) => d.hourFrac))
    .range([usableArea.bottom, usableArea.top])
    .nice();

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale);

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  svg.append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  gridlines.call(d3.axisLeft(yScale).tickSize(-usableArea.width).tickFormat(''));

  // radius scale for points (safe fallback if min/max are equal)
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines ?? 0, maxLines ?? 1]).range([10, 20]);

  const dots = svg.append('g').attr('class', 'dots');
  createBrushSelector(svg);
  // Data join with keys and explicit enter/update/exit to enable transitions
  const circles = dots.selectAll('circle').data(sortedCommits, (d) => d.id);

  const circlesEnter = circles
    .enter()
    .append('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', 0)
    .attr('fill', 'steelblue')
    .attr('stroke', 'rgba(255,255,255,0.9)')
    .attr('stroke-width', 0.8)
    .on('mouseenter', (event, commit) => {
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
      updateTooltipVisibility(false);
    });

  // Merge enter + update and transition to new positions/sizes
  circles
    .merge(circlesEnter)
    .transition()
    .duration(300)
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines));

  // Exit: shrink then remove
  circles
    .exit()
    .transition()
    .duration(250)
    .attr('r', 0)
    .remove();

  // Ensure DOM order matches sorted data so larger commits render on top
  dots.selectAll('circle').sort((a, b) => d3.descending(a.totalLines, b.totalLines));
  }

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderTooltipContent(commit) {
    if (Object.keys(commit).length === 0) return;

    const tooltip = document.querySelector('#commit-tooltip');
    const link = document.querySelector('#commit-link');
    const date = document.querySelector('#commit-date');
    const time = document.querySelector('#commit-time');
    const author = document.querySelector('#commit-author');
    const lines = document.querySelector('#commit-lines');

    link.href = commit.url;
    link.textContent = commit.id;
    date.href = commit.url;
    date.textContent = commit.datetime?.toLocaleDateString('en', {
      dateStyle: 'full',
    });
    time.href = commit.url;
    time.textContent = commit.datetime?.toLocaleTimeString('en', {
      timeStyle: 'short',
    });
    author.href = commit.url;
    author.textContent = `by ${commit.author}`;
    lines.href = commit.url;
    lines.textContent = `${commit.totalLines} line${commit.totalLines !== 1 ? 's' : ''}`;

    tooltip.style.display = 'grid';
}

function renderCommitSteps(commits) {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
		On ${d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      })},
		I made <a href="${d.url}" target="_blank" rel="noreferrer">${
        i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
      }</a>.
		I edited ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (line) => line.file,
        ).length
      } files.
		Then I looked over all I had made, and I saw that it was very good.
	`,
    );
}

function renderLineInfoSteps(commits) {
  d3.select('#files-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
		By ${d.datetime.toLocaleString('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })},
		the line information had grown to ${d.totalLines} lines in this commit across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (line) => line.file,
        ).length
      } files.
		${i === 0 ? 'This is the starting snapshot for line information.' : 'Each step adds more context over time.'}
	`,
    );
}

let data = await loadData();
let commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

let commitProgress = Number(document.getElementById('commit-progress').value);
let filteredCommits = commits;
let timeScale = d3.scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime)
  ])
  .range([0, 100]);
let commitTime = timeScale.invert(commitProgress);

function formatCommitTime(date) {
  return date.toLocaleString('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

document.getElementById('commit-filter-time').textContent = formatCommitTime(commitTime);

let currentSelection = null;

function applyCommitDateFilter(commitDate) {
  filteredCommits = commits.filter((d) => d.datetime <= commitDate);
  document.getElementById('commit-filter-time').textContent = formatCommitTime(commitDate);
  commitProgress = timeScale(commitDate);
  document.getElementById('commit-progress').value = commitProgress;
  updateScatterPlot(data, filteredCommits);
  updateFilesList();
  renderCommitInfo(data, filteredCommits);
  brushed({ selection: currentSelection });
}

function applyCommitFilter(progress) {
  const commitMaxTime = timeScale.invert(Number(progress));
  applyCommitDateFilter(commitMaxTime);
}

function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  xScale.domain(d3.extent(commits, (d) => d.datetime));
  // Update y scale domain to reflect the filtered commits (hour of day)
  yScale.domain(d3.extent(commits, (d) => d.hourFrac));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  svg.select('g.x-axis').remove();
  svg.append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis)
    .attr('class', 'x-axis');

  // Update y axis as well to reflect new domain
  svg.select('g.y-axis').remove();
  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale))
    .attr('class', 'y-axis');

  const dots = svg.select('g.dots');

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  // Update path: use explicit enter/update/exit to animate changes
  const updateCircles = dots.selectAll('circle').data(sortedCommits, (d) => d.id);

  const enterUpdate = updateCircles
    .enter()
    .append('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', 0)
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .attr('stroke', 'rgba(255,255,255,0.9)')
    .attr('stroke-width', 0.8)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  updateCircles
    .merge(enterUpdate)
    .transition()
    .duration(300)
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines));

  updateCircles
    .exit()
    .transition()
    .duration(250)
    .attr('r', 0)
    .remove();

  // Keep visual stacking order consistent after updates
  dots.selectAll('circle').sort((a, b) => d3.descending(a.totalLines, b.totalLines));
}

document.getElementById('commit-progress').addEventListener('input', (event) => {
  applyCommitFilter(event.target.value);
});

applyCommitFilter(commitProgress);
renderCommitSteps(commits);
renderLineInfoSteps(commits);

function onStepEnter(response) {
  applyCommitDateFilter(response.element.__data__.datetime);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

function onFilesStepEnter(response) {
  applyCommitDateFilter(response.element.__data__.datetime);
}

function resetFilesScrollyToStart() {
  const firstCommit = commits[0];
  if (firstCommit) {
    applyCommitDateFilter(firstCommit.datetime);
  }
}

const filesScroller = scrollama();
filesScroller
  .setup({
    container: '#scrolly-2',
    step: '#scrolly-2 .step',
    offset: 0.95,
  })
  .onStepEnter(onFilesStepEnter)
  .onStepExit((response) => {
    // When re-entering line-information from above, restart its timeline at the top.
    if (response.direction === 'up' && response.index === 0) {
      resetFilesScrollyToStart();
    }
  });

window.addEventListener('resize', () => {
  scroller.resize();
  filesScroller.resize();
});
// Update files list based on current `filteredCommits`
function updateFilesList() {
  const lines = filteredCommits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      // compute dominant type for this file (most frequent line.type)
      const typeCounts = d3.rollup(lines, (v) => v.length, (d) => d.type);
      let dominantType = '';
      if (typeCounts && typeCounts.size) {
        dominantType = Array.from(typeCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      }
      return { name, lines, type: dominantType };
    })
    .sort((a, b) => b.lines.length - a.lines.length); // sort by number of lines

  const container = d3.select('#files');
  const sel = container.selectAll('div.file').data(files, (d) => d.name);

  const enter = sel
    .enter()
    .append('div')
    .attr('class', 'file')
    .call((div) => {
      const dt = div.append('dt');
      dt.append('code');
      dt.append('small');
      div.append('dd');
    });

  sel.exit().remove();

  const merged = enter.merge(sel);
  merged.select('dt > code').text((d) => d.name);
  merged.select('dt > small').text((d) => `${d.lines.length} lines`);

  // Reorder DOM to match the sorted `files` array so sorting applies on every update
  merged.sort((a, b) => b.lines.length - a.lines.length);

  // set per-file color CSS variable from dominant type
  merged.attr('style', (d) => `--color: ${colors(d.type)}`);

  // Unit visualization: one small div per committed line
  merged.select('dd').each(function(d) {
    const dd = d3.select(this);
    const cells = dd.selectAll('div.loc').data(d.lines);
    cells.join('div').attr('class', 'loc');
    cells.exit().remove();
  });
}

// initial population
updateFilesList();