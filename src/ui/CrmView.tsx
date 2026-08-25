/**
 * AI CRM 후속 영업.
 *
 * 프로토타입이 이 화면을 그릴 때는 백엔드에 영업 시도 이력이 없어서 수치가
 * 전부 더미였습니다. 지금은 `SalesActivityController` 가 있으므로 **실제 기록**
 * 으로 다시 세웁니다. 관심 목록에 담긴 매장이 대상 범위입니다 — 서버에
 * "내 담당 매장" 개념이 없어서, 사람이 직접 담은 목록이 가장 가까운 대용입니다.
 *
 * 아직 서버에 없는 것(AI 제안 채택률, 예정일 스케줄링)은 만들어 내지 않고
 * 무엇이 없는지만 적습니다.
 */

import { useMemo } from 'react';
import type { ActivityMap } from '../hooks/useSavedActivities';
import { latestStatus, mostRecent } from '../hooks/useSavedActivities';
import type { WatchEntry } from '../store/watchlist';
import { VISIT_STATUS_LABEL } from '../types/salesActivity';
import { gradeLabel } from '../types/shop';
import { IconWarn } from './icons';

interface Props {
  entries: WatchEntry[];
  activities: ActivityMap;
  loading: boolean;
  loggedIn: boolean;
  onSelect: (id: number) => void;
}

/** 마지막 방문에서 며칠 지났는지. 방문일은 `LocalDate` 라 날짜만 있습니다. */
function daysSince(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
}

export default function CrmView({ entries, activities, loading, loggedIn, onSelect }: Props) {
  const rows = useMemo(() => {
    return entries
      .map((e) => {
        const list = activities.get(e.id) ?? [];
        const recent = mostRecent(list);
        return {
          entry: e,
          status: latestStatus(list),
          recent,
          steps: list.length,
          idleDays: recent ? daysSince(recent.visitedAt) : null,
        };
      })
      // 오래 방치된 것이 위로. 아직 한 번도 안 간 곳은 맨 위.
      .sort((a, b) => (b.idleDays ?? Infinity) - (a.idleDays ?? Infinity));
  }, [entries, activities]);

  const untouched = rows.filter((r) => r.status === null).length;
  const totalSteps = rows.reduce((n, r) => n + r.steps, 0);
  const withMemo = rows.filter((r) => (activities.get(r.entry.id) ?? []).some((a) => a.memo)).length;
  const stale = rows.filter((r) => r.idleDays != null && r.idleDays >= 7).length;

  if (!loggedIn) {
    return (
      <div className="section-note warn">
        <IconWarn />
        <span>
          <b>로그인이 필요합니다</b> — 영업 활동 기록은 서버에 있고 본인 것만 조회됩니다.
          오른쪽 위에서 로그인하세요.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="section-note">
        <IconWarn />
        <span>
          <b>관심 목록에 담은 매장이 대상입니다</b> — 서버에 "내 담당 매장" 개념이 없어,
          직접 담은 목록을 후속 영업 범위로 씁니다. 아래 수치는 전부 실제 방문 기록
          (<code>GET /shops/&#123;id&#125;/sales_activity</code>)에서 계산한 값입니다.
        </span>
      </div>

      <div className="grid2">
        <div className="stat">
          <div className="lab">후속 접촉 대상</div>
          <div className="val">{loading ? '–' : untouched}</div>
          <div className="delta">담았지만 아직 방문 기록 없음</div>
        </div>
        <div className="stat">
          <div className="lab">7일 이상 방치</div>
          <div className="val">{loading ? '–' : stale}</div>
          <div className="delta">마지막 방문 이후</div>
        </div>
        <div className="stat">
          <div className="lab">기록된 영업 시도</div>
          <div className="val">{loading ? '–' : totalSteps}</div>
          <div className="delta">방문 단계 기록 합계</div>
        </div>
        <div className="stat dark">
          <div className="lab">메모가 있는 매장</div>
          <div className="val">
            {loading ? '–' : withMemo}
            <small> / {entries.length}</small>
          </div>
          <div className="delta">브리핑에 반영됩니다</div>
        </div>
      </div>

      <div className="panel-head" style={{ margin: '6px 0 12px' }}>
        <div>
          <span className="t">후속 접촉 대상</span>{' '}
          <span className="n">· 오래 방치된 순</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <b>관심 목록이 비어 있습니다</b>
          매장 탐색에서 북마크 버튼을 눌러 담으면 여기에 후속 영업 대상으로 올라옵니다.
        </div>
      ) : (
        <div className="card tablewrap">
          <table>
            <thead>
              <tr>
                <th>사업장</th>
                <th>우선순위</th>
                <th>최근 단계</th>
                <th>마지막 방문</th>
                <th>최근 메모</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, status, recent, idleDays }) => (
                <tr key={entry.id} className="clickable" onClick={() => onSelect(entry.id)}>
                  <td>
                    <b>{entry.name}</b>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {entry.gu} {entry.dong} · {entry.businessType}
                    </div>
                  </td>
                  <td className="muted">
                    {gradeLabel(entry.priorityGrade)}
                    {entry.score != null && <span className="mono"> · {entry.score}점</span>}
                  </td>
                  <td>
                    <span className={`badge ${status ? 'b-ok' : 'b-na'}`}>
                      {status ? VISIT_STATUS_LABEL[status] : '기록 없음'}
                    </span>
                  </td>
                  <td className="mono muted">
                    {recent ? (
                      <>
                        {recent.visitedAt}
                        {idleDays != null && idleDays >= 7 && (
                          <span className="down"> · {idleDays}일 경과</span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="muted memo-cell">{recent?.memo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel-head" style={{ margin: '28px 0 12px' }}>
        <div>
          <span className="t">아직 서버에 없는 것</span> <span className="n">· 기획서 R-RABMND</span>
        </div>
      </div>
      <div className="card" style={{ padding: '16px 18px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.8, margin: 0 }}>
          기획서의 AI CRM 흐름 중 아래는 백엔드 엔터티가 없어 화면을 만들지 않았습니다.
          숫자를 지어내는 대신 무엇이 빠졌는지만 적습니다.
        </p>
        <ul style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.9, margin: '10px 0 0 18px' }}>
          <li>다음 접촉 <b>예정일</b> — 일정 필드가 없습니다(방문일은 과거 기록만).</li>
          <li>AI 제안 <b>채택 여부</b> — 브리핑을 보고 무엇을 했는지 저장할 곳이 없습니다.</li>
          <li>제안 방식(전화·방문·메일) 분류 — <code>VisitStatus</code> 는 차수만 구분합니다.</li>
        </ul>
      </div>
    </>
  );
}
