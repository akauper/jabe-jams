/**
 * Largely referencing discord-music-player for handling apple searches
 */
import { Search } from './Search.js';
import axios from 'axios';
import { DomUtils, parseDocument } from 'htmlparser2';
import { Document } from 'domhandler';
import axiosRetry from 'axios-retry';
import { EinSearchResponse } from '../../@types/types.js';
import { Spotify } from './Spotify';

axiosRetry(axios, { retries: 3 });

interface RawApplePlaylist {
    name: string
    type: 'playlist'|'album'
    author: string
    tracks: { artist: string, title: string }[]
}

export class Apple
{
    private constructor ()
    {
    }

    public static async search(urls: string[]): Promise<EinSearchResponse[]>
    {
        if (!urls || urls.length == 0)
            return [];
        const searches: string[] = [];
        for (const url of urls)
        {
            const exec = Search.AppleRegex.exec(url);
            const type: string = exec[2];
            let name: string = exec[3];
            name = name.replaceAll('-', ' ');

            let toSearch: string = `${type} ${name}`;

            if (type === 'album' || type === 'artist')
            {
                const result = await this.getPlaylist(url);
                if (result)
                    toSearch += ` ${type === 'album' ? 'album' : 'artist'}:${result.author}`;
            }
            searches.push(toSearch);
        }


        return Spotify.search(searches, []);
    }

    // public async getPlayablesFromUrls(urls: string[]): Promise<Playable[]>
    // {
    //     if (!urls || urls.length === 0)
    //         return [];
    //     const searches: string[] = [];
    //     for (const url of urls)
    //     {
    //         const exec = Search.AppleRegex.exec(url);
    //         const type: string = exec[2];
    //         let name: string = exec[3];
    //         name = name.replaceAll('-', ' ');
    //
    //         let toSearch: string = `${type} ${name}`;
    //
    //         if (type === 'album' || type === 'artist')
    //         {
    //             const result = await this.getPlaylist(url);
    //             if (result)
    //                 toSearch += ` by ${result.author}`;
    //         }
    //         searches.push(toSearch);
    //     }
    //
    //
    //     return Search.spotify.search(searches, []);
    // }

    private static async getSong(url: string): Promise<{ artist: string, title: string }>
    {
        const res = await axios.get(url);
        const document = parseDocument(res.data);
        const song: any = [];
        song.artist = await this.findJSONLD(document);
        const regexName = /https?:\/\/music\.apple\.com\/.+?\/.+?\/(.+?)\//g;
        const title: any = regexName.exec(url);
        song.title = title[1];
        return song;
    }
    private static async getPlaylist(url: string): Promise<RawApplePlaylist|undefined>
    {
        const res = await axios.get(url);
        const document = parseDocument(res.data);
        return this.findJSONLD(document, true);
    }
    private static async findJSONLD(document: Document, forceAll: boolean = false): Promise<RawApplePlaylist|undefined>
    {
        const scripts = DomUtils.findAll((el) =>
        {
            if (el.type !== 'script')
                return false;

            return el.attribs.type === 'application/ld+json';
        }, document.children);

        for (let i = 0; i < scripts.length; i += 1)
        {
            const script = scripts[i];
            let data = JSON.parse(DomUtils.textContent(script));
            if ('@graph' in data) data = data['@graph'];
            if (data['@type'] === 'MusicAlbum' && !forceAll) return data.byArtist.name;
            if (data['@type'] === 'MusicAlbum')
            {
                const { name, byArtist, tracks } = data;
                return {
                    type: 'playlist',
                    name: name as string,
                    author: byArtist.name as string,
                    tracks: tracks.map((songData: any) => ({
                        artist: byArtist.name as string,
                        title: songData.name as string,
                    })),
                };
            } if (data['@type'] === 'MusicPlaylist')
            {
                const { name, author, track } = data;
                return {
                    type: 'playlist',
                    name: name as string,
                    author: author.name as string,
                    tracks: await Promise.all(
                        track.map(async (songData: any) => await this.getSong(songData.url)),
                    ).catch(() => []) as any[],
                };
            }
        }
    }
}