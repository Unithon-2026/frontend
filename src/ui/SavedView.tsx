/**
 * 관심 목록.
 *
 * 목록 자체는 localStorage(이 브라우저)에 있지만, 방문 단계는 서버에 있습니다.
 * 그래서 담긴 매장마다 방문 이력을 읽어 와 단계별로 추릴 수 있게 합니다.
 * 프로토타입은 프론트에만 있는 '영업 상태'를 따로 뒀는데, 이제 백엔드에
 * `VisitStatus` 가 있으므로 그 실제 값을 씁니다 — 같은 개념을 두 벌 두면
 * 반드시 어긋납니다.
 *
 * 방문 이력 API 는 세션이 필요하므로, 로그인 전에는 필터를 감추고 저장한
 * 목록만 보여줍니다.
 */

import { useMemo, useState } from 'react';
import LeadCard from './LeadCard';
import type { ActivityMap } from '../hooks/useSavedActivities';
import { latestStatus } from '../hooks/useSavedActivities';
import type { WatchEntry } from '../store/watchlist';
import type { VisitStatus } from '../types/salesActivity';
import { VISIT_STATUS_LABEL } from '../types/salesActivity';
import { IconWarn } from './icons';

/** '전체'와 '미방문(기록 없음)'을 포함한 필터 값. */
type Filter = '' | 'NONE' | VisitStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: '', label: '전체 상태' },
  { value: 'NONE', label: '기록 없음' },
  { value: 'FIRST_VISIT', label: '1차' },
  { value: 'SECOND_VISIT', label: '2차' },
  { value: 'THIRD_VISIT', label: '3차' },
  { value: 'FOURTH_VISIT', label: '4차' },
  { value: 'FIFTH_VISIT', label: '5차' },
];

interface Props {
  entries: WatchEntry[];
  activities: ActivityMap;
  loadingActivities: boolean;
  loggedIn: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onToggleSave: (entry: WatchEntry) => void;
  onClearAll: () => void;
}

export default function SavedView({
  entries,
  activities,
  loadingActivities,
  loggedIn,
  selectedId,
  onSelect,
  onToggleSave,
  onClearAll,
}: Props) {
  const [filter, setFilter] = useState<Filter>('');
  const [confirming, setConfirming] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.savedAt - a.savedAt);
    if (filter === '') return sorted;
    return sorted.filter((e) => {
      const status = latestStatus(activities.get(e.id));
      return filter === 'NONE' ? status === null : status === filter;
    });
  }, [entries, activities, filter]);

  if (entries.length === 0) {
    return (
      <div className="empty">
        <b>저장한 매장이 없습니다</b>
        매장 탐색에서 북마크 버튼을 눌러 담으세요. 목록은 이 브라우저에만 남습니다.
      </div>
    );
  }

  return (
    <>
      {!loggedIn && (
        <div className="section-note">
          <IconWarn />
          <span>
            <b>로그인하면 방문 단계로 추릴 수 있습니다</b> — 방문 기록은 서버에 있고 본인
            것만 조회됩니다. 저장 목록 자체는 이 브라우저에 남아 있습니다.
          </span>
        </div>
      )}

      <div className="filters">
        {loggedIn && (
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`chip${filter === f.value ? ' on' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="spacer" />
        {confirming ? (
          <>
            <span className="msg">{entries.length}건을 모두 지울까요?</span>
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                onClearAll();
                setConfirming(false);
              }}
            >
              지우기
            </button>
            <button type="button" className="linkbtn" onClick={() => setConfirming(false)}>
              취소
            </button>
          </>
        ) : (
          <button type="button" className="linkbtn" onClick={() => setConfirming(true)}>
            저장 목록 비우기
          </button>
        )}
        {loggedIn && (
          <div className="facetbar">
            <span>
              {loadingActivities
                ? '방문 이력을 불러오는 중…'
                : `${entries.length}건 저장됨${filter === '' ? '' : ` · ${rows.length}건 표시`}`}
            </span>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <b>이 단계에 해당하는 매장이 없습니다</b>
          다른 상태를 골라 보세요.
        </div>
      ) : (
        <div className="leadlist savedlist">
          {rows.map((e, i) => {
            const status = latestStatus(activities.get(e.id));
            return (
              <LeadCard
                key={e.id}
                shop={e}
                selected={e.id === selectedId}
                saved
                delayMs={Math.min(i, 8) * 26}
                badge={
                  loggedIn ? (
                    <span className={`badge ${status ? 'b-ok' : 'b-na'}`}>
                      {status ? VISIT_STATUS_LABEL[status] : '기록 없음'}
                    </span>
                  ) : undefined
                }
                aside={new Date(e.savedAt).toLocaleDateString('ko-KR', {
                  month: 'numeric',
                  day: 'numeric',
                })}
                onSelect={(s) => onSelect(s.id)}
                onToggleSave={() => onToggleSave(e)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
