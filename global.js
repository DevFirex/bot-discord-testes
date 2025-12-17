require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, PermissionsBitField, MessageFlags } = require('discord.js');

const embedCache = new Map();

try {
    const safeRequire = (p) => {
        try { return require(p); } catch (err) {
            console.warn(`⚠️ Módulo não encontrado: ${p}`);
            return null;
        }
    };

    // --- IMPORTAÇÃO DE COMANDOS ---
    const embedCriarCommand = safeRequire('./comandos/embed_criar'); 
    const falarCommand = safeRequire('./comandos/falarcomando');
    const limparCommand = safeRequire('./comandos/limpar'); 
    const radioCommand = safeRequire('./comandos/radio'); 
    const painelAdminCommand = safeRequire('./comandos/paineladmin'); 

    // --- HANDLERS DE INTERAÇÃO ---
    const buttonHandler = safeRequire('./comandos/interactions/botoes');
    const modalHandler = safeRequire('./comandos/interactions/envioformulario');
    const camposHandler = safeRequire('./comandos/interactions/campos'); 
    const contadorModule = safeRequire('./comandos/interactions/contador');
    const updateMemberCounter = contadorModule?.updateMemberCounter;

    const TOKEN = process.env.DISCORD_TOKEN;
    const CLIENT_ID = process.env.CLIENT_ID; 

    const commandsToRegister = [];
    if (embedCriarCommand?.data) commandsToRegister.push(embedCriarCommand.data);
    if (falarCommand?.data) commandsToRegister.push(falarCommand.data);
    if (limparCommand?.data) commandsToRegister.push(limparCommand.data);
    if (radioCommand?.data) commandsToRegister.push(radioCommand.data);
    if (painelAdminCommand?.data) commandsToRegister.push(painelAdminCommand.data); 

    const client = new Client({ 
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers, 
            GatewayIntentBits.MessageContent, 
            GatewayIntentBits.GuildVoiceStates 
        ] 
    });

    client.on('clientReady', async () => { 
        console.log(`✅ Logado como ${client.user.tag}!`);
        const rest = new REST({ version: '10' }).setToken(TOKEN);
        
        for (const guild of client.guilds.cache.values()) {
            try {
                await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), { body: commandsToRegister });
                if (updateMemberCounter) await updateMemberCounter(client, guild);
                console.log(`✅ Setup concluído: ${guild.name}`);
            } catch (error) { console.error(`❌ Erro no Servidor ${guild.id}:`, error.message); }
        }
    });

    client.on('interactionCreate', async (interaction) => {
        // 🔒 VERIFICAÇÃO DE SEGURANÇA GLOBAL
        const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isOwner = interaction.guild?.ownerId === interaction.user.id;

        const customId = interaction.customId || '';

        // 1. COMANDOS DE BARRA (/)
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;

            // Roteamento do Painel Admin (Comando /painel)
            if (cmd === 'painel') {
                return await painelAdminCommand?.execute(interaction, client);
            }

            if (cmd === 'falar') await falarCommand?.execute(interaction);
            else if (cmd === 'embed') await embedCriarCommand?.execute(interaction, embedCache);
            else if (cmd === 'limpar') await limparCommand?.execute(interaction, embedCache);
            else if (cmd === 'radio') await radioCommand?.execute(interaction, embedCache);
            return;
        }

        // 2. SUBMISSÃO DE MODAIS
        if (interaction.isModalSubmit()) {
            // 🛠️ Roteia modais do Admin Suite
            if (customId.startsWith('admin_')) {
                return await painelAdminCommand?.execute(interaction, client);
            }

            if (customId.startsWith('modal_field_')) await camposHandler?.execute(interaction, embedCache);
            else await modalHandler?.execute(interaction, embedCache, client);
            return;
        }

        // 3. BOTÕES E MENUS
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            
            // 🛠️ Roteia botões e menus do Admin Suite
            if (customId.startsWith('admin_')) {
                // Trava de segurança para botões administrativos
                if (!isAdmin && !isOwner) {
                    return interaction.reply({ 
                        content: '❌ Você não tem permissão para usar estas funções administrativas.', 
                        flags: [MessageFlags.Ephemeral] 
                    });
                }
                return await painelAdminCommand?.execute(interaction, client);
            }

            // Roteamento padrão de Fields e Embeds
            if (customId.startsWith('btn_field_') || customId === 'select_field_manage') {
                await camposHandler?.execute(interaction, embedCache);
            } else {
                await buttonHandler?.execute(interaction, embedCache, client);
            }
        }
    });

    client.login(TOKEN);

} catch (e) {
    console.error(`❌ ERRO FATAL:`, e);
}

process.on('unhandledRejection', error => console.error(`[FATAL] Erro não tratado:`, error));
process.on('uncaughtException', error => console.error(`[CRÍTICO] Exceção:`, error));