import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Resume extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'resume',
            description: {
                content: 'Resumes the current song',
                examples: ['resume'],
                usage: 'resume',
            },
            category: 'music',
            aliases: ['r', 'unpause'],
            cooldown: 3,
            args: false,
            player: {
                voice: true,
                dj: false,
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
        if(!queue)
        {
            return ctx.sendSimpleErrorMessage('Nothing to unpause.')
        }
        const embed = this.client.embed();
        if (!queue.isPaused)
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription('The player is not paused.')],
            });
        queue.unpause();

        return ctx.sendMessage({
            embeds: [embed.setColor(this.client.color.main).setDescription(`Resumed the player`)],
        });
    }
}