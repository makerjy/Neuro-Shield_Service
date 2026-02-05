/* ═══════════════════════════════════════════════════════════════════════════════
   드릴다운 상태 관리 (React useState 기반 - zustand 대체)
═══════════════════════════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import { DrillLevel, DrillPathItem, DrillState } from './kpi.types';

const initialState: DrillState = {
  drillLevel: 'nation',
  drillPath: [{ level: 'nation', code: 'KR', name: '전국' }],
  selectedRegion: null,
};

export function useDrillState() {
  const [state, setState] = useState<DrillState>(initialState);

  const drillDown = useCallback((target: { code: string; name: string; level: DrillLevel }) => {
    setState(prev => {
      const newPath: DrillPathItem[] = [...prev.drillPath, {
        level: target.level,
        code: target.code,
        name: target.name,
      }];
      
      updateURLParams(target.level, target.code);
      
      return {
        drillLevel: target.level,
        drillPath: newPath,
        selectedRegion: target,
      };
    });
  }, []);

  const drillUp = useCallback(() => {
    setState(prev => {
      if (prev.drillPath.length <= 1) return prev;
      
      const newPath = prev.drillPath.slice(0, -1);
      const lastItem = newPath[newPath.length - 1];
      
      updateURLParams(lastItem.level, lastItem.code);
      
      return {
        drillLevel: lastItem.level,
        drillPath: newPath,
        selectedRegion: lastItem.level === 'nation' ? null : {
          code: lastItem.code,
          name: lastItem.name,
          level: lastItem.level,
        },
      };
    });
  }, []);

  const drillTo = useCallback((levelIndex: number) => {
    setState(prev => {
      if (levelIndex < 0 || levelIndex >= prev.drillPath.length) return prev;
      
      const newPath = prev.drillPath.slice(0, levelIndex + 1);
      const targetItem = newPath[newPath.length - 1];
      
      updateURLParams(targetItem.level, targetItem.code);
      
      return {
        drillLevel: targetItem.level,
        drillPath: newPath,
        selectedRegion: targetItem.level === 'nation' ? null : {
          code: targetItem.code,
          name: targetItem.name,
          level: targetItem.level,
        },
      };
    });
  }, []);

  const resetDrill = useCallback(() => {
    setState(initialState);
    updateURLParams('nation', 'KR');
  }, []);

  const setSelectedRegion = useCallback((region: { code: string; name: string; level: DrillLevel } | null) => {
    setState(prev => ({ ...prev, selectedRegion: region }));
  }, []);

  return {
    ...state,
    drillDown,
    drillUp,
    drillTo,
    resetDrill,
    setSelectedRegion,
  };
}

/* ─────────────────────────────────────────────────────────────
   URL 쿼리스트링 동기화 유틸리티
───────────────────────────────────────────────────────────── */
function updateURLParams(level: DrillLevel, code: string) {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  url.searchParams.set('level', level);
  url.searchParams.set('region', code);
  
  window.history.replaceState({}, '', url.toString());
}

export function initDrillStateFromURL() {
  if (typeof window === 'undefined') return;
  
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level') as DrillLevel | null;
  const regionCode = params.get('region');
  
  if (level && regionCode) {
    // URL에서 상태 복원 로직 (필요시 구현)
  }
}

/* ─────────────────────────────────────────────────────────────
   드릴 레벨 한글 변환
───────────────────────────────────────────────────────────── */
export function getDrillLevelLabel(level: DrillLevel): string {
  const labels: Record<DrillLevel, string> = {
    nation: '전국',
    sido: '시도',
    sigungu: '시군구',
    center: '센터',
  };
  return labels[level] || level;
}

export function getNextDrillLevel(current: DrillLevel): DrillLevel | null {
  const order: DrillLevel[] = ['nation', 'sido', 'sigungu', 'center'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}
