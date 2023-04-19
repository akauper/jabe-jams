import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
} from 'typeorm';
import {
    DatabaseEntity,
    AlbumEntity,
    ArtistEntity,
    TrackEntity,
} from './entities.js';
import { User } from 'discord.js';
import { InteractionType } from '../../@types/types.js';

export interface UserEntityInteraction
{
    id: string;
    playCount: number;
    rating: number;
}

@Entity({ name: 'user' })
export class UserEntity extends DatabaseEntity
{
    @Column('json')
    public trackRatings : UserEntityInteraction[];
    @Column('json')
    public albumRatings : UserEntityInteraction[];
    @Column('json')
    public artistRatings : UserEntityInteraction[];

    @ManyToMany(() => TrackEntity, track => track.userEntities, {
        cascade: true,
        eager: true,
    })
    @JoinTable()
    public trackEntities: TrackEntity[];

    @ManyToMany(() => AlbumEntity, album => album.userEntities, {
        cascade: true,
        eager: true,
    })
    @JoinTable()
    public albumEntities: AlbumEntity[];

    @ManyToMany(() => ArtistEntity, artist => artist.userEntities, {
        cascade: true,
        eager: true,
    })
    @JoinTable()
    public artistEntities: ArtistEntity[];

    public constructor()
    {
        super();
    }
    public Initialize(user: User)
    {
        this.id = user.id;
        this.name = user.username;

        if (!this.trackRatings)
            this.trackRatings = [];
        if (!this.albumRatings)
            this.albumRatings = [];
        if (!this.artistRatings)
            this.artistRatings = [];

        if (!this.trackEntities)
            this.trackEntities = [];
        if (!this.albumEntities)
            this.albumEntities = [];
        if (!this.artistEntities)
            this.artistEntities = [];
    }

    public getSortedArtistRatings(): UserEntityInteraction[]
    {
        return this.artistRatings.sort(this.sortFunction);
    }
    public getSortedAlbumRatings(): UserEntityInteraction[]
    {
        return this.albumRatings.sort(this.sortFunction);
    }
    public getSortedTrackRatings(): UserEntityInteraction[]
    {
        return this.trackRatings.sort(this.sortFunction);
    }
    private sortFunction(interactionA: UserEntityInteraction, interactionB: UserEntityInteraction)
    {
        return interactionB.rating - interactionA.rating;
    }

    public Interact(entity: TrackEntity | ArtistEntity | AlbumEntity, interactionType: InteractionType)
    {
        let arr;
        if (entity instanceof TrackEntity)
        {
            arr = this.trackRatings;
            if (!this.trackEntities.map(x => x.id).includes(entity.id))
                this.trackEntities.push(entity);
        }
        else if (entity instanceof ArtistEntity)
        {
            arr = this.artistRatings;
            if (!this.artistEntities.map(x => x.id).includes(entity.id))
                this.artistEntities.push(entity);
        }
        else
        {
            arr = this.albumRatings;
            if (!this.albumEntities.map(x => x.id).includes(entity.id))
                this.albumEntities.push(entity);
        }


        let obj: UserEntityInteraction = arr.find(x => x.id === entity.id);
        if (!obj)
        {
            obj = {
                id: entity.id,
                playCount: 0,
                rating: 0,
            };
            arr.push(obj);
        }

        switch (interactionType)
        {
        case InteractionType.Play:
            obj.playCount += 1;
            break;
        case InteractionType.Skip:
            obj.playCount -= 1;
            break;
        case InteractionType.Like:
            obj.rating += 1;
            break;
        case InteractionType.Love:
            obj.rating += 2;
            break;
        case InteractionType.Dislike:
            obj.rating -= 1;
            break;
        case InteractionType.Hate:
            obj.rating -= 2;
            break;
        }
    }
}