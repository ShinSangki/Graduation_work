import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite 기반의 React 프로젝트 빌드 및 개발 서버 환경을 설정합니다.
export default defineConfig({
  plugins: [react()],
});
