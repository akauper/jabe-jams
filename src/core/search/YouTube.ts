import { Search } from './Search.js';
import { Playlist as YouTubePlaylist, Video as YouTubeVideo, YouTube as YouTubeSr } from 'youtube-sr';
import {
    AlbumData,
    ArtistData,
    EinSearchResponse,
    SearchCode,
    StreamableSource,
    UrlSearchQuery
} from '../../@types/types.js';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import ytsr from 'ytsr';
import Playable from '../playables/Playable.js';
import Streamable from '../playables/Streamable.js';
import { TextSearchQuery } from './TextSearchQuery';
import { Spotify } from './Spotify';

axiosRetry(axios, { retries: 3 });

interface YtVideo
{
    type: 'video';
    title: string;
    description: string;
    duration: number;
    id: string;
    url: string;
    thumbnailUrl: string;

    channel: {
        name: string;
        channelId: string;
        url: string;
        thumbnailUrl: string;
    } | null;
}
interface YtPlaylist
{
    type: 'playlist';
    title: string;
    playlistId: string;
    url: string;
    thumbnailUrl: string;
    channel: {
        name: string;
        channelId: string;
        url: string;
        thumbnailUrl: string;
    } | null;
    videos: YtVideo[];
}
declare type YtObject = YtVideo | YtPlaylist;

interface YouTubeResponse
{
    query : string;
    queryType : 'text' | 'URL';
    queryPlatform : StreamableSource;

    code: SearchCode,
    codeDetails?: string,
    value: YtObject,
}

export class YouTube
{
    private constructor ()
    {
    }

    // Never want to get playable from a YT URL because its hard to spotify search it :(
    public static async search(urls: string[]): Promise<EinSearchResponse[]>
    {
        if (!urls || urls.length == 0)
            return [];

        const r = await Promise.all(urls.map(async url =>
        {
            let ytObject : YtObject;

            if(Search.YouTubePlaylistRegex.test(url))
            {
                const playlist : YouTubePlaylist = await YouTubeSr.getPlaylist(url);
                if(!playlist)
                    return { query: url, queryType: 'URL', queryPlatform: 'youtube', code: SearchCode.InvalidURL, codeDetails: "Invalid YouTube playlist URL" };
                ytObject = this.youtTubeSrToPlaylist(playlist);
            }
            else
            {
                const video : YouTubeVideo = await YouTubeSr.getVideo(url);
                if(!video)
                    return { query: url, queryType: 'URL', queryPlatform: 'youtube', code: SearchCode.InvalidURL, codeDetails: "Invalid YouTube video URL" };
                ytObject = this.youtubeSrToVideo(video);
            }

            const queries : TextSearchQuery[] = await this.getTextSearchQueries(ytObject);
        }));

        const searchResponses : EinSearchResponse[] = [];

        for (const url of urls)
        {
            let ytObject : YtObject;
            if(Search.YouTubePlaylistRegex.test(url))
            {
                let t : YouTubePlaylist;
                try { t = await YouTubeSr.getPlaylist(url); }
                catch { t = null; }

                if(!t)
                {
                    searchResponses.push({ query: url, queryType: 'URL', queryPlatform: 'youtube', code: SearchCode.InvalidURL, codeDetails: "Invalid YouTube playlist URL" });
                    continue;
                }
                ytObject = this.youtTubeSrToPlaylist(t);
            }
            else
            {
                let t : YouTubeVideo;
                try { t = await YouTubeSr.getVideo(url); }
                catch { t = null; }

                if(!t)
                {
                    searchResponses.push({ query: url, queryType: 'URL', queryPlatform: 'youtube', code: SearchCode.InvalidURL, codeDetails: "Invalid YouTube video URL" });
                    continue;
                }
                ytObject = this.youtubeSrToVideo(t);
            }

            const queries : TextSearchQuery[] = await this.getTextSearchQueries(ytObject);
            for (const query of queries)
            {
                if (query)
                {
                    const p = await Spotify.searchTextQueries([query])
                    searchResponses.push(...p);
                }
                else
                {
                    const artistData: ArtistData = this.getArtistData(ytObject);
                    const duration = ytObject.type === 'video' ?
                        ytObject.duration : ytObject.videos.map((x) => x.duration).reduce((a, b) => a + b, 0);
                    const playable = new Playable({
                        playableType: 'playlist',
                        spotifyId: 'youtube',
                        name: ytObject.title,
                        description: '',
                        artist: artistData,
                        url: ytObject.url,
                        thumbnail: ytObject.thumbnailUrl,
                        duration: duration,
                        streamables: this.videosToStreamableData(ytObject.type === 'video' ? [ ytObject ] : ytObject.videos),
                    });
                    searchResponses.push({ query: url, queryType: 'URL', queryPlatform: 'youtube', code: SearchCode.Success, playable: playable });
                }
            }
        }
        return searchResponses;
    }

    // public async getPlayablesFromUrls(urls: string[]): Promise<Playable[]>
    // {
    //     if (!urls || urls.length === 0)
    //         return [];
    //
    //     let playables: Playable[] = [];
    //
    //     for (const url of urls)
    //     {
    //         let response: YtObject;
    //         try
    //         {
    //             if (Search.YouTubePlaylistRegex.test(url))
    //             {
    //                 const t: YouTubePlaylist = await YouTubeSr.getPlaylist(url);
    //                 response = this.youtTubeSrToPlaylist(t);
    //             }
    //             else
    //             {
    //                 const t = await YouTubeSr.getVideo(url);
    //                 response = this.youtubeSrToVideo(t);
    //             }
    //         }
    //         catch
    //         {
    //             if (!Search.YouTubePlaylistRegex.test(url))
    //             {
    //                 const sr: ytsr.Result = await ytsr(url, { limit: 1 });
    //                 response = this.ytsrToVideo(sr.items[0] as ytsr.Video);
    //             }
    //             else
    //                 throw 'Not Implemented: YouTube.ts ytsr Playlist';
    //         }
    //
    //
    //         const searchInfos: SearchInfo[] = await this.ytObjectToSearchInfos(response);
    //         for (const searchInfo of searchInfos)
    //         {
    //             if (searchInfo)
    //             {
    //                 const formattedSearches = searchInfos.map(x => Search.getFormattedSearch(x));
    //                 const p = await Search.spotify.search(formattedSearches, []);
    //                 playables = playables.concat(p);
    //             }
    //             else
    //             {
    //                 const artistData: ArtistData = this.getArtistData(response);
    //                 const duration = response.type === 'video' ?
    //                     response.duration : response.videos.map((x) => x.duration).reduce((a, b) => a + b, 0);
    //                 playables.push(new Playable({
    //                     playableType: 'playlist',
    //                     spotifyId: 'youtube',
    //                     name: response.title,
    //                     description: '',
    //                     artist: artistData,
    //                     url: response.url,
    //                     thumbnail: response.thumbnailUrl,
    //                     duration: duration,
    //                     streamables: this.videosToStreamableData(response.type === 'video' ? [ response ] : response.videos),
    //                 }));
    //             }
    //         }
    //     }
    //     return playables;
    // }

    public static async getUrlFromSongAndArtist(songName : string, artistName? : string) : Promise<string>
    {
        let formattedSearch : string = songName;
        if(artistName)
            formattedSearch += ` by ${artistName}`;

        //let result : YouTubeVideo | YouTubePlaylist;
        // if (query.type === 'playlist' || query.type === 'album')
        //     result = await YouTubeSr.searchOne(formattedSearch, 'playlist', false);
        // else
        let result : YouTubeVideo
        result = await YouTubeSr.searchOne(formattedSearch, 'video', false);

        if (!result)
            return "";

        // console.log('FFFF HERE');
        // console.log(result);

        return result.url;
    }
    // public static async getUrlFromSearchQuery(query: TextSearchQuery) : Promise<string>
    // {
    //     const formattedSearch: string = query.getFormattedString();
    //
    //     let result : YouTubeVideo | YouTubePlaylist;
    //     if (query.type === 'playlist' || query.type === 'album')
    //         result = await YouTubeSr.searchOne(formattedSearch, 'playlist', false);
    //     else
    //         result = await YouTubeSr.searchOne(formattedSearch, 'video', false);
    //
    //     if (!result)
    //         return "";
    //
    //     // console.log('FFFF HERE');
    //     // console.log(result);
    //
    //     return result.url;
    // }
    private static videosToStreamableData(videos: YtVideo[]): Streamable[]
    {
        return videos.map(video =>
        {
            return new Streamable({
                streamableSource: 'youtube',
                spotifyId: 'youtube',
                name: video.title,
                description: video.description,
                artist: this.getArtistData(video),
                album: this.getAlbumData(video),
                url: video.url,
                youtubeUrl: video.url,
                thumbnail: video.thumbnailUrl,
                duration: video.duration,
                // No Popularity
                // No Explicit
                audioFeatures: {
                    exists: false,
                },
            });
        });
    }
    private static getArtistData(response: YtObject): ArtistData
    {
        return {
            spotifyId: 'youtube',
            name: response.channel.name,
            url: response.channel.url,
            thumbnail: response.channel.thumbnailUrl,
        };
    }
    private static getAlbumData(response: YtVideo): AlbumData
    {
        return {
            spotifyId: 'youtube',
            name: response.title,
            description: response.description,
            url: response.url,
            thumbnail: response.thumbnailUrl,
        };
    }


    private static async getTextSearchQueries(response: YtObject) : Promise<TextSearchQuery[]>
    {
        if(response.type === 'playlist')
            return await this.urlsToSearchQueries(response.videos.map(x => x.url));
        const t = await this.urlToSearchQuery(response.url);
        return [t];
    }

    private static async urlsToSearchQueries(urls : string[]) : Promise<TextSearchQuery[]>
    {
        const queries: TextSearchQuery[] = [];
        for (const url of urls)
        {
            const query = await this.urlToSearchQuery(url);
            queries.push(query);
        }
        return queries;
    }
    private static async urlToSearchQuery(url : string) : Promise<TextSearchQuery>
    {
        const response = await axios.get(url);

        if (response.data.includes('Auto-generated by YouTube'))
        {
            const autoRegex = /("description":.*?(Auto-generated by YouTube."}]}))|("description":.*?Auto-generated by Youtube."})/gi;
            const rawMatches = [ ...response.data.matchAll(autoRegex) ];
            const jsonArr: any[] = [];
            rawMatches.forEach(x =>
            {
                const str = '{' + x[0].replace(' ', '') + '}';
                const json = JSON.parse(str);
                if (json)
                    jsonArr.push(json);
            });

            let description: string;
            for (const j of jsonArr)
            {
                if (!j || !j.description)
                    continue;

                // (\\n'.*\\n'\ \+\ \ \ \ '(.*?·\ ?)\ (.*?·?\ \·))
                if (Object.prototype.hasOwnProperty.call(j.description, 'simpleText'))
                    description = j.description.text;
                else
                    description = j.description?.runs[0]?.text;
            }

            // if (description)
            // {
            //     const r = /\\n\\n(.*?·)(.*? ·)/;
            //     const match = description.replaceAll('\n', '\\n').match(r);
            //     if (match)
            //     {
            //         const songName = match[1].slice(0, -1).trim();
            //         const artistName = match[2].slice(0, -1).trim();
            //         if (!songName && !artistName)
            //             return null;
            //         else
            //         {
            //             return {original_query: url, type: 'track', track_name: songName, artist_name: artistName };
            //         }
            //     }
            // }
            if (description)
            {
                const r = /\\n\\n(.*?·)(.*? ·)/;
                const match = description.replaceAll('\n', '\\n').match(r);
                if (match)
                {
                    const songName = match[1].slice(0, -1).trim();
                    const artistName = match[2].slice(0, -1).trim();
                    if (!songName && !artistName)
                        return null;
                    else
                    {
                        return TextSearchQuery.FromInterface({original_query: url, type: 'track', track_name: songName, artist_name: artistName });
                    }
                }
                else
                {
                    // Handle the case when the song name and artist name are not found in the description
                    return TextSearchQuery.FromInterface({original_query: url, type: 'track', track_name: "Unknown Song", artist_name: "Unknown Artist" } );
                }
            }
        }
        const regex = /({"metadataRowRenderer":.*?})(?=,{"metadataRowRenderer")/g;
        const rawMatches = [ ...response.data.matchAll(regex) ];
        const jsons: any[] = [];
        rawMatches.forEach(m =>
        {
            const str = m[0].replace(' ', '');
            if (str.includes('{"simpleText":"Song"}')
                || str.includes('{"simpleText":"Artist"}')
                || str.includes('{"simpleText":"Album"}'))
            {
                jsons.push(JSON.parse(str));
            }
        });

        let songName: string, artistName: string, albumName: string;

        for (let i = 0; i < Math.min(jsons.length, 3); i++)
        {
            let contents = jsons[i].metadataRowRenderer?.contents;
            if (!contents || !contents.length || contents.length == 0)
                continue;
            contents = contents[0];
            if (!contents)
                continue;

            let name: string;
            if (Object.prototype.hasOwnProperty.call(contents, 'runs'))
                name = contents.runs[0]?.text;
            else
                name = contents.simpleText;
            if (i === 0)
                songName = name;
            else if (i === 1)
                artistName = name;
            else if (i === 2)
                albumName = name;
        }

        if (!songName && !artistName && !albumName)
            return null;

        return TextSearchQuery.FromInterface({ original_query: url, type: 'track', track_name: songName, artist_name: artistName, album_name: albumName } );
    }




    private static ytsrToVideo(video: ytsr.Video): YtVideo
    {
        return {
            type: 'video',
            title: video.title,
            description: video.description,
            duration: parseFloat(video.duration),
            id: video.id,
            url: video.url,
            thumbnailUrl: video.bestThumbnail.url,
            channel: {
                name: video.author.name,
                channelId: video.author.channelID,
                url: video.author.url,
                thumbnailUrl: video.author.bestAvatar.url,
            },
        };
    }
    private static ytsrToPlaylist(playlist: ytsr.Playlist, videos: ytsr.Video[]): YtPlaylist
    {
        return {
            type: 'playlist',
            title: playlist.title,
            playlistId: playlist.playlistID,
            url: playlist.url,
            thumbnailUrl: '',
            channel: {
                name: playlist.owner.name,
                channelId: playlist.owner.channelID,
                url: playlist.owner.url,
                thumbnailUrl: '',
            },
            videos: videos.map(x => this.ytsrToVideo(x)),
        };
    }
    private static youtubeSrToVideo(video: YouTubeVideo): YtVideo
    {
        return {
            type: 'video',
            title: video.title,
            description: video.description,
            duration: video.duration,
            id: video.id,
            url: video.url,
            thumbnailUrl: video.thumbnail.url,
            channel: {
                name: video.channel.name,
                channelId: video.channel.id,
                url: video.channel.url,
                thumbnailUrl: video.channel.icon.url,
            },
        };
    }
    private static youtTubeSrToPlaylist(playlist: YouTubePlaylist): YtPlaylist
    {
        return {
            type: 'playlist',
            title: playlist.title,
            playlistId: playlist.id,
            url: playlist.url,
            thumbnailUrl: playlist.thumbnail.url,
            channel: {
                name: playlist.channel.name,
                channelId: playlist.channel.id,
                url: playlist.channel.url,
                thumbnailUrl: playlist.channel.icon.url,
            },
            videos: playlist.videos.map(x => this.youtubeSrToVideo(x)),
        };
    }
}