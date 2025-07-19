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

const allowedRoles = [
  "1379000098989801482",
  "1379000099845439490"
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
  "ملكية + السجن",
  "السجن الاداري",
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
      .setDescription('🟢 بدء تسجيل دخول')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('خروج')
      .setDescription('🔴 تسجيل الخروج من الجلسة الحالية')
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, '1111813578438221884'), { body: commands })
    .then(() => console.log('✅ Slash commands registered'))
    .catch(console.error);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
      return interaction.reply({ content: '🚫 ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }

    if (interaction.commandName === 'دخول') {
      const existing = await Session.findOne({ userId: interaction.user.id });
      const hasActive = existing && existing.sessions.some(s => !s.end);
      if (hasActive) {
        return interaction.reply({ content: '⚠️ لا يمكنك تسجيل دخول جديد قبل تسجيل الخروج من الجلسة الحالية.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_place_${interaction.user.id}`)
        .setPlaceholder('اختر موقع الدخول')
        .addOptions(PLACES.map(place => ({ label: place, value: place })));

      const row = new ActionRowBuilder().addComponents(menu);
      await interaction.reply({ content: '📍 اختر المكان الذي تريد تسجيل الدخول إليه:', components: [row], ephemeral: true });
    }

    if (interaction.commandName === 'خروج') {
      const existing = await Session.findOne({ userId: interaction.user.id });
      if (!existing || !existing.sessions.length) return interaction.reply({ content: '⚠️ لا توجد جلسات حالية.', ephemeral: true });
      const active = [...existing.sessions].reverse().find(s => !s.end);
      if (!active) return interaction.reply({ content: '⚠️ لا توجد جلسة مفتوحة.', ephemeral: true });
      const type = active.type || 'غير معروف';
      active.end = new Date();
      active.duration = ((active.end - active.start) / 1000 / 60 / 60);
      await existing.save();
      return interaction.reply({ content: `✅ تم تسجيل الخروج من **${type}**.`, ephemeral: true });
    }
  }
});
