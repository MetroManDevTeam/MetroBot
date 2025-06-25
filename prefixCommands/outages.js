const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const moment = require('moment');
require('moment/locale/es'); // For Spanish date formatting

module.exports = {
    name: 'outages',
    description: '🚇 Muestra ascensores/escaleras fuera de servicio por un período específico',
    usage: 'm!outages <tipo> <período>\n' +
           'Tipos:\n' +
           '- ascensores: Solo ascensores\n' +
           '- escaleras: Solo escaleras mecánicas\n' +
           '- todos: Ambos tipos\n\n' +
           'Períodos:\n' +
           '- 1d: 1 día\n' +
           '- 1s: 1 semana\n' +
           '- 2s: 2 semanas\n' +
           '- 1m: 1 mes\n' +
           '- 3m: 3 meses\n' +
           '- 6m: 6 meses\n' +
           '- 1a: 1 año',
    aliases: ['fuera-servicio', 'outage-report'],
    category: 'info',
    cooldown: 30,
    permissions: [PermissionsBitField.Flags.Administrator],

    async execute(message, args) {
        try {
            // Check permissions (optional - remove if you want it public)
            if (!message.member.permissions.has(this.permissions)) {
                return message.reply('🔒 Necesitas permisos de administrador para usar este comando.');
            }

            if (args.length < 2) return this.showHelp(message);

            const [equipmentType, period] = args;
            
            // Validate equipment type
            const validTypes = ['ascensores', 'escaleras', 'todos'];
            if (!validTypes.includes(equipmentType.toLowerCase())) {
                return message.reply('❌ Tipo de equipo no válido. Usa "ascensores", "escaleras" o "todos".');
            }

            // Validate and parse period
            const periodData = this.parsePeriod(period.toLowerCase());
            if (!periodData) {
                return message.reply('❌ Período no válido. Usa 1d, 1s, 2s, 1m, 3m, 6m o 1a.');
            }

            // Show loading message
            const loadingMsg = await message.reply('🔄 Consultando datos de accesibilidad...');

            try {
                // Fetch data from Ariel API
                const apiData = await this.fetchAccessibilityData();
                
                // Filter equipment based on type and outage duration
                const outages = this.findLongTermOutages(apiData, equipmentType, periodData.days);
                
                // Create and send embed
                const embed = this.createOutageEmbed(outages, equipmentType, periodData);
                await loadingMsg.edit({ content: ' ', embeds: [embed] });
                
            } catch (error) {
                console.error('Error fetching outage data:', error);
                await loadingMsg.edit('❌ Error al obtener datos de accesibilidad. Por favor intenta más tarde.');
            }

        } catch (error) {
            console.error('Error in outages command:', error);
            return this.handleError(message, error);
        }
    },

    parsePeriod(periodStr) {
        const periods = {
            '1d': { days: 1, label: '1 día' },
            '1s': { days: 7, label: '1 semana' },
            '2s': { days: 14, label: '2 semanas' },
            '1m': { days: 30, label: '1 mes' },
            '3m': { days: 90, label: '3 meses' },
            '6m': { days: 180, label: '6 meses' },
            '1a': { days: 365, label: '1 año' }
        };
        return periods[periodStr];
    },

    async fetchAccessibilityData() {
        const API_URL = process.env.ACCESSARIEL; // Same as used in AccessibilityChangeDetector
        if (!API_URL) throw new Error('ACCESSARIEL environment variable not set');
        
        const response = await axios.get(API_URL);
        return response.data;
    },

    findLongTermOutages(apiData, equipmentType, minOutageDays) {
        const now = moment();
        const results = [];
        
        for (const [equipId, equipData] of Object.entries(apiData)) {
            // Skip if no historical data
            if (!equipData.historico) continue;
            
            // Filter by equipment type
            const isElevator = equipData.tipo?.toLowerCase().includes('ascensor');
            const isEscalator = equipData.tipo?.toLowerCase().includes('escalera');
            
            if (equipmentType === 'ascensores' && !isElevator) continue;
            if (equipmentType === 'escaleras' && !isEscalator) continue;
            
            // Get all historical entries where status was 0 (out of service)
            const outageEntries = Object.entries(equipData.historico)
                .filter(([_, status]) => status === 0)
                .sort((a, b) => moment(b[0]).valueOf() - moment(a[0]).valueOf());
                
            if (outageEntries.length === 0) continue;
            
            // Check if the most recent status is 0 (currently out)
            const currentStatus = equipData.estado;
            if (currentStatus !== 0) continue;
            
            // Calculate duration of current outage
            const lastOperationalEntry = Object.entries(equipData.historico)
                .filter(([_, status]) => status === 1)
                .sort((a, b) => moment(b[0]).valueOf() - moment(a[0]).valueOf())[0];
                
            const lastOperationalDate = lastOperationalEntry ? moment(lastOperationalEntry[0]) : null;
            const outageDurationDays = lastOperationalDate ? now.diff(lastOperationalDate, 'days') : Infinity;
            
            if (outageDurationDays >= minOutageDays) {
                results.push({
                    id: equipId,
                    station: equipData.estacion,
                    type: equipData.tipo,
                    description: equipData.texto,
                    lastOperational: lastOperationalDate?.format('DD/MM/YYYY') || 'Desconocido',
                    daysOut: outageDurationDays,
                    historicalOutages: outageEntries.length
                });
            }
        }
        
        // Sort by longest outage first
        return results.sort((a, b) => b.daysOut - a.daysOut);
    },

    createOutageEmbed(outages, equipmentType, periodData) {
        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange for warning
            .setTitle(`🚇 Equipos fuera de servicio más de ${periodData.label}`)
            .setDescription(`**Tipo:** ${equipmentType === 'todos' ? 'Ascensores y escaleras' : equipmentType}`)
            .setTimestamp();
            
        if (outages.length === 0) {
            embed.setDescription(embed.data.description + '\n\n✅ No se encontraron equipos fuera de servicio por este período.');
            return embed;
        }
        
        // Group by line (assuming station codes start with line prefix like "LEN" for L1)
        const groupedByLine = outages.reduce((acc, outage) => {
            const linePrefix = outage.station.substring(0, 1) === 'L' ? 
                outage.station.substring(0, 3) : 
                `L${outage.station.substring(1, 2)}`;
                
            const lineKey = `Línea ${linePrefix.replace('L', '')}`;
            
            if (!acc[lineKey]) acc[lineKey] = [];
            acc[lineKey].push(outage);
            return acc;
        }, {});
        
        // Add fields for each line
        for (const [line, lineOutages] of Object.entries(groupedByLine)) {
            let fieldValue = '';
            
            for (const outage of lineOutages) {
                const stationName = outage.station; // You might want to map to full station names
                const entry = `• **${outage.type}**: ${outage.description}\n` +
                             `⏳ Fuera desde: ${outage.lastOperational} (${outage.daysOut} días)\n\n`;
                             
                if (fieldValue.length + entry.length > 1000) {
                    // Split long fields
                    embed.addFields({ name: line, value: fieldValue, inline: false });
                    fieldValue = entry;
                } else {
                    fieldValue += entry;
                }
            }
            
            if (fieldValue) {
                embed.addFields({ name: line, value: fieldValue, inline: false });
            }
        }
        
        embed.setFooter({ text: `Total: ${outages.length} equipos fuera de servicio` });
        return embed;
    },

    showHelp(message) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🚇 Ayuda de Reporte de Fallas Prolongadas')
            .setDescription(this.usage)
            .addFields(
                { name: '📝 Ejemplos', value: 
                    '```\n' +
                    'm!outages ascensores 1s\n' +
                    'm!outages escaleras 1m\n' +
                    'm!outages todos 3m\n' +
                    '```'
                }
            );

        return message.reply({ embeds: [helpEmbed] });
    },

    handleError(message, error) {
        console.error('[Outages Error]', error);
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription(`❌ Error al procesar el comando: ${error.message}`)
            ]
        });
    }
};
