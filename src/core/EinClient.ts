import {
    ApplicationCommandType,
    Client,
    ClientOptions,
    Collection,
    EmbedBuilder,
    PermissionsBitField,
    REST,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    Routes,
    Snowflake
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Logger from './Logger.js';
import config from '../config.js';
import { DatabaseManager } from '../recommendationSystem/DatabaseManager.js';
import loadPlugins from '../plugin/index.js';
import { Utils } from '../util/Utils.js';


//const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class EinClient extends Client
{
    public commands : Collection<string, any> = new Collection();
    public aliases : Collection<string, any> = new Collection();
    public cooldowns : Collection<string, any> = new Collection();
    public config = config;
    public logger : Logger = new Logger();
    private body : RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
    public readonly color = config.color;
    public utils = Utils;

    private static _instance : EinClient;
    public static get instance()
    {
        return EinClient._instance;
    }

    public static create(options: ClientOptions)
    {
        if(EinClient._instance)
        {
            console.log('EinPlayer already exists');
            return EinClient._instance;
        }

        const instance = new EinClient(options);
        EinClient._instance = instance;
        return instance;
    }

    private constructor(options: ClientOptions)
    {
        super(options);
    }

    public embed(): EmbedBuilder {
        return new EmbedBuilder();
    }

    public async start(token: string) : Promise<string>
    {
        // console.log('start');
        // console.log(this.config);
        // console.log('after config');

        this.loadCommands();
        this.logger.info('Successfully loaded commands!');
        this.loadEvents();
        this.logger.info('Successfully loaded events!');
        loadPlugins(this);

        if (config.databaseSettings.enableDatabase)
        {
            await DatabaseManager.connect(config.databaseSettings);
            this.logger.info('Successfully connected to the database');
        }

        return await this.login(token);
    }

    private loadCommands() : void
    {
        const commandsPath = fs.readdirSync(path.join(__dirname, '../commands'));
        commandsPath.forEach((dir) =>
        {
            const commandFiles = fs
                .readdirSync(path.join(__dirname, `../commands/${dir}`))
                .filter((file) => file.endsWith('.js'));
            commandFiles.forEach(async (file) =>
            {
                const cmd = (await import(`../commands/${dir}/${file}`)).default;
                const command = new cmd(this, file);
                command.category = dir;
                command.file = file;
                this.commands.set(command.name, command);
                if (command.aliases.length !== 0)
                {
                    command.aliases.forEach((alias: any) =>
                    {
                        this.aliases.set(alias, command.name);
                    });
                }
                if (command.slashCommand)
                {
                    const data = {
                        name: command.name,
                        description: command.description.content,
                        type: ApplicationCommandType.ChatInput,
                        options: command.options ? command.options : null,
                        name_localizations: command.nameLocalizations ? command.nameLocalizations : null,
                        description_localizations: command.descriptionLocalizations ? cmd.descriptionLocalizations : null,
                        default_member_permissions: command.permissions.user.length > 0 ? command.permissions.user : null,
                    };
                    if (command.permissions.user.length > 0)
                    {
                        const permissionValue = PermissionsBitField.resolve(command.permissions.user);
                        if (typeof permissionValue === 'bigint')
                        {
                            data.default_member_permissions = permissionValue.toString();
                        }
                        else
                        {
                            data.default_member_permissions = permissionValue;
                        }
                    }
                    const json = JSON.stringify(data);
                    this.body.push(JSON.parse(json));
                }
            });
        });
        this.once('ready', async () =>
        {
            const applicationCommands =
                this.config.production === true
                    ? Routes.applicationCommands(this.config.botCredentials.clientId ?? '')
                    : Routes.applicationGuildCommands(this.config.botCredentials.clientId ?? '', this.config.botCredentials.guildId ?? '');
            try
            {
                const rest = new REST({ version: '9' }).setToken(this.config.botCredentials.token ?? '');
                await rest.put(applicationCommands, { body: this.body });
                this.logger.info('Successfully loaded slash commands!');
            }
            catch (error)
            {
                this.logger.error(`AAB - ${error}`);
            }
        });
    }

    private loadEvents(): void
    {
        const eventsPath = fs.readdirSync(path.join(__dirname, '../events'));
        eventsPath.forEach((dir) =>
        {
            const events = fs.readdirSync(path.join(__dirname, `../events/${dir}`)).filter((file) => file.endsWith('.js'));
            events.forEach(async (file) =>
            {
                const event = (await import(`../events/${dir}/${file}`)).default;
                const evt = new event(this, file);
                switch (dir)
                {
                    // case 'player':
                    //     this.shoukaku.on(evt.name, (...args) => evt.run(...args));
                    //     break;
                    default:
                        this.on(evt.name, (...args) => evt.run(...args));
                        break;
                }
            });
        });
    }
}