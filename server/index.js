import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Parser from 'rss-parser';
import OpenAI from 'openai';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'outputs');
await fs.mkdir(outputDir, { recursive: true });
const app = express();
app.set('trust proxy', 1);
const parser = new Parser({ timeout: 15000 });
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/generate', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'တစ်နာရီအတွင်း ထုတ်လုပ်မှု ၅ ကြိမ်သာ ခွင့်ပြုထားပါသည်။ နောက်မှ ပြန်စမ်းပါ။' } }));
app.use('/outputs', express.static(outputDir));

const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const timestamp = (seconds) => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const milli = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${milli}`;
};

async function findNews(topic) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=my&gl=MM&ceid=MM:my`;
  const feed = await parser.parseURL(url);
  return (feed.items || []).slice(0, 8).map((item, index) => ({
    id: index + 1,
    title: clean(item.title, 300),
    link: item.link,
    source: clean(item.source?.title || item.creator || 'Google News RSS', 100),
    publishedAt: item.isoDate || item.pubDate || null,
    summary: clean(item.contentSnippet || item.content || '', 700)
  }));
}

function buildSrt(scenes, totalSeconds) {
  const usable = scenes.filter(s => clean(s.text, 500));
  const totalChars = usable.reduce((sum, s) => sum + [...s.text].length, 0) || 1;
  let elapsedChars = 0;
  return usable.map((scene, i) => {
    const start = totalSeconds * elapsedChars / totalChars;
    elapsedChars += [...scene.text].length;
    const end = i === usable.length - 1 ? totalSeconds : totalSeconds * elapsedChars / totalChars;
    return `${i + 1}\n${timestamp(start)} --> ${timestamp(end)}\n${scene.text}\n`;
  }).join('\n');
}

function splitNarration(text, maxChars = 3500) {
  const sentences = text.match(/[^။!?]+[။!?]?/gu) || [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if ([...sentence].length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = '';
      const chars = [...sentence];
      while (chars.length) chunks.push(chars.splice(0, maxChars).join(''));
      continue;
    }
    if ([...current + sentence].length > maxChars && current.trim()) {
      chunks.push(current.trim());
      current = sentence;
    } else current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function concatMp3Files(jobDir, files) {
  const outputPath = path.join(jobDir, 'narration.mp3');
  if (files.length === 1) await fs.rename(path.join(jobDir, files[0]), outputPath);
  else {
    const concatPath = path.join(jobDir, 'concat.txt');
    await fs.writeFile(concatPath, files.map(name => "file '" + name + "'").join('\n') + '\n', 'utf8');
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', outputPath], { cwd: jobDir, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; proc.stderr.on('data', c => { stderr += c.toString(); });
      proc.on('error', reject); proc.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1200))));
    });
  }
  return outputPath;
}
async function synthesizeAzure(narration, jobDir) {
  const key = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('Azure အသံထုတ်ရန် AZURE_SPEECH_KEY နဲ့ AZURE_SPEECH_REGION လိုအပ်ပါတယ်။');
  const voice = process.env.AZURE_SPEECH_VOICE || 'my-MM-NilarNeural', files = [];
  const chunks = splitNarration(narration, 4000);
  for (let i = 0; i < chunks.length; i++) {
    const escaped = chunks[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ssml = "<speak version='1.0' xml:lang='my-MM'><voice name='" + voice + "'>" + escaped + "</voice></speak>";
    const response = await fetch('https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1', {
      method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'One-Click-AI-News-Studio' }, body: ssml
    });
    if (!response.ok) throw new Error('Microsoft Azure TTS error (' + response.status + '): ' + (await response.text()).slice(0, 500));
    const name = 'narration-' + String(i + 1).padStart(3, '0') + '.mp3';
    await fs.writeFile(path.join(jobDir, name), Buffer.from(await response.arrayBuffer())); files.push(name);
  }
  return concatMp3Files(jobDir, files);
}
async function synthesizeOpenAI(narration, jobDir) {
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), files = [], chunks = splitNarration(narration);
  for (let i = 0; i < chunks.length; i++) {
    const speech = await ai.audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || 'tts-1', voice: process.env.OPENAI_TTS_VOICE || 'nova', input: chunks[i], response_format: 'mp3' });
    const name = 'narration-' + String(i + 1).padStart(3, '0') + '.mp3';
    await fs.writeFile(path.join(jobDir, name), Buffer.from(await speech.arrayBuffer())); files.push(name);
  }
  return concatMp3Files(jobDir, files);
}
async function synthesizeNarration(narration, jobDir) {
  const provider = (process.env.TTS_PROVIDER || (process.env.AZURE_SPEECH_KEY ? 'azure' : 'openai')).toLowerCase();
  if (provider === 'azure') return synthesizeAzure(narration, jobDir);
  if (provider === 'openai' && process.env.OPENAI_API_KEY) return synthesizeOpenAI(narration, jobDir);
  throw new Error('TTS Provider မသတ်မှတ်ရသေးပါ။ Azure သုံးရန် AZURE_SPEECH_KEY / AZURE_SPEECH_REGION ထည့်ပြီး TTS_PROVIDER=azure သတ်မှတ်ပါ။');
}
async function generateWithGemini(topic, duration, articles) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = 'တိကျမှုကို ဦးစားပေးသော မြန်မာသတင်းဗီဒီယို ထုတ်လုပ်သူအဖြစ် ပေးထားသော သတင်းများကိုသာ အခြေခံပါ။ မသေချာသောအချက်ကို အတည်ပြုမရေးပါနှင့်။ သဘာဝကျသော မြန်မာစကားပြောပုံစံဖြင့် JSON သာပြန်ပါ။ Schema: {"title":"...","summary":"...","narration":"...","scenes":[{"text":"subtitle sentence","visual_prompt":"English visual search description"}],"fact_check_notes":["..."]}. scenes 8 မှ 24 ခု။ ကြာချိန် ' + duration + ' စက္ကန့်။ Topic: ' + topic + '\nArticles: ' + JSON.stringify(articles);
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + process.env.GEMINI_API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.45, responseMimeType: 'application/json' } })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Gemini API error (' + response.status + '): ' + (data.error?.message || 'Unknown error'));
  const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
  return JSON.parse(raw);
}
async function generateWithOpenAI(topic, duration, articles) {
  const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await ai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.45, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'သင်သည် တိကျမှုကို ဦးစားပေးသော မြန်မာသတင်းဗီဒီယို ထုတ်လုပ်သူဖြစ်သည်။ ပေးထားသော ဆောင်းပါးများထဲက အချက်အလက်ကိုသာ သုံးပါ။ မသေချာသော အချက်ကို အတည်ပြုချက်အဖြစ် မရေးပါနှင့်။ မြန်မာစကားပြောသဘာဝကျကျ ရေးပါ။ JSON သာပြန်ပါ။ Schema: {"title":"...","summary":"...","narration":"...","scenes":[{"text":"subtitle sentence","visual_prompt":"English visual search description"}],"fact_check_notes":["..."]}. scenes ကို 8 မှ 24 ခုအတွင်းထားပါ။' },
      { role: 'user', content: JSON.stringify({ topic, targetDurationSeconds: duration, articles }) }
    ]
  });
  return JSON.parse(response.choices[0]?.message?.content || '{}');
}
async function transcribeWithAssemblyAI(audioPath) {
  const key = process.env.ASSEMBLYAI_API_KEY; if (!key) return null;
  const audio = await fs.readFile(audioPath);
  const upload = await fetch('https://api.assemblyai.com/v2/upload', { method: 'POST', headers: { authorization: key, 'content-type': 'application/octet-stream' }, body: audio });
  const uploaded = await upload.json();
  if (!upload.ok) throw new Error('AssemblyAI upload error: ' + (uploaded.error || upload.status));
  const submitted = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST', headers: { authorization: key, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: uploaded.upload_url, speech_model: 'universal-2', language_code: 'my', punctuate: true, format_text: true })
  });
  const job = await submitted.json();
  if (!submitted.ok) throw new Error('AssemblyAI transcription error: ' + (job.error || submitted.status));
  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const poll = await fetch('https://api.assemblyai.com/v2/transcript/' + job.id, { headers: { authorization: key } });
    const result = await poll.json();
    if (!poll.ok) throw new Error('AssemblyAI status error: ' + poll.status);
    if (result.status === 'completed') return result;
    if (result.status === 'error') throw new Error('AssemblyAI transcription failed: ' + result.error);
  }
  throw new Error('AssemblyAI transcription အချိန်ကျော်သွားပါတယ်။');
}
function buildTimedSrt(transcript, scenes, totalSeconds) {
  const words = transcript?.words || []; if (!words.length) return buildSrt(scenes, totalSeconds);
  const groups = []; let group = [];
  for (const word of words) {
    group.push(word);
    if (group.length >= 7 || /[။!?]$/.test(group.map(w => w.text).join(' '))) { groups.push(group); group = []; }
  }
  if (group.length) groups.push(group);
  return groups.map((cue, i) => {
    const start = Math.max(0, cue[0].start / 1000), end = Math.min(totalSeconds, Math.max(start + 0.25, cue[cue.length - 1].end / 1000));
    return (i + 1) + '\n' + timestamp(start) + ' --> ' + timestamp(end) + '\n' + cue.map(w => w.text).join(' ').trim() + '\n';
  }).join('\n');
}

async function getAudioDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath
  ]);
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('အသံဖိုင်ကြာချိန်ကို မဖတ်နိုင်ပါ။');
  return seconds;
}

async function makeVideo({ audioPath, srtPath, videoPath, ratio, seconds }) {
  const size = ratio === '16:9' ? '1920x1080' : '1080x1920';
  const subtitlePath = srtPath.replace(/\\\\/g, '/').replace(/:/g, '\\\\:').replace(/'/g, "\\\\'");
  const style = "FontName=Noto Sans Myanmar,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101010,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=90";
  const args = [
    '-y', '-f', 'lavfi', '-i', `color=c=0x10182b:s=${size}:r=30:d=${seconds}`,
    '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-vf',
    `subtitles='${subtitlePath}':force_style='${style}'`,
    '-shortest', videoPath
  ];
  await new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    process.stderr.on('data', chunk => { stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1800) || `FFmpeg exited with code ${code}`)));
  });
}

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  service: 'One-Click AI News Studio API',
  aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
  ttsConfigured: Boolean((process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) || process.env.OPENAI_API_KEY),
  providers: { gemini: Boolean(process.env.GEMINI_API_KEY), assemblyAI: Boolean(process.env.ASSEMBLYAI_API_KEY), microsoftAzure: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) },
  ffmpegConfigured: true
}));

app.post('/api/generate', async (req, res) => {
  const topic = clean(req.body?.topic, 300);
  const ratio = req.body?.ratio === '16:9' ? '16:9' : '9:16';
  const duration = Math.min(600, Math.max(30, Number(req.body?.duration) || 180));
  if (!topic) return res.status(400).json({ error: 'သတင်းအကြောင်းအရာကို ဖြည့်ပေးပါ။' });
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) return res.status(503).json({
    error: 'GEMINI_API_KEY (သို့) OPENAI_API_KEY တစ်ခုခုကို Backend Environment ထဲမှာ ထည့်ပါ။',
    needsSetup: true
  });

  const id = randomUUID();
  const jobDir = path.join(outputDir, id);
  await fs.mkdir(jobDir, { recursive: true });
  try {
    const articles = await findNews(topic);
    if (!articles.length) throw new Error('သက်ဆိုင်ရာ သတင်းရင်းမြစ် မတွေ့ပါ။ အကြောင်းအရာကို ပြောင်းပြီး ထပ်စမ်းပါ။');
    const script = process.env.GEMINI_API_KEY
      ? await generateWithGemini(topic, duration, articles)
      : await generateWithOpenAI(topic, duration, articles);
    if (!script.narration || !Array.isArray(script.scenes) || !script.scenes.length) {
      throw new Error('AI က အသုံးပြုနိုင်တဲ့ Script မထုတ်ပေးနိုင်ပါ။ ထပ်စမ်းပါ။');
    }
    const audioPath = await synthesizeNarration(script.narration, jobDir);
    const actualSeconds = await getAudioDuration(audioPath);
    const renderSeconds = Math.min(actualSeconds, duration + 15);
    const transcript = process.env.ASSEMBLYAI_API_KEY ? await transcribeWithAssemblyAI(audioPath) : null;
    const srt = buildTimedSrt(transcript, script.scenes, renderSeconds);
    const srtPath = path.join(jobDir, 'subtitles.srt');
    await fs.writeFile(srtPath, srt, 'utf8');
    const videoPath = path.join(jobDir, 'news-video.mp4');
    await makeVideo({ audioPath, srtPath, videoPath, ratio, seconds: renderSeconds });
    const base = `${req.protocol}://${req.get('host')}/outputs/${id}`;
    res.json({
      id, title: script.title || topic, summary: script.summary || '',
      scenes: script.scenes, factCheckNotes: script.fact_check_notes || [],
      sources: articles.map(({ title, link, source, publishedAt }) => ({ title, link, source, publishedAt })),
      durationSeconds: renderSeconds, ratio,
      narrationUrl: `${base}/narration.mp3`,
      subtitleUrl: `${base}/subtitles.srt`,
      videoUrl: `${base}/news-video.mp4`
    });
  } catch (error) {
    console.error('Generation failed:', error);
    res.status(500).json({ error: error.message || 'ဗီဒီယိုထုတ်လုပ်ရာတွင် အမှားဖြစ်နေပါသည်။' });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`One-Click AI News Studio API listening on ${port}`));
