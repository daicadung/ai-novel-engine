import { GenerationEvent } from '@ane/core';

export class ObservabilityManager {
  private static instance: ObservabilityManager;
  
  // For DB-free tests
  private events: GenerationEvent[] = [];

  private constructor() {}

  static getInstance(): ObservabilityManager {
    if (!ObservabilityManager.instance) {
      ObservabilityManager.instance = new ObservabilityManager();
    }
    return ObservabilityManager.instance;
  }

  recordEvent(event: GenerationEvent) {
    this.events.push(event);
    // In production, this would emit to Datadog, Prometheus, or save to DB.
    // console.log(`[OBSERVABILITY] Event ${event.stage} - ${event.status}`);
  }

  getEvents(): GenerationEvent[] {
    return this.events;
  }

  resetMemoryStore() {
    this.events = [];
  }
}
