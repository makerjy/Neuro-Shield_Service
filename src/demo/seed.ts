import { HERO_CASE_ID } from "./demoConfig";

export interface Person {
  personId: string;
  name: string;
  sex: "M" | "F";
  birthYear: number;
  phoneMasked: string;
  region: { sido: string; sigungu: string; eupmyeondong?: string };
}

export interface Case {
  caseId: string;
  personId: string;
  currentStage: "STAGE1" | "STAGE2" | "STAGE3";
  stage1: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
    riskScore?: number;
    riskBand?: "LOW" | "MID" | "HIGH";
    keyFactors?: string[];
  };
  stage2: {
    status: "NOT_READY" | "LABS_RECEIVED" | "MODEL_RUNNING" | "DONE";
    labs?: {
      blood?: Record<string, number>;
      cognition?: Record<string, number>;
      biomarker?: Record<string, number>;
      receivedAt?: string;
    };
    classification?: {
      label: "NORMAL" | "MCI_LOW" | "MCI_HIGH" | "AD";
      probs: Record<string, number>;
      reasons?: string[];
    };
  };
  stage3: {
    status: "NOT_STARTED" | "MODEL_RUNNING" | "DONE";
    inputs?: { annFeaturesReady: boolean; cnnMriScore?: number; note?: string };
    conversionRisk?: { horizonYears: 2; yearly: Array<{ year: 1 | 2; prob: number }>; updatedAt: string };
    carePlan?: Array<{
      title: string;
      owner: "센터" | "병원" | "보호자" | "본인";
      dueAt: string;
      status: "TODO" | "DOING" | "DONE";
    }>;
  };
  ops: {
    contactPriority: "LOW" | "MID" | "HIGH";
    ownerType: "AGENT" | "COUNSELOR";
    loopStep: { stage1Step: number; stage2Step: number; stage3Step: number };
  };
  updatedAt: string;
}

export interface ModelJob {
  jobId: string;
  caseId: string;
  stage: "STAGE1" | "STAGE2" | "STAGE3";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  startedAt?: string;
  etaSeconds?: number;
  progress: number;
  resultRef?: string;
}

export interface TimelineEvent {
  ts: string;
  caseId: string;
  type:
    | "STAGE1_MODEL_REQUESTED"
    | "STAGE1_MODEL_DONE"
    | "STAGE2_LABS_RECEIVED"
    | "STAGE2_MODEL_REQUESTED"
    | "STAGE2_MODEL_DONE"
    | "PROMOTED_TO_STAGE2"
    | "PROMOTED_TO_STAGE3"
    | "STAGE3_MODEL_REQUESTED"
    | "STAGE3_MODEL_DONE"
    | "CAREPLAN_CREATED";
  summary: string;
  meta?: Record<string, any>;
}

export type DemoSeedData = {
  persons: Person[];
  cases: Case[];
  jobs: ModelJob[];
  timeline: TimelineEvent[];
};

function toIso(base: Date, dayOffset: number, hour = 9, minute = 0) {
  const date = new Date(base);
  date.setDate(base.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function withUpdate(input: Omit<Case, "updatedAt">, updatedAt: string): Case {
  return {
    ...input,
    updatedAt,
  };
}

function buildNoisePersons(): Person[] {
  return [
    {
      personId: "PERSON-1001",
      name: "박○○",
      sex: "M",
      birthYear: 1956,
      phoneMasked: "010-****-2188",
      region: { sido: "서울특별시", sigungu: "서초구" },
    },
    {
      personId: "PERSON-1002",
      name: "이○○",
      sex: "F",
      birthYear: 1953,
      phoneMasked: "010-****-7632",
      region: { sido: "서울특별시", sigungu: "송파구" },
    },
    {
      personId: "PERSON-1003",
      name: "정○○",
      sex: "F",
      birthYear: 1960,
      phoneMasked: "010-****-4408",
      region: { sido: "서울특별시", sigungu: "강동구" },
    },
    {
      personId: "PERSON-1004",
      name: "최○○",
      sex: "M",
      birthYear: 1951,
      phoneMasked: "010-****-8955",
      region: { sido: "서울특별시", sigungu: "관악구" },
    },
    {
      personId: "PERSON-1005",
      name: "한○○",
      sex: "F",
      birthYear: 1958,
      phoneMasked: "010-****-1204",
      region: { sido: "서울특별시", sigungu: "강남구" },
    },
    {
      personId: "PERSON-1006",
      name: "윤○○",
      sex: "M",
      birthYear: 1955,
      phoneMasked: "010-****-9024",
      region: { sido: "서울특별시", sigungu: "강서구" },
    },
    {
      personId: "PERSON-1007",
      name: "문○○",
      sex: "F",
      birthYear: 1952,
      phoneMasked: "010-****-3021",
      region: { sido: "서울특별시", sigungu: "마포구" },
    },
    {
      personId: "PERSON-1008",
      name: "강○○",
      sex: "M",
      birthYear: 1954,
      phoneMasked: "010-****-5550",
      region: { sido: "서울특별시", sigungu: "노원구" },
    },
  ];
}

export function createDemoSeedData(baseDate = new Date()): DemoSeedData {
  const heroPerson: Person = {
    personId: "PERSON-HERO-001",
    name: "이재용",
    sex: "M",
    birthYear: 1959,
    phoneMasked: "010-****-1234",
    region: { sido: "서울특별시", sigungu: "강남구", eupmyeondong: "대치동" },
  };

  const noisePersons = buildNoisePersons();
  const persons = [heroPerson, ...noisePersons];

  const heroCase = withUpdate(
    {
      caseId: HERO_CASE_ID,
      personId: heroPerson.personId,
      currentStage: "STAGE1",
      stage1: { status: "NOT_STARTED" },
      stage2: { status: "NOT_READY" },
      stage3: { status: "NOT_STARTED" },
      ops: {
        contactPriority: "MID",
        ownerType: "AGENT",
        loopStep: { stage1Step: 1, stage2Step: 0, stage3Step: 0 },
      },
    },
    toIso(baseDate, -1, 9, 40),
  );

  const noiseCases: Case[] = [
    withUpdate(
      {
        caseId: "CASE-NS-1001",
        personId: "PERSON-1001",
        currentStage: "STAGE1",
        stage1: {
          status: "DONE",
          riskScore: 61,
          riskBand: "MID",
          keyFactors: ["수면 패턴 변동", "혈압 변동성"],
        },
        stage2: { status: "NOT_READY" },
        stage3: { status: "NOT_STARTED" },
        ops: {
          contactPriority: "MID",
          ownerType: "COUNSELOR",
          loopStep: { stage1Step: 3, stage2Step: 0, stage3Step: 0 },
        },
      },
      toIso(baseDate, -2, 15, 0),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1002",
        personId: "PERSON-1002",
        currentStage: "STAGE2",
        stage1: {
          status: "DONE",
          riskScore: 74,
          riskBand: "HIGH",
          keyFactors: ["기억력 저하 호소", "활동량 감소"],
        },
        stage2: {
          status: "LABS_RECEIVED",
          labs: {
            cognition: { MMSE: 24, MoCA: 20 },
            blood: { HbA1c: 6.1, LDL: 145 },
            biomarker: { pTau: 1.4 },
            receivedAt: toIso(baseDate, -1, 11, 15),
          },
        },
        stage3: { status: "NOT_STARTED" },
        ops: {
          contactPriority: "HIGH",
          ownerType: "COUNSELOR",
          loopStep: { stage1Step: 3, stage2Step: 2, stage3Step: 0 },
        },
      },
      toIso(baseDate, -1, 11, 15),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1003",
        personId: "PERSON-1003",
        currentStage: "STAGE2",
        stage1: {
          status: "DONE",
          riskScore: 58,
          riskBand: "MID",
          keyFactors: ["대사 위험", "인지검사 경계값"],
        },
        stage2: {
          status: "DONE",
          labs: {
            cognition: { MMSE: 25, MoCA: 22 },
            blood: { HbA1c: 5.9, LDL: 137 },
            receivedAt: toIso(baseDate, -3, 13, 10),
          },
          classification: {
            label: "MCI_LOW",
            probs: { NORMAL: 0.19, MCI_LOW: 0.63, MCI_HIGH: 0.14, AD: 0.04 },
            reasons: ["인지검사 경계", "생활패턴 가변성"],
          },
        },
        stage3: { status: "NOT_STARTED" },
        ops: {
          contactPriority: "MID",
          ownerType: "AGENT",
          loopStep: { stage1Step: 3, stage2Step: 4, stage3Step: 0 },
        },
      },
      toIso(baseDate, -2, 10, 20),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1004",
        personId: "PERSON-1004",
        currentStage: "STAGE3",
        stage1: {
          status: "DONE",
          riskScore: 82,
          riskBand: "HIGH",
          keyFactors: ["인지기능 저하 신호", "혈관성 위험", "수면 불안정"],
        },
        stage2: {
          status: "DONE",
          labs: {
            cognition: { MMSE: 21, MoCA: 17 },
            blood: { HbA1c: 6.8, LDL: 165 },
            biomarker: { pTau: 1.9 },
            receivedAt: toIso(baseDate, -9, 10, 30),
          },
          classification: {
            label: "MCI_HIGH",
            probs: { NORMAL: 0.04, MCI_LOW: 0.11, MCI_HIGH: 0.75, AD: 0.1 },
            reasons: ["인지검사 저하", "혈액 지표 위험", "수면 리듬 저하"],
          },
        },
        stage3: {
          status: "DONE",
          inputs: { annFeaturesReady: true, cnnMriScore: 0.58 },
          conversionRisk: {
            horizonYears: 2,
            yearly: [
              { year: 1, prob: 0.2 },
              { year: 2, prob: 0.36 },
            ],
            updatedAt: toIso(baseDate, -6, 14, 0),
          },
          carePlan: [
            { title: "생활습관 코칭", owner: "센터", dueAt: toIso(baseDate, 5, 9, 0), status: "DOING" },
            { title: "가족 상담", owner: "보호자", dueAt: toIso(baseDate, 8, 13, 0), status: "TODO" },
            { title: "정기 MRI 연계", owner: "병원", dueAt: toIso(baseDate, 20, 11, 0), status: "TODO" },
            { title: "자가 운동 루틴", owner: "본인", dueAt: toIso(baseDate, 2, 18, 0), status: "DONE" },
          ],
        },
        ops: {
          contactPriority: "HIGH",
          ownerType: "COUNSELOR",
          loopStep: { stage1Step: 3, stage2Step: 4, stage3Step: 3 },
        },
      },
      toIso(baseDate, -1, 16, 10),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1005",
        personId: "PERSON-1005",
        currentStage: "STAGE1",
        stage1: { status: "NOT_STARTED" },
        stage2: { status: "NOT_READY" },
        stage3: { status: "NOT_STARTED" },
        ops: {
          contactPriority: "LOW",
          ownerType: "AGENT",
          loopStep: { stage1Step: 1, stage2Step: 0, stage3Step: 0 },
        },
      },
      toIso(baseDate, -1, 8, 50),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1006",
        personId: "PERSON-1006",
        currentStage: "STAGE2",
        stage1: {
          status: "DONE",
          riskScore: 67,
          riskBand: "MID",
          keyFactors: ["사회활동 감소", "수면 단절"],
        },
        stage2: { status: "NOT_READY" },
        stage3: { status: "NOT_STARTED" },
        ops: {
          contactPriority: "MID",
          ownerType: "COUNSELOR",
          loopStep: { stage1Step: 3, stage2Step: 1, stage3Step: 0 },
        },
      },
      toIso(baseDate, -1, 10, 0),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1007",
        personId: "PERSON-1007",
        currentStage: "STAGE3",
        stage1: {
          status: "DONE",
          riskScore: 76,
          riskBand: "HIGH",
          keyFactors: ["인지저하 추세", "혈관성 동반위험"],
        },
        stage2: {
          status: "DONE",
          labs: {
            cognition: { MMSE: 22, MoCA: 19 },
            blood: { HbA1c: 6.3, LDL: 152 },
            receivedAt: toIso(baseDate, -8, 9, 30),
          },
          classification: {
            label: "MCI_HIGH",
            probs: { NORMAL: 0.05, MCI_LOW: 0.13, MCI_HIGH: 0.72, AD: 0.1 },
            reasons: ["인지검사 저하", "혈액 지표 위험"],
          },
        },
        stage3: {
          status: "NOT_STARTED",
        },
        ops: {
          contactPriority: "HIGH",
          ownerType: "COUNSELOR",
          loopStep: { stage1Step: 3, stage2Step: 4, stage3Step: 1 },
        },
      },
      toIso(baseDate, -1, 17, 5),
    ),
    withUpdate(
      {
        caseId: "CASE-NS-1008",
        personId: "PERSON-1008",
        currentStage: "STAGE1",
        stage1: {
          status: "DONE",
          riskScore: 44,
          riskBand: "LOW",
          keyFactors: ["인지검사 정상 범위"],
        },
        stage2: { status: "NOT_READY" },
        stage3: { status: "NOT_STARTED" },
        ops: {
          contactPriority: "LOW",
          ownerType: "AGENT",
          loopStep: { stage1Step: 2, stage2Step: 0, stage3Step: 0 },
        },
      },
      toIso(baseDate, -1, 12, 5),
    ),
  ];

  const timeline: TimelineEvent[] = [];

  return {
    persons,
    cases: [heroCase, ...noiseCases],
    jobs: [],
    timeline,
  };
}
