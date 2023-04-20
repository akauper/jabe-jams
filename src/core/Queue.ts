import EinClient from './EinClient.js';
import {
    ChannelType,
    Guild,
    GuildMember,
    GuildMemberResolvable,
    Snowflake,
    User,
    VoiceBasedChannel,
    VoiceChannel
} from 'discord.js';
import VoiceStream from './VoiceStream.js';
import {
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
import { RecommendationSystem } from '../recommendationSystem/RecommendationSystem';
import { Search } from './search/Search';
import { PlaylistEntity } from '../recommendationSystem/databaseEntities/PlaylistEntity.js';
import { AlbumEntity } from '../recommendationSystem/databaseEntities/AlbumEntity.js';
import ExternalConnections from '../util/ExternalConnections.js';
import { Spotify } from './search/Spotify';
import { ArtistEntity } from '../recommendationSystem/databaseEntities/ArtistEntity.js';
import { UserEntity } from '../recommendationSystem/databaseEntities/UserEntity';

interface AutoplayData
{
    originalSeed : EndlessSeedTypes;
    requester : User,
    data : any,
    // trackRatings : { streamable: StreamableData, rating : number}[]
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

    public get autoplayActive() { return this._autoplayActive; }

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

        if(this._autoplayActive)
        {
            const totalRemainingStreamables : Streamable[] = this.playables.flatMap(x => x.streamables);
            if(totalRemainingStreamables.length < 3)
            {
                const newPlayables : Playable[] = await RecommendationSystem.recommend(this, null, this.voiceChannel, 3);
                this.addPlayables(newPlayables, this._autoplayData.requester, this._autoplayData.data);
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

    public async startAutoplay(seed : EndlessSeedTypes, ctx : Context, data? : unknown)
    {
        const seedPlayables = await RecommendationSystem.recommend(seed, ctx, ctx.guildMember.voice.channel, 3);
        if(!seedPlayables || seedPlayables.length === 0)
        {
            ctx.sendSimpleErrorMessage('Unknown error. Failed starting Autoplay');
            return;
        }

        this._autoplayActive = true;
        this._autoplayData = {
            originalSeed: seed,
            requester: ctx.author,
            data: data,
        };

        this.client.emit('endlessStart', ctx, this._autoplayData);

        const lengthBefore = this.playables.length;
        this.addPlayables(seedPlayables, ctx.author, data);
        if(lengthBefore === 0)
            await this.playNext();
    }

    public stopAutoplay()
    {
        this._autoplayActive = false;
        this._autoplayData = null;
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
        this.stopAutoplay();
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