export interface AdaptiveConcurrencyOptions {
  initialChunkSize?: number
  minChunkSize?: number
  maxChunkSize?: number
}

export class AdaptiveConcurrency {
  private chunkSize: number
  private consecutiveErrors = 0
  private consecutiveSuccesses = 0
  private initialChunkSize: number
  private readonly minChunkSize: number
  private maxChunkSize: number
  private readonly decreaseFactor = 0.65
  private readonly increaseStep = 5
  private readonly successThreshold = 20

  constructor(options: AdaptiveConcurrencyOptions = {}) {
    this.initialChunkSize = options.initialChunkSize ?? 75
    this.minChunkSize = options.minChunkSize ?? 5
    this.maxChunkSize = options.maxChunkSize ?? 150
    this.chunkSize = this.initialChunkSize
  }

  configure(options: AdaptiveConcurrencyOptions) {
    if (options.initialChunkSize != null) {
      this.initialChunkSize = options.initialChunkSize
      this.chunkSize = options.initialChunkSize
    }
    if (options.maxChunkSize != null) {
      this.maxChunkSize = options.maxChunkSize
      this.chunkSize = Math.min(this.chunkSize, this.maxChunkSize)
    }
    this.consecutiveErrors = 0
    this.consecutiveSuccesses = 0
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

type QueueTask<T> = {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export class RequestQueue {
  private running = 0
  private queue: QueueTask<unknown>[] = []
  private maxConcurrent: number

  constructor(maxConcurrent = 40) {
    this.maxConcurrent = maxConcurrent
  }

  setMaxConcurrent(maxConcurrent: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent)
    this.drain()
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject } as QueueTask<unknown>)
      this.drain()
    })
  }

  private drain() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.running++
      task
        .fn()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.running--
          this.drain()
        })
    }
  }
}

export const panoRequestQueue = new RequestQueue()

export function configurePanoRequestQueue(maxConcurrent: number) {
  panoRequestQueue.setMaxConcurrent(maxConcurrent)
}

export function configureGenerationConcurrency(options: AdaptiveConcurrencyOptions) {
  generationConcurrency.configure(options)
}