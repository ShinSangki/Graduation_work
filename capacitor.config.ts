import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor initial setup:
// npm i @capacitor/core @capacitor/filesystem capacitor-voice-recorder
// npm i -D @capacitor/cli
// npx cap init
// npm i @capacitor/android
// npx cap add android
// npm run build
// npx cap sync android

// Capacitor를 사용하여 웹 앱을 네이티브 모바일 앱으로 빌드하기 위한 환경을 설정합니다.
const config: CapacitorConfig = {
  appId: "com.memorybook.app",
  appName: "기억책",
  webDir: "dist",
};

export default config;
