/**
 * 필터 줄: 자치구·업태 드롭다운, 등급 칩, 목록/지도 토글.
 *
 * 등급 칩의 값은 화면 표기(1~4)이고, 백엔드로 나갈 때 S/A/B/C 로 바뀝니다.
 * 변환은 App 에서 `LABEL_TO_GRADE` 로 한 번만 합니다.
 */

import type { Facets } from '../api/facets';
import type { GradeLabelValue } from '../types/shop';
import { IconFilterLines, IconList, IconPin, IconSplit } from './icons';

const GRADE_CHIPS: Array<{ label: string; value: GradeLabelValue }> = [
  { label: '전체 등급', value: '' },
  { label: '1등급', value: '1' },
  { label: '2등급', value: '2' },
  { label: '3등급', value: '3' },
  { label: '4등급', value: '4' },
];

interface Props {
  gu: string;
  businessType: string;
  grade: GradeLabelValue;
  showMap: boolean;
  facets: Facets | null;
  scanning: boolean;
  onGu: (v: string) => void;
  onBusinessType: (v: string) => void;
  onGrade: (v: GradeLabelValue) => void;
  onShowMap: (v: boolean) => void;
  onRescan: () => void;
}

export default function Filters({
  gu,
  businessType,
  grade,
  showMap,
  facets,
  scanning,
  onGu,
  onBusinessType,
  onGrade,
  onShowMap,
  onRescan,
}: Props) {
  return (
    <div className="filters">
      <div className="selectbox">
        <IconPin />
        <span className="muted">자치구</span>
        <select value={gu} onChange={(e) => onGu(e.target.value)}>
          <option value="">전체</option>
          {facets?.gu.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="selectbox">
        <IconFilterLines />
        <span className="muted">업태</span>
        <select value={businessType} onChange={(e) => onBusinessType(e.target.value)}>
          <option value="">전체 업태</option>
          {facets?.businessType.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="chips">
        {GRADE_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`chip${grade === c.value ? ' on' : ''}`}
            onClick={() => onGrade(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="spacer" />

      <div className="segmented">
        <button type="button" className={`seg${showMap ? ' on' : ''}`} onClick={() => onShowMap(true)}>
          <IconSplit />
          목록+지도
        </button>
        <button type="button" className={`seg${showMap ? '' : ' on'}`} onClick={() => onShowMap(false)}>
          <IconList />
          목록
        </button>
      </div>

      {/* 드롭다운 후보값을 어디서 뽑았는지 밝힌다 — 전수가 아니라 표본이다. */}
      <div className="facetbar">
        <span>{facetNote(facets, scanning)}</span>
        <button type="button" className="linkbtn" onClick={onRescan} disabled={scanning}>
          {scanning ? '스캔 중…' : '다시 스캔'}
        </button>
      </div>
    </div>
  );
}

function facetNote(facets: Facets | null, scanning: boolean): string {
  if (scanning && !facets) return '자치구·업태 후보값을 스캔하는 중…';
  if (!facets) return '자치구·업태 후보값을 아직 스캔하지 않았습니다.';

  const complete = facets.sampled >= facets.total;
  const basis = complete
    ? `전체 ${facets.total.toLocaleString('ko-KR')}건 기준`
    : `표본 ${facets.sampled.toLocaleString('ko-KR')}건 기준 (전체 ${facets.total.toLocaleString('ko-KR')}건)`;

  return `후보값은 ${basis} — 업태 ${facets.businessType.length}종 · 자치구 ${facets.gu.length}곳`;
}
