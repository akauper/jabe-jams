import { Event, EinClient } from '../../core/index.js';
import { ActivityType } from 'discord.js';
export default class Ready extends Event {
    constructor(client: EinClient, file: string) {
        super(client, file, {
            name: 'ready',
        });
    }
    public async run(): Promise<void> {
        this.client.logger.success(`${this.client.user?.tag} is ready!`);

        // this.client.user?.setActivity({
        //     name: 'GitHub/Lavamusic',
        //     type: ActivityType.Streaming,
        //     url: 'https://m.twitch.tv/tarik',
        // });
    }
}