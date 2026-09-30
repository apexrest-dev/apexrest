export interface CompositionStatus {
  job: { status: string };
}

/** Only the latest request for unchanged inputs may install a review result. */
export class ReviewRequests {
  private revision = 0;

  invalidate() {
    this.revision++;
  }

  async run<T>(read: () => Promise<T>): Promise<T | undefined> {
    const revision = ++this.revision;
    const result = await read();
    return revision === this.revision ? result : undefined;
  }
}

/** Keep the accepted job while transport errors leave its outcome unknown. */
export class CompositionJobs<T extends CompositionStatus> {
  running = false;
  pending: { id: string; revision: number } | undefined;
  private revision = 0;

  constructor(
    private readonly read: (id: string) => Promise<T>,
    private readonly observed: (response: T) => void,
    private readonly changed: () => void,
    private readonly failed: (error: unknown, paused: boolean) => void,
    private readonly wait = () => new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ) {}

  invalidate() {
    this.revision++;
  }

  async run(start: () => Promise<string>): Promise<{ response: T; current: boolean } | undefined> {
    if (this.running) return;
    this.running = true;
    this.changed();
    try {
      if (!this.pending) {
        const revision = this.revision;
        this.pending = { id: await start(), revision };
        this.changed();
      }
      const job = this.pending;
      let failures = 0;
      for (;;) {
        let response: T;
        try {
          response = await this.read(job.id);
          failures = 0;
        } catch (error) {
          const paused = ++failures >= 3;
          this.failed(error, paused);
          if (paused) return;
          await this.wait();
          continue;
        }
        this.observed(response);
        if (!['queued', 'running', 'cancelling'].includes(response.job.status)) {
          this.pending = undefined;
          return { response, current: job.revision === this.revision };
        }
        await this.wait();
      }
    } finally {
      this.running = false;
      this.changed();
    }
  }
}
