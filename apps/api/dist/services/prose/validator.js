export class ProseValidator {
    static validateDraft(scenePlan, proseContent, wordCount) {
        const failures = [];
        // 1. Minimum word count
        if (wordCount < 100) {
            failures.push({
                type: 'STRUCTURAL',
                severity: 'ERROR',
                message: 'Prose is too short. Expected at least 100 words.'
            });
        }
        // 2. Scene Objective addressed (heuristic)
        if (!proseContent.toLowerCase().includes(scenePlan.povCharacter.toLowerCase().split(' ')[0])) {
            failures.push({
                type: 'CONTENT',
                severity: 'WARNING',
                message: 'POV Character name does not appear to be present in the prose.'
            });
        }
        // 3. Continuity Constraints - check if prohibited knowledge leaked
        // For mock purposes, just a placeholder.
        if (proseContent.includes('OMNISCIENT_SECRET')) {
            failures.push({
                type: 'CONTINUITY',
                severity: 'ERROR',
                message: 'Prose leaked global truth not available to POV.'
            });
        }
        const passed = failures.filter(f => f.severity === 'ERROR').length === 0;
        return {
            passed,
            score: passed ? 100 : 50,
            failures
        };
    }
}
