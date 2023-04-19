

import config from './config.js';

import { ClientOptions, GatewayIntentBits } from 'discord.js';
import { EinClient } from './core/index.js';

const clientOptions: ClientOptions = {
    intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
    ],
    allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: false,
    },
};

const client = EinClient.create(clientOptions);
client.start(config.botCredentials.token);