import type { AgentInfo } from '../types/types.js';
export declare class HerdrSessionManager {
    startAgent(name: string, cwd: string, argv: string[], options?: {
        tab?: string;
        workspace?: string;
        split?: 'right' | 'down';
        env?: Record<string, string>;
        focus?: boolean;
    }): Promise<AgentInfo>;
    private startAgentWithRetry;
    waitForStatus(paneId: string, status?: 'done' | 'idle' | 'working' | 'blocked', timeoutMs?: number): Promise<void>;
    readPaneOutput(paneId: string, source?: 'visible' | 'recent'): Promise<string>;
    agentSendKeys(target: string, keys: string[]): Promise<void>;
    agentPrompt(target: string, text: string): Promise<void>;
    closePane(paneId: string): Promise<void>;
    listAgents(): Promise<AgentInfo[]>;
    getAgent(name: string): Promise<AgentInfo | null>;
}
//# sourceMappingURL=herdr-session.d.ts.map