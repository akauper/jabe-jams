import { Column, Entity, Generated, ManyToMany, OneToMany, PrimaryColumn } from 'typeorm';
import { ArtistData, Data } from '../../@types/types.js';
import { TrackEntity } from './TrackEntity.js';
import { AlbumEntity } from './AlbumEntity.js';
import { DatabaseEntity } from './DatabaseEntity.js';
import { UserEntity } from './UserEntity.js';


@Entity({ name: 'artist' })
export class ArtistEntity extends DatabaseEntity
{
    @Column({ nullable: true })
    public url: string;

    @Column({ nullable: true })
    public thumbnailUrl: string;

    @Column({ type: 'integer', nullable: true })
    public popularity: number;

    @Column({ type: 'simple-array', nullable: true })
    public genres: string[];


    // Auto filled by cascade
    @OneToMany(() => TrackEntity, track => track.artistEntity)
    public trackEntities: TrackEntity[];

    // Auto filled by cascade
    @OneToMany(() => AlbumEntity, album => album.artistEntity)
    public albumEntities: AlbumEntity[];

    @ManyToMany(() => UserEntity, user => user.artistEntities)
    public userEntities: UserEntity[];

    public constructor()
    {
        super();
    }

    public Initialize(data: ArtistData)
    {
        this.id = data.spotifyId;
        this.name = data.name;
        this.url = data.url;
        this.thumbnailUrl = data.thumbnail;
        this.popularity = data.popularity;
        this.genres = data.genres;
    }

    public toArtistData(): ArtistData
    {
        return {
            spotifyId: this.id,
            name: this.name,
            url: this.url,
            thumbnail: this.thumbnailUrl,
            popularity: this.popularity,
            genres: this.genres,
        };
    }


}