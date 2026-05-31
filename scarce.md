# 기억책 프로젝트 개발 현황

## 프로젝트 개요

- React + TypeScript + Vite 기반 Capacitor 모바일 앱.
- Android 네이티브 환경에서는 `@capacitor-community/sqlite`로 기기 내부 SQLite를 사용함.
- 브라우저 환경에서는 자서전 완성본을 `localStorage`에 저장함.
- Node.js + Express 서버는 음성 STT와 Gemini 자서전 생성을 담당하는 프록시임.

## 현재 동작 흐름

### 기존 음성 기반 자서전 생성

1. 사용자가 시기와 장소를 선택함.
2. 음성을 녹음하고 기기 파일로 저장함.
3. `/api/generate`에 음성을 업로드함.
4. 서버가 WAV 변환, STT, Gemini 생성을 수행함.
5. 미리보기 후 읽기를 누르면 완성본을 로컬 DB에 저장함.
6. 보관함에서 조회, 수정, 삭제할 수 있음.

### 신규 STT 텍스트 기반 에피소드 생성

1. UI 또는 STT 엔진이 `sttRawText`를 전달함.
2. `useEpisodeGenerationController()`가 로딩 상태를 활성화함.
3. `/api/generate-from-text`로 원문을 보내 Gemini JSON을 생성함.
4. 성공 결과와 원문을 `saveEpisode()`로 SQLite에 저장함.
5. 저장 후 `getAllEpisodes()`를 호출해 최신 목록을 갱신함.
6. 실패하면 `error` 상태에 사용자 메시지를 저장함.

### 발표용 데모 화면

- `EpisodeDemoScreen.tsx`를 기본 진입 화면으로 연결함.
- STT 원문, 로컬 저장 메타데이터, 최종 자서전 본문을 한 화면에 표시함.
- Android 앱에서는 SQLite를 사용함.
- 브라우저 시연에서는 `localStorage fallback`을 사용하고 화면에도 이를 표시함.

## SQLite 구조

### 완성 자서전

- `recordings`: 원본 녹음 파일 정보.
- `memoirs`: 자서전 기본 정보.
- `memoir_chapters`: 자서전 장.
- `memoir_sections`: 장 내부 섹션과 본문.

### 생성 에피소드 원본

- `autobiography_episode`: STT 원문, Gemini 결과 JSON, 모델 정보, 통계값 저장.
- `episode_id`에 `UNIQUE` 제약조건 적용.
- 길이와 압축률에 음수 방지 `CHECK` 적용.
- `created_at`은 `TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- 최신순 조회를 위한 `idx_autobiography_episode_created_at` 인덱스 추가.
- `tags` 배열은 요구사항에 따라 쉼표 구분 문자열로 저장함.

## 이번 작업 결과

1. `src/db/schema.ts`에 `autobiography_episode` 테이블과 인덱스를 추가함.
2. `src/db/autobiographyEpisodeDAO.ts`를 추가함.
3. DAO에 `initDatabase()`, `saveEpisode()`, `getAllEpisodes()`를 구현함.
4. SQL 인서트는 파라미터 바인딩을 사용함.
5. `server/index.js`에 `POST /api/generate-from-text`를 추가함.
6. `src/services/api.ts`에 `generateEpisodeFromText()`를 추가함.
7. `src/hooks/useEpisodeGenerationController.ts`를 추가함.
8. 누락된 `BiographyBook`, `BiographySection`, `ReaderPage` 메타데이터 타입을 보완함.
9. `npm run build`, `node --check server/index.js` 검증을 통과함.
10. Gemini 에피소드 전용 프롬프트와 JSON 응답 검증을 추가함.
11. 기본 모델을 `gemini-2.5-flash`로 변경함.
12. 실제 Google AI Studio API 호출과 Vite 페이지 접속을 확인함.
13. 최소 STT 입력 길이를 `200자`로 설정함.
14. 입력 길이에 따라 본문 목표 길이를 동적으로 계산하도록 개선함.
15. Gemini 응답 앞뒤에 불필요한 텍스트가 붙어도 JSON 객체를 추출하도록 파서를 보강함.
16. `thinkingBudget: 0`을 적용해 불필요한 사고 토큰 비용을 제거함.
17. API 응답에 호출 횟수와 토큰 사용량 메타데이터를 추가함.

## Gemini 압축 정책

| STT 원문 길이 | 본문 목표 길이 |
|---|---|
| `200~500자` | 원문 길이 이하 |
| `501~1,250자` | 원문의 약 `60%` |
| `1,251자 이상` | 약 `500자` |

- `200자` 미만 입력은 명확한 오류 메시지와 함께 거부함.
- 목표 길이를 초과하면 핵심 사실만 남기도록 Gemini에 한 번 재요청함.
- 최대 출력은 호출당 `3,000 tokens`로 제한함.

## 실제 호출 검증

### 최소 길이 근접 테스트

- 입력: `235자`
- 출력: `220자`
- 압축률: `6%`
- 결과: 성공, `compression_target_met: true`

### 장문 비용 테스트

- 모델: `gemini-2.5-flash`
- 입력: `2,500자`
- 출력: `708자`
- 압축률: `72%`
- API 호출: `2회`
- 입력 토큰: `3,592`
- 출력 토큰: `943`
- 사고 토큰: `0`
- 총 토큰: `4,535`
- 예상 비용: 약 `5.2원`
- Google AI Studio 표시 비용이 기존 `63원`에서 `69원`으로 증가함. 정상 범위임.
- 목표 `500자`에는 아직 도달하지 못했으므로 추가 축약 보완이 필요함.

## 남은 작업

### P0: API 키 관리

- API 키는 코드가 아닌 `.env`에 저장하고 `process.env.GEMINI_API_KEY`로 읽음.
- `.gitignore`에 `.env`를 추가함.
- 대화에 노출된 키는 Google AI Studio에서 교체해야 함.

### P1: 데이터 정책 정리

- 완성 자서전 테이블과 에피소드 원본 테이블의 연결 키가 아직 없음.
- 필요하면 `memoirs`에 `episode_id` 외래키 또는 연결 테이블을 추가해야 함.
- 태그 검색이 중요해지면 쉼표 문자열 대신 별도 태그 테이블로 분리해야 함.
- `llm_model`은 서버가 실제 호출 모델명인 `gemini-2.5-flash`를 반환하고 DB에 저장함.

### P2: 안정성 및 테스트

- SQLite 버전별 마이그레이션 체계가 아직 없음.
- 에피소드 중복 저장, API 실패, DB 실패에 대한 자동 테스트가 없음.
- 네이티브 SQLite와 브라우저 fallback 동작을 각각 검증해야 함.
