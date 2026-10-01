import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { config } from '../config.js';
import { dismissPopups } from './popup_defense.js';

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

export async function login() {
  console.log('====================================================');
  console.log(' [e-Class 인증 관리자] 최초 1회 로그인을 시작합니다.');
  console.log(` 접속 URL: ${config.eclassUrl}`);
  console.log('====================================================\n');

  const sessionDir = path.dirname(config.sessionPath);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // 사용자가 직접 보고 로그인할 수 있도록 창을 띄움
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
  });

  const page = await context.newPage();

  try {
    console.log('브라우저가 열렸습니다. e-Class 페이지로 이동합니다...');
    await page.goto(config.eclassUrl, { waitUntil: 'domcontentloaded', timeout: config.browser.timeout });

    // 초기 팝업 닫기 시도
    await dismissPopups(page);

    console.log('\n[안내] 열린 브라우저 창에서 로그인을 직접 완료해 주세요.');
    console.log('[안내] 로그인이 감지되면 자동으로 세션을 저장하고 브라우저가 닫힙니다.');
    console.log('[안내] (만약 자동 감지가 안 되면 터미널에서 [Enter] 키를 누르셔도 됩니다.)\n');

    // 1) 로그인 성공 감지: 로그아웃 버튼이나 사용자 정보가 화면에 나타나는지 폴링 감지
    const waitForLoginAuto = async () => {
      const loginIndicators = [
        'a[href*="logout"]',
        'a[href*="Logout"]',
        'button:has-text("로그아웃")',
        '.user-info',
        '.user_info',
        '#header .user',
        'a[href*="logout_form.acl"]'
      ];
      while (true) {
        for (const selector of loginIndicators) {
          try {
            const el = page.locator(selector);
            if (await el.isVisible().catch(() => false)) {
              console.log(`\n[감지] 로그인 성공 확인됨 (${selector})!`);
              return;
            }
          } catch (e) {}
        }
        await page.waitForTimeout(1000);
      }
    };

    // 2) 사용자의 수동 Enter 입력
    const waitForManualEnter = async () => {
      await askQuestion('==> 로그인 후 이곳에서 [Enter]를 누르셔도 됩니다. <==\n');
    };

    // 둘 중 먼저 일어나는 것으로 완료
    await Promise.race([waitForLoginAuto(), waitForManualEnter()]);

    // 약간 대기하여 쿠키/스토리지 안정화
    await page.waitForTimeout(1500);

    // 잔여 팝업 방어
    await dismissPopups(page);

    // 세션(쿠키, 로컬스토리지 등)을 storage_state.json으로 저장
    await context.storageState({ path: config.sessionPath });

    console.log('\n✅ [성공] 로그인 세션이 안전하게 저장되었습니다!');
    console.log(`저장 위치: ${config.sessionPath}`);
    console.log('이제 이후부터는 브라우저 화면 없이 백그라운드에서 자동 로그인됩니다.\n');

  } catch (error) {
    console.error('❌ [오류] 인증 중 문제가 발생했습니다:', error.message);
  } finally {
    await browser.close();
  }
}

// 직접 실행된 경우 실행
if (process.argv[1]?.endsWith('auth.js')) {
  login();
}
