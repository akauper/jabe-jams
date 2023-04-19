import { Command, Context, EinClient, Queue } from '../../core/index.js';
import { AutoplayData } from '../../@types/types';

export default class Autoplay extends Command
{
    constructor(client: EinClient)
    {
        super(client,
    {
                name: 'autoplay',
                description: {
                    content: 'Toggles autoplay',
                    examples: [
                        'autoplay vamp anthem',
                        'autoplay vamp anthem, miley cyrus'
                    ],
                    usage: 'autoplay <comma deliniated list of tracks, artists, and albums>',
                },
                category: 'music',
                aliases: ['ap', 'radio', 'endless'],
                cooldown: 3,
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
                        name: 'tracks',
                        description: 'A comma delineated list of tracks autoplay seed.',
                        type: 3,
                        required: false,
                    },
                    {
                        name: 'artists',
                        description: 'A comma delineated list of artists autoplay seed.',
                        type: 3,
                        required: false,
                    },
                    {
                        name: 'genres',
                        description: 'A comma delineated list of artists autoplay seed.',
                        type: 3,
                        required: false,
                    },
                ],
        });
    }

    public async run(client: EinClient, ctx : Context, args : string[]) : Promise<void>
    {
        if(!client.config.databaseSettings.enableDatabase)
            return ctx.sendSimpleErrorMessage('Cannot use Autoplay when database is disabled');

        const queue = await Queue.getOrCreate(ctx.guildMember);
        const embed = client.embed();
        const autoplay = queue.autoplayActive;

        if(!autoplay)
        {
            embed.setDescription('Autoplay has been enabled. Please wait while recommendations are found.').setColor(client.color.main);
            if(!args || args.length == 0)
                queue.startAutoplay(queue, ctx);
            else
            {
                let autoplayData : AutoplayData;

                if(ctx.isInteraction && ctx.args)
                {
                    autoplayData = {
                        track_names: ctx.args.filter(x => x.name == 'tracks').map(x => x.value.split(',')),
                        artist_names: ctx.args.filter(x => x.name == 'artists').map(x => x.value.split(',')),
                        genres: ctx.args.filter(x => x.name == 'genres').map(x => x.value.split(',')),
                    }
                }
                else
                {
                    autoplayData = {
                        track_names: args.join(' ').split(','),
                    }
                }

                queue.startAutoplay(autoplayData, ctx);
            }
        }
        else
        {
            embed.setDescription('Autoplay has been disabled').setColor(client.color.main);
            queue.stopAutoplay();
        }
        return ctx.sendMessage({ embeds: [embed] });
    }
}