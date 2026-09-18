(function () {
  // Validate active case context
  const activeCaseId = localStorage.getItem('active_case_id');
  if (!activeCaseId) {
    window.location.href = 'cases.html';
    return;
  }

  const picker = document.getElementById('camPicker');
  const runAiBtn = document.getElementById('runAiBtn');

  const video = document.getElementById('videoPlayer');
  const canvas = document.getElementById('boxesCanvas');
  const context = canvas.getContext('2d');
  const videoPlaceholder = document.getElementById('videoPlaceholder');
  const recBadge = document.getElementById('recBadge');
  const aiBadge = document.getElementById('aiBadge');
  const camOverlayTag = document.getElementById('camOverlayTag');
  const tsTag = document.getElementById('tsTag');

  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const snapBtn = document.getElementById('snapBtn');
  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const durationLabel = document.getElementById('durationLabel');
  const videoMetaLabel = document.getElementById('videoMetaLabel');

  const scrubTrack = document.getElementById('scrubTrack');
  const scrubFill = document.getElementById('scrubFill');
  const scrubHandle = document.getElementById('scrubHandle');

  const eventsCountEl = document.getElementById('eventsCount');
  const eventsLog = document.getElementById('eventsLog');

  let dragging = false;
  let activeVideo = null;
  let activeDetections = [];
  let currentSelection = ''; // video_id

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

  // Auto-resize canvas overlay
  function resizeCanvas() {
    if (video.style.display !== 'none') {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  video.addEventListener('loadedmetadata', resizeCanvas);

  // Initialize camera list
  async function loadCameras() {
    picker.innerHTML = '<option value="">Loading cameras...</option>';
    try {
      const response = await fetch(`${API_BASE_URL}/evidence/?case_id=${activeCaseId}`);
      if (!response.ok) throw new Error('Evidence fetch failed');
      const evidenceList = await response.json();

      let optionsHtml = '<option value="">-- select camera channel --</option>';
      let count = 0;

      for (const ev of evidenceList) {
        const vidResponse = await fetch(`${API_BASE_URL}/evidence/${ev.id}/videos`);
        if (vidResponse.ok) {
          const videos = await vidResponse.json();
          for (const v of videos) {
            count++;
            // Map filepath to name
            const parts = v.file_path.replace(/\\/g, '/').split('/');
            const filename = parts[parts.length - 1];
            optionsHtml += `
              <option value="${v.id}" data-filename="${filename}" data-filepath="${v.file_path}" data-duration="${v.duration_seconds || 0}" data-vendor="${ev.vendor_detected}" data-fps="${v.fps || 25}" data-res="${v.resolution || '1920x1080'}" data-codec="${v.codec || 'H.264'}">
                CH${v.id.substring(0, 3)} &mdash; ${filename} (${ev.vendor_detected})
              </option>
            `;
          }
        }
      }

      if (count === 0) {
        picker.innerHTML = '<option value="">No cameras extracted</option>';
      } else {
        picker.innerHTML = optionsHtml;
      }

    } catch (e) {
      console.error(e);
      picker.innerHTML = '<option value="">Error loading cameras</option>';
    }
  }


  // Handle camera selection
  picker.addEventListener('change', async () => {
    const videoId = picker.value;
    currentSelection = videoId;

    if (!videoId) {
      unloadVideo();
      return;
    }

    const selectedOption = picker.options[picker.selectedIndex];
    const vendor = selectedOption.dataset.vendor;
    const fps = selectedOption.dataset.fps;
    const res = selectedOption.dataset.res;
    const codec = selectedOption.dataset.codec;
    const duration = parseFloat(selectedOption.dataset.duration || 0);
    const filename = selectedOption.dataset.filename || videoId;

    // Use the dedicated video streaming endpoint which:
    //  • resolves the correct playback file regardless of vendor/filesystem layout
    //  • serves bytes with HTTP 206 Range support required by all HTML5 video players
    const streamUrl = `${API_BASE_URL}/videos/${videoId}/stream`;

    video.src = streamUrl;
    video.style.display = 'block';
    canvas.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    recBadge.style.display = 'flex';
    camOverlayTag.textContent = filename.substring(0, 24);

    // Set labels
    document.getElementById('camTitle').textContent = filename;
    document.getElementById('camSub').textContent = `Vendor: ${vendor} | Resolution: ${res} | Codec: ${codec}`;
    videoMetaLabel.textContent = `${res} · ${fps} FPS · ${codec}`;

    durationLabel.textContent = formatDuration(duration);
    currentTimeLabel.textContent = '00:00:00';
    setPct(0);

    runAiBtn.style.display = 'inline-block';
    runAiBtn.textContent = 'RUN AI ANALYSIS';
    runAiBtn.disabled = false;

    // Load AI detections
    await loadDetections(videoId);
    video.play().catch(() => { });
    playBtn.classList.add('primary');
  });


  function unloadVideo() {
    video.pause();
    video.src = '';
    video.style.display = 'none';
    canvas.style.display = 'none';
    videoPlaceholder.style.display = 'flex';
    recBadge.style.display = 'none';
    aiBadge.style.display = 'none';
    runAiBtn.style.display = 'none';
    camOverlayTag.textContent = 'CAM 00';
    tsTag.textContent = '0000-00-00   00:00:00';
    currentTimeLabel.textContent = '00:00:00';
    durationLabel.textContent = '00:00:00';
    videoMetaLabel.textContent = 'NO TRACK CURRENTLY LOADED';
    document.getElementById('camTitle').textContent = 'Camera Feed';
    document.getElementById('camSub').textContent = 'Ingest evidence to view camera channels.';
    eventsCountEl.textContent = '0';
    eventsLog.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-3); font-size: 13px;">Run AI analysis to detect objects.</div>`;
    activeDetections = [];
    clearTicks();
  }

  // Load detections list
  async function loadDetections(videoId) {
    try {
      const response = await fetch(`${API_BASE_URL}/analysis/${videoId}`);
      if (!response.ok) throw new Error('Detections load failed');
      activeDetections = await response.json();

      eventsCountEl.textContent = activeDetections.length;
      drawTicks();

      if (activeDetections.length === 0) {
        eventsLog.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--text-3); font-size: 13px;">
            No AI detections currently saved for this clip. Click "RUN AI ANALYSIS" above.
          </div>
        `;
        aiBadge.style.display = 'none';
      } else {
        aiBadge.style.display = 'flex';
        eventsLog.innerHTML = activeDetections.map((det, i) => {
          const timestampSecs = det.frame_number / 25; // fallback helper or det timestamp
          const labelClass = getLabelClass(det.label);
          const confPct = (det.confidence * 100).toFixed(0);

          return `
            <button class="ev-row" data-time="${timestampSecs}" data-index="${i}">
              <span class="ev-time">${formatDuration(timestampSecs)}</span>
              <span class="ev-dot ${labelClass}" style="background: ${getLabelColor(det.label)};"></span>
              <span class="ev-label">${det.label.toUpperCase()} (${confPct}%)</span>
            </button>
          `;
        }).join('');

        // Wire event item clicks to seek video
        eventsLog.querySelectorAll('.ev-row').forEach(row => {
          row.addEventListener('click', () => {
            const time = parseFloat(row.dataset.time);
            video.currentTime = time;
            video.play().catch(() => { });
          });
        });
      }

    } catch (e) {
      console.error(e);
      eventsLog.innerHTML = '<div style="padding: 20px; color: var(--red);">Error loading detections.</div>';
    }
  }

  // Trigger AI Analysis
  runAiBtn.addEventListener('click', async () => {
    if (!currentSelection) return;
    runAiBtn.disabled = true;
    runAiBtn.textContent = 'ANALYZING...';

    // Remove any previous mode badge
    const oldBadge = document.getElementById('aiModeBadge');
    if (oldBadge) oldBadge.remove();

    // Attempt REAL processing first, falling back to SIMULATED if server has issues
    let usedMode = 'REAL';
    try {
      await runAnalysisRequest('REAL');
    } catch (error) {
      console.warn('Real YOLO analysis failed, falling back to Simulated mode:', error);
      usedMode = 'SIMULATED';
      try {
        await runAnalysisRequest('SIMULATED');
      } catch (simErr) {
        alert(`Analysis failed: ${simErr.message}`);
        runAiBtn.textContent = 'RUN AI ANALYSIS';
        runAiBtn.disabled = false;
        return;
      }
    }

    // Show explicit mode badge so the user always knows what ran
    const badge = document.createElement('span');
    badge.id = 'aiModeBadge';
    if (usedMode === 'REAL') {
      badge.className = 'chip chip-ok';
      badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg> REAL YOLOv8 INFERENCE';
    } else {
      badge.className = 'chip chip-warn';
      badge.innerHTML = '⚠ SIMULATION MODE — NOT REAL INFERENCE';
    }
    runAiBtn.insertAdjacentElement('afterend', badge);
  });


  async function runAnalysisRequest(mode) {
    const response = await fetch(`${API_BASE_URL}/analysis/${currentSelection}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classes: ["person", "vehicle"],
        mode: mode
      })
    });

    if (!response.ok) {
      const errDetail = await response.json();
      throw new Error(errDetail.detail || `Response code ${response.status}`);
    }

    const metrics = await response.json();
    console.log(`Analysis metrics (${mode}):`, metrics);

    // Refresh detections list
    await loadDetections(currentSelection);
    runAiBtn.textContent = 'ANALYSIS COMPLETE';
    setTimeout(() => {
      runAiBtn.textContent = 'RE-RUN AI ANALYSIS';
      runAiBtn.disabled = false;
    }, 2000);
  }

  // Draw ticks on timeline rail
  function drawTicks() {
    clearTicks();
    const duration = video.duration || parseFloat(picker.options[picker.selectedIndex].dataset.duration) || 1;
    activeDetections.forEach(det => {
      const timestampSecs = det.frame_number / 25;
      const left = (timestampSecs / duration) * 100;

      const tick = document.createElement('div');
      tick.className = `scrub-tick ${getLabelClass(det.label)}`;
      tick.style.left = `${left}%`;
      tick.style.background = getLabelColor(det.label);
      tick.title = `${det.label.toUpperCase()} (${(det.confidence * 100).toFixed(0)}%)`;
      scrubTrack.appendChild(tick);
    });
  }

  function clearTicks() {
    const ticks = scrubTrack.querySelectorAll('.scrub-tick');
    ticks.forEach(t => t.remove());
  }

  // Utility details mapping helpers
  function getLabelClass(label) {
    if (label.includes('person')) return 'person';
    if (label.includes('car') || label.includes('truck') || label.includes('vehicle') || label.includes('bus')) return 'motion';
    return 'anomaly';
  }

  function getLabelColor(label) {
    if (label.includes('person')) return '#10b981'; // Green
    if (label.includes('car') || label.includes('truck') || label.includes('vehicle') || label.includes('bus')) return '#eab308'; // Amber
    return '#3b82f6'; // Blue
  }

  function formatDuration(s) {
    const pad = (n) => String(n).padStart(2, '0');
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }

  // Draw bounding boxes coordinate frame overlay
  function drawBoundingBoxes() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!video.duration || activeDetections.length === 0) return;

    const currTime = video.currentTime;

    // Find active detections in the current timeframe (within a 0.5s window)
    activeDetections.forEach(det => {
      const detTime = det.frame_number / 25;
      if (Math.abs(detTime - currTime) < 0.5) {

        let box = det.bounding_box;
        if (typeof box === 'string') {
          try { box = JSON.parse(box); } catch (e) { }
        }

        if (box && (box.x_min !== undefined || box.x1 !== undefined)) {
          const x1 = box.x_min !== undefined ? box.x_min : box.x1;
          const y1 = box.y_min !== undefined ? box.y_min : box.y1;
          const x2 = box.x_max !== undefined ? box.x_max : box.x2;
          const y2 = box.y_max !== undefined ? box.y_max : box.y2;

          // Convert normalized coordinates to canvas scale
          const x = x1 * canvas.width;
          const y = y1 * canvas.height;
          const w = (x2 - x1) * canvas.width;
          const h = (y2 - y1) * canvas.height;

          const color = getLabelColor(det.label);
          context.strokeStyle = color;
          context.lineWidth = 2.5;
          context.shadowBlur = 4;
          context.shadowColor = 'rgba(0,0,0,0.5)';
          context.strokeRect(x, y, w, h);

          // Draw label background
          context.fillStyle = color;
          context.shadowBlur = 0;
          context.font = 'bold 11px monospace';
          const txt = `${det.label.toUpperCase()} ${(det.confidence * 100).toFixed(0)}%`;
          const textWidth = context.measureText(txt).width;

          context.fillRect(x - 1, (y > 15 ? y - 16 : y + h + 1), textWidth + 12, 16);
          context.fillStyle = '#ffffff';
          context.fillText(txt, x + 5, (y > 15 ? y - 4 : y + h + 12));
        }
      }
    });
  }

  // Player controls
  video.addEventListener('timeupdate', () => {
    if (!dragging) {
      const pct = (video.currentTime / video.duration) * 100;
      setPct(pct);
    }
    currentTimeLabel.textContent = formatDuration(video.currentTime);
    drawBoundingBoxes();
  });

  function setPct(p) {
    const pctVal = Math.min(100, Math.max(0, p));
    scrubFill.style.width = pctVal + '%';
    scrubHandle.style.left = pctVal + '%';
  }

  function pctFromEvent(e) {
    const rect = scrubTrack.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  scrubTrack.addEventListener('mousedown', (e) => {
    if (!video.src) return;
    dragging = true;
    const pct = pctFromEvent(e);
    setPct(pct);
    video.currentTime = (pct / 100) * video.duration;
  });

  window.addEventListener('mousemove', (e) => {
    if (dragging && video.src) {
      const pct = pctFromEvent(e);
      setPct(pct);
      video.currentTime = (pct / 100) * video.duration;
    }
  });

  window.addEventListener('mouseup', () => { dragging = false; });

  playBtn.addEventListener('click', () => {
    if (video.src) {
      video.play();
      playBtn.classList.add('primary');
      pauseBtn.classList.remove('primary');
    }
  });

  pauseBtn.addEventListener('click', () => {
    if (video.src) {
      video.pause();
      playBtn.classList.remove('primary');
      pauseBtn.classList.add('primary');
    }
  });

  snapBtn.addEventListener('click', () => {
    if (!video.src) return;
    snapBtn.classList.add('primary');

    // Draw current frame to offscreen canvas
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const snapCtx = snapCanvas.getContext('2d');
    snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    // Export data URL and download
    const link = document.createElement('a');
    link.download = `snapshot_${Date.now()}.png`;
    link.href = snapCanvas.toDataURL();
    link.click();

    setTimeout(() => snapBtn.classList.remove('primary'), 220);
  });

  // Initial runs
  updateTopbar();
  loadCameras();
})();
