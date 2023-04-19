import { PlayableType, TextSearchQueryInterface } from '../../@types/types';

export class TextSearchQuery implements TextSearchQueryInterface
{
    public readonly original_query : string;
    public readonly type : PlayableType | 'generic';
    public readonly track_name? : string;
    public readonly artist_name? : string;
    public readonly album_name? : string;
    public readonly playlist_name? : string;

    public constructor (stringQuery : string)
    {
        this.original_query = stringQuery;

        const playlistMatch = stringQuery.match(/playlist:(.*?)(track|artist|album|$)/i);
        const playlist : string = playlistMatch && playlistMatch.length >= 1 ? playlistMatch[1].trim() : null;
        if(playlist)
        {
            this.type = 'playlist';
            this.playlist_name = playlist;
            return;
        }

        const trackMatch = stringQuery.match(/track:(.*?)(artist|album|playlist|$)/i);
        const track : string = trackMatch && trackMatch.length >= 1 ? trackMatch[1].trim() : null;

        const artistMatch = stringQuery.match(/artist:(.*?)(track|album|playlist|$)/i);
        const artist : string = artistMatch && artistMatch.length >= 1 ? artistMatch[1].trim() : null;

        const albumMatch = stringQuery.match(/album:(.*?)(track|artist|playlist|$)/i);
        const album : string = albumMatch && albumMatch.length >= 1 ? albumMatch[1].trim() : null;

        this.track_name = track;
        this.artist_name = artist;
        this.album_name = album;

        if(track)
        {
            this.type = 'track';
        }

        if(album && artist)
        {
            const albumIndex = stringQuery.indexOf('album');
            const artistIndex = stringQuery.indexOf('artist');
            this.type = albumIndex < artistIndex ? 'album' : 'artist';
        }
        else if(album)
        {
            this.type = 'album';
        }
        else if(artist)
        {
            this.type = 'artist';
        }
        else
        {
            this.type = 'generic';
        }
    }

    public toString() : string
    {
        let str = '';
        switch(this.type)
        {
            case 'track':
                str += `track:${this.track_name}`;
                if(this.artist_name)
                    str += ` artist:${this.artist_name}`;
                if(this.album_name)
                    str += ` album:${this.album_name}`
                return str;
            case 'album':
                str += `album:${this.album_name}`;
                if(this.artist_name)
                    str += ` artist:${this.artist_name}`;
                return str;
            case 'artist':
                str += `artist:${this.artist_name}`;
                if(this.album_name)
                    str += ` album:${this.album_name}`;
                return str;
            case 'playlist':
                return `playlist:${this.playlist_name}`;
            case 'userPlaylist':
                throw 'not implemented';
            case 'generic':
                return this.original_query;

        }
    }
}