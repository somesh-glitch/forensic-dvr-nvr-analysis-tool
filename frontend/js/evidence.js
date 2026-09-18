(function () {
  // Validate active case context
  const activeCaseId = localStorage.getItem('active_case_id');
  if (!activeCaseId) {
    window.location.href = 'cases.html';
    return;
  }

  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  const btn = document.getElementById('selectFileBtn');
  const queueContainer = document.querySelector('.queue.card');
  const queueCountEl = document.getElementById('queueCount');

  const open = (e) => { e.stopPropagation(); input.click(); };
  btn.addEventListener('click', open);
  dz.addEventListener('click', open);
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('drag-active');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('drag-active');
    });
  });
  dz.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length) { handleFiles(files); }
  });
  input.addEventListener('change', () => {
    if (input.files && input.files.length) { handleFiles(input.files); }
  });

  // Topbar updating
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
      pageSubEl.textContent = `Import DVR/NVR exports, footage, and stills for case ${activeNum}.`;
    }
  }

  // Load and render evidence cards
  async function loadEvidence() {
    try {
      const response = await fetch(`${API_BASE_URL}/evidence/?case_id=${activeCaseId}`);
      if (!response.ok) throw new Error('Evidence fetch failed');
      const evidenceList = await response.json();

      if (queueCountEl) {
        queueCountEl.textContent = `${evidenceList.length} items`;
      }

      if (evidenceList.length === 0) {
        queueContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; color: var(--text-3);">
            No evidence files ingested yet. Drag a file above to begin.
          </div>
        `;
        return;
      }

      queueContainer.innerHTML = evidenceList.map(ev => {
        const sizeMb = (ev.file_size / (1024 * 1024)).toFixed(1);
        const nameEscaped = ev.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const vendorEscaped = (ev.vendor_detected || 'Unknown').replace(/</g, "&lt;");
        const serialEscaped = (ev.device_serial || 'Not detected').replace(/</g, "&lt;");
        const md5Trunc = ev.md5 ? `${ev.md5.substring(0, 6)}&hellip;${ev.md5.substring(ev.md5.length - 4)}` : '&mdash;';
        const shaTrunc = ev.sha256 ? `${ev.sha256.substring(0, 6)}&hellip;${ev.sha256.substring(ev.sha256.length - 6)}` : '&mdash;';

        return `
          <div class="q-row" data-state="done">
            <div class="q-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/></svg></div>
            <div class="q-main">
              <div class="q-name">${nameEscaped}</div>
              <div class="q-meta">${vendorEscaped} &nbsp;&middot;&nbsp; Serial: ${serialEscaped} &nbsp;&middot;&nbsp; ${sizeMb} MB</div>
              <div class="q-hashes">
                <span class="q-hash-chip">SHA-256&nbsp;<b>${shaTrunc}</b></span>
                <span class="q-hash-chip">MD5&nbsp;<b>${md5Trunc}</b></span>
              </div>
            </div>
            <div class="q-status ok">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
              ${ev.status || 'Ingested'}
            </div>
            <div style="margin-left: 16px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <button class="chip chip-neutral verify-btn" data-evidence-id="${ev.id}" style="font-size: 10px; cursor: pointer; border: none; padding: 4px 10px; border-radius: 4px;">VERIFY</button>
              <span class="verify-result" id="vr-${ev.id}"></span>
              <a href="custody.html?evidence_id=${ev.id}" class="chip chip-neutral" style="font-size: 10px; cursor: pointer; text-decoration: none; padding: 4px 8px;">AUDIT</a>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error(e);
      queueContainer.innerHTML = `<div style="padding: 20px; color: var(--red); text-align: center;">Error loading queue.</div>`;
    }
  }

  // Event delegation: handle VERIFY button clicks anywhere in the queue container
  queueContainer.addEventListener('click', async (e) => {
    const verifyBtn = e.target.closest('.verify-btn');
    if (!verifyBtn) return;
    const evidenceId = verifyBtn.dataset.evidenceId;
    if (!evidenceId) return;

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'VERIFYING...';
    const resultEl = document.getElementById(`vr-${evidenceId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/evidence/${evidenceId}/verify`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      verifyBtn.textContent = 'VERIFY';
      verifyBtn.disabled = false;
      if (resultEl) {
        if (result.verified) {
          resultEl.className = 'chip chip-ok';
          resultEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg> VERIFIED';
        } else {
          resultEl.className = 'chip chip-err';
          resultEl.textContent = '\u2717 MISMATCH';
          resultEl.title = result.message || 'Hash mismatch detected';
        }
      }
    } catch (err) {
      verifyBtn.textContent = 'VERIFY';
      verifyBtn.disabled = false;
      if (resultEl) {
        resultEl.className = 'chip chip-err';
        resultEl.textContent = 'Error';
      }
      console.error('Verify error:', err);
    }
  });

  // Upload file handler
  async function handleFiles(files) {
    if (!files.length) return;

    // Process files sequentially
    for (const file of Array.from(files)) {
      // Append temporary progress row to UI
      const tempId = `upload-${Date.now()}`;
      const progressRow = document.createElement('div');
      progressRow.className = 'q-row';
      progressRow.id = tempId;
      progressRow.dataset.state = 'progress';
      progressRow.innerHTML = `
        <div class="q-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/></svg></div>
        <div class="q-main">
          <div class="q-name">${file.name.replace(/</g, "&lt;")}</div>
          <div class="q-meta">Uploading and verifying integrity hashes &hellip;</div>
          <div class="q-bar"><div class="q-bar-fill" style="width: 50%;"></div></div>
        </div>
        <div class="q-status pending">HASHING...</div>
      `;

      // Clear empty text if present
      if (queueContainer.querySelector('[style*="text-align: center"]')) {
        queueContainer.innerHTML = '';
      }
      queueContainer.insertBefore(progressRow, queueContainer.firstChild);

      const formData = new FormData();
      formData.append('case_id', activeCaseId);
      formData.append('file', file);

      try {
        const response = await fetch(`${API_BASE_URL}/evidence/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const detail = await response.json();
          throw new Error(detail.detail || `Upload failed code: ${response.status}`);
        }

        const result = await response.json();
        console.log("Uploaded successfully:", result);

        // Show success status briefly
        progressRow.dataset.state = 'done';
        progressRow.querySelector('.q-meta').textContent = `Upload completed. Vendor: ${result.vendor_detected || 'Generic'}`;
        progressRow.querySelector('.q-bar').remove();
        progressRow.querySelector('.q-status').className = 'q-status ok';
        progressRow.querySelector('.q-status').innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          Verified
        `;

        await loadEvidence();

      } catch (err) {
        console.error("Upload error:", err);
        progressRow.dataset.state = 'error';
        progressRow.querySelector('.q-meta').textContent = err.message;
        progressRow.querySelector('.q-bar').remove();
        progressRow.querySelector('.q-status').className = 'q-status err';
        progressRow.querySelector('.q-status').innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          Failed
        `;
      }
    }
  }

  // Initial runs
  updateTopbar();
  loadEvidence();
})();
