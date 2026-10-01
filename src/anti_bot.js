import { config } from '../config.js';

/**
 * 지정된 시간(밀리초)만큼 대기
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 사람처럼 자연스러운 랜덤 지연(Human Jitter)을 부여하는 함수
 * 서버 부하 방지 및 봇 의심 회피 목적
 * @param {number} [minMs] - 최소 대기 시간 (기본값: config 설정)
 * @param {number} [maxMs] - 최대 대기 시간 (기본값: config 설정)
 * @param {string} [label] - 대기 사유 설명 (로그 출력용)
 */
export async function humanDelay(
  minMs = config.rateLimit.delayMin,
  maxMs = config.rateLimit.delayMax,
  label = ''
) {
  const min = Math.min(minMs, maxMs);
  const max = Math.max(minMs, maxMs);
  // min과 max 사이의 무작위 정수값 생성
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  const seconds = (delay / 1000).toFixed(1);

  if (label) {
    console.log(`   ⏳ [안전 지연] ${label} (${seconds}초 대기 중...)`);
  } else {
    console.log(`   ⏳ [안전 지연] 봇 탐지 방지 및 트래픽 보호를 위해 ${seconds}초 대기...`);
  }

  await sleep(delay);
}

/**
 * 과목 전환 또는 큰 작업 단위 전환 시 여유 있는 지연
 */
export async function courseSwitchDelay(courseName = '') {
  return humanDelay(
    config.rateLimit.courseSwitchMin,
    config.rateLimit.courseSwitchMax,
    courseName ? `다음 과목 [${courseName}] 진입 전 안전 대기` : '과목 전환 안전 대기'
  );
}

/**
 * 사람의 실제 브라우저와 동일한 환경을 갖추기 위한 Playwright Context 설정
 */
export function getStealthContextOptions() {
  return {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    permissions: ['geolocation', 'notifications'],
  };
}

/**
 * 웹드라이버(navigator.webdriver) 탐지 우회 스크립트 주입
 */
export async function applyStealthScripts(page) {
  await page.addInitScript(() => {
    // navigator.webdriver 속성 숨김
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // 플러그인 목록 흉내내기
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // 언어 설정 고정
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });
  });
}
