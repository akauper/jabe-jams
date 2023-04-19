import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Leave extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'leave',
            description: {
                content: 'Leaves the voice channel',
                examples: ['leave'],
                usage: 'leave',
            },
            category: 'music',
            aliases: ['dc'],
            cooldown: 3,
            args: false,
            player: {
                voice: true,
                dj: true,
                active: false,
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

        if(!Queue.exists(ctx.guild.id))
        {
            return ctx.sendSimpleErrorMessage(`I'm not in a voice channel.`);
        }

        const queue = Queue.get(ctx.guild.id);
        const embed = this.client.embed();
        ctx.sendMessage({
            embeds: [
                embed.setColor(this.client.color.main).setDescription(`Left <#${queue.voiceChannel.name}>`),
            ],
        });
        queue.destroy();
    }
}