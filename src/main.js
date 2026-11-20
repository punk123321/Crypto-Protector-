import './style.css';

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <header class="topbar"><div class="brandmark">N</div><div><b>ONE-CLICK</b><small>AI NEWS STUDIO</small></div><span class="status">BETA</span></header>
    <section class="hero">
      <p class="eyebrow">AI-POWERED NEWS PRODUCTION</p>
      <h1>သတင်းဗီဒီယိုကို<br><em>တစ်ချက်နှိပ်ရုံနဲ့</em></h1>
      <p class="sub">သတင်းအကြောင်းအရာမှ မြန်မာဗီဒီယိုထုတ်လုပ်မှုအထိ တစ်နေရာတည်းမှာ စီမံပါ။</p>
    </section>
    <section class="panel">
      <label for="topic">သတင်းခေါင်းစဉ် / အကြောင်းအရာ</label>
      <textarea id="topic" placeholder="ဥပမာ - ဒီနေ့ နည်းပညာလောကရဲ့ အရေးကြီးသတင်းများ"></textarea>
      <div class="row"><label>ဗီဒီယိုအချိုး</label><span class="hint">ရွေးချယ်ပါ</span></div>
      <div class="ratios"><button class="ratio active" data-ratio="9:16"><b>▯</b><span>9:16</span><small>Shorts / Reels</small></button><button class="ratio" data-ratio="16:9"><b>▭</b><span>16:9</span><small>YouTube</small></button></div>
      <label for="duration">ဗီဒီယိုကြာချိန်</label>
      <select id="duration"><option value="60">၁ မိနစ်</option><option value="180" selected>၃ မိနစ်</option><option value="300">၅ မိနစ်</option><option value="600">၁၀ မိနစ်</option></select>
      <button id="start" class="primary">✦ &nbsp; AI နဲ့ စတင်ထုတ်လုပ်မယ်</button>
      <p id="message" class="message">လက်ရှိဗားရှင်းသည် အခြေခံ App UI ဖြစ်သည်။ AI ထုတ်လုပ်ရေးဝန်ဆောင်မှုများကို နောက်အဆင့်တွင် ချိတ်ဆက်ရပါမည်။</p>
    </section>
    <footer>ONE-CLICK AI NEWS STUDIO <span>•</span> BUILD 0.1</footer>
  </main>`;

let ratio = '9:16';
document.querySelectorAll('.ratio').forEach(btn => btn.addEventListener('click', () => {
  ratio = btn.dataset.ratio;
  document.querySelectorAll('.ratio').forEach(x => x.classList.toggle('active', x === btn));
}));
document.querySelector('#start').addEventListener('click', () => {
  const topic = document.querySelector('#topic').value.trim();
  const message = document.querySelector('#message');
  if (!topic) { message.textContent = 'သတင်းအကြောင်းအရာကို အရင်ဖြည့်ပါ။'; return; }
  message.textContent = `ရွေးချယ်ထားသည်: ${ratio} • ${document.querySelector('#duration').value} စက္ကန့်။ AI backend မချိတ်ဆက်ရသေးသောကြောင့် ဗီဒီယိုကို မထုတ်လုပ်နိုင်သေးပါ။`;
});
