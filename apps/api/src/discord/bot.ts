import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

const DISCORD_BOT_TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const DISCORD_CLIENT_ID = (process.env.DISCORD_CLIENT_ID || '').trim();

function log(msg: string) {
  console.log(`[Discord] ${msg}`);
}

// ─── Slash Command Definitions ──────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('devmaxx')
    .setDescription('Devmaxx game analytics for Roblox creators')
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show your game health, DAU, and latest agent impact')
    )
    .addSubcommand((sub) =>
      sub.setName('brief').setDescription('Show the latest GrowthBrief summary')
    )
    .addSubcommand((sub) =>
      sub.setName('connect').setDescription('Connect your Roblox game to Devmaxx')
    )
    .addSubcommand((sub) =>
      sub
        .setName('alerts')
        .setDescription('Toggle automatic DAU/brief alerts in this server')
        .addStringOption((opt) =>
          opt.setName('toggle').setDescription('Turn alerts on or off').setRequired(true).addChoices(
            { name: 'On', value: 'on' },
            { name: 'Off', value: 'off' }
          )
        )
    )
    .toJSON(),
];

// ─── Register Slash Commands ────────────────────────────────

async function registerCommands() {
  if (!DISCORD_CLIENT_ID || !DISCORD_BOT_TOKEN) return;

  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  try {
    log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
    log('Slash commands registered');
  } catch (err) {
    log(`Failed to register commands: ${err}`);
  }
}

// ─── Command Handlers ───────────────────────────────────────

async function handleStatus(interaction: ChatInputCommandInteraction, db: PrismaClient) {
  await interaction.deferReply();

  // Find creator linked to this Discord server
  const server = await db.discordServer.findUnique({
    where: { guildId: interaction.guildId! },
  });

  if (!server?.creatorId) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x6366f1)
          .setTitle('No game connected')
          .setDescription('Use `/devmaxx connect` to link your Roblox game to this server.')
          .setFooter({ text: 'Devmaxx - Maxx your DevEx' }),
      ],
    });
    return;
  }

  const creator = await db.creator.findUnique({
    where: { id: server.creatorId },
    include: {
      games: {
        include: {
          snapshots: { orderBy: { date: 'desc' as const }, take: 2 },
        },
      },
    },
  });

  if (!creator || creator.games.length === 0) {
    await interaction.editReply({ content: 'No games found. Connect a game at devmaxx.app/dashboard.' });
    return;
  }

  const game = creator.games[0];
  const latest = game.snapshots[0];
  const prev = game.snapshots[1];

  const healthColor = game.healthScore >= 70 ? 0x4ade80 : game.healthScore >= 40 ? 0xfacc15 : 0xf87171;

  const lastRun = await db.agentRun.findFirst({
    where: { creatorId: creator.id },
    orderBy: { createdAt: 'desc' },
    select: { agentName: true, robuxImpact: true, createdAt: true },
  });

  const dauTrend = latest && prev
    ? latest.dau >= prev.dau
      ? `\u2191 ${latest.dau.toLocaleString()} (+${(latest.dau - prev.dau).toLocaleString()})`
      : `\u2193 ${latest.dau.toLocaleString()} (${(latest.dau - prev.dau).toLocaleString()})`
    : latest
    ? latest.dau.toLocaleString()
    : 'No data';

  const embed = new EmbedBuilder()
    .setColor(healthColor)
    .setTitle(`${game.name}`)
    .addFields(
      { name: 'Health Score', value: `${game.healthScore}/100`, inline: true },
      { name: 'DAU', value: dauTrend, inline: true },
      { name: 'Robux Earned', value: latest ? latest.robuxEarned.toLocaleString() + ' R$' : '--', inline: true },
    )
    .setFooter({ text: 'Devmaxx - Maxx your DevEx' })
    .setTimestamp();

  if (lastRun) {
    const agentLabel = lastRun.agentName.replace(/Agent$/, '').replace(/([A-Z])/g, ' $1').trim();
    embed.addFields({
      name: 'Last Agent Run',
      value: `${agentLabel} \u2014 ${lastRun.robuxImpact ? `+${lastRun.robuxImpact} R$` : 'completed'}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleBrief(interaction: ChatInputCommandInteraction, db: PrismaClient) {
  await interaction.deferReply();

  const server = await db.discordServer.findUnique({
    where: { guildId: interaction.guildId! },
  });

  if (!server?.creatorId) {
    await interaction.editReply({ content: 'No game connected. Use `/devmaxx connect` first.' });
    return;
  }

  const lastBrief = await db.agentRun.findFirst({
    where: {
      creatorId: server.creatorId,
      agentName: 'GrowthBriefAgent',
      status: 'success',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastBrief) {
    await interaction.editReply({ content: 'No GrowthBrief generated yet. Your first brief arrives Sunday at 6pm UTC.' });
    return;
  }

  const output = lastBrief.output as Record<string, unknown>;
  const topThree = (output.topThree as Array<{ title: string; description: string; impact: string }>) ?? [];
  const nextActions = (output.nextActions as Array<{ action: string }>) ?? [];

  const bullets = topThree
    .slice(0, 5)
    .map((item) => {
      const emoji = item.impact === 'positive' ? '\uD83D\uDCC8' : item.impact === 'negative' ? '\u26A0\uFE0F' : '\uD83D\uDCA1';
      return `${emoji} **${item.title}** \u2014 ${item.description}`;
    })
    .join('\n');

  const actions = nextActions
    .slice(0, 3)
    .map((item, i) => `${i + 1}. ${item.action}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('Weekly GrowthBrief')
    .setDescription(bullets || 'No highlights this week.')
    .setFooter({ text: `Generated ${new Date(lastBrief.createdAt).toLocaleDateString()}` })
    .setTimestamp(lastBrief.createdAt);

  if (actions) {
    embed.addFields({ name: 'Next Actions', value: actions, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleConnect(interaction: ChatInputCommandInteraction, db: PrismaClient) {
  // Save the guild info
  await db.discordServer.upsert({
    where: { guildId: interaction.guildId! },
    create: {
      guildId: interaction.guildId!,
      guildName: interaction.guild?.name ?? 'Unknown Server',
      channelId: interaction.channelId,
    },
    update: {
      guildName: interaction.guild?.name ?? 'Unknown Server',
      channelId: interaction.channelId,
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('Connect Your Game')
    .setDescription(
      'Link your Roblox game to Devmaxx to enable status updates, GrowthBriefs, and alerts in this server.\n\n' +
      '**Step 1:** Sign in at [devmaxx.app/login](https://devmaxx.app/login)\n' +
      '**Step 2:** Connect your Roblox account\n' +
      '**Step 3:** Your game data will appear here with `/devmaxx status`'
    )
    .setFooter({ text: 'Devmaxx - Maxx your DevEx' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAlerts(interaction: ChatInputCommandInteraction, db: PrismaClient) {
  const toggle = interaction.options.getString('toggle', true);
  const alertsOn = toggle === 'on';

  await db.discordServer.upsert({
    where: { guildId: interaction.guildId! },
    create: {
      guildId: interaction.guildId!,
      guildName: interaction.guild?.name ?? 'Unknown Server',
      alertsOn,
      channelId: interaction.channelId,
    },
    update: {
      alertsOn,
      channelId: interaction.channelId,
    },
  });

  await interaction.reply({
    content: alertsOn
      ? '\u2705 Alerts are **on**. You\'ll get notified about DAU drops, new briefs, and competitor surges in this channel.'
      : '\u274C Alerts are **off**. Use `/devmaxx alerts on` to re-enable.',
    ephemeral: true,
  });
}

// ─── Alert Sender (called by agents/cron) ───────────────────

export async function sendDiscordAlert(
  db: PrismaClient,
  client: Client | null,
  creatorId: string,
  title: string,
  description: string,
  color: number = 0x6366f1
): Promise<void> {
  if (!client || !client.isReady()) return;

  const servers = await db.discordServer.findMany({
    where: { creatorId, alertsOn: true, channelId: { not: null } },
  });

  for (const server of servers) {
    if (!server.channelId) continue;
    try {
      const channel = await client.channels.fetch(server.channelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: 'Devmaxx Alert' })
          .setTimestamp();
        await channel.send({ embeds: [embed] });
        log(`Alert sent to guild ${server.guildId} channel ${server.channelId}`);
      }
    } catch (err) {
      log(`Failed to send alert to guild ${server.guildId}: ${err}`);
    }
  }
}

// ─── Bot Startup ────────────────────────────────────────────

let discordClient: Client | null = null;

export function getDiscordClient(): Client | null {
  return discordClient;
}

export async function startDiscordBot(db: PrismaClient): Promise<void> {
  if (!DISCORD_BOT_TOKEN) {
    log('DISCORD_BOT_TOKEN not set — Discord bot disabled');
    return;
  }

  if (!DISCORD_CLIENT_ID) {
    log('DISCORD_CLIENT_ID not set — Discord bot disabled');
    return;
  }

  await registerCommands();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once('ready', (c) => {
    log(`Bot logged in as ${c.user.tag} — serving ${c.guilds.cache.size} servers`);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'devmaxx') return;

    const sub = interaction.options.getSubcommand();
    log(`Command: /devmaxx ${sub} from guild ${interaction.guildId}`);

    try {
      switch (sub) {
        case 'status':
          await handleStatus(interaction, db);
          break;
        case 'brief':
          await handleBrief(interaction, db);
          break;
        case 'connect':
          await handleConnect(interaction, db);
          break;
        case 'alerts':
          await handleAlerts(interaction, db);
          break;
        default:
          await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      }
    } catch (err) {
      log(`Command error: ${err}`);
      const reply = { content: 'Something went wrong. Try again later.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  });

  // Handle guild join — register server
  client.on('guildCreate', async (guild) => {
    log(`Joined guild: ${guild.name} (${guild.id})`);
    await db.discordServer.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, guildName: guild.name },
      update: { guildName: guild.name },
    });
  });

  await client.login(DISCORD_BOT_TOKEN);
  discordClient = client;
}
