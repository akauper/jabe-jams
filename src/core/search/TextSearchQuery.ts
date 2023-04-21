import { PlayableType, TextSearchQueryInterface } from '../../@types/types';

export class TextSearchQuery implements TextSearchQueryInterface
{
    public readonly original_query : string;
    public readonly type : PlayableType | 'generic';
    public readonly track_name? : string;
    public readonly artist_name? : string;
    public readonly album_name? : string;
    public readonly playlist_name? : string;

    private constructor (textSearchQueryInterface : TextSearchQueryInterface)
    {
        this.original_query = textSearchQueryInterface.original_query;
        this.type = textSearchQueryInterface.type;
        this.track_name = textSearchQueryInterface.track_name;
        this.artist_name = textSearchQueryInterface.artist_name;
        this.album_name = textSearchQueryInterface.album_name;
        this.playlist_name = textSearchQueryInterface.playlist_name;
    }

    public static FromString(stringQuery : string) : TextSearchQuery
    {
        const original_query = stringQuery;
        let type : PlayableType | 'generic' = undefined;
        let track_name : string = undefined;
        let artist_name : string = undefined;
        let album_name : string = undefined;
        let playlist_name : string = undefined;

        const playlistMatch = stringQuery.match(/playlist:(.*?)(track|artist|album|$)/i);
        const playlist : string = playlistMatch && playlistMatch.length >= 1 ? playlistMatch[1].trim() : null;
        if(playlist)
        {
            type = 'playlist';
            playlist_name = playlist;
            return;
        }
        else
        {
            const trackMatch = stringQuery.match(/track:(.*?)(artist|album|playlist|$)/i);
            const track : string = trackMatch && trackMatch.length >= 1 ? trackMatch[1].trim() : null;

            const artistMatch = stringQuery.match(/artist:(.*?)(track|album|playlist|$)/i);
            const artist : string = artistMatch && artistMatch.length >= 1 ? artistMatch[1].trim() : null;

            const albumMatch = stringQuery.match(/album:(.*?)(track|artist|playlist|$)/i);
            const album : string = albumMatch && albumMatch.length >= 1 ? albumMatch[1].trim() : null;

            track_name = track;
            artist_name = artist;
            album_name = album;

            if(track)
            {
                type = 'track';
            }

            if(album && artist)
            {
                const albumIndex = stringQuery.indexOf('album');
                const artistIndex = stringQuery.indexOf('artist');
                type = albumIndex < artistIndex ? 'album' : 'artist';
            }
            else if(album)
            {
                type = 'album';
            }
            else if(artist)
            {
                type = 'artist';
            }
            else
            {
                type = 'generic';
            }
        }

        return new TextSearchQuery({
            original_query: original_query,
            type: type,
            track_name: track_name,
            artist_name: artist_name,
            album_name: album_name,
            playlist_name: playlist_name
        });
    }

    public static FromInterface(textSearchQueryInterface : TextSearchQueryInterface)
    {
        return new TextSearchQuery(textSearchQueryInterface);
    }

    public getFormattedString() : string
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