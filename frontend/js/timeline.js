(function () {
  // Validate active case context
  const activeCaseId = localStorage.getItem('active_case_id');
  if (!activeCaseId) {
    window.location.href = 'cases.html';
    return;
  }

  const timelineContainer = document.getElementById('timeline');
  const filters = document.querySelectorAll('.tl-filter');

  let activeFilter = 'all';
  let allEvents = [];

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

  // Fetch unified timeline chronology events
  async function fetchTimeline() {
    timelineContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-3);">Loading timeline records...</div>';
    try {
      const response = await fetch(`${API_BASE_URL}/timeline/${activeCaseId}`);
      if (!response.ok) throw new Error('Timeline fetch failed');
      allEvents = await response.json();

      // Sort ascending (chronological sequence)
      allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      renderTimeline();
    } catch (e) {
      console.error(e);
      timelineContainer.innerHTML = '<div style="padding: 20px; color: var(--red); text-align: center;">Error loading timeline chronology.</div>';
    }
  }

  // Map events to filters
  function getFilterType(eventType) {
    const type = eventType.toUpperCase();
    if (type.includes('INGESTION') || type.includes('CUSTODY') || type.includes('AUDIT') || type.includes('CASE_CREATE')) {
      return 'custody';
    } else if (type.includes('ANALYSIS') || type.includes('REAL_MODEL')) {
      return 'analysis';
    } else if (type.includes('DETECTION') || type.includes('OBJECT')) {
      return 'detection';
    } else if (type.includes('RECOVERY')) {
      return 'custody'; // fits audit/recovery ledger
    }
    return 'custody';
  }

  // Draw timeline items
  function renderTimeline() {
    timelineContainer.innerHTML = '';

    const filtered = allEvents.filter(ev => {
      const type = getFilterType(ev.event_type);
      return activeFilter === 'all' || type === activeFilter;
    });

    if (filtered.length === 0) {
      timelineContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-3);">
          No events matching filter category: "${activeFilter}".
        </div>
      `;
      return;
    }

    timelineContainer.innerHTML = filtered.map((ev, idx) => {
      const type = getFilterType(ev.event_type);

      // Format timestamp nicely
      const dateObj = new Date(ev.timestamp);
      const timeStr = dateObj.toLocaleTimeString(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const dateStr = dateObj.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      const isLast = idx === filtered.length - 1;
      const title = ev.event_type.replace(/_/g, ' ') + (ev.source ? ` · ${ev.source}` : '');

      return `
        <div class="tl-item ${isLast ? 'last' : ''}" data-type="${type}">
          <div class="tl-time">
            <div>${timeStr}</div>
            <div style="font-family: inherit; font-size: 9px; color: var(--text-3); margin-top: 4px;">${dateStr.toUpperCase()}</div>
          </div>
          <div class="tl-rail">
            <div class="tl-node ${type}"></div>
          </div>
          <div class="tl-card card">
            <div class="tl-card-title">${title}</div>
            <div class="tl-card-desc">${ev.description}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Bind filter buttons
  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderTimeline();
    });
  });

  // Initial runs
  updateTopbar();
  fetchTimeline();
})();
