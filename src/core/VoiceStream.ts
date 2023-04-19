import {
    AudioPlayer,
    AudioPlayerState,
    AudioPlayerStatus,
    AudioResource,
    createAudioPlayer,
    createAudioResource,
    entersState,
    StreamType,
    VoiceConnection,
    VoiceConnectionDisconnectReason,
    VoiceConnectionState,
    VoiceConnectionStatus
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { Readable } from 'stream';
import pkg from 'cookiefile';
const { CookieMap } = pkg;
import ytdl from 'discord-ytdl-core';
import { promisify } from 'node:util';
import { TypedEmitter } from 'tiny-typed-emitter';
import { VoiceStreamEvents } from '../@types/types.js';
import { EinClient, Streamable } from './index.js';

const streamType: StreamType = StreamType.Raw;


const wait = promisify(setTimeout);

export default class VoiceStream extends TypedEmitter<VoiceStreamEvents>
{
    public readonly voiceConnection : VoiceConnection;
    public readonly audioPlayer : AudioPlayer;
    public voiceChannel : VoiceChannel;
    public audioResource? : AudioResource<Streamable>

    public isPaused : boolean = false;
    private readyLock: boolean = false;

    private _playStartTimeMS : number;

    public constructor (connection : VoiceConnection, voiceChannel : VoiceChannel)
    {
        super();

        this.voiceConnection = connection;
        this.audioPlayer = createAudioPlayer();
        this.voiceChannel = voiceChannel;
        this.isPaused = false;

        this.voiceConnection.on('stateChange',
            async (oldState, newState) =>
                this.onVoiceConnectionStateChange(oldState, newState));
        this.audioPlayer.on('stateChange',
            (oldState, newState) =>
                this.onAudioPlayerStateChange(oldState, newState));
        this.audioPlayer.on('error', (error) =>
        {
            if(!/premature/i.test(error.message))
            {
                this.emit('error', error);
            }
        });

        this.voiceConnection.subscribe(this.audioPlayer);
    }

    private async onVoiceConnectionStateChange(oldState : VoiceConnectionState, newState : VoiceConnectionState)
    {
        if (newState.status == VoiceConnectionStatus.Disconnected)
        {
            if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014)
            {
                try
                {
                    await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000);
                }
                catch
                {
                    this.disconnect();
                }
            }
            else if (this.voiceConnection.rejoinAttempts < 5)
            {
                await wait((this.voiceConnection.rejoinAttempts + 1) * 5_000);
                this.voiceConnection.rejoin();
            }
            else
            {
                this.disconnect();
            }
        }
        else if (newState.status === VoiceConnectionStatus.Destroyed)
        {
            this.stop();
        }
        else if (!this.readyLock && (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling))
        {
            this.readyLock = true;
            try
            {
                await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20_000);
            }
            catch
            {
                if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) { this.disconnect(); }
            }
            finally
            {
                this.readyLock = true;
            }
        }
    }

    private onAudioPlayerStateChange(oldState: AudioPlayerState, newState: AudioPlayerState)
    {
        if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle)
        {
            if (!this.isPaused)
            {
                this.emit('end', this.audioResource);
                delete this.audioResource;
            }
        }
        else if (newState.status === AudioPlayerStatus.Playing)
        {
            if (!this.isPaused)
            {
                this.emit('start', this.audioResource);
            }
        }
    }

    public async playStreamable(streamable : Streamable)
    {
        let stream : string | Readable;
        if(streamable.streamableSource === 'spotify')
        {
            stream = await this.getSpotifyStream(streamable);
        }
        else if(streamable.streamableSource === 'youtube')
        {
            stream = await this.getYoutubeStream(streamable);
        }

        this.audioResource = createAudioResource<Streamable>(stream,
            {
                inputType: streamType,
                inlineVolume: true,
                metadata: streamable,
            });

        this._playStartTimeMS = Date.now();

        await this.playAudioResource(this.audioResource);
    }

    private async playAudioResource(resource : AudioResource<Streamable>)
    {
        if(!resource)
        {
            EinClient.instance.logger.error('VoiceStream.playAudioResource -- Invalid Audio Resource');
            return;
        }

        if(this.voiceConnection.state.status !== VoiceConnectionStatus.Ready)
        {
            await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20_000);
        }

        this.audioPlayer.play(resource);
    }

    private async getSpotifyStream(streamable: Streamable): Promise<string | Readable>
    {
        return this.getYoutubeStream(streamable);
        /*
        const spotifyPlayback = await ExternalConnections.getSpotifyPlaybackConnection();
        const accessToken = await ExternalConnections.getSpotifyAccessToken();
        const player = await spotifyPlayback.createPlayer({
            name: "Web",
            getOAuthToken(){
                return accessToken;
            },
        });

        player.on('player_state_changed', (e) => {console.log(`************ff******${e}*****f*****`)});

        const stream = await player.getAudio();
        const connected = await player.connect();
        if(!connected) throw 'couldnt connect';

        //console.log("connected", stream);
        console.log('connected');
        await player.togglePlay();
        await player.nextTrack();
        await player.togglePlay();

        return stream;

         */
    }

    private async getYoutubeStream(streamable: Streamable): Promise<string | Readable>
    {
        console.log(streamable.youtubeUrl);

        const cookieMap = new CookieMap('cookies.txt');
        const cookies = cookieMap.toRequestHeader().replace('Cookie: ', '');

        return ytdl(streamable.youtubeUrl, {
            opusEncoded: false,
            seek: 0,
            fmt: 's16le',
            encoderArgs: [],
            quality: 'highestaudio',
            highWaterMark: 1 << 25,
            filter: 'audioonly',
            requestOptions: {
                headers: {
                    'Cookie': cookies,
                }
            },
        });
        //     .on('error', (error: { message: string; }) =>
        // {
        //     console.log('zzzzzz: ', error);
        //     if (/Status code|premature close/i.test(error.message))
        //     {
        //         this.emit('error', error.message === 'Video unavailable' ? 'VideoUnavailable' : error.message);
        //     }
        //     return null;
        // });
    }

    public pause()
    {
        this.audioPlayer.pause(true);
        this.isPaused = true;
    }

    public unpause()
    {
        this.audioPlayer.unpause();
        this.isPaused = false;
    }

    public stop(): boolean
    {
        return this.audioPlayer.stop();
    }

    public disconnect()
    {
        try
        {
            if(this.audioPlayer)
                this.audioPlayer.stop(true);
            if(this.voiceConnection)
                this.voiceConnection.destroy();
            this.emit('disconnect');
        }
        catch
        {
        }
    }

    public get currentStreamableDurationMS()
    {
        if (!this.audioResource) { return 0; }
        return this.audioResource.metadata.duration * 1_000;
    }

    public get streamCurrentTimeMS()
    {
        if(!this.audioResource) { return 0; }
        return Date.now() - this._playStartTimeMS;
    }

    public get volume()
    {
        if (!this.audioResource?.volume) { return -1; }
        const currentVol = this.audioResource.volume.volumeLogarithmic;
        return currentVol;
    }

    public set volume(volume: number)
    {
        if (!this.audioResource || Number.isNaN(volume) || volume >= Infinity || volume < 0)
        {
            return;
        }
        this.audioResource.volume?.setVolumeLogarithmic(volume);
    }
}