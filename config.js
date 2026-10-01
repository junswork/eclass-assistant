import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 어느 폴더에서 실행해도 이 도구 폴더의 .env를 읽도록 경로 고정
dotenv.config({ path: path.join(__dirname, '.env') });

export const config = {
  // 학교 e-Class 기본 URL
  eclassUrl: process.env.ECLASS_URL || 'https://eclass.seoultech.ac.kr/ilos/main/main_form.acl',

  // 강의노트 저장 루트 디렉토리 (기본값: 도구 폴더 내 '강의노트')
  notesOutputDir: process.env.NOTES_OUTPUT_DIR || path.resolve(__dirname, '강의노트'),

  // 세션 저장 파일 경로
  sessionPath: path.resolve(__dirname, 'session', 'storage_state.json'),

  // 브라우저 설정 (출석 진행을 보고 싶다면 HEADLESS=false, 백그라운드는 true)
  browser: {
    headless: process.env.HEADLESS === 'true',
    timeout: 30000,
  },

  // 트래픽 보호 및 봇 감지 방지 지연 설정 (ms)
  rateLimit: {
    delayMin: parseInt(process.env.RATE_LIMIT_DELAY_MIN || '1500', 10),
    delayMax: parseInt(process.env.RATE_LIMIT_DELAY_MAX || '3500', 10),
    courseSwitchMin: parseInt(process.env.COURSE_SWITCH_DELAY_MIN || '2500', 10),
    courseSwitchMax: parseInt(process.env.COURSE_SWITCH_DELAY_MAX || '5000', 10),
  },

  // Gemini API 설정 (심층 강의노트 생성용)
  ai: {
    modelName: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    noteModelName: process.env.GEMINI_NOTE_MODEL || 'gemini-3.8-flash',
    fallbackModelName: process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite',
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  },

  // ntfy 알림 설정 (출석 완료 및 강의노트 생성 알림)
  ntfy: {
    server: process.env.NTFY_SERVER || 'https://ntfy.sh',
    token: process.env.NTFY_TOKEN || '',
    topic: process.env.NTFY_TOPIC || '',
  }
};
