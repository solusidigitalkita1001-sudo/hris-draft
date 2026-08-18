export enum MobileFramework {
  RN_EXPO_SDK52 = 'RN_EXPO_SDK52',
  RN_CLI_075 = 'RN_CLI_075',
  FLUTTER_3_24 = 'FLUTTER_3_24',
  KOTLIN_MULTIPLATFORM = 'KOTLIN_MULTIPLATFORM',
}

export type TeamSkillMix = 'JS_ONLY' | 'JS_DART_MIX' | 'NATIVE_FIRST' | 'KOTLIN_JVM';

export interface MobileRequirements {
  geoAccuracyMeters: number;
  faceLivenessLevel: 'NONE' | 'PHOTO_MATCH' | 'LIVENESS_3D' | 'PASSIVE_VIDEO';
  devTimelineMonths: number;
  existingTeamSkill: TeamSkillMix;
  bundleSizeTargetMB: number;
  offlineFirst: boolean;
  pushNotifPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  backgroundGeoTracking?: boolean;
  iosAndroidBoth: boolean;
  needFacialSDKNativeIntegration?: boolean;
}

export interface FrameworkCriteriaScore {
  devVelocity: number;
  nativePerformance: number;
  geofenceSupport: number;
  faceLivenessCompat: number;
  bundleSizeScore: number;
  offlineFirst: number;
  pushNotifReliability: number;
  maintainability: number;
  teamAdoptionRisk: number;
  total: number;
}

export interface FrameworkRecommendation {
  recommended: MobileFramework;
  runnerUp: MobileFramework | null;
  score: number;
  scoreBreakdown: Partial<Record<MobileFramework, FrameworkCriteriaScore>>;
  reasons: string[];
  warnings: string[];
  recommendedPros: string[];
  recommendedCons: string[];
  estimatedBudgetIDR: { setupCost: number; monthlyOpsCost: number; perDeviceSupport: number };
  estimatedTimelineWeeks: number;
  goNoGo: 'GO' | 'CAUTION' | 'NO_GO_USE_PWA_FIRST';
}

const BASE_SCORES: Record<MobileFramework, Omit<FrameworkCriteriaScore, 'total'>> = {
  [MobileFramework.RN_EXPO_SDK52]: {
    devVelocity: 95,
    nativePerformance: 72,
    geofenceSupport: 80,
    faceLivenessCompat: 60,
    bundleSizeScore: 70,
    offlineFirst: 75,
    pushNotifReliability: 80,
    maintainability: 90,
    teamAdoptionRisk: 95,
  },
  [MobileFramework.RN_CLI_075]: {
    devVelocity: 82,
    nativePerformance: 82,
    geofenceSupport: 92,
    faceLivenessCompat: 78,
    bundleSizeScore: 65,
    offlineFirst: 88,
    pushNotifReliability: 88,
    maintainability: 78,
    teamAdoptionRisk: 80,
  },
  [MobileFramework.FLUTTER_3_24]: {
    devVelocity: 78,
    nativePerformance: 82,
    geofenceSupport: 86,
    faceLivenessCompat: 83,
    bundleSizeScore: 85,
    offlineFirst: 92,
    pushNotifReliability: 92,
    maintainability: 85,
    teamAdoptionRisk: 52,
  },
  [MobileFramework.KOTLIN_MULTIPLATFORM]: {
    devVelocity: 54,
    nativePerformance: 92,
    geofenceSupport: 92,
    faceLivenessCompat: 92,
    bundleSizeScore: 90,
    offlineFirst: 95,
    pushNotifReliability: 95,
    maintainability: 72,
    teamAdoptionRisk: 38,
  },
};

const BUDGET_BASE: Record<MobileFramework, { setup: number; ops: number; device: number; timeline: number }> = {
  [MobileFramework.RN_EXPO_SDK52]: { setup: 80_000_000, ops: 12_000_000, device: 150_000, timeline: 10 },
  [MobileFramework.RN_CLI_075]: { setup: 120_000_000, ops: 18_000_000, device: 200_000, timeline: 14 },
  [MobileFramework.FLUTTER_3_24]: { setup: 150_000_000, ops: 16_000_000, device: 180_000, timeline: 16 },
  [MobileFramework.KOTLIN_MULTIPLATFORM]: { setup: 220_000_000, ops: 25_000_000, device: 220_000, timeline: 24 },
};

const PROS_CONS: Record<MobileFramework, { pros: string[]; cons: string[] }> = {
  [MobileFramework.RN_EXPO_SDK52]: {
    pros: [
      'Expo SDK 52 OTA updates tanpa review 3 hari tanpa store release candidate',
      'Jadi JS/TS team existing bisa fullstack tanpa native bridge knowledge',
      'Expo Location + TaskManager built-in support clock-in',
      'EAS build cloud build service signed IPA/APK otomatis',
    ],
    cons: [
      'Custom native face liveness 3D SDK (Privy/Digisign perlu custom dev bridge',
      'Background geofence 100m+ kurang presisi ≤5m butuh native module',
    ],
  },
  [MobileFramework.RN_CLI_075]: {
    pros: [
      'New Architecture Fabric TurboModule enable untuk performa smooth list besar',
      'Native modules langsung bisa JSI tanpa wrapper face SDK native Privy Liveness',
      'Beacon indoor + BLE attendance RFID reader support ada',
    ],
    cons: [
      'Setup AndroidX + CocoaPods rawan upgrade tiap minor release flutter',
      'Hilang Expo OTA — butuh codepush tambahan',
    ],
  },
  [MobileFramework.FLUTTER_3_24]: {
    pros: [
      'Dart isolate untuk 60fps list employee directory performa smooth tanpa bridge overhead',
      'Geolocator v13 background 5m accuracy android13 ios18 presisi GPS FTUE >99% di site',
      'Google ML Kit face detection built-in tanpa SDK bayar',
      'Impeller renderer iOS 18 shadow/glassmorphism UI pixel perfect 2 platform',
    ],
    cons: [
      'Dart language learning curve untuk tim JavaScript existing 2-3 minggu',
      'App size APK release ~45MB base lebih besar dari RN 28MB',
      'Native SDK native module Platform Channel wrapper untuk e-signature SDK Indonesia',
    ],
  },
  [MobileFramework.KOTLIN_MULTIPLATFORM]: {
    pros: [
      'Shared core logic 100% native iOS100% Android100% untuk performance',
      'Jetpack Compose UI KMP 2026 beta Compose Multiplatform stable',
      'Coroutines Flow untuk realtime sync attendance offline 10k employee',
    ],
    cons: [
      'Kotlin/JVM specialist langkah recruit talent mahal & langka ID market 2026',
      'Ekosistem library UI belum mature dibanding Flutter/RN',
    ],
  },
};

function scoreWithPenalty(
  base: number,
  weight: number,
  meets: boolean,
  penalty: number = 18,
  bonus: number = 8,
): number {
  const normalized = base + (meets ? bonus : -penalty);
  return Math.max(0, Math.min(100, normalized));
}

function scoreTeamSkillPenalty(skill: TeamSkillMix, framework: MobileFramework): number {
  switch (framework) {
    case MobileFramework.RN_EXPO_SDK52:
      return skill === 'JS_ONLY' ? 15 : skill === 'JS_DART_MIX' ? 8 : skill === 'NATIVE_FIRST' ? -5 : -10;
    case MobileFramework.RN_CLI_075:
      return skill === 'JS_DART_MIX' ? 12 : skill === 'JS_ONLY' ? 5 : skill === 'NATIVE_FIRST' ? 4 : -8;
    case MobileFramework.FLUTTER_3_24:
      return skill === 'JS_DART_MIX' ? 14 : skill === 'NATIVE_FIRST' ? 6 : skill === 'JS_ONLY' ? -10 : -5;
    case MobileFramework.KOTLIN_MULTIPLATFORM:
      return skill === 'KOTLIN_JVM' ? 20 : skill === 'NATIVE_FIRST' ? 5 : -18;
  }
}

function scoreGeoPenalty(requiredMeters: number, framework: MobileFramework): number {
  const ability: Record<MobileFramework, number> = {
    [MobileFramework.RN_EXPO_SDK52]: 15,
    [MobileFramework.RN_CLI_075]: 6,
    [MobileFramework.FLUTTER_3_24]: 3,
    [MobileFramework.KOTLIN_MULTIPLATFORM]: 2,
  };
  const achievable = ability[framework];
  if (requiredMeters >= achievable) return 10;
  if (requiredMeters <= achievable * 2) return 2;
  return -10;
}

function faceLivenessPenalty(level: MobileRequirements['faceLivenessLevel'], f: MobileFramework): number {
  const order: Record<MobileRequirements['faceLivenessLevel'], number> = { NONE: 0, PHOTO_MATCH: 1, LIVENESS_3D: 2, PASSIVE_VIDEO: 3 };
  const threshold: Record<MobileFramework, number> = {
    [MobileFramework.RN_EXPO_SDK52]: 1,
    [MobileFramework.RN_CLI_075]: 2,
    [MobileFramework.FLUTTER_3_24]: 3,
    [MobileFramework.KOTLIN_MULTIPLATFORM]: 3,
  };
  const need = order[level];
  const maxByF = threshold[f];
  if (need <= maxByF) return 12;
  if (need === maxByF + 1) return -5;
  return -22;
}

function pushScore(level: MobileRequirements['pushNotifPriority'], f: MobileFramework): number {
  if (level === 'CRITICAL') {
    return f === MobileFramework.FLUTTER_3_24 || f === MobileFramework.KOTLIN_MULTIPLATFORM || f === MobileFramework.RN_CLI_075 ? 12 : -6;
  }
  if (level === 'HIGH') return f === MobileFramework.RN_EXPO_SDK52 ? 2 : 6;
  return 5;
}

const CRITERIA_WEIGHTS = {
  devVelocity: 28,
  nativePerformance: 10,
  geofenceSupport: 11,
  faceLivenessCompat: 11,
  bundleSizeScore: 7,
  offlineFirst: 8,
  pushNotifReliability: 7,
  maintainability: 8,
  teamAdoptionRisk: 10,
};

export function calculateMobileFrameworkRecommendation(
  req: MobileRequirements,
): FrameworkRecommendation {
  const frameworks = Object.values(MobileFramework);
  const breakdown: Partial<Record<MobileFramework, FrameworkCriteriaScore>> = {} as any;

  let best: { f: MobileFramework; score: number } | null = null;
  let second: { f: MobileFramework; score: number } | null = null;

  for (const f of frameworks) {
    const base = BASE_SCORES[f];
    const teamPen = scoreTeamSkillPenalty(req.existingTeamSkill, f);
    const geoPen = scoreGeoPenalty(req.geoAccuracyMeters, f);
    const facePen = faceLivenessPenalty(req.faceLivenessLevel, f);
    const pushPen = pushScore(req.pushNotifPriority, f);
    const offlineBonus = req.offlineFirst ? (f === MobileFramework.FLUTTER_3_24 ? 10 : f === MobileFramework.KOTLIN_MULTIPLATFORM ? 11 : 5) : 2;
    const sizePen = req.bundleSizeTargetMB < 25 ? (f === MobileFramework.RN_EXPO_SDK52 ? 8 : f === MobileFramework.FLUTTER_3_24 ? -6 : 2) : 3;
    const timelinePen = req.devTimelineMonths <= 2 ? (f === MobileFramework.RN_EXPO_SDK52 ? 14 : f === MobileFramework.FLUTTER_3_24 ? -5 : f === MobileFramework.KOTLIN_MULTIPLATFORM ? -14 : 0) : 0;

    const devVelocity = scoreWithPenalty(base.devVelocity, CRITERIA_WEIGHTS.devVelocity, true, 0, teamPen * 1.2);
    const nativePerformance = scoreWithPenalty(base.nativePerformance, CRITERIA_WEIGHTS.nativePerformance, true, 0, 0);
    const geofenceSupport = scoreWithPenalty(base.geofenceSupport, CRITERIA_WEIGHTS.geofenceSupport, true, 0, geoPen + (req.backgroundGeoTracking ? 5 : 0));
    const faceLivenessCompat = scoreWithPenalty(base.faceLivenessCompat, CRITERIA_WEIGHTS.faceLivenessCompat, true, 0, facePen + (req.needFacialSDKNativeIntegration ? 3 : 0));
    const bundleSizeScore = scoreWithPenalty(base.bundleSizeScore, CRITERIA_WEIGHTS.bundleSizeScore, true, 0, sizePen);
    const offlineFirst = scoreWithPenalty(base.offlineFirst, CRITERIA_WEIGHTS.offlineFirst, req.offlineFirst, 8, offlineBonus);
    const pushNotifReliability = scoreWithPenalty(base.pushNotifReliability, CRITERIA_WEIGHTS.pushNotifReliability, true, 0, pushPen);
    const maintainability = scoreWithPenalty(base.maintainability, CRITERIA_WEIGHTS.maintainability, true, 0, 0);
    const teamAdoptionRisk = scoreWithPenalty(base.teamAdoptionRisk, CRITERIA_WEIGHTS.teamAdoptionRisk, true, 0, timelinePen);

    const total =
      (devVelocity * CRITERIA_WEIGHTS.devVelocity +
        nativePerformance * CRITERIA_WEIGHTS.nativePerformance +
        geofenceSupport * CRITERIA_WEIGHTS.geofenceSupport +
        faceLivenessCompat * CRITERIA_WEIGHTS.faceLivenessCompat +
        bundleSizeScore * CRITERIA_WEIGHTS.bundleSizeScore +
        offlineFirst * CRITERIA_WEIGHTS.offlineFirst +
        pushNotifReliability * CRITERIA_WEIGHTS.pushNotifReliability +
        maintainability * CRITERIA_WEIGHTS.maintainability +
        teamAdoptionRisk * CRITERIA_WEIGHTS.teamAdoptionRisk) /
      100;

    breakdown[f] = {
      devVelocity, nativePerformance, geofenceSupport, faceLivenessCompat,
      bundleSizeScore, offlineFirst, pushNotifReliability, maintainability,
      teamAdoptionRisk, total,
    };

    if (!best || total > best.score) {
      if (best) second = { f: best.f, score: best.score };
      best = { f, score: total };
    } else if (!second || total > second.score) {
      second = { f, score: total };
    }
  }

  if (!best) throw new Error('Framework score tidak bisa compute');
  let rec = best.f;
  const warnings: string[] = [];
  const reasons: string[] = [];
  reasons.push(`Total skor maksimum: ${best.score}/100.`);
  let pc = PROS_CONS[rec];

  if (req.geoAccuracyMeters <= 5 && rec !== MobileFramework.FLUTTER_3_24 && rec !== MobileFramework.KOTLIN_MULTIPLATFORM) {
    warnings.push(`Geo presisi <=5m membutuhkan native module tambahan untuk framework=${rec}. Presisi real 8-15m. Pertimbangkan Flutter 3.24.`);
  }
  if (req.geoAccuracyMeters <= 10 && req.needFacialSDKNativeIntegration && rec === MobileFramework.RN_EXPO_SDK52) {
    const flu = breakdown[MobileFramework.FLUTTER_3_24]!;
    const exp = breakdown[MobileFramework.RN_EXPO_SDK52]!;
    if (exp.total < flu.total + 4) {
      const swapTo = flu.total >= (breakdown[MobileFramework.KOTLIN_MULTIPLATFORM]?.total ?? 0)
        ? MobileFramework.FLUTTER_3_24
        : MobileFramework.KOTLIN_MULTIPLATFORM;
      best = { f: swapTo, score: breakdown[swapTo]!.total };
      rec = swapTo;
      pc = PROS_CONS[rec];
    }
  }
  if ((req.faceLivenessLevel === 'PASSIVE_VIDEO' || req.faceLivenessLevel === 'LIVENESS_3D') && rec === MobileFramework.RN_EXPO_SDK52) {
    warnings.push('Expo SDK 52 tidak support liveness passive video SDK native Privy/Digisign perlu module react-native bridge / pindah RN CLI 0.75+.');
  }
  if (req.devTimelineMonths <= 2 && rec !== MobileFramework.RN_EXPO_SDK52) {
    warnings.push(`Timeline ${req.devTimelineMonths} bulan ketat. Pertimbangkan modul PWA + WebView face/clock in dulu.`);
  }
  if (req.existingTeamSkill === 'JS_ONLY' && (rec === MobileFramework.FLUTTER_3_24 || rec === MobileFramework.KOTLIN_MULTIPLATFORM)) {
    warnings.push(`Tim JS-only, butuh 2-3 minggu onboarding bahasa ${rec === MobileFramework.FLUTTER_3_24 ? 'Dart' : 'Kotlin'}.`);
  }

  let goNoGo: FrameworkRecommendation['goNoGo'] = 'GO';
  if (best.score < 50) goNoGo = 'NO_GO_USE_PWA_FIRST';
  else if (best.score < 68 || warnings.length >= 2) goNoGo = 'CAUTION';
  if (warnings.length >= 3) goNoGo = 'NO_GO_USE_PWA_FIRST';

  const bud = BUDGET_BASE[rec];
  const timelineWeeks = Math.max(
    Math.round(req.devTimelineMonths * 4.2),
    bud.timeline,
  );
  return {
    recommended: rec,
    runnerUp: second ? second.f : null,
    score: best.score,
    scoreBreakdown: breakdown,
    reasons,
    warnings,
    recommendedPros: pc.pros,
    recommendedCons: pc.cons,
    estimatedBudgetIDR: {
      setupCost: Math.round(bud.setup * (req.iosAndroidBoth ? 1 : 0.7)),
      monthlyOpsCost: Math.round(bud.ops * (best.score / 100)),
      perDeviceSupport: bud.device,
    },
    estimatedTimelineWeeks: timelineWeeks,
    goNoGo,
  };
}

export function formatCurrencyIDR(amount: number): string {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `Rp ${amount?.toLocaleString('id-ID') ?? 'Rp 0'}`;
  }
}
