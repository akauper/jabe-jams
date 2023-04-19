import { User } from 'discord.js';
import {
    EinSearchResponse,
    EndlessRequestTypes,
    PlaylistData,
    StreamableData,
    TrackInteraction
} from '../../@types/types.js';
import Streamable from './Streamable.js';

export default class Playlist implements PlaylistData
{
    public owner: User;
    public seedStreamables: StreamableData[];
    public trackInteractions: TrackInteraction[];

    public constructor(owner: User, seedStreamables: Streamable[])
    {
        this.owner = owner;
        this.seedStreamables = seedStreamables;
        this.trackInteractions = [];
        this.trackInteractions.push(...this.seedStreamables.map(x =>
        {
            return {
                trackId: x.spotifyId,
                playCount: 1,
                rating: 3,
            };
        }));
    }

    public getAndAddRecommendations()
    {
        const sortedInteractions = this.trackInteractions.sort(this.sortFunction);
    }

    private sortFunction(trackInteractionA: TrackInteraction, trackInteractionB: TrackInteraction): number
    {
        return trackInteractionB.rating - trackInteractionA.rating;
    }
}