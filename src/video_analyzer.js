import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { ensureCourseDirectory, listCourses } from './dir_manager.js';
import { humanDelay, getStealthContextOptions, applyStealthScripts } from './anti_bot.js';
import { parseAttendanceInfo, secondsToHumanReadable } from './lecture_parser.js';
import { sendNtfyNotification } from './ntfy_sender.js';
import { tracker } from './progress_tracker.js';

/**
 * VTT 자막을 읽기 쉬운 타임스탬프 마크다운으로 변환
 */
export function vttToMarkdown(vttText) {
  const lines = vttText.split('\n');
  const items = [];
  let currentTimestamp = '';
  let currentText = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === 'WEBVTT') continue;

    if (line.includes('-->')) {
      if (currentTimestamp && currentText.length > 0) {
        const start = currentTimestamp.split('-->')[0].trim().split('.')[0];
        items.push(`- **[${start}]** ${currentText.join(' ')}`);
        currentText = [];
      }
      currentTimestamp = line;
    } else if (currentTimestamp) {
      currentText.push(line);
    }
  }

  if (currentTimestamp && currentText.length > 0) {
    const start = currentTimestamp.split('-->')[0].trim().split('.')[0];
    items.push(`- **[${start}]** ${currentText.join(' ')}`);
  }

  return items.join('\n');
}

/**
 * Gemini API를 호출하여 화면 대조형 심화 통합 강의노트 생성
 * "동영상의 각 화면이 강의자료에서 어떤 내용을 바탕으로 설명을 진행하고 있는지를 분명히 파악하여 영상을 안 봐도 충분하도록" 작성
 */
export async function generateDeepLectureNote(title, astraSummary, transcriptMd, courseTitle = '') {
  if (!config.ai.apiKey) {
    console.warn('⚠️ GEMINI_API_KEY가 설정되지 않아 심화 강의노트 생성을 건너뜁니다.');
    return null;
  }

  const prompt = `
당신은 대학교 강의 전문 학습 튜터이자 최고급 교재 저술가입니다.
아래 제공된 자료는 이번 주차 온라인 동영상 강의("${courseTitle} - ${title}")의 교수님 실제 음성 자막 녹취록(타임스탬프 포함)과 플랫폼 AI 요약입니다.

학생이 **"이 동영상을 전혀 시청하지 않아도, 화면에 어떤 슬라이드/강의자료가 떠 있고 교수님이 그 화면을 바탕으로 어떤 설명과 팁을 말했는지"** 완벽히 머릿속에 그려지고 시험 대비가 가능하도록, **극도로 정밀하고 상세한 [화면 대조형 심화 강의노트]**를 작성해 주세요.

---

### ⚠️ 필수 작성 원칙 및 형식:

## 1. 강의 개요 및 핵심 학습 목표
- 본 강의가 교과목 전체에서 차지하는 맥락과 핵심 학습 목표 요약

## 2. 화면(슬라이드)별 타임라인 완전 복원 (시간 순서대로 상세 전개)
강의의 시작부터 끝까지 시간 순서대로 화면 전환을 추적하여 \`[HH:MM:SS] 화면/슬라이드 주제\` 섹션으로 나누고, 각 구간마다 아래 3가지 항목을 반드시 대조하여 기술하세요:
- 📄 **[화면/슬라이드 원문 핵심]**: 화면에 띄워진 슬라이드나 교재의 핵심 텍스트, 개념 정의, 수식, 표, 다이어그램, 코드 원문을 복원하여 기술.
- 🗣️ **[교수님 구두 심화 해설 & 팁]**: 슬라이드 글자에는 적혀 있지 않지만 교수님이 음성으로 강조한 배경 지식, 구체적인 현실 예시, 강조 뉘앙스, 실무 팁, 헷갈리기 쉬운 함정을 빠짐없이 상세히 서술.
- 👁️ **[화면 시각 자료 / 실행 화면 해석]**: 화면에 등장하는 도표, 그래프, IDE 코드 화면의 파라미터나 변수 의미, 실행 결과가 무엇을 뜻하는지 구체적으로 해설.

## 3. 핵심 공식 / 알고리즘 / 코드 포인트 완전 분석
- 등장하는 모든 소스 코드나 수식을 완전한 형태(코드 블록 및 LaTeX 수식)로 정리하고, 핵심 파라미터나 함수의 역할과 주의점 설명

## 4. [★시험 출제 포인트 & 실전 Q&A] (3~5문항)
- 교수님이 자막에서 강조한 "시험에 자주 나오는 부분", "헷갈리기 쉬운 개념"을 기반으로 실제 출제 가능한 실전 문제(단답형, 서술형, 코드 빈칸형)와 상세 정답/해설 제공

---
[자료 1: 플랫폼 기본 요약]
${astraSummary || '(요약 정보 없음)'}

---
[자료 2: 교수님 음성 전체 자막 (타임스탬프 포함)]
${(transcriptMd || '').substring(0, 50000)}
---
`;

  const primaryModel = config.ai.noteModelName || 'gemini-3.8-flash';
  const fallbackModel = config.ai.fallbackModelName || 'gemini-3.5-flash-lite';

  const tryCall = async (model) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.ai.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`HTTP ${response.status}: ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  };

  try {
    console.log(`   🧠 [Gemini 호출] ${primaryModel} 모델로 화면 대조형 심화 강의노트 생성 중...`);
    return await tryCall(primaryModel);
  } catch (err) {
    console.warn(`   ⚠️ ${primaryModel} 호출 실패 (${err.message}). 폴백 모델(${fallbackModel})로 재시도...`);
    try {
      return await tryCall(fallbackModel);
    } catch (fallbackErr) {
      console.error(`   ❌ 폴백 모델 호출도 실패: ${fallbackErr.message}`);
      return null;
    }
  }
}

/**
 * 전 과목을 순회하며 온라인 강의 출석 큐와 AI 분석 큐 구축
 */
export async function fastIngestAllCourses() {
  console.log('\n======================================================');
  console.log('⚡ [강의 탐색] 전 과목 온라인 강의 목록 및 메타데이터 수집');
  console.log('======================================================\n');

  if (!fs.existsSync(config.sessionPath)) {
    console.error('❌ 저장된 로그인 세션이 없습니다. 먼저 "npm run auth"로 로그인해 주세요.');
    return { analysisQueue: [], manualInterventionQueue: [] };
  }

  tracker.setPhase('강의 탐색 중', '전 과목 온라인 강의 목록 순회 중...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: config.sessionPath,
    ...getStealthContextOptions()
  });
  const page = await context.newPage();
  await applyStealthScripts(page);

  const analysisQueue = [];
  const manualInterventionQueue = [];

  try {
    // 1. 로그인한 계정의 수강 과목을 메인 페이지에서 직접 탐색
    await page.goto(config.eclassUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(1000, 2000, '수강 과목 탐색');
    const courses = await listCourses(page);

    if (courses.length === 0) {
      console.warn('   ⚠️ 수강 과목을 찾지 못했습니다 (로그인 세션 만료 가능성). "npm run auth"로 다시 로그인해 주세요.');
      return { analysisQueue, manualInterventionQueue };
    }

    console.log(`총 ${courses.length}개 과목 확인됨:`);
    courses.forEach(c => console.log(` - ${c.title} (${c.prof})`));

    // 2. 과목별 온라인 강의 탐색
    for (const course of courses) {
      const courseNotesDir = ensureCourseDirectory(course.title);
      const c = { key: course.title, title: course.title, kjkey: course.kjkey };
      console.log(`\n📚 [과목 진입] ${c.title}`);
      tracker.setCurrentAction(`[과목 진입] ${c.title}`, c.title);

      // 과목 서브메인 진입
      await page.goto(config.eclassUrl, { waitUntil: 'domcontentloaded' });
      await humanDelay(800, 1500, '과목 진입 전 메인 대기');

      try {
        await Promise.all([
          page.waitForURL('**/submain_form.acl', { timeout: 12000 }),
          page.evaluate((k) => window.eclassRoom(k), c.kjkey)
        ]);
      } catch (e) {
        console.warn(`   과목 서브메인 진입 실패 또는 타임아웃 (${c.title}): ${e.message}`);
        continue;
      }

      // 주차별 학습활동 이동
      const weeksUrl = 'https://eclass.seoultech.ac.kr/ilos/cls/st/activity/activity_form.acl?mf=lecture_weeks';
      await page.goto(weeksUrl, { waitUntil: 'domcontentloaded' });
      await humanDelay(1000, 2000, '주차별 학습활동 로딩');

      // 온라인 영상 주차 항목들 수집
      const lectureWeeksList = await page.$$eval('a[onclick*="online_view_form.acl"]', anchors => {
        return anchors.map(a => {
          const onclick = a.getAttribute('onclick') || '';
          const match = onclick.match(/viewActivityPage\('[^']+',\s*'lecture_weeks',\s*'(\d+)'/);
          const text = a.innerText.replace(/\s+/g, ' ').trim();
          return { id: match ? match[1] : null, text };
        }).filter(item => item.id);
      });

      if (lectureWeeksList.length === 0) {
        console.log(`   (온라인 영상 항목 없음)`);
        continue;
      }

      console.log(`   발견된 주차별 온라인 영상: 총 ${lectureWeeksList.length}건`);

      // 각 주차별 영상 상세 페이지 순회
      for (const weekItem of lectureWeeksList) {
        const viewUrl = `https://eclass.seoultech.ac.kr/ilos/cls/st/online/online_view_form.acl?LECTURE_WEEKS=${weekItem.id}`;
        await page.goto(viewUrl, { waitUntil: 'domcontentloaded' });
        await humanDelay(1200, 2000, '강의 상세 로딩');

        // 강의 메타데이터 파싱
        const attendanceItems = await parseAttendanceInfo(page);

        for (const item of attendanceItems) {
          if (!item.linkSeq) continue;

          console.log(`\n   ▶ [영상 확인] "${item.title}" (linkSeq: ${item.linkSeq})`);
          console.log(`      학습: ${item.learningTimeStr} / 인정시간: ${item.requiredTimeStr} (${item.percent}%)`);

          const safeTitle = item.title.replace(/[/\\?%*:|"<>]/g, '_').trim();
          const targetNotePath = path.join(courseNotesDir, `${safeTitle}_심층_통합강의노트.md`);

          tracker.setCurrentAction(`[강의 확인] ${item.title}`, c.title, item.title);
          tracker.updateLecture(`${c.key}_${item.linkSeq}`, {
            courseTitle: c.title,
            title: item.title,
            learningTimeStr: item.learningTimeStr,
            requiredTimeStr: item.requiredTimeStr,
            percent: item.percent,
            vttBadge: '⏳ 확인 중',
            summaryBadge: '⏳ 확인 중',
            noteBadge: fs.existsSync(targetNotePath) ? '✅ 완료' : '⏳ 대기'
          });

          // 강의노트 생성이 필요한 경우에만 자막 및 요약 수집
          if (!fs.existsSync(targetNotePath)) {
            const capturedVtts = [];
            const responseHandler = res => {
              const u = res.url();
              if (u.includes('.vtt')) capturedVtts.push(u);
            };
            page.on('response', responseHandler);

            // learningForm submit으로 플레이어 메타데이터 로드
            await page.waitForSelector('form[name="learningForm"]', { timeout: 5000 }).catch(() => null);
            const submitted = await page.evaluate((s) => {
              if (document.learningForm && document.learningForm.link_seq) {
                document.learningForm.link_seq.value = s;
                document.learningForm.submit();
                return true;
              }
              return false;
            }, item.linkSeq);

            if (!submitted) {
              console.log(`      ⚠️ learningForm을 찾을 수 없어 건너뜁니다: ${item.title}`);
              continue;
            }

            await page.waitForTimeout(3000);
            page.off('response', responseHandler);

            // iframe contentViewer 내 VTT 확인
            let contentFrame = page.frames().find(f => f.name() === 'contentViewer');
            if (contentFrame) {
              try {
                const tracks = await contentFrame.$$eval('track', els => els.map(t => t.src).filter(Boolean));
                if (tracks.length > 0) capturedVtts.push(...tracks);
              } catch (e) {}
            }

            // 아스트라 요약 추출
            const astraSummary = await page.evaluate(() => {
              const el = document.querySelector('#ai_supporters_summary, .supporters_summary');
              return el ? el.innerText.trim() : '';
            });

            // VTT 자막 다운로드 및 파싱
            let transcriptMd = '';
            if (capturedVtts.length > 0) {
              try {
                const vttUrl = capturedVtts[0];
                const vttRes = await context.request.get(vttUrl);
                const vttRaw = await vttRes.text();
                transcriptMd = vttToMarkdown(vttRaw);
              } catch (vttErr) {
                console.warn(`      ⚠️ 자막 다운로드 실패: ${vttErr.message}`);
              }
            }

            tracker.updateLecture(`${c.key}_${item.linkSeq}`, {
              vttBadge: transcriptMd ? '✅ 있음' : '❌ 없음',
              summaryBadge: astraSummary ? '✅ 있음' : '❌ 없음'
            });

            if (!transcriptMd && !astraSummary) {
              console.log(`      ⚠️ 자막 및 요약 미제공 (${item.title})`);
              manualInterventionQueue.push({
                courseTitle: c.title,
                safeTitle,
                reason: 'STT 자막 및 아스트라 요약 미제공'
              });
              tracker.updateLecture(`${c.key}_${item.linkSeq}`, { noteBadge: '🚨 자동생성 불가' });
            } else {
              analysisQueue.push({
                courseKey: c.key,
                courseTitle: c.title,
                safeTitle,
                summary: astraSummary,
                transcriptMd,
                targetNotePath,
                linkSeq: item.linkSeq
              });
              tracker.updateLecture(`${c.key}_${item.linkSeq}`, { noteBadge: '⏳ 작성 대기' });
            }
          } else {
            console.log(`      ✓ 이미 심화 강의노트 존재함`);
            tracker.updateLecture(`${c.key}_${item.linkSeq}`, { noteBadge: '✅ 완료' });
          }

          await humanDelay(800, 1500, '다음 영상 확인 전 안전 대기');
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log(`⚡ [탐색 완료]`);
  console.log(`   - AI 강의노트 작성 큐: 총 ${analysisQueue.length}건`);
  console.log('======================================================\n');

  return { analysisQueue, manualInterventionQueue };
}

/**
 * AI 심화 강의노트 생성 실행 트랙
 */
export async function runAnalysisTrack(analysisQueue) {
  if (!analysisQueue || analysisQueue.length === 0) {
    console.log('🧠 [AI 강의노트] 작성할 신규 강의가 없습니다. (모두 작성 완료됨)');
    tracker.updateAIProgress(0, 0, '');
    return;
  }

  console.log(`🧠 [AI 강의노트] 총 ${analysisQueue.length}건의 화면 대조형 심화노트 작성 시작...`);
  tracker.setPhase('AI 강의노트 작성', `총 ${analysisQueue.length}건 작성 중...`);

  for (let i = 0; i < analysisQueue.length; i++) {
    const item = analysisQueue[i];
    console.log(`\n▶ [AI 노트 ${i + 1}/${analysisQueue.length}] ${item.courseTitle} - ${item.safeTitle}`);

    tracker.updateAIProgress(i + 1, analysisQueue.length, `${item.courseTitle} - ${item.safeTitle}`);
    tracker.updateLecture(`${item.courseKey}_${item.linkSeq}`, { noteBadge: '🔄 AI 생성 중' });

    try {
      const deepNote = await generateDeepLectureNote(item.safeTitle, item.summary, item.transcriptMd, item.courseTitle);
      if (deepNote) {
        const deepNoteContent = `# [심화 강의노트] ${item.safeTitle}\n\n> 생성: Gemini (${config.ai.modelName}) - 동영상 화면 및 슬라이드 내용 완전 대조 복원\n\n${deepNote}\n`;
        fs.writeFileSync(item.targetNotePath, deepNoteContent, 'utf8');
        console.log(`   🎉 [심화 강의노트 저장 완료] ${item.targetNotePath}`);

        tracker.completeAI(item.courseTitle, item.safeTitle);
        tracker.updateLecture(`${item.courseKey}_${item.linkSeq}`, { noteBadge: '✅ 완료' });

        // ntfy 알림
        await sendNtfyNotification({
          title: `[강의노트 생성 완료] ${item.courseTitle}`,
          message: `"${item.safeTitle}"의 화면 대조형 심화 강의노트가 저장되었습니다.`,
          tags: ['books', 'sparkles']
        });
      }
    } catch (err) {
      console.error(`   ❌ [AI 노트 작성 오류] ${item.safeTitle}: ${err.message}`);
      tracker.updateLecture(`${item.courseKey}_${item.linkSeq}`, { noteBadge: '❌ 오류' });
    }
  }

  console.log('\n🧠 [AI 강의노트] 모든 강의노트 작성이 완료되었습니다.');
}
