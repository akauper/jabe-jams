import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class ClearQueue extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'clear',
            description: {
                content: 'Clears the queue',
                examples: ['clear'],
                usage: 'clear',
            },
            category: 'music',
            aliases: ['cq', 'clearqueue'],
            cooldown: 3,
            args: false,
            player: {
                voice: true,
                dj: true,
                active: true,
                djPerm: null,
            },
            permissions: {
                dev: false,
                client: ['SendMessages', 'ViewChannel', 'EmbedLinks'],
                user: [],
            },
            slashCommand: true,
            options: [],
        });
    }
    public async run(client: EinClient, ctx: Context, args: string[]): Promise<void> {
        const queue = Queue.get(ctx.guild.id);
        if(!queue || (queue && queue.length === 0 && !queue.currentPlayable))
        {
            return ctx.sendSimpleErrorMessage(`The queue is empty.`);
            return;
        }

        queue.clear();
        return ctx.sendMessage('The queue has been cleared.');
    }
}