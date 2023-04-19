import { Column, Generated, PrimaryColumn } from 'typeorm';
import { Data } from '../../@types/types.js';

export abstract class DatabaseEntity
{
    @Generated()
    public genId: number;

    @PrimaryColumn()
    public id: string;

    @Column('text')
    public name: string;


    public static IsDataValid(data: Data | string): boolean
    {
        let spotifyId: string;
        if (typeof data === 'string')
            spotifyId = data;
        else
            spotifyId = data.spotifyId;

        return spotifyId && spotifyId != '' && spotifyId != 'youtube';
    }
}