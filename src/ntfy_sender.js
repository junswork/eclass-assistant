import https from 'https';
import { config } from '../config.js';

/**
 * ntfy 푸시 알림 전송 함수
 * @param {Object} options
 * @param {string} options.title - 알림 제목
 * @param {string} options.message - 알림 본문
 * @param {string} [options.priority='default'] - 우선순위 (min, low, default, high, urgent)
 * @param {string[]} [options.tags=[]] - 태그/이모지 (예: ['loudspeaker', 'books'])
 * @param {string|null} [options.clickUrl=null] - 알림 클릭 시 이동할 URL
 * @param {string} [options.topic] - ntfy 토픽 (기본: config.ntfy.topic)
 */
export async function sendNtfyNotification({
  title = 'e-Class 알림',
  message,
  priority = 'default',
  tags = ['books'],
  clickUrl = null,
  topic = config.ntfy.topic,
  markdown = true,
  sequenceId = null
}) {
  if (!message) {
    console.warn('[ntfy] 메시지 내용이 없습니다.');
    return false;
  }
  if (!topic) {
    // 토픽이 비어있으면 조용히 건너뜀 (알림 비활성화 상태)
    return false;
  }

  const payloadObj = {
    topic,
    title,
    message,
    priority: priority === 'high' ? 4 : priority === 'urgent' ? 5 : 3,
    tags,
    markdown
  };
  if (clickUrl) payloadObj.click = clickUrl;
  if (sequenceId) payloadObj.sequence_id = sequenceId;

  const payload = JSON.stringify(payloadObj);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload, 'utf8')
  };
  if (config.ntfy.token) headers['Authorization'] = `Bearer ${config.ntfy.token}`;

  const post = () => new Promise((resolve) => {
    const req = https.request(new URL(config.ntfy.server), { method: 'POST', headers, timeout: 10000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(0); });
    req.write(payload);
    req.end();
  });

  let status = await post();
  if (status !== 200) status = await post();

  if (status === 200) {
    console.log(`📱 [ntfy 알림 전송] ${title}`);
    return true;
  }
  console.error(`[ntfy] 전송 실패 (HTTP ${status || '연결 오류'}) - 토픽: ${topic}`);
  return false;
}
