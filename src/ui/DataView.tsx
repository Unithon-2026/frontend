/**
 * 데이터 관리.
 *
 * 수치는 전부 실제 API 에서 유도합니다. 백엔드에 통계 엔드포인트가 없어
 * 목록을 훑고 지도 API 와 빼기를 하는데(`api/stats.ts`), 그 결과가 전수인지
 * 표본인지를 화면이 그대로 밝힙니다.
 *
 * 프로토타입에 있던 수집 일정·변경 이력 표는 서버에 대응 엔터티가 없습니다.
 * 그럴듯한 날짜와 '성공' 배지를 지어내면 스크린샷 한 장만 돌아다녀도 있는
 * 기능처럼 보이므로, 자리만 두고 값은 비워 둡니다.
 */

import { useCallback, useEffect, useState } from 'react';
import { loadDatasetStats } from '../api/stats';
import type { DatasetStats } from '../api/stats';
import { calculateAllPriorities } from '../api/priority';
import { IconRefresh, IconWarn } from './icons';

interface Props {
  /** 배치가 끝나면 목록·지도도 다시 받도록 알린다. */
  onPriorityChanged: () => void;
}

export default function DataView({ onPriorityChanged }: Props) {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [batchBusy, setBatchBusy] = useState(false);
  const [batchNote, setBatchNote] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadDatasetStats(signal);
      if (signal?.aborted) return;
      setStats(next);
    } catch (e) {
      if (signal?.aborted) return;
      setError((e as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  async function onBatch() {
    setBatchBusy(true);
    setBatchNote('전체 매장의 우선순위를 계산하는 중… 매장이 많으면 수 분 걸릴 수 있습니다.');
    try {
      const r = await calculateAllPriorities();
      setBatchNote(
        `완료 — 전체 ${r.totalShopCount.toLocaleString('ko-KR')}건 중 ` +
          `${r.processedCount.toLocaleString('ko-KR')}건 처리 · ${(r.elapsedMillis / 1000).toFixed(1)}초`,
      );
      onPriorityChanged();
      void load();
    } catch (e) {
      setBatchNote('일괄 계산 실패: ' + (e as Error).message);
    } finally {
      setBatchBusy(false);
    }
  }

  const n = (v: number | null | undefined) =>
    loading || v == null ? '–' : v.toLocaleString('ko-KR');

  return (
    <>
      <div className="grid2">
        <div className="stat">
          <div className="lab">등록된 매장</div>
          <div className="val">{n(stats?.total)}</div>
          <div className="delta">GET /api/v1/shops · totalElements</div>
        </div>
        <div className="stat">
          <div className="lab">우선순위 미산정</div>
          <div className="val">{n(stats?.unscored)}</div>
          <div className="delta">
            {stats && !stats.complete
              ? `${stats.scanned.toLocaleString('ko-KR')}건 표본 기준`
              : 'score 가 null'}
          </div>
        </div>
        <div className="stat">
          <div className="lab">지도 표시 불가</div>
          <div className="val">{n(stats?.missingGeo)}</div>
          <div className="delta">
            {stats?.missingGeo == null && !loading
              ? '전체가 1000건을 넘어 셀 수 없음'
              : '좌표 없음 또는 국내 밖'}
          </div>
        </div>
        <div className="stat dark">
          <div className="lab">데이터 출처</div>
          <div className="val" style={{ fontSize: 17, paddingTop: 8 }}>
            서울시 위생업소
          </div>
          <div className="delta">공공데이터</div>
        </div>
      </div>

      {error && (
        <div className="section-note warn">
          <IconWarn />
          <span>
            <b>집계를 불러오지 못했습니다</b> — {error}
          </span>
        </div>
      )}

      {stats && !stats.complete && (
        <div className="section-note">
          <IconWarn />
          <span>
            <b>표본 기준입니다</b> — 전체 {stats.total.toLocaleString('ko-KR')}건 중{' '}
            {stats.scanned.toLocaleString('ko-KR')}건만 훑었습니다. 백엔드에 집계
            엔드포인트가 없어 목록을 페이지 단위로 읽는데, 상한을 두지 않으면 화면이
            열릴 때마다 전수 조회가 나갑니다.
          </span>
        </div>
      )}

      <div className="panel-head" style={{ margin: '6px 0 12px' }}>
        <div>
          <span className="t">우선순위 일괄 계산</span>{' '}
          <span className="n">· POST /api/v1/priorities/batch</span>
        </div>
        <button type="button" className="pgbtn" disabled={loading} onClick={() => void load()}>
          집계 새로고침
        </button>
      </div>
      <div className="card" style={{ marginBottom: 28, padding: '16px 18px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.7, margin: '0 0 12px' }}>
          등록된 모든 매장의 우선순위를 다시 계산해 저장합니다. 매장 수가 많으면 응답까지
          수 분이 걸릴 수 있습니다.
        </p>
        <button
          type="button"
          className="btn sm"
          style={{ maxWidth: 220 }}
          disabled={batchBusy}
          onClick={onBatch}
        >
          <IconRefresh />
          {batchBusy ? '계산 중…' : '전체 재계산 실행'}
        </button>
        {batchNote && (
          <div className="prio-meta" style={{ margin: '12px 0 0' }}>
            {batchNote}
          </div>
        )}
      </div>

      <div className="panel-head" style={{ margin: '6px 0 12px' }}>
        <div>
          <span className="t">수집 출처 및 일정</span> <span className="n">· 서버 미구현</span>
        </div>
      </div>
      <div className="card tablewrap" style={{ marginBottom: 28 }}>
        <table>
          <thead>
            <tr>
              <th>출처명</th>
              <th>제공 방식</th>
              <th>수집 주기</th>
              <th>최근 수집</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>서울시 위생업소 인허가 데이터</td>
              <td className="muted">공공 OpenAPI</td>
              <td className="muted">—</td>
              <td className="muted">—</td>
              <td>
                <span className="badge b-na">미연동</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section-note warn">
        <IconWarn />
        <span>
          <b>수집 이력·변경 이력은 서버에 없습니다</b> — 수집 출처와 변경 로그 엔터티가
          없고, <code>Shop</code> 에 폐업 여부(<code>dataStatus</code>) 컬럼도 없어 "폐업
          제외" 필터를 만들 수 없습니다. 값을 지어내지 않고 자리만 비워 두었습니다.
        </span>
      </div>
    </>
  );
}
