import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Remove extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'remove',
            description: {
                content: 'Removes a song from the queue',
                examples: ['remove 1'],
                usage: 'remove <song number>',
            },
            category: 'music',
            aliases: ['rm'],
            cooldown: 3,
            args: true,
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
            options: [
                {
                    name: 'song',
                    description: 'The song number',
                    type: 4,
                    required: true,
                },
            ],
        });
    }
    public async run(client: EinClient, ctx: Context, args: string[]): Promise<void>
    {
        const queue = Queue.get(ctx.guild.id);
        if(!queue || queue.empty)
        {
            return ctx.sendSimpleErrorMessage(`There are no songs in the queue.`);
        }
        const embed = this.client.embed();

        if (isNaN(Number(args[0])))
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription('That is not a valid number.')],
            });
        if (Number(args[0]) > queue.length)
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription('That is not a valid number.')],
            });
        if (Number(args[0]) < 1)
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription('That is not a valid number.')],
            });

        if(Number(args[0]) == 1)
            return ctx.sendSimpleErrorMessage('Cannot remove current playing song. Use "Stop" or "Skip" command instead');

        queue.removePlayableAtIndex(Number(args[0]) - 1);
        return ctx.sendMessage({
            embeds: [
                embed.setColor(this.client.color.main).setDescription(`Removed song number ${Number(args[0])} from the queue`),
            ],
        });
    }
}