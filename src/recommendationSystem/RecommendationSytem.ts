import { EinSearchResponse, EndlessSeedTypes, SearchCode, TargetFeatureValues } from '../@types/types.js';
import { EinClient, Queue, Streamable } from '../core/index.js';
import {User, VoiceBasedChannel, VoiceChannel} from 'discord.js';
import { UserEntity, UserEntityInteraction } from './databaseEntities/UserEntity.js';
import { PlaylistEntity } from './databaseEntities/PlaylistEntity.js';
import { TrackEntity } from './databaseEntities/TrackEntity.js';
import { DatabaseManager } from './DatabaseManager.js';
import { ArtistEntity } from './databaseEntities/ArtistEntity';
import { AlbumEntity } from './databaseEntities/AlbumEntity';
import { Spotify } from '../core/search/Spotify';
import { Context, Playable } from '../core';
import RecommendationsOptionsObject = SpotifyApi.RecommendationsOptionsObject;

export class RecommendationSytem
{
    public static async recommend(seed : EndlessSeedTypes, ctx : Context, voiceChannel : VoiceBasedChannel, limit? : number) : Promise<Playable[]>
    {
        const minTrackEntitiesForAudioFeatures = 5;

        const client = EinClient.instance;
        const databaseEnabled = client.config.databaseSettings.enableDatabase;
        let seedArtistIds : string[];
        let seedTrackIds : string[];
        let seedGenres : string[];
        let targetFeatureValues: TargetFeatureValues;

        if(seed instanceof User)
        {
            if(!databaseEnabled)
            {
                ctx?.sendSimpleErrorMessage(`Cannot start autoplay for user[${seed}] - Requires database to be enabled.`);
                return;
            }
            const userEntity = await DatabaseManager.instance.getUserById(seed.id);
            if(userEntity == null)
            {
                ctx?.sendSimpleErrorMessage(`Cannot start autoplay for user [${seed}] - User does not have any rated tracks.`)
                return;
            }
            return this.recommend(userEntity, ctx, voiceChannel, limit);
        }
        else if(seed instanceof Queue)
        {
            const queueStreamables = seed.playables.concat(seed.playableHistory).flatMap(x => x.streamables);
            seedTrackIds = queueStreamables.map(x => x.spotifyId);
        }
        else if(seed instanceof PlaylistEntity)
        {
            seedTrackIds = seed.trackEntities.map(x => x.id);
            if (seed.trackEntities.length >= minTrackEntitiesForAudioFeatures)
                targetFeatureValues = this.calculateTargetFeatureValues(seed.trackEntities);
        }
        else if(seed instanceof ArtistEntity)
        {
            seedArtistIds = [seed.id];
            seedTrackIds = seed.trackEntities.map(x => x.id);
            if (seed.trackEntities.length >= minTrackEntitiesForAudioFeatures)
                targetFeatureValues = this.calculateTargetFeatureValues(seed.trackEntities);
        }
        else if(seed instanceof AlbumEntity)
        {
            seedGenres = seed.genresDelineated.split(',');
            seedArtistIds = seed.artistEntity ? [seed.artistEntity.id] : null;
            seedTrackIds = seed.trackEntities.map(x => x.id);
            if(seed.trackEntities.length >= minTrackEntitiesForAudioFeatures)
                targetFeatureValues = this.calculateTargetFeatureValues(seed.trackEntities);
        }
        else if(seed instanceof UserEntity)
        {
            const sortedTrackRatings = seed.getSortedTrackRatings();
            const sortedArtistRatings = seed.getSortedArtistRatings();
            const totalCount = sortedArtistRatings.filter(x => x.rating > 0).length
                + sortedTrackRatings.filter(x => x.rating > 0).length;
            if(totalCount < 3)
            {
                ctx?.sendSimpleErrorMessage(`Cannot start autoplay for user [${seed}] - User does not have enough liked tracks or artists.`)
                return;
            }

            seedArtistIds = sortedArtistRatings.map(x => x.id);
            seedTrackIds = sortedTrackRatings.map(x => x.id);
            if(seed.trackEntities.length >= minTrackEntitiesForAudioFeatures)
                targetFeatureValues = this.calculateTargetFeatureValues(seed.trackEntities, sortedTrackRatings);
        }
        else if(seed instanceof Playable)
        {
            if(seed.playableType === 'artist')
                seedArtistIds = [seed.spotifyId];
            if(seed.playableType === 'album' && seed.streamables[0].album)
                seedGenres = seed.streamables[0].album.genres;
            seedTrackIds = seed.streamables.map(x => x.spotifyId);
        }
        else if(Array.isArray(seed))
        {
            if(seed.length == 0)
            {
                ctx?.sendSimpleErrorMessage(`Cannot start autoplay for an empty array of items.`);
                return;
            }

            const streamables : Streamable[] = [];
            const tempArtistIds : string[] = [];
            const tempGenres : string[] = [];

            for (let seedElement of seed)
            {
                if(seedElement instanceof Playable)
                {
                    if(seedElement.playableType === 'artist')
                        tempArtistIds.push(seedElement.spotifyId);
                    if(seedElement.playableType === 'album' && seedElement.streamables[0].album && seedElement.streamables[0].album.genres)
                    {
                        tempGenres.push(...seedElement.streamables[0].album.genres);
                    }
                    streamables.push(...seedElement.streamables);
                }
                else
                    streamables.push(seedElement);
            }

            seedTrackIds = streamables.map(x => x.spotifyId);
            if(tempArtistIds.length > 0)
                seedArtistIds = tempArtistIds;
            if(tempGenres.length > 0)
                seedGenres = tempGenres;
        }
        else
        {
            // seed is AutoplayData

            const promises : Promise<EinSearchResponse[]>[] = [];
            if(seed.track_names && seed.track_names.length > 0)
                promises.push(Spotify.searchTracks(...seed.track_names));
            if(seed.artist_names && seed.artist_names.length > 0)
                promises.push(Spotify.searchArtists(...seed.artist_names));

            if(seed.genres && seed.genres.length > 0)
                seedGenres = seed.genres;

            const tempTrackIds : string[] = [];
            const tempArtistIds : string[] = [];

            const responses : EinSearchResponse[] = (await Promise.all(promises)).flat();
            responses.filter(x => x.code == SearchCode.Success).forEach(x =>
            {
                if(x.playable.playableType === 'track')
                    tempTrackIds.push(x.playable.spotifyId);
                else if(x.playable.playableType === 'artist')
                    tempArtistIds.push(x.playable.spotifyId);
            });

            if(tempTrackIds.length > 0)
                seedTrackIds = tempTrackIds;
            if(tempArtistIds.length > 0)
                seedArtistIds = tempArtistIds;
        }

        if(databaseEnabled)
        {
            const memberIds = voiceChannel.members.map(x => x.id);
            const userEntities = await DatabaseManager.instance.getUsersByIds(memberIds);

            function getAverageTrackRating(trackEntity : TrackEntity) : number
            {
                let count = 0;
                let totalRating = 0;

                for (let userEntity of userEntities)
                {
                    const rating = userEntity.trackRatings.find(x => x.id == trackEntity.id);
                    if(rating)
                    {
                        count++;
                        totalRating += rating.rating;
                    }
                }
                if(count == 0)
                    return 0;
                return totalRating / count;
            }

            const existingTrackEntities = await DatabaseManager.instance.getTracksBySpotifyIds(seedTrackIds);
            const mappedTrackEntities = seedTrackIds.map(x =>
            {
                const trackEntity = existingTrackEntities.find(t => t.id == x);
                if(trackEntity)
                    return { trackId: x, trackEntity: trackEntity, rating: getAverageTrackRating(trackEntity) };

                return {trackId: x, trackEntity: null, rating: null }
            });

            if(!targetFeatureValues && existingTrackEntities.length > minTrackEntitiesForAudioFeatures)
            {
                targetFeatureValues = this.calculateTargetFeatureValues(existingTrackEntities);
            }

            const sorted = mappedTrackEntities.sort((n1, n2) =>
            {
                if(!n1.rating && !n2.rating)
                    return 0;

                if(!n1.rating && n2.rating)
                    return -1;
                if(n1.rating && !n2.rating)
                    return 1;
                if(n1.rating > n2.rating)
                    return 1;
                if(n1.rating < n2.rating)
                    return -1;
                return 0;
            });

            seedTrackIds = sorted.map(x => x.trackId);
        }

        if(seedTrackIds)
            seedTrackIds = seedTrackIds.slice(0, 5);
        if(seedArtistIds)
            seedArtistIds = seedArtistIds.slice(0, 5);
        if(seedGenres)
            seedGenres = seedGenres.slice(0, 5);

        const recommendationOptions : RecommendationsOptionsObject = {
            limit: limit ? limit : 5,
            seed_artists: seedArtistIds,
            seed_tracks: seedTrackIds,
            seed_genres: seedGenres,
            target_acousticness: targetFeatureValues ? targetFeatureValues.target_acousticness : undefined,
            target_danceability: targetFeatureValues ? targetFeatureValues.target_danceability : undefined,
            target_energy: targetFeatureValues ? targetFeatureValues.target_energy : undefined,
            target_instrumentalness: targetFeatureValues ? targetFeatureValues.target_instrumentalness : undefined,
            target_liveness: targetFeatureValues ? targetFeatureValues.target_liveness : undefined,
            // target_loudness: targetFeatureValues.target_loudness,
            // target_popularity: targetFeatureValues.target_popularity,
            target_speechiness: targetFeatureValues ? targetFeatureValues.target_speechiness : undefined,
            target_tempo: targetFeatureValues ? targetFeatureValues.target_tempo : undefined,
            // target_time_signature: targetFeatureValues.target_time_signature,
            target_valence: targetFeatureValues ? targetFeatureValues.target_valence : undefined,
        }

        return Spotify.getRecommendationsFromSeedOptions(recommendationOptions);
    }

    private normalize(value: number, min: number, max: number): number
    {
        return (value - min) / (max - min);
    }
    private static calculateTargetFeatureValues(tracks: TrackEntity[], sortedTrackInteractions?: UserEntityInteraction[]) : TargetFeatureValues
    {
        tracks = tracks.filter(x => x.audioFeaturesExist);
        if(tracks.length == 0)
            return null;

        let averageAcousticness: number = 0;
        let averageDanceability: number = 0;
        let averageEnergy: number = 0;
        let averageInstrumentalness: number = 0;
        let averageLiveness: number = 0;
        // let averageLoudness: number = 0;
        let averagePopularity: number = 0;
        let averageSpeechiness: number = 0;
        let averageTempo: number = 0;
        // let averageTimeSignature: number = 0;
        let averageValence: number = 0;

        // const minRating = Math.min(...sortedTrackInteractions.map(x => x.rating));
        // const maxRating = Math.max(...sortedTrackInteractions.map(x => x.rating));

        for (const track of tracks)
        {
            let scale: number = 1;
            if (sortedTrackInteractions && sortedTrackInteractions.length !== 0)
            {
                const trackInteraction: UserEntityInteraction = sortedTrackInteractions.find(x => x.id == track.id);
                if (trackInteraction)
                {
                    // const normalizedRating = this.normalize(trackInteraction.rating, minRating, maxRating);
                    scale = (trackInteraction.playCount + 1) + trackInteraction.rating;
                }
            }

            averageAcousticness += track.acousticness * scale;
            averageDanceability += track.danceability * scale;
            averageEnergy += track.energy * scale;
            averageInstrumentalness += track.instrumentalness * scale;
            averageLiveness += track.liveness * scale;
            // averageLoudness += track.loudness * scale;
            averagePopularity += track.popularity * scale;
            averageSpeechiness += track.speechiness * scale;
            averageTempo += track.tempo * scale;
            // averageTimeSignature += track.time_signature * scale;
            averageValence += track.valence * scale;
        }

        averageAcousticness /= tracks.length;
        averageDanceability /= tracks.length;
        averageEnergy /= tracks.length;
        averageInstrumentalness /= tracks.length;
        averageLiveness /= tracks.length;
        // averageLoudness /= tracks.length;
        averagePopularity /= tracks.length;
        averageSpeechiness /= tracks.length;
        averageTempo /= tracks.length;
        // averageTimeSignature /= tracks.length;
        averageValence /= tracks.length;


        function clamp(value: number, min: number, max: number): number
        {
            return Math.min(Math.max(value, min), max);
        }

        averageAcousticness = clamp(averageAcousticness, 0, 1);
        averageDanceability = clamp(averageDanceability, 0, 1);
        averageEnergy = clamp(averageEnergy, 0, 1);
        averageInstrumentalness = clamp(averageInstrumentalness, 0, 1);
        averageLiveness = clamp(averageLiveness, 0, 1);
        // No clamp on loudness
        averagePopularity = clamp(averagePopularity, 0, 100);
        averageSpeechiness = clamp(averageSpeechiness, 0, 1);
        // No clamp on time signature
        averageValence = clamp(averageValence, 0, 1);


        return {
            target_acousticness: averageAcousticness,
            target_danceability: averageDanceability,
            target_energy: averageEnergy,
            target_instrumentalness: averageInstrumentalness,
            target_liveness: averageLiveness,
            // target_loudness: averageLoudness,
            target_popularity: averagePopularity,
            target_speechiness: averageSpeechiness,
            target_tempo: averageTempo,
            // target_time_signature: averageTimeSignature,
            target_valence: averageValence,
        };
    }

    private async getChannelAverageStreamableRatings(voiceChannel : VoiceBasedChannel, streamables : Streamable[])
    {
        const memberIds = voiceChannel.members.map(x => x.id);
        const userEntities = await DatabaseManager.instance.getUsersByIds(memberIds);
        return streamables.map(s =>
        {
            let rating : number = 0;
            let count : number = 0;
            userEntities.forEach(x =>
            {
                const trackRating = x.trackRatings.find(x => x.id = s.spotifyId);
                rating += trackRating.rating;
                count++;
            });
            rating = count == 0 ? 1 : rating / count;
            return {
                streamable: s,
                rating: rating,
            };
        });
    }
}
