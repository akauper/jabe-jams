import { BotPlugin } from '../types.js';
import EinClient from '../../core/EinClient.js';

const antiCrash: BotPlugin = {
    name: 'AntiCrash Plugin',
    version: '1.0.0',
    author: 'Ein',
    initialize: (client: EinClient) =>
    {
        process.on('unhandledRejection', (reason, promise) => {
            client.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
        process.on('uncaughtException', (err) => {
            client.logger.error('Uncaught Exception thrown:', err);
        });
    },
};

export default antiCrash;
