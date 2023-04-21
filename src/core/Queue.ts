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
    EndlessSeedTypes,
    InteractionType, QueueEvents
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
import RecommendationSystem from '../recommendationSystem/RecommendationSystem';
import { TypedEmitter } from 'tiny-typed-emitter';

export interface QueueAutoplayData
{
    originalSeed : EndlessSeedTypes;
    requester : User,
    data : any,
    // trackRatings : { streamable: StreamableData, rating : number}[]
}

export default class Queue
{
    private static emitter = new TypedEmitter<QueueEvents>();

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
    private _autoplayData : QueueAutoplayData;

    public playables: Playable[] = [];
    public playableHistory: Playable[] = [];

    public data?: any;

    private static readonly guildQueues: Map<Snowflake, Queue> = new Map<Snowflake, Queue>();

    public get currentPlayable(): Playable | null {
        return this.playables[0] ?? null;
    }

    public get autoplayActive() { return this._autoplayActive; }

    private constructor (client: EinClient, guild : Guild)
    {
        this.client = client;
        this.guild = guild;
    }

    public static on(eventName : keyof QueueEvents, callback: QueueEvents[keyof QueueEvents]) : void {
        this.emitter.on(eventName, callback);
    }

    public static off(eventName : keyof QueueEvents, callback: QueueEvents[keyof QueueEvents]) : void {
        this.emitter.off(eventName, callback);
    }

    public static emit(eventName : keyof QueueEvents, ...args: Parameters<QueueEvents[keyof QueueEvents]>) : void {
        this.emitter.emit(eventName, ...args);
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

        if(!guildMember?.voice?.channel) {
            EinClient.instance.logger.error('Error creating Queue. GuildMember or GuildMember Voice Channel is null.');
            return;
        }

        const voiceChannel = guildMember.voice.channel;
        if(voiceChannel.type != ChannelType.GuildVoice) {
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

        Queue.emit('create', newQueue);

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
        this.removeAllPlayables();
        Queue.guildQueues.delete(this.guild.id);
        //this.client.emit('queueDestroy', this);
        Queue.emit('destroy', this);
    }

    public async joinVoiceChannel(voiceChannel: VoiceChannel) {
        if (this.voiceStream) {
            this.voiceStream.disconnect();
            this.voiceStream = null;
        }

        await this.connectToVoiceChannel(voiceChannel);

        this.initializeVoiceStreamEvents();
    }

    private async connectToVoiceChannel(voiceChannel: VoiceChannel): Promise<void> {
        let voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: createDiscordJSAdapter(voiceChannel),
            selfDeaf: false,
        });

        try {
            voiceConnection = await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);
            this.voiceStream = new VoiceStream(voiceConnection, voiceChannel);
            this._voiceChannel = voiceChannel;
        } catch (e) {
            voiceConnection.destroy();
            this.client.logger.error("queue.joinVoiceChannel - Voice Connection Error");
            return;
        }
    }

    private initializeVoiceStreamEvents(): void {
        this.voiceStream.on("start", (resource) => this.voiceStreamStart(resource));
        this.voiceStream.on("end", (resource) => this.voiceStreamEnd(resource));
    }

    private voiceStreamStart(resource: AudioResource<Streamable>)
    {
        const wasPlaying = this.isPlaying;
        this._isPlaying = true;
        if(!wasPlaying)
            Queue.emit('start', this);
        // if(!wasPlaying)
        //     this.client.emit('queueStart', this);
    }

    private voiceStreamEnd(resource : AudioResource<Streamable>)
    {
        if (this.isDestroyed)
        {
            //this.client.emit('queueDestroy', this);
            Queue.emit('destroy', this);
            return;
        }
        this.playNext();
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

    private addPlayables(newPlayables : Playable[], requester : User, data?: unknown) : void
    {
        newPlayables.forEach(x =>
        {
            x.queue = this;
            x.requestedBy = requester;
            x.data = data;
        });

        if(EinClient.instance.config.databaseSettings.enableDatabase)
            DatabaseManager.instance?.userInteractStreamables(requester, InteractionType.Play, newPlayables.flatMap(x => x.streamables));

        this.playables.push(...newPlayables);
        newPlayables.forEach(x => Queue.emit('playableAdd', this, x));
        newPlayables.flatMap(p => p.streamables).forEach(s =>
        {
            this.client.emit('songAdd', this, s);
        });
    }


    public removePlayableAtIndex(index : number) : void
    {
        const removed = this.playables.splice(index, 1);
        this.playableHistory.push(removed[0]);
        Queue.emit('playableRemoved', this, removed[0]);
    }
    private removeAllPlayables()
    {
        const removed = this.playables;
        this.playables = [];
        this.playableHistory.push(...removed);
        removed.forEach(x => Queue.emit('playableRemoved', this, x));
    }

    private async playNext(oldStreamable?: Streamable) : Promise<Playable>
    {
        // If the queue is destroyed, log an error and return
        if (this.isDestroyed) {
            this.client.logger.error('Queue.playNext -- No Voice Connection');
            return;
        }

        // If there are no playables left in the queue, call end and return
        if(this.playables.length === 0) {
            this._isPlaying = false;
            // this.client.emit('queueEnd', this);
            Queue.emit('end', this);
            return;
        }

        if(this._autoplayActive) {
            const remainingStreamables : Streamable[] = this.playables.flatMap(x => x.streamables);
            if(remainingStreamables.length < 3) {
                await this.fetchAutoplayRecommendations();
            }
        }

        if(!oldStreamable) {
            oldStreamable = this.currentPlayable.currentStreamable;
        } else {
            Queue.emit('playableStart', this, this.currentPlayable);
        }

        Queue.emit('streamableEnd', this, oldStreamable);

        const nextStreamable = this.currentPlayable.advance();

        // If there is no next streamable in the current playable, remove it and advance to the next playable
        if(!nextStreamable) {
            const previousPlayable = this.playables.shift();
            this.playableHistory.push(previousPlayable);
            Queue.emit('playableEnd', this, previousPlayable);

            return this.playNext(oldStreamable);
        }

        Queue.emit('streamableStart', this, nextStreamable);

        await this.voiceStream.playStreamable(nextStreamable);

        return this.currentPlayable;
    }

    private async fetchAutoplayRecommendations()
    {
        if(!this.autoplayActive) return;

        const newPlayables : Playable[] = await RecommendationSystem.recommend(this, null, this.voiceChannel, 5);
        this.addPlayables(newPlayables, this._autoplayData.requester, this._autoplayData.data);
    }

    public async startAutoplay(seed : EndlessSeedTypes, ctx : Context, data? : unknown)
    {
        const seedPlayables = await RecommendationSystem.recommend(seed, ctx, ctx.guildMember.voice.channel, 5);
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

        //this.client.emit('endlessStart', ctx, this._autoplayData);
        Queue.emit('autoplayStart', this, ctx, this._autoplayData);

        const lengthBefore = this.playables.length;
        this.addPlayables(seedPlayables, ctx.author, data);
        if(lengthBefore === 0)
            await this.playNext();
    }

    public stopAutoplay()
    {
        this._autoplayActive = false;
        this._autoplayData = null;
        Queue.emit('autoplayEnd', this);
    }

    public pause()
    {
        this._isPaused = true;
        this.voiceStream.pause();
        //this.client.emit('queuePause', this);
        Queue.emit('pause', this);
    }

    public unpause()
    {
        this._isPaused = false;
        this.voiceStream.unpause();
        //this.client.emit('queueUnpause', this);
        Queue.emit('resume', this);
    }

    public stop()
    {
        this.removeAllPlayables();
        this.stopAutoplay();
        this.voiceStream.stop();
        Queue.emit('stop', this);
    }

    public skip()
    {
        this.voiceStream.stop();
        Queue.emit('skip', this);
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
        Queue.emit('shuffle', this);
    }

    public clear()
    {
        this.removeAllPlayables();
        Queue.emit('clear', this);
    }


}