import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
    });
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

  appendStat(dl, 'Total <abbr title="Lines of code">LOC</abbr>', data.length);
  appendStat(dl, 'Total commits', commits.length);

  const avgLines = d3.mean(commits, (d) => d.totalLines);
  appendStat(dl, 'Average lines per commit', avgLines.toFixed(2));

  const maxDepth = d3.max(data, (d) => d.depth);
  appendStat(dl, 'Maximum depth', maxDepth);

  const avgLength = d3.mean(data, (d) => d.length);
  appendStat(dl, 'Average file length', avgLength.toFixed(2));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);

  const hourCounts = d3.rollup(
    commits,
    (v) => v.length,
    (d) => Math.floor(d.hourFrac)
  );
  const mostActiveHour = Array.from(hourCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  appendStat(dl, 'Most active hour', `${mostActiveHour}:00 - ${mostActiveHour + 1}:00`);

  const dayCounts = d3.rollup(
    commits,
    (v) => v.length,
    (d) => d.datetime.getDay()
  );
  const mostActiveDay = Array.from(dayCounts.entries()).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  appendStat(dl, 'Most active day', daysOfWeek[mostActiveDay]);
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
  const cy = yScale(commit.totalLines);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
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
    .domain(d3.extent(commits, (d) => d.totalLines))
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
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
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
  dots
    .selectAll('circle')
    .data(commits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.totalLines))
    .attr('r', (d) => rScale(d.totalLines))
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

let data = await loadData();
let commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);