import { Client, GatewayIntentBits, Routes, Partials, AttachmentBuilder, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, InteractionType } from 'discord.js';
import { REST } from '@discordjs/rest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();


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
  console.log(` Logged in as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName('jard')
      .setDescription(' احصل على جرد الحضور خلال فترة محددة')
      .addStringOption(option => option.setName('من').setDescription('تاريخ البداية (YYYY-MM-DD)').setRequired(true))
      .addStringOption(option => option.setName('إلى').setDescription('تاريخ النهاية (YYYY-MM-DD)').setRequired(true)),

    new SlashCommandBuilder()
      .setName('دخول')
      .setDescription(' بدء تسجيل دخول'),

    new SlashCommandBuilder()
      .setName('خروج')
      .setDescription(' تسجيل الخروج من الجلسة الحالية')
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, '1111813578438221884'), { body: commands })
    .then(() => console.log(' Slash commands registered'))
    .catch(console.error);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
      return interaction.reply({ content: ' ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }

    if (interaction.commandName === 'دخول') {
      const existing = await Session.findOne({ userId: interaction.user.id });
      const hasActive = existing && existing.sessions.some(s => !s.end);
      if (hasActive) {
        return interaction.reply({ content: ' لا يمكنك تسجيل دخول جديد قبل تسجيل الخروج من الجلسة الحالية.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_place_${interaction.user.id}`)
        .setPlaceholder('اختر موقع الدخول')
        .addOptions([
          {
            label: 'ملكية + السجن',
            value: 'ملكية + السجن'
          },
          {
            label: 'السجن الاداري',
            value: 'السجن الاداري'
          },
          {
            label: 'الرسبون',
            value: 'الرسبون'
          },
          {
            label: 'شيبمنت',
            value: 'شيبمنت'
          },
          {
            label: 'مركز الامن العام',
            value: 'مركز الامن العام'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);
      const reply = await interaction.reply({
        content: ' اختر المكان الذي تريد تسجيل الدخول إليه:',
        components: [row],
        ephemeral: false,
        fetchReply: true
      });

      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 15000);
    }

    if (interaction.commandName === 'خروج') {
      const existing = await Session.findOne({ userId: interaction.user.id });
      if (!existing || !existing.sessions.length) return interaction.reply({ content: ' لا توجد جلسات حالية.', ephemeral: true });
      const active = [...existing.sessions].reverse().find(s => !s.end);
      if (!active) return interaction.reply({ content: ' لا توجد جلسة مفتوحة.', ephemeral: true });
      const type = active.type || 'غير معروف';
      active.end = new Date();
      active.duration = ((active.end - active.start) / 1000 / 60 / 60);
      await existing.save();
      const reply = await interaction.reply({ content: ` تم تسجيل الخروج من **${type}**.`, fetchReply: true });
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 10000);
    }
  }

  if (interaction.isStringSelectMenu()) {
    const [_, __, userId] = interaction.customId.split('_');
    if (interaction.user.id !== userId) return interaction.reply({ content: ' هذا التفاعل ليس لك.', ephemeral: true });

    const selected = interaction.values[0];

    if (selected === 'ملكية + السجن') {
      let existing = await Session.findOne({ userId: interaction.user.id });
      if (!existing) existing = new Session({ userId: interaction.user.id, username: interaction.user.username, sessions: [] });
      existing.sessions.push({ start: new Date(), end: null, duration: null, type: selected });
      await existing.save();
      return interaction.update({ content: ` تم تسجيل الدخول إلى **${selected}**`, components: [] });
    } else {
      const accept = new ButtonBuilder().setCustomId(`accept_${interaction.user.id}_${selected}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success);
      const reject = new ButtonBuilder().setCustomId(`reject_${interaction.user.id}_${selected}`).setLabel('❌ رفض').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(accept, reject);
      const role = interaction.guild.roles.cache.get('1379000098989801482');
const rakaba = role?.members.first();
if (!rakaba) return interaction.update({ content: '❌ لم يتم العثور على مسؤول رقابة لإرسال الطلب.', components: [] });

await rakaba.send({ content: ` طلب دخول من: <@${interaction.user.id}> إلى **${selected}**`, components: [row] });

try {
  await rakaba.send({ content: ` طلب دخول من: <@${interaction.user.id}> إلى **${selected}**`, components: [row] });
  await interaction.update({ content: ' تم إرسال الطلب للمسؤول للموافقة عليه...', components: [] });
} catch (err) {
  console.error("❌ فشل إرسال DM للمسؤول:", err);
  await interaction.update({ content: ' لم نتمكن من إرسال الطلب للمسؤول. تأكد من إمكانية استلامه للرسائل الخاصة.', components: [] });
}
      return interaction.update({ content: ' تم إرسال الطلب للمسؤول للموافقة عليه...', components: [] });
    }
  }

  if (interaction.isButton()) {
    const [action, userId, place] = interaction.customId.split('_');
    const user = await interaction.guild.members.fetch(userId);
    if (action === 'accept') {
      let existing = await Session.findOne({ userId });
      if (!existing) existing = new Session({ userId, username: user.user.username, sessions: [] });
      existing.sessions.push({ start: new Date(), end: null, duration: null, type: place });
      await existing.save();
      const reply = await interaction.reply({ content: ` تم قبول دخول <@${userId}> إلى **${place}**` });
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, 10000);
      const logChannel = interaction.guild.channels.cache.get(interaction.channelId);
      await logChannel.send(` تم تسجيل دخول <@${userId}> إلى **${place}** بعد موافقة الرقابة.`);
    } else if (action === 'reject') {
      await interaction.reply({ content: ` تم رفض دخول <@${userId}> إلى **${place}**.` });
      user.send(` تم رفض دخولك إلى **${place}**. يرجى مراجعة الرقابة.`).catch(() => {});
    }
  }
});

client.login(process.env.BOT_TOKEN);

