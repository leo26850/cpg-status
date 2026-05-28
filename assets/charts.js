// assets/charts.js — runs on page load, reads embedded report data, builds 5 charts.
(function() {
  const data = JSON.parse(document.getElementById('report-data').textContent);

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#3F3F3F';
  Chart.defaults.borderColor = '#E0E0E0';

  const ACCENT = '#F5A623';
  const ACCENT_DIM = '#B27A18';
  const BLUE = '#2563EB';
  const GREEN = '#16A34A';

  // 4.2 — Stacked bar by source (section 4)
  const bySourceCtx = document.getElementById('chart-by-source');
  if (bySourceCtx) {
    new Chart(bySourceCtx, {
      type: 'bar',
      data: {
        labels: data.monthly.map(m => m.month),
        datasets: [
          { label: 'gads_lp', data: data.monthly.map(m => m.leads_by_source.gads_lp), backgroundColor: ACCENT, borderRadius: 0 },
          { label: 'bison_cold', data: data.monthly.map(m => m.leads_by_source.bison_cold), backgroundColor: '#3F3F3F', borderRadius: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#E0E0E0' } },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  // 4.3 — Funnel (rendered as horizontal bar with custom labels) (section 5)
  const funnelCtx = document.getElementById('chart-funnel');
  if (funnelCtx) {
    const f = data.funnel;
    new Chart(funnelCtx, {
      type: 'bar',
      data: {
        labels: ['Leads', 'MQL', 'SQL', 'Closed Won'],
        datasets: [{
          label: 'Count',
          data: [f.leads, f.mql, f.sql, f.closed_won],
          backgroundColor: [ACCENT, ACCENT_DIM, BLUE, GREEN],
          borderRadius: 0,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, grid: { color: '#E0E0E0' } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false }, title: { display: true, text: 'Funnel' } },
      },
    });
  }

  // 4.4 — Grouped bar: MQL by source by month (section 5)
  const mqlBySourceCtx = document.getElementById('chart-mql-by-source');
  if (mqlBySourceCtx) {
    new Chart(mqlBySourceCtx, {
      type: 'bar',
      data: {
        labels: data.monthly.map(m => m.month),
        datasets: [
          { label: 'gads_lp', data: data.monthly.map(m => m.mql_by_source.gads_lp), backgroundColor: ACCENT, borderRadius: 0 },
          { label: 'bison_cold', data: data.monthly.map(m => m.mql_by_source.bison_cold), backgroundColor: '#3F3F3F', borderRadius: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#E0E0E0' } } },
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'MQL by source' } },
      },
    });
  }

  // 4.5 — Donut: SQL stage split (current month overall) (section 6)
  const donutCtx = document.getElementById('chart-sql-donut');
  if (donutCtx) {
    const s = data.sql_stage_split;
    new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: ['Proposal Sent', 'Negotiating', 'Closed Won'],
        datasets: [{ data: [s.proposal_sent, s.negotiating, s.closed_won], backgroundColor: [ACCENT, BLUE, GREEN], borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
    });
  }

  // 4.6 — Cohort line: spend N-3 vs wins value (section 8)
  const cohortCtx = document.getElementById('chart-cohort-line');
  if (cohortCtx) {
    new Chart(cohortCtx, {
      type: 'line',
      data: {
        labels: data.cohort_cpa.map(c => c.cohort_month),
        datasets: [
          { label: 'Spend (N−3)', data: data.cohort_cpa.map(c => c.spend_n_minus_3), borderColor: ACCENT, backgroundColor: ACCENT, tension: 0.2 },
          { label: 'Wins (count)', data: data.cohort_cpa.map(c => c.wins), borderColor: GREEN, backgroundColor: GREEN, tension: 0.2, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Spend $' } },
          y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Wins' } },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }
})();