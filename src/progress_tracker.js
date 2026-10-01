import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 실행 도구 폴더 내에 실시간 진행현황 마크다운 생성
const STATUS_FILE_PATH = path.resolve(__dirname, '..', '온라인강의_진행현황.md');
const now = () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

class ProgressTracker {
  constructor() {
    this.status = {
      phase: '대기 중',
      currentAction: '초기화 중...',
      startTime: now(),
      lastUpdated: now(),
      currentCourse: '',
      currentLecture: '',
      trackA_Attendance: {
        total: 0,
        currentIdx: 0,
        currentTitle: '',
        remainingSec: 0,
        totalSec: 0,
        completedList: []
      },
      trackB_AI: {
        total: 0,
        currentIdx: 0,
        currentTitle: '',
        completedList: []
      },
      lectures: new Map() // key: `${courseKey}_${linkSeq}`
    };
  }

  setPhase(phase, action = '') {
    this.status.phase = phase;
    if (action) this.status.currentAction = action;
    this.renderMarkdown();
  }

  setCurrentAction(action, course = '', lecture = '') {
    this.status.currentAction = action;
    if (course) this.status.currentCourse = course;
    if (lecture) this.status.currentLecture = lecture;
    this.renderMarkdown();
  }

  updateLecture(key, info) {
    const existing = this.status.lectures.get(key) || {};
    this.status.lectures.set(key, { ...existing, ...info });
    this.renderMarkdown();
  }

  updateAttendanceProgress(currentIdx, total, title, remainingSec, totalSec) {
    this.status.trackA_Attendance = {
      ...this.status.trackA_Attendance,
      currentIdx,
      total,
      currentTitle: title,
      remainingSec,
      totalSec
    };
    this.renderMarkdown();
  }

  completeAttendance(courseTitle, title) {
    this.status.trackA_Attendance.completedList.push({
      courseTitle,
      title,
      completedAt: new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })
    });
    this.renderMarkdown();
  }

  updateAIProgress(currentIdx, total, title) {
    this.status.trackB_AI = { ...this.status.trackB_AI, currentIdx, total, currentTitle: title };
    this.renderMarkdown();
  }

  completeAI(courseTitle, title) {
    this.status.trackB_AI.completedList.push({
      courseTitle,
      title,
      completedAt: new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })
    });
    this.renderMarkdown();
  }

  renderMarkdown() {
    this.status.lastUpdated = now();

    let md = `# 📊 온라인 강의 진행 현황 대시보드\n\n`;
    md += `> **시작 일시**: ${this.status.startTime} | **최근 갱신**: \`${this.status.lastUpdated}\`\n\n`;

    md += `## 🔄 현재 작업 상태\n\n`;
    md += `| 항목 | 내용 |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **현재 단계 (Phase)** | **${this.status.phase}** |\n`;
    md += `| **실시간 동작** | \`${this.status.currentAction}\` |\n`;
    if (this.status.currentCourse) md += `| **대상 과목** | ${this.status.currentCourse} |\n`;
    if (this.status.currentLecture) md += `| **대상 강의** | ${this.status.currentLecture} |\n`;
    md += `\n---\n\n`;

    // AI 노트
    const ai = this.status.trackB_AI;
    const aiPercent = ai.total > 0 ? Math.round((ai.currentIdx / ai.total) * 100) : 0;
    md += `## 🧠 AI 심화 강의노트 작성 진행도\n`;
    md += `- **진행도**: ${ai.completedList.length} / ${ai.total} 건 완료 (${aiPercent}%)\n`;
    if (ai.currentTitle) {
      md += `- **현재 작성 중**: \`${ai.currentTitle}\` (${config.ai.noteModelName || 'gemini-3.8-flash'})\n`;
    } else {
      md += `- **상태**: ${ai.total === 0 ? '작성 대상 없음 (모든 강의노트 완료)' : '대기 중'}\n`;
    }
    ai.completedList.forEach(c => {
      md += `  - 📚 [${c.completedAt}] ${c.courseTitle} - ${c.title}\n`;
    });
    md += `\n---\n\n`;

    md += `## 📋 전체 강의별 현황표\n\n`;
    md += `| 과목 | 강의명 | 학습 / 인정시간 (진도) | 자막(STT) | 아스트라 요약 | 심화 강의노트 |\n`;
    md += `| :--- | :--- | :--- | :---: | :---: | :---: |\n`;

    if (this.status.lectures.size === 0) {
      md += `| *조회 중...* | *강의 목록을 탐색하고 있습니다.* | - | - | - | - | - |\n`;
    } else {
      for (const item of this.status.lectures.values()) {
        const learnTime = `${item.learningTimeStr || '0:00'} / ${item.requiredTimeStr || '0:00'} (${item.percent || 0}%)`;
        md += `| ${item.courseTitle || '-'} | ${item.title || '-'} | ${learnTime} | ${item.vttBadge || '⏳ 대기'} | ${item.summaryBadge || '⏳ 대기'} | ${item.noteBadge || '⏳ 대기'} |\n`;
      }
    }

    try {
      fs.writeFileSync(STATUS_FILE_PATH, md, 'utf8');
    } catch (e) {}
  }
}

export const tracker = new ProgressTracker();
