import EinClient from '../core/EinClient.js';
import path from 'path';
import fs from 'fs';
// import { fileURLToPath } from 'url';
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { BotPlugin } from './types.js';

export default function loadPlugins(client: EinClient): void
{
    const pluginsFolder = path.join(__dirname, './plugins');
    const pluginFiles = fs.readdirSync(pluginsFolder).filter((file) => file.endsWith('.js'));

    pluginFiles.forEach(async (file: string) => {
        const plugin = (await import(`./plugins/${file}`)).default as BotPlugin;
        if (plugin.initialize) plugin.initialize(client);
        client.logger.info(`Loaded plugin: ${plugin.name} v${plugin.version}`);
    });
}