// DARK/LIGHT MODE
const themeBtn = document.getElementById('toggleTheme');
themeBtn.addEventListener('click', () => {
  document.body.dataset.theme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
});

// SIDEBAR HAMBURGER TOGGLE
const hamburger = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('closeSidebar');
// Toggle sidebar y cambiar icono
hamburger.addEventListener('click', (e) => {
  sidebar.classList.toggle('active');
  hamburger.innerText = sidebar.classList.contains('active') ? '✖' : '☰';
});


// Cerrar al tocar fuera del sidebar
document.addEventListener('click', (e) => {
  if(window.innerWidth <= 1023 && sidebar.classList.contains('active')){
    if(!sidebar.contains(e.target) && e.target !== hamburger){
      sidebar.classList.remove('active');
      hamburger.innerText = '☰';
    }
  }
});

closeSidebar.addEventListener('click', () => { 
  sidebar.classList.remove('active');
  hamburger.innerText = '☰';
});
//const hamburger = document.getElementById('hamburger');
//const sidebar = document.getElementById('sidebar');
//hamburger.addEventListener('click', () => sidebar.classList.toggle('active'));

// COUNTER ANIMATION
const counters = document.querySelectorAll('.counter');
counters.forEach(counter => {
  const updateCount = () => {
    const target = +counter.dataset.target;
    const count = +counter.innerText;
    const inc = target / 100;
    if(count < target){
      counter.innerText = Math.ceil(count + inc);
      setTimeout(updateCount, 20);
    } else counter.innerText = target;
  };
  updateCount();
});

// CHARTS


// Apps Doughnut
new Chart(document.getElementById('appsChart').getContext('2d'), {
  type:'doughnut',
  data:{ labels: appsData.length ? appsData : ['Sin Apps'], datasets:[{label:'Apps',data: appsData.length? appsData.map(()=>1):[1],backgroundColor:['#1abc9c','#3498db','#e74c3c','#9b59b6','#f1c40f']}]},
  options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
});

// Users Bar
new Chart(document.getElementById('usersChart').getContext('2d'), {
  type:'bar',
  data:{ labels: usersData.length?usersData:['Sin Usuarios'], datasets:[{label:'Usuarios', data: usersData.length? usersData.map(()=>1):[1], backgroundColor:'#3498db'}]},
  options:{ responsive:true, plugins:{ legend:{ display:false } } }
});

// Templates Pie
new Chart(document.getElementById('templatesChart').getContext('2d'), {
  type:'pie',
  data:{ labels: templatesData.length?templatesData:['Sin Plantillas'], datasets:[{label:'Plantillas',data: templatesData.length? templatesData.map(()=>1):[1],backgroundColor:['#e74c3c','#f1c40f','#2ecc71','#9b59b6','#3498db']}]},
  options:{ responsive:true, plugins:{ legend:{ position:'bottom' } } }
});

function igualarAlturaCards() {
  const cards = document.querySelectorAll('.main .card');
  
  // Resetear altura primero
  cards.forEach(card => card.style.height = 'auto');

  // Esperar a que el layout se reacomode
  requestAnimationFrame(() => {
    let maxHeight = 0;
    cards.forEach(card => {
      if(card.offsetHeight > maxHeight) maxHeight = card.offsetHeight;
    });
    cards.forEach(card => card.style.height = maxHeight + 'px');
  });
}

window.addEventListener('load', igualarAlturaCards);
window.addEventListener('resize', igualarAlturaCards);

/*
window.addEventListener('load', igualarAlturaCards);
window.addEventListener('resize', igualarAlturaCards);
function igualarAlturaCards() {
  const cards = document.querySelectorAll('.main .card');
  let maxHeight = 0;

  cards.forEach(card => {
    card.style.height = 'auto'; // reset
    const h = card.offsetHeight;
    if (h > maxHeight) maxHeight = h;
  });

  cards.forEach(card => card.style.height = maxHeight + 'px');
}

window.addEventListener('load', igualarAlturaCards);
window.addEventListener('resize', igualarAlturaCards);*/