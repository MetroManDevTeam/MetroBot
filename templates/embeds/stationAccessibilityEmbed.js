 // templates/embeds/stationAccessibilityEmbed.js
const { EmbedBuilder } = require('discord.js');
const BaseEmbed = require('./baseEmbed');
const styles = require('../../config/metro/styles.json' )
const config = require('../../config/metro/metroConfig' ) 

class StationAccessibilityEmbed extends BaseEmbed {
    constructor(metroCore) {
        super(metroCore);
    }

    create(station, subView = 'acc_summary') {
        switch(subView) {
            case 'acc_elevators':
                return this._createElevatorsEmbed(station);
            case 'acc_escalators':
                return this._createEscalatorsEmbed(station);
            case 'acc_accesses':
                return this._createAccessesEmbed(station);
            case 'acc_summary':
            default:
                return this._createSummaryEmbed(station);
        }
    }

    _createSummaryEmbed(station) {
        const embed = new EmbedBuilder()
            .setTitle(`♿ ${station.displayName} - Resumen de Accesibilidad`)
            .setColor(styles.lineColors[station.line.toLowerCase()])
            //.setThumbnail(this.metro.getLineImage(station.line));

        if (station.accessDetails) {
            let description = `**Estación:** ${station.accessDetails.station || station.displayName}\n`;
            description += `**Línea:** ${config.linesEmojis[station.line.toLowerCase()]} ${station.accessDetails.line || station.line}\n\n`;

            // Access Status Summary
            description += this._getAccessStatusSummary(station.accessDetails);
            
            // Last Updated
            if (station.accessDetails.lastUpdated) {
                description += `\n📅 **Actualizado:** ${new Date(station.accessDetails.lastUpdated).toLocaleString()}`;
            }

            embed.setDescription(description);
        } else if (station.accessibility) {
            const processedText = this._processAccessibilityText(station.accessibility);
            embed.setDescription(processedText.join('\n'));
        } else {
            embed.setDescription('Información de accesibilidad no disponible');
        }

        return embed;
    }

    _createElevatorsEmbed(station) {
       
        console.log(styles) 
        
        const embed = new EmbedBuilder()
            .setTitle(`♿ ${station.displayName} - Ascensores`)
            .setColor(styles.lineColors[station.line.toLowerCase()]) 

        if (station.accessDetails?.elevators?.length > 0) {
            const elevatorList = station.accessDetails.elevators.map(elev => 
                `${this._getElevatorStatusEmoji(elev.status)} **${elev.id}**\n` +
                `_${elev.fullPath}_\n` +
                //`${elev.notes ? `📝 ${elev.notes}\n` : ''}` +
                `🔄 Actualizado: ${new Date(elev.lastUpdated).toLocaleDateString()}`
            ).join('\n\n');

            embed.setDescription(elevatorList);
        } else {
            const filteredText = this._filterAccessibilityText(
                station.accessibility, 
                ['ascensor', 'ascensores', 'elevador']
            );
            embed.setDescription(filteredText || 'No hay ascensores registrados');
        }

        return embed;
    }

    _createEscalatorsEmbed(station) {
        const embed = new EmbedBuilder()
            .setTitle(`♿ ${station.displayName} - Escaleras Mecánicas`)
            .setColor(styles.lineColors[station.line.toLowerCase()])

        if (station.accessDetails?.escalators?.length > 0) {
            const escalatorList = station.accessDetails.escalators.map(esc => 
                `${this._getEscalatorStatusEmoji(esc.status)} **${esc.id}**\n` +
                `_${esc.fullPath}_\n` +
              //  `${esc.notes}\n` : ''}` +
                `🔄 Actualizado: ${new Date(esc.lastUpdated).toLocaleDateString()}`
            ).join('\n\n');

            embed.setDescription(escalatorList);
        } else {
            const filteredText = this._filterAccessibilityText(
                station.accessibility, 
                ['escalera mecánica', 'escaleras', 'escalator']
            );
            embed.setDescription(filteredText || 'No hay escaleras mecánicas registradas');
        }

        return embed;
    }

    _createAccessesEmbed(station) {
        const embed = new EmbedBuilder()
            .setTitle(`♿ ${station.displayName} - Accesos`)
            .setColor(styles.lineColors[station.line.toLowerCase()])

        if (station.accessDetails?.accesses?.length > 0) {
            const accessList = station.accessDetails.accesses.map(acc => 
                `${this._getAccessStatusEmoji(acc.status)} **${acc.name || acc.id}**\n` +
                `${acc.description}\n` +
                `${acc.notes ? `📝 ${acc.notes}\n` : ''}` +
                `🔄 Actualizado: ${new Date(acc.lastUpdated).toLocaleDateString()}`
            ).join('\n\n');

            embed.setDescription(accessList);
        } else {
            const filteredText = this._filterAccessibilityText(
                station.accessibility, 
                ['acceso', 'entrada', 'salida']
            );
            embed.setDescription(filteredText || 'No hay accesos registrados');
        }

        return embed;
    }

    _getAccessStatusSummary(accessDetails) {
        let description = '';
        
        // Elevators Summary
        if (accessDetails.elevators?.length > 0) {
            const operational = accessDetails.elevators.filter(e => e.status === 'operativa').length;
            description += `${config.accessibility.ascensor} **Ascensores:** ${operational}/${accessDetails.elevators.length} operativos\n`;
        }

        // Escalators Summary
        if (accessDetails.escalators?.length > 0) {
            const operational = accessDetails.escalators.filter(e => e.status === 'operativa').length;
            description += `${config.accessibility.escaleras} **Escaleras:** ${operational}/${accessDetails.escalators.length} operativas\n`;
        }

        // Accesses Summary
        if (accessDetails.accesses?.length > 0) {
            const open = accessDetails.accesses.filter(a => a.status === 'abierto').length;
            description += `🚪 **Accesos:** ${open}/${accessDetails.accesses.length} abiertos\n`;
        }

        // Change History
        if (accessDetails.changelistory?.length > 0) {
            const latestChange = accessDetails.changelistory
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            description += `\n📋 **Último cambio:** ${latestChange.action}\n` +
                         `👤 Por: ${latestChange.user}\n` +
                         `📅 ${new Date(latestChange.timestamp).toLocaleString()}`;
        }

        return description;
    }

    _processAccessibilityText(accessibilityText) {
        if (!accessibilityText) return ['No hay información disponible'];
        
        return accessibilityText.split('\n').map(line => {
            let processed = line
                // Replace line numbers with emojis
                .replace(/Línea (\d+[a-z]?)/gi, (_, num) => 
                    this.metro.config.linesEmojis[`l${num.toLowerCase()}`] || `Línea ${num}`)
                
                // Replace access letters with emojis
                .replace(/Acceso ([A-Z])/gi, (_, letter) => 
                    `Acceso ${String.fromCodePoint(0x1F170 + letter.charCodeAt(0) - 65)}`)
                
                // Add status emojis
                .replace(/operativa/gi, `${config.accessibility.estado.ope}  Operativa`)
                .replace(/fuera de servicio/gi, `${config.accessibility.estado.fes} Fuera de servicio`)
                .replace(/en mantención/gi, '🟡 En mantención');

            // Add elevator/escalator emojis
            if (processed.toLowerCase().includes('ascensor')) {
                processed = `${config.accessibility.ascensor} ${processed}`;
            }
            if (processed.toLowerCase().includes('escalera')) {
                processed = `${config.accessibility.escaleras} ${processed}`;
            }

            return processed;
        });
    }

    _filterAccessibilityText(text, keywords) {
        if (!text) return null;
        const processed = this._processAccessibilityText(text);
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        return processed.filter(line => 
            lowerKeywords.some(k => line.toLowerCase().includes(k))
            .join('\n') || null);
    }

    _getElevatorStatusEmoji(status) {
        return {
            'operativa' :config.accessibility.estado.ope,
            'fuera de servicio': config.accessibility.estado.fes,
            'en mantención': '🟡'
        }[status?.toLowerCase()] || '⚪';
    }

    _getEscalatorStatusEmoji(status) {
        return this._getElevatorStatusEmoji(status); // Same status system
    }

    _getAccessStatusEmoji(status) {
        return {
            abierto: '🟢',
            cerrado: '🔴',
            restringido: '🟡'
        }[status?.toLowerCase()] || '⚪';
    }
}

module.exports = StationAccessibilityEmbed;
