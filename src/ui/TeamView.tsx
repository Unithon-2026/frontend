/**
 * 팀 영업 현황.
 *
 * 백엔드에 팀·역할 개념이 아예 없습니다 — `User` 에 역할 필드가 없고,
 * `SecurityConfig` 는 전체 permitAll 이며, 영업 활동은 조회 시점의 세션
 * 사용자 것만 돌아옵니다. 그래서 "남의 실적"을 가져올 방법이 없습니다.
 *
 * 프로토타입은 여기에 하드코딩된 수치(47건 · 31% · ▲4%p)를 넣어 두었지만,
 * 그 화면은 스크린샷 한 장만 돌아다녀도 있는 기능처럼 보입니다. 실제로 셀 수
 * 있는 것(내 실적)만 보여주고, 팀 단위로 확장하려면 서버에 무엇이 필요한지
 * 적어 둡니다.
 */

import { useMemo } from 'react';
import type { ActivityMap } from '../hooks/useSavedActivities';
import { latestStatus, mostRecent } from '../hooks/useSavedActivities';
import type { WatchEntry } from '../store/watchlist';
import type { AuthUser } from '../types/auth';
import { VISIT_STATUS_LABEL } from '../types/salesActivity';
import { IconWarn } from './icons';

interface Props {
  user: AuthUser | null;
  entries: WatchEntry[];
  activities: ActivityMap;
  loading: boolean;
  onSelect: (id: number) => void;
}

export default function TeamView({ user, entries, activities, loading, onSelect }: Props) {
  const rows = useMemo(
    () =>
      entries
        .map((e) => ({
          entry: e,
          status: latestStatus(activities.get(e.id)),
          recent: mostRecent(activities.get(e.id)),
        }))
        .filter((r) => r.status !== null)
        .sort((a, b) => (b.recent?.visitedAt ?? '').localeCompare(a.recent?.visitedAt ?? '')),
    [entries, activities],
  );

  if (!user) {
    return (
      <div className="section-note warn">
        <IconWarn />
        <span>
          <b>로그인이 필요합니다</b> — 영업 활동은 본인 세션 것만 조회됩니다. 오른쪽 위에서
          로그인하세요.
        </span>
      </div>
    );
  }

  const priority12 = rows.filter(
    (r) => r.entry.priorityGrade === 'S' || r.entry.priorityGrade === 'A',
  ).length;

  return (
    <>
      <div className="section-note warn">
        <IconWarn />
        <span>
          <b>팀 단위 집계는 서버에 없습니다</b> — <code>User</code> 에 역할·소속 필드가 없고
          영업 활동은 세션 사용자 본인 것만 돌아옵니다. 아래는 <b>{user.name}</b> 님 본인의
          실적이며, 지어낸 수치는 없습니다.
        </span>
      </div>

      <div className="grid2">
        <div className="stat">
          <div className="lab">담당(저장) 매장</div>
          <div className="val">{entries.length}</div>
          <div className="delta">관심 목록 기준</div>
        </div>
        <div className="stat">
          <div className="lab">접촉한 매장</div>
          <div className="val">{loading ? '–' : rows.length}</div>
          <div className="delta">방문 기록이 하나라도 있는 곳</div>
        </div>
        <div className="stat">
          <div className="lab">1 · 2등급 접촉</div>
          <div className="val">{loading ? '–' : priority12}</div>
          <div className="delta">최우선 · 우선 등급 중</div>
        </div>
        <div className="stat dark">
          <div className="lab">담당자</div>
          <div className="val" style={{ fontSize: 19, paddingTop: 6 }}>
            {user.name}
          </div>
          <div className="delta">{user.email}</div>
        </div>
      </div>

      <div className="panel-head" style={{ margin: '6px 0 12px' }}>
        <div>
          <span className="t">내 영업 활동</span> <span className="n">· 최근 방문순</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <b>기록된 방문이 없습니다</b>
          매장 상세의 영업 활동에서 방문 단계를 기록하면 여기에 쌓입니다.
        </div>
      ) : (
        <div className="card tablewrap" style={{ marginBottom: 28 }}>
          <table>
            <thead>
              <tr>
                <th>사업장</th>
                <th>업태</th>
                <th>자치구</th>
                <th>최근 단계</th>
                <th>마지막 방문</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, status, recent }) => (
                <tr key={entry.id} className="clickable" onClick={() => onSelect(entry.id)}>
                  <td>
                    <b>{entry.name}</b>
                  </td>
                  <td className="muted">{entry.businessType}</td>
                  <td className="muted">
                    {entry.gu} {entry.dong}
                  </td>
                  <td>
                    <span className="badge b-ok">{status && VISIT_STATUS_LABEL[status]}</span>
                  </td>
                  <td className="mono muted">{recent?.visitedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel-head" style={{ margin: '6px 0 12px' }}>
        <div>
          <span className="t">팀 화면을 만들려면 서버에 필요한 것</span>
        </div>
      </div>
      <div className="card" style={{ padding: '16px 18px' }}>
        <ul style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.9, margin: '0 0 0 18px' }}>
          <li>
            <code>User</code> 에 소속·역할 필드, 그리고 팀 엔터티
          </li>
          <li>다른 사용자의 영업 활동을 조회할 권한 검사 (지금은 세션 본인 고정)</li>
          <li>매장별 담당자 배정 — 지금은 각자 관심 목록에 담을 뿐이라 중복이 안 잡힙니다</li>
        </ul>
      </div>
    </>
  );
}
