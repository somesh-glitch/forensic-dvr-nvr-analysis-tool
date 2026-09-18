(function () {
  const search = document.getElementById('caseSearch');
  const filterBtns = document.querySelectorAll('#caseFilters .tl-filter');
  const grid = document.getElementById('casesGrid');
  const loader = document.getElementById('casesListLoader');
  const empty = document.getElementById('casesEmpty');

  const newCaseBtn = document.getElementById('newCaseBtn');
  const modal = document.getElementById('newCaseModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const newCaseForm = document.getElementById('newCaseForm');

  let activeStatus = 'all';
  let allCases = [];

  // Update topbar case selection state if available in storage
  function updateTopbar() {
    const activeId = localStorage.getItem('active_case_id');
    const activeNum = localStorage.getItem('active_case_number');
    const activeTitle = localStorage.getItem('active_case_title');
    const activeInv = localStorage.getItem('active_case_investigator');

    if (activeId && activeNum) {
      const activeNumEl = document.getElementById('activeCaseNum');
      const activeNameEl = document.getElementById('activeCaseName');
      const activeInvEl = document.getElementById('activeInvestigator');
      if (activeNumEl) activeNumEl.textContent = activeNum;
      if (activeNameEl) activeNameEl.textContent = activeTitle || 'Unnamed Case';
      if (activeInvEl) activeInvEl.textContent = activeInv || 'Investigator';
    }
  }

  // Fetch all cases from API
  async function fetchCases() {
    loader.style.display = 'flex';
    grid.style.display = 'none';
    empty.style.display = 'none';

    try {
      const response = await fetch(`${API_BASE_URL}/cases/`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      allCases = await response.json();
      renderCases();
    } catch (error) {
      console.error('Failed to fetch cases:', error);
      loader.style.display = 'none';
      empty.style.display = 'flex';
      empty.querySelector('h3').textContent = 'CONNECTION ERROR';
      empty.querySelector('p').textContent = 'Could not connect to FastAPI backend server.';
    }
  }

  // Render cases list based on filters/search
  function renderCases() {
    grid.innerHTML = '';
    loader.style.display = 'none';

    const q = search.value.trim().toLowerCase();
    let visible = 0;

    allCases.forEach(c => {
      // For this hackathon, we assume cases are 'active' by default. We can mock
      // closing them, or default their status dataset.
      const caseStatus = c.status || 'active';
      const matchesStatus = activeStatus === 'all' || caseStatus === activeStatus;
      const matchesSearch = !q || c.title.toLowerCase().includes(q) || c.case_number.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);

      if (matchesStatus && matchesSearch) {
        visible++;
        const card = document.createElement('a');
        card.href = 'dashboard.html';
        card.className = 'card case-card';
        card.dataset.status = caseStatus;
        card.dataset.search = `${c.case_number} ${c.title}`.toLowerCase();

        // Save selected case context before navigating to dashboard
        card.addEventListener('click', () => {
          localStorage.setItem('active_case_id', c.id);
          localStorage.setItem('active_case_number', c.case_number);
          localStorage.setItem('active_case_title', c.title);
          localStorage.setItem('active_case_investigator', c.investigator);
        });

        const createdDate = new Date(c.created_at).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric'
        });

        card.innerHTML = `
          <div class="case-card-top">
            <span class="eyebrow-label ac-eyebrow">${c.case_number}</span>
            <span class="chip ${caseStatus === 'active' ? 'chip-ok' : 'chip-neutral'}">${caseStatus.toUpperCase()}</span>
          </div>
          <h3 class="case-card-title">${c.title}</h3>
          <p class="case-card-desc">${c.description || 'No case notes provided.'}</p>
          <div class="case-card-meta">
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/><path d="M1 19v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg>
              ${c.investigator}
            </span>
          </div>
          <div class="case-card-foot">
            <span class="case-card-updated">CREATED ${createdDate.toUpperCase()}</span>
            <div class="case-card-progress">
              <span class="case-card-progress-fill" style="width: 100%"></span>
            </div>
          </div>
        `;
        grid.appendChild(card);
      }
    });

    grid.style.display = visible > 0 ? 'grid' : 'none';
    empty.style.display = visible === 0 ? 'flex' : 'none';
  }

  // Search input event
  search.addEventListener('input', renderCases);

  // Status Filter events
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStatus = btn.dataset.status;
      renderCases();
    });
  });

  // Modal event listeners
  newCaseBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  function closeModal() {
    modal.style.display = 'none';
    newCaseForm.reset();
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Handle case insertion submit
  newCaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const caseNumber = document.getElementById('caseNumberInput').value.trim();
    const title = document.getElementById('caseTitleInput').value.trim();
    const investigator = document.getElementById('caseInvestigatorInput').value.trim();
    const description = document.getElementById('caseDescInput').value.trim();

    try {
      const response = await fetch(`${API_BASE_URL}/cases/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_number: caseNumber,
          title: title,
          investigator: investigator,
          description: description
        })
      });

      if (!response.ok) {
        if (response.status === 400) {
          const detail = await response.json();
          alert(`Failed to create case: ${detail.detail || 'Duplicate case number.'}`);
          return;
        }
        throw new Error(`Failed to create case: ${response.statusText}`);
      }

      const newCase = await response.json();

      // Auto-set the new case as active
      localStorage.setItem('active_case_id', newCase.id);
      localStorage.setItem('active_case_number', newCase.case_number);
      localStorage.setItem('active_case_title', newCase.title);
      localStorage.setItem('active_case_investigator', newCase.investigator);

      closeModal();
      updateTopbar();
      await fetchCases();
    } catch (e) {
      console.error(e);
      alert(`Error creating case: ${e.message}`);
    }
  });

  // Initial runs
  updateTopbar();
  fetchCases();
})();
