const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');

const app = express();
const port = process.env.PORT || 3000;
const root = __dirname;
const dataDir = path.join(root, 'data');
const botDir = path.join(root, 'bot');
const logFile = path.join(root, 'logs.txt');
const configFile = path.join(dataDir, 'config.json');
const commandsFile = path.join(dataDir, 'commands.json');
const economyFile = path.join(dataDir, 'economy.json');
const usersFile = path.join(dataDir, 'users.json');
const itemsFile = path.join(dataDir, 'items.json');
const questsFile = path.join(dataDir, 'quests.json');

const ensureDir = (folder) => {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
};

ensureDir(dataDir);
ensureDir(botDir);

const loadJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Impossible de charger ${filePath}:`, error.message);
    return fallback;
  }
};

const saveJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const config = loadJson(configFile, {
  token: '',
  prefix: '',
  modules: {
    moderation: true,
    fun: true,
    utility: true,
    logs: true,
    economy: true,
  },
  stats: {
    servers: 0,
    users: 0,
    uptime: 0,
    commands: 0,
  },
  createdAt: new Date().toISOString(),
});

let commands = loadJson(commandsFile, []);
let economy = loadJson(economyFile, {
  dailyAmount: 100,
  weeklyAmount: 500,
  cooldowns: {
    daily: 86400,
    weekly: 604800,
  },
});
let users = loadJson(usersFile, {});
let items = loadJson(itemsFile, [
  { id: 'potion', name: 'Potion', price: 150, description: 'Soigne un peu votre personnage.' },
  { id: 'ticket', name: 'Ticket de loterie', price: 75, description: 'Permet de tenter votre chance.' },
]);
let quests = loadJson(questsFile, [
  { id: 'welcome', name: 'Première mission', description: 'Utilise un bot et gagne des coins.', reward: 200, condition: 'firstCommand' },
]);

let discordClient = null;
let lastLogId = 0;
const websocketClients = [];

const writeLog = (message, level = 'INFO') => {
  const entry = {
    id: ++lastLogId,
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message),
  };
  const line = `[${entry.timestamp}] [${entry.level}] ${entry.message}\n`;
  fs.appendFileSync(logFile, line, 'utf8');
  websocketClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'log', payload: entry }));
  });
  return entry;
};

const saveAll = () => {
  saveJson(configFile, config);
  saveJson(commandsFile, commands);
  saveJson(economyFile, economy);
  saveJson(usersFile, users);
  saveJson(itemsFile, items);
  saveJson(questsFile, quests);
};

const getUser = (userId) => {
  if (!users[userId]) {
    users[userId] = { id: userId, coins: 0, inventory: [], quests: [], history: [] };
  }
  return users[userId];
};

const replaceVariables = (text, interaction) => {
  if (!text || !interaction) return text;
  return text
    .replace(/{{user}}/gi, interaction.user.tag)
    .replace(/{{userId}}/gi, interaction.user.id)
    .replace(/{{guild}}/gi, interaction.guild ? interaction.guild.name : 'DM')
    .replace(/{{member}}/gi, interaction.member ? interaction.member.user.tag : '')
    .replace(/{{serverCount}}/gi, config.stats.servers)
    .replace(/{{userCount}}/gi, config.stats.users)
    .replace(/{{uptime}}/gi, `${Math.floor(process.uptime())}s`);
};

const buildSlashCommand = (command) => {
  const options = (command.options || []).map((option) => ({
    name: option.name,
    description: option.description || 'Option',
    type: option.type || 3,
    required: option.required || false,
    choices: option.choices || undefined,
  }));
  return {
    name: command.name,
    description: command.description || 'Commande personnalisée',
    options,
  };
};

const deploySlashCommands = async () => {
  if (!discordClient || !discordClient.application) {
    writeLog('Impossible de déployer les commandes : client Discord non initialisé.', 'WARN');
    return;
  }
  const enabledCommands = commands.filter((cmd) => cmd.enabled && config.modules[cmd.module] !== false);
  const payload = enabledCommands.map(buildSlashCommand);
  try {
    const rest = new REST({ version: '10' }).setToken(config.token);
    await rest.put(Routes.applicationCommands(discordClient.application.id), { body: payload });
    writeLog(`Déployé ${payload.length} slash commandes sur Discord.`, 'INFO');
    saveGeneratedBotFiles(enabledCommands);
  } catch (error) {
    writeLog(`Erreur déploiement slash commandes: ${error.message}`, 'ERROR');
  }
};

const saveGeneratedBotFiles = (enabledCommands) => {
  const generated = {
    generatedAt: new Date().toISOString(),
    token: config.token ? '***secure***' : '',
    commandCount: enabledCommands.length,
    commands: enabledCommands,
  };
  saveJson(path.join(botDir, 'generated-commands.json'), generated);
  saveJson(path.join(botDir, 'discord-config.json'), { token: config.token ? '***secure***' : '', modules: config.modules });
};

const executeCommandActions = async (interaction, command) => {
  if (!command.actions || !command.actions.length) {
    await interaction.reply({ content: 'Cette commande ne contient aucune action.', ephemeral: true });
    return;
  }
  if (command.cooldown) {
    const userData = getUser(interaction.user.id);
    if (!userData.cooldowns) userData.cooldowns = {};
    const last = userData.cooldowns[command.name] || 0;
    const now = Date.now() / 1000;
    if (last + command.cooldown > now) {
      const remaining = Math.ceil(last + command.cooldown - now);
      await interaction.reply({ content: `Veuillez patienter ${remaining}s avant de réutiliser cette commande.`, ephemeral: true });
      return;
    }
    userData.cooldowns[command.name] = now;
  }

  let replied = false;
  for (const action of command.actions) {
    const actionType = action.type;
    if (actionType === 'condition') {
      const variable = replaceVariables(action.variable || '', interaction);
      const expected = replaceVariables(action.equals || '', interaction);
      if (variable !== expected) {
        if (action.failMessage) {
          await interaction.reply({ content: replaceVariables(action.failMessage, interaction), ephemeral: true });
          replied = true;
        }
        break;
      }
      continue;
    }

    const content = replaceVariables(action.text || action.message || '', interaction);

    if (actionType === 'sendMessage') {
      if (!replied) {
        await interaction.reply({ content, ephemeral: action.ephemeral || false });
        replied = true;
      } else {
        await interaction.followUp({ content });
      }
    }

    if (actionType === 'embed') {
      const embed = new EmbedBuilder()
        .setTitle(action.title || '')
        .setDescription(content)
        .setColor(action.color || '#8d3bff');
      if (action.footer) embed.setFooter({ text: action.footer });
      if (action.thumbnailUrl) embed.setThumbnail(action.thumbnailUrl);
      if (!replied) {
        await interaction.reply({ embeds: [embed], ephemeral: action.ephemeral || false });
        replied = true;
      } else {
        await interaction.followUp({ embeds: [embed] });
      }
    }

    if (actionType === 'log') {
      writeLog(content, action.level || 'INFO');
    }

    if (actionType === 'ban' || actionType === 'kick' || actionType === 'timeout') {
      const target = interaction.options.getUser(action.target || 'target');
      const member = interaction.guild ? interaction.guild.members.cache.get(target?.id) : null;
      if (!member) {
        if (!replied) await interaction.reply({ content: 'Utilisateur introuvable.', ephemeral: true });
        replied = true;
        continue;
      }
      try {
        if (actionType === 'ban') await member.ban({ reason: action.reason || 'Action automatique' });
        if (actionType === 'kick') await member.kick(action.reason || 'Action automatique');
        if (actionType === 'timeout') await member.timeout(action.durationMs || 60000, action.reason || 'Timeout automatique');
        writeLog(`Action ${actionType} exécutée sur ${member.user.tag}`, 'WARN');
      } catch (error) {
        writeLog(`Impossible de ${actionType} l'utilisateur: ${error.message}`, 'ERROR');
      }
    }

    if (actionType === 'coins') {
      const amount = Number(action.amount || 0);
      if (amount !== 0) {
        const userData = getUser(interaction.user.id);
        userData.coins += amount;
        userData.history.push({ id: Date.now(), delta: amount, reason: action.reason || 'Commande', timestamp: new Date().toISOString() });
        saveJson(usersFile, users);
        if (!replied) {
          await interaction.reply({ content: `Vous avez reçu ${amount} coins.`, ephemeral: true });
          replied = true;
        }
      }
    }
  }

  if (!replied) {
    await interaction.reply({ content: 'Commande exécutée.', ephemeral: true });
  }
};

const startDiscordBot = async () => {
  if (!config.token) {
    writeLog('Token Discord absent. Ajoutez un token dans le panneau.', 'WARN');
    return;
  }
  if (discordClient) {
    try { await discordClient.destroy(); } catch (e) {}
    discordClient = null;
  }
  discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  discordClient.once('ready', async () => {
    writeLog(`Bot connecté en tant que ${discordClient.user.tag}`, 'INFO');
    config.stats.uptime = process.uptime();
    config.stats.servers = discordClient.guilds.cache.size;
    config.stats.users = discordClient.users.cache.size;
    saveJson(configFile, config);
    await deploySlashCommands();
    saveGeneratedBotFiles(commands.filter((cmd) => cmd.enabled && config.modules[cmd.module] !== false));
  });

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.find((cmd) => cmd.name === interaction.commandName);
    if (!command || !command.enabled) {
      await interaction.reply({ content: 'Commande désactivée ou introuvable.', ephemeral: true });
      return;
    }
    if (config.modules[command.module] === false) {
      await interaction.reply({ content: 'Ce module est désactivé.', ephemeral: true });
      return;
    }
    config.stats.commands += 1;
    saveJson(configFile, config);
    await executeCommandActions(interaction, command);
  });

  discordClient.on('error', (error) => writeLog(`Discord client error: ${error.message}`, 'ERROR'));
  discordClient.on('disconnect', () => writeLog('Discord client déconnecté.', 'WARN'));
  await discordClient.login(config.token);
};

const reloadCommands = () => {
  commands = loadJson(commandsFile, []);
  saveJson(commandsFile, commands);
  deploySlashCommands();
};

const reloadConfig = () => {
  const updated = loadJson(configFile, config);
  config.modules = updated.modules || config.modules;
  config.token = updated.token || config.token;
  config.stats = updated.stats || config.stats;
  saveJson(configFile, config);
  if (config.token) startDiscordBot();
};

const appLogger = (req, res, next) => {
  writeLog(`[API] ${req.method} ${req.originalUrl}`, 'DEBUG');
  next();
};

app.use(cors());
app.use(bodyParser.json());
app.use(appLogger);
app.get('/api/config', (req, res) => res.json({ config: { ...config, token: config.token ? '***hidden***' : '' }, modules: config.modules }));
app.post('/api/config/token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token manquant.' });
  config.token = token;
  saveJson(configFile, config);
  saveGeneratedBotFiles([]);
  startDiscordBot().catch((error) => writeLog(`Échec de démarrage du bot: ${error.message}`, 'ERROR'));
  res.json({ success: true });
});
app.post('/api/config/modules', (req, res) => {
  const { modules: incoming } = req.body;
  if (!incoming) return res.status(400).json({ error: 'Modules manquants.' });
  config.modules = { ...config.modules, ...incoming };
  saveJson(configFile, config);
  deploySlashCommands();
  res.json({ success: true, modules: config.modules });
});

app.get('/api/commands', (req, res) => res.json(commands));
app.post('/api/commands', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.name) return res.status(400).json({ error: 'Commande invalide.' });
  const index = commands.findIndex((command) => command.name === payload.name);
  if (index >= 0) {
    commands[index] = { ...commands[index], ...payload };
  } else {
    commands.push({ ...payload, enabled: payload.enabled !== false, module: payload.module || 'utility' });
  }
  saveJson(commandsFile, commands);
  deploySlashCommands();
  res.json({ success: true, commands });
});
app.delete('/api/commands/:name', (req, res) => {
  commands = commands.filter((command) => command.name !== req.params.name);
  saveJson(commandsFile, commands);
  deploySlashCommands();
  res.json({ success: true, commands });
});
app.post('/api/commands/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Ordre invalide.' });
  commands = order.map((name) => commands.find((cmd) => cmd.name === name)).filter(Boolean);
  saveJson(commandsFile, commands);
  res.json({ success: true, commands });
});

app.get('/api/economy', (req, res) => res.json({ economy, items, quests, users }));
app.post('/api/economy/item', (req, res) => {
  const item = req.body;
  if (!item || !item.id) return res.status(400).json({ error: 'Item invalide.' });
  const index = items.findIndex((i) => i.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
  saveJson(itemsFile, items);
  res.json({ success: true, items });
});
app.delete('/api/economy/item/:id', (req, res) => {
  items = items.filter((item) => item.id !== req.params.id);
  saveJson(itemsFile, items);
  res.json({ success: true, items });
});
app.post('/api/economy/quest', (req, res) => {
  const quest = req.body;
  if (!quest || !quest.id) return res.status(400).json({ error: 'Quest invalide.' });
  const index = quests.findIndex((q) => q.id === quest.id);
  if (index >= 0) quests[index] = { ...quests[index], ...quest };
  else quests.push(quest);
  saveJson(questsFile, quests);
  res.json({ success: true, quests });
});
app.post('/api/economy/transaction', (req, res) => {
  const { userId, amount, reason } = req.body;
  if (!userId || typeof amount !== 'number') return res.status(400).json({ error: 'Transaction invalide.' });
  const userData = getUser(userId);
  userData.coins += amount;
  const entry = { id: Date.now(), amount, reason: reason || 'Admin', timestamp: new Date().toISOString() };
  userData.history.push(entry);
  saveJson(usersFile, users);
  res.json({ success: true, user: userData });
});
app.post('/api/users/:id/coins', (req, res) => {
  const amount = Number(req.body.amount || 0);
  const userData = getUser(req.params.id);
  userData.coins += amount;
  userData.history.push({ id: Date.now(), amount, reason: req.body.reason || 'Admin', timestamp: new Date().toISOString() });
  saveJson(usersFile, users);
  res.json({ success: true, user: userData });
});
app.get('/api/users/:id', (req, res) => {
  res.json(getUser(req.params.id));
});

app.get('/api/logs', (req, res) => {
  const raw = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
  const level = req.query.level;
  const search = req.query.search;
  let results = raw.map((line, index) => ({ id: index + 1, text: line, message: line }));
  if (level) results = results.filter((item) => item.text.includes(`[${level.toUpperCase()}]`));
  if (search) results = results.filter((item) => item.text.toLowerCase().includes(search.toLowerCase()));
  res.json(results.slice(-200));
});

const server = app.listen(port, () => {
  writeLog(`API backend démarré sur http://localhost:${port}`, 'INFO');
  if (config.token) startDiscordBot().catch((error) => writeLog(`Erreur de démarrage du bot: ${error.message}`, 'ERROR'));
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  websocketClients.push(ws);
  ws.send(JSON.stringify({ type: 'ready', payload: 'Connected to DraftBot panel WS' }));
  ws.on('close', () => {
    const index = websocketClients.indexOf(ws);
    if (index >= 0) websocketClients.splice(index, 1);
  });
});

chokidar.watch([commandsFile, configFile], { ignoreInitial: true }).on('change', (filePath) => {
  writeLog(`Fichier modifié: ${filePath}`, 'DEBUG');
  if (filePath.endsWith('commands.json')) reloadCommands();
  if (filePath.endsWith('config.json')) reloadConfig();
});
