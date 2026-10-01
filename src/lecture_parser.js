
/**
 * "MM:SS" 또는 "HH:MM:SS" 문자열을 초(seconds) 단위 정수로 변환
 */
export function timeStringToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * 초(seconds)를 "MM분 SS초" 또는 "HH시간 MM분 SS초" 문자열로 변환
 */
export function secondsToHumanReadable(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remSec = s % 60;

  if (h > 0) {
    return `${h}시간 ${m}분 ${remSec}초`;
  }
  return `${m}분 ${remSec}초`;
}

/**
 * online_view_form.acl 페이지에서 강의 항목들의 학습시간 및 진도 메타데이터 파싱
 * @param {import('playwright').Page} page
 */
export async function parseAttendanceInfo(page) {
  return await page.evaluate(() => {
    const items = [];
    const listEls = document.querySelectorAll('.online_contents_list');

    listEls.forEach((el, index) => {
      const button = el.querySelector('button.online_contents_wrap');
      const titleEl = el.querySelector('.video_title');
      const percentEl = el.querySelector('.percent');
      
      let linkSeq = null;
      if (button) {
        const onclick = button.getAttribute('onclick') || '';
        const match = onclick.match(/learningGo\(['"]?(\d+)['"]?\)/);
        if (match) linkSeq = match[1];
      }

      const title = titleEl ? titleEl.innerText.trim() : `영상_${index + 1}`;
      const percentText = percentEl ? percentEl.innerText.trim() : '0%';
      const percent = parseInt(percentText.replace('%', ''), 10) || 0;

      let learningTimeStr = '0:00';
      let requiredTimeStr = '0:00';

      const badges = el.querySelectorAll('.online_contents_badge');
      badges.forEach(b => {
        const spans = b.querySelectorAll('span');
        if (spans.length >= 2) {
          const label = spans[0].innerText.trim();
          const val = spans[1].innerText.trim();
          if (label.includes('학습시간')) learningTimeStr = val;
          if (label.includes('출석인정')) requiredTimeStr = val;
        }
      });

      items.push({
        linkSeq,
        title,
        percent,
        learningTimeStr,
        requiredTimeStr
      });
    });

    return items;
  }).then(rawItems => {
    return rawItems.map(item => {
      const currentSeconds = timeStringToSeconds(item.learningTimeStr);
      const requiredSeconds = timeStringToSeconds(item.requiredTimeStr);
      const remainingSeconds = Math.max(0, requiredSeconds - currentSeconds);
      const isCompleted = remainingSeconds === 0;

      return {
        ...item,
        currentSeconds,
        requiredSeconds,
        remainingSeconds,
        isCompleted
      };
    });
  });
}

