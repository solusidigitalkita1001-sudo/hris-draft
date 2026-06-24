export enum ReviewCycleType {
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL',
  MONTHLY = 'MONTHLY',
}

export enum ReviewCycleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum ReviewType {
  SELF = 'SELF',
  MANAGER = 'MANAGER',
  PEER = 'PEER',
  SUBORDINATE = 'SUBORDINATE',
  FULL_360 = 'FULL_360',
}

export enum ReviewStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
}

export enum FeedbackStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
}

export enum GoalStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum GoalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
