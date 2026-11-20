# One-Click AI News Studio

Android/Web app for creating Burmese news videos in 9:16 and 16:9.

## AI providers
- **Google Gemini** writes Burmese news scripts, narration text, scenes and fact-check notes. Configure `GEMINI_API_KEY`.
- **AssemblyAI** transcribes generated Burmese narration with Universal-2 (`language_code: my`) and supplies word timestamps for SRT subtitles. Configure `ASSEMBLYAI_API_KEY`.
- **Microsoft Azure AI Speech** generates Burmese narration. Configure `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and optionally `AZURE_SPEECH_VOICE`. Burmese voices include `my-MM-NilarNeural` and `my-MM-ThihaNeural`.
- OpenAI remains an optional legacy fallback. Gemini is preferred when configured.

Store all secrets only in backend environment variables, never in the APK or browser. Copy `.env.example` to `.env` for local setup. Provider quotas, limits and charges depend on each provider's plan.

## Pipeline
Google News RSS -> Gemini script -> Azure Burmese voice -> optional AssemblyAI word-timed transcript -> SRT -> FFmpeg MP4.

If AssemblyAI is not configured, subtitles use estimated scene timing. If Azure is not configured, set `TTS_PROVIDER=openai` and configure the legacy OpenAI key.

## Run locally
```bash
npm install
npm run dev
npm start
```
Backend requires FFmpeg. Deploy the backend separately and set `VITE_API_BASE_URL` at build time or configure the API URL in the app.

## Android APK
Push to `main` or run **Build Android APK** in GitHub Actions. Download `app-debug-apk` from a successful run. This is a debug APK, not a signed Play Store release.

## Current limitations
The renderer still uses a branded background and subtitles. Scene-specific licensed footage, image sourcing, music controls and advanced transitions remain to be implemented and tested.
