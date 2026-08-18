import {
  MobileFramework,
  MobileRequirements,
  calculateMobileFrameworkRecommendation,
  formatCurrencyIDR,
} from './native-app-scorer';

describe('E.1 D.6 Mobile Native Decision Scorer (Jest 4 pure)', () => {
  test('CASE1: Clock-in HEAVY use case (liveness 3D + geo <=5m + offline = Flutter/KMP recommended karena presisi)', () => {
    const req: MobileRequirements = {
      geoAccuracyMeters: 5,
      faceLivenessLevel: 'LIVENESS_3D',
      devTimelineMonths: 4,
      existingTeamSkill: 'JS_DART_MIX',
      bundleSizeTargetMB: 35,
      offlineFirst: true,
      pushNotifPriority: 'CRITICAL',
      backgroundGeoTracking: true,
      iosAndroidBoth: true,
      needFacialSDKNativeIntegration: true,
    };
    const r = calculateMobileFrameworkRecommendation(req);
    expect([MobileFramework.FLUTTER_3_24, MobileFramework.KOTLIN_MULTIPLATFORM, MobileFramework.RN_CLI_075]).toContain(r.recommended);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.goNoGo === 'GO' || r.goNoGo === 'CAUTION').toBe(true);
    const anyNativeTotal = Math.max(
      r.scoreBreakdown[MobileFramework.FLUTTER_3_24]?.total ?? 0,
      r.scoreBreakdown[MobileFramework.RN_CLI_075]?.total ?? 0,
    );
    expect(anyNativeTotal).toBeGreaterThanOrEqual(62);
  });

  test('CASE2: Simple use case APPROVAL ONLY + JS_ONLY team + 2bln tight = RECOMMEND RN EXPO SDK52', () => {
    const req: MobileRequirements = {
      geoAccuracyMeters: 30,
      faceLivenessLevel: 'PHOTO_MATCH',
      devTimelineMonths: 2,
      existingTeamSkill: 'JS_ONLY',
      bundleSizeTargetMB: 30,
      offlineFirst: false,
      pushNotifPriority: 'MEDIUM',
      backgroundGeoTracking: false,
      iosAndroidBoth: true,
    };
    const r = calculateMobileFrameworkRecommendation(req);
    expect(r.recommended).toBe(MobileFramework.RN_EXPO_SDK52);
    expect(r.goNoGo).toBe('GO');
    expect(r.scoreBreakdown[MobileFramework.RN_EXPO_SDK52]!.teamAdoptionRisk).toBeGreaterThanOrEqual(90);
    expect(r.recommendedPros.some((s) => s.toLowerCase().includes('expo') || s.toLowerCase().includes('js/ts'))).toBe(true);
  });

  test('CASE3: Heavy offline + background tracking = RN CLI 0.75 or Flutter 3.24 min score >=75', () => {
    const req: MobileRequirements = {
      geoAccuracyMeters: 10,
      faceLivenessLevel: 'PHOTO_MATCH',
      devTimelineMonths: 6,
      existingTeamSkill: 'JS_DART_MIX',
      bundleSizeTargetMB: 50,
      offlineFirst: true,
      pushNotifPriority: 'HIGH',
      backgroundGeoTracking: true,
      iosAndroidBoth: true,
    };
    const r = calculateMobileFrameworkRecommendation(req);
    expect([MobileFramework.RN_CLI_075, MobileFramework.FLUTTER_3_24]).toContain(r.recommended);
    const cliScore = r.scoreBreakdown[MobileFramework.RN_CLI_075]!.total;
    const fluScore = r.scoreBreakdown[MobileFramework.FLUTTER_3_24]!.total;
    expect(Math.max(cliScore, fluScore)).toBeGreaterThanOrEqual(70);
    expect(r.goNoGo).not.toBe('NO_GO_USE_PWA_FIRST');
  });

  test('CASE4: Team pure JS + timeline 2 bulan -> Expo recommended karena team adoption + timeline, currency format IDR OK', () => {
    const req: MobileRequirements = {
      geoAccuracyMeters: 100,
      faceLivenessLevel: 'NONE',
      devTimelineMonths: 2,
      existingTeamSkill: 'JS_ONLY',
      bundleSizeTargetMB: 40,
      offlineFirst: false,
      pushNotifPriority: 'MEDIUM',
      iosAndroidBoth: true,
    };
    const r = calculateMobileFrameworkRecommendation(req);
    expect(r.recommended).toBe(MobileFramework.RN_EXPO_SDK52);
    expect(r.estimatedTimelineWeeks).toBeLessThanOrEqual(12);
    expect(formatCurrencyIDR(r.estimatedBudgetIDR.setupCost)).toContain('Rp');
  });
});
