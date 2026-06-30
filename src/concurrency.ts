export class AdaptiveConcurrency {
  private chunkSize: number
  private consecutiveErrors = 0
  private consecutiveSuccesses = 0

  constructor(
    private readonly initialChunkSize = 75,
    private readonly minChunkSize = 5,
    private readonly maxChunkSize = 150,
    private readonly decreaseFactor = 0.65,
    private readonly increaseStep = 5,
    private readonly successThreshold = 20,
  ) {
    this.chunkSize = initialChunkSize
  }

  getChunkSize(): number {
    return this.chunkSize
  }

  getBackoffMs(): number {
    if (this.consecutiveErrors === 0) return 0
    return Math.min(2000, 50 * Math.pow(2, Math.min(this.consecutiveErrors, 5)))
  }

  recordSuccess(): void {
    this.consecutiveErrors = 0
    this.consecutiveSuccesses++

    if (
      this.consecutiveSuccesses >= this.successThreshold &&
      this.chunkSize < this.maxChunkSize
    ) {
      this.chunkSize = Math.min(this.maxChunkSize, this.chunkSize + this.increaseStep)
      this.consecutiveSuccesses = 0
    }
  }

  recordError(): void {
    this.consecutiveSuccesses = 0
    this.consecutiveErrors++

    this.chunkSize = Math.max(
      this.minChunkSize,
      Math.floor(this.chunkSize * this.decreaseFactor),
    )
  }

  reset(): void {
    this.chunkSize = this.initialChunkSize
    this.consecutiveErrors = 0
    this.consecutiveSuccesses = 0
  }
}

export const generationConcurrency = new AdaptiveConcurrency()