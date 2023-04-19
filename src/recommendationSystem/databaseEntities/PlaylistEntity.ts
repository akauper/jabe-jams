import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
} from 'typeorm';
import { DatabaseEntity } from './DatabaseEntity.js';
import { randomUUID } from 'crypto';
import { User } from 'discord.js';
import { TrackEntity } from './TrackEntity.js';
import Playable from '../../core/playables/Playable.js';
import { EinClient } from '../../core/index.js';


@Entity({ name: 'userPlaylist' })
export class PlaylistEntity extends DatabaseEntity
{
    @Column()
    public ownerId: string;

    @ManyToMany(() => TrackEntity, track => track.playlistEntities, {
        cascade: true,
        eager: true,
    })
    @JoinTable()
    public trackEntities: TrackEntity[];

    public Initialize(name: string, user: User)
    {
        this.id = randomUUID();
        this.name = name;
        this.ownerId = user.id;
    }

    public async toPlayable(): Promise<Playable>
    {
        const playlistOwner: User = await EinClient.instance?.users.fetch(this.ownerId);
        if (!playlistOwner)
            throw new Error('Cannot convert UserPlaylistEntity into User. Field userId not found in client cache.');

        const totalDuration: number = this.trackEntities.map((x) => x.duration).reduce((a, b) => a + b, 0);
        return new Playable({
            playableType: 'userPlaylist',
            spotifyId: 'userPlaylist',
            name: this.name,
            description: `${playlistOwner.username}'s Playlist`,
            artist: {
                spotifyId: playlistOwner.id,
                name: playlistOwner.username,
                url: 'userPlaylist',
            },
            url: 'userPlaylist',
            thumbnail: 'userPlaylist',
            duration: totalDuration,
            streamables: this.trackEntities.map(x => x.toStreamable()),
        });
    }
}