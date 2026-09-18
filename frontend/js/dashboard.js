(function () {
  // Validate active case context
  const activeCaseId = localStorage.getItem('active_case_id');
  if (!activeCaseId) {
    window.location.href = 'cases.html';
    return;
  }

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

    // Update active case card link
    const acIdEl = document.querySelector('.ac-id');
    const acTitleEl = document.querySelector('.ac-title');
    if (acIdEl) acIdEl.textContent = activeNum || '';
    if (acTitleEl) acTitleEl.textContent = activeTitle || 'Unnamed Case';
  }

  // Handle stat numbers count-up animation
  function animateValue(el, target) {
    if (Number.isNaN(target)) return;
    const pad = el.textContent.trim().length || 2;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 22));
    const tick = () => {
      current = Math.min(target, current + step);
      el.textContent = String(current).padStart(pad, '0');
      if (current < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Fetch real statistics for active case
  async function loadDashboardStats() {
    try {
      // Use the /stats endpoint for the summary numbers — one request instead of a waterfall
      const statsResponse = await fetch(`${API_BASE_URL}/cases/${activeCaseId}/stats`);
      if (!statsResponse.ok) throw new Error('Stats fetch failed');
      const stats = await statsResponse.json();

      const statEvCountEl = document.querySelectorAll('.stat-value')[0];
      const statCamCountEl = document.querySelectorAll('.stat-value')[1];
      const statEventCountEl = document.querySelectorAll('.stat-value')[2];

      animateValue(statEvCountEl, stats.evidence_count || 0);
      animateValue(statCamCountEl, stats.camera_count || 0);
      animateValue(statEventCountEl, stats.event_count || 0);

      // Update case metadata labels
      const acMetaEl = document.querySelector('.ac-meta');
      if (acMetaEl) {
        acMetaEl.innerHTML = `
          <span class="ac-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="13" height="12" rx="2"/><path d="M16 10.5l4.3-2.7a.6.6 0 0 1 .9.5v8.4a.6.6 0 0 1-.9.5L16 14.5"/></svg>
            ${stats.evidence_count || 0} Ingests
          </span>
          <span class="ac-pulse"></span>
          <span class="ac-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/><path d="M1 19v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg>
            ${stats.camera_count || 0} Cameras
          </span>
        `;
      }

      // Integrity alert badge — show warning if unverified evidence exists
      if (stats.unverified_count > 0) {
        const acCardEl = document.querySelector('.active-case-card');
        if (acCardEl && !document.getElementById('integrityWarnBadge')) {
          const warnBadge = document.createElement('span');
          warnBadge.id = 'integrityWarnBadge';
          warnBadge.className = 'chip chip-warn';
          warnBadge.style.marginTop = '8px';
          warnBadge.textContent = `⚠ ${stats.unverified_count} evidence item(s) not integrity-verified`;
          acCardEl.appendChild(warnBadge);
        }
      }

      // Vendor sidebar — still needs the evidence list for vendor names
      const evResponse = await fetch(`${API_BASE_URL}/evidence/?case_id=${activeCaseId}`);
      let vendorCamsCount = {};
      if (evResponse.ok) {
        const evidenceList = await evResponse.json();
        evidenceList.forEach(ev => {
          if (ev.vendor_detected) {
            vendorCamsCount[ev.vendor_detected] = (vendorCamsCount[ev.vendor_detected] || 0) + 1;
          }
        });
      }

      // Update vendor list representation on the sidebar
      const vendorSectionEl = document.querySelector('.dash-side').querySelectorAll('.dash-side-card')[1];
      if (vendorSectionEl) {
        let html = `<div class="dash-panel-head"><span class="eyebrow-label">CASE VENDORS</span></div>`;
        const vendors = Object.keys(vendorCamsCount);
        if (vendors.length === 0) {
          html += `<div class="vendor-row"><span class="vendor-name text-muted">No vendors detected</span></div>`;
        } else {
          const colors = ['', 'indigo', 'amber', 'green', 'rose'];
          vendors.forEach((vendor, i) => {
            const colorClass = colors[i % colors.length];
            const nameStr = vendor === 'SyntheticDVR' ? 'Synthetic DVR (Prototype)' : vendor;
            html += `
              <div class="vendor-row">
                <span class="vendor-dot ${colorClass}"></span>
                <span class="vendor-name">${nameStr}</span>
                <span class="vendor-count">${vendorCamsCount[vendor]} files</span>
              </div>
            `;
          });
        }
        vendorSectionEl.innerHTML = html;
      }


      // Populate live feed with actual timeline events
      const activityListEl = document.querySelector('.activity-list');
      if (activityListEl) {
        const timelineResponse = await fetch(`${API_BASE_URL}/timeline/${activeCaseId}`);
        if (timelineResponse.ok) {
          const events = await timelineResponse.json();
          // Sort events descending and take top 4
          const recentEvents = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);

          if (recentEvents.length === 0) {
            activityListEl.innerHTML = `<div class="activity-row"><div class="activity-main">No recent history events found.</div></div>`;
          } else {
            activityListEl.innerHTML = recentEvents.map(ev => {
              let iconClass = 'info';
              let iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`;

              if (ev.event_type === 'INGESTION') {
                iconClass = 'neutral';
                iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>`;
              } else if (ev.event_type === 'AUDIT') {
                iconClass = 'done';
                iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
              } else if (ev.event_type === 'RECOVERY') {
                iconClass = 'ok';
                iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`;
              }

              const timeStr = new Date(ev.timestamp).toLocaleTimeString(undefined, {
                hour: '2-digit', minute: '2-digit'
              });

              return `
                <div class="activity-row">
                  <div class="activity-icon ${iconClass}">${iconSvg}</div>
                  <div class="activity-main">
                    <div class="activity-title">${ev.event_type} event</div>
                    <div class="activity-sub">${ev.description}</div>
                  </div>
                  <div class="activity-time">${timeStr}</div>
                </div>
              `;
            }).join('');
          }
        }
      }

    } catch (error) {
      console.error('Failed loading dashboard numbers:', error);
    }
  }

  // Initial runs
  updateTopbar();
  loadDashboardStats();
})();
