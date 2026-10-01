/**
 * 팝업 및 공지 모달 자동 방어 모듈 (Playwright + Stagehand AI Hybrid)
 */

export async function dismissPopups(page, stagehand = null) {
  console.log('[방어] 팝업 및 공지 모달 탐색 중...');

  // 1. 고속 규칙 기반(Rule-based) 닫기 시도 (일반적인 한국 대학 e-Class 패턴)
  const commonCloseKeywords = [
    '오늘 하루 보지 않기',
    '오늘 하루 열지 않음',
    '다시 보지 않기',
    '7일간 보지 않기',
    '닫기',
    'Close',
    '확인'
  ];

  let closedCount = 0;

  for (const keyword of commonCloseKeywords) {
    try {
      // 텍스트 기반 버튼 또는 링크 탐색
      const elements = page.locator(`button:has-text("${keyword}"), a:has-text("${keyword}"), input[value*="${keyword}"]`);
      const count = await elements.count();
      for (let i = 0; i < count; i++) {
        const el = elements.nth(i);
        if (await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 1500 }).catch(() => {});
          closedCount++;
          await page.waitForTimeout(300);
        }
      }
    } catch (e) {
      // 무시하고 다음 키워드 진행
    }
  }

  // 모달 오버레이 또는 팝업 프레임 닫기 아이콘(X 버튼) 탐색
  const closeIconSelectors = [
    '.modal .close',
    '.popup .close',
    '[aria-label="Close"]',
    '[aria-label="닫기"]',
    '.btn-close',
    '#closeBtn'
  ];

  for (const selector of closeIconSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();
      for (let i = 0; i < count; i++) {
        const el = elements.nth(i);
        if (await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 1000 }).catch(() => {});
          closedCount++;
        }
      }
    } catch (e) {
      // 무시
    }
  }

  if (closedCount > 0) {
    console.log(`[방어] 규칙 기반으로 ${closedCount}개의 팝업 요소를 닫았습니다.`);
  }

  // 2. 만약 Stagehand AI 인스턴스가 주어졌고, 여전히 모달/오버레이가 감지되면 AI 액션 실행
  if (stagehand) {
    try {
      const hasOverlay = await page.evaluate(() => {
        const overlays = document.querySelectorAll('.modal, .popup, .overlay, [role="dialog"]');
        return Array.from(overlays).some(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
      });

      if (hasOverlay) {
        console.log('[방어] 변칙 팝업 감지: Stagehand AI를 호출하여 닫기를 시도합니다.');
        await stagehand.page.act('화면에 떠 있는 공지 팝업창이나 안내 모달의 닫기 버튼을 클릭해줘');
      }
    } catch (err) {
      console.warn('[방어] Stagehand 팝업 닫기 시도 중 경고:', err.message);
    }
  }
}
