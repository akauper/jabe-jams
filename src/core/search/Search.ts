import { EinSearchResponse, PlayableType } from '../../@types/types';
import { Spotify } from './Spotify';
import { Apple } from './Apple';
import { YouTube } from './YouTube';
import EinClient from '../EinClient';
import Context from "../Context";

export class Search
{
    public static YouTubeRegex = /^((?:https?:)\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))((?!channel)(?!user)\/(?:[\w-]+\?v=|embed\/|v\/)?)((?!channel)(?!user)[\w-]+)(((.*([?&])t=(\d+))(\D?|\S+?))|\D?|\S+?)$/;
    public static YouTubePlaylistRegex = /^(https?:\/\/)?((?:www|m)\.)?(youtube\.com).*(youtu.be\/|list=)([^#&?]*).*/;
    public static SpotifyRegex = /https?:\/\/(?:embed\.|open\.)(?:spotify\.com\/)(?:((track|album|playlist|artist)\/)|\?uri=spotify:(track|playlist|album|artist):)(([0-9]|[a-z]|\w)+)/i;
    public static AppleRegex = /https?:\/\/music\.apple\.com\/(.+?)\/(.+?)\/(.+?)\/(.+)/i;

    private constructor() { }

    public static async search(query : string, ctx : Context) : Promise<EinSearchResponse[]>
    {
        const queries = query.split(',').map(x => x.trim());
        const urls : string[] = [];
        const textQueries : string[] = [];

        queries.forEach(x =>
        {
            if(x.toLowerCase().startsWith('http') || x.toLowerCase().includes('.com/'))
                urls.push(x);
            else
                textQueries.push(x);
        });

        const promises : Promise<EinSearchResponse[]>[] = [];
        if(urls.length > 0)
        {
            promises.push(Apple.search(urls.filter(x => Search.AppleRegex.test(x))));
            promises.push(YouTube.search(urls.filter(x => Search.YouTubeRegex.test(x))));
        }
        promises.push(Spotify.search(textQueries, urls.filter(x => Search.SpotifyRegex.test(x))));


        const result : EinSearchResponse[] = await Promise.all(promises).then(x => x.flat());

        EinClient.instance.logger.success('Search Complete. Results:');
        EinClient.instance.logger.success(result);

        return result;
    }
}