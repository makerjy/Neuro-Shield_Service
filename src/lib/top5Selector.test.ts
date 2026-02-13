import { describe, expect, it, vi } from 'vitest';
import { getChildrenScope } from './dashboardChildrenScope';
import { assertTop5WithinChildren, selectTop5 } from './top5Selector';

describe('getChildrenScope', () => {
  it('returns sigungu children only for sido level', () => {
    const scope = getChildrenScope({
      level: 'sido',
      parentRegionCode: '31',
      candidates: [
        { code: '31', name: '경기도' },
        { code: '31011', name: '수원시' },
        { code: '31021', name: '성남시' },
        { code: '11', name: '서울특별시' },
      ],
    });

    expect(scope.childrenType).toBe('sigungu');
    expect(scope.childrenCodes).toEqual(['31011', '31021']);
    expect(scope.childrenNameMap['31011']).toBe('수원시');
    expect(scope.childrenNameMap['31']).toBeUndefined();
  });
});

describe('selectTop5', () => {
  it('filters by children codes and sorts by value then name', () => {
    const top5 = selectTop5({
      metricByCode: {
        '31011': 88.2,
        '31021': 92.1,
        '31030': 92.1,
        '11': 99.0,
      },
      childrenCodes: ['31011', '31021', '31030'],
      nameMap: {
        '31011': '수원시',
        '31021': '성남시',
        '31030': '의정부시',
      },
      sortOrder: 'desc',
    });

    expect(top5.map((row) => row.code)).toEqual(['31021', '31030', '31011']);
    expect(top5.every((row) => row.code !== '11')).toBe(true);
    expect(top5[0].rank).toBe(1);
  });

  it('creates temporary label and warning callback when name map is missing', () => {
    const onMissingName = vi.fn();
    const top5 = selectTop5({
      metricByCode: { '31011': 70 },
      childrenCodes: ['31011'],
      nameMap: {},
      onMissingName,
    });

    expect(top5[0].name).toBe('미매핑: 31011');
    expect(onMissingName).toHaveBeenCalledWith('31011');
  });

  it('asserts parent code is blocked', () => {
    const assertSpy = vi.spyOn(console, 'assert').mockImplementation(() => {});
    const isValid = assertTop5WithinChildren({
      top5: [{ code: '31', name: '경기도', value: 90, rank: 1 }],
      childrenCodes: ['31011', '31021'],
      parentRegionCode: '31',
    });

    expect(isValid).toBe(false);
    expect(assertSpy).toHaveBeenCalled();
    assertSpy.mockRestore();
  });
});
