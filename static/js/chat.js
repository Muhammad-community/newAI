// ══════════════════════════════════════════════
//  NovaMind AI — chat.js  (v5)
// ══════════════════════════════════════════════

var msgsList  = document.getElementById('messagesList');
var welcomeSc = document.getElementById('welcomeScreen');
var inputEl   = document.getElementById('userInput');
var sendBtn   = document.getElementById('sendBtn');
var charCount = document.getElementById('charCount');
var totalTok  = document.getElementById('totalTokens');
var historyEl = document.getElementById('chatHistoryList');

var chatHistory  = [];
var sessions     = [];
try { sessions = JSON.parse(localStorage.getItem('nm_sessions') || '[]'); } catch(e) {}
var currentSess  = null;
var totalTokens  = 0;
var isRecording  = false;
var recognition  = null;
var ttsEnabled   = false;
var lastUserMsg  = '';
var pendingFile  = null;  // { file, dataUrl, name, type }
var synth        = window.speechSynthesis;
var msgCounter   = 0;
var codeStore    = {};

// Fayl turi konfiguratsiyasi
var FILE_TYPES = {
  'image':  { icon: '🖼️', color: '#0ea5e9', label: 'Rasm',        api: '/api/vision',  field: 'image',  badge: '· 👁️ Vision ' },
  'pdf':    { icon: '📄', color: '#ef4444', label: 'PDF',          api: '/api/pdf',     field: 'file',   badge: '· 📄 PDF '    },
  'word':   { icon: '📝', color: '#2563eb', label: 'Word',         api: '/api/word',    field: 'file',   badge: '· 📝 Word '   },
  'pptx':   { icon: '📊', color: '#d97706', label: 'PowerPoint',   api: '/api/pptx',    field: 'file',   badge: '· 📊 PPTX '   },
  'excel':  { icon: '📈', color: '#16a34a', label: 'Excel',        api: '/api/excel',   field: 'file',   badge: '· 📈 Excel '  },
};

function getFileType(file) {
  var name = (file.name || '').toLowerCase();
  var mime = file.type || '';
  if (mime.startsWith('image/'))                                          return 'image';
  if (mime === 'application/pdf'         || name.endsWith('.pdf'))       return 'pdf';
  if (mime.includes('wordprocessingml')  || name.endsWith('.docx') || name.endsWith('.doc')) return 'word';
  if (mime.includes('presentationml')   || name.endsWith('.pptx') || name.endsWith('.ppt')) return 'pptx';
  if (mime.includes('spreadsheetml')    || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return 'excel';
  return null;
}

// ══════════════════════════════════════════════
//  MARKDOWN + CODE RUNNER
// ══════════════════════════════════════════════
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

var WEB = ['html','css','javascript','js'];

function renderMD(raw, msgId) {
  var blocks  = [];
  var codeMap = { html:'', css:'', js:'' };
  var hasWeb  = false;

  var tmp = raw.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
    var l   = lang.trim().toLowerCase();
    var idx = blocks.length;
    if (WEB.indexOf(l) !== -1) {
      hasWeb = true;
      var key = l === 'javascript' ? 'js' : l;
      codeMap[key] += '\n' + code.trim();
    }
    var label = lang.trim() || 'code';
    blocks.push(
      '<div class="code-block">'
        + '<div class="code-header">'
          + '<span class="code-lang">' + escHtml(label) + '</span>'
          + '<button class="copy-code-btn" onclick="copyCode(this)">📋 Nusxa</button>'
        + '</div>'
        + '<pre><code>' + escHtml(code.trim()) + '</code></pre>'
      + '</div>'
    );
    return '\x00B' + idx + '\x00';
  });

  if (hasWeb && msgId) {
    codeStore[msgId] = codeMap;
    tmp += '\x00RUN' + msgId + '\x00';
  }

  var md = tmp
    .replace(/`([^`\n]+)`/g,       function(_,c){ return '<code>'+escHtml(c)+'</code>'; })
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,     '<em>$1</em>')
    .replace(/^### (.+)$/gm,       '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,        '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,         '<h1>$1</h1>')
    .replace(/^[-*] (.+)$/gm,      '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm,     '<li>$1</li>')
    .replace(/\n{2,}/g,            '<br><br>')
    .replace(/\n/g,                '<br>');

  md = md.replace(/\x00B(\d+)\x00/g,  function(_,i){ return blocks[parseInt(i)]; });
  md = md.replace(/\x00RUN(\w+)\x00/g, function(_,id){
    return '<div class="run-all-wrap">'
      + '<button class="run-all-btn" data-mid="'+id+'" onclick="runAll(this)">▶ Kodlarni ishga tushirish</button>'
      + '</div>';
  });
  return md;
}

function runAll(btn) {
  var bubble   = btn.closest('.msg-bubble');
  var existing = bubble.querySelector('.code-preview');
  if (existing) {
    existing.remove();
    btn.innerHTML = '▶ Kodlarni ishga tushirish';
    return;
  }
  var cm  = codeStore[btn.getAttribute('data-mid')];
  if (!cm) return;
  var html = (cm.html||'').trim();
  var css  = (cm.css||'').trim();
  var js   = (cm.js||'').trim();
  var doc;
  if (html) {
    doc = html;
    if (css) doc = doc.indexOf('</head>') !== -1 ? doc.replace('</head>','<style>'+css+'</style></head>') : '<style>'+css+'</style>'+doc;
    if (js)  doc = doc.indexOf('</body>') !== -1 ? doc.replace('</body>','<script>'+js+'<\/script></body>') : doc+'<script>'+js+'<\/script>';
  } else {
    doc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:16px;margin:0}'+css+'</style></head><body><script>'+js+'<\/script></body></html>';
  }
  var preview = document.createElement('div');
  preview.className = 'code-preview';
  preview.innerHTML =
    '<div class="preview-header"><span>🖥️ Live Preview</span>'
    + '<div style="display:flex;gap:6px">'
      + '<button onclick="resizeFrame(this)" title="Kattalashtirish">⛶</button>'
      + '<button onclick="closeFrame(this)">✕ Yopish</button>'
    + '</div></div>'
    + '<iframe class="preview-frame" sandbox="allow-scripts allow-same-origin allow-modals allow-forms"></iframe>';
  bubble.appendChild(preview);
  btn.innerHTML = '■ Previewni yopish';
  preview.querySelector('iframe').srcdoc = doc;
  scroll();
}
function resizeFrame(btn) {
  var f = btn.closest('.code-preview').querySelector('.preview-frame');
  if (f.style.height === '90vh') { f.style.height='320px'; btn.textContent='⛶'; }
  else { f.style.height='90vh'; btn.textContent='⊡'; }
}
function closeFrame(btn) {
  var p = btn.closest('.code-preview');
  var r = p.closest('.msg-bubble').querySelector('.run-all-btn');
  if (r) r.innerHTML = '▶ Kodlarni ishga tushirish';
  p.remove();
}
function copyCode(btn) {
  var c = btn.closest('.code-block').querySelector('code').innerText;
  navigator.clipboard.writeText(c).then(function(){
    var o=btn.textContent; btn.textContent='✓ Nusxalandi';
    setTimeout(function(){ btn.textContent=o; },1500);
  });
}

// ══════════════════════════════════════════════
//  TTS
// ══════════════════════════════════════════════
function speak(text) {
  if (!ttsEnabled || !synth) return;
  try { synth.cancel(); } catch(e){}
  var clean = text.replace(/```[\s\S]*?```/g,'').replace(/[*#`<>]/g,'').slice(0,500);
  var utt   = new SpeechSynthesisUtterance(clean);
  utt.lang  = /[а-яА-Я]/.test(clean)?'ru-RU':/[a-zA-Z]/.test(clean)?'en-US':'uz-UZ';
  synth.speak(utt);
}
function stopSpeaking() { try{synth&&synth.cancel();}catch(e){} }
function speakThis(btn) {
  var b=btn.closest('.msg-body').querySelector('.msg-bubble');
  var p=ttsEnabled; ttsEnabled=true; speak(b.innerText); ttsEnabled=p;
}

// ══════════════════════════════════════════════
//  SIDEBAR / CONTROLS
// ══════════════════════════════════════════════
var _st = document.getElementById('sidebarToggle');
if (_st) _st.addEventListener('click', function(){
  var sb=document.getElementById('chatSidebar'); if(!sb) return;
  if(window.innerWidth<=1024) sb.classList.toggle('mobile-open');
  else sb.classList.toggle('collapsed');
});
var _tr = document.getElementById('tempRange');
if (_tr) _tr.addEventListener('input', function(){
  var tv=document.getElementById('tempVal'); if(tv) tv.textContent=this.value;
});

// ══════════════════════════════════════════════
//  FILE UPLOAD
// ══════════════════════════════════════════════
function setupFileUpload() {
  var fi = document.createElement('input');
  fi.type = 'file';
  fi.accept = 'image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv';
  fi.style.display = 'none';
  document.body.appendChild(fi);

  var box = document.querySelector('.input-box');
  if (!box) return;

  var btn = document.createElement('button');
  btn.className = 'input-action-btn';
  btn.title     = 'Fayl biriktirish: rasm, PDF, Word, Excel, PowerPoint (yoki Ctrl+V)';
  btn.innerHTML = '📎';
  btn.style.fontSize = '16px';
  btn.addEventListener('click', function(){ fi.click(); });
  box.insertBefore(btn, box.firstChild);

  fi.addEventListener('change', function(){
    if (fi.files[0]) handleFile(fi.files[0]);
    fi.value = '';
  });

  // Ctrl+V — rasm paste
  document.addEventListener('paste', function(e){
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i=0; i<items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        var f = items[i].getAsFile();
        if (f) { handleFile(f); if(inputEl) inputEl.focus(); }
        break;
      }
    }
  });

  // Drag & Drop
  var wrap = document.querySelector('.chat-main');
  if (wrap) {
    wrap.addEventListener('dragover', function(e){ e.preventDefault(); wrap.classList.add('drag-over'); });
    wrap.addEventListener('dragleave', function(){ wrap.classList.remove('drag-over'); });
    wrap.addEventListener('drop', function(e){
      e.preventDefault(); wrap.classList.remove('drag-over');
      var f = e.dataTransfer.files[0]; if(f) handleFile(f);
    });
  }
}

function handleFile(file) {
  var type = getFileType(file);
  if (!type) { alert('Qo\'llab-quvvatlanmagan fayl turi.\nRuxsat etilgan: rasm, PDF, Word, Excel, PowerPoint'); return; }

  if (type === 'image') {
    var reader = new FileReader();
    reader.onload = function(e){
      pendingFile = { file:file, dataUrl:e.target.result, name:file.name, type:'image' };
      showFileBar(e.target.result, file.name, type);
    };
    reader.readAsDataURL(file);
  } else {
    pendingFile = { file:file, dataUrl:null, name:file.name, type:type };
    showFileBar(null, file.name, type);
  }
}

function showFileBar(dataUrl, name, type) {
  var old = document.getElementById('filePreviewBar'); if(old) old.remove();
  var cfg = FILE_TYPES[type] || { icon:'📎', color:'#888', label:type };
  var bar = document.createElement('div');
  bar.id = 'filePreviewBar'; bar.className = 'img-preview-bar';
  var thumb = (type === 'image' && dataUrl)
    ? '<img src="'+dataUrl+'" alt="img">'
    : '<div class="file-type-icon" style="background:'+cfg.color+'22;border-color:'+cfg.color+'44;color:'+cfg.color+'">'+cfg.icon+'</div>';
  bar.innerHTML = thumb
    + '<div class="file-bar-info">'
      + '<span class="file-bar-name">' + escHtml(name) + '</span>'
      + '<span class="file-bar-type" style="color:'+cfg.color+'">' + cfg.label + '</span>'
    + '</div>'
    + '<button onclick="removePendingFile()" title="Olib tashlash">✕</button>';
  var sec = document.querySelector('.input-section');
  if (sec) sec.insertBefore(bar, sec.firstChild);
  if (inputEl) {
    inputEl.focus();
    if (!inputEl.value) inputEl.placeholder = cfg.label + ' haqida savol yozing... (bo\'sh = avtomatik tahlil)';
  }
}

function removePendingFile() {
  pendingFile = null;
  var bar = document.getElementById('filePreviewBar'); if(bar) bar.remove();
  if (inputEl) inputEl.placeholder = 'Savolingizni yozing... (Enter — yuborish, Shift+Enter — yangi qator)';
}

// ══════════════════════════════════════════════
//  ADD MESSAGE
// ══════════════════════════════════════════════
function aiAvatar() {
  return '<div class="msg-av"><svg viewBox="0 0 40 40" width="22" height="22">'
    +'<polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="currentColor" stroke-width="2"/>'
    +'<text x="20" y="26" text-anchor="middle" font-size="14" font-weight="bold" fill="currentColor">N</text>'
    +'</svg></div>';
}

function addMsg(role, text, extra) {
  extra = extra || {};
  if (welcomeSc) welcomeSc.style.display = 'none';
  var div  = document.createElement('div');
  var time = new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  var mid  = 'mid'+(++msgCounter);

  if (role === 'typing') {
    div.className = 'msg assistant';
    div.innerHTML = aiAvatar()
      +'<div class="msg-body">'
        +'<div class="msg-meta">NovaMind AI <span>'+time+'</span></div>'
        +'<div class="msg-bubble"><div class="typing-ind"><span></span><span></span><span></span></div></div>'
      +'</div>';

  } else if (role === 'user') {
    div.className = 'msg user';
    var cfg    = extra.type ? FILE_TYPES[extra.type] : null;
    var attach = '';
    if (extra.type === 'image' && extra.dataUrl)
      attach = '<div class="attached-file-preview"><img src="'+extra.dataUrl+'" alt="img"><span>'+escHtml(extra.name||'')+'</span></div>';
    else if (cfg)
      attach = '<div class="attached-file-preview">'
        +'<div class="file-type-icon" style="background:'+cfg.color+'22;border-color:'+cfg.color+'44;color:'+cfg.color+'">'+cfg.icon+'</div>'
        +'<div><span class="file-bar-name">'+escHtml(extra.name||'')+'</span>'
        +'<span class="file-bar-type" style="color:'+cfg.color+'">'+cfg.label+'</span></div>'
        +'</div>';
    div.innerHTML =
      '<div class="msg-body">'
        +'<div class="msg-meta" style="flex-direction:row-reverse"><span>Siz</span><span>'+time+'</span></div>'
        + attach
        +'<div class="msg-bubble">'+renderMD(text,mid)+'</div>'
        +'<div class="msg-actions"><button class="msg-action-btn" onclick="copyMsg(this)">📋 Nusxa</button></div>'
      +'</div>'
      +'<div class="msg-av" style="background:linear-gradient(135deg,#7c3aed,#ec4899);font-size:11px;font-weight:800;color:white">Siz</div>';

  } else {
    div.className = 'msg assistant';
    var badge = extra.badge || '';
    var mdl   = extra.model ? '· '+extra.model : '';
    div.innerHTML = aiAvatar()
      +'<div class="msg-body">'
        +'<div class="msg-meta">NovaMind AI <span>'+time+'</span>'
          +'<span style="color:var(--cyan);font-size:10px">'+badge+mdl+'</span>'
        +'</div>'
        +'<div class="msg-bubble">'+renderMD(text,mid)+'</div>'
        +'<div class="msg-actions">'
          +'<button class="msg-action-btn" onclick="copyMsg(this)">📋 Nusxa</button>'
          +'<button class="msg-action-btn" onclick="regenerate()">🔄 Qayta</button>'
          +'<button class="msg-action-btn" onclick="speakThis(this)">🔊 Ovoz</button>'
        +'</div>'
      +'</div>';
  }

  msgsList.appendChild(div);
  scroll();
  return div;
}

function scroll() { var w=document.getElementById('messagesWrap'); if(w) w.scrollTop=w.scrollHeight; }
function copyMsg(btn) {
  var b=btn.closest('.msg-body').querySelector('.msg-bubble');
  navigator.clipboard.writeText(b.innerText).then(function(){
    var o=btn.textContent; btn.textContent='✓ Nusxalandi';
    setTimeout(function(){ btn.textContent=o; },1500);
  });
}
function regenerate() {
  if (!lastUserMsg) return;
  chatHistory.pop();
  var last=msgsList.lastElementChild; if(last) last.remove();
  sendMessage(lastUserMsg);
}

// ══════════════════════════════════════════════
//  SEND MESSAGE
// ══════════════════════════════════════════════
async function sendMessage(text) {
  text = (text || (inputEl ? inputEl.value : '') || '').trim();
  if (!text && !pendingFile) return;
  if (sendBtn && sendBtn.disabled) return;

  var pf          = pendingFile;
  var cfg         = pf ? FILE_TYPES[pf.type] : null;
  var displayText = text || (cfg ? cfg.label+' ni tahlil qil' : '');
  lastUserMsg     = displayText;

  addMsg('user', displayText, pf ? { type:pf.type, dataUrl:pf.dataUrl, name:pf.name } : {});
  chatHistory.push({ role:'user', content:displayText });

  if (inputEl) { inputEl.value=''; inputEl.style.height='auto'; }
  updateCharCount();
  if (sendBtn) sendBtn.disabled = true;

  var modelSel  = document.getElementById('modelSelect');
  var toneSel   = document.getElementById('toneSelect');
  var tr        = document.getElementById('tempRange');
  var model     = modelSel ? modelSel.value : 'llama-3.3-70b-versatile';
  var tone      = toneSel  ? toneSel.value  : 'default';
  var temp      = tr       ? tr.value       : '0.7';
  var modelName = modelSel ? (modelSel.selectedOptions[0].text||'').replace(/^[^\s]+\s/,'') : '';
  var typingEl  = addMsg('typing','');

  try {
    var reply, tokens, badge='';

    if (pf) {
      removePendingFile(); pendingFile = null;
      var endpoint = cfg.api;
      var fd = new FormData();
      fd.append(cfg.field, pf.file);
      fd.append('message', displayText);
      var r   = await fetch(endpoint, { method:'POST', body:fd });
      var d   = await r.json();
      reply   = d.reply  || '⚠️ Javob kelmadi';
      tokens  = d.tokens || 0;
      var extra = d.pages ? ' ('+d.pages+(pf.type==='excel'?' qator':pf.type==='pptx'?' slayd':' bet')+')' : '';
      badge   = cfg.badge + extra + ' ';
    } else {
      var cr  = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message:displayText, history:chatHistory.slice(-20), model, tone, temperature:parseFloat(temp) })
      });
      var cd  = await cr.json();
      reply   = cd.reply  || '⚠️ Javob kelmadi';
      tokens  = cd.tokens || 0;
    }

    var mid2   = 'mid'+(++msgCounter);
    var bubble = typingEl.querySelector('.msg-bubble');
    var metaEl = typingEl.querySelector('.msg-meta');
    var bodyEl = typingEl.querySelector('.msg-body');
    var rt     = new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});

    bubble.innerHTML = renderMD(reply, mid2);
    metaEl.innerHTML = 'NovaMind AI <span>'+rt+'</span>'
      +'<span style="color:var(--cyan);font-size:10px">'+badge+modelName+'</span>';

    var acts = document.createElement('div');
    acts.className = 'msg-actions';
    acts.innerHTML = '<button class="msg-action-btn" onclick="copyMsg(this)">📋 Nusxa</button>'
      +'<button class="msg-action-btn" onclick="regenerate()">🔄 Qayta</button>'
      +'<button class="msg-action-btn" onclick="speakThis(this)">🔊 Ovoz</button>';
    bodyEl.appendChild(acts);

    var ti=typingEl.querySelector('.typing-ind'); if(ti) ti.remove();
    chatHistory.push({role:'assistant',content:reply});
    speak(reply);

    if (tokens) { totalTokens+=tokens; if(totalTok) totalTok.textContent=totalTokens.toLocaleString(); }
    saveSession(displayText, new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'}), reply, rt, modelName, tokens);

  } catch(err) {
    var b2=typingEl.querySelector('.msg-bubble');
    if(b2) b2.innerHTML='<span style="color:var(--red)">⚠️ Xatolik: '+escHtml(err.message)+'</span>';
    var ti2=typingEl.querySelector('.typing-ind'); if(ti2) ti2.remove();
  }

  if(sendBtn) sendBtn.disabled=false;
  if(inputEl) inputEl.placeholder='Savolingizni yozing... (Enter — yuborish, Shift+Enter — yangi qator)';
  scroll();
}

// ══════════════════════════════════════════════
//  SESSION
// ══════════════════════════════════════════════
function saveSession(uText,uTime,aiReply,aiTime,mdl,tokens) {
  if (!currentSess) {
    currentSess={id:Date.now(),title:uText.slice(0,45),ts:Date.now(),tokens:0,messages:[]};
    sessions.unshift(currentSess);
  }
  currentSess.messages.push({role:'user',      content:uText,   time:uTime});
  currentSess.messages.push({role:'assistant', content:aiReply, time:aiTime, model:mdl});
  currentSess.tokens=(currentSess.tokens||0)+tokens;
  currentSess.ts=Date.now();
  if(sessions.length>30) sessions.pop();
  try{localStorage.setItem('nm_sessions',JSON.stringify(sessions));}catch(e){}
  renderHistory();
}

function renderSessionMsgs(sess) {
  msgsList.innerHTML='';
  if (!sess.messages||!sess.messages.length){if(welcomeSc)welcomeSc.style.display='';return;}
  if(welcomeSc) welcomeSc.style.display='none';
  sess.messages.forEach(function(m){
    var div=document.createElement('div');
    var mid='mid'+(++msgCounter);
    var t=m.time||''; var mdl=m.model?'· '+m.model:'';
    div.className='msg '+m.role;
    if(m.role==='user'){
      div.innerHTML='<div class="msg-body">'
        +'<div class="msg-meta" style="flex-direction:row-reverse"><span>Siz</span><span>'+t+'</span></div>'
        +'<div class="msg-bubble">'+renderMD(m.content,mid)+'</div>'
        +'<div class="msg-actions"><button class="msg-action-btn" onclick="copyMsg(this)">📋 Nusxa</button></div>'
        +'</div>'
        +'<div class="msg-av" style="background:linear-gradient(135deg,#7c3aed,#ec4899);font-size:11px;font-weight:800;color:white">Siz</div>';
    } else {
      div.innerHTML=aiAvatar()
        +'<div class="msg-body">'
          +'<div class="msg-meta">NovaMind AI <span>'+t+'</span><span style="color:var(--cyan);font-size:10px">'+mdl+'</span></div>'
          +'<div class="msg-bubble">'+renderMD(m.content,mid)+'</div>'
          +'<div class="msg-actions">'
            +'<button class="msg-action-btn" onclick="copyMsg(this)">📋 Nusxa</button>'
            +'<button class="msg-action-btn" onclick="speakThis(this)">🔊 Ovoz</button>'
          +'</div>'
        +'</div>';
    }
    msgsList.appendChild(div);
  });
  scroll();
}

function loadSession(id) {
  var s=null;
  for(var i=0;i<sessions.length;i++) if(sessions[i].id===id){s=sessions[i];break;}
  if(!s) return;
  currentSess=s; chatHistory=(s.messages||[]).map(function(m){return{role:m.role,content:m.content};});
  totalTokens=s.tokens||0; if(totalTok) totalTok.textContent=totalTokens.toLocaleString();
  renderSessionMsgs(s); renderHistory();
}

function renderHistory() {
  if(!historyEl) return;
  if(!sessions.length){historyEl.innerHTML='<div class="history-empty"><span>💬</span><p>Suhbatlar saqlanmagan</p></div>';return;}
  historyEl.innerHTML=sessions.map(function(s){
    var a=(currentSess&&currentSess.id===s.id)?'active':'';
    var c=Math.floor(((s.messages||[]).length)/2);
    return '<div class="history-item '+a+'" data-id="'+s.id+'">'
      +'<span class="hi-title">'+escHtml(s.title||'Yangi suhbat')+'</span>'
      +'<span class="hi-count">'+c+' xabar</span>'
      +'</div>';
  }).join('');
  historyEl.querySelectorAll('.history-item').forEach(function(el){
    el.addEventListener('click',function(){loadSession(Number(el.dataset.id));});
  });
}
renderHistory();

// ══════════════════════════════════════════════
//  BUTTONS
// ══════════════════════════════════════════════
var _ncb=document.getElementById('newChatBtn');
if(_ncb) _ncb.addEventListener('click',function(){
  chatHistory=[];currentSess=null;totalTokens=0;
  msgsList.innerHTML='';
  if(welcomeSc)welcomeSc.style.display='';
  if(totalTok)totalTok.textContent='0';
  removePendingFile();stopSpeaking();renderHistory();
});

var _clb=document.getElementById('clearBtn');
if(_clb) _clb.addEventListener('click',function(){
  if(!confirm('Hamma suhbatlar o\'chirilsinmi?'))return;
  chatHistory=[];currentSess=null;sessions=[];totalTokens=0;
  msgsList.innerHTML='';
  if(welcomeSc)welcomeSc.style.display='';
  try{localStorage.removeItem('nm_sessions');}catch(e){}
  removePendingFile();stopSpeaking();renderHistory();
});

var _exp=document.getElementById('exportBtn');
if(_exp) _exp.addEventListener('click',function(){
  if(!chatHistory.length){alert('Eksport qilish uchun suhbat boshlang.');return;}
  var txt=chatHistory.map(function(m){return'['+(m.role==='user'?'SIZ':'AI')+']\n'+m.content+'\n';}).join('\n---\n\n');
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
  a.download='novamind_'+new Date().toISOString().slice(0,10)+'.txt';a.click();
});

// TTS tugmasi
(function(){
  var ctrl=document.querySelector('.chat-controls'); if(!ctrl) return;
  var btn=document.createElement('button');
  btn.className='ctrl-btn';btn.title='Ovozli o\'qish';btn.innerHTML='🔇';btn.style.fontSize='16px';
  btn.addEventListener('click',function(){
    ttsEnabled=!ttsEnabled;
    btn.innerHTML=ttsEnabled?'🔊':'🔇';
    btn.style.borderColor=ttsEnabled?'var(--cyan)':'';
    btn.style.color=ttsEnabled?'var(--cyan)':'';
    if(!ttsEnabled)stopSpeaking();
  });
  ctrl.appendChild(btn);
})();

// Ovozli kiritish
var _vb=document.getElementById('voiceBtn');
if(_vb&&('SpeechRecognition'in window||'webkitSpeechRecognition'in window)){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new SR();recognition.lang='uz-UZ';recognition.interimResults=false;
  recognition.onresult=function(e){if(inputEl){inputEl.value=e.results[0][0].transcript;updateCharCount();}isRecording=false;_vb.classList.remove('recording');};
  recognition.onerror=recognition.onend=function(){isRecording=false;_vb.classList.remove('recording');};
  _vb.addEventListener('click',function(){
    if(isRecording)recognition.stop();else recognition.start();
    isRecording=!isRecording;_vb.classList.toggle('recording',isRecording);
  });
}

function updateCharCount(){
  if(!charCount||!inputEl)return;
  var l=inputEl.value.length;
  charCount.textContent=l+' / 4000';charCount.style.color=l>3500?'var(--red)':'';
}
if(inputEl){
  inputEl.addEventListener('input',function(){
    inputEl.style.height='auto';inputEl.style.height=Math.min(inputEl.scrollHeight,160)+'px';updateCharCount();
  });
  inputEl.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
}
if(sendBtn) sendBtn.addEventListener('click',function(){sendMessage();});
function sendQ(t){sendMessage(t);}

setupFileUpload();

// ══════════════════════════════════════════════
//  CSS
// ══════════════════════════════════════════════
var _s=document.createElement('style');
_s.textContent=
  '.code-block{border-radius:12px;overflow:hidden;margin:10px 0;border:1px solid var(--border)}'
  +'.code-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(0,0,0,0.35)}'
  +'.code-lang{font-size:11px;font-weight:700;color:var(--cyan);text-transform:uppercase;letter-spacing:1px}'
  +'.copy-code-btn{padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--txt2);font-size:12px;cursor:pointer;transition:.2s}'
  +'.copy-code-btn:hover{border-color:var(--border2);color:var(--cyan)}'
  +'.code-block pre{margin:0;padding:14px;background:var(--bg);overflow-x:auto;font-family:monospace;font-size:13px;line-height:1.6}'
  +'.run-all-wrap{margin-top:10px}'
  +'.run-all-btn{width:100%;padding:11px 20px;border-radius:10px;'
    +'border:1px solid rgba(0,212,255,0.3);background:linear-gradient(135deg,rgba(0,212,255,0.1),rgba(124,58,237,0.1));'
    +'color:var(--cyan);font-size:14px;font-weight:700;cursor:pointer;transition:.25s}'
  +'.run-all-btn:hover{background:linear-gradient(135deg,rgba(0,212,255,0.22),rgba(124,58,237,0.18));transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,212,255,0.18)}'
  +'.code-preview{margin-top:10px;border:1px solid rgba(16,185,129,0.3);border-radius:12px;overflow:hidden}'
  +'.preview-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;'
    +'background:rgba(16,185,129,0.08);border-bottom:1px solid rgba(16,185,129,0.2);font-size:12px;font-weight:600;color:var(--green)}'
  +'.preview-header div{display:flex;gap:6px}'
  +'.preview-header button{background:transparent;border:1px solid var(--border);color:var(--txt2);cursor:pointer;font-size:12px;padding:3px 8px;border-radius:6px;transition:.2s}'
  +'.preview-header button:hover{color:var(--txt);border-color:var(--border2)}'
  +'.preview-frame{width:100%;height:320px;border:none;background:#fff;display:block;transition:height .3s}'

  // File bar
  +'.img-preview-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:8px;'
    +'background:rgba(0,212,255,0.05);border:1px solid var(--border2);border-radius:12px}'
  +'.img-preview-bar img{width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0}'
  +'.img-preview-bar button{background:transparent;border:none;color:var(--txt3);cursor:pointer;font-size:16px;padding:2px 6px;border-radius:6px;flex-shrink:0}'
  +'.img-preview-bar button:hover{color:var(--red);background:rgba(239,68,68,0.1)}'
  +'.file-bar-info{display:flex;flex-direction:column;gap:2px;flex:1;overflow:hidden}'
  +'.file-bar-name{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.file-bar-type{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}'
  +'.file-type-icon{width:40px;height:40px;border-radius:10px;border:1px solid;'
    +'display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}'

  // Attached file in message
  +'.attached-file-preview{display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:10px 14px;'
    +'background:rgba(0,212,255,0.05);border-radius:10px;border:1px solid var(--border)}'
  +'.attached-file-preview img{width:56px;height:56px;border-radius:8px;object-fit:cover}'
  +'.attached-file-preview .file-bar-info{flex:1}'

  // History
  +'.history-item{display:flex;flex-direction:column;gap:3px;cursor:pointer}'
  +'.hi-title{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +'.hi-count{font-size:10px;color:var(--txt3)}'
  +'.chat-main.drag-over{outline:2px dashed var(--cyan);outline-offset:-4px}';
document.head.appendChild(_s);
