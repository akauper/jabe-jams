import { Command, Context, EinClient, Queue } from '../../core/index.js';
import { Search } from '../../core/search/Search.js';
import { EinSearchResponse, PlayableType, SearchCode } from '../../@types/types.js';
import { EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';

export default class Play extends Command
{
    constructor (client : EinClient)
    {
        super(client,
            {
                name: 'play',
                description: {
                    content: 'Plays a song from YouTube, Apple, or Spotify',
//                     content: `Plays a song from YouTube or Spotify.
// Use the following prefixes to specify your search:
//   - track:
//   - artist:
//   - album:
//   - playlist:
// These prefixes can be used in conjunction with each other: 'track:vamp anthem artist:playboi carti
// Use comma dillineation to search for multiple things: 'track:vamp anthem artist:playboi carti, track:m1 stinger artist: gladiator`,
                    examples: [
                        'play https://www.youtube.com/watch?v=QH2-TGUlwu4',
                        'play https://open.spotify.com/track/6WrI0LAC5M1Rw2MnX2ZvEg',
                        'play Vamp Anthem',
                        // 'play track:Vamp Anthem artist:Playboi Carti',
                        // 'play track:Vamp Anthem artist:Playboi Carti, track:m1 stinger artist: gladiator',
                        // 'play Vamp Anthem, M1 Stinger'
                    ],
                    usage: 'play <song artist album or playlist>',
                },
                category: 'music',
                aliases: ['p'],
                cooldown: 1,
                args: true,
                player: {
                    voice: true,
                    dj: false,
                    active: false,
                    djPerm: null,
                },
                permissions: {
                    dev: false,
                    client: ['SendMessages', 'ViewChannel', 'EmbedLinks', 'Connect', 'Speak'],
                    user: [],
                },
                slashCommand: true,
                options: [
                    {
                        name: 'song',
                        description: 'The song you want to play',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                    {
                        name: 'album',
                        description: 'The album you want to play',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                    {
                        name: 'artist',
                        description: 'The artist you want to play',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                    {
                        name: 'playlist',
                        description: 'The playlist you want to play',
                        type: ApplicationCommandOptionType.String,
                        required: false,
                    },
                ],
            });
    }

    public async run(client : EinClient, ctx : Context, args : string[]) : Promise<void>
    {
        const query = args.join(' ');
        const queue = await Queue.getOrCreate(ctx.guildMember);
        const vc = ctx.member as any;

        const res = await Search.search(query, ctx);
        console.log(res);
        const successResponses = res.filter(x => x.code == SearchCode.Success && x.playable != null);
        const errorResponses = res.filter(x => x.code != SearchCode.Success);

        let successDescription : string = '';
        let errorDescription : string = '';

        if(errorResponses.length > 0)
        {
            errorDescription += 'Errors:'
            for (let i = 0; i < errorResponses.length; i++)
            {
                errorDescription += '\n';
                errorDescription += `${(i + 1)}) `;
                switch (errorResponses[i].code)
                {
                    case SearchCode.NoMatches:
                        errorDescription += `No matches for query '${errorResponses[i].query}'`;
                        break;
                    case SearchCode.InvalidURL:
                        errorDescription += `Invalid URL '${errorResponses[i].query}'`;
                        break;
                    case SearchCode.InvalidQuery:
                        errorDescription += `Invalid query '${errorResponses[i].query}'`;
                        break;
                    case SearchCode.InternalDatabaseError:
                        errorDescription += `Internal database error for query '${errorResponses[i].query}'`;
                        break;
                }
                if(errorResponses[i].codeDetails && errorResponses[i].codeDetails != '')
                    errorDescription += ` -- Details: ${errorResponses[i].codeDetails }`;
            }
        }
        if(successResponses.length > 0)
        {
            successDescription = 'Adding';
            const playlists : EinSearchResponse[] = [];
            const tracks : EinSearchResponse[] = [];
            const albums : EinSearchResponse[] = [];
            const artists : EinSearchResponse[] = [];

            for (let response of successResponses)
            {
                switch(response.playable.playableType)
                {
                    case 'track':
                        tracks.push(response);
                        break;
                    case 'album':
                        albums.push(response);
                        break;
                    case 'playlist':
                    case 'userPlaylist':
                        playlists.push(response);
                        break;
                    case 'artist':
                        artists.push(response);
                        break;
                }
            }

            if(playlists.length > 0)
                successDescription += ` ${playlists.length} Playlists with ${playlists.flatMap(x => x.playable.streamables).length} tracks`;
            if(albums.length > 0)
                successDescription += ` ${albums.length} Albums with ${albums.flatMap(x => x.playable.streamables).length} tracks`;
            if(tracks.length > 0)
                successDescription += ` ${tracks.length} tracks`;

            successDescription += ' to the queue.'
        }


        const embeds : EmbedBuilder[] = [];
        if(errorDescription && errorDescription != '')
            embeds.push(this.client.embed().setColor(this.client.color.red).setDescription(errorDescription));
        if(successDescription && successDescription != '')
            embeds.push(this.client.embed().setColor(this.client.color.main).setDescription(successDescription));

        ctx.sendMessage({
            embeds: embeds
        });


        queue.play(successResponses.flatMap(x => x.playable), ctx);
    }
}