import SpotifyWebApi from 'spotify-web-api-node';
import RedisHelper from './RedisHelper.js';

export default class ExternalConnections
{
    private static haveAccessToken: boolean = false;
    private static spotifyAccessToken: string;
    private static spotifyAccessTokenExpiration: number;

    private static haveSpotifyWebApi: boolean = false;
    private static spotifyWebApi : SpotifyWebApi;
    // private static spotifyPlaybackSDK: SpotifyPlaybackSDK;

    private static haveDatabaseConnection;
    private static databaseConnection;

    private static redis: RedisHelper;

    public static async getSpotifyAccessToken()
    {
        if (this.spotifyAccessTokenValid)

            return this.spotifyAccessToken;


        const spotifyWebApi = await this.getSpotifyWebApi();
        const cred = await spotifyWebApi.clientCredentialsGrant();
        this.spotifyAccessToken = cred.body.access_token;
        this.spotifyAccessTokenExpiration = cred.body.expires_in * 1_000;
        this.haveAccessToken = true;
        return this.spotifyAccessToken;
    }

    private static get spotifyAccessTokenValid()
    {
        return this.haveAccessToken
            && this.spotifyAccessToken != null
            && this.spotifyAccessToken !== ''
            && Date.now() < this.spotifyAccessTokenExpiration;
    }

    public static async getSpotifyConnection()
    {
        const spotifyWebApi = await this.getSpotifyWebApi();
        if (!this.spotifyAccessTokenValid)
            spotifyWebApi.setAccessToken(await this.getSpotifyAccessToken());

        return spotifyWebApi;
    }

    private static async getSpotifyWebApi() : Promise<SpotifyWebApi>
    {
        if (this.haveSpotifyWebApi)
            return this.spotifyWebApi;

        this.haveSpotifyWebApi = true;
        this.spotifyWebApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: 'http://www.example.com/callback',
        });
        this.spotifyWebApi.setAccessToken(await this.getSpotifyAccessToken());
        return this.spotifyWebApi;
    }

    // public static async getSpotifyPlaybackConnection(): Promise<SpotifyPlaybackSDK> {
    //     const spotifyPlayback = new SpotifyPlaybackSDK();
    //     await spotifyPlayback.init();
    //
    //     /*
    //     const accessToken = await ExternalConnections.getSpotifyAccessToken();
    //     const player = await spotifyPlayback.createPlayer({
    //         name: "Web",
    //         getOAuthToken(){
    //             return accessToken;
    //         },
    //     });
    //
    //     player.on('player_state_changed', console.log);
    //
    //     const stream = await player.getAudio();
    //     const connected = await player.connect();
    //     if(!connected) throw 'couldnt connect';
    //
    //     console.log("connected", stream);
    //
    //      */
    //
    //     return spotifyPlayback;
    // }

    public static async getRedisConnection(): Promise<RedisHelper>
    {
        if (this.redis)

            return this.redis;

        return this.connectToRedis();
    }

    private static async connectToRedis(): Promise<RedisHelper>
    {
        this.redis = await RedisHelper.connect(
            Number(process.env.REDIS_PORT),
            process.env.REDIS_HOST,
            Number(process.env.REDIS_DB_NUMBER),
        );

        return this.redis;
    }
}
