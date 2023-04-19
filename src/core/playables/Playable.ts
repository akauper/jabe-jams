import { User } from 'discord.js';
import Queue from '../Queue.js';
import Streamable from './Streamable.js';
import { AlbumData, ArtistData, PlayableData, PlayableType } from '../../@types/types.js';

export default class Playable implements PlayableData
{
    public playableType: PlayableType;
    public spotifyId: string;
    public name: string;
    public description: string;
    public artist: ArtistData;
    public url: string;
    public thumbnail: string;
    public duration: number;
    public streamables: Streamable[];
    public queue: Queue;
    public curPlayIndex: number;

    private _requestedBy: User;
    private _data?: any;

    public get data()
    {
        return this._data;
    }
    public set data(data : any)
    {
        this._data = data;
        this.streamables.forEach((x) =>
        {
            x.data = data;
        });
    }
    public get requestedBy()
    {
        return this._requestedBy;
    }
    public set requestedBy(user: User)
    {
        this._requestedBy = user;
        this.streamables.forEach(x =>
        {
            x.requestedBy = user;
        });
    }


    public constructor(data: PlayableData)
    {
        this.playableType = data.playableType;
        this.spotifyId = data.spotifyId;
        this.name = data.name;
        this.description = data.description;
        this.artist = data.artist;
        this.url = data.url;
        this.thumbnail = data.thumbnail;
        this.duration = data.duration;
        this.streamables = data.streamables;

        this.curPlayIndex = -1;
    }

    public get currentStreamable()
    {
        if (this.curPlayIndex === -1 || this.curPlayIndex > this.streamables.length - 1) return null;
        return this.streamables[this.curPlayIndex];
    }

    public advance(): Streamable
    {
        this.curPlayIndex += 1;
        if (this.curPlayIndex > this.streamables.length - 1) return null;
        return this.currentStreamable;
    }

    public shuffle(): Streamable[]
    {
        if (this.streamables.length !== 1)

            for (let i = this.streamables.length - 1; i > 0; i -= 1)
            {
                const j = Math.floor(Math.random() * (i + 1));
                [this.streamables[i], this.streamables[j]] = [this.streamables[j], this.streamables[i]];
            }


        return this.streamables;
    }

    toString(): string
    {
        return `${this.name}`;
    }
}
