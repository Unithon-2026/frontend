/**
 * 우선순위 결과 목록.
 *
 * 카드 자체는 `LeadCard` 가 그립니다 — 관심 목록·CRM 과 같은 모양이어야 해서.
 * 여기는 페이징과 빈 상태만 다룹니다.
 */

import type { Page } from '../types/api';
import type { ShopListItem } from '../types/shop';
import LeadCard from './LeadCard';

interface Props {
  page: Page<ShopListItem> | null;
  loading: boolean;
  selectedId: number | null;
  savedIds: ReadonlySet<number>;
  /** 필터가 하나라도 걸려 있는가. 0건일 때 안내 문구가 갈린다. */
  filtered: boolean;
  onSelect: (shop: ShopListItem) => void;
  onToggleSave: (shop: ShopListItem) => void;
  onPage: (next: number) => void;
}

export default function ShopList({
  page,
  loading,
  selectedId,
  savedIds,
  filtered,
  onSelect,
  onToggleSave,
  onPage,
}: Props) {
  if (loading && !page) {
    return <div className="empty">불러오는 중…</div>;
  }
  if (!page || page.empty) {
    /* 필터를 걸지 않았는데 0건이면 필터 탓이 아니라 DB 가 비어 있는 것이다.
       "필터를 바꿔보세요"는 그 경우 아무 도움이 안 되고 오히려 헷갈린다. */
    return filtered ? (
      <div className="empty">
        <b>조건에 맞는 매장이 없습니다</b>
        자치구 · 업태 · 등급 필터를 바꿔보세요.
      </div>
    ) : (
      <div className="empty">
        <b>등록된 매장이 없습니다</b>
        백엔드는 정상 응답했지만 매장 데이터가 0건입니다. 데이터 적재가 끝났는지
        백엔드 담당자에게 확인하세요.
      </div>
    );
  }

  return (
    <>
      <div className="leadlist">
        {page.content.map((shop, i) => (
          <LeadCard
            key={shop.id}
            shop={shop}
            selected={shop.id === selectedId}
            saved={savedIds.has(shop.id)}
            aside={`#${page.number * page.size + i + 1}`}
            delayMs={Math.min(i, 8) * 26}
            onSelect={(s) => onSelect(s as ShopListItem)}
            onToggleSave={(s) => onToggleSave(s as ShopListItem)}
          />
        ))}
      </div>

      {page.totalPages > 1 && (
        <div className="pager">
          <button
            type="button"
            className="pgbtn"
            disabled={page.first || loading}
            onClick={() => onPage(page.number - 1)}
          >
            이전
          </button>
          <span className="pos">
            {page.number + 1} / {page.totalPages}
          </span>
          <button
            type="button"
            className="pgbtn"
            disabled={page.last || loading}
            onClick={() => onPage(page.number + 1)}
          >
            다음
          </button>
        </div>
      )}
    </>
  );
}
