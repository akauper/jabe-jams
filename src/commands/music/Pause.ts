import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Pause extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'pause',
            description: {
                content: 'Pauses the current song',
                examples: ['pause'],
                usage: 'pause',
            },
            category: 'music',
            aliases: [],
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
        if(!queue || !queue.isPlaying)
        {
            return ctx.sendSimpleErrorMessage(`There is nothing playing.`);
        }
        const embed = this.client.embed();
        console.log(queue);
        if (!queue.isPaused)
        {
            queue.pause();
            return ctx.sendSimpleMessage(`Paused the song.`);
        }
        else
        {
            return ctx.sendSimpleErrorMessage(`The song is already paused.`)
        }
    }
}