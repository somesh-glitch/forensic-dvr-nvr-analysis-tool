(function(){
  const dz = document.getElementById('dropzone');
  const input = document.getElementById('fileInput');
  const btn = document.getElementById('selectFileBtn');

  const open = (e) => { e.stopPropagation(); input.click(); };
  btn.addEventListener('click', open);
  dz.addEventListener('click', open);
  dz.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); input.click(); }
  });

  ['dragenter','dragover'].forEach(evt => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.add('drag-active');
    });
  });
  ['dragleave','drop'].forEach(evt => {
    dz.addEventListener(evt, (e) => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('drag-active');
    });
  });
  dz.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if(files && files.length){ handleFiles(files); }
  });
  input.addEventListener('change', () => {
    if(input.files && input.files.length){ handleFiles(input.files); }
  });

  function handleFiles(files){
    // Placeholder ingest hook — wire to backend upload endpoint here.
    console.log('Queued for ingest:', Array.from(files).map(f => f.name));
  }
})();
