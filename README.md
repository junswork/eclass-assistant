# 🎓 서울과기대 e-Class AI 심화 강의노트 생성기

> **e-Class Lecture Note Generator with Google Gemini 3.8 Flash**  
> 온라인 강의를 일일이 다시 돌려보지 않아도, **화면의 슬라이드 내용과 교수님의 음성 해설을 1:1로 완벽 대조 복원한 마크다운(`.md`) 심화 교재급 강의노트**를 자동으로 제작해 주는 스마트 학업 보조 도구입니다.

---

## 🌟 개발 배경 및 해결하고자 한 문제

대학교 온라인 강의는 영상 길이가 길고 슬라이드와 교수님의 구두 설명이 흩어져 있어, 시험 기간이나 복습 시 특정 개념을 빠르게 찾아 공부하기 어렵습니다.  
본 프로젝트는 **Playwright 브라우저 자동화**와 **Google Gemini 3.8 Flash의 긴 컨텍스트(Long Context) 추론 능력**을 결합하여, 강의 동영상의 타임스탬프별 슬라이드 내용과 교수님의 음성 자막(STT)을 정밀 대조한 **구조화된 심화 학습 노트**를 자동 빌드합니다.

---

## 🚀 핵심 기능

### 1. 화면 대조형 AI 심화 강의노트 제작 ("영상을 안 봐도 완벽한 노트")
- 영상의 각 타임스탬프 구간마다 **어떤 슬라이드/화면이 띄워져 있는지**를 파악합니다.
- 📄 **[화면/슬라이드 원문 핵심]** vs 🗣️ **[교수님 구두 심화 설명 & 팁]**을 1:1로 대조하여 복원합니다.
- 등장하는 모든 소스 코드와 LaTeX 수식, 도표 해석을 생략 없이 완벽히 수록합니다.
- 시험 빈출 포인트 및 실전 Q&A(3~5문항)를 함께 생성하여 시험 대비에 바로 활용할 수 있습니다.

### 2. 수강 과목 및 온라인 강의 메타데이터 자동 탐색
- 로그인 세션을 기반으로 이번 학기 수강 과목을 동적으로 인식합니다.
- 주차별 강의 목록과 자막(VTT) 제공 여부, 학습 진도율을 자동으로 파악하여 노트를 생성해야 할 대상을 큐(Queue)로 구축합니다.

### 3. 고성능 듀얼 모델 아키텍처 (Gemini 3.8 Flash / 3.5 Flash-Lite)
- 대용량 자막(최대 50,000자)과 정밀한 슬라이드 대조가 필요한 메인 분석에는 고성능 추론 모델인 **`gemini-3.8-flash`**를 기본 투입합니다.
- 호출 실패나 API 트래픽 문제 발생 시 초경량 모델인 **`gemini-3.5-flash-lite`**로 자동 폴백(Fallback)되어 끊김 없이 작업을 완수합니다.

### 4. 스마트폰 ntfy 실시간 완료 알림 (선택)
- 과목별 강의노트 제작이 완료될 때마다 스마트폰으로 실시간 푸시 알림을 수신합니다.

---

## 🛠️ 기술 스택

- **Runtime**: Node.js (ES Module)
- **Browser Automation**: Playwright (Chromium)
- **AI / LLM**: Google Gemini API (`gemini-3.8-flash`, `gemini-3.5-flash-lite`)
- **Notification**: ntfy (HTTP Push Protocol)

---

## 📦 빠른 시작 가이드

### 1. 사전 준비
- **Node.js** (v18 이상 권장)가 설치되어 있어야 합니다.

### 2. 패키지 설치
```bash
npm install
```
*(Playwright 브라우저 바이너리가 함께 자동 설치됩니다.)*

### 3. 환경 변수 설정 (`.env`)
폴더 안의 `.env` 파일을 열고 본인의 API 키를 입력합니다:

```ini
# Google Gemini API 키 (필수: 강의노트 생성용)
# 발급처: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_NOTE_MODEL=gemini-3.8-flash
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite

# ntfy 스마트폰 푸시 알림 설정 (선택 사항)
NTFY_TOPIC=eclass_my_unique_topic_1234
NTFY_SERVER=https://ntfy.sh

# 브라우저 실행 모드 (false: 화면 표시, true: 백그라운드)
HEADLESS=false
```

### 4. e-Class 1회 로그인 (세션 쿠키 저장)
```bash
npm run auth
```
1. 크롬 창이 열리면 서울과기대 e-Class 포털에 본인 계정으로 1회 로그인합니다.
2. 로그인이 완료되면 세션이 로컬(`session/storage_state.json`)에 안전하게 저장됩니다. (이후 자동 재사용)

### 5. 실행
```bash
npm start
```
*(또는 `npm run sync`)*

---

## 📁 생성된 강의노트 확인

생성된 강의노트는 본 폴더 내의 **`강의노트/`** 디렉토리에 과목별로 깔끔한 마크다운(`.md`) 파일로 자동 분류되어 저장됩니다:

```text
강의노트/
  ├── 컴퓨터비전/
  │     ├── 26_CV_L01_Image editing 1_심층_통합강의노트.md
  │     └── 26_CV_L02_Image Processing 1_심층_통합강의노트.md
  └── VR_AR/
        └── 09주차 1차시_심층_통합강의노트.md
```

또한 실시간 진행 현황은 `온라인강의_진행현황.md` 파일을 통해 실시간 테이블로 모니터링할 수 있습니다.

---

## 💡 라이선스 및 유의사항

- 본 도구는 학업 보조 및 복습 효율화를 위해 제작된 개인용 오픈소스 학습 도구입니다.
- 생성된 강의노트의 저작권 및 강의 내용의 권리는 각 교과목 담당 교수님께 있습니다.
