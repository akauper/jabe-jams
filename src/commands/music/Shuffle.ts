import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Shuffle extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'shuffle',
            description: {
                content: 'Shuffles the queue',
                examples: ['shuffle'],
                usage: 'shuffle',
            },
            category: 'music',
            aliases: ['sh'],
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
        if(!queue || queue.empty)
            return ctx.sendSimpleErrorMessage('There are no songs in the queue');
        const embed = this.client.embed();
        queue.shuffle();

        return ctx.sendMessage({
            embeds: [embed.setColor(this.client.color.main).setDescription(`Shuffled the queue`)],
        });
    }
}