(function(){
  const filters = document.querySelectorAll('.tl-filter');
  const items = document.querySelectorAll('.tl-item');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.filter;

      items.forEach(item => {
        const types = item.dataset.type.split(' ');
        const show = type === 'all' || types.includes(type);
        item.style.display = show ? 'grid' : 'none';
      });
    });
  });
})();
