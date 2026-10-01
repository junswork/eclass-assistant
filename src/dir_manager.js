import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

/**
 * e-Class 메인 페이지에서 로그인한 사용자의 정규 수강 과목 목록 추출
 * (정규 교과목은 A로 시작하는 kjkey)
 * @param {import('playwright').Page} page - 메인 페이지가 로드된 상태
 */
export async function listCourses(page) {
  return page.$$eval('a[onclick*="eclassRoom"]', anchors => {
    const list = [];
    const seen = new Set();
    for (const a of anchors) {
      const m = (a.getAttribute('onclick') || '').match(/eclassRoom\(['"]([^'"]+)['"]\)/);
      if (!m || !m[1].startsWith('A') || seen.has(m[1])) continue;
      seen.add(m[1]);
      const lines = a.innerText.trim().split('\n').map(s => s.trim()).filter(Boolean);
      list.push({ kjkey: m[1], title: lines[0] || m[1], prof: lines[2] || '' });
    }
    return list;
  });
}

/**
 * 특정 과목의 강의노트 저장 디렉토리 확보 및 반환
 * @param {string} courseTitle - 과목명
 * @returns {string} 해당 과목의 강의노트 저장 폴더 절대경로
 */
export function ensureCourseDirectory(courseTitle) {
  const safeTitle = courseTitle.replace(/[/\\?%*:|"<>]/g, '_').trim();
  const courseNotesDir = path.join(config.notesOutputDir, safeTitle);

  if (!fs.existsSync(courseNotesDir)) {
    fs.mkdirSync(courseNotesDir, { recursive: true });
    console.log(`[디렉토리 생성] ${courseNotesDir}`);
  }

  return courseNotesDir;
}
