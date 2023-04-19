import { Command, Context, EinClient, Queue } from '../../core/index.js';
import { ChannelType } from 'discord.js';

export default class Join extends Command {
    constructor(client: EinClient) {
        super(client, {
            name: 'join',
            description: {
                content: 'Joins the voice channel',
                examples: ['join'],
                usage: 'join',
            },
            category: 'music',
            aliases: ['j'],
            cooldown: 3,
            args: false,
            player: {
                voice: true,
                dj: false,
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
    public async run(client: EinClient, ctx: Context, args: string[]): Promise<void>
    {
        let queue = Queue.get(ctx.guild.id);
        const alreadyInChannel = queue
            && ctx.guildMember.voice
            && ctx.guildMember.voice.channel
            && ctx.guildMember.voice.channel.type == ChannelType.GuildVoice
            && ctx.guildMember.voice.channel.id == queue.voiceChannel.id

        if(alreadyInChannel)
            return ctx.sendSimpleMessage(`I'm already connected to ${queue.voiceChannel.name}`);
        else
        {
            queue = await Queue.getOrCreate(ctx.guildMember);
            return ctx.sendSimpleMessage(`Joined <#${queue.voiceChannel.name}>`);
        }
    }
}