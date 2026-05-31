# 기억책 프로젝트 파일 구조

```text
project/
├─ index.html
├─ package.json
├─ package-lock.json
├─ README.md
├─ scarce.md
├─ tree.md
├─ tsconfig.json
├─ tsconfig.node.json
├─ tsconfig.tsbuildinfo
├─ tsconfig.node.tsbuildinfo
├─ vite.config.ts
├─ vite.config.js
├─ vite.config.d.ts
├─ capacitor.config.ts
├─ android/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ vite-env.d.ts
│  ├─ components/
│  │  ├─ HomeScreen.tsx
│  │  ├─ PreRecordSetupScreen.tsx
│  │  ├─ RecordScreen.tsx
│  │  ├─ GenerateProgressScreen.tsx
│  │  ├─ LibraryScreen.tsx
│  │  ├─ BiographyPreview.tsx
│  │  ├─ BiographyReaderScreen.tsx
│  │  ├─ BiographyEditorScreen.tsx
│  │  ├─ EpisodeDemoScreen.tsx
│  │  └─ reader/
│  │     ├─ BiographyReader.tsx
│  │     ├─ BookCover.tsx
│  │     ├─ BookPage.tsx
│  │     ├─ TableOfContents.tsx
│  │     ├─ PageNavigation.tsx
│  │     ├─ FontSizeControl.tsx
│  │     └─ TTSControl.tsx
│  ├─ data/
│  │  └─ sampleBiography.ts
│  ├─ db/
│  │  ├─ autobiographyEpisodeDAO.ts
│  │  ├─ database.ts
│  │  └─ schema.ts
│  ├─ hooks/
│  │  ├─ useAudioRecorder.ts
│  │  ├─ useEpisodeGenerationController.ts
│  │  └─ useMemoirDB.ts
│  ├─ services/
│  │  └─ api.ts
│  └─ styles/
│     ├─ app.css
│     └─ reader.css
├─ server/
│  ├─ index.js
│  ├─ gemini.js
│  ├─ ffmpeg.js
│  ├─ converted/
│  └─ uploads/
├─ dist/
└─ node_modules/
```

## 파일 역할

### 루트

| 파일 | 역할 |
|---|---|
| `index.html` | Vite 앱 진입 HTML |
| `package.json` | 의존성 및 실행 스크립트 |
| `package-lock.json` | npm 의존성 버전 고정 |
| `README.md` | 프로젝트 기본 설명 |
| `scarce.md` | 구현 현황, 개발 경과, 개선 과제 |
| `tree.md` | 전체 파일 구조 문서 |
| `tsconfig.json` | 프론트 TypeScript 설정 |
| `tsconfig.node.json` | Vite 설정용 TypeScript 설정 |
| `tsconfig.*.tsbuildinfo` | TypeScript 증분 빌드 캐시 |
| `vite.config.ts` | Vite 원본 설정 |
| `vite.config.js` | 컴파일된 Vite 설정 |
| `vite.config.d.ts` | Vite 설정 타입 선언 |
| `capacitor.config.ts` | Capacitor Android 앱 설정 |
| `android/` | Capacitor가 생성한 Android 네이티브 프로젝트 |

### 프론트엔드

| 파일 | 역할 |
|---|---|
| `src/main.tsx` | React 앱 마운트 |
| `src/App.tsx` | 발표용 에피소드 데모 기본 진입점, 기존 앱 흐름 보존 |
| `src/vite-env.d.ts` | Vite 환경 타입 선언 |
| `src/services/api.ts` | 백엔드에 오디오 또는 STT 텍스트를 보내 AI 자서전 생성 요청 |
| `src/data/sampleBiography.ts` | 자서전 타입, 샘플 데이터, 리더 페이지 변환 |
| `src/db/schema.ts` | 기기 내부 SQLite 테이블 생성 SQL |
| `src/db/database.ts` | Capacitor SQLite 연결, 실행, 조회, 트랜잭션 유틸 |
| `src/db/autobiographyEpisodeDAO.ts` | STT 기반 생성 에피소드 초기화, 저장, 최신순 조회 DAO |
| `src/hooks/useAudioRecorder.ts` | 네이티브 녹음 및 기기 파일 저장 |
| `src/hooks/useMemoirDB.ts` | 자서전 로컬 저장, 목록, 상세, 삭제 CRUD 훅 |
| `src/hooks/useEpisodeGenerationController.ts` | STT 텍스트 Gemini 호출, SQLite 저장, 목록 갱신, 오류 상태 처리 |
| `src/styles/app.css` | 공통 화면, 버튼, 패널 스타일 |
| `src/styles/reader.css` | 리더 전용 스타일 |

### 주요 화면

| 파일 | 역할 |
|---|---|
| `HomeScreen.tsx` | 홈 화면, 최근 자서전 조회, 녹음 및 보관함 이동 |
| `PreRecordSetupScreen.tsx` | 녹음 전 시기와 장소 선택 |
| `RecordScreen.tsx` | 마이크 녹음, 미리 듣기, 업로드 |
| `GenerateProgressScreen.tsx` | STT 및 자서전 생성 진행 상태 |
| `LibraryScreen.tsx` | 자서전 목록, 미리보기, 읽기, 삭제 |
| `BiographyPreview.tsx` | 자서전 요약 미리보기 |
| `BiographyReaderScreen.tsx` | 자서전 읽기, 페이지 이동, TTS, 수정 진입 |
| `BiographyEditorScreen.tsx` | 제목, 메타데이터, 본문 수정, 원본 음성 재생 |
| `EpisodeDemoScreen.tsx` | STT 원문, 저장 메타데이터, 생성 자서전을 2분할로 표시하는 발표 화면 |

### 이전 리더 컴포넌트

| 파일 | 역할 |
|---|---|
| `reader/BiographyReader.tsx` | 분리형 리더 컨테이너 |
| `reader/BookCover.tsx` | 표지 UI |
| `reader/BookPage.tsx` | 본문 페이지 UI |
| `reader/TableOfContents.tsx` | 목차 UI |
| `reader/PageNavigation.tsx` | 페이지 이동 UI |
| `reader/FontSizeControl.tsx` | 글자 크기 조절 UI |
| `reader/TTSControl.tsx` | TTS 제어 UI |

### 백엔드

| 파일 | 역할 |
|---|---|
| `server/index.js` | Express AI proxy, 음성 생성 API와 STT 텍스트 생성 API 제공 |
| `server/gemini.js` | STT, Gemini 호출 함수, 자서전 생성 프롬프트 |
| `server/ffmpeg.js` | 업로드 음성을 WAV로 변환 |
| `server/converted/` | 요청 처리 중 사용하는 임시 WAV 폴더. 처리 후 삭제 |
| `server/uploads/` | 요청 처리 중 사용하는 임시 원본 음성 폴더. 처리 후 삭제 |

### 자동 생성 폴더

| 폴더 | 역할 |
|---|---|
| `dist/` | Vite 프로덕션 빌드 결과 |
| `node_modules/` | npm 설치 패키지 |
