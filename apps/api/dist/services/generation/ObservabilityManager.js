export class ObservabilityManager {
    static instance;
    // For DB-free tests
    events = [];
    constructor() { }
    static getInstance() {
        if (!ObservabilityManager.instance) {
            ObservabilityManager.instance = new ObservabilityManager();
        }
        return ObservabilityManager.instance;
    }
    recordEvent(event) {
        this.events.push(event);
        // In production, this would emit to Datadog, Prometheus, or save to DB.
        // console.log(`[OBSERVABILITY] Event ${event.stage} - ${event.status}`);
    }
    getEvents() {
        return this.events;
    }
    resetMemoryStore() {
        this.events = [];
    }
}
