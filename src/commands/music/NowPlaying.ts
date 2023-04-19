import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class NowPlaying extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'nowplaying',
            description: {
                content: 'Shows the currently playing song',
                examples: ['nowplaying'],
                usage: 'nowplaying',
            },
            category: 'music',
            aliases: ['np', 'current'],
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
        const embed = client.embed().setColor(client.color.main);
        let queue = Queue.get(ctx.guild.id);
        if(!queue || (queue && queue.length === 0 && !queue.currentPlayable))
        {
            return ctx.sendSimpleErrorMessage('Nothing is playing.');
        }
        const track = queue.currentPlayable;
        const position = queue.voiceStream.streamCurrentTimeMS;
        const duration = queue.voiceStream.currentStreamableDurationMS;
        const bar = client.utils.progressBar(position, duration, 20);
        const embed1 = this.client
            .embed()
            .setColor(this.client.color.main)
            .setAuthor({ name: 'Now Playing', iconURL: ctx.guild.iconURL({}) })
            .setThumbnail(track.thumbnail)
            .setDescription(`[${track.name}](${track.url}) - Request By: ${track.requestedBy}\n\n\`${bar}\``)
            .addFields({
                name: '\u200b',
                value: `\`${client.utils.formatTime(position)} / ${client.utils.formatTime(duration)}\``,
            });
        return ctx.sendMessage({ embeds: [embed1] });
    }
}