import { fastIngestAllCourses, runAnalysisTrack } from './video_analyzer.js';
import { sendNtfyNotification } from './ntfy_sender.js';
import { tracker } from './progress_tracker.js';

function getNowTime() {
  const now = new Date();
  return now.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

/**
 * e-Class AI 심화 강의노트 생성기:
 * 1. 전 과목 온라인 강의 탐색 및 자막/메타데이터 수집
 * 2. 화면 대조형 AI 심화 강의노트 제작 (Gemini 3.8 Flash)
 * 3. 최종 ntfy 보고
 */
export async function runFullSync() {
  const startTime = getNowTime();
  console.log('============================================================');
  console.log(`🚀 [e-Class AI 강의노트 어시스턴트 시작] 시작 시각: ${startTime}`);
  console.log('   - 1단계: 수강 과목 탐색 & 강의 자막/메타데이터 분석');
  console.log('   - 2단계: 화면 대조형 AI 심화 강의노트(.md) 자동 생성');
  console.log('============================================================\n');

  // 1단계: 강의 탐색 & 큐 구축
  const { analysisQueue, manualInterventionQueue } = await fastIngestAllCourses();

  // 2단계: AI 심화 강의노트 생성
  if (analysisQueue.length > 0) {
    console.log(`\n>>> [AI 노트 트랙] 총 ${analysisQueue.length}건의 심화 강의노트 작성 시작...`);
    await runAnalysisTrack(analysisQueue);
  } else {
    console.log('\n>>> [AI 노트 트랙] 모든 강의의 심화 강의노트가 이미 작성되어 있습니다.');
  }

  const finishTime = getNowTime();

  tracker.setPhase('완료 🎉', '모든 심화 강의노트 생성이 완료되었습니다.');

  // 최종 보고서 작성 및 ntfy 전송
  console.log('\n============================================================');
  console.log(`🎉 [작업 완료] 종료 시각: ${finishTime}`);
  console.log('============================================================\n');

  let reportMsg = `### 🎓 e-Class AI 심화 강의노트 생성 완료\n\n`;

  // 새로 생성된 AI 강의노트
  const completedNotes = tracker.status.trackB_AI.completedList;
  if (completedNotes.length > 0) {
    reportMsg += `**🧠 [새로 작성된 심화 강의노트]**\n`;
    completedNotes.forEach(n => {
      reportMsg += `- 📚 **${n.courseTitle}**: \`${n.title}\`\n`;
    });
    reportMsg += `\n`;
  } else {
    reportMsg += `- 모든 강의의 강의노트가 이미 최신 상태입니다.\n\n`;
  }

  // 자막 미제공 강의
  if (manualInterventionQueue.length > 0) {
    reportMsg += `⚠️ **[자막 미제공 강의]** (노트 생성 불가)\n`;
    manualInterventionQueue.forEach(m => {
      reportMsg += `- **${m.courseTitle}**: \`${m.safeTitle}\` (${m.reason})\n`;
    });
    reportMsg += `\n`;
  }

  reportMsg += `> ⏱️ 소요 시간: ${startTime} ~ ${finishTime}`;

  await sendNtfyNotification({
    title: '🎉 [e-Class 강의노트 생성 완료]',
    message: reportMsg.trim(),
    tags: ['books', 'sparkles', 'white_check_mark'],
    priority: 'default'
  });

  return {
    analysisQueue,
    completedNotes: completedNotes
  };
}

// 직접 실행 시
if (process.argv[1] && process.argv[1].endsWith('sync.js')) {
  runFullSync().catch(console.error);
}
