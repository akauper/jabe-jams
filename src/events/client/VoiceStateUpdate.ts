import { Event, EinClient, Queue } from '../../core/index.js';
import { ChannelType } from 'discord.js';

export default class VoiceStateUpdate extends Event {
    constructor(client: EinClient, file: string) {
        super(client, file, {
            name: 'voiceStateUpdate',
        });
    }
    public async run(oldState: any, newState: any): Promise<void> {
        const guildId = newState.guild.id;
        if (!guildId) return;
        const queue = Queue.get(guildId);
        if (!queue) return;
        if (newState.guild.members.cache.get(this.client.user.id) &&
            !newState.guild.members.cache.get(this.client.user.id).voice.channelId)
        {
            if (queue) {
                return queue.destroy();
            }
        }
        if (newState.id === this.client.user.id &&
            newState.channelId &&
            newState.channel.type == ChannelType.GuildStageVoice &&
            newState.guild.members.me.voice.suppress)
        {
            if (newState.guild.members.me.permissions.has(['Connect', 'Speak']) ||
                newState.channel.permissionsFor(newState.guild.members.me).has('MuteMembers'))
            {
                await newState.guild.members.me.voice.setSuppressed(false).catch(() => {});
            }
        }
        if (newState.id == this.client.user.id) return;
        const vc = newState.guild.channels.cache.get(queue.voiceChannel.id);
        if (
            newState.id === this.client.user.id &&
            !newState.serverDeaf &&
            vc &&
            vc.permissionsFor(newState.guild.member.me).has('DeafenMembers')
        )
            await newState.setDeaf(true);
        if (newState.id === this.client.user.id && newState.serverMute && !queue.isPaused) queue.pause();
        if (newState.id === this.client.user.id && !newState.serverMute && queue.isPaused) queue.pause();

        let voiceChannel = newState.guild.channels.cache.get(queue.voiceChannel.id);

        if (newState.id === this.client.user.id && newState.channelId === null) return;

        if (!voiceChannel) return;
        if (voiceChannel.members.filter((x: any) => !x.user.bot).size <= 0)
        {
            setTimeout(async () => {
                const playerVoiceChannel = newState.guild.channels.cache.get(queue.voiceChannel.id);
                if (queue && playerVoiceChannel && playerVoiceChannel.members.filter((x: any) => !x.user.bot).size <= 0) {
                    if (queue) {
                        queue.destroy();
                    }
                }
            }, 5000);
        }
    }
}
