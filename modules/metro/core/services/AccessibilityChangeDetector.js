const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('../../../../Telegram/bot');
const { getClient } = require('../../../../utils/clientManager');
const TimeHelpers = require('../../../chronos/timeHelpers');
const { EmbedBuilder } = require('discord.js');
const metroConfig = require('../../../../config/metro/metroConfig');
const AccessCore = require('../../accessManagement/accessCore');

const API_URL = process.env.ACCESSARIEL; // Ensure this is set in your environment
const STATE_FILE = path.join(__dirname, 'lastAccessState.json');
const CACHE_FILE = path.join(__dirname, 'accessibilityCache.json');
const TELEGRAM_CHANNEL = '804';
const DISCORD_CHANNEL = '1381634611225821346';
const DISCORD_SUMMARY_CHANNEL = '901592257591930920';

// Manual first load flag - set to true to process all equipment regardless of changes
const MANUAL_FIRST_LOAD = true;

// MetroCore instance management (singleton pattern)
let metroCoreInstance = null;
async function getMetroCore() {
    if (!metroCoreInstance) {
        const MetroCore = require('../MetroCore');
        metroCoreInstance = await MetroCore.getInstance();
    }
    return metroCoreInstance;
}

class AccessibilityChangeDetector {
    constructor() {
        this.logger = {
            info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
            warn: (message) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`),
            error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`)
        };

        this.timeHelpers = TimeHelpers;  // Initialize TimeHelpers instance
        this.initializeStorage();
        this.lastStates = this.loadDataFile(STATE_FILE, 'last state');
        this.cachedStates = this.loadDataFile(CACHE_FILE, 'cache');

        if (Object.keys(this.cachedStates).length === 0 && Object.keys(this.lastStates).length > 0) {
            this.logger.info('Initializing cache from last state data');
            this.cachedStates = JSON.parse(JSON.stringify(this.lastStates));
            this.saveCache(this.cachedStates);
        }
    }

    initializeStorage() {
        try {
            const dir = path.dirname(CACHE_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                this.logger.info(`Created storage directory: ${dir}`);
            }

            [STATE_FILE, CACHE_FILE].forEach(file => {
                if (!fs.existsSync(file)) {
                    fs.writeFileSync(file, JSON.stringify({}, null, 2));
                    this.logger.info(`Initialized empty file: ${file}`);
                }
            });
        } catch (error) {
            this.logger.error(`Storage initialization failed: ${error.message}`);
            throw error;
        }
    }

    loadDataFile(filePath, type) {
        try {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(rawData);
            
            if (typeof data !== 'object' || data === null) {
                throw new Error(`Invalid ${type} file structure`);
            }

            this.logger.info(`Loaded ${type} data from ${filePath}`);
            return this.cleanData(data);
        } catch (error) {
            this.logger.error(`Error loading ${type} data: ${error.message}`);
            
            if (fs.existsSync(filePath) && error instanceof SyntaxError) {
                const backupPath = `${filePath}.bak`;
                fs.copyFileSync(filePath, backupPath);
                this.logger.warn(`Created backup of corrupted file at ${backupPath}`);
            }

            return {};
        }
    }

    cleanData(data) {
        const cleanData = {};
        for (const [id, equipment] of Object.entries(data)) {
            if (!equipment || typeof equipment !== 'object') continue;
            
            cleanData[id] = {
                time: equipment.time || this.timeHelpers.currentTime.toISOString(),
                estado: equipment.estado !== undefined ? equipment.estado : -1,
                tipo: equipment.tipo || 'unknown',
                estacion: equipment.estacion || 'unknown',
                texto: equipment.texto || 'No description'
            };
        }
        return cleanData;
    }

    saveLastStates(newData = null) {
        try {
            if (newData) {
                this.lastStates = newData;
            }
            const cleanData = this.cleanData(this.lastStates);
            fs.writeFileSync(STATE_FILE, JSON.stringify(cleanData, null, 2));
            this.logger.info(`Saved last states to ${STATE_FILE}`);
        } catch (error) {
            this.logger.error(`Error saving last states: ${error.message}`);
        }
    }

    saveCache(data) {
        try {
            const cleanData = this.cleanData(data);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cleanData, null, 2));
            this.cachedStates = cleanData;
            this.logger.info(`Updated cache at ${CACHE_FILE}`);
        } catch (error) {
            this.logger.error(`Error saving cache: ${error.message}`);
        }
    }

    isWithinUpdateWindow() {
        const currentTime = this.timeHelpers.currentTime;
        const currentHour = currentTime.hour();
        const currentMinute = currentTime.minute();
        
        const isFirstWindow = (
            currentHour === 6 && 
            currentMinute >= 20 && 
            currentMinute <= 25
        );
        
        const isSecondWindow = (
            currentHour === 9 && 
            currentMinute >= 20 && 
            currentMinute <= 24
        );
        
        const isThirdWindow = (
            currentHour === 12 && 
            currentMinute >= 48 && 
            currentMinute <= 51
        );

        const isFourthWindow = (
            currentHour === 16 && 
            currentMinute >= 10 && 
            currentMinute <= 15
        );

        const isFifthWindow = (
            currentHour === 20 && 
            currentMinute >= 40 && 
            currentMinute <= 45
        );
        
        return isFirstWindow || isSecondWindow || isThirdWindow || isFourthWindow || isFifthWindow;
    }

    async checkAccessibility() {
        try {
            const withinWindow = this.isWithinUpdateWindow();
            this.logger.info(`Starting accessibility check. Within update window: ${withinWindow}`);

            let currentStates;
            let dataSource;
            let comparisonBaseline;
            
            if (withinWindow || MANUAL_FIRST_LOAD) {
                // During window or manual first load: fetch live API data
                this.logger.info(MANUAL_FIRST_LOAD ? 'Manual first load - fetching fresh data' : 'Fetching fresh data from API');
                const response = await axios.get(API_URL);
                currentStates = response.data;
                dataSource = 'API';
                comparisonBaseline = this.lastStates;
                this.saveCache(currentStates);
            } else {
                // Outside window: use cached data
                if (Object.keys(this.cachedStates).length > 0) {
                    currentStates = this.cachedStates;
                    comparisonBaseline = this.lastStates;
                    dataSource = 'cache';
                    this.logger.info('Using cached data for comparison');
                } else {
                    this.logger.error('No cached data available');
                    return [];
                }
            }

            const cleanCurrentStates = this.cleanData(currentStates);
            const cleanComparisonBaseline = this.cleanData(comparisonBaseline);

            if (Object.keys(cleanComparisonBaseline).length === 0) {
                this.logger.info('First run detected, saving initial state');
                this.saveLastStates(cleanCurrentStates);
                return [];
            }
            
            const changes = MANUAL_FIRST_LOAD 
                ? this.generateFullLoadChanges(cleanCurrentStates)
                : this.detectChanges(cleanCurrentStates, cleanComparisonBaseline);
            
            this.logger.info(`Detected ${changes.length} changes`);

            if (changes.length > 0) {
                if (!MANUAL_FIRST_LOAD) {
                    await this.notifyChanges(changes);
                }
                
                // Process and store changes in the access files
                await this.processAndStoreChanges(changes);
                
                // Always update lastStates when changes are detected
                this.logger.info('Updating lastStates with current data');
                this.saveLastStates(cleanCurrentStates);
            }

            this.cachedStates = this.loadDataFile(CACHE_FILE, 'cache');
            
            return changes;
        } catch (error) {
            this.logger.error(`Error in accessibility check: ${error.message}`);
            return [];
        }
    }

    generateFullLoadChanges(currentStates) {
        // Treat all current equipment as "new" for the first load
        return Object.entries(currentStates).map(([equipmentId, currentData]) => ({
            equipmentId,
            type: 'new',
            current: currentData
        }));
    }

    async processAndStoreChanges(changes) {
    try {
        const accessCore = new AccessCore();
        await accessCore.ensureAccessDetailsDir();
        const metro = await getMetroCore();
        
        // First group changes by station
        const changesByStation = {};
        
        for (const change of changes) {
            const equipment = change.current || change.previous;
            if (!equipment) continue;

            const fullEquipmentId = change.equipmentId;
            const stationCode = fullEquipmentId.split('-')[0];
            
            if (!changesByStation[stationCode]) {
                changesByStation[stationCode] = [];
            }
            changesByStation[stationCode].push(change);
        }
        
        // Process each station's changes together
        for (const [stationCode, stationChanges] of Object.entries(changesByStation)) {
            // Get station data from MetroCore
            const stationData = Object.values(metro._staticData.stations).find(
                s => s.code === stationCode
            );
            
            if (!stationData) {
                this.logger.warn(`Station not found in MetroCore data: ${stationCode}`);
                continue;
            }

            // Fix line format
            const lineNumber = stationData.line;
            let line = `${lineNumber}`.replace(/ll+/g, 'l');
            let stationKey = `${stationData.displayName}`;
            
            // Load or create initial config for this station
            const config = await accessCore.getAccessConfig(stationKey) || {
                station: stationData.displayName.toLowerCase(),
                line: line,
                accesses: [],
                elevators: [],
                escalators: [],
                changeHistory: [],
                lastUpdated: new Date().toISOString(),
                changelistory: []
            };
            
            // Process all changes for this station
            for (const change of stationChanges) {
                const equipment = change.current || change.previous;
                const fullEquipmentId = change.equipmentId;
                const equipCode = fullEquipmentId.split('-')[1];
                
                // Determine equipment type
                const isElevator = equipment.tipo.toLowerCase().includes('ascensor');
                const isEscalator = equipment.tipo.toLowerCase().includes('escalera');
                
                if (!isElevator && !isEscalator) continue;
                
                // Enhanced path extraction with fallbacks
                let from = 'Unknown';
                let to = 'Unknown';
                
                const pathMatch = equipment.texto.match(/(?:desde|from)\s*(.+?)\s*(?:hacia|to|hasta)\s*(.+)/i);
                if (pathMatch) {
                    from = pathMatch[1].trim();
                    to = pathMatch[2].trim();
                } else if (stationData.areas) {
                    from = stationData.areas[0] || 'Entrada Principal';
                    to = stationData.areas[1] || 'Andén';
                }
                
                const fullPath = equipment.texto;
                
                const equipmentData = {
                    id: equipCode,
                    status: equipment.estado === 1 ? 'operativa' : 'fuera de servicio',
                    lastUpdated: new Date().toISOString(),
                    notes: equipment.texto || '',
                    from: from,
                    to: to,
                    fullPath: fullPath,
                    segments: [from, to]
                };
                
                // Add to appropriate array
                const targetArray = isElevator ? config.elevators : config.escalators;
                const existingIndex = targetArray.findIndex(e => e.id === equipCode);
                
                if (existingIndex >= 0) {
                    targetArray[existingIndex] = equipmentData;
                } else {
                    targetArray.push(equipmentData);
                }
                
                // Create change history entry
                const changeEntry = {
                    timestamp: new Date().toISOString(),
                    user: 'AccessibilityChangeDetector',
                    action: this.getActionDescription(change, isElevator, isEscalator),
                    details: this.getChangeDetails(change, fullEquipmentId)
                };
                
                config.changeHistory.unshift(changeEntry);
                config.changelistory.unshift(changeEntry);
            }
            
            // Trim history
            if (config.changeHistory.length > 50) {
                config.changeHistory = config.changeHistory.slice(0, 50);
            }
            if (config.changelistory.length > 50) {
                config.changelistory = config.changelistory.slice(0, 50);
            }
            
            // Update lastUpdated timestamp
            config.lastUpdated = new Date().toISOString();
            
            // Save config for this station
            const existingLines = ['l1', 'l2', 'l3', 'l4', 'l4a', 'l5', 'l6'];
            line = existingLines.some(l => stationKey.includes(l)) ? '' : ` ${line}`;
            await accessCore.saveAccessConfig(`${stationKey}${line}`, config);
        }
        
        this.logger.info(`Processed changes for ${Object.keys(changesByStation).length} stations`);
    } catch (error) {
        this.logger.error(`Error processing changes: ${error.message}`);
        throw error;
    }
}

    getActionDescription(change, isElevator, isEscalator) {
        const equipmentType = isElevator ? 'ascensor' : 'escalera';
        
        if (change.type === 'new') {
            return `Nuevo ${equipmentType} agregado`;
        } else if (change.type === 'removed') {
            return `${equipmentType} eliminado`;
        } else if (change.type === 'state_change') {
            const newStatus = change.current.estado === 1 ? 'operativa' : 'fuera de servicio';
            return `Actualizado ${equipmentType} a ${newStatus}`;
        }
        return `Actualización de ${equipmentType}`;
    }

    getChangeDetails(change, equipmentId) {
        if (change.type === 'new') {
            return `Nuevo equipo: ${equipmentId} - ${change.current.texto || 'Sin descripción'}`;
        } else if (change.type === 'removed') {
            return `Eliminado: ${equipmentId} - ${change.previous.texto || 'Sin descripción'}`;
        } else if (change.type === 'state_change') {
            const fromStatus = change.previous.estado === 1 ? 'operativo' : 'fuera de servicio';
            const toStatus = change.current.estado === 1 ? 'operativo' : 'fuera de servicio';
            return `Cambio de estado: ${equipmentId} de ${fromStatus} a ${toStatus}`;
        }
        return `Actualizado: ${equipmentId}`;
    }

    detectChanges(currentStates, comparisonBaseline) {
        const changes = [];
        
        // Detect new equipment and state changes
        for (const [equipmentId, currentData] of Object.entries(currentStates)) {
            const lastData = comparisonBaseline[equipmentId];
            
            if (!lastData) {
                changes.push({
                    equipmentId,
                    type: 'new',
                    current: currentData,
                });
                this.logger.info(`New equipment detected: ${equipmentId}`);
            } else if (lastData.estado !== currentData.estado) {
                changes.push({
                    equipmentId,
                    type: 'state_change',
                    previous: lastData,
                    current: currentData,
                });
                this.logger.info(`State change detected for equipment: ${equipmentId}`);
            }
        }
        
        // Detect removed equipment
        for (const equipmentId of Object.keys(comparisonBaseline)) {
            if (!currentStates[equipmentId]) {
                changes.push({
                    equipmentId,
                    type: 'removed',
                    previous: comparisonBaseline[equipmentId],
                });
                this.logger.info(`Equipment removed: ${equipmentId}`);
            }
        }
        
        return changes;
    }

    async notifyChanges(changes) {
        try {
            // Telegram message (split into multiple messages if too long)
            const telegramMessages = await this.formatTelegramMessages(changes);
            if (telegramMessages.length > 0) {
                this.logger.info(`Sending ${telegramMessages.length} Telegram message(s)`);
                for (const message of telegramMessages) {
                    await TelegramBot.sendTelegramMessage(message, { parse_mode: 'Markdown' });
                    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
                }
            }

            // Discord embeds
            const client = getClient();
            
            // Original detailed embeds
            const statusChannel = client.channels.cache.get(DISCORD_CHANNEL);
            if (statusChannel) {
                const discordEmbeds = await this.formatDiscordEmbeds(changes);
                if (discordEmbeds.length > 0) {
                    this.logger.info(`Sending ${discordEmbeds.length} Discord embed(s) to main channel`);
                    for (let i = 0; i < discordEmbeds.length; i += 5) {
                        const batch = discordEmbeds.slice(i, i + 5);
                        await statusChannel.send({ embeds: batch });
                        if (i + 5 < discordEmbeds.length) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
            }
            
            // New summary embeds
            const summaryChannel = client.channels.cache.get(DISCORD_SUMMARY_CHANNEL);
            if (summaryChannel && changes.length > 0) {
                const metro = await getMetroCore();
                const summaryEmbeds = this.formatSummaryEmbeds(changes, metro);
                if (summaryEmbeds.length > 0) {
                    this.logger.info(`Sending ${summaryEmbeds.length} summary embed(s) to summary channel`);
                    await summaryChannel.send({ embeds: summaryEmbeds });
                }
            }
        } catch (error) {
            this.logger.error(`Error notifying changes: ${error.message}`);
        }
    }

    formatSummaryEmbeds(changes, metro) {
        const elevators = [];
        const escalators = [];
        
        // Separate changes by equipment type
        changes.forEach(change => {
            const equipment = change.current || change.previous;
            if (!equipment) return;
            
            const isElevator = equipment.tipo.toLowerCase().includes('ascensor');
            const isEscalator = equipment.tipo.toLowerCase().includes('escalera');
            
            if (isElevator) {
                elevators.push(change);
            } else if (isEscalator) {
                escalators.push(change);
            }
        });
        
        const embeds = [];
        const maxFieldLength = 1000; // Discord field limit
        const maxEmbedLength = 6000; // Discord embed limit
        
        // Helper function to create grouped embeds for a specific equipment type
        const createEquipmentEmbed = (items, title) => {
            if (items.length === 0) return null;
            
            // Group by line
            const lineGroups = {};
            
            items.forEach(change => {
                const stationCode = change.equipmentId.split('-')[0];
                const station = Object.values(metro._staticData.stations).find(s => s.code === stationCode);
                const lineNumber = station?.line || '?';
                const lineKey = station?.line ? `l${station.line}` : 'unknown';
                
                if (!lineGroups[lineKey]) {
                    lineGroups[lineKey] = {
                        lineNumber,
                        lineEmoji: metroConfig.linesEmojis[lineKey] || '',
                        items: []
                    };
                }
                lineGroups[lineKey].items.push(change);
            });
            
            // Create embed with title and timestamp
            let embed = new EmbedBuilder()
                .setColor(0x0052A5)
                .setTitle(title)
                .setDescription(`Última Actualización: ${this.timeHelpers.formatDateTime('DD/MM/YYYY HH:mm')}`)
                .setTimestamp();
            
            // Process each line group
            Object.values(lineGroups).forEach(group => {
                const nowOperational = [];
                const nowNonOperational = [];
                
                // Separate operational and non-operational changes
                group.items.forEach(change => {
                    const stationCode = change.equipmentId.split('-')[0];
                    const station = Object.values(metro._staticData.stations).find(s => s.code === stationCode);
                    const stationName = station?.displayName || stationCode;
                    
                    const equipmentText = change.current?.texto || change.previous?.texto;
                    
                    if (change.type === 'state_change' || change.type === 'new') {
                        if (change.current?.estado === 1) {
                            nowOperational.push(`- ${stationName}: ${equipmentText}`);
                        } else if (change.current?.estado === 0) {
                            nowNonOperational.push(`- ${stationName}: ${equipmentText}`);
                        }
                    }
                });
                
                // Add line section to embed
                let lineSection = ` **👉 Línea ${metroConfig.linesEmojis[group.lineNumber]} **\n`;
                
                // Add operational changes
                if (nowOperational.length > 0) {
                    lineSection += `*** ✅ Ahora Operativos:***\n${nowOperational.join('\n')}\n`;
                }
                
                // Add non-operational changes
                if (nowNonOperational.length > 0) {
                    lineSection += `*** ❌ Ahora Fuera de servicio:***\n${nowNonOperational.join('\n')}\n`;
                }
                
                // Check if we need to split into a new embed
                if (embed.toJSON().fields?.length > 0 && 
                    (JSON.stringify(embed.toJSON()).length + lineSection.length > maxEmbedLength - 2000)) {
                    embeds.push(embed);
                    embed = new EmbedBuilder()
                        .setColor(0x0052A5)
                        .setTitle(`${title} (Continuación)`)
                        .setTimestamp();
                }
                
                // Add line section as a field
                embed.addFields({
                    name: '\u200B', // Zero-width space
                    value: lineSection,
                    inline: false
                });
            });
            
            return embed;
        };
        
        // Create elevator embed if there are elevator changes
        if (elevators.length > 0) {
            const elevatorEmbed = createEquipmentEmbed(elevators, '♿ Resumen de Ascensores');
            if (elevatorEmbed) embeds.push(elevatorEmbed);
        }
        
        // Create escalator embed if there are escalator changes
        if (escalators.length > 0) {
            const escalatorEmbed = createEquipmentEmbed(escalators, '♿ Resumen de Escaleras Mecánicas');
            if (escalatorEmbed) embeds.push(escalatorEmbed);
        }
        
        return embeds;
    }
    
    // Helper method to split long strings into chunks
    chunkArray(str, size) {
        const chunks = [];
        for (let i = 0; i < str.length; i += size) {
            chunks.push(str.substring(i, i + size));
        }
        return chunks;
    }
    
    async formatTelegramMessages(changes) {
        if (!changes || changes.length === 0) return [];

        const metro = await getMetroCore();
        const messages = [];
        let currentMessage = '♿ *Actualización de Accesibilidad* ♿\n\n';
        
        // Group changes by line → station → equipment type
        const groupedChanges = this.groupChanges(changes, metro);

        for (const [lineDisplay, stations] of Object.entries(groupedChanges)) {
            let lineSection = `*${lineDisplay}*\n`;
            
            for (const [stationName, equipmentTypes] of Object.entries(stations)) {
                let stationSection = `*${stationName}* (${Object.values(equipmentTypes).flat().length} cambios)\n`;
                
                for (const [equipType, equipChanges] of Object.entries(equipmentTypes)) {
                    let typeSection = `_${equipType}_\n`;
                    
                    for (const change of equipChanges) {
                        const changeText = this.formatChangeText(change);
                        
                        // Check if adding this would exceed Telegram's 4096 character limit
                        if (currentMessage.length + lineSection.length + stationSection.length + 
                            typeSection.length + changeText.length > 4000) {
                            // Finalize current message
                            currentMessage += `\n_Actualizado: ${this.timeHelpers.formatDateTime()}_`;
                            messages.push(currentMessage);
                            
                            // Start new message
                            currentMessage = '♿ *Actualización de Accesibilidad* ♿ (cont.)\n\n';
                            lineSection = `*${lineDisplay}*\n`;
                            stationSection = `*${stationName}* (${Object.values(equipmentTypes).flat().length} cambios)\n`;
                            typeSection = `_${equipType}_\n`;
                        }
                        
                        typeSection += changeText;
                    }
                    
                    stationSection += typeSection + '\n';
                }
                
                lineSection += stationSection + '\n';
            }
            
            currentMessage += lineSection;
        }
        
        // Add final message if it has content
        if (currentMessage.length > 50) { // More than just the header
            currentMessage += `\n_Actualizado: ${this.timeHelpers.formatDateTime()}_`;
            messages.push(currentMessage);
        }
        
        return messages;
    }

    async formatDiscordEmbeds(changes) {
        if (!changes || changes.length === 0) return [];

        const metro = await getMetroCore();
        const embeds = [];
        
        // Group changes by line → station → equipment type
        const groupedChanges = this.groupChanges(changes, metro);

        let currentEmbed = new EmbedBuilder()
            .setColor(0x0052A5)
            .setTitle(`${metroConfig.accessibility.logo} Actualización de Accesibilidad`)
            .setTimestamp();
        
        for (const [lineDisplay, stations] of Object.entries(groupedChanges)) {
            let lineField = {
                name: lineDisplay,
                value: '',
                inline: false
            };
            
            for (const [stationName, equipmentTypes] of Object.entries(stations)) {
                let stationSection = `**${stationName}** (${Object.values(equipmentTypes).flat().length} cambios)\n`;
                
                for (const [equipType, equipChanges] of Object.entries(equipmentTypes)) {
                    let typeSection = `*${equipType}*\n`;
                    
                    for (const change of equipChanges) {
                        typeSection += this.formatChangeText(change);
                    }
                    
                    stationSection += typeSection + '\n';
                }
                
                // Check if adding this station would exceed field limit (1024 chars)
                if (lineField.value.length + stationSection.length > 1000) {
                    // Add current line field to embed
                    if (lineField.value) {
                        currentEmbed.addFields(lineField);
                    }
                    
                    // Check if embed is getting too big (fields + title = ~6000 chars)
                    if (currentEmbed.toJSON().fields?.length >= 5 || 
                        JSON.stringify(currentEmbed.toJSON()).length > 5500) {
                        embeds.push(currentEmbed);
                        currentEmbed = new EmbedBuilder()
                            .setColor(0x0052A5)
                            .setTitle(`${metroConfig.accessibility.logo} Actualización de Accesibilidad`)
                            .setTimestamp();
                    }
                    
                    // Start new line field
                    lineField = {
                        name: lineDisplay,
                        value: stationSection,
                        inline: false
                    };
                } else {
                    lineField.value += stationSection;
                }
            }
            
            // Add remaining line field
            if (lineField.value) {
                currentEmbed.addFields(lineField);
            }
        }
        
        // Add final embed if it has content
        if (currentEmbed.toJSON().fields?.length > 0) {
            embeds.push(currentEmbed);
        }
        
        return embeds;
    }

    groupChanges(changes, metro) {
        return changes.reduce((acc, change) => {
            const stationCode = change.equipmentId.split('-')[0];
            const station = Object.values(metro._staticData.stations).find(s => s.code === stationCode);
            
            const lineNumber = station?.line || 'Desconocida';
            const lineKey = station?.line ? `l${station.line}` : 'unknown';
            const lineEmoji = metroConfig.linesEmojis[lineKey] || '';
            const lineDisplay = lineEmoji ? `${lineEmoji} Línea ${lineNumber}` : `Línea ${lineNumber}`;
            const stationName = station?.displayName || stationCode;
            const equipType = change.current?.tipo || change.previous?.tipo || 'Equipo';
            
            if (!acc[lineDisplay]) acc[lineDisplay] = {};
            if (!acc[lineDisplay][stationName]) acc[lineDisplay][stationName] = {};
            if (!acc[lineDisplay][stationName][equipType]) acc[lineDisplay][stationName][equipType] = [];
            
            acc[lineDisplay][stationName][equipType].push(change);
            return acc;
        }, {});
    }

    formatChangeText(change) {
        let text = '';
        if (change.type === 'new') {
            text = `➕ Nuevo: ${change.current.texto} - `;
            text += `Estado: ${change.current.estado === 1 ? '✅ Operativo' : '❌ Fuera de servicio'}`;
        } else if (change.type === 'state_change') {
            text = `🔄 Cambio: ${change.current.texto}\n`;
            text += `- De: ${change.previous.estado === 1 ? '✅ Operativo' : '❌ Fuera de servicio'}\n`;
            text += `- A: ${change.current.estado === 1 ? '✅ Operativo' : '❌ Fuera de servicio'}`;
        } else if (change.type === 'removed') {
            text = `➖ Eliminado: ${change.previous.texto || 'Equipo desconocido'}`;
        }
        return text + '\n'; // Ensure each change ends with a newline
    }
}

module.exports = new AccessibilityChangeDetector();
