import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Skip extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'skip',
            description: {
                content: 'Skips the current song',
                examples: ['skip'],
                usage: 'skip',
            },
            category: 'music',
            aliases: ['s'],
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
        const embed = this.client.embed();
        if (!queue || queue.empty)
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription('There are no songs in the queue.')],
            });
        queue.skip();
        if (!ctx.isInteraction) {
            ctx.message?.react('👍');
        }
    }
}