/**
 * 매장 한 줄 카드.
 *
 * 매장 탐색·관심 목록·CRM 이 같은 모양을 써야 해서 한 곳으로 모았습니다.
 * 점수·등급은 우선순위 계산 전까지 null 이므로 어느 화면에서든 '미산정'을
 * 그릴 수 있어야 합니다 — 그때는 점선 테두리와 `–` 가 들어갑니다.
 */

import type { ReactNode } from 'react';
import type { PriorityGrade } from '../types/shop';
import { GRADE_MEANING, gradeKey } from '../types/shop';
import { IconBookmark } from './icons';

/** 목록·관심 목록·CRM 이 모두 만족하는 최소 모양. */
export interface LeadLike {
  id: number;
  name: string;
  gu: string;
  dong: string;
  businessType: string;
  score: number | null;
  priorityGrade: PriorityGrade | null;
}

interface Props {
  shop: LeadLike;
  selected: boolean;
  saved: boolean;
  /** 우측 하단 작은 글씨. 순위(`#3`)나 저장일 등. */
  aside?: ReactNode;
  /** 주소 뒤에 붙는 배지. 방문 단계 같은 것. */
  badge?: ReactNode;
  delayMs?: number;
  onSelect: (shop: LeadLike) => void;
  onToggleSave: (shop: LeadLike) => void;
}

export default function LeadCard({
  shop,
  selected,
  saved,
  aside,
  badge,
  delayMs = 0,
  onSelect,
  onToggleSave,
}: Props) {
  const key = gradeKey(shop.priorityGrade);

  return (
    <div
      className={`lead${selected ? ' sel' : ''}`}
      style={{ animationDelay: `${delayMs}ms` }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(shop)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(shop);
        }
      }}
    >
      <div className={`score grade-${key}${shop.score == null ? ' na' : ''}`}>
        <b>{shop.score ?? '–'}</b>
        <small>{shop.priorityGrade ? `${key.slice(1)}등급` : '미산정'}</small>
      </div>

      <div className="lead-body">
        <div className="lead-name">
          {shop.name}
          {shop.businessType && <span className="cat">{shop.businessType}</span>}
        </div>
        <div className="lead-meta">
          <span>
            {shop.gu} {shop.dong}
          </span>
          {shop.priorityGrade && (
            <>
              <span className="dot" />
              <span>{GRADE_MEANING[shop.priorityGrade]}</span>
            </>
          )}
          {badge && (
            <>
              <span className="dot" />
              {badge}
            </>
          )}
        </div>
      </div>

      <div className="lead-side">
        <button
          type="button"
          className={`savebtn${saved ? ' on' : ''}`}
          title={saved ? '관심 목록에서 빼기' : '관심 목록에 담기'}
          aria-pressed={saved}
          onClick={(e) => {
            e.stopPropagation(); // 카드 선택까지 같이 일어나면 저장할 때마다 상세가 열린다
            onToggleSave(shop);
          }}
        >
          <IconBookmark />
        </button>
        {aside && <span className="upd">{aside}</span>}
      </div>
    </div>
  );
}
