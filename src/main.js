import './style.css';

const trimSlash = (value) => value.endsWith('/') ? value.slice(0, -1) : value;
let API_BASE = trimSlash(import.meta.env.VITE_API_BASE_URL || localStorage.getItem('newsStudioApiBase') || '');
const app = document.querySelector('#app');
app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brandmark">N</div>
      <div class="brand"><b>ONE-CLICK</b><small>AI NEWS STUDIO</small></div>
      <span class="status" id="api-status">API စစ်ဆေးနေသည်</span>
    </header>
    <section class="hero">
      <p class="eyebrow">AI NEWSROOM • SCRIPT • VOICE • VIDEO</p>
      <h1>သတင်းဗီဒီယိုကို<br><em>တစ်ချက်နှိပ်ရုံနဲ့</em></h1>
      <p class="sub">သတင်းရင်းမြစ်ရှာဖွေခြင်း၊ မြန်မာ Script၊ AI အသံ၊ Subtitle နဲ့ MP4 ဗီဒီယိုကို တစ်နေရာတည်းမှာ ထုတ်လုပ်ပါ။</p>
    </section>
    <section class="panel">
      <div class="panel-head"><div><span class="step">01 / CREATE</span><h2>ဗီဒီယိုအသစ် ဖန်တီးမယ်</h2></div><span class="spark">✦ AI</span></div>
      <label for="topic">သတင်းခေါင်းစဉ် / အကြောင်းအရာ</label>
      <textarea id="topic" placeholder="ဥပမာ - ဒီနေ့ နည်းပညာလောကရဲ့ အရေးကြီးသတင်းများ"></textarea>
      <div class="row"><label>ဗီဒီယိုအချိုး</label><span class="hint">Platform အလိုက်ရွေးပါ</span></div>
      <div class="ratios">
        <button class="ratio active" data-ratio="9:16"><b>▯</b><span>9:16</span><small>YouTube Shorts / Reels</small></button>
        <button class="ratio" data-ratio="16:9"><b>▭</b><span>16:9</span><small>YouTube / Facebook</small></button>
      </div>
      <label for="duration">ဗီဒီယိုကြာချိန်</label>
      <select id="duration"><option value="60">၁ မိနစ်</option><option value="180" selected>၃ မိနစ်</option><option value="300">၅ မိနစ်</option><option value="600">၁၀ မိနစ်</option></select>
      <button id="start" class="primary"><span>✦</span> AI နဲ့ ဗီဒီယို စတင်ထုတ်လုပ်မယ်</button>
      <div id="progress" class="progress hidden"><div class="spinner"></div><div><b>AI Newsroom အလုပ်လုပ်နေသည်</b><small>သတင်းရှာဖွေခြင်း → Script → Voice → Subtitle → MP4</small></div></div>
      <p id="message" class="message">စတင်ရန် Backend API လိုအပ်သည်။ API မချိတ်ဆက်ရသေးပါက အောက်ပါ Setup လမ်းညွှန်ကို ကြည့်ပါ။</p>
    </section>
    <section id="result" class="result hidden">
      <div class="result-head"><div><span class="step">02 / YOUR VIDEO</span><h2 id="result-title">ထုတ်လုပ်ပြီးပါပြီ</h2></div><span class="complete">READY</span></div>
      <p id="result-summary" class="summary"></p>
      <div class="downloads"><a id="video-link" class="download primary-link" download>MP4 ဗီဒီယို <b>↓</b></a><a id="srt-link" class="download" download>Subtitle SRT ↓</a><a id="audio-link" class="download" download>Voice MP3 ↓</a></div>
      <h3>သတင်းရင်းမြစ်များ</h3><ul id="sources" class="sources"></ul>
      <h3>အချက်အလက် စစ်ဆေးရန်</h3><ul id="notes" class="notes"></ul>
    </section>
    <section class="setup">
      <span class="step">SETUP GUIDE</span><h2>Backend ချိတ်ဆက်ရန်</h2>
      <p>ဒီ App က သတင်းရှာဖွေခြင်းနဲ့ ဗီဒီယို Render လုပ်ဖို့ Backend Server လိုအပ်ပါတယ်။ Server ကို Docker ဖြင့် Deploy လုပ်ပြီး VITE_API_BASE_URL ထည့်ပေးပါ။ Gemini၊ AssemblyAI၊ Microsoft Azure API Key များကို Backend Environment ထဲမှာသာ ထည့်ပါ။ APK / Browser ထဲမှာ API Key မထည့်ပါနှင့်။</p>
      <div class="api-config"><label for="api-url">Backend Server URL</label><input id="api-url" type="url" placeholder="https://your-api-server.com"><button id="save-api" type="button">Server ချိတ်ဆက်မယ်</button></div>
      <a href="https://github.com/punk123321/Crypto-Protector-" target="_blank" rel="noreferrer">GitHub Project ကိုကြည့်ရန် ↗</a>
    </section>
    <footer>ONE-CLICK AI NEWS STUDIO <span>•</span> AI PRODUCTION WORKSPACE</footer>
  </main>`;

let ratio = '9:16';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
document.querySelectorAll('.ratio').forEach(btn => btn.addEventListener('click', () => {
  ratio = btn.dataset.ratio;
  document.querySelectorAll('.ratio').forEach(x => x.classList.toggle('active', x === btn));
}));

async function checkApi() {
  try {
    const response = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    $('#api-status').textContent = data.aiConfigured ? 'AI ချိတ်ဆက်ပြီး' : 'Gemini API Key လိုအပ်';
    $('#api-status').classList.toggle('online', Boolean(data.aiConfigured));
    $('#message').textContent = data.aiConfigured
      ? 'အဆင်သင့်ဖြစ်ပါပြီ။ သတင်းခေါင်းစဉ်ထည့်ပြီး စတင်နိုင်ပါပြီ။'
      : 'Backend ရှိနေပါပြီ။ Gemini သို့မဟုတ် OpenAI API Key ကို Server Environment ထဲတွင် ထည့်ပါ။';
  } catch {
    $('#api-status').textContent = 'API မချိတ်ဆက်ရသေး';
    $('#api-status').classList.remove('online');
  }
}

$('#start').addEventListener('click', async () => {
  const topic = $('#topic').value.trim();
  if (!topic) { $('#message').textContent = 'သတင်းအကြောင်းအရာကို အရင်ဖြည့်ပါ။'; $('#topic').focus(); return; }
  $('#start').disabled = true;
  $('#progress').classList.remove('hidden');
  $('#result').classList.add('hidden');
  $('#message').textContent = 'သတင်းအချက်အလက်နဲ့ ဗီဒီယိုကို ပြင်ဆင်နေပါတယ်။ ကြာချိန်အနည်းငယ်ရှိနိုင်ပါတယ်။';
  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, ratio, duration: Number($('#duration').value) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ထုတ်လုပ်မှု မအောင်မြင်ပါ။');
    $('#result-title').textContent = data.title || topic;
    $('#result-summary').textContent = data.summary || '';
    $('#video-link').href = data.videoUrl;
    $('#srt-link').href = data.subtitleUrl;
    $('#audio-link').href = data.narrationUrl;
    $('#sources').innerHTML = (data.sources || []).map(s => `<li><a href="${escapeHtml(s.link)}" target="_blank" rel="noreferrer">${escapeHtml(s.title)}</a><small>${escapeHtml(s.source)} · ${escapeHtml(s.publishedAt || '')}</small></li>`).join('');
    $('#notes').innerHTML = (data.factCheckNotes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('') || '<li>ထုတ်လုပ်ထားသော အချက်အလက်များကို မူရင်းသတင်းနှင့် ထပ်မံစစ်ဆေးပါ။</li>';
    $('#result').classList.remove('hidden');
    $('#message').textContent = 'ဗီဒီယိုထုတ်လုပ်မှု ပြီးဆုံးပါပြီ။ မထုတ်လွှင့်မီ အကြောင်းအရာနှင့် အသံကို ပြန်စစ်ပါ။';
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    $('#message').textContent = error.message || 'Server နှင့် ဆက်သွယ်ရာတွင် အမှားဖြစ်နေပါသည်။';
  } finally {
    $('#progress').classList.add('hidden');
    $('#start').disabled = false;
  }
});

$('#api-url').value = API_BASE;
$('#save-api').addEventListener('click', () => {
  API_BASE = trimSlash($('#api-url').value.trim());
  localStorage.setItem('newsStudioApiBase', API_BASE);
  checkApi();
});

checkApi();
