// components.js
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const sidebar = document.getElementById('sidebar');
  let gridSize = 20;
  let deviceScale = 1; // 1 para PC, <1 para móvil

  // ===============================
  // FUNCIONES UTILES
  // ===============================
  const snapToGrid = (value) => Math.round(value / gridSize) * gridSize;

  const applyTheme = (el) => {
    const isDark = document.body.classList.contains('dark');
    if(el.dataset.type==='text'){
      el.style.color = isDark ? '#e5e7eb' : '#111827';
    } else if(el.tagName==='INPUT'){
      el.style.background = isDark ? '#1f2937' : '#fff';
      el.style.color = isDark ? '#e5e7eb' : '#111827';
      el.style.border = '1px solid ' + (isDark ? '#374151' : '#d1d5db');
    } else if(el.dataset.type==='button'){
      el.style.background = isDark ? '#4f46e5' : '#6366f1';
      el.style.color = '#fff';
    }
  };

  const makeDraggable = (el, parent=canvas) => {
    let offsetX, offsetY;
    el.addEventListener('mousedown', (e) => {
      offsetX = e.offsetX;
      offsetY = e.offsetY;

      const onMouseMove = (ev) => {
        let x = snapToGrid(ev.clientX - offsetX - parent.getBoundingClientRect().left);
        let y = snapToGrid(ev.clientY - offsetY - parent.getBoundingClientRect().top);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };

  const makeResizable = (el) => {
    el.style.resize = 'both';
    el.style.overflow = 'auto';
  };

  // ===============================
  // COMPONENTES DEL SIDEBAR
  // ===============================
  sidebar.querySelectorAll('.comp').forEach(comp => {
    comp.addEventListener('dragstart', e => {
      e.dataTransfer.setData('type', comp.dataset.type);
    });
  });

  canvas.addEventListener('dragover', e => e.preventDefault());
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    let el;

    switch(type){
      case 'text':
        el = document.createElement('div');
        el.contentEditable = true;
        el.className = 'canvas-component editable';
        el.style.position = 'absolute';
        el.style.left = snapToGrid(e.offsetX) + 'px';
        el.style.top = snapToGrid(e.offsetY) + 'px';
        el.style.minWidth = '60px';
        el.style.minHeight = '20px';
        el.innerText = 'Texto editable';
        break;

      case 'button':
        el = document.createElement('button');
        el.className = 'canvas-component';
        el.style.position = 'absolute';
        el.style.left = snapToGrid(e.offsetX) + 'px';
        el.style.top = snapToGrid(e.offsetY) + 'px';
        el.innerText = 'Botón';
        break;

      case 'input':
        el = document.createElement('input');
        el.className = 'canvas-component';
        el.style.position = 'absolute';
        el.style.left = snapToGrid(e.offsetX) + 'px';
        el.style.top = snapToGrid(e.offsetY) + 'px';
        el.placeholder = 'Escribe algo';
        break;

      case 'image':
        el = document.createElement('img');
        el.className = 'canvas-component';
        el.style.position = 'absolute';
        el.style.left = snapToGrid(e.offsetX) + 'px';
        el.style.top = snapToGrid(e.offsetY) + 'px';
        el.src = '';
        el.style.width = '150px';
        el.style.height = '100px';
        el.style.objectFit = 'cover';
        // Abrir selector de archivo
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = ev => {
          const file = ev.target.files[0];
          if(file){
            el.src = URL.createObjectURL(file);
          }
        };
        fileInput.click();
        break;

      case 'container':
        el = document.createElement('div');
        el.className = 'canvas-component container';
        el.style.position = 'absolute';
        el.style.left = snapToGrid(e.offsetX) + 'px';
        el.style.top = snapToGrid(e.offsetY) + 'px';
        el.style.width = '300px';
        el.style.height = '200px';
        el.style.border = '2px dashed #9ca3af';
        el.style.background = 'transparent';
        el.style.display = 'flex';
        el.style.flexWrap = 'wrap';
        break;
    }

    if(el){
      applyTheme(el);
      makeDraggable(el, canvas);
      if(type==='text') makeResizable(el);
      canvas.appendChild(el);
    }
  });

  // ===============================
  // Doble click para borrar
  // ===============================
  canvas.addEventListener('dblclick', e => {
    if(e.target.classList.contains('canvas-component')){
      e.target.remove();
    }
  });

  // ===============================
  // Cambio de tema
  // ===============================
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    canvas.querySelectorAll('.canvas-component').forEach(el => applyTheme(el));
  });

  // ===============================
  // Cambiar dispositivo
  // ===============================
  window.setDevice = (mode) => {
    deviceScale = mode==='pc'?1:0.6;
    canvas.querySelectorAll('.canvas-component').forEach(el => {
      el.style.transform = `scale(${deviceScale})`;
      el.style.transformOrigin = 'top left';
    });
  };
});