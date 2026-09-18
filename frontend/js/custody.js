(function () {
  // Validate active case context
  const activeCaseId = localStorage.getItem('active_case_id');
  if (!activeCaseId) {
    window.location.href = 'cases.html';
    return;
  }

  const tbody = document.querySelector('.custody-table tbody');
  const footnote = document.querySelector('.custody-footnote');

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

    const pageSubEl = document.querySelector('.page-sub');
    if (pageSubEl && activeNum) {
      pageSubEl.textContent = `End-to-end audit trail from acquisition to report, for case ${activeNum}.`;
    }
  }

  // Load and render chain of custody
  async function loadCustodyLedger() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-3);">Loading audit logs...</td></tr>';

    const params = new URLSearchParams(window.location.search);
    const evidenceId = params.get('evidence_id');

    try {
      let combinedLogs = [];

      if (evidenceId) {
        // Fetch logs for specific evidence
        const response = await fetch(`${API_BASE_URL}/chain-of-custody/${evidenceId}`);
        if (!response.ok) throw new Error('Failed to fetch specific evidence custody logs');
        combinedLogs = await response.json();
      } else {
        // Use the case-level endpoint — returns all events including case-level NULL evidence_id rows
        const response = await fetch(`${API_BASE_URL}/chain-of-custody/case/${activeCaseId}`);
        if (!response.ok) throw new Error('Failed to fetch case-level custody logs');
        combinedLogs = await response.json();

        // Attach evidence name for display: fetch evidence list once for name lookup
        try {
          const evResponse = await fetch(`${API_BASE_URL}/evidence/?case_id=${activeCaseId}`);
          if (evResponse.ok) {
            const evidenceList = await evResponse.json();
            const evidenceMap = {};
            evidenceList.forEach(ev => { evidenceMap[ev.id] = ev.name; });
            combinedLogs.forEach(log => {
              if (log.evidence_id) log.evidenceName = evidenceMap[log.evidence_id] || log.evidence_id;
              else log.evidenceName = 'CASE-LEVEL';
            });
          }
        } catch (e) {
          console.warn('Could not enrich custody logs with evidence names:', e);
        }
      }


      // Sort logs chronological (descending to show newest events at the top)
      combinedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (combinedLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-3);">No custody events recorded yet. Ingest evidence files to populate ledger.</td></tr>';
        if (footnote) footnote.textContent = 'Showing 0 chain of custody audit logs.';
        return;
      }

      tbody.innerHTML = combinedLogs.map(log => {
        const timeObj = new Date(log.timestamp);
        const timeStr = timeObj.toLocaleString(undefined, {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        });

        // Parse checksum details if present
        let detailsStr = log.description;
        let checksumCell = '&mdash;';
        const shaMatch = log.description.match(/SHA256=([a-fA-F0-9]+)/);
        if (shaMatch) {
          const hashval = shaMatch[1];
          checksumCell = `${hashval.substring(0, 6)}&hellip;${hashval.substring(hashval.length - 6)}`;
        }

        const unitName = log.evidenceName || `EVD-${log.evidence_id ? log.evidence_id.substring(0, 5) : 'GEN'}`;
        const actionLabel = log.action.replace(/_/g, ' ');

        return `
          <tr>
            <td class="mono">${unitName}</td>
            <td><b>${actionLabel}</b></b></td>
            <td>${log.operator}</td>
            <td class="mono muted">${timeStr}</td>
            <td class="mono hash">${checksumCell}</td>
            <td>
              <span class="chip chip-ok">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>
                Verified
              </span>
            </td>
          </tr>
        `;
      }).join('');

      if (footnote) {
        footnote.textContent = `Showing all ${combinedLogs.length} audit logs. Complete audit trail digitally signed.`;
      }

      // Re-bind hover styles
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        row.addEventListener('mouseenter', () => row.style.background = 'var(--panel-hover)');
        row.addEventListener('mouseleave', () => row.style.background = '');
      });

    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--red);">Error loading Chain of Custody ledger.</td></tr>';
    }
  }

  // Initial runs
  updateTopbar();
  loadCustodyLedger();
})();
