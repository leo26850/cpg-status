// assets/charts.js — lazy per-panel Chart.js initialization
window.CPGCharts = (function () {
  const data = JSON.parse(document.getElementById('report-data').textContent);
  const built = new Set();

  // Dark-premium theme defaults
  Chart.defaults.color = '#a1a1aa';
  Chart.defaults.borderColor = '#26262b';
  Chart.defaults.font.family = "'Outfit', system-ui, sans-serif";
  Chart.defaults.font.size = 12;

  const ACCENT = '#f5a623';
  const BLUE   = '#60a5fa';
  const GREEN  = '#34d399';
  const GRID   = '#26262b';

  function ensure(panelId) {
    if (built.has(panelId)) return;
    built.add(panelId);
    if (panelId === 'overview')       { buildFunnel(); buildBySource(); }
    if (panelId === 'googleads')      { buildGadsTrend(); }
    if (panelId === 'totalpipeline')  { buildPipelineStages(); }
  }

  // ===== OVERVIEW: Funnel horizontal bar =====
  function buildFunnel() {
    const ctx = document.getElementById('chart-funnel');
    if (!ctx) return;
    const f = data.funnel;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Leads', 'MQL', 'SQL', 'Closed Won'],
        datasets: [{
          label: 'Count',
          data: [f.leads, f.mql, f.sql, f.closed_won],
          backgroundColor: [ACCENT, BLUE, GREEN, '#a78bfa'],
          borderWidth: 0,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} contacts`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: GRID },
            ticks: { precision: 0 },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    });
  }

  // ===== OVERVIEW: Channel split donut =====
  function buildBySource() {
    const ctx = document.getElementById('chart-by-source');
    if (!ctx) return;
    const sources = data.by_source || [];
    const labels = sources.map((s) => s.source === 'gads_lp' ? 'Google Ads' : s.source === 'bison_cold' ? 'Cold Email' : 'Other');
    const counts = sources.map((s) => s.leads);
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: [ACCENT, BLUE, GREEN, '#a78bfa'],
          borderWidth: 0,
          borderRadius: 4,
          spacing: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed} leads`,
            },
          },
        },
      },
    });
  }

  // ===== GOOGLE ADS: Daily trend line =====
  function buildGadsTrend() {
    const ctx = document.getElementById('chart-gads-trend');
    if (!ctx) return;
    if (!data.google_ads) return;
    const daily = data.google_ads.daily;
    const labels = daily.map((d) => d.date.slice(5)); // MM-DD for compactness
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Impressions',
            data: daily.map((d) => d.impressions),
            borderColor: BLUE,
            backgroundColor: 'rgba(96,165,250,.08)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: BLUE,
            yAxisID: 'y',
          },
          {
            label: 'Clicks',
            data: daily.map((d) => d.clicks),
            borderColor: ACCENT,
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: ACCENT,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
        },
        scales: {
          x: {
            grid: { color: GRID },
            ticks: {
              maxTicksLimit: 10,
              maxRotation: 0,
            },
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: GRID },
            title: {
              display: true,
              text: 'Impressions',
              color: '#a1a1aa',
            },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: {
              display: true,
              text: 'Clicks',
              color: '#a1a1aa',
            },
          },
        },
      },
    });
  }

  // ===== TOTAL PIPELINE: Active pipeline by stage horizontal bar =====
  function buildPipelineStages() {
    const ctx = document.getElementById('chart-pipeline-stages');
    if (!ctx) return;
    if (!data.total_pipeline) return;
    // by_stage_open: only open (non-terminal) stages, current snapshot
    const byStage = data.total_pipeline.by_stage_open;
    if (!byStage || byStage.length === 0) return;
    const labels = byStage.map((r) => r.stage);
    const counts = byStage.map((r) => r.count);

    // All open stages get the same amber color — terminal stages are in KPI tiles, not the chart
    const colors = labels.map(() => ACCENT);

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Deals',
          data: counts,
          backgroundColor: colors,
          borderWidth: 0,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.x.toLocaleString()} deals`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: GRID },
            ticks: { precision: 0 },
          },
          y: {
            grid: { display: false },
          },
        },
      },
    });
  }

  return { ensure };
})();
