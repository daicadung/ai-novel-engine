import { GenerateSceneProseSchema } from '@ane/core';
import { ProseValidator } from './validator.js';
export class ProseStageHandler {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async invokeWithRetries(contextPrompt, scenePlan, maxRetries = 3) {
        let attempts = 0;
        let lastContent = "";
        let lastWordCount = 0;
        let lastReport = null;
        while (attempts < maxRetries) {
            attempts++;
            const fullPrompt = attempts === 1
                ? `${contextPrompt}\nSTAGE: PROSE_GENERATION`
                : `${contextPrompt}\nSTAGE: PROSE_REVISION\nPREVIOUS_FAILURES: ${JSON.stringify(lastReport?.failures)}`;
            const messages = [{ role: "user", content: fullPrompt }];
            const draft = await this.provider.generateStructured(messages, GenerateSceneProseSchema);
            const report = ProseValidator.validateDraft(scenePlan, draft.content, draft.wordCount);
            lastContent = draft.content;
            lastWordCount = draft.wordCount;
            lastReport = report;
            if (report.passed) {
                return { content: draft.content, wordCount: draft.wordCount, validationReport: report, attempts };
            }
        }
        return { content: lastContent, wordCount: lastWordCount, validationReport: lastReport, attempts };
    }
}
