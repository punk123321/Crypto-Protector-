# One-Click AI News Studio

Android/Web starter for creating Burmese news videos in 9:16 and 16:9.

## Current scope
- Responsive web app shell with topic input and 9:16 / 16:9 selection.
- GitHub Actions workflow builds a debug Android APK using Capacitor.
- This is the initial app scaffold, not yet the complete AI news-to-video pipeline. AI news research, Burmese TTS, media licensing/download, subtitle timing and FFmpeg rendering still need implementation and API credentials.

## Build APK
Push to `main` or run **Build Android APK** from the Actions tab. Download the `app-debug-apk` artifact from a successful run.

## Run web app
```bash
npm install
npm run dev
```

Repository name is retained as supplied; app display name is One-Click AI News Studio.
