import { Column, Entity, Generated, ManyToMany, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { AlbumData } from '../../@types/types.js';
import { TrackEntity } from './TrackEntity.js';
import { ArtistEntity } from './ArtistEntity.js';
import { DatabaseEntity } from './DatabaseEntity.js';
import { UserEntity } from './UserEntity.js';

@Entity({ name: 'album' })
export class AlbumEntity extends DatabaseEntity
{
    @Column({ type: 'text', nullable: true })
    public description: string;

    @Column({ nullable: true })
    public url: string;

    @Column({ nullable: true })
    public thumbnailUrl: string;

    @Column({nullable: true})
    public genresDelineated : string;

    @Column({ nullable: true })
    public release_date: string;

    @Column({ nullable: true })
    public release_date_precision: string;

    // Auto filled by cascade
    @OneToMany(() => TrackEntity, track => track.albumEntity)
    public trackEntities: TrackEntity[];

    // Auto Filled by cascade
    @ManyToOne(() => ArtistEntity, artist => artist.albumEntities,
        {
            cascade: true,
            eager: true,
        })
    public artistEntity: ArtistEntity;

    @ManyToMany(() => UserEntity, user => user.albumEntities)
    public userEntities: UserEntity[];

    public constructor()
    {
        super();
    }

    public Initialize(data: AlbumData)
    {
        this.id = data.spotifyId;
        this.name = data.name;
        this.description = data.description;
        this.url = data.url;
        this.thumbnailUrl = data.thumbnail;
        this.genresDelineated = data.genres ? data.genres.join(',') : null;
        this.release_date = data.releaseDate;
        this.release_date_precision = data.releaseDatePrecision;
    }

    public toAlbumData(): AlbumData
    {
        return {
            spotifyId: this.id,
            name: this.name,
            description: '',
            url: this.url,
            thumbnail: this.thumbnailUrl,
            genres: this.genresDelineated ? this.genresDelineated.split(',') : [],
            releaseDate: this.release_date,
            releaseDatePrecision: this.release_date_precision,
        };
    }
}