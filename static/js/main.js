/* main.js */
// ── Custom cursor ────────────────────────────
const cur = document.getElementById('cursor');
const trail = document.getElementById('cursorTrail');
let mx = 0, my = 0, tx = 0, ty = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  if (cur) { cur.style.left = mx - 6 + 'px'; cur.style.top = my - 6 + 'px'; }
});

function animTrail() {
  tx += (mx - tx) * 0.12;
  ty += (my - ty) * 0.12;
  if (trail) { trail.style.left = tx + 'px'; trail.style.top = ty + 'px'; }
  requestAnimationFrame(animTrail);
}
animTrail();

// ── Particles ────────────────────────────────
const canvas = document.getElementById('particles');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let pts = [];
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    pts.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random()
    });
  }

  function drawPts() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.a * 0.4})`;
      ctx.fill();
    });
    requestAnimationFrame(drawPts);
  }
  drawPts();
}

// ── Theme toggle ─────────────────────────────
const themeBtn = document.getElementById('themeToggle');
const themeIcon = themeBtn?.querySelector('.theme-icon');
let isDark = localStorage.getItem('theme') !== 'light';
function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  if (themeIcon) themeIcon.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}
applyTheme();
themeBtn?.addEventListener('click', () => { isDark = !isDark; applyTheme(); });

// ── Navbar scroll ────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (navbar) navbar.style.boxShadow = window.scrollY > 20 ? '0 4px 30px rgba(0,0,0,0.3)' : '';
});

// ── Mobile burger ─────────────────────────────
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  const s = burger.querySelectorAll('span');
  s[0].style.transform = open ? 'rotate(45deg) translate(5px,5px)' : '';
  s[1].style.opacity = open ? '0' : '';
  s[2].style.transform = open ? 'rotate(-45deg) translate(5px,-5px)' : '';
});
document.querySelectorAll('.nav-link').forEach(l => {
  l.addEventListener('click', () => { navLinks?.classList.remove('open'); burger?.querySelectorAll('span').forEach(s => { s.style.transform=''; s.style.opacity=''; }); });
});

// ── Scroll reveal ─────────────────────────────
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.feat-card,.hcard,.model-card,.about-card,.tip-card,.soc-card,.step-item,.skill-row,.cinfo-item,.flow-item').forEach(el => {
  el.style.opacity='0'; el.style.transform='translateY(24px)';
  el.style.transition='opacity 0.6s ease,transform 0.6s ease';
  io.observe(el);
});
