/**
 * 백엔드 연결 상태 배너.
 *
 * 데모 중 "왜 목록이 비어 있지"를 바로 답하기 위한 것입니다. 실패했을 때는
 * 무엇을 확인해야 하는지(어느 주소로 나갔는지, 무슨 오류였는지)까지 적습니다.
 */

import { IconCheck, IconClock, IconWarn } from './icons';

export type Conn =
  | { state: 'loading' }
  | { state: 'live'; total: number }
  | { state: 'down'; reason: string };

export default function Banner({ conn, target }: { conn: Conn; target: string }) {
  if (conn.state === 'loading') {
    return (
      <div className="apibanner loading">
        <IconClock />
        <span>백엔드에 연결하는 중… <code>{target}/api/v1/shops</code></span>
      </div>
    );
  }

  if (conn.state === 'live') {
    return (
      <div className="apibanner live">
        <IconCheck />
        <span>
          <b>백엔드 연결됨</b> — 매장 {conn.total.toLocaleString('ko-KR')}건 ·{' '}
          <code>{target}/api/v1/shops</code>
        </span>
      </div>
    );
  }

  return (
    <div className="apibanner fallback">
      <IconWarn />
      <span>
        <b>백엔드에 연결하지 못했습니다</b> — <code>{target}</code> · {conn.reason}
        <br />
        백엔드가 8080 에 떠 있는지, <code>VITE_BACKEND_ORIGIN</code> 이 맞는지 확인하세요.
      </span>
    </div>
  );
}
