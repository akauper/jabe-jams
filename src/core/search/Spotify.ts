import { EinClient, Streamable } from '../index';
import ExternalConnections from '../../util/ExternalConnections';
import {
    AlbumData,
    ArtistData,
    EinSearchResponse,
    SearchCode,
    StreamableData,
    StreamableSource,
    TrackAudioFeatures,
    UrlSearchQuery
} from '../../@types/types';
import SpotifyWebApi from 'spotify-web-api-node';
import { Album, Artist, parse, ParsedSpotifyUri, Playlist, Track } from 'spotify-uri';
import { TextSearchQuery } from './TextSearchQuery';
import { DatabaseManager } from '../../recommendationSystem/DatabaseManager';
import Playable from '../playables/Playable';
import { Search } from './Search';
import TrackObjectFull = SpotifyApi.TrackObjectFull;
import AlbumObjectFull = SpotifyApi.AlbumObjectFull;
import AlbumObjectSimplified = SpotifyApi.AlbumObjectSimplified;
import ArtistObjectFull = SpotifyApi.ArtistObjectFull;
import SingleArtistResponse = SpotifyApi.SingleArtistResponse;
import MultipleAudioFeaturesResponse = SpotifyApi.MultipleAudioFeaturesResponse;
import AudioFeaturesObject = SpotifyApi.AudioFeaturesObject;
import MultipleArtistsResponse = SpotifyApi.MultipleArtistsResponse;
import SingleAlbumResponse = SpotifyApi.SingleAlbumResponse;
import UserObjectPublic = SpotifyApi.UserObjectPublic;
import SingleTrackResponse = SpotifyApi.SingleTrackResponse;
import SinglePlaylistResponse = SpotifyApi.SinglePlaylistResponse;
import PlaylistObjectFull = SpotifyApi.PlaylistObjectFull;
import { YouTube } from './YouTube';
import RecommendationsOptionsObject = SpotifyApi.RecommendationsOptionsObject;
import { DatabaseEntity } from '../../recommendationSystem/databaseEntities/DatabaseEntity';
import RecommendationsFromSeedsResponse = SpotifyApi.RecommendationsFromSeedsResponse;
import MultipleTracksResponse = SpotifyApi.MultipleTracksResponse;
import MultipleAlbumsResponse = SpotifyApi.MultipleAlbumsResponse;


export class Spotify
{
    private constructor ()
    {
    }

    //TODO: Use DB Caching to search
    public static async search(queries : string[], urls : string[]) : Promise<EinSearchResponse[]>
    {
        const haveQueries : boolean = queries && queries.length !== 0;
        const haveUrls : boolean = urls && urls.length !== 0;
        if (!haveQueries && !haveUrls)
            return [{ query: null, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.InvalidQuery }];

        const promises : Promise<EinSearchResponse[]>[] = [];
        if(haveQueries)
        {
            const textQueries : TextSearchQuery[] = this.parseTextQueries(...queries);

            promises.push(this.searchTextQueries(textQueries));
        }
        if(haveUrls)
        {
            const urlQueries : UrlSearchQuery[] = this.parseUrlQueries(urls);

            promises.push(this.searchUrlQueries(urlQueries));
        }

        const results = await Promise.all(promises).then(x => x.flat());
        return results;
    }

    public static parseTextQueries(...stringQueries : string[]) : TextSearchQuery[]
    {
        if(!stringQueries || stringQueries.length == 0)
            return;

        return stringQueries.map(x => new TextSearchQuery(x));
    }

    public static parseUrlQueries(urls : string[]) : UrlSearchQuery[]
    {
        if(!urls || urls.length == 0)
            return;

        return urls.map(url =>
        {
            const parsed : ParsedSpotifyUri = parse(url);
            if(parsed instanceof Track || parsed instanceof Artist || parsed instanceof Album || parsed instanceof Playlist)
            {
                return {
                    original_query: url,
                    id: parsed.id,
                    type: parsed.type,
                    parsed_spotify_uri: parsed
                };
            }
        });
    }

    public static async searchTextQueries(textQueries : TextSearchQuery[]) : Promise<EinSearchResponse[]>
    {
        if (!textQueries || textQueries.length === 0)
            return [{ query: null, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.InvalidQuery }];

        const searchResponses : EinSearchResponse[] = [];

        const playlistQueries = textQueries.filter(x => x.type === 'playlist');
        const trackQueries = textQueries.filter(x => x.type === 'track');
        const artistQueries = textQueries.filter(x => x.type === 'artist');
        const albumQueries = textQueries.filter(x => x.type === 'album');
        const genericQueries = textQueries.filter(x => x.type === 'generic');


        if(playlistQueries && playlistQueries.length !== 0)
            searchResponses.push(...(await this.searchPlaylists(...playlistQueries)));
        if(trackQueries && trackQueries.length !== 0)
            searchResponses.push(...(await this.searchPlaylists(...trackQueries)));
        if(artistQueries && artistQueries.length !== 0)
            searchResponses.push(...(await this.searchPlaylists(...artistQueries)));
        if(albumQueries && albumQueries.length !== 0)
            searchResponses.push(...(await this.searchPlaylists(...albumQueries)));
        if(genericQueries && genericQueries.length !== 0)
        {
            const spotifyApi = await ExternalConnections.getSpotifyConnection();

            const responses = await Promise.all(genericQueries.map(async x =>
            {
                return { query: x, response: await spotifyApi.search(x.toString(), ['track', 'album', 'artist', 'playlist'], { limit: 1 }) };
            }));


            for (let i = 0; i < responses.length; i++)
            {
                const x = responses[i];
                if(!x.response.body)
                    searchResponses.push({ query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches });
                else if(x.response.body.tracks && x.response.body.tracks.items && x.response.body.tracks.items.length > 0)
                    searchResponses.push(...await this.searchTracks(x.query));
                else if(x.response.body.albums && x.response.body.albums.items && x.response.body.albums.items.length > 0)
                    searchResponses.push(...await this.searchAlbums(x.query));
                else if(x.response.body.artists && x.response.body.artists.items && x.response.body.artists.items.length > 0)
                    searchResponses.push(...await this.searchArtists(x.query));
                else if(x.response.body.playlists && x.response.body.playlists.items && x.response.body.playlists.items.length > 0)
                    searchResponses.push(...await this.searchPlaylists(x.query));
                else
                    searchResponses.push({ query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches });
            }
        }

        return searchResponses;
    }

    public static async searchUrlQueries(urlQueries : UrlSearchQuery[]) : Promise<EinSearchResponse[]>
    {
        if (!urlQueries || urlQueries.length === 0)
            return [{ query: null, queryType: 'URL', queryPlatform: 'spotify', code: SearchCode.InvalidURL }];

        const spotifyApi = await ExternalConnections.getSpotifyConnection();


        return await Promise.all(urlQueries.map(async query =>
        {
            let response: SingleTrackResponse | SingleAlbumResponse | SinglePlaylistResponse | SingleArtistResponse;
            if(query.type === 'playlist')
                response = (await spotifyApi.getPlaylist(query.id)).body;
            else if(query.type === 'album')
                response = (await spotifyApi.getAlbum(query.id)).body;
            else if(query.type === 'artist')
                response = (await spotifyApi.getArtist(query.id)).body;
            else if(query.type === 'track')
                response = (await spotifyApi.getTrack(query.id)).body;

            if(!response)
                return { query: null, queryType: 'URL', queryPlatform: 'spotify', code: SearchCode.InvalidURL };

            let playable : Playable;

            if(response.type === 'track')
                playable = await this.fullTrackToPlayable(response);
            if(response.type === 'album')
                playable = await this.fullAlbumToPlayable(response);
            if(response.type === 'artist')
                playable = await this.fullArtistToPlayable(response);
            if(response.type === 'playlist')
                playable = await this.fullPlaylistToPlayable(response);
            else
                return { query: query, queryType: 'URL', queryPlatform: 'spotify', code: SearchCode.InvalidURL };

            return { query: query, queryType: 'URL', queryPlatform: 'spotify', code: SearchCode.Success, playable: playable };
        }));
    }

    public static async searchTracks(...trackQueries : string[] | TextSearchQuery[]) : Promise<EinSearchResponse[]>
    {
        if(!trackQueries || trackQueries.length == 0)
            return [{ query: null, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.InvalidQuery }];

        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const responses = await Promise.all(trackQueries.map(async (x : string | TextSearchQuery) =>
        {
            const query : TextSearchQuery = typeof x === 'string' ? new TextSearchQuery(x) : x;
            return { query: query, response: await spotifyApi.search(query.toString(), ['track'], { limit: 1 }) };
        }));

        return await Promise.all(responses.map(async x =>
        {
            if(!x.response.body || !x.response.body.tracks || !x.response.body.tracks.items || x.response.body.tracks.items.length == 0)
                return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches };

            const playable = await this.fullTrackToPlayable(x.response.body.tracks.items[0]);
            return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.Success, playable: playable };
        }));
    }

    public static async searchAlbums(...albumQueries : string[] | TextSearchQuery[]) : Promise<EinSearchResponse[]>
    {
        if(!albumQueries || albumQueries.length == 0)
            return [{ query: null, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.InvalidQuery }];

        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const responses = await Promise.all(albumQueries.map(async (x : string | TextSearchQuery) =>
        {
            const query : TextSearchQuery = typeof x === 'string' ? new TextSearchQuery(x) : x;
            return { query: query, response: await spotifyApi.search(query.toString(), ['album'], { limit: 1 }) };
        }));

        return await Promise.all(responses.map(async x =>
        {
            if(!x.response.body || !x.response.body.albums || !x.response.body.albums.items || x.response.body.albums.items.length == 0)
                return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches };

            const fullAlbumResponse = await spotifyApi.getAlbum(x.response.body.albums.items[0].id);
            const fullAlbum = fullAlbumResponse.body;
            if(!fullAlbum)
                return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches };

            const playable = await this.fullAlbumToPlayable(fullAlbum);

            return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.Success, playable: playable };
        }));
    }



    public static async searchArtists(...artistQueries : string[] | TextSearchQuery[]) : Promise<EinSearchResponse[]>
    {
        if(!artistQueries || artistQueries.length == 0)
            return [{ query: null, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.InvalidQuery }];

        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const responses = await Promise.all(artistQueries.map(async (x : string | TextSearchQuery) =>
        {
            const query : TextSearchQuery = typeof x === 'string' ? new TextSearchQuery(x) : x;
            return { query: query, response: await spotifyApi.search(query.toString(), ['artist'], { limit: 1 }) };
        }));

        return await Promise.all(responses.map(async x =>
        {
            if(!x.response.body || !x.response.body.artists || !x.response.body.artists.items || x.response.body.artists.items.length == 0)
                return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches };

            const playable = await this.fullArtistToPlayable(x.response.body.artists[0]);

            return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.Success, playable: playable };
        }));
    }

    public static async searchPlaylists(...playlistQueries : string[] | TextSearchQuery[]) : Promise<EinSearchResponse[]>
    {
        if(!playlistQueries || playlistQueries.length == 0)
            return [{ query: null, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.InvalidQuery }];

        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const responses = await Promise.all(playlistQueries.map(async (x : string | TextSearchQuery) =>
        {
            const query : TextSearchQuery = typeof x === 'string' ? new TextSearchQuery(x) : x;
            return { query: query, response: await spotifyApi.search(query.toString(), ['playlist'], { limit: 1 }) };
        }));

        return await Promise.all(responses.map(async x =>
        {
            if(!x.response.body || !x.response.body.playlists || !x.response.body.playlists.items || x.response.body.playlists.items.length == 0)
                return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches };

            const playlistFullResponse = await spotifyApi.getPlaylist(x.response.body.playlists.items[0].id);
            const playlistFull = playlistFullResponse.body;
            if(!playlistFull)
                return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.NoMatches };

            const playable = await this.fullPlaylistToPlayable(playlistFull);

            return { query: x.query, queryType: 'text', queryPlatform: 'spotify', code: SearchCode.Success, playable: playable };
        }));
    }

    public static async getRecommendationsFromSeedOptions(seedOptions : RecommendationsOptionsObject) : Promise<Playable[]>
    {
        if (seedOptions.seed_tracks)
        {
            if (Array.isArray(seedOptions.seed_tracks))
                seedOptions.seed_tracks = seedOptions.seed_tracks.filter(x => DatabaseEntity.IsDataValid(x));
            else
                seedOptions.seed_tracks = DatabaseEntity.IsDataValid(seedOptions.seed_tracks) ? seedOptions.seed_tracks : undefined;
        }

        if (seedOptions.seed_artists)
        {
            if (Array.isArray(seedOptions.seed_artists))
                seedOptions.seed_artists = seedOptions.seed_artists.filter(x => DatabaseEntity.IsDataValid(x));
            else
                seedOptions.seed_artists = DatabaseEntity.IsDataValid(seedOptions.seed_artists) ? seedOptions.seed_artists : undefined;
        }

        const tracksLength = seedOptions.seed_tracks ? (Array.isArray(seedOptions.seed_tracks) ? seedOptions.seed_tracks.length : 1) : 0;
        const artistsLength = seedOptions.seed_artists ? (Array.isArray(seedOptions.seed_artists) ? seedOptions.seed_artists.length : 1) : 0;
        if (tracksLength + artistsLength === 0)
            return null;

        const spotifyApi = await ExternalConnections.getSpotifyConnection();
        let response: RecommendationsFromSeedsResponse;
        try
        {
            const tResponse = (await spotifyApi.getRecommendations(seedOptions));
            response = tResponse.body;
        }
        catch (e)
        {
            EinClient.instance.logger.error(e);
        }

        const tracks: MultipleTracksResponse = (await spotifyApi.getTracks(response.tracks.map(x => x.id))).body;

        return await Promise.all(tracks.tracks.map(x => this.fullTrackToPlayable(x)));
    }

    public static async fullTrackToPlayable(fullTrack : TrackObjectFull) : Promise<Playable>
    {
        const streamableDatas = await this.trackObjectsToStreamableData(fullTrack);
        const streamable = new Streamable(streamableDatas[0]);
        if(EinClient.instance.config.databaseSettings.enableDatabase)
            await DatabaseManager.instance.getOrAddTrackEntities(streamable);
        return streamable.toPlayable();
    }

    public static async fullAlbumToPlayable(fullAlbum : AlbumObjectFull) : Promise<Playable>
    {
        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const trackIds = fullAlbum.tracks.items.map(x => x.id);
        const tracksResponse = await spotifyApi.getTracks(trackIds);
        const artistResponse = await spotifyApi.getArtist(fullAlbum.artists[0].id);
        const totalDuration_ms : number = tracksResponse.body.tracks.map(x => x.duration_ms)
            .reduce((a, b) => a + b, 0);

        const streamableDatas = await this.trackObjectsToStreamableData(...tracksResponse.body.tracks);
        const streamables = streamableDatas.map(x => new Streamable(x));
        if(EinClient.instance.config.databaseSettings.enableDatabase)
            await DatabaseManager.instance.getOrAddTrackEntities(...streamables);

        return new Playable({
            playableType: 'album',
            spotifyId: fullAlbum.id,
            name: fullAlbum.name,
            description: '',
            artist: this.getArtistData(artistResponse.body),
            url: fullAlbum.external_urls.spotify,
            thumbnail: fullAlbum.images && fullAlbum.images.length > 0 ? fullAlbum.images[0].url : '',
            duration: totalDuration_ms,
            streamables: streamables,
        });
    }

    public static async fullArtistToPlayable(fullArtist : ArtistObjectFull) : Promise<Playable>
    {
        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const topTracksResponse = await spotifyApi.getArtistTopTracks(fullArtist.id, "US");
        const topTracks = topTracksResponse.body.tracks;
        const streamableDatas = await this.trackObjectsToStreamableData(...topTracks);
        const streamables = streamableDatas.map(x => new Streamable(x));
        if(EinClient.instance.config.databaseSettings.enableDatabase)
            await DatabaseManager.instance.getOrAddTrackEntities(...streamables);

        return new Playable({
            playableType: 'artist',
            spotifyId: fullArtist.id,
            name: fullArtist.name,
            description: '',
            artist: this.getArtistData(fullArtist),
            url: fullArtist.external_urls.spotify,
            thumbnail: fullArtist.images && fullArtist.images.length > 0 ? fullArtist.images[0].url : '',
            duration: 0,
            streamables: streamables,
        });
    }

    public static async fullPlaylistToPlayable(fullPlaylist : PlaylistObjectFull) : Promise<Playable>
    {
        const spotifyApi = await ExternalConnections.getSpotifyConnection();

        const tracks = fullPlaylist.tracks.items.map(x => x.track);
        const streamableDatas = await this.trackObjectsToStreamableData(...tracks);
        const streamables = streamableDatas.map(x => new Streamable(x));
        if(EinClient.instance.config.databaseSettings.enableDatabase)
            await DatabaseManager.instance.getOrAddTrackEntities(...streamables);

        return new Playable({
            playableType: 'playlist',
            spotifyId: fullPlaylist.id,
            name: fullPlaylist.name,
            description: fullPlaylist.description,
            artist: null,
            url: fullPlaylist.external_urls.spotify,
            thumbnail: fullPlaylist.images && fullPlaylist.images.length > 0 ? fullPlaylist.images[0].url : '',
            duration: 0,
            streamables: streamables,
        });
    }

    private static async trackObjectsToStreamableData(...trackObjects: TrackObjectFull[]): Promise<StreamableData[]>
    {
        // This gets concat at the end
        let dbStreamables: StreamableData[] = [];
        if (DatabaseManager.instance && DatabaseManager.instance.useCachedTracksInSearch)
        {
            console.log('GET TRACKS!');
            const dbTrackEntities = await DatabaseManager.instance.getTracksBySpotifyIds(trackObjects.map(x => x.id));
            dbStreamables = dbTrackEntities.map(x => x.toStreamable() as StreamableData);
            if (dbStreamables.length === trackObjects.length)
                return dbStreamables;
            trackObjects = trackObjects.filter(x => !dbStreamables.map(y => y.spotifyId).includes(x.id));
        }

        const spotifyApi = await ExternalConnections.getSpotifyConnection();
        const audioFeaturesResponse : MultipleAudioFeaturesResponse =
            (await spotifyApi.getAudioFeaturesForTracks(trackObjects.map(x => x.id))).body;
        const artistResponse: MultipleArtistsResponse =
            (await spotifyApi.getArtists(trackObjects.map(x => x.artists[0].id))).body;
        const albumResponse : MultipleAlbumsResponse =
            (await spotifyApi.getAlbums(trackObjects.map(x => x.album.id))).body;

        const streamables: StreamableData[] = await Promise.all(trackObjects.map(async (track: TrackObjectFull) =>
        {
            const audioFeaturesObject: AudioFeaturesObject = audioFeaturesResponse.audio_features.find(x => x.id === track.id);

            const artist: ArtistObjectFull = artistResponse.artists.find(x => x.id === track.artists[0].id);
            const album : AlbumObjectFull = albumResponse.albums.find(x => x.id === track.album.id);

            const artistData: ArtistData = this.getArtistData(artist);
            const albumData: AlbumData = this.getAlbumData(album);
            const streamableAudioFeatures: TrackAudioFeatures = this.getTrackAudioFeatures(audioFeaturesObject);
            const youTubeUrl: string = await YouTube.getUrlFromSearchQuery({
                original_query: 'fff',
                type: 'track',
                track_name: track.name,
                artist_name: artist.name,
            });

            return {
                streamableSource: 'spotify' as StreamableSource,
                spotifyId: track.id,
                name: track.name,
                description: '',
                artist: artistData,
                album: albumData,
                url: track.external_urls.spotify,
                youtubeUrl: youTubeUrl,
                thumbnail: track.album.images[0].url,
                duration: track.duration_ms / 1_000,
                popularity: track.popularity,
                explicit: track.explicit,
                audioFeatures: streamableAudioFeatures,
            };
        }));

        return streamables.concat(dbStreamables);
    }

    private static getArtistData(response: SingleArtistResponse | ArtistObjectFull | UserObjectPublic): ArtistData
    {
        if (response.type === 'artist')
        {
            return {
                spotifyId: response.id,
                name: response.name,
                url: response.external_urls.spotify,
                thumbnail: response.images && Array.isArray(response.images) && response.images.length > 0 ? response.images[0].url : '',
                popularity: response.popularity,
                genres: response.genres,
            };
        }
        else
        {
            return {
                spotifyId: response.id,
                name: response.display_name,
                url: response.external_urls.spotify,
                thumbnail: response.images[0].url,
            };
        }
    }
    private static getAlbumData(response: SingleAlbumResponse | AlbumObjectFull): AlbumData
    {
        return {
            spotifyId: response.id,
            name: response.name,
            url: response.external_urls.spotify,
            thumbnail: response.images[0].url,
            genres: response.genres,
            releaseDate: response.release_date,
            releaseDatePrecision: response.release_date_precision,
        };
    }

    private static getTrackAudioFeatures(response: AudioFeaturesObject): TrackAudioFeatures
    {
        return {
            exists: true,
            acousticness: response.acousticness,
            danceability: response.danceability,
            energy: response.energy,
            instrumentalness: response.instrumentalness,
            key: response.key,
            liveness: response.liveness,
            loudness: response.loudness,
            mode: response.mode,
            speechiness: response.speechiness,
            tempo: response.tempo,
            time_signature: response.time_signature,
            valence: response.valence,
        };
    }
}