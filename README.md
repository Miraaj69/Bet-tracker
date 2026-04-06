# 🏆 BetTracker Pro

Personal betting tracker app — Cricket, Football & Tennis ke liye.

## ✨ Features
- Dashboard with live P&L
- Full bet management (add/edit/delete/duplicate)
- Stats, Charts, Calendar view
- Bankroll management + Kelly Criterion
- Multi-bookie tracking
- CSV & Report export
- 3 Themes: AMOLED / Dark / Light
- PWA — Phone pe install kar sakte ho
- Android APK support (Capacitor)

---

## 🚀 Quick Start (Browser mein chalao)

```bash
# 1. Dependencies install karo
npm install

# 2. Dev server start karo
npm run dev

# Browser mein khulega: http://localhost:3000
```

---

## 📱 Phone pe Install karo (PWA — No APK needed)

1. `npm run build` karo
2. `npm run preview` karo ya server pe deploy karo
3. Chrome mein open karo → Address bar mein **"Install"** button click karo
4. Done! App icon home screen pe aa jayega ✅

---

## 🤖 Android APK banana (Capacitor)

### Prerequisites
- Node.js 18+
- Android Studio installed hona chahiye
- Java 17+ (Android Studio ke saath aata hai)

### Steps

```bash
# 1. Build the web app
npm run build

# 2. Capacitor install (pehli baar)
npm install

# 3. Android platform add karo (pehli baar)
npx cap add android

# 4. Sync karo
npx cap sync android

# 5. Android Studio mein open karo
npx cap open android

# Android Studio mein:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
# APK milegi: android/app/build/outputs/apk/debug/app-debug.apk
```

### Direct APK (Command line se)
```bash
npm run apk:debug
# APK milegi: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📦 EAS Build (eas.json — Cloud APK)

Agar Expo EAS use karna ho (cloud pe APK build):

```bash
# EAS CLI install karo
npm install -g eas-cli

# Login karo
eas login

# Preview APK build karo (sharable link milega)
eas build --profile preview --platform android

# Development APK
eas build --profile development --platform android
```

---

## 📁 Project Structure

```
bet-tracker/
├── src/
│   ├── App.jsx          ← Poora app yahan hai
│   └── main.jsx         ← React mount point
├── public/
│   ├── icon-192.png     ← PWA icon (add karo)
│   ├── icon-512.png     ← PWA icon large (add karo)
│   └── apple-touch-icon.png
├── index.html           ← HTML entry point
├── vite.config.js       ← Build config + PWA
├── capacitor.config.json ← Android APK config
├── eas.json             ← EAS cloud build config
├── package.json         ← Dependencies
└── .gitignore
```

---

## 🔑 App Details

| Field | Value |
|-------|-------|
| App ID | `com.bettracker.pro` |
| Version | `1.0.0` |
| Min Android | API 22 (Android 5.1+) |
| Target Android | API 34 (Android 14) |

---

## 💡 GitHub pe push karna

```bash
git init
git add .
git commit -m "Initial commit — BetTracker Pro"
git branch -M main
git remote add origin https://github.com/Miraaj69/Bet-tracker.git
git push -u origin main
```

---

Made with ❤️ — Track smart, bet smart 🏆
