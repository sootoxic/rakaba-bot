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

    if (interaction.commandName === 'دخول') {
      const existing = await Session.findOne({ userId: interaction.user.id });
      const hasActive = existing && existing.sessions.some(s => !s.end);
      if (hasActive) {
        return interaction.reply({ content: '⚠️ لا يمكنك تسجيل دخول جديد قبل تسجيل الخروج من الجلسة الحالية.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_place_${interaction.user.id}`)
        .setPlaceholder('اختر موقع الدخول')
        .addOptions(PLACES.map(p => ({ label: p, value: p })));

      const row = new ActionRowBuilder().addComponents(menu);
      await interaction.reply({
        content: '📍 اختر المكان الذي تريد تسجيل الدخول إليه:',
        components: [row],
        ephemeral: false
      });
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
      await interaction.reply({ content: `✅ تم تسجيل الخروج من **${type}**.` });
    }

    if (interaction.commandName === 'عرض') {
      if (!isFullAccess) {
        return interaction.reply({ content: '🚫 هذا الأمر مخصص للمسؤول فقط.', ephemeral: true });
      }

      const activeSessions = await Session.find({});
      const activeUsers = activeSessions
        .map(user => {
          const active = [...user.sessions].reverse().find(s => !s.end);
          if (active) return `• <@${user.userId}> - **${active.type}**`;
        })
        .filter(Boolean);

      if (!activeUsers.length) {
        return interaction.reply({ content: '🔍 لا يوجد أي شخص مسجل دخول حاليًا.', ephemeral: true });
      }

      return interaction.reply({ content: `📋 المسجلين دخول حاليًا:

${activeUsers.join('\n')}`, ephemeral: true });
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_place_')) {
    const selected = interaction.values[0];
    const userId = interaction.user.id;

    if (selected === "ملكية + السجن اداري") {
      await Session.findOneAndUpdate(
        { userId },
        { $push: { sessions: { start: new Date(), type: selected } }, username: interaction.user.username },
        { upsert: true, new: true }
      );
      return interaction.update({ content: `✅ تم تسجيل الدخول في **${selected}** بنجاح.`, components: [] });
    }

    const approveBtn = new ButtonBuilder().setCustomId(`approve_${userId}_${selected}`).setLabel('قبول').setStyle(ButtonStyle.Success);
    const rejectBtn = new ButtonBuilder().setCustomId(`reject_${userId}_${selected}`).setLabel('رفض').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

    const requestChannel = await interaction.guild.channels.fetch("1379000717230215179");
    if (requestChannel?.isTextBased()) {
      await requestChannel.send({
        content: `🔔 طلب دخول جديد من <@${userId}> للموقع **${selected}**. الرجاء مراجعة الطلب في: <#1379000717230215179>`
      });

      const dmTarget = interaction.guild.members.cache.find(m => m.roles.cache.has("1379000098989801482"));
      if (dmTarget) {
        dmTarget.send({
          content: `📥 طلب دخول جديد من <@${userId}> للموقع **${selected}**. الرجاء مراجعة الطلب في الروم <#1379000717230215179>.`
        }).catch(() => {});
      }

      await requestChannel.send({
        content: `• العضو: <@${userId}>\n• الموقع: **${selected}**`,
        components: [row]
      });
    }

    await interaction.update({ content: `📨 تم إرسال طلب الدخول، الرجاء انتظار القبول أو الرفض.`, components: [] });
  }

  if (interaction.isButton()) {
    const [action, userId, type] = interaction.customId.split('_');
    const targetUser = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!targetUser) return;

    const logChannel = await interaction.guild.channels.fetch("1382950319039461456");
    if (!logChannel?.isTextBased()) return;

    if (action === 'approve') {
      await Session.findOneAndUpdate(
        { userId },
        { $push: { sessions: { start: new Date(), type } }, username: targetUser.user.username },
        { upsert: true, new: true }
      );

      await interaction.reply({ content: `✅ تم قبول دخول <@${userId}> إلى **${type}**.`, ephemeral: true });
      await interaction.message.edit({ components: [] });
      await logChannel.send(`☑️ تم قبول دخول <@${userId}> إلى **${type}**.`);

    } else if (action === 'reject') {
      await interaction.reply({ content: `❌ تم رفض دخول <@${userId}> إلى **${type}**.`, ephemeral: true });
      await interaction.message.edit({ components: [] });
      await logChannel.send(`🚫 تم رفض دخول <@${userId}> إلى **${type}**. يرجى التواصل مع المشرف.`);
    }
  }
});

client.login(process.env.BOT_TOKEN);
