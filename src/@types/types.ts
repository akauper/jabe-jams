import { AudioPlayerError, AudioResource } from '@discordjs/voice';
import { User } from 'discord.js';
import { Playable, Queue, Streamable } from '../core/index.js';
import { PlaylistEntity } from '../recommendationSystem/databaseEntities/PlaylistEntity.js';
import { ArtistEntity } from '../recommendationSystem/databaseEntities/ArtistEntity.js';
import { AlbumEntity } from '../recommendationSystem/databaseEntities/AlbumEntity.js';
import { Album, Artist, Playlist, Track } from 'spotify-uri';
import { TextSearchQuery } from '../core/search/TextSearchQuery';
import { UserEntity } from '../recommendationSystem/databaseEntities/UserEntity';


export type StreamableSource = 'apple' | 'soundcloud' | 'youtube' | 'spotify' | 'arbitrary';
export type PlayableType = 'track' | 'album' | 'playlist' | 'artist' | 'userPlaylist';

type Awaitable = Promise<void> | void;

export type VoiceStreamEvents =
{
    start: (resource: AudioResource<Streamable>) => Awaitable;
    end: (resource: AudioResource<Streamable>) => Awaitable;
    disconnect: () => Awaitable;
    error: (error: AudioPlayerError | string) => Awaitable;
}

export type MessageGeneratorEvents =
{
    reactionAdded: (streamable: Streamable, user: User, interactionType: InteractionType) => Awaitable;
    reactionRemoved: (streamable: Streamable, user: User, interactionType: InteractionType) => Awaitable;
}

export interface Data
{
    spotifyId: string;
    name: string;
    url: string;
    description?: string;
    thumbnail?: string;
}

export interface PlayableData extends Data
{
    playableType: PlayableType;
    artist : ArtistData;
    thumbnail: string;
    duration: number;
    streamables: Streamable[];
}
export interface StreamableData extends Data
{
    streamableSource: StreamableSource;
    artist: ArtistData;
    album: AlbumData;
    youtubeUrl: string;
    duration: number;
    popularity?: number;
    explicit?: boolean;

    audioFeatures: TrackAudioFeatures;
}

export interface PlaylistData
{
    owner: User;
    seedStreamables: StreamableData[];
    trackInteractions: TrackInteraction[];
}
export interface TrackInteraction
{
    trackId: string;
    playCount: number;
    rating: number;
}

export interface AlbumData extends Data
{
    genres? : string[];
    releaseDate?: string;
    releaseDatePrecision?: string;
}
export interface ArtistData extends Data
{
    popularity?: number;
    genres?: string[];
}
export interface TrackAudioFeatures
{
    exists: boolean;
    acousticness?: number;
    danceability?: number;
    energy?: number;
    instrumentalness?: number;
    key?: number;
    liveness?: number;
    loudness?: number;
    mode?: number;
    speechiness?: number;
    tempo?: number;
    time_signature?: number;
    valence?: number;
}

// export interface SearchInfo
// {
//     type: PlayableType;
//     trackName?: string,
//     artistName?: string,
//     albumName?: string,
//     playlistName?: string
// }

export interface TextSearchQueryInterface
{
    original_query : string;
    type : PlayableType | 'generic';
    track_name? : string;
    artist_name? : string;
    album_name? : string;
    playlist_name? : string;
}

export interface UrlSearchQuery
{
    original_query : string;
    id : string;
    type : string;
    parsed_spotify_uri : Playlist | Track | Artist | Album;
}

export enum SearchCode
{
    Success = 'Success',
    NoMatches = 'No Matches',
    InvalidQuery = 'Invalid Query',
    InvalidURL = 'Invalid URL',
    InternalDatabaseError = 'Internal Database Error',
}

export interface EinSearchResponse
{
    query : TextSearchQuery | UrlSearchQuery | string | null;
    queryType : 'text' | 'URL';
    queryPlatform : StreamableSource;

    code : SearchCode;
    codeDetails? : string;
    playable? : Playable;
}

export interface DatabaseSettings
{
    enableDatabase: boolean;
    useCachedTracksInSearch?: boolean;
    host?: string,
    port?: number,
    name?: string,
    user?: string,
    password?: string
}

export interface BotCredentials
{
    token: string;
    clientId: string;
    guildId: string;
}

export interface TargetFeatureValues
{
    target_acousticness?: number;
    target_danceability?: number;
    target_energy?: number;
    target_instrumentalness?: number;
    target_liveness?: number;
    // target_loudness?: number;
    target_popularity?: number;
    target_speechiness?: number;
    target_tempo?: number;
    // target_time_signature?: number;
    target_valence?: number;
}

// eslint-disable-next-line no-shadow
export enum InteractionType
{
    None,
    Play,
    Skip,
    Like,
    Love,
    Dislike,
    Hate,
}

export interface AutoplayData
{
    track_names? : string[];
    artist_names? : string[];
    genres? : string[];
}

// export interface SeedData
// {
//     track_ids? : string[];
//     artist_ids? : string[];
//     genres? : string[];
// }

// export declare type EndlessRequestTypes =
//     User
//     | AutoplayData
//     | Queue
//     | PlaylistEntity
//     | ArtistEntity
//     | AlbumEntity
// export declare type EndlessSeedTypes =
//     User
//     | PlaylistEntity
//     | Streamable[]
//     | StreamableData[];

export declare type EndlessSeedTypes =
    User
    | AutoplayData
    | Queue
    | PlaylistEntity
    | ArtistEntity
    | AlbumEntity
    | UserEntity
    | Playable
    | Streamable[]
    | Playable[]