// import {
//     ActionRowBuilder,
//     ButtonBuilder,
//     ButtonInteraction,
//     ButtonStyle,
//     Collection,
//     ComponentType,
//     EmbedBuilder,
//     // ContextMenuInteraction,
//     Interaction,
//     InteractionCollector,
//     Message,
//     MessageReaction,
//     ReactionCollector, SelectMenuBuilder,
//     SelectMenuInteraction,
//     StringSelectMenuBuilder,
//     TextChannel,
//     User,
// } from 'discord.js';
// import { PlaylistEntity } from '../recommendationSystem/databaseEntities/PlaylistEntity';
// import { DatabaseManager } from '../recommendationSystem/DatabaseManager';
// import { InteractionType, MessageGeneratorEvents } from '../@types/types';
// import { Search } from './search/Search';
// import EinClient from './EinClient';
// import RecommendationSystem from '../recommendationSystem/RecommendationSystem';
// import { TypedEmitter } from 'tiny-typed-emitter';
// import Streamable from './playables/Streamable';
// import Playable from './playables/Playable';
// import Queue from './Queue';
//
//
// export class MessageGenerator extends TypedEmitter<MessageGeneratorEvents>
// {
//     private static _instance: MessageGenerator;
//     public static get instance(): MessageGenerator
//     {
//         if (this._instance == null)
//             this._instance = new MessageGenerator();
//         return this._instance;
//     }
//
//     private constructor()
//     {
//         super();
//     }
//
//     private static get emojis()
//     {
//         return {
//             play: '▶',
//             skip: '⏩',
//             pause: '⏸',
//             heart: '❤',
//             heartFire: '❤️‍🔥',
//             sick: '🤢',
//             barf: '🤮',
//             x: '❌',
//         };
//     }
//
//     private static exitAndStartOverButtons() : ActionRowBuilder<ButtonBuilder>
//     {
//         return new ActionRowBuilder<ButtonBuilder>().addComponents([
//             new ButtonBuilder()
//                 .setCustomId('Exit')
//                 .setLabel('Exit')
//                 .setStyle(ButtonStyle.Danger),
//             new ButtonBuilder()
//                 .setCustomId('Start Over')
//                 .setLabel('Start Over')
//                 .setStyle(ButtonStyle.Danger),
//         ]);
//     }
//     private static yesAndNoButtons() : ActionRowBuilder<ButtonBuilder>
//     {
//         return new ActionRowBuilder<ButtonBuilder>().addComponents([
//             new ButtonBuilder()
//                 .setCustomId('Yes')
//                 .setLabel('Yes')
//                 .setStyle(ButtonStyle.Success),
//             new ButtonBuilder()
//                 .setCustomId('No')
//                 .setLabel('No')
//                 .setStyle(ButtonStyle.Danger),
//         ]);
//     }
//     private static pleaseWaitButton() : ActionRowBuilder<ButtonBuilder>
//     {
//         return new ActionRowBuilder<ButtonBuilder>().addComponents([
//             new ButtonBuilder()
//                 .setCustomId('please wait')
//                 .setLabel('Please Wait...')
//                 .setStyle(ButtonStyle.Secondary)
//                 .setDisabled(true),
//         ]);
//     }
//     private static heartFireButton() : ActionRowBuilder<ButtonBuilder>
//     {
//         return new ActionRowBuilder<ButtonBuilder>().addComponents([
//             new ButtonBuilder()
//                 .setCustomId('heartfire')
//                 .setEmoji(MessageGenerator.emojis.heartFire)
//                 .setStyle(ButtonStyle.Secondary)
//                 .setDisabled(true),
//         ]);
//     }
//     private static xButton() : ActionRowBuilder<ButtonBuilder>
//     {
//         return new ActionRowBuilder<ButtonBuilder>().addComponents([
//             new ButtonBuilder()
//                 .setCustomId('oops')
//                 .setEmoji(MessageGenerator.emojis.x)
//                 .setStyle(ButtonStyle.Danger)
//                 .setDisabled(true),
//         ]);
//     }
//
//
//     private static makeRowAndButtons(...names: string[]): ActionRowBuilder<ButtonBuilder>
//     {
//         return new ActionRowBuilder<ButtonBuilder>()
//             .addComponents(names.map(x =>
//             {
//                 return new ButtonBuilder()
//                     .setCustomId(x)
//                     .setLabel(x)
//                     .setStyle(ButtonStyle.Primary);
//             }));
//     }
//
//     private static chunkArray<T>(array: T[], chunkSize: number): T[][]
//     {
//         return array.reduce((resultArray, item, index) =>
//         {
//             const chunkIndex = Math.floor(index / chunkSize);
//
//             if (!resultArray[chunkIndex])
//                 resultArray[chunkIndex] = [];
//
//             resultArray[chunkIndex].push(item);
//             return resultArray;
//         }, []);
//     }
//     private static buttonGrid(...names: string[]): ActionRowBuilder[]
//     {
//         const chunkedNames = this.chunkArray(names, 5).slice(0, 5);
//         return chunkedNames.flatMap(x => this.makeRowAndButtons(...x));
//     }
//     private static playlistSelectMenu(...names: string[]): ActionRowBuilder<StringSelectMenuBuilder>
//     {
//         return new ActionRowBuilder<StringSelectMenuBuilder>()
//             .addComponents(new StringSelectMenuBuilder()
//                 .setCustomId('select playlist')
//                 .setPlaceholder('Select a Playlist')
//                 .addOptions(names.map(x =>
//                 {
//                     return {
//                         label: x,
//                         value: x,
//                     };
//                 })));
//     }
//
//     private static async doStartover(initialComponent, originalReply)
//     {
//         const buttonFilter = (i) =>
//         {
//             if (i)
//                 i.deferUpdate();
//             return true;
//         };
//
//         await initialComponent.editReply({
//             content: 'Starting over. You can dismiss this message.',
//             components: [ this.xButton() ],
//         });
//
//         if (originalReply)
//             await originalReply.delete();
//     }
//
//
//     private async fetchAndCheckPlaylists(initialComponent, userId: string, reply: Message<true>): Promise<PlaylistEntity[]>
//     {
//         const playlists: PlaylistEntity[] = await DatabaseManager.instance.getUserPlaylistEntities(userId);
//         if (playlists == null || playlists.length === 0)
//         {
//             await initialComponent.editReply({
//                 content: 'You don\'t have any playlists',
//                 components: [MessageGenerator.exitAndStartOverButtons()],
//             });
//
//             await reply.awaitMessageComponent({ componentType: ComponentType.Button });
//             return null;
//         }
//         return playlists;
//     }
//
//     public async generatePlaylistsResponse(originalMessage: Message)
//     {
//         if (!DatabaseManager.instance)
//             return;
//
//         let originalReply: Message;
//         do
//         {
//             try
//             {
//                 const buttonFilter = (i: ButtonInteraction | null) =>
//                 {
//                     if (i)
//                         i.deferUpdate();
//                     return true;
//                 };
//
//                 originalReply = null;
//
//                 const row = new ActionRowBuilder<ButtonBuilder>()
//                     .addComponents(new ButtonBuilder()
//                         .setCustomId('initial')
//                         .setLabel('Click this to start Playlist Manager')
//                         .setStyle(ButtonStyle.Primary));
//                 originalReply = await originalMessage.reply({
//                     content: 'Click the button below to start the playlist manager',
//                     components: [ row ],
//                 });
//                 const initialFilter = (i: Interaction) =>
//                 {
//                     if (originalMessage.author.id !== i.user.id)
//                     {
//                         originalMessage.channel.send(`You cannot click this button ${i.user.username}. Please type %playlist to activate this menu.`);
//                         return false;
//                     }
//                     return true;
//                 };
//                 const initialComponent: ButtonInteraction =
//                     await originalReply.awaitMessageComponent({ filter: initialFilter, componentType: ComponentType.Button });
//
//                 const reply: Message<true> = await initialComponent.reply({
//                     content: 'Please Wait...',
//                     ephemeral: true,
//                     fetchReply: true,
//                 }) as Message<true>;
//
//                 const playAPlaylist = 'Play a Playlist';
//                 const addToPlaylist = 'Add Tracks to a Playlist';
//                 const deleteAPlaylist = 'Delete a Playlist';
//                 const createNewPlaylist = 'Create a New Playlist';
//
//                 await initialComponent.editReply({
//                     content: 'Please select an option below:',
//                     components: [
//                         MessageGenerator.makeRowAndButtons(
//                             playAPlaylist,
//                             addToPlaylist,
//                             deleteAPlaylist,
//                             createNewPlaylist),
//                     ],
//                 });
//
//
//                 let messageComponent = await reply.awaitMessageComponent({
//                     filter: buttonFilter,
//                     componentType: ComponentType.Button,
//                 });
//                 let selectMenuInteraction: SelectMenuInteraction;
//
//                 if (messageComponent.customId === playAPlaylist)
//                 {
//                     const playlists: PlaylistEntity[] =
//                         await this.fetchAndCheckPlaylists(initialComponent, messageComponent.user.id, reply);
//                     if (playlists == null)
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//
//                     await initialComponent.editReply({
//                         content: 'Select a playlist below',
//                         components: [MessageGenerator.playlistSelectMenu(...playlists.map(x => x.name))],
//                         // components: this.buttonGrid(...playlists.map(x => x.name)),
//                     });
//
//                     selectMenuInteraction = await reply.awaitMessageComponent({
//                         componentType: ComponentType.SelectMenu,
//                         dispose: true,
//                     });
//                     await selectMenuInteraction.deferUpdate();
//
//                     const playlist = playlists.find(x => x.name === selectMenuInteraction.values[0]);
//                     // const playlist = playlists.find(x => x.name == messageComponent.customId);
//                     const queue = await Queue.getOrCreate(initialComponent.guild);
//                     const playable = await playlist.toPlayable();
//                     if (!playlist || !queue || !playable)
//                     {
//                         await initialComponent.editReply({
//                             content: 'Oops! Something went wrong...',
//                             components: [ MessageGenerator.xButton() ],
//                         });
//                         break;
//                     }
//
//                     await EinClient.instance.addPlayables([playable], initialComponent.guildId, initialComponent.user, { textChannel: originalMessage.channel });
//
//
//                     await initialComponent.editReply({
//                         content: `OK! Now playing: ${playlist.name}`,
//                         components: [ MessageGenerator.heartFireButton() ],
//                     });
//                     break;
//                 }
//                 else if (messageComponent.customId === addToPlaylist)
//                 {
//
//                     const playlists: PlaylistEntity[] =
//                         await this.fetchAndCheckPlaylists(initialComponent, messageComponent.user.id, reply);
//                     if (playlists == null)
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//
//                     await initialComponent.editReply({
//                         content: 'Select a playlist below',
//                         components: [MessageGenerator.playlistSelectMenu(...playlists.map(x => x.name))],
//                     });
//
//                     selectMenuInteraction = await reply.awaitMessageComponent({
//                         componentType: ComponentType.SelectMenu,
//                         dispose: true,
//                     });
//                     await selectMenuInteraction.deferUpdate();
//
//
//                     // messageComponent = await reply.awaitMessageComponent({
//                     //     filter: buttonFilter,
//                     //     componentType: 'BUTTON',
//                     // });
//
//                     const playlist = await DatabaseManager.instance.getPlaylistEntityByName(selectMenuInteraction.values[0]);
//
//                     await initialComponent.editReply({
//                         content: `Great! Lets add some tracks to the playlist **${playlist.name}**\n` +
//                             '\n__**NowPlaying Playlist Tracks:**__\n```' + playlist.trackEntities.map(x => `\n${x.name} by ${x.artistEntity.name}`) +
//                             '```\nPlease type the name or URLs of the tracks(s) you want to add to this playlist. If there are multiple songs please seperate them with a comma' +
//                             '\n**Example**: Toxic by Britney Spears, Vent by Baby Keem, https://theUrlToASong',
//                         components: [ MessageGenerator.exitAndStartOverButtons().addComponents([
//                             new ButtonBuilder()
//                                 .setCustomId('recommend')
//                                 .setLabel('Recommend Songs')
//                                 .setStyle(ButtonStyle.Primary),
//                         ])],
//                     });
//
//                     const filter = (filterMessage: Message) =>
//                     {
//                         if (!filterMessage)
//                             return false;
//                         return filterMessage.author.id === originalMessage.author.id;
//                     };
//
//                     const raceResult = await Promise.race([
//                         reply.awaitMessageComponent({ componentType: ComponentType.Button }),
//                         initialComponent.channel.awaitMessages({ filter: filter, max: 1 }),
//                     ]);
//
//
//                     if (raceResult instanceof ButtonInteraction)
//                     {
//                         await raceResult.deferUpdate();
//                         if (raceResult.customId.toLowerCase() === 'exit')
//                         {
//                             await initialComponent.editReply({
//                                 content: 'OK! Goodbye! ' + MessageGenerator.emojis.heartFire,
//                                 components: [ MessageGenerator.heartFireButton() ],
//                             });
//                             reply.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button });
//                             break;
//                         }
//                         else if (raceResult.customId.toLowerCase() === 'start over')
//                         {
//                             await MessageGenerator.doStartover(initialComponent, originalReply);
//                             continue;
//                         }
//                         else if (raceResult.customId.toLowerCase() === 'recommend')
//                         {
//                             await initialComponent.editReply({
//                                 content: 'Please Wait...',
//                                 components: [ MessageGenerator.pleaseWaitButton() ],
//                             });
//
//                             const recommendations: Streamable[] = await RecommendationSystem.recommend(playlist, 5);
//                             if (recommendations == null)
//                             {
//                                 await initialComponent.editReply({
//                                     content: 'Cannot get recommendations from the tracks in this playlist',
//                                     components: [ MessageGenerator.xButton() ],
//                                 });
//                                 reply.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button });
//                                 continue;
//                             }
//                             await initialComponent.editReply({
//                                 content: `__You want to add:__\n\n**${recommendations.map(x => `\n${x.name} by ${x.artist.name}`)}\n**Is this correct?`,
//                                 components: [ MessageGenerator.yesAndNoButtons() ],
//                             });
//                             messageComponent = await reply.awaitMessageComponent({
//                                 filter: buttonFilter,
//                                 componentType: ComponentType.Button,
//                             });
//
//                             if (messageComponent.customId.toLowerCase() === 'yes')
//                             {
//                                 await initialComponent.editReply({
//                                     content: 'Please Wait...',
//                                     components: [ MessageGenerator.pleaseWaitButton() ],
//                                 });
//                                 await DatabaseManager.instance.addStreamablesToUserPlaylist(playlist, recommendations);
//                                 await initialComponent.editReply({
//                                     content: 'Great! The tracks have been added to your playlist! Bye ' + MessageGenerator.emojis.heartFire,
//                                     components: [ MessageGenerator.heartFireButton() ],
//                                 });
//                                 reply.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button });
//                                 break;
//                             }
//                             else
//                             {
//                                 await MessageGenerator.doStartover(initialComponent, originalReply);
//                                 reply.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button });
//                                 continue;
//                             }
//                         }
//                     }
//
//
//                     const tracksToAddReply = raceResult as Collection<string, Message<boolean>>;
//                     initialComponent.editReply({
//                         content: 'Please Wait...',
//                         components: [ MessageGenerator.pleaseWaitButton() ],
//                     });
//                     const trackSearches: string[] = tracksToAddReply.first().content.split(',');
//                     const promises: Promise<any>[] = [];
//                     trackSearches.forEach(trackSearch =>
//                     {
//                         promises.push(Search.search(trackSearch.trim()));
//                     });
//                     if (promises.length === 0)
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//                     const playablesResult = (await Promise.all(promises)) as Playable[];
//                     const streamables = playablesResult.flatMap(x => x.streamables);
//
//                     await initialComponent.editReply({
//                         content: `__You want to add:__\n\n**${streamables.map(x => `\n${x.name} by ${x.artist.name}`)}\n**Is this correct?`,
//                         components: [ MessageGenerator.yesAndNoButtons() ],
//                     });
//                     messageComponent = await reply.awaitMessageComponent({
//                         filter: buttonFilter,
//                         componentType: ComponentType.Button,
//                     });
//
//                     if (messageComponent.customId.toLowerCase() === 'yes')
//                     {
//                         await initialComponent.editReply({
//                             content: 'Please Wait...',
//                             components: [ MessageGenerator.pleaseWaitButton() ],
//                         });
//                         await DatabaseManager.instance.addStreamablesToUserPlaylist(playlist, streamables);
//                         await initialComponent.editReply({
//                             content: 'Great! The tracks have been added to your playlist! Bye ' + MessageGenerator.emojis.heartFire,
//                             components: [ MessageGenerator.heartFireButton() ],
//                         });
//                         console.log('1');
//                         break;
//                     }
//                     else
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//                 }
//                 else if (messageComponent.customId === deleteAPlaylist)
//                 {
//                     const playlists: PlaylistEntity[] =
//                         await this.fetchAndCheckPlaylists(initialComponent, messageComponent.user.id, reply);
//                     if (playlists == null)
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//
//                     await initialComponent.editReply({
//                         content: 'Select a playlist below',
//                         components: [MessageGenerator.playlistSelectMenu(...playlists.map(x => x.name))],
//                     });
//
//                     selectMenuInteraction = await reply.awaitMessageComponent({
//                         componentType: ComponentType.SelectMenu,
//                         dispose: true,
//                     });
//                     await selectMenuInteraction.deferUpdate();
//
//                     // messageComponent = await reply.awaitMessageComponent({
//                     //     filter: buttonFilter,
//                     //     componentType: 'BUTTON',
//                     // });
//
//                     const playlist = await DatabaseManager.instance.getPlaylistEntityByName(selectMenuInteraction.values[0]);
//                     await initialComponent.editReply({
//                         content: `Are you sure you want to delete the playlist **${playlist.name}**?` +
//                             '\n**This CANNOT be undone**',
//                         components: [ MessageGenerator.yesAndNoButtons() ],
//                     });
//
//                     messageComponent = await reply.awaitMessageComponent({
//                         filter: buttonFilter,
//                         componentType: ComponentType.Button,
//                     });
//
//                     if (messageComponent.customId.toLowerCase() === 'yes')
//                     {
//                         initialComponent.editReply({
//                             content: 'Please Wait...',
//                             components: [ MessageGenerator.pleaseWaitButton() ],
//                         });
//                         await DatabaseManager.instance.deletePlaylistEntity(playlist);
//                         await initialComponent.editReply({
//                             content: 'Your playlist has been deleted! Bye ' + MessageGenerator.emojis.heartFire,
//                             components: [ MessageGenerator.heartFireButton() ],
//                         });
//                         break;
//                     }
//                     else
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//                 }
//                 else if (messageComponent.customId === createNewPlaylist)
//                 {
//                     await initialComponent.editReply({
//                         content: 'Great! What should the name of your new playlist be?\n**Please type your response in this channel**',
//                         components: [ MessageGenerator.exitAndStartOverButtons() ],
//                     });
//
//                     const filter = (filterMessage: Message) =>
//                     {
//                         return filterMessage.author.id === originalMessage.author.id;
//                     };
//                     let raceResult = await Promise.race([
//                         reply.awaitMessageComponent({ componentType: ComponentType.Button }),
//                         initialComponent.channel.awaitMessages({ filter: filter, max: 1, time: 300000 }),
//                     ]);
//                     if (raceResult instanceof ButtonInteraction)
//                     {
//                         await raceResult.deferUpdate();
//                         if (raceResult.customId.toLowerCase() === 'exit')
//                         {
//                             await initialComponent.editReply({
//                                 content: 'OK! Goodbye! ' + MessageGenerator.emojis.heartFire,
//                                 components: [ MessageGenerator.heartFireButton() ],
//                             });
//                             reply.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button });
//                             break;
//                         }
//                         else
//                         {
//                             MessageGenerator.doStartover(initialComponent, originalReply);
//                             continue;
//                         }
//                     }
//                     const playlistNameReply = raceResult as Collection<string, Message<boolean>>;
//                     const playlistName = playlistNameReply.first().content;
//
//                     await initialComponent.editReply({
//                         content: `OK. I'll make a new playlist called **${playlistName}**.` +
//                             '\n\nLet\'s add tracks to it...' +
//                             '\n\nPlease type the name or URLs of the tracks(s) you want to add to this playlist. If there are multiple songs please seperate them with a comma' +
//                             '\n**Example**: Toxic by Britney Spears, Vent by Baby Keemm https://theUrlToASong',
//                         components: [ MessageGenerator.exitAndStartOverButtons() ],
//                     });
//
//                     raceResult = await Promise.race([
//                         reply.awaitMessageComponent({ componentType: ComponentType.Button }),
//                         initialComponent.channel.awaitMessages({ filter: filter, max: 1, time: 300000 }),
//                     ]);
//                     if (raceResult instanceof ButtonInteraction)
//                     {
//                         await raceResult.deferUpdate();
//                         if (raceResult.customId.toLowerCase() === 'exit')
//                         {
//                             await initialComponent.editReply({
//                                 content: 'OK! Goodbye! ' + MessageGenerator.emojis.heartFire,
//                                 components: [ MessageGenerator.heartFireButton() ],
//                             });
//                             reply.awaitMessageComponent({ filter: buttonFilter, componentType: ComponentType.Button });
//                             break;
//                         }
//                         else
//                         {
//                             MessageGenerator.doStartover(initialComponent, originalReply);
//                             continue;
//                         }
//                     }
//
//                     const tracksToAddReply = raceResult as Collection<string, Message<boolean>>;
//                     await initialComponent.editReply({
//                         content: 'Please Wait...',
//                         components: [ MessageGenerator.pleaseWaitButton() ],
//                     });
//                     const trackSearches: string[] = tracksToAddReply.first().content.split(',');
//                     const promises: Promise<Playable[]>[] = [];
//                     trackSearches.forEach(trackSearch =>
//                     {
//                         promises.push(Search.search(trackSearch.trim()));
//                     });
//                     if (promises.length === 0)
//                     {
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//                     const playablesResult = (await Promise.all(promises))[0];
//                     const streamables = playablesResult.flatMap(x => x.streamables);
//
//                     await initialComponent.editReply({
//                         content: `__You want to add:__\n\n**${streamables.map(x => `\n${x.name} by ${x.artist.name}`)}\n**Is this correct?`,
//                         components: [ MessageGenerator.yesAndNoButtons() ],
//                     });
//                     messageComponent = await reply.awaitMessageComponent({
//                         filter: buttonFilter,
//                         componentType: ComponentType.Button,
//                     });
//
//
//                     if (messageComponent.customId.toLowerCase() === 'yes')
//                     {
//                         await initialComponent.editReply({
//                             content: 'Please Wait...',
//                             components: [ MessageGenerator.pleaseWaitButton() ],
//                         });
//                         await DatabaseManager.instance.createPlaylistEntity(originalMessage.author, playlistName, streamables);
//                         await initialComponent.editReply({
//                             content: 'Great! The tracks have been added to your playlist! Bye ' + MessageGenerator.emojis.heartFire,
//                             components: [ MessageGenerator.heartFireButton() ],
//                         });
//                         break;
//                     }
//                     else
//                     {
//
//                         MessageGenerator.doStartover(initialComponent, originalReply);
//                         continue;
//                     }
//                 }
//                 else
//                 {
//                     console.log('got other');
//                 }
//             }
//             catch (e)
//             {
//                 console.log('*************\n\n\n\n\n\n\n\n****************************');
//                 console.trace();
//                 console.error(e);
//                 throw e;
//             }
//         }
//             // eslint-disable-next-line no-constant-condition
//         while (true);
//
//         if (originalReply)
//             await originalReply.delete();
//         console.log('did it all');
//     }
//
//
//     public async generateTrackMessage(streamable: Streamable): Promise<void>
//     {
//         if (streamable?.data?.textChannel == null)
//             return;
//
//         const embed = this.createMessageEmbed(streamable);
//
//         const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
//         row.addComponents(
//             new ButtonBuilder()
//                 .setCustomId('addToPlaylist')
//                 .setLabel('Add to a playlist')
//                 .setStyle(ButtonStyle.Success),
//         );
//
//         const textChannel: TextChannel = streamable.data.textChannel;
//         const message: Message = await textChannel.send({
//             content: `Now Playing ${streamable.name}`,
//             embeds: [embed],
//             components: [row],
//         });
//
//         if (DatabaseManager.instance)
//         {
//             this.addReactions(message, streamable);
//             this.createPlaylistButton(message, streamable);
//
//             message.react(MessageGenerator.emojis.heartFire)
//                 .then(() => message.react(MessageGenerator.emojis.heart))
//                 .then(() => message.react(MessageGenerator.emojis.sick))
//                 .then(() => message.react(MessageGenerator.emojis.barf));
//         }
//     }
//
//     private createMessageEmbed(value: Streamable | Playable)
//     {
//         const embed: EmbedBuilder = new EmbedBuilder();
//
//         let description: string = '';
//         if (value['album'])
//         {
//             const streamable = value as Streamable;
//             description = `Album [${streamable.album.name}](${streamable.album.url})`;
//         }
//
//         embed.setColor('#0099ff');
//         embed.setTitle(value.name);
//         embed.setURL(value.url);
//         embed.setAuthor(
//             {
//                 name: value.artist ? value.artist.name : '',
//                 iconURL: value.artist?.thumbnail ? value.artist.thumbnail : null,
//                 url: value.artist?.url ? value.artist.url : null,
//             },
//         );
//         embed.setDescription(description);
//         // embed.setThumbnail(value.thumbnail);
//         embed.setImage(value.thumbnail);
//         embed.addFields({ name: 'Added by', value: value.requestedBy ? value.requestedBy.username : 'Unknown', inline: true });
//         embed.setTimestamp();
//         embed.setFooter({ text: 'Created by Ein-Music-Player' });
//
//         return embed;
//     }
//
//     private addReactions(message: Message, streamable: Streamable): ReactionCollector
//     {
//         const filter = (reaction, user) =>
//         {
//             return !user.bot;
//         };
//
//         const collector: ReactionCollector = message.createReactionCollector({
//             filter: filter,
//             dispose: true,
//         });
//
//         collector.on('collect', (reaction, user) =>
//         {
//             this.reactionCollected(reaction, message, user, streamable);
//         });
//         collector.on('remove', (reaction, user) =>
//         {
//             this.reactionRemoved(reaction, user, streamable);
//         });
//
//         return collector;
//     }
//
//     private async reactionCollected(reaction: MessageReaction, message: Message, user: User, song: Streamable)
//     {
//         console.log(`reaction colleected ${reaction.emoji.name} - ${user.username}`);
//         let interactionType: InteractionType = InteractionType.None;
//
//         const userReactions = message.reactions.cache.filter(r => r.users.cache.has(user.id));
//
//         try
//         {
//             for (const r of userReactions.values())
//             {
//                 // console.log(r.emoji.toString());
//                 // console.log(reaction.emoji.toString());
//                 // console.log('-');
//                 if (r.emoji.toString() != reaction.emoji.toString())
//                     await r.users.remove(user.id);
//             }
//         }
//         catch (e)
//         {
//             console.error('failed to remove reactions');
//         }
//
//         switch (reaction.emoji.name)
//         {
//             case MessageGenerator.emojis.heart:
//                 interactionType = InteractionType.Like;
//                 break;
//             case MessageGenerator.emojis.heartFire:
//                 interactionType = InteractionType.Love;
//                 break;
//             case MessageGenerator.emojis.sick:
//                 interactionType = InteractionType.Dislike;
//                 break;
//             case MessageGenerator.emojis.barf:
//                 interactionType = InteractionType.Hate;
//                 break;
//             default:
//                 return;
//         }
//
//         await DatabaseManager.instance?.userInteractStreamables(user, interactionType, [song])
//             .catch(err => console.error(err));
//
//         this.emit('reactionAdded', song, user, interactionType);
//     }
//
//     private async reactionRemoved(reaction, user: User, song: Streamable)
//     {
//         let interactionType: InteractionType = InteractionType.None;
//
//         switch (reaction.emoji.name)
//         {
//             case MessageGenerator.emojis.heart:
//                 interactionType = InteractionType.Dislike;
//                 break;
//             case MessageGenerator.emojis.heartFire:
//                 interactionType = InteractionType.Hate;
//                 break;
//             case MessageGenerator.emojis.sick:
//                 interactionType = InteractionType.Like;
//                 break;
//             case MessageGenerator.emojis.barf:
//                 interactionType = InteractionType.Love;
//                 break;
//             default:
//                 break;
//         }
//
//         await DatabaseManager.instance?.userInteractStreamables(user, interactionType, [song])
//             .catch(err => console.error(err));
//
//         this.emit('reactionRemoved', song, user, interactionType);
//     }
//
//     private createPlaylistButton(message: Message, streamable: Streamable): InteractionCollector<any>
//     {
//         const componentCollector = message.createMessageComponentCollector({
//             dispose: true,
//         });
//
//         componentCollector.on('collect', (i) =>
//         {
//             this.createSelectMenu(message, i, streamable);
//         });
//
//         return componentCollector;
//     }
//
//     private async createSelectMenu(message: Message, interaction, streamable: Streamable)
//     {
//         const playlists: PlaylistEntity[] = await DatabaseManager.instance.getUserPlaylistEntities(interaction.user.id);
//         const optionDatas = playlists.map(p =>
//         {
//             return {
//                 label: p.name,
//                 value: p.name,
//             };
//         });
//         optionDatas.push({
//             label: 'New playlist from this song',
//             value: 'new',
//         });
//
//         const repRow = new ActionRowBuilder<StringSelectMenuBuilder>();
//         repRow.addComponents(new StringSelectMenuBuilder({
//             customId: interaction.user.id,
//             placeholder: 'Select Playlist',
//             options: optionDatas,
//         }));
//         await interaction.reply(
//             {
//                 content: 'Select a Playlist.',
//                 components: [repRow],
//                 ephemeral: true,
//             });
//         const reply: Message<true> = await interaction.fetchReply() as Message<true>;
//
//         const componentCollector = reply.createMessageComponentCollector({
//             componentType: ComponentType.SelectMenu,
//             dispose: true,
//         });
//
//         componentCollector.on('collect', async (i) =>
//         {
//             if (!i.isSelectMenu())
//                 return;
//
//             if (i.values.includes('new'))
//             {
//                 const playlist = await DatabaseManager.instance.createPlaylistEntity(interaction.user, streamable.name, [streamable]);
//                 await i.reply({
//                     content: `Your new playlist '${playlist.name}' has been created!`,
//                     ephemeral: true,
//                 });
//             }
//             else
//             {
//                 const p = playlists.find(x => i.values.includes(x.name));
//                 if (p == null)
//                     throw 'Could not find selected playlist to edit..';
//
//                 await DatabaseManager.instance.addStreamablesToUserPlaylist(p, [streamable]);
//
//                 await i.reply({
//                     content: `Playlist ${p.name} now includes ${streamable.name}`,
//                     ephemeral: true,
//                 });
//             }
//
//             // Disabled row's options and content don't matter. It's just used to disable the initial
//             // ephemeral reply (since it cant be deleted).
//             const disabledRow: ActionRowBuilder<StringSelectMenuBuilder> = new ActionRowBuilder<StringSelectMenuBuilder>();
//             disabledRow.addComponents(
//                 new StringSelectMenuBuilder()
//                     .setCustomId('addToPlaylist')
//                     .setOptions([{ label: 'Playlist Created!', value: 'playlist created!' }])
//                     .setDisabled(),
//             );
//             await interaction.editReply({
//                 content: 'Playlist created!',
//                 components: [disabledRow],
//             });
//         });
//
//     }
// }