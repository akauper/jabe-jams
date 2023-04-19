import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class QueueCommand extends Command
{
    constructor(client : EinClient)
    {
        super(client,
            {
               name: 'queue',
                description: {
                    content: 'Shows the current queue',
                    examples: ['queue'],
                    usage: 'queue',
                },
                category: 'music',
                aliases: ['q'],
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

    public async run(client: EinClient, ctx : Context, args: string[]) : Promise<void>
    {
        const queue = Queue.get(ctx.guild.id);
        if(!queue)
        {
            return ctx.sendSimpleErrorMessage('Not connected to a voice channel. The queue is empty.');
        }
        if(!queue.currentPlayable || queue.length === 0)
        {
            return ctx.sendSimpleMessage('The queue is empty.');
        }

        if(queue.length == 1)
        {
            return ctx.sendMessage(
                {
                    embeds:
                        [
                            this.client.embed()
                                .setColor(this.client.color.main)
                                .setDescription(
                                    `Now playing: [${queue.currentPlayable.name}](${queue.currentPlayable.url}) - Requested By: ${
                                        queue.currentPlayable?.requestedBy}`
                                ),
                        ],
                });
        }
        const queueString = queue.playables.map(
            (track, index) =>
                `${index + 1}. [${track.name}](${track.url}) - Requested By: ${track?.requestedBy}`,
        );

        let chunks = client.utils.chunk(queueString, 10) as any;
        if(chunks.length === 0) chunks = 1;
        const pages = [];
        for(let i = 0; i < chunks.length; i++)
        {
            const embed = this.client.embed()
                .setColor(this.client.color.main)
                .setAuthor({ name: 'Queue', iconURL: ctx.guild.iconURL({})})
                .setDescription(chunks[i].join('\n'))
                .setFooter({ text: `Page ${i + 1} of ${chunks.length}` });
            pages.push(embed);
        }

        return client.utils.paginate(ctx, pages);
    }
}