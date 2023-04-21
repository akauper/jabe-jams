import Context from './Context';
import {
    ActionRowBuilder,
    ButtonBuilder, ButtonInteraction,
    ButtonStyle,
    ChannelType, ComponentType,
    EmbedBuilder, InteractionCollector,
    Message,
    MessageReaction,
    ReactionCollector, SelectMenuBuilder, SelectMenuInteraction, StringSelectMenuBuilder,
    TextChannel,
    User
} from 'discord.js';
import Streamable from './playables/Streamable';
import Playable from './playables/Playable';
import EinClient from './EinClient';
import { InteractionType, MessageGeneratorEvents } from '../@types/types';
import { DatabaseManager } from '../recommendationSystem/DatabaseManager';
import { TypedEmitter } from 'tiny-typed-emitter';
import { PlaylistEntity } from '../recommendationSystem/databaseEntities/PlaylistEntity';

interface SelectMenuOptionData
{
    label: string;
    value: string;
}

export default class MessageGenerator2 extends TypedEmitter<MessageGeneratorEvents>
{
    private static readonly COLOR_HEX = 0x0099FF;
    private static readonly FOOTER_TEXT: string = 'Powered by Jabe Jams';
    private static readonly PLAYING_NOW: string = 'Now Playing';
    private static readonly PLAYLISTS_HEADER: string = 'Available Playlists';
    private static readonly emojis = {
        heartFire: '❤️🔥',
        heart: '❤️',
        sick: '😷',
        barf: '🤮',
    };

    public readonly client : EinClient;

    public constructor (client : EinClient)
    {
        super();

        this.client = client;
    }

    // generate a message for the track that is currently playing
    // this is used in the NowPlaying command
    // and in the NowPlaying slash command
    public async generateTrackMessage(track : Playable, ctx : Context) : Promise<Message>
    {
        if(!track || !ctx)
            return null;

        const embed = this.generateEmbedBuilder(track);

        const row : ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('addToPlaylist')
                    .setLabel('Add to Playlist')
                    .setStyle(ButtonStyle.Success)
            );

        const textChannel : TextChannel = ctx.tryGetTextChannel;
        const message : Message = await textChannel.send({
            content: `Now Playing ${track.name}`,
            embeds: [embed],
            components: [row]});

        if(this.client.config.databaseSettings.enableDatabase)
        {
            const streamable = track.streamables[0];
            this.handleReactions(message, streamable);
            this.handleButtonInteraction(message, streamable);

            await message.react(MessageGenerator2.emojis.heartFire);
            await message.react(MessageGenerator2.emojis.heart);
            await message.react(MessageGenerator2.emojis.sick);
            await message.react(MessageGenerator2.emojis.barf);
        }
    }


    private generateEmbedBuilder(item : Streamable | Playable) : EmbedBuilder
    {
        const embed : EmbedBuilder = new EmbedBuilder();

        let description : string = '';
        const streamable = item instanceof Streamable ? item : item.streamables[0];
        if(streamable.album)
            description += `Album: [${streamable.album.name}](${streamable.album.url})\n\nRequested By: ${item.requestedBy}\n`;

        embed.setColor(MessageGenerator2.COLOR_HEX);
        embed.setTitle(item.name);
        embed.setURL(item.url);
        embed.setThumbnail(item.thumbnail);
        embed.setImage(item.thumbnail);
        embed.setAuthor({
            name: item.artist?.name ?? 'Unknown Artist',
            iconURL: item.artist?.thumbnail,
            url: item.artist?.url,
        });
        embed.setDescription(description);
        embed.setFooter({
            text: MessageGenerator2.FOOTER_TEXT,
            // iconURL: item.requestedBy.cha.iconURL({}),
        });

        return embed;
    }

    private handleReactions(message : Message, track : Streamable) : ReactionCollector
    {
        const filter = (reaction, user) => !user.bot;

        const collector : ReactionCollector = message.createReactionCollector({
            filter: filter,
            dispose: true,
        })

        collector.on('collect', (reaction, user) => {
            this.handleReactionEvent(reaction, message, user, track, 'collect');
        });
        collector.on('remove', (reaction, user) => {
            this.handleReactionEvent(reaction, message, user, track, 'remove');
        });
        return collector;
    }

    private async handleReactionEvent(reaction : MessageReaction, message : Message, user : User, track : Streamable, type : 'collect' | 'remove')
    {
        if(!reaction || !message || !user || !track)
            return;

        if(reaction.partial)
            await reaction.fetch();

        if(message.partial)
            await message.fetch();

        if(user.partial)
            await user.fetch();

        if(type === 'collect')
            this.client.logger.info(`Reaction collected: ${reaction.emoji.name} by ${user.username}#${user.discriminator} (${user.id})`);
        else
            this.client.logger.info(`Reaction removed: ${reaction.emoji.name} by ${user.username}#${user.discriminator} (${user.id})`);

        let interactionType : InteractionType = InteractionType.None;

        switch(reaction.emoji.name)
        {
            case MessageGenerator2.emojis.heartFire:
                interactionType = InteractionType.Love;
                break;
            case MessageGenerator2.emojis.heart:
                interactionType = InteractionType.Like;
                break;
            case MessageGenerator2.emojis.sick:
                interactionType = InteractionType.Dislike;
                break;
            case MessageGenerator2.emojis.barf:
                interactionType = InteractionType.Hate;
                break;
            default:
                this.client.logger.error('Unknown reaction collected');
                return;
        }

        await DatabaseManager.instance.userInteractStreamables(user, interactionType, [track])
            .catch(err => this.client.logger.error(err));

        this.emit(type == 'collect' ? 'reactionAdded' : 'reactionRemoved', track, user, interactionType);
    }

    private handleButtonInteraction(message : Message, track : Streamable) : InteractionCollector<ButtonInteraction>
    {
        const collector : InteractionCollector<ButtonInteraction> = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (interaction) => interaction.isButton() && !interaction.user.bot,
            dispose: true,
        });

        collector.on('collect', async (interaction) => {
            this.embedSelectMenu(interaction, track);
        });

        return collector;
    }

    private async embedSelectMenu(interaction : ButtonInteraction, track : Streamable)
    {
        const playlists : PlaylistEntity[] = await DatabaseManager.instance.getUserPlaylistEntities(interaction.user.id);
        const options : SelectMenuOptionData[] = playlists.map(playlist => {
            return {
                label: playlist.name,
                value: playlist.id,
            };
        });
        options.push({
            label: 'Create New Playlist For This Song',
            value: 'createNew',
        });

        const row : ActionRowBuilder<SelectMenuBuilder> = new ActionRowBuilder<SelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder({
                customId: interaction.user.id,
                placeholder: 'Select a playlist',
                options: options,
            }));
        await interaction.reply({
            content: 'Select a playlist',
            components: [row],
            ephemeral: true,
        });

        const reply : Message<true> = await interaction.fetchReply() as Message<true>;

        const collector : InteractionCollector<SelectMenuInteraction> = reply.createMessageComponentCollector({
            componentType: ComponentType.SelectMenu,
            dispose: true,
        });

        collector.on('collect', async (interaction) => {
            this.handleSelectMenuInteraction(interaction, track, playlists);
        });
    }

    private async handleSelectMenuInteraction(interaction : SelectMenuInteraction, track : Streamable, playlists : PlaylistEntity[])
    {
        if(interaction.values.includes('createNew'))
        {
            const playlist : PlaylistEntity = await DatabaseManager.instance.createPlaylistEntity(interaction.user, track.name, [track]);
            await interaction.reply({
                content: `Created new playlist ${playlist.name} with ${playlist.trackEntities.length} tracks`,
                ephemeral: true,
            });
        }
        else
        {
            const playlist : PlaylistEntity = playlists.find(p => interaction.values.includes(p.id));
            if(!playlist)
            {
                await interaction.reply({
                    content: 'Could not find playlist',
                    ephemeral: true,
                });
                return;
            }

            await DatabaseManager.instance.addStreamablesToUserPlaylist(playlist, [track]);

            await interaction.reply({
                content: `Playlist ${playlist.name} now includes ${track.name}`,
                ephemeral: true,
            });
        }

        // Disabled row's options and content don't matter. It's just used to disable the initial
        // ephemeral reply (since it cant be deleted).
        const disabledRow: ActionRowBuilder<StringSelectMenuBuilder> = new ActionRowBuilder<StringSelectMenuBuilder>();
        disabledRow.addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('addToPlaylist')
                .setOptions([{ label: 'Playlist Created!', value: 'playlist created!' }])
                .setDisabled(),
        );
        await interaction.editReply({
            content: 'Playlist created!',
            components: [disabledRow],
        });
    }
}