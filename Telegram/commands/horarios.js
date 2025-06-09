const { Markup } = require('telegraf');
const TimeHelpers = require('../../modules/chronos/timeHelpers');
const metroConfig = require('../../config/metro/metroConfig');

// Spanish day names mapping
const spanishDays = {
    'weekday': 'Día hábil',
    'saturday': 'Sábado',
    'sunday': 'Domingo',
    'festive': 'Feriado'
};

// Telegram-friendly line emojis
const lineEmojis = {
    'l1': '🔴', // Red
    'l2': '🟡', // Yellow
    'l5': '🟢', // Dark Green
    'l4': '🔵', // Blue
    'l4A': '🔷', // Purple
    'l3': '🟤', // Orange
    'l6': '🟣'  // White
};

// Period configuration
const periodConfig = {
    'PUNTA': { 
        emoji: '🚨', 
        name: 'Hora Punta',
        icon: '⏰' 
    },
    'VALLE': { 
        emoji: '🟢', 
        name: 'Horario Normal',
        icon: '🟢' 
    },
    'BAJO': { 
        emoji: '🔵', 
        name: 'Horario Bajo',
        icon: '🔷' 
    },
    'NOCHE': { 
        emoji: '🌙', 
        name: 'Fuera de Servicio',
        icon: '🌃' 
    }
};

module.exports = {
    execute: async (ctx) => {
        try {
            const args = ctx.message.text.split(' ').slice(1);
            const [action] = args;

            if (!action) {
                return showMainMenu(ctx);
            }

            switch (action.toLowerCase()) {
                case 'periodo':
                case 'estado':
                    return showPeriodInfo(ctx);
                case 'regular':
                case 'horario':
                    return showRegularSchedule(ctx);
                case 'periodos':
                    return showPeriodosInfo(ctx);
                default:
                    return showMainMenu(ctx);
            }
        } catch (error) {
            console.error('Error in /horarios command:', error);
            handleError(ctx, error);
        }
    },

    registerActions: (bot) => {
        // Main menu actions
        bot.action('horarios_main', async (ctx) => {
            await ctx.answerCbQuery();
            await showMainMenu(ctx);
        });

        // Period info action
        bot.action('horarios_periodo', async (ctx) => {
            await ctx.answerCbQuery();
            await showPeriodInfo(ctx);
        });

        // Regular schedule action
        bot.action('horarios_regular', async (ctx) => {
            await ctx.answerCbQuery();
            await showRegularSchedule(ctx);
        });

        // Periodos info action
        bot.action('periodos_info', async (ctx) => {
            await ctx.answerCbQuery();
            await showPeriodosInfo(ctx);
        });
    }
};

// Main menu with summary
async function showMainMenu(ctx) {
    // Get current info for summary
    const period = TimeHelpers.getCurrentPeriod();
    const currentPeriod = periodConfig[period.type] || periodConfig.VALLE;
    const hours = TimeHelpers.getOperatingHours();
    
    let message = `🚇 <b>Menú de Horarios del Metro</b>\n\n`;
    message += `<b>Resumen Actual:</b>\n`;
    message += `• ${currentPeriod.icon} ${currentPeriod.name}\n`;
    message += `• 🕒 ${hours.opening} - ${hours.closing}\n`;
    message += `• 📅 ${spanishDays[TimeHelpers.getDayType()] || 'Día hábil'}\n\n`;
    message += `Selecciona la información que deseas ver:`;
    
    const keyboard = [
        [Markup.button.callback('⏰ Período Operacional Completo', 'horarios_periodo')],
        [Markup.button.callback('📅 Horarios Regulares', 'horarios_regular')],
        [Markup.button.callback('💰 Periodos Tarifarios', 'periodos_info')]
    ];

    if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(message, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

// Show current period info
async function showPeriodInfo(ctx) {
    try {
        // Get current period and operating info
        const period = TimeHelpers.getCurrentPeriod();
        const hours = TimeHelpers.getOperatingHours();
        const dayType = spanishDays[TimeHelpers.getDayType()] || 'Día hábil';
        
        // Get current fare based on period
        const fareKey = `t_metro_${period.type.toLowerCase()}`;
        const currentFare = metroConfig.tarifario[fareKey] || '790'; // Default to VALLE
        
        const currentPeriod = periodConfig[period.type] || periodConfig.VALLE;
        
        let message = `<b>${currentPeriod.icon} ${currentPeriod.name} ${currentPeriod.emoji}</b>\n\n`;
        message += `📅 <b>Tipo de día:</b> ${dayType}\n`;
        message += `🕒 <b>Horario:</b> ${hours.opening} - ${hours.closing}\n`;
        message += `💰 <b>Tarifa actual:</b> $${currentFare} CLP\n`;
        message += `<i>Sin contar las tarifas diferenciadas, revisa /tarifas</i>\n\n`;
        
        if (TimeHelpers.isExpressActive()) {
            message += `🚄 <b>Líneas con Ruta Expresa:</b> ${metroConfig.expressLines.map(l => lineEmojis[l]).join(' ')} ACTIVAS\n\n`;
        }
        
        message += `⏳ <b>Próximo cambio:</b> ${TimeHelpers.getNextTransition().message} a las ${TimeHelpers.getNextTransition().time}\n`;
        
        // Add extended hours notice if applicable
        if (hours.isExtended) {
            message += `\n⚠️ <b>Horario extendido:</b> Servicio hasta ${hours.extension[1]}\n`;
            message += `${metroConfig.stationIcons[5].emoji} ${metroConfig.stationIcons[5].message}`;
        }

        const keyboard = [
            [Markup.button.callback('📅 Ver Horarios Regulares', 'horarios_regular')],
            [Markup.button.callback('💰 Ver Periodos Tarifarios', 'periodos_info')],
            [Markup.button.callback('🔙 Menú Principal', 'horarios_main')]
        ];

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar información del período');
    }
}

// Show regular schedule
async function showRegularSchedule(ctx) {
    try {
        // Get schedule information
        const serviceHours = metroConfig.horario;
        const currentHours = TimeHelpers.getOperatingHours();
        
        let message = `<b>⏰ Horarios Regulares del Metro</b>\n\n`;
        message += `🚆 <b>Días Hábiles (L-V):</b> ${serviceHours.Semana[0]} - ${serviceHours.Semana[1]}\n`;
        message += `🟢 <b>Sábados:</b> ${serviceHours.Sábado[0]} - ${serviceHours.Sábado[1]}\n`;
        message += `🔵 <b>Domingos/Feriados:</b> ${serviceHours.Domingo[0]} - ${serviceHours.Domingo[1]}\n\n`;

        // Check for extended hours
        if (currentHours.isExtended) {
            const event = TimeHelpers.getEventDetails();
            message += `⚠️ <b>Horario Extendido Hoy</b>\n`;
            message += `Cierre extendido hasta: ${event?.endTime || currentHours.extension[1]}\n`;
            message += `*${event?.name || 'Evento especial'}*\n\n`;
        }

        // Add express hours information if weekday
        if (TimeHelpers.isWeekday()) {
            message += `🚄 <b>Horario Expreso (L-V)</b>\n`;
            message += `Mañana: ${metroConfig.horarioExpreso.morning[0]} - ${metroConfig.horarioExpreso.morning[1]}\n`;
            message += `Tarde: ${metroConfig.horarioExpreso.evening[0]} - ${metroConfig.horarioExpreso.evening[1]}\n`;
            message += `Líneas: ${metroConfig.expressLines.map(l => lineEmojis[l]).join(' ')}\n\n`;
        }

        message += `Horarios sujetos a cambios por eventos especiales`;

        const keyboard = [
            [Markup.button.callback('⏰ Ver Período Actual', 'horarios_periodo')],
            [Markup.button.callback('💰 Ver Periodos Tarifarios', 'periodos_info')],
            [Markup.button.callback('🔙 Menú Principal', 'horarios_main')]
        ];

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar horarios regulares');
    }
}

// Show fare periods information
async function showPeriodosInfo(ctx) {
    try {
        const currentPeriod = TimeHelpers.getCurrentPeriod();
        const periodos = metroConfig.horarioPeriodos;
        
        // Format time ranges for each period
        const formatTimeRanges = (ranges) => {
            return ranges.map(range => 
                `${range.inicio.split(':')[0]}:${range.inicio.split(':')[1]} - ${range.fin.split(':')[0]}:${range.fin.split(':')[1]}`
            ).join('\n');
        };

        let message = `⏰ <b>Periodos Tarifarios del Metro</b>\n\n`;
        
        // Current period highlight
        message += `🔄 <b>Periodo Actual:</b> ${currentPeriod.name}\n`;
        message += `🕒 ${TimeHelpers.formatTime(new Date())}\n\n`;
        
        // Punta (Peak) period
        message += `🚨 <b>Hora Punta</b>\n`;
        message += `${formatTimeRanges(periodos.PUNTA)}\n\n`;
        
        // Valle (Off-peak) period
        message += `🟢 <b>Horario Normal</b>\n`;
        message += `${formatTimeRanges(periodos.VALLE)}\n\n`;
        
        // Bajo (Low) period
        message += `🔵 <b>Horario Bajo</b>\n`;
        message += `${formatTimeRanges(periodos.BAJO)}\n\n`;
        
        // Service hours footer
        message += `📅 <b>Horarios de Servicio:</b>\n`;
        message += `L-V: ${metroConfig.horario.Semana[0]} - ${metroConfig.horario.Semana[1]}\n`;
        message += `Sáb: ${metroConfig.horario.Sábado[0]} - ${metroConfig.horario.Sábado[1]}\n`;
        message += `Dom: ${metroConfig.horario.Domingo[0]} - ${metroConfig.horario.Domingo[1]}\n\n`;
        
        // Express service info if applicable
        if (TimeHelpers.isWeekday()) {
            message += `🚄 <b>Rutas Expresas (L-V):</b>\n`;
            message += `Mañana: ${metroConfig.horarioExpreso.morning[0]} - ${metroConfig.horarioExpreso.morning[1]}\n`;
            message += `Tarde: ${metroConfig.horarioExpreso.evening[0]} - ${metroConfig.horarioExpreso.evening[1]}\n`;
            message += `Líneas: ${metroConfig.expressLines.map(l => lineEmojis[l]).join(' ')}\n\n`;
        }

        message += `ℹ️ Los periodos determinan la tarifa aplicable pero no se muestran precios aquí.`;

        const keyboard = [
            [Markup.button.callback('🔄 Actualizar', 'periodos_info')],
            [Markup.button.callback('🔙 Menú Principal', 'horarios_main')]
        ];

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            });
        } else {
            await ctx.replyWithHTML(message, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    } catch (error) {
        handleError(ctx, error, 'mostrar información de periodos');
    }
}

// Error handling function
async function handleError(ctx, error, action = 'procesar el comando') {
    console.error(`[Horarios Error] Error al ${action}:`, error);
    
    let errorMessage = `Error al ${action}: ${error.message}`;
    
    const keyboard = [
        [Markup.button.callback('🔙 Volver', 'horarios_main')]
    ];

    if (ctx.callbackQuery) {
        await ctx.editMessageText(`❌ ${errorMessage}`, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.replyWithHTML(`❌ ${errorMessage}`, {
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}
