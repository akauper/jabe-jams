// import { Connection, createConnection, In } from 'typeorm';
import { DataSource, In } from 'typeorm';
import {
    AlbumData,
    ArtistData,
    DatabaseSettings,
    InteractionType,
    StreamableData,
} from '../@types/types.js';

import {
    UserEntity,
    PlaylistEntity,
    TrackEntity,
    AlbumEntity,
    ArtistEntity, DatabaseEntity,
} from './databaseEntities/entities.js';
import { User } from 'discord.js';
import { EinClient, Streamable } from '../core/index.js';

export class DatabaseManager
{
    private static _instance: DatabaseManager;
    public static get instance(): DatabaseManager
    {
        return DatabaseManager._instance;
    }

    // private connection: Connection;
    private connection;

    private _useCachedTracksInSearch: boolean = false;
    public get useCachedTracksInSearch()
    {
        return this._useCachedTracksInSearch;
    }

    private constructor()
    {
        DatabaseManager._instance = this;
    }

    public static async connect(settings: DatabaseSettings): Promise<DatabaseManager>
    {
        if (DatabaseManager._instance)
        {
            EinClient.instance.logger.error('DatabaseManager already exists');
            return DatabaseManager._instance;
        }

        const newDBM = new DatabaseManager();

        try
        {

            EinClient.instance.logger.info(`Connecting to database:
host: ${settings.host}
port: ${settings.port}
name: ${settings.name}
user: ${settings.user}
password: ${settings.password}`);

            // console.log(`Connecting to database:
            // host: ${settings.host}
            // port: ${settings.port}
            // name: ${settings.name}
            // user: ${settings.user}
            // password: ${settings.password}`);

            // host: settings.dbHost,
            // port: settings.dbPort,
            // username: settings.dbUser,
            // password: settings.dbPassword,
            // database: settings.dbName,

            newDBM.connection = new DataSource({
                type: 'mariadb',
                host: settings.host,
                port: settings.port,
                username: settings.user,
                password: settings.password,
                database: settings.name,
                entities: [
                    AlbumEntity,
                    ArtistEntity,
                    TrackEntity,
                    UserEntity,
                    PlaylistEntity,
                ],
                charset: 'utf8mb4',
                synchronize: true,
                logging: false,
            });
            // newDBM.connection = await createConnection({
            //     type: 'mariadb',
            //     host: '10.64.64.3',
            //     port: 3306,
            //     username: 'einmusicplayer',
            //     password: 'einmusicplayer',
            //     database: 'einmusicplayer',
            //     entities: [
            //         AlbumEntity,
            //         ArtistEntity,
            //         TrackEntity,
            //         UserEntity,
            //         PlaylistEntity,
            //     ],
            //     charset: 'utf8mb4',
            //     synchronize: true,
            //     logging: false,
            //     // maxQueryExecutionTime: 15,
            // });

            EinClient.instance.logger.info('init');

            await newDBM.connection.initialize();
        }
        catch (err)
        {
            DatabaseManager._instance = null;
            throw err;
        }

        newDBM._useCachedTracksInSearch = settings.useCachedTracksInSearch;

        return newDBM;
    }

    // - - - - - - - - - - - - - //
    // - - - - Playlists - - - - //
    // - - - - - - - - - - - - - //
    public async getPlaylistEntityByName(name: string): Promise<PlaylistEntity>
    {
        return await this.connection.getRepository(PlaylistEntity).findOne({
            where: { name: name },
        });
    }
    public async getUserPlaylistEntities(userId: string): Promise<PlaylistEntity[]>
    {
        return await this.connection.getRepository(PlaylistEntity).find({
            where: { ownerId: userId },
        });
    }
    public async createPlaylistEntity(user: User, name: string, streamableDatas: StreamableData[] | Streamable[]): Promise<PlaylistEntity>
    {
        const playlistEntity = new PlaylistEntity();
        // Make sure the user exists before we create a playlist for them
        await this.getOrAddUserEntities(user);
        const trackEntities = await this.getOrAddTrackEntities(...streamableDatas);
        playlistEntity.Initialize(name, user);
        playlistEntity.trackEntities = trackEntities;

        return this.connection.manager.save(playlistEntity);
    }
    public async addStreamablesToUserPlaylist(playlist: PlaylistEntity, streamables: StreamableData[] | Streamable[]): Promise<void>
    {
        let trackEntities = await this.getOrAddTrackEntities(...streamables);
        trackEntities = trackEntities.filter(t => !playlist.trackEntities.map(x => x.id).includes(t.id));
        if (trackEntities == null || trackEntities.length == 0)
            return;
        EinClient.instance.logger.success(`Adding ${trackEntities.map(x => x.name)} to playlist ${playlist.name}`);
        playlist.trackEntities = playlist.trackEntities.concat(trackEntities);
        await this.connection.manager.save(playlist);
    }
    public async deletePlaylistEntity(playlist: PlaylistEntity): Promise<void>
    {
        await this.connection.manager.remove(playlist);
    }

    // - - - - - - - - - - - //
    // - - - - Users - - - - //
    // - - - - - - - - - - - //
    public async getUserById(userId: string): Promise<UserEntity>
    {
        const userEntity = await this.connection.getRepository(UserEntity)
            .findOne({
                where: { id: userId },
            });
        return userEntity;
    }

    public async getUsersByIds(userIds : string[]) : Promise<UserEntity[]>
    {
        const userEntities : UserEntity[] = await this.connection.getRepository(UserEntity)
            .find({
                where: {id: In(userIds) },
            });
        return userEntities;
    }

    public async getOrAddUserEntities(...users: User[]): Promise<UserEntity[]>
    {
        const userIds = users.map(x => x.id);
        const userEntities = await this.connection.getRepository(UserEntity)
            .find({
                where: { id: In(userIds) },
            });
        const missingUsers: User[] = users.filter(x => !userEntities.map(y => y.id).includes(x.id));
        if (missingUsers == null || missingUsers.length == 0)
            return userEntities;

        const newUserEntities: UserEntity[] = await this.addUserEntities(missingUsers);
        return userEntities.concat(newUserEntities);
    }
    private async addUserEntities(users: User[]): Promise<UserEntity[]>
    {
        const distinctUsers: User[] = [...new Map(users.map(item => [item['id'], item])).values()];
        EinClient.instance.logger.success(`Users ${distinctUsers.map(x => x.username)} not found. Adding.`);
        const entities = distinctUsers.map(x =>
        {
            const entity = new UserEntity();
            entity.Initialize(x);
            return entity;
        });

        return this.connection.manager.save(entities);
    }

    // - - - - - -  - - - - - //
    // - - - - Tracks - - - - //
    // - - - - - -  - - - - - //
    public async getTrackBySpotifyId(spotifyId: string): Promise<TrackEntity>
    {
        const trackEntity = await this.connection.getRepository(TrackEntity)
            .findOne({
                where: { id: spotifyId },
            });
        if (trackEntity)
            return trackEntity;
        return null;
    }
    public async getTracksBySpotifyIds(spotifyIds: string[]): Promise<TrackEntity[]>
    {
        const trackEntities = (await this.connection.getRepository(TrackEntity)
            .find({
                where: { id: In(spotifyIds) },
            }));
        if (trackEntities)
            return trackEntities.filter(x => x != null);
        return null;
    }
    public async getOrAddTrackEntities(...streamableDatas: StreamableData[]) : Promise<TrackEntity[]>
    {
        const spotifyIds = streamableDatas.map(x => x.spotifyId);
        const existingTrackEntities: TrackEntity[] = (await this.connection.getRepository(TrackEntity)
            .find({
                where: { id: In(spotifyIds) },
            }));

        const missingStreamables: StreamableData[] = streamableDatas.filter(x => !existingTrackEntities.map(y => y.id).includes(x.spotifyId));
        if (missingStreamables == null || missingStreamables.length == 0)
            return existingTrackEntities;

        const newTrackEntities: TrackEntity[] = await this.addTrackEntities(missingStreamables);
        return existingTrackEntities.concat(newTrackEntities);
    }
    private async addTrackEntities(streamableDatas: StreamableData[]): Promise<TrackEntity[]>
    {
        if (!streamableDatas || streamableDatas.length === 0)
        {
            throw 'Invalid streamables';
        }

        const distinctStreamableDatas: StreamableData[] = [...new Map(streamableDatas.map(item => [item['spotifyId'], item])).values()];
        EinClient.instance.logger.success(`Tracks ${distinctStreamableDatas.map(x => x.name)} not found. Adding.`);

        const results: [AlbumEntity[], ArtistEntity[]] = await Promise.all([
            this.getOrAddAlbumEntities(distinctStreamableDatas.map((x) => x.album)),
            this.getOrAddArtistEntities(distinctStreamableDatas.map((x) => x.artist)),
        ]);

        const trackEntities: TrackEntity[] = [];
        distinctStreamableDatas.forEach(x =>
        {
            const trackEntity = new TrackEntity();
            trackEntity.Initialize(x);
            trackEntity.albumEntity = results[0].find(y => y.id === x.album.spotifyId);
            trackEntity.artistEntity = results[1].find(y => y.id === x.artist.spotifyId);
            trackEntity.albumEntity.artistEntity = trackEntity.artistEntity;
            trackEntities.push(trackEntity);
        });

        return this.connection.manager.save(trackEntities);
    }


    // - - - - - -  - - - - - //
    // - - - - Albums - - - - //
    // - - - - - -  - - - - - //

    public async getAlbumBySpotifyId(spotifyId: string): Promise<AlbumEntity>
    {
        const albumEntity = await this.connection.getRepository(AlbumEntity)
            .findOne({
                where: { id: spotifyId },
            });
        if (albumEntity)
            return albumEntity;
        return null;
    }
    public async getAlbumsBySpotifyIds(spotifyIds: string[]): Promise<AlbumEntity[]>
    {
        const albumEntities = (await this.connection.getRepository(AlbumEntity)
            .find({
                where: { id: In(spotifyIds) },
            }));
        if (albumEntities)
            return albumEntities.filter(x => x != null);
        return null;
    }
    private async getOrAddAlbumEntities(albumDatas: AlbumData[]) : Promise<AlbumEntity[]>
    {
        const albumEntities = await this.connection.getRepository(AlbumEntity).find(
            {
                where: { id: In(albumDatas.map(x => x.spotifyId)) },
            });
        const missingAlbumDatas: AlbumData[] = albumDatas.filter(x => !albumEntities.map(y => y.id).includes(x.spotifyId));
        if (missingAlbumDatas == null || missingAlbumDatas.length == 0)
            return albumEntities;

        const newAlbumEntities: AlbumEntity[] = await this.addAlbumEntities(missingAlbumDatas);
        return albumEntities.concat(newAlbumEntities);
    }
    private async addAlbumEntities(albumDatas: AlbumData[]) : Promise<AlbumEntity[]>
    {
        const distinctAlbumDatas: AlbumData[] = [...new Map(albumDatas.map(item => [item['spotifyId'], item])).values()];
        EinClient.instance.logger.success(`Albums ${distinctAlbumDatas.map(x => x.name)} not found. Adding.`);
        const albumEntities = distinctAlbumDatas.map(x =>
        {
            const entity = new AlbumEntity();
            entity.Initialize(x);
            return entity;
        });

        return this.connection.manager.save(albumEntities);
    }

    // - - - - - - - - - - - - //
    // - - - - Artists - - - - //
    // - - - - - - - - - - - - //

    public async getArtistBySpotifyId(spotifyId: string): Promise<ArtistEntity>
    {
        const artistEntity = await this.connection.getRepository(ArtistEntity)
            .findOne({
                where: { id: spotifyId },
            });
        if (artistEntity)
            return artistEntity;
        return null;
    }
    public async getArtistsBySpotifyIds(spotifyIds: string[]): Promise<ArtistEntity[]>
    {
        const artistEntities = (await this.connection.getRepository(ArtistEntity)
            .find({
                where: { id: In(spotifyIds) },
            }));
        if (artistEntities)
            return artistEntities.filter(x => x != null);
        return null;
    }
    private async getOrAddArtistEntities(artistDatas: ArtistData[]) : Promise<ArtistEntity[]>
    {
        const artistEntities = await this.connection.getRepository(ArtistEntity).find(
            {
                where: { id: In(artistDatas.map(x => x.spotifyId)) },
            });
        const missingArtistDatas: ArtistData[] = artistDatas.filter(x => !artistEntities.map(y => y.id).includes(x.spotifyId));
        if (missingArtistDatas == null || missingArtistDatas.length == 0)
            return artistEntities;

        const newArtistEntities: ArtistEntity[] = await this.addArtistEntities(missingArtistDatas);
        return artistEntities.concat(newArtistEntities);
    }
    private async addArtistEntities(artistDatas: ArtistData[]) : Promise<ArtistEntity[]>
    {
        const distinctArtistDatas: ArtistData[] = [...new Map(artistDatas.map(item => [item['spotifyId'], item])).values()];
        EinClient.instance.logger.success(`Artists ${distinctArtistDatas.map(x => x.name)} not found. Adding.`);
        const artistEntities = distinctArtistDatas.map(x =>
        {
            const entity = new ArtistEntity();
            entity.Initialize(x);
            return entity;
        });

        return this.connection.manager.save(artistEntities);
    }


    // - - - - - - - - - - - - - - //
    // - - - - Interaction - - - - //
    // - - - - - - - - - - - - - - //


    public async userInteractStreamables(user: User, interactionType: InteractionType, streamableDatas: StreamableData[]): Promise<void>
    {
        streamableDatas = streamableDatas.filter(x => x.audioFeatures != null && x.audioFeatures.exists && x.spotifyId.toLowerCase() != 'youtube');
        if (streamableDatas.length === 0)
            return;

        const userEntity: UserEntity = (await this.getOrAddUserEntities(user))[0];
        const tracks: TrackEntity[] = await this.getOrAddTrackEntities(...streamableDatas);

        tracks.forEach(track =>
        {
            userEntity.Interact(track, interactionType);
            userEntity.Interact(track.albumEntity, interactionType);
            userEntity.Interact(track.artistEntity, interactionType);
        });

        await this.connection.manager.save(userEntity);
    }
}