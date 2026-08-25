import type { Page } from '../types/api';
import type { ShopListItem } from '../types/shop';
import { GRADE_TO_LABEL, gradeLabel } from '../types/shop';

interface Props {
  page: Page<ShopListItem> | null;
  loading: boolean;
  selectedId: number | null;
  onSelect: (shop: ShopListItem) => void;
  onPage: (next: number) => void;
}

export default function ShopList({ page, loading, selectedId, onSelect, onPage }: Props) {
  if (loading && !page) {
    return <p className="muted">불러오는 중…</p>;
  }
  if (!page || page.empty) {
    return <p className="muted">조건에 맞는 매장이 없습니다. 필터를 바꿔보세요.</p>;
  }

  return (
    <>
      {page.content.map((shop) => (
        <button
          key={shop.id}
          type="button"
          className={`shop${shop.id === selectedId ? ' on' : ''}`}
          onClick={() => onSelect(shop)}
        >
          <span className={`score`}>{shop.score ?? '–'}</span>
          <span className="meta">
            <span className="nm">{shop.name}</span>{' '}
            <span className={`pill ${shop.priorityGrade ? `G${GRADE_TO_LABEL[shop.priorityGrade]}` : 'NA'}`}>
              {gradeLabel(shop.priorityGrade)}
            </span>
            <span className="sub">
              {shop.gu} {shop.dong} · {shop.businessType}
            </span>
          </span>
        </button>
      ))}

      {page.totalPages > 1 && (
        <div className="pager">
          <button type="button" disabled={page.first || loading} onClick={() => onPage(page.number - 1)}>
            ← 이전
          </button>
          <span className="pos">
            {page.number + 1} / {page.totalPages}
          </span>
          <button type="button" disabled={page.last || loading} onClick={() => onPage(page.number + 1)}>
            다음 →
          </button>
        </div>
      )}
    </>
  );
}
