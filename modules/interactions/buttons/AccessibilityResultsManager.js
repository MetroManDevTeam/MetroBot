
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BaseButton = require('./templates/baseButton');
const interactionStore = require('../utils/interactionStore');
const config = require('../../../config/metro/metroConfig');
const styles = require('../../../config/metro/styles.json');

class AccessibilityResultsManager extends BaseButton {
    constructor() {
        super({
            customIdPrefix: 'accessibilityResults',
            style: ButtonStyle.Secondary
        });

        this._cachingInProgress = new Set();
        this.cacheDuration = 15 * 60 * 1000;
        this.MAX_FIELD_LENGTH = 1024; // Discord's embed field limit
        this.MAX_STATIONS_PER_PAGE = 3; // Base value, will adjust dynamically
        this.MAX_CONTENT_PER_PAGE = 6000; // Approximate Discord embed total content limit
    }

    async build(query, filters, results, userId) {
        const cacheKey = this._getCacheKey(query, userId);
        
        // Pre-process all results to calculate optimal pagination
        const processedResults = results.map(station => {
            const accessibilityInfo = this._processAccessibilityData(station, filters);
            const stationName = this._cleanStationName(station.name);
            
            return {
                ...station,
                processedName: stationName,
                processedAccessibility: accessibilityInfo,
                parts: this._splitLongAccessibilityText(accessibilityInfo),
                totalParts: 1 // Will be updated in calculatePagination
            };
        });

        // Calculate optimal pagination
        const paginationPlan = this._calculatePagination(processedResults);
        const totalPages = paginationPlan.length;

        const cacheData = {
            query,
            filters,
            rawResults: results,
            processedResults,
            userId,
            currentPage: 1,
            totalPages,
            paginationPlan,
            timestamp: Date.now()
        };

        interactionStore.set(cacheKey, cacheData, this.cacheDuration);
        return this._createResultsMessage(cacheData);
    }

    _splitLongAccessibilityText(text) {
        if (!text || text.length <= this.MAX_FIELD_LENGTH) {
            return [text];
        }

        const parts = [];
        const paragraphs = text.split('\n\n'); // Split by paragraphs first
        let currentPart = '';
        
        for (const paragraph of paragraphs) {
            if (currentPart.length + paragraph.length > this.MAX_FIELD_LENGTH) {
                parts.push(currentPart);
                currentPart = paragraph + '\n\n';
            } else {
                currentPart += paragraph + '\n\n';
            }
        }
        
        if (currentPart) {
            parts.push(currentPart.trim());
        }
        
        return parts;
    }

    _calculatePagination(results) {
        const paginationPlan = [];
        let currentPage = [];
        let currentPageLength = 0;

        for (const station of results) {
            // Calculate total length for this station including all parts
            const stationLength = station.processedName.length + 
                station.parts.reduce((sum, part) => sum + part.length, 0);

            // If adding this station would exceed limits, finalize current page
            if (currentPage.length > 0 && 
                (currentPageLength + stationLength > this.MAX_CONTENT_PER_PAGE || 
                 currentPage.length >= this.MAX_STATIONS_PER_PAGE)) {
                paginationPlan.push([...currentPage]);
                currentPage = [];
                currentPageLength = 0;
            }

            // Update station's total parts count
            station.totalParts = station.parts.length;
            
            currentPage.push(station);
            currentPageLength += stationLength;
        }

        // Add the last page if it has content
        if (currentPage.length > 0) {
            paginationPlan.push(currentPage);
        }

        return paginationPlan;
    }

    _createResultsMessage(cacheData) {
        const { query, filters, paginationPlan, currentPage, totalPages } = cacheData;
        const pageStations = paginationPlan[currentPage - 1] || [];

        const embed = new EmbedBuilder()
            .setTitle(`${config.accessibility.logo} Estaciones con accesibilidad: ${query === 'Operativa' ? '🟢 Operativas' : '🔴 Con problemas'}`)
            .setColor(query === 'Operativa' ? '#2ECC71' : '#E74C3C')
            .setFooter({ 
                text: `Página ${currentPage}/${totalPages} • ${cacheData.processedResults.length} estaciones encontradas`,
                iconURL: 'https://media.discordapp.net/attachments/792250794296606743/900913086343548958/unknown.png'
            });

        // Show applied filters
        if (filters.ascensor || filters.escaleraMecanica || filters.operativo || filters.fueraDeServicio) {
            const filterParts = [];
            if (filters.ascensor) filterParts.push(`${config.accessibility.ascensor} Ascensores`);
            if (filters.escaleraMecanica) filterParts.push(`${config.accessibility.escalera} Escaleras Mecánicas`);
            if (filters.operativo) filterParts.push(`🟢 Operativos`);
            if (filters.fueraDeServicio) filterParts.push(`🔴 Fuera de servicio`);
            
            embed.setDescription(`**Filtros aplicados:** ${filterParts.join(' • ')}`);
        }

        // Group stations by line
        const lineGroups = {};
        pageStations.forEach((station, stationIndex) => {
            const lineKey = `${station.line}`;
            if (!lineGroups[lineKey]) lineGroups[lineKey] = [];
            
            // Add station name (only once per station)
            if (stationIndex === 0 || pageStations[stationIndex-1].id !== station.id) {
                lineGroups[lineKey].push(`**${station.processedName}**`);
            }
            
            // Add all parts of the station's accessibility info
            station.parts.forEach((part) => {
                lineGroups[lineKey].push(part);
            });
        });

        // Add fields for each line group
        Object.entries(lineGroups).forEach(([line, content]) => {
            const lineKey = line.toLowerCase();
            const lineEmoji = config.linesEmojis[lineKey] || '🚇';
            const lineNumber = line.replace(/[^\d]/g, '');
            
            // Join all content for this line and split if still too long
            const fullContent = content.join('\n\n');
            if (fullContent.length <= this.MAX_FIELD_LENGTH) {
                embed.addFields({
                    name: `${lineEmoji} Línea ${lineNumber}`,
                    value: fullContent,
                    inline: true
                });
            } else {
                // Split into multiple fields if needed
                let partNumber = 1;
                for (let i = 0; i < content.length; i++) {
                    const chunk = content[i];
                    embed.addFields({
                        name: `${lineEmoji} Línea ${lineNumber}${partNumber > 1 ? ` (Parte ${partNumber})` : ''}`,
                        value: chunk,
                        inline: true
                    });
                    partNumber++;
                }
            }
        });

        return {
            embeds: [embed],
            components: this._createPaginationButtons(cacheData)
        };
    }

    _processAccessibilityData(station, filters = {}) {
        
        //console.log(station) 
        
        
        if (station.isNewFormat) {
            return this._formatNewAccessibilityData(station.stationData, filters);
                                                
        }
        return this._processLegacyAccessibilityText(station.accessibility, filters);
    }



    _formatNewAccessibilityData(station, filters = {}) {
   

        console.log("Filtros ", filters) 
        
        const accData = station.accessDetails;
    const lines = [];
    const statusFilter = this._getStatusFilter(filters);
    const hasEquipmentFilter = filters.ascensor || filters.escaleraMecanica;

    // Only show accesses if no filters are applied
    if (accData.accesses.length > 0 && !statusFilter && !hasEquipmentFilter) {
        lines.push('***Accesos:***');
        accData.accesses.forEach(access => {
            let line = `- ${access.name}`;
            if (access.description) line += ` (${access.description})`;
            lines.push(line);
        });
    }


        // Process elevators
    if ((filters.ascensor || !hasEquipmentFilter) && accData.elevators.length > 0) {
        const filteredElevators = accData.elevators.filter(elevator => {
            // If status filter is active, must match status
            const statusMatches = !statusFilter || 
                                (elevator.status && this._matchesStatusFilter(elevator.status, statusFilter));
            return statusMatches;
        });

        if (filteredElevators.length > 0) {
            lines.push('***Ascensores:***');
            filteredElevators.forEach(elevator => {
                let line = " -" + elevator.fullPath;
                if (elevator.status) line += ` [${this._formatStatus(elevator.status)}]`;
                lines.push(line);
            });
        }
    }

    // Process escalators
    if ((filters.escaleraMecanica || !hasEquipmentFilter) && accData.escalators.length > 0) {
        const filteredEscalators = accData.escalators.filter(escalator => {
            // If status filter is active, must match status
            const statusMatches = !statusFilter || 
                               (escalator.status && this._matchesStatusFilter(escalator.status, statusFilter));
            return statusMatches;
        });

        if (filteredEscalators.length > 0) {
            lines.push('***Escaleras Mecánicas:***');
            filteredEscalators.forEach(escalator => {
                let line = `- ${escalator.fullPath}`;
                if (escalator.status) line += ` [${this._formatStatus(escalator.status)}]`;
                lines.push(line);
            });
        }
    }

    return lines.length > 0 ? lines.join('\n') : 'No hay equipos que coincidan con los filtros aplicados';
}

_getStatusFilter(filters) {
    // Only return a filter if exactly one status is selected
    if (filters.operativo && !filters.fueraDeServicio) return 'operativa';
    if (filters.fueraDeServicio && !filters.operativo) return 'fuera de servicio';
    return null;
}
    

    _matchesStatusFilter(actualStatus, filterStatus) {
        const normalizedActual = actualStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const normalizedFilter = filterStatus.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        return normalizedActual.includes(normalizedFilter);
    }

    _formatStatus(status) {
        const statusMap = {
            'operativo': '🟢 Operativo',
            'fuera de servicio': '🔴 Fuera de servicio',
            'en reparación': '🟡 En reparación',
            'limitado': '🟠 Limitado'
        };
        return statusMap[status.toLowerCase()] || status;
    }

    _processLegacyAccessibilityText(text, filters = {}) {
        if (!text) return 'No hay información de accesibilidad';
        
        const statusFilter = this._getStatusFilter(filters);
        const lines = text.split('\n');
        const filteredLines = [];
        let includeEquipment = true;

        for (const line of lines) {
            let processedLine = line.trim();
            const lowerLine = processedLine.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Skip if this is equipment and doesn't match status filter
            if (statusFilter) {
                const isEquipmentLine = lowerLine.includes('ascensor') || lowerLine.includes('escala mecánica') || lowerLine.includes('escalera mecánica');
                if (isEquipmentLine && !lowerLine.includes(statusFilter)) {
                    continue;
                }
            }

            // Handle letter indicators
            processedLine = processedLine.replace(/\(([a-z])\)/gi, (match, letter) => {
                const upperLetter = letter.toUpperCase();
                return String.fromCodePoint(0x1F170 + upperLetter.charCodeAt(0) - 65) + (upperLetter > 'A' ? '' : '️');
            });

            // Add appropriate icons
            if (lowerLine.includes('escala mecánica') || lowerLine.includes('escalera mecánica')) {
                if (filters.escaleraMecanica || (!filters.ascensor && !filters.escaleraMecanica)) {
                    processedLine = `${config.accessibility.escalera} ${processedLine}`;
                } else {
                    continue;
                }
            }
            
            if (lowerLine.includes('todos los ascensores disponibles') || 
                lowerLine.match(/todos los ascensores (operativos|disponibles)/)) {
                if (filters.ascensor || (!filters.ascensor && !filters.escaleraMecanica)) {
                    processedLine = `${config.accessibility.estado.ope} ${processedLine}`;
                } else {
                    continue;
                }
            }
            
            if (lowerLine.includes('fuera de servicio') || 
                lowerLine.includes('no disponible') ||
                lowerLine.includes('no operativo')) {
                if ((filters.ascensor || filters.escaleraMecanica || (!filters.ascensor && !filters.escaleraMecanica)) &&
                    (!statusFilter || lowerLine.includes(statusFilter))) {
                    processedLine = `${config.accessibility.estado.fes} ${processedLine}`;
                } else {
                    continue;
                }
            }
        
            if (lowerLine.includes('salida de estación') || 
                lowerLine.includes('a nivel de vereda') || 
                lowerLine.includes('a nivel de calle')) {
                processedLine = `${config.accessibility.salida} ${processedLine}`;
            }
        
            if (lowerLine.includes('ascensor') || lowerLine.includes('ascensores')) {
                if (filters.ascensor || (!filters.ascensor && !filters.escaleraMecanica)) {
                    if (lowerLine.includes('al exterior') || lowerLine.includes('desde anden') || lowerLine.includes('desde andenes')) {
                        processedLine = `${config.accessibility.ascensor} ${processedLine}`;
                    } else {
                        processedLine = `${config.accessibility.ascensor} ${processedLine}`;
                    }
                } else {
                    continue;
                }
            }
            
            filteredLines.push(processedLine);
        }
        
        return filteredLines.join('\n');
    }

    _cleanStationName(name) {
        return name.replace(/\bl[1-9]a?\b\s*/gi, "")
                   .replace("Línea", "")
                   .replace(/\s+/g, ' ')
                   .trim();
    }

    _createPaginationButtons(cacheData) {
        const { currentPage, totalPages, query, userId } = cacheData;
        
        if (totalPages <= 1) return [];

        const row = new ActionRowBuilder();

        // Previous Button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessibilityResultsPrev:${this.customIdPrefix}:${query}:${userId}`)
                .setLabel('◀')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 1)
        );

        // Page Counter
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessibilityResultsPage:${this.customIdPrefix}:${query}:${userId}:${currentPage}`)
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        // Next Button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`accessibilityResultsNext:${this.customIdPrefix}:${query}:${userId}`)
                .setLabel('▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages)
        );

        return [row];
    }

    async handleInteraction(interaction, metadata) {
        const [action, prefix, query, userId, page] = interaction.customId.split(':');
        const cacheKey = this._getCacheKey(query, userId);
        let cacheData = interactionStore.get(cacheKey);

        if (!cacheData) {
            return interaction.editReply({
                content: 'Esta búsqueda ha expirado. Por favor realiza una nueva búsqueda.',
                ephemeral: true
            });
        }

        // Update page based on interaction
        switch(action) {
            case 'accessibilityResultsPrev':
                cacheData.currentPage = Math.max(1, cacheData.currentPage - 1);
                break;
            case 'accessibilityResultsNext':
                cacheData.currentPage = Math.min(cacheData.totalPages, cacheData.currentPage + 1);
                break;
            case 'accessibilityResultsPage':
                cacheData.currentPage = parseInt(page) || 1;
                break;
        }

        // Update cache
        interactionStore.set(cacheKey, {
            ...cacheData,
            timestamp: Date.now()
        }, this.cacheDuration);

        try {
            await interaction.editReply(this._createResultsMessage(cacheData));
        } catch (error) {
            console.error('Error updating accessibility results:', error);
            if ([10062, 10008].includes(error.code)) {
                await interaction.editReply({
                    content: 'This interaction expired. Please use the command again.',
                    ephemeral: true,
                    flags: 64
                });
            } else {
                await interaction.followUp({
                    content: 'Ocurrió un error al actualizar los resultados.',
                    ephemeral: true
                });
            }
        }
    }

    _getCacheKey(query, userId) {
        return `accessibility_results:${userId}:${this._normalizeQuery(query)}`;
    }

    _normalizeQuery(query) {
        return query.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }
}

module.exports = AccessibilityResultsManager;
