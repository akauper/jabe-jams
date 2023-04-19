import dotent from 'dotenv';

dotent.config();

export default {
    production: parseBoolean(process.env.PRODUCTION) || true,
    owners: process.env.OWNERS?.split(','),
    botCredentials:
        {
            token: process.env.BOT_TOKEN,
            clientId: process.env.BOT_CLIENT_ID,
            guildId: process.env.BOT_GUILD_ID,
        },
    prefix: process.env.PREFIX,
    deploySlashCommands: true,
    databaseSettings:
        {
            enableDatabase: parseBoolean(process.env.DB_ENABLE) || true,
            useCachedTracksInSearch: true,
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            name: process.env.DB_NAME,
        },

    enabledSpotify: parseBoolean(process.env.ENABLE_SPOTIFY),
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,

    color: {
        red: 0xff0000,
        green: 0x00ff00,
        blue: 0x0000ff,
        yellow: 0xffff00,
        main: 0x2f3136,
    },

    lavalink: [
        {
            url: process.env.LAVALINK_URL,
            auth: process.env.LAVALINK_AUTH,
            name: process.env.LAVALINK_NAME,
            secure: parseBoolean(process.env.LAVALINK_SECURE) || false,
        },
    ],
};

function parseBoolean(value: string | undefined): boolean
{
    if (typeof value === 'string')
    {
        value = value.trim().toLowerCase();
    }
    switch (value)
    {
        case 'true':
            return true;
        default:
            return false;
    }
}