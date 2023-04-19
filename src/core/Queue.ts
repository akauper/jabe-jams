import EinClient from './EinClient.js';
import { ChannelType, Guild, GuildMember, GuildMemberResolvable, Snowflake, User, VoiceChannel } from 'discord.js';
import VoiceStream from './VoiceStream.js';
import {
    AutoplayData,
    EinSearchResponse,
    EndlessSeedTypes,
    InteractionType,
    SearchCode,
    StreamableData
} from '../@types/types.js';
import Playlist from './playables/Playlist.js';
import Playable from './playables/Playable.js';
import Context from './Context.js';
import { DatabaseManager } from '../recommendationSystem/DatabaseManager.js';
import {
    AudioResource,
    entersState,
    getVoiceConnection,
    joinVoiceChannel,
    VoiceConnection,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import { createDiscordJSAdapter } from './adapter.js';
import Streamable from './playables/Streamable.js';
import { RecommendationSytem } from '../recommendationSystem/RecommendationSytem.js';
import { Search } from './search/Search';
import { PlaylistEntity } from '../recommendationSystem/databaseEntities/PlaylistEntity.js';
import { AlbumEntity } from '../recommendationSystem/databaseEntities/AlbumEntity.js';
import ExternalConnections from '../util/ExternalConnections.js';
import { Spotify } from './search/Spotify';
import { ArtistEntity } from '../recommendationSystem/databaseEntities/ArtistEntity.js';
import { UserEntity } from '../recommendationSystem/databaseEntities/UserEntity';

interface AutoplayData
{
    playablesSeed : Playable[],
    originalSeed : EndlessSeedTypes;
    requester : User,
    data : any,
    trackRatings : { streamable: StreamableData, rating : number}[]
}

export default class Queue
{
    public client : EinClient;

    public guild : Guild;

    public voiceStream : VoiceStream | null;

    private _voiceChannel : VoiceChannel;
    private _isDestroyed : boolean = false;
    private _isPlaying : boolean = false;
    private _isPaused : boolean = false;

    public get voiceChannel() : VoiceChannel { return this._voiceChannel; }

    public get isDestroyed() : boolean { return this._isDestroyed; }
    public get isPlaying() : boolean { return this._isPlaying; }
    public get isPaused() : boolean { return this._isPaused; }

    public get length() { return this.playables.length; }

    public get empty() { return this.playables.length === 0 && !this.currentPlayable}

    private _autoplayActive: boolean = false;
    private _autoplayData : AutoplayData;


    // private _endlessSeedPlayables: Playable[];
    // private _endlessSeedOriginal : EndlessSeedTypes;
    // private _endlessRequestedBy: User;
    // private _endlessData: any;
    // private _endlessTrackRating: { streamable: StreamableData, rating: number; }[];

    public playables: Playable[] = [];
    public playableHistory: Playable[] = [];

    public data?: any;

    private static readonly guildQueues: Map<Snowflake, Queue> = new Map<Snowflake, Queue>();

    public get currentPlayable() { return this.playables[0]; }



    public get endlessActive() { return this._endlessModeActive; }

    private constructor (client: EinClient, guild : Guild)
    {
        this.client = client;
        this.guild = guild;
    }

    public static exists(guildId : Snowflake)
    {
        return this.guildQueues.has(guildId);
    }

    public static get(guildId : Snowflake)
    {
        return this.guildQueues.get(guildId);
    }

    public static async getOrCreate(guildMember : GuildMember) : Promise<Queue>
    {
        if(this.exists(guildMember.guild.id))
            return this.get(guildMember.guild.id);

        if(!guildMember)
        {
            EinClient.instance.logger.error('Error creating Queue. GuildMember null.');
            return;
        }

        if(!guildMember.voice)
        {
            EinClient.instance.logger.error('Cannot create Queue. GuildMember Voice is null');
            return;
        }
        const voiceChannel = guildMember.voice.channel;
        if(voiceChannel.type != ChannelType.GuildVoice)
        {
            EinClient.instance.logger.error('Cannot create Queue. GuildMember Voice Channel is not GuildVoice');
            return;
        }

        return await this.create(EinClient.instance, voiceChannel);
    }

    public static async create (client : EinClient, voiceChannel : VoiceChannel) : Promise<Queue>
    {
        if(!voiceChannel || voiceChannel.type != ChannelType.GuildVoice)
        {
            EinClient.instance.logger.error('Cannot create Queue. VoiceChannel null or not GuildVoice')
            return;
        }

        const existingQueue = this.guildQueues.get(voiceChannel.guildId);
        if(existingQueue && !existingQueue.isDestroyed)
            return existingQueue;

        const newQueue = new Queue(client, voiceChannel.guild);
        this.guildQueues.set(voiceChannel.guildId, newQueue);

        await newQueue.joinVoiceChannel(voiceChannel);

        return newQueue;
    }

    public destroy()
    {
        if (this.isDestroyed)
            return;
        if (this.voiceStream)
            this.voiceStream.disconnect();
        this.voiceStream = null;
        this._isDestroyed = true;
        this.playables = [];
        Queue.guildQueues.delete(this.guild.id);
        this.client.emit('queueDestroy', this);
    }

    public async joinVoiceChannel(voiceChannel : VoiceChannel)
    {
        if(this.voiceStream)
        {
            this.voiceStream.disconnect();
            this.voiceStream = null;
        }

        let voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: createDiscordJSAdapter(voiceChannel),
            selfDeaf: false,
        });

        try
        {
            voiceConnection = await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);
            this.voiceStream = new VoiceStream(voiceConnection, voiceChannel);
            this._voiceChannel = voiceChannel;
        }
        catch(e)
        {
            voiceConnection.destroy();
            this.client.logger.error('queue.joinVoiceChannel - Voice Connection Error');
            return;
        }

        this.voiceStream.on('start', (resource) => this.voiceStreamStart(resource));
        this.voiceStream.on('end', (resource) => this.voiceStreamEnd(resource));
        // this.voiceStream.on('error', (error) =>
        // {
        //     this.client.emit('error', error as Error, this);
        // });
        // this.client.emit('queueDisconnect', this);
    }

    public async play(playables : Playable[], ctx : Context, data?: unknown) : Promise<Playable[]>
    {
        if(this.isPaused)
            this.unpause();

        const lengthBefore = this.playables.length;

        this.addPlayables(playables, ctx.author, data);

        if(lengthBefore === 0)
            await this.playNext();

        return playables;
    }

    private addPlayables(playables : Playable[], requester : User, data?: unknown) : void
    {
        playables.forEach(x =>
        {
            x.queue = this;
            x.requestedBy = requester;
            x.data = data;
        });

        DatabaseManager.instance?.userInteractStreamables(requester, InteractionType.Play, playables.flatMap(x => x.streamables));

        this.playables = this.playables.concat(playables);
        playables.flatMap(p => p.streamables).forEach(s =>
        {
            this.client.emit('songAdd', this, s);
        });
    }

    private voiceStreamStart(resource: AudioResource<Streamable>)
    {
        const wasPlaying = this.isPlaying;
        this._isPlaying = true;
        if(!wasPlaying)
            this.client.emit('queueStart', this);
    }

    private voiceStreamEnd(resource : AudioResource<Streamable>)
    {
        if (this.isDestroyed)
        {
            this.client.emit('queueDestroy', this);
            return;
        }
        this.playNext();
    }

    private async playNext(oldStreamable?: Streamable) : Promise<Playable>
    {
        if(this.isDestroyed)
        {
            this.client.logger.error('Queue.playNext -- No Voice Connection');
            return;
        }

        if(this.playables.length === 0)
        {
            this._isPlaying = false;
            this.client.emit('queueEnd', this);
            return;
        }

        if(this._endlessModeActive)
        {
            const totalRemainingStreamables : Streamable[] = this.playables.flatMap(x => x.streamables);
            if(totalRemainingStreamables.length < 3)
            {
                const newPlayables : Playable[] = await this.getEndlessPlayables(3);
                this.addPlayables(newPlayables, this._endlessRequestedBy, this._endlessData);
            }
        }

        if(!oldStreamable)
            oldStreamable = this.currentPlayable.currentStreamable;
        const newStreamable = this.currentPlayable.advance();

        // Playable has run out of streambles. Advance to next playable
        if(!newStreamable)
        {
            const oldPlayable = this.playables.shift();
            this.playableHistory.push(oldPlayable);

            return this.playNext(oldStreamable);
        }

        this.client.emit('songEnd', this, oldStreamable);
        this.client.emit('songStart', this, newStreamable);
        //MessageGenerator.instance.generateTrackMessage(newStreamable);

        await this.voiceStream.playStreamable(newStreamable);

        return this.currentPlayable;
    }



    // public async beginEndlessMode(seed : EndlessSeedTypes, ctx : Context, data? : unknown) : Promise<Playable>
    // {
    //     const spotifyConnection = await ExternalConnections.getSpotifyConnection();
    //
    //     if(seed instanceof User)
    //     {
    //         if(!this.client.config.databaseSettings.enableDatabase)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for user[${seed}] - Requires database to be enabled.`);
    //             return;
    //         }
    //         const userEntity = await DatabaseManager.instance.getUserById(seed.id);
    //         if(userEntity == null)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for user [${seed}] - User does not have any rated tracks.`)
    //             return;
    //         }
    //         const trackRatings = userEntity.getSortedTrackRatings();
    //         if(trackRatings.length < 3 || trackRatings.filter(x => x.rating > 0).length < 3)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for user [${seed}] - User does not have enough liked tracks.`)
    //             return;
    //         }
    //         const tracks = await DatabaseManager.instance.getTracksBySpotifyIds(trackRatings.map(x => x.id));
    //         this._endlessSeed = tracks.flatMap(x => x.toPlayable().streamables);
    //     }
    //     else if(seed instanceof Queue)
    //     {
    //         this._endlessSeed = seed.playables
    //             .flatMap(x => x.streamables)
    //             .concat(seed.playableHistory.flatMap(x => x.streamables));
    //     }
    //     else if(seed instanceof PlaylistEntity)
    //     {
    //         this._endlessSeed = (await seed.toPlayable()).streamables;
    //     }
    //     else if(seed instanceof ArtistEntity)
    //     {
    //         if(!spotifyConnection)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for Artist [${seed.name}]. Internal error connecting to Spotify.`)
    //             return;
    //         }
    //
    //
    //         const spotifyArtist = (await spotifyConnection.getArtist(seed.id)).body;
    //         if(!spotifyArtist)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot begin autoplay for Artist [${seed.name}]. Cannot find artist on spotify.`);
    //             return;
    //         }
    //         this._endlessSeed = (await Spotify.fullArtistToPlayable(spotifyArtist)).streamables;
    //     }
    //     else if(seed instanceof AlbumEntity)
    //     {
    //         const spotifyConnection = await ExternalConnections.getSpotifyConnection();
    //         if(!spotifyConnection)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for Album [${seed.name}]. Internal error connecting to Spotify.`)
    //             return;
    //         }
    //         const spotifyAlbum = (await spotifyConnection.getAlbum(seed.id)).body;
    //         if(!spotifyAlbum)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot begin autoplay for Album [${seed.name}]. Cannot find album on spotify.`);
    //             return;
    //         }
    //         this._endlessSeed = (await Spotify.spotifyResponseToPlayable(spotifyAlbum)).streamables;
    //     }
    //     else if(seed instanceof UserEntity)
    //     {
    //
    //     }
    //     else if(seed instanceof Playable)
    //     {
    //
    //     }
    //     else if(Array.isArray(seed))
    //     {
    //
    //     }
    //     else
    //     {
    //         //Seed is AutoplayData
    //     }
    // }

    // public async beginEndlessMode(seed: EndlessRequestTypes, ctx : Context, data? : unknown) : Promise<Playable[]>
    // {
    //     function isStringArray(seed : EndlessRequestTypes)
    //     {
    //         if(!Array.isArray(seed))
    //             return false;
    //         var somethingIsNotString = false;
    //         seed.forEach(function(item){
    //             if(typeof item !== 'string')
    //                 somethingIsNotString = true;
    //         });
    //         return !somethingIsNotString && seed.length > 0;
    //     }
    //
    //     const autoplayData = <AutoplayData>seed;
    //     if(autoplayData.track_names || autoplayData.artist_names || autoplayData.genres)
    //     {
    //         const spotifyApi = await ExternalConnections.getSpotifyConnection();
    //         if(!spotifyApi)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay. Internal error connecting to Spotify.`)
    //             return;
    //         }
    //
    //         let tracks : SpotifyApi.TrackObjectFull[] = [];
    //
    //         if(autoplayData.track_names && autoplayData.track_names.length > 0)
    //         {
    //             const searchResponse = (await spotifyApi.searchTracks(autoplayData.track_names.join(', '), {
    //                 limit: 1,
    //             })).body;
    //         }
    //
    //         const recommendations = await RecommendationSytem.getRecommendations(seed, 5);
    //
    //         const responsePromises = seed.map(x => spotifyApi.search(x, ['track', 'album', 'artist', 'playlist']));
    //         const responses = await Promise.all(responsePromises);
    //
    //         let albums : SpotifyApi.AlbumObjectSimplified[] = [];
    //         let artists : SpotifyApi.ArtistObjectSimplified[] = [];
    //         let playlists : SpotifyApi.PlaylistObjectSimplified[] = [];
    //
    //         for (let i = 0; i < responses.length; i++)
    //         {
    //             const response = responses[i].body;
    //             if(response.tracks && response.tracks.items && response.tracks.items.length > 0)
    //                 tracks.push(...response.tracks.items);
    //             if(response.albums && response.albums.items && response.albums.items.length > 0)
    //                 albums.push(...response.albums.items);
    //             if(response.artists && response.artists.items && response.artists.items.length > 0)
    //                 artists.push(...response.artists.items);
    //             if(response.playlists && response.playlists.items && response.playlists.items.length > 0)
    //                 playlists.push(...response.playlists.items);
    //         }
    //
    //         const streamables : Streamable[] = [];
    //         if(tracks.length > 0)
    //         {
    //             const trackPlayables = await Spotify.tracksToPlayables(tracks);
    //             if(trackPlayables && trackPlayables.length > 0)
    //                 streamables.push(...trackPlayables.flatMap(x => x.streamables));
    //         }
    //         if(albums.length > 0)
    //         {
    //             const albumPlayables = await Spotify.albumsToPlayables(albums);
    //             if(albumPlayables && albumPlayables.length > 0)
    //                 streamables.push(...albumPlayables.flatMap(x => x.streamables));
    //         }
    //         if(artists.length > 0)
    //         {
    //             const artistPlayables = await Spotify.artistsToPlayables(artists);
    //             if(artistPlayables && artistPlayables.length > 0)
    //                 streamables.push(...artistPlayables.flatMap(x => x.streamables));
    //         }
    //         //TODO: Playlists
    //
    //         this._endlessSeed = streamables;
    //     }
    //     else if (seed instanceof Queue)
    //     {
    //         this._endlessSeed = seed.playables
    //             .flatMap(x => x.streamables)
    //             .concat(seed.playableHistory.flatMap(x => x.streamables));
    //     }
    //     else if (seed instanceof PlaylistEntity)
    //     {
    //         this._endlessSeed = (await seed.toPlayable()).streamables;
    //     }
    //     else if(seed instanceof User)
    //     {
    //         const userEntity = await DatabaseManager.instance.getUserById(seed.id);
    //         if(userEntity == null)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for user [${seed}] - User does not have any rated tracks.`)
    //             return;
    //         }
    //         const trackRatings = userEntity.getSortedTrackRatings();
    //         if(trackRatings.length < 3 || trackRatings.filter(x => x.rating > 0).length < 3)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for user [${seed}] - User does not have enough liked tracks.`)
    //             return;
    //         }
    //
    //         const tracks = await DatabaseManager.instance.getTracksBySpotifyIds(trackRatings.map(x => x.id));
    //         this._endlessSeed = tracks.flatMap(x => x.toPlayable().streamables);
    //     }
    //     else if(seed instanceof AlbumEntity)
    //     {
    //         const spotifyConnection = await ExternalConnections.getSpotifyConnection();
    //         if(!spotifyConnection)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for Album [${seed.name}]. Internal error connecting to Spotify.`)
    //             return;
    //         }
    //         const spotifyAlbum = (await spotifyConnection.getAlbum(seed.id)).body;
    //         if(!spotifyAlbum)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot begin autoplay for Album [${seed.name}]. Cannot find album on spotify.`);
    //             return;
    //         }
    //
    //         this._endlessSeed = (await Spotify.spotifyResponseToPlayable(spotifyAlbum)).streamables;
    //     }
    //     else if(seed instanceof ArtistEntity)
    //     {
    //         const spotifyConnection = await ExternalConnections.getSpotifyConnection();
    //         if(!spotifyConnection)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot start autoplay for Artist [${seed.name}]. Internal error connecting to Spotify.`)
    //             return;
    //         }
    //         const spotifyArtist = (await spotifyConnection.getArtist(seed.id)).body;
    //         if(!spotifyArtist)
    //         {
    //             ctx.sendSimpleErrorMessage(`Cannot begin autoplay for Artist [${seed.name}]. Cannot find artist on spotify.`);
    //             return;
    //         }
    //
    //         this._endlessSeed = (await Spotify.spotifyArtistResponseToAlbumPlayables(spotifyArtist)).flatMap(x => x.streamables);
    //     }
    //     else
    //     {
    //         // const user = await DatabaseManager.instance.getUserById(seed.id);
    //         // const trackRatings = user.getSortedTrackRatings().map(x => x.id);
    //         // this._endlessSeed = trackRatings.slice(0, Math.min(trackRatings.length, 5));
    //         throw 'not implemented';
    //     }
    //
    //     this._endlessModeActive = true;
    //     this._endlessRequestedBy = ctx.author;
    //     this._endlessData = data;
    //
    //     this._endlessTrackRating = [];
    //
    //     const voiceChannel = ctx.guildMember.voice.channel;
    //     const memberIds = voiceChannel.members.map(x => x.id);
    //     const userEntities = await DatabaseManager.instance.getUsersByIds(memberIds);
    //     const seedRatings = this._endlessSeed.map(s =>
    //     {
    //         let rating : number = 0;
    //         let count : number = 0;
    //         userEntities.forEach(x =>
    //         {
    //             const trackRating = x.trackRatings.find(x => x.id = s.spotifyId);
    //             rating += trackRating.rating;
    //             count++;
    //         });
    //         rating = count == 0 ? 1 : rating / count;
    //
    //         return {
    //             streamable: s,
    //             rating: rating,
    //         };
    //     });
    //
    //
    //     this._endlessTrackRating.push(...seedRatings);
    //
    //     const playables : Playable[] = (await this.getEndlessPlayables(3));
    //
    //     this._endlessTrackRating.push(...playables.flatMap(x => x.streamables).map(x =>
    //     {
    //         return {
    //             streamable: x,
    //             rating: 1,
    //         };
    //     }));
    //
    //     this.client.emit('endlessStart', ctx, this._endlessSeed);
    //
    //     this.addPlayables(playables, ctx.author, data);
    //
    //     return playables;
    // }

    public async beginEndlessMode(seed : EndlessSeedTypes, ctx : Context, data? : unknown)
    {
        const seedPlayables = await RecommendationSytem.recommend(seed, ctx, 5);

        if(!seedPlayables || seedPlayables.length === 0)
        {
            ctx.sendSimpleErrorMessage('Unknown error. Failed starting endless mode');
            return;
        }

        this._autoplayActive = true;
        this._autoplayData = {
            playablesSeed: seedPlayables,
            originalSeed: seed,
            requester: ctx.author,
            data: data,
            trackRatings: []
        };

        const voiceChannel = ctx.guildMember.voice.channel;
        const memberIds = voiceChannel.members.map(x => x.id);
        const userEntities = await DatabaseManager.instance.getUsersByIds(memberIds);
        const seedRatings = this._autoplayData.playablesSeed.map(s =>
        {
            let rating : number = 0;
            let count : number = 0;
            userEntities.forEach(x =>
            {
                const trackRating = x.trackRatings.find(x => x.id = s.spotifyId);
                rating += trackRating.rating;
                count++;
            });
            rating = count == 0 ? 1 : rating / count;
            return {
                streamable: s,
                rating: rating,
            };
        });
        this._endlessTrackRating.push(...seedRatings);
        const playables : Playable[] = (await this.getEndlessPlayables(3));
        this._endlessTrackRating.push(...playables.flatMap(x => x.streamables).map(x =>
        {
            return {
                streamable: x,
                rating: 1,
            };
        }));
        this.client.emit('endlessStart', ctx, this._endlessSeed);
        this.addPlayables(playables, ctx.author, data);
        return playables;

    }

    public endEndlessMode()
    {
        this._endlessModeActive = false;
        this._endlessSeed = null;
        this._endlessTrackRating = [];
        this._endlessData = null;
    }

    private async getEndlessPlayables(count : number) : Promise<Playable[]>
    {
        if(count > 100)
        {
            this.client.logger.error('Cannot get more endless. Past 100');
            return;
        }

        if(!this._autoplayActive || !DatabaseManager.instance)
        {
            this.client.logger.error('Cannot getEndlessPlayables: Either endless more is not enabled or we are not connected to the database');
            return;
        }

        function sortFunction(trackRatingA, trackRatingB) : number
        {
            return trackRatingB.rating - trackRatingA.rating;
        }

        let sortedStreamables : StreamableData[] = this._autoplayData.trackRatings.filter(x => x.rating > 1)
            .sort(sortFunction)
            .map(x => x.streamable);
        sortedStreamables = sortedStreamables.slice(0, Math.min(sortedStreamables.length, 5));
        const recommendedStreamables : Streamable[] = await RecommendationSytem.recommend(sortedStreamables, count);

        const playables : Playable[] = recommendedStreamables.map(x => x.toPlayable()).filter(p =>
        {
            if(this.playableHistory.map(y => y.spotifyId).includes(p.spotifyId))
                return false;
            if(this.playables.map(x => x.spotifyId).includes(p.spotifyId))
                return false;
            return true;
        });

        if(playables.length <= 3)
            return this.getEndlessPlayables(count + 5);

        playables.forEach(x => x.data = this._endlessData);
        return playables;
    }


    public remove(index : number)
    {
        this.playables.splice(index, 1);
    }

    public pause()
    {
        this._isPaused = true;
        this.voiceStream.pause();
        this.client.emit('queuePause', this);
    }

    public unpause()
    {
        this._isPaused = false;
        this.voiceStream.unpause();
        this.client.emit('queueUnpause', this);
    }

    public stop()
    {
        this.playables = [];
        this._endlessModeActive = false;
        this._endlessTrackRating = [];
        this._endlessSeed = [];
        this.skip();
    }

    public async skip()
    {
        this.voiceStream.stop();
    }

    public shuffle()
    {
        if (this.playables.length !== 1)
        {
            for (let i = this.playables.length - 1; i > 0; i -= 1)
            {
                const j = Math.floor(Math.random() * (i + 1));
                [this.playables[i], this.playables[j]] = [this.playables[j], this.playables[i]];
            }
        }
        this.playables.forEach((x) =>
        {
            x.shuffle();
        });
    }

    public clear()
    {
        this.playables = [ this.currentPlayable ];
    }


}