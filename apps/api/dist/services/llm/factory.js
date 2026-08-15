import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { GoogleProvider } from './providers/GoogleProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { MockProvider } from './providers/MockProvider.js';
import { NineRouterProvider } from './providers/NineRouterProvider.js';
export class ProviderFactory {
    static getProvider(stage, explicitlyRequestedProvider, explicitlyRequestedModel) {
        // 1. Explicitly requested
        let providerName = explicitlyRequestedProvider;
        let modelName = explicitlyRequestedModel;
        // 2. Stage-specific environment variables
        if (!providerName && stage) {
            providerName = process.env[`${stage}_LLM_PROVIDER`];
            modelName = modelName || process.env[`${stage}_LLM_MODEL`];
        }
        // 3. Global environment fallback
        if (!providerName) {
            providerName = process.env.LLM_PROVIDER;
        }
        const name = (providerName || 'mock').toLowerCase();
        switch (name) {
            case 'openai':
                return new OpenAIProvider(undefined, modelName);
            case 'anthropic':
                return new AnthropicProvider(undefined, modelName);
            case 'google':
                return new GoogleProvider(undefined, modelName);
            case 'ollama':
                return new OllamaProvider(undefined, modelName);
            case '9router':
                return new NineRouterProvider(undefined, undefined, modelName);
            case 'mock':
            default:
                return new MockProvider();
        }
    }
}
