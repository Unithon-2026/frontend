/**
 * 좌측 내비게이션.
 *
 * 다섯 화면 모두 열립니다. 다만 팀 영업 현황은 서버에 팀·역할 개념이 없어
 * 본인 실적만 보이므로, 그 사실을 배지로 미리 알립니다 — 눌러 보고 나서
 * 알게 되는 것보다 낫습니다.
 */

import type { AuthUser } from '../types/auth';
import {
  IconBookmark,
  IconChat,
  IconDatabase,
  IconLayers,
  IconSearch,
  IconUsers,
} from './icons';

export type ViewName = 'explore' | 'saved' | 'crm' | 'team' | 'data';

interface Props {
  view: ViewName;
  onView: (next: ViewName) => void;
  exploreCount: number | null;
  savedCount: number;
  user: AuthUser | null;
}

export default function Sidebar({ view, onView, exploreCount, savedCount, user }: Props) {
  return (
    <aside className="side">
      <div className="brand">
        <div className="brand-mark">
          <IconLayers />
        </div>
        <div className="brand-name">MeetRoute</div>
      </div>

      <div className="nav-label">영업</div>

      <button
        type="button"
        className={`nav-item${view === 'explore' ? ' active' : ''}`}
        onClick={() => onView('explore')}
      >
        <IconSearch />
        매장 탐색
        <span className="cnt">{exploreCount ?? '–'}</span>
      </button>

      <button
        type="button"
        className={`nav-item${view === 'saved' ? ' active' : ''}`}
        onClick={() => onView('saved')}
      >
        <IconBookmark />
        관심 목록
        <span className="cnt">{savedCount}</span>
      </button>

      <button
        type="button"
        className={`nav-item${view === 'crm' ? ' active' : ''}`}
        onClick={() => onView('crm')}
      >
        <IconChat />
        AI CRM 후속 영업
      </button>

      <div className="nav-label">관리</div>

      <button
        type="button"
        className={`nav-item${view === 'team' ? ' active' : ''}`}
        onClick={() => onView('team')}
        title="서버에 팀 개념이 없어 본인 실적만 보입니다"
      >
        <IconUsers />
        팀 영업 현황
        <span className="planned">본인만</span>
      </button>

      <button
        type="button"
        className={`nav-item${view === 'data' ? ' active' : ''}`}
        onClick={() => onView('data')}
      >
        <IconDatabase />
        데이터 관리
      </button>

      <div className="side-foot">
        <div className="user">
          {/* 세션의 실제 주인은 쿠키다. 여기 이름은 로그인 응답을 표시용으로 둔 것. */}
          <div className="avatar">{user ? user.name.slice(0, 1) : '?'}</div>
          <div>
            <b>{user ? user.name : '비로그인'}</b>
            <small>{user ? user.email : '오른쪽 위에서 로그인'}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
