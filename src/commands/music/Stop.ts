import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Stop extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'stop',
            description: {
                content: 'Stops the music and clears the queue',
                examples: ['stop'],
                usage: 'stop',
            },
            category: 'music',
            aliases: ['st'],
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
    public async run(client: EinClient, ctx: Context, args: string[]): Promise<void>
    {
        const queue = Queue.get(ctx.guild.id);
        const embed = this.client.embed();

        queue.stop();

        return ctx.sendMessage({
            embeds: [embed.setColor(this.client.color.main).setDescription(`Stopped the music and cleared the queue`)],
        });
    }
}