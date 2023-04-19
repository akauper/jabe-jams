import EinClient from '../core/EinClient.js';

export interface BotPlugin {
    name: string;
    version: string;
    author: string;
    description?: string;
    initialize: (client: EinClient) => void;
    shutdown?: (client: EinClient) => void;
}