(function(){
  const track = document.getElementById('scrubTrack');
  const fill = document.getElementById('scrubFill');
  const handle = document.getElementById('scrubHandle');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const snapBtn = document.getElementById('snapBtn');
  const evRows = document.querySelectorAll('.ev-row');
  const tsTag = document.getElementById('tsTag');

  let dragging = false;
  let playing = false;
  let timer = null;
  let pct = 38;

  function setPct(p){
    pct = Math.min(100, Math.max(0, p));
    fill.style.width = pct + '%';
    handle.style.left = pct + '%';
  }

  function pctFromEvent(e){
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  track.addEventListener('mousedown', (e) => { dragging = true; setPct(pctFromEvent(e)); });
  window.addEventListener('mousemove', (e) => { if(dragging) setPct(pctFromEvent(e)); });
  window.addEventListener('mouseup', () => { dragging = false; });

  function setPlaying(state){
    playing = state;
    playBtn.classList.toggle('primary', !playing ? false : true);
    pauseBtn.classList.toggle('primary', !playing);
    if(playing){
      clearInterval(timer);
      timer = setInterval(() => {
        setPct(pct >= 100 ? 0 : pct + 0.4);
      }, 120);
    } else {
      clearInterval(timer);
    }
  }

  playBtn.addEventListener('click', () => setPlaying(true));
  pauseBtn.addEventListener('click', () => setPlaying(false));
  setPlaying(false);

  snapBtn.addEventListener('click', () => {
    snapBtn.classList.add('primary');
    setTimeout(() => snapBtn.classList.remove('primary'), 220);
  });

  evRows.forEach(row => {
    row.addEventListener('click', () => {
      const time = row.querySelector('.ev-time').textContent;
      tsTag.textContent = '2026-08-14   ' + time;
      evRows.forEach(r => r.style.background = '');
      row.style.background = 'var(--panel-hover)';
    });
  });
})();
