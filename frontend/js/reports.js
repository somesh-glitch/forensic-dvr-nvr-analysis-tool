(function () {
  // Validate active case context
  const activeCaseId = localStorage.getItem('active_case_id');
  if (!activeCaseId) {
    window.location.href = 'cases.html';
    return;
  }

  const generateBtn = document.getElementById('generateBtn');
  const generateLabel = document.getElementById('generateLabel');
  const previewBtn = document.getElementById('previewBtn');
  const rpStatus = document.getElementById('rpStatus');
  const exportRows = document.querySelectorAll('.export-row');
  const previewDoc = document.querySelector('.rp-doc');

  let activeReport = null;

  // Update topbar case selection state
  function updateTopbar() {
    const activeNum = localStorage.getItem('active_case_number');
    const activeTitle = localStorage.getItem('active_case_title');
    const activeInv = localStorage.getItem('active_case_investigator');

    const activeNumEl = document.getElementById('activeCaseNum');
    const activeNameEl = document.getElementById('activeCaseName');
    const activeInvEl = document.getElementById('activeInvestigator');

    if (activeNumEl) activeNumEl.textContent = activeNum || 'SELECT CASE';
    if (activeNameEl) activeNameEl.textContent = activeTitle || 'Unnamed Case';
    if (activeInvEl) activeInvEl.textContent = activeInv || 'Investigator';
  }

  function setStatus(html) {
    rpStatus.innerHTML = '<span class="eyebrow-label">STATUS</span>' + html;
  }

  // Basic Markdown-to-HTML parser. Supports headers, bold, tables, lists, blockquotes.
  function parseMarkdown(md) {
    if (!md) return '<div class="muted">No report content available. Click Generate.</div>';

    // Escape basic HTML to avoid injection, maintaining formatting tags
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Convert headings
    html = html.replace(/^# (.*)/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*)/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*)/gm, '<h3>$1</h3>');

    // Convert bullet lists
    html = html.replace(/^\- (.*)/gm, '<li>$1</li>');
    html = html.replace(/^\* (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // consolidate adjoining list tags

    // Convert bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert code blocks
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Convert blockquotes
    html = html.replace(/^&gt; (.*)/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>'); // consolidate adjoining blockquotes

    // Convert tables (simplistic line-by-line parsing)
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml += '<table>';
        }

        // Skip separator line (|---|---|...)
        if (line.includes('---')) continue;

        const cells = line.split('|').slice(1, -1);
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td>${cell.trim()}</td>`;
        });
        tableHtml += '</tr>';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table>';
          lines[i] = tableHtml + '\n' + lines[i];
          tableHtml = '';
        }
      }
    }
    html = lines.join('\n');

    // Convert double newlines to breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
  }

  // Load existing report
  async function loadLatestReport() {
    setStatus('<span class="chip chip-neutral">Checking...</span>');
    try {
      const response = await fetch(`${API_BASE_URL}/reports/${activeCaseId}`);
      if (response.status === 404) {
        setStatus('<span class="chip chip-neutral">Not generated</span>');
        previewDoc.innerHTML = '<div style="padding: 20, 0px; text-align: center; color: var(--text-3);">Click "Generate Report" to compile findings.</div>';
        return;
      }
      if (!response.ok) throw new Error('Search failed');

      activeReport = await response.json();
      renderReportView();
    } catch (e) {
      console.error(e);
      setStatus('<span class="chip chip-neutral">Connection error</span>');
    }
  }

  function renderReportView() {
    if (!activeReport) return;

    previewDoc.innerHTML = `
      <div class="report-render-container" style="color: var(--text-2); font-size: 13px; line-height: 1.6; max-height: 480px; overflow-y: auto; padding-right: 8px;">
        ${parseMarkdown(activeReport.content_markdown)}
      </div>
    `;

    const dateStr = new Date(activeReport.generated_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    setStatus(`<span class="chip chip-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>READY (${dateStr.toUpperCase()})</span>`);
  }

  // Request new compilation
  generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateLabel.textContent = 'Generating…';
    setStatus('<span class="chip chip-warn">Compiling…</span>');

    const investigator = localStorage.getItem('active_case_investigator') || 'Investigator';

    try {
      const response = await fetch(`${API_BASE_URL}/reports/${activeCaseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "CCTV Forensic Audit Dossier",
          generated_by: investigator
        })
      });

      if (!response.ok) throw new Error('Failed compilation');
      activeReport = await response.json();

      renderReportView();
      generateLabel.textContent = 'Regenerate Report';
      generateBtn.disabled = false;

    } catch (err) {
      console.error(err);
      alert(`Failed to compile report: ${err.message}`);
      generateLabel.textContent = 'Generate Report';
      generateBtn.disabled = false;
      setStatus('<span class="chip chip-neutral">Failed</span>');
    }
  });

  previewBtn.addEventListener('click', () => {
    document.querySelector('.report-preview').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Handle export actions
  exportRows.forEach(row => {
    row.addEventListener('click', async () => {
      if (!activeReport) {
        alert("Please generate a report first before exporting.");
        return;
      }

      const format = row.dataset.format;

      if (format === 'PDF') {
        // Open print window configured for page preview
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
          <head>
            <title>${activeReport.title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              td, th { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
              blockquote { border-left: 4px solid #10b981; padding-left: 15px; color: #475569; margin: 20px 0; font-style: italic; }
              code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
              h1, h2, h3 { color: #0f172a; margin-top: 24px; }
              h1 { border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; }
              .logo { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="logo">CF CASEFILE FORENSICS</div>
            ${parseMarkdown(activeReport.content_markdown)}
            <script>window.onload = function() { window.print(); }</script>
          </body>
          </html>
        `);
        printWindow.document.close();
      } else if (format === 'JSON') {
        try {
          // Fetch case metadata, timeline chronology and list of evidence to build dynamic manifest
          const timelineResponse = await fetch(`${API_BASE_URL}/timeline/${activeCaseId}`);
          const timeline = timelineResponse.ok ? await timelineResponse.json() : [];

          const evResponse = await fetch(`${API_BASE_URL}/evidence/?case_id=${activeCaseId}`);
          const evidence = evResponse.ok ? await evResponse.json() : [];

          const manifest = {
            case_number: localStorage.getItem('active_case_number'),
            case_title: localStorage.getItem('active_case_title'),
            exported_at: new Date().toISOString(),
            evidence: evidence,
            chronology: timeline,
            report: activeReport
          };

          // Download as JSON file
          const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `case_${manifest.case_number}_manifest.json`;
          link.click();
        } catch (e) {
          console.error(e);
          alert("Failed to export manifest JSON");
        }
      }
    });
  });

  // Initial runs
  updateTopbar();
  loadLatestReport();
})();
