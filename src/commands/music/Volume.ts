import { Command, Context, EinClient, Queue } from '../../core/index.js';

export default class Volume extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'volume',
            description: {
                content: 'Sets the volume of the player',
                examples: ['volume 100'],
                usage: 'volume <number>',
            },
            category: 'music',
            aliases: ['vol'],
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
                    name: 'number',
                    description: 'The volume you want to set',
                    type: 4,
                    required: true,
                },
            ],
        });
    }
    public async run(client: EinClient, ctx: Context, args: string[]): Promise<void> {
        const queue = Queue.get(ctx.guild.id);
        const embed = this.client.embed();
        const number = Number(args[0]);
        if (isNaN(number))
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription('Please provide a valid number.')],
            });
        if (number > 200)
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription("The volume can't be higher than 200.")],
            });
        if (number < 0)
            return ctx.sendMessage({
                embeds: [embed.setColor(this.client.color.red).setDescription("The volume can't be lower than 0.")],
            });
        queue.voiceStream.volume = number / 100.0;
        return ctx.sendMessage({
            embeds: [
                embed.setColor(this.client.color.main).setDescription(`Set the volume to ${(queue.voiceStream.volume * 100.0).toFixed()}`),
            ],
        });
    }
}