import {
    Column,
    Entity,
    ManyToOne,
    ManyToMany,
} from 'typeorm';
import {
    DatabaseEntity,
    UserEntity,
    AlbumEntity,
    ArtistEntity,
    PlaylistEntity,
} from './entities.js';
import {
    PlayableType,
    StreamableData,
    StreamableSource,
} from '../../@types/types.js';
import { Playable, Streamable } from '../../core/index.js'


@Entity({ name: 'track' })
export class TrackEntity extends DatabaseEntity
{
    @Column('text')
    public description: string;

    @Column()
    public spotifyUrl: string;

    @Column()
    public youtubeUrl: string;

    @Column()
    public thumbnailUrl: string;

    @Column('float')
    public duration: number;

    @Column({ type: 'boolean', nullable: true })
    public explicit: boolean;

    @Column({ type: 'int', nullable: true })
    public popularity: number;

    @Column()
    public audioFeaturesExist: boolean;

    @Column({ type: 'float', nullable: true })
    public acousticness: number;

    @Column({ type: 'float', nullable: true })
    public danceability: number;

    @Column({ type: 'float', nullable: true })
    public energy: number;

    @Column({ type: 'float', nullable: true })
    public instrumentalness: number;

    @Column({ type: 'int', nullable: true })
    public key: number;

    @Column({ type: 'float', nullable: true })
    public liveness: number;

    @Column({ type: 'float', nullable: true })
    public loudness: number;

    @Column({ type: 'int', nullable: true })
    public mode: number;

    @Column({ type: 'float', nullable: true })
    public speechiness: number;

    @Column({ type: 'float', nullable: true })
    public tempo: number;

    @Column({ type: 'int', nullable: true })
    public time_signature: number;

    @Column({ type: 'float', nullable: true })
    public valence: number;

    @ManyToOne(() => ArtistEntity, artist => artist.trackEntities, {
        cascade: true,
        eager: true,
    })
    public artistEntity: ArtistEntity;

    @ManyToOne(() => AlbumEntity, album => album.trackEntities, {
        cascade: true,
        eager: true,
    })
    public albumEntity: AlbumEntity;

    @ManyToMany(() => PlaylistEntity, playlist => playlist.trackEntities)
    public playlistEntities: PlaylistEntity[];

    @ManyToMany(() => UserEntity, user => user.trackEntities)
    public userEntities: UserEntity[];

    public constructor()
    {
        super();
    }
    public Initialize(data: StreamableData)
    {
        // console.log(data);
        this.id = data.spotifyId;
        this.name = data.name;
        this.description = data.description;
        this.spotifyUrl = data.url;
        this.youtubeUrl = data.youtubeUrl;
        this.thumbnailUrl = data.thumbnail;
        this.duration = data.duration;

        this.popularity = data.popularity;
        this.explicit = data.explicit;

        this.audioFeaturesExist = data.audioFeatures.exists;
        this.acousticness = data.audioFeatures.acousticness;
        this.danceability = data.audioFeatures.danceability;
        this.energy = data.audioFeatures.energy;
        this.instrumentalness = data.audioFeatures.instrumentalness;
        this.key = data.audioFeatures.key;
        this.liveness = data.audioFeatures.liveness;
        this.loudness = data.audioFeatures.loudness;
        this.mode = data.audioFeatures.mode;
        this.speechiness = data.audioFeatures.speechiness;
        this.tempo = data.audioFeatures.tempo;
        this.time_signature = data.audioFeatures.time_signature;
        this.valence = data.audioFeatures.valence;
    }

    public toPlayable(): Playable
    {
        return new Playable({
            playableType: 'track' as PlayableType,
            spotifyId: this.id,
            name: this.name,
            description: this.description,
            artist: this.artistEntity.toArtistData(),
            url: this.spotifyUrl,
            thumbnail: this.thumbnailUrl,
            duration: this.duration,
            streamables: [
                this.toStreamable(),
            ],
        });
    }
    public toStreamable(): Streamable
    {
        return new Streamable({
            streamableSource: 'spotify' as StreamableSource,
            spotifyId: this.id,
            name: this.name,
            description: this.description,
            artist: this.artistEntity.toArtistData(),
            album: this.albumEntity.toAlbumData(),
            url: this.spotifyUrl,
            youtubeUrl: this.youtubeUrl,
            thumbnail: this.thumbnailUrl,
            duration: this.duration,
            popularity: this.popularity,
            explicit: this.explicit,
            audioFeatures: {
                exists: this.audioFeaturesExist,
                acousticness: this.acousticness,
                danceability: this.danceability,
                energy: this.energy,
                instrumentalness: this.instrumentalness,
                key: this.key,
                liveness: this.liveness,
                loudness: this.loudness,
                mode: this.mode,
                speechiness: this.speechiness,
                tempo: this.tempo,
                time_signature: this.time_signature,
                valence: this.valence,
            },
        });
    }
}