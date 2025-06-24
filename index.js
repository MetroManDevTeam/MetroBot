console.log('[BOOT] Starting bot initialization process...');
require('dotenv').config();
console.log('[CONFIG] Environment variables loaded');

// ======================
// DISCORD BOT INITIALIZATION
// ======================
console.log('[DISCORD] Loading Discord.js modules...');
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { readdirSync } = require('fs');
const { join } = require('path');

console.log('[DISCORD] Loading internal modules...');
const logger = require('./events/logger');
const loadEvents = require('./events');
const NewsWatcher = require('./events/NewsWatcher');
const AdvancedCommandLoader = require('./core/loaders/AdvancedCommandLoader');
const { setClient } = require('./utils/clientManager');
const metroConfig = require('./config/metro/metroConfig');

console.log('[DISCORD] Creating Discord client instance...');
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ======================
// PERSISTENT CONNECTION SYSTEM
// ======================
const MAX_LOGIN_ATTEMPTS = 10;
let loginAttempts = 0;
let reconnectTimeout = null;

async function initializeDiscordConnection() {
  console.log(`[DISCORD] Login attempt ${loginAttempts + 1}/${MAX_LOGIN_ATTEMPTS}...`);
  
  if (!process.env.DISCORD_TOKEN) {
    console.error('[DISCORD] ERROR: Missing DISCORD_TOKEN in environment');
    return false;
  }

  try {
    // Clear any existing listeners to prevent duplicates
    discordClient.removeAllListeners();
    
    // Setup event handlers
    discordClient.on('ready', () => {
      loginAttempts = 0;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      console.log(`✅ Discord bot ready as ${discordClient.user.tag}`);
      loadEvents(discordClient); // Reload events on reconnection
    });

    discordClient.on('disconnect', () => {
      console.warn('[DISCORD] Connection lost. Attempting to reconnect...');
      scheduleReconnection();
    });

    discordClient.on('reconnecting', () => {
      console.log('[DISCORD] Attempting to reconnect...');
    });

    discordClient.on('warn', info => {
      console.warn(`[DISCORD WARNING] ${info}`);
    });

    discordClient.on('error', error => {
      console.error(`[DISCORD ERROR] ${error}`);
    });

    await discordClient.login(process.env.DISCORD_TOKEN);
    console.log('[DISCORD] Login successful');
    return true;
  } catch (error) {
    console.error('[DISCORD] Login failed:', error.message);
    return false;
  }
}

function scheduleReconnection() {
  if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    console.error(`[DISCORD] Maximum login attempts (${MAX_LOGIN_ATTEMPTS}) reached. Giving up.`);
    return;
  }

  loginAttempts++;
  const delay = 60000; // 1 minute
  console.log(`[DISCORD] Next connection attempt in ${delay/1000} seconds...`);

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  reconnectTimeout = setTimeout(async () => {
    if (!discordClient.isReady()) {
      const success = await initializeDiscordConnection();
      if (!success) {
        scheduleReconnection();
      }
    }
  }, delay);
}

// ======================
// BOT SETUP (UNCHANGED)
// ======================
discordClient.commands = new Collection();
discordClient.prefixCommands = new Collection();
discordClient.metroCore = require('./modules/metro/core/MetroCore');
discordClient.commandLoader = new AdvancedCommandLoader(discordClient);

// Load prefix commands
const prefixCommandsPath = join(__dirname, 'prefixCommands');
readdirSync(prefixCommandsPath)
  .filter(file => file.endsWith('.js'))
  .forEach(file => {
    const command = require(join(prefixCommandsPath, file));
    if ('name' in command && 'execute' in command) {
      discordClient.prefixCommands.set(command.name, command);
    }
  });

// Interaction handling
const interactionHandler = require('./modules/interactions/interactionHandler');
discordClient.on('interactionCreate', async interaction => {
  try {
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit() || interaction.isContextMenuCommand()) {
      return interactionHandler.execute(interaction);
    }
    if (interaction.isCommand()) {
      const command = discordClient.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
  } catch (error) {
    console.error('Error processing interaction:', error);
    const response = { content: '⚠️ An error occurred', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
});

setClient(discordClient);

// Message handling (unchanged)
discordClient.on('messageCreate', async message => {
  if (message.author.bot) return;
  const prefix = '!';
  
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = discordClient.prefixCommands.get(commandName);
    if (!command) return;
    try {
      await command.execute(message, args);
    } catch (error) {
      console.error('Prefix command error:', error);
      await message.reply('Command error');
    }
  }

  if (message.channel.id !== '1377398484931575938') return;
  const targetChannel = await discordClient.channels.fetch('1347146518943105085');
  if (!targetChannel) return;

  try {
    let urgency = '';
    const firstChar = message.content.split(" ")[0].trim();
    if (firstChar) urgency = _translateUrgencyEmoji(firstChar);

    let title = '';
    let content = message.content;
    const titleMatch = content.match(/\$&(.*?)\$&/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      content = content.replace(titleMatch[0], '').trim();
    }

    content = _processLineKeywords(content);

    const embed = new EmbedBuilder()
      .setDescription(content)
      .setColor(_getUrgencyColor(urgency))
      .setTimestamp();

    if (title) embed.setTitle(title);
    if (urgency) embed.setAuthor({ name: `Urgency: ${urgency}` });

    const options = { embeds: [embed] };
    if (message.attachments.size > 0) {
      options.files = [...message.attachments.values()];
    }

    await targetChannel.send(options);

    let telegramMessage = '';
    if (firstChar) {
      const telegramEmoji = _translateToTelegramEmoji(firstChar);
      telegramMessage += `${telegramEmoji} `;
    }
    
    telegramMessage += `<b>Información Metro</b>\n`;
    if (title) telegramMessage += `<b>${title}</b>\n`;
    
    const telegramContent = _processForTelegram(content);
    telegramMessage += telegramContent;

    await telegramBot.sendToChannel(telegramMessage, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Ver en Discord', url: message.url }
        ]]
      }
    });

  } catch (error) {
    console.error('Error forwarding message:', error);
  }
});

// Helper functions (unchanged)
function _translateToTelegramEmoji(discordEmoji) {
  const emojiMap = {
    '🚨': '🚨', '⚠️': '⚠️', 'ℹ️': 'ℹ️',
    '🔵': '🔵', '🟢': '🟢', 
    '🟡': '🟡', '🔴': '🔴'
  };
  return emojiMap[discordEmoji] || '';
}

function _processForTelegram(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\bl1\b/gi, 'Línea 1')
    .replace(/\bl2\b/gi, 'Línea 2')
    .replace(/\bl3\b/gi, 'Línea 3')
    .replace(/\bl4\b/gi, 'Línea 4')
    .replace(/\bl4a\b/gi, 'Línea 4A')
    .replace(/\bl5\b/gi, 'Línea 5')
    .replace(/\bl6\b/gi, 'Línea 6')
    .replace(/\bl7\b/gi, 'Línea 7')
    .replace(/\bl8\b/gi, 'Línea 8')
    .replace(/\bl9\b/gi, 'Línea 9')
    .replace(/\$verde/gi, '[Estación Verde]')
    .replace(/\$roja/gi, '[Estación Roja]')
    .replace(/\$comun/gi, '[Estación Común]');
}

function _translateUrgencyEmoji(emoji) {
  const urgencyMap = {
    '🚨': 'Alta', '⚠️': 'Media', 'ℹ️': 'Baja',
    '🔵': 'Informativa', '🟢': 'Normal',
    '🟡': 'Advertencia', '🔴': 'Crítica'
  };
  return urgencyMap[emoji] || '';
}

function _getUrgencyColor(urgency) {
  const colorMap = {
    'Alta': 0xFF0000, 'Media': 0xFFA500,
    'Baja': 0xFFFF00, 'Informativa': 0x0000FF,
    'Normal': 0x00FF00, 'Advertencia': 0xFFA500,
    'Crítica': 0xFF0000
  };
  return colorMap[urgency] || 0x3498DB;
}

function _processLineKeywords(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\bl1\b/gi, metroConfig.linesEmojis.l1)
    .replace(/\bl2\b/gi, metroConfig.linesEmojis.l2)
    .replace(/\bl3\b/gi, metroConfig.linesEmojis.l3)
    .replace(/\bl4\b/gi, metroConfig.linesEmojis.l4)
    .replace(/\bl4a\b/gi, metroConfig.linesEmojis.l4a)
    .replace(/\bl5\b/gi, metroConfig.linesEmojis.l5)
    .replace(/\bl6\b/gi, metroConfig.linesEmojis.l6)
    .replace(/\bl7\b/gi, metroConfig.linesEmojis.l7)
    .replace(/\bl8\b/gi, metroConfig.linesEmojis.l8)
    .replace(/\bl9\b/gi, metroConfig.linesEmojis.l9)
    .replace(/\$verde/gi, metroConfig.stationIcons.verde.emoji)
    .replace(/\$roja/gi, metroConfig.stationIcons.roja.emoji)
    .replace(/\$comun/gi, `${metroConfig.stationIcons.comun.emoji}`);
}

// ======================
// TELEGRAM BOT INITIALIZATION
// ======================
console.log('[TELEGRAM] Loading Telegram bot module...');
const TelegramBot = require('./Telegram/bot');
const telegramBot = TelegramBot;

// ======================
// LAUNCH SEQUENCE
// ======================
console.log('[BOOT] Starting bot launch sequence...');
(async () => {
  try {


    // Start Telegram
    console.log('[TELEGRAM] Launching...');
    await telegramBot.launch()
  
    console.log('✅ Telegram bot ready')
    

        // Start Discord with persistent connection
    const discordSuccess = await initializeDiscordConnection();
    if (!discordSuccess) {
      scheduleReconnection();
    }

    // Graceful shutdown
    console.log('[BOOT] Setting up shutdown handlers...');
    const shutdown = async (signal) => {
      console.log(`[SHUTDOWN] Received ${signal}, shutting down...`);
      try {
        if (discordClient.isReady()) {
          await discordClient.destroy();
          console.log('[DISCORD] Client destroyed');
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        await telegramBot.stop(signal);
        console.log('[TELEGRAM] Bot stopped');
        process.exit(0);
      } catch (err) {
        console.error('[SHUTDOWN] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    console.log('[BOOT] All systems operational');
  } catch (error) {
    console.error('[BOOT] Initialization failed:', error);
    scheduleReconnection();
  }
})();
