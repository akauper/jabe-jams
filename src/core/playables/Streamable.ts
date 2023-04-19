import { User } from 'discord.js';
import { AlbumData, ArtistData, TrackAudioFeatures, StreamableData, StreamableSource } from '../../@types/types.js';
import Playable from './Playable.js';

export default class Streamable implements StreamableData
{

    public streamableSource: StreamableSource;
    public spotifyId: string;
    public name: string;
    public description: string;
    public artist: ArtistData;
    public album: AlbumData;
    public url: string;
    public youtubeUrl: string;
    public thumbnail: string;
    public duration: number;
    public popularity: number;
    public explicit: boolean;
    public audioFeatures: TrackAudioFeatures;

    public requestedBy: User;
    public data?: any;

    public constructor(data: StreamableData)
    {
        this.streamableSource = data.streamableSource;
        this.spotifyId = data.spotifyId;
        this.name = data.name;
        this.description = data.description;
        this.artist = data.artist;
        this.album = data.album;
        this.url = data.url;
        this.youtubeUrl = data.youtubeUrl;
        this.thumbnail = data.thumbnail;
        this.duration = data.duration;
        this.popularity = data.popularity;
        this.explicit = data.explicit;
        this.audioFeatures = data.audioFeatures;
    }

    public toString(): string
    {
        return `${this.name} by ${this.artist.name}`;
    }

    public toPlayable(): Playable
    {
        const p = new Playable({
            playableType: 'track',
            spotifyId: this.spotifyId,
            name: this.name,
            description: this.description,
            artist: this.artist,
            url: this.url,
            thumbnail: this.thumbnail,
            duration: this.duration,
            streamables: [this],
        });
        p.requestedBy = this.requestedBy;
        p.data = this.data;
        return p;
    }
}

