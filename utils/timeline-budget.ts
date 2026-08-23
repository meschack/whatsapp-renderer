export interface TimelineMemoryCapacity {
  totalMemoryBytes: number | null
  maxMemoryBytes: number | null
}

export interface TimelineBudget {
  tier: 'constrained' | 'balanced' | 'roomy'
  pageSize: number
  maxMessages: number
}

const GIBIBYTE = 1024 ** 3
const MEBIBYTE = 1024 ** 2

export function selectTimelineBudget(capacity: TimelineMemoryCapacity): TimelineBudget {
  const constrained =
    (capacity.totalMemoryBytes !== null && capacity.totalMemoryBytes < 3 * GIBIBYTE) ||
    (capacity.maxMemoryBytes !== null && capacity.maxMemoryBytes <= 256 * MEBIBYTE)

  if (constrained) {
    return { tier: 'constrained', pageSize: 50, maxMessages: 300 }
  }

  const roomy =
    capacity.totalMemoryBytes !== null &&
    capacity.totalMemoryBytes >= 6 * GIBIBYTE &&
    capacity.maxMemoryBytes !== null &&
    capacity.maxMemoryBytes > 512 * MEBIBYTE

  if (roomy) {
    return { tier: 'roomy', pageSize: 100, maxMessages: 600 }
  }

  return { tier: 'balanced', pageSize: 75, maxMessages: 450 }
}
