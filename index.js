const { Client, GatewayIntentBits, Routes, Partials, AttachmentBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, InteractionType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');

mongoose.connect(process.env.MONGO_URI);

const sessionSchema = new mongoose.Schema({
  userId: String,
  username: String,
  sessions: {
    type: [new mongoose.Schema({
      start: Date,
      end: Date,
      duration: Number,
      type: { type: String, default: 'غير محدد' }
    })],
    default: []
  }
});

const Session = mongoose.model('Session', sessionSchema);

const allAllowedRoles = [
  "1379000098989801482",
  "1379000099845439490"
];

const fullAccessRoles = [
  "1379000098989801482"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const PLACES = [
  "ملكية + السجن اداري",
  "السجن العسكري",
  "الرسبون",
  "شيبمنت",
  "مركز الامن العام"
];

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('jard')
      .setDescription('📊 احصل على جرد الحضور خلال فترة محددة')
      .addStringOption(option => option.setName('من').setDescription('تاريخ البداية (YYYY-MM-DD)').setRequired(true))
      .addStringOption(option => option.setName('إلى').setDescription('تاريخ النهاية (YYYY-MM-DD)').setRequired(true)),

    new SlashCommandBuilder()
      .setName('دخول')
      .setDescription('🟢 بدء تسجيل دخول'),

    new SlashCommandBuilder()
      .setName('خروج')
      .setDescription('🔴 تسجيل الخروج من الجلسة الحالية'),

    new SlashCommandBuilder()
      .setName('عرض')
      .setDescription('📋 عرض جميع المسجلين دخول حاليًا')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, '1111813578438221884'), { body: commands })
    .then(() => console.log('✅ Slash commands registered'))
    .catch(console.error);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isFullAccess = fullAccessRoles.some(roleId => member.roles.cache.has(roleId));
    const isLimitedAccess = allAllowedRoles.some(roleId => member.roles.cache.has(roleId));

    if (!isLimitedAccess) {
      return interaction.reply({ content: '🚫 ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }

    if (interaction.commandName === 'jard') {
      await interaction.deferReply({ ephemeral: true });

      const from = interaction.options.getString('من');
      const to = interaction.options.getString('إلى');

      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      if (isNaN(fromDate) || isNaN(toDate)) {
        return interaction.editReply({ content: '❌ تواريخ غير صحيحة. تأكد من التنسيق (YYYY-MM-DD).' });
      }

      const allSessions = await Session.find({});
      const reportLines = [];

      for (const user of allSessions) {
        const filteredSessions = user.sessions.filter(s => s.start >= fromDate && s.start <= toDate);
        const totalHours = filteredSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        if (totalHours > 0) {
          reportLines.push(`• <@${user.userId}> ⏱️ ${totalHours.toFixed(1)} ساعة`);
        }
      }

      if (!reportLines.length) {
        return interaction.editReply({ content: '📭 لا توجد أي جلسات خلال الفترة المحددة.' });
      }

      const targetChannel = await interaction.guild.channels.fetch("1379000568680419338").catch(() => null);
      if (targetChannel?.isTextBased()) {
        await targetChannel.send({
          content: `🗓️ تقرير الجرد من **${from}** إلى **${to}**:

${reportLines.join('\n')}`
        });
      }

      await interaction.editReply({ content: '✅ تم إرسال تقرير الجرد في القناة المخصصة.' });
    }
  }
});

client.login(process.env.BOT_TOKEN);
