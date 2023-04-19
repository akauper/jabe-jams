/**
 * Exports all database entities
 */


// import { UserEntity } from './UserEntity';
// import { TrackEntity } from './TrackEntity';
// import { AlbumEntity } from './AlbumEntity';
// import { ArtistEntity } from './ArtistEntity';
// import { UserPlaylistEntity } from './UserPlaylistEntity';

// export * from './UserEntity';
// export * from './TrackEntity';
// export * from './ArtistEntity';
// export * from './AlbumEntity';
// export * from './UserPlaylistEntity';

import { UserEntity } from './UserEntity';
import { TrackEntity } from './TrackEntity';
import { AlbumEntity } from './AlbumEntity';
import { ArtistEntity } from './ArtistEntity';
import { PlaylistEntity } from './PlaylistEntity';

export * from './DatabaseEntity.js';
export * from './UserEntity.js';
export * from './PlaylistEntity.js';
export * from './TrackEntity.js';
export * from './AlbumEntity.js';
export * from './ArtistEntity.js';

export type DatabaseEntities =
    | UserEntity
    | TrackEntity
    | AlbumEntity
    | ArtistEntity
    | PlaylistEntity;
