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
      type: String
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
      .addStringOption(option => option.setName('إلى').setDescription('تاريخ النهاية (YYYY-MM-DD)').setRequired(true))
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, '1111813578438221884'), { body: commands })
    .then(() => console.log('✅ Slash command /jard registered'))
    .catch(console.error);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const msg = message.content.trim();

  const member = await message.guild.members.fetch(message.author.id);
  if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) return;

  if (msg === 'دخول') {
    const existing = await Session.findOne({ userId: message.author.id });
    const hasActive = existing && existing.sessions.some(s => !s.end);
    if (hasActive) {
      return message.reply('⚠️ لا يمكنك تسجيل دخول جديد قبل تسجيل الخروج من الجلسة الحالية.');
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`select_place_${message.author.id}`)
      .setPlaceholder('اختر موقع الدخول')
      .addOptions(PLACES.map(place => ({ label: place, value: place })));

    const row = new ActionRowBuilder().addComponents(menu);
    await message.reply({ content: '📍 اختر المكان الذي تريد تسجيل الدخول إليه:', components: [row] });
  }

  if (msg === 'خروج') {
    const existing = await Session.findOne({ userId: message.author.id });
    if (!existing || !existing.sessions.length) return message.reply('⚠️ لا توجد جلسات حالية.');
    const active = [...existing.sessions].reverse().find(s => !s.end);
    if (!active) return message.reply('⚠️ لا توجد جلسة مفتوحة.');
    active.end = new Date();
    active.duration = ((active.end - active.start) / 1000 / 60 / 60);
    await existing.save();
    return message.reply(`✅ تم تسجيل الخروج من **${active.type}**.`);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isStringSelectMenu()) {
    const [_, __, userId] = interaction.customId.split('_');
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ هذا الخيار ليس موجهًا لك.', ephemeral: true });
    const selected = interaction.values[0];

    if (selected === 'ملكية + السجن') {
      let existing = await Session.findOne({ userId: interaction.user.id });
      if (!existing) existing = new Session({ userId: interaction.user.id, username: interaction.user.username, sessions: [] });
      existing.sessions.push({ start: new Date(), end: null, duration: null, type: selected });
      await existing.save();
      return interaction.update({ content: `✅ تم تسجيل الدخول إلى **${selected}**`, components: [] });
    } else {
      const accept = new ButtonBuilder().setCustomId(`accept_${interaction.user.id}_${selected}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success);
      const reject = new ButtonBuilder().setCustomId(`reject_${interaction.user.id}_${selected}`).setLabel('❌ رفض').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(accept, reject);
      const rakabaUser = await interaction.guild.members.fetch('1379000098989801482');
      await rakabaUser.send({ content: `🕵️ طلب دخول من: <@${interaction.user.id}> إلى **${selected}**`, components: [row] });
      return interaction.update({ content: '⏳ تم إرسال الطلب للرقابة بانتظار الموافقة...', components: [] });
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
      await interaction.reply({ content: `✅ تم قبول دخول <@${userId}> إلى **${place}**` });
      const channel = interaction.guild.channels.cache.get(interaction.channelId);
      await channel.send(`✅ تم تسجيل دخول <@${userId}> إلى **${place}** بعد موافقة الرقابة.`);
    } else if (action === 'reject') {
      await interaction.reply({ content: `❌ تم رفض دخول <@${userId}> إلى **${place}**.` });
      await user.send(`❌ تم رفض دخولك إلى **${place}**. يرجى مراجعة الرقابة.`);
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'jard') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!allowedRoles.some(roleId => member.roles.cache.has(roleId))) {
      return interaction.reply({ content: '🚫 ليس لديك الصلاحية لاستخدام هذا الأمر.', ephemeral: true });
    }

    const fromDate = interaction.options.getString('من');
    const toDate = interaction.options.getString('إلى');
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const allUsers = await Session.find();
    let summary = [];

    for (const user of allUsers) {
      const userSessions = user.sessions.filter(s => new Date(s.start) >= from && new Date(s.end) <= to);
      const totalHours = userSessions.reduce((acc, s) => acc + parseFloat(s.duration || 0), 0);
      if (totalHours > 0) summary.push({ id: user.userId, hours: totalHours });
    }

    if (summary.length === 0) return interaction.reply({ content: '❌ لا توجد بيانات للفترة المحددة.', ephemeral: true });

    summary.sort((a, b) => b.hours - a.hours);
    let reportText = summary.map((u, i) => `${i + 1}. <@${u.id}> ${u.hours.toFixed(2)} ساعات`).join('\n');
    reportText += '\n\n🔒 LOKA';

    const path = './report.txt';
    fs.writeFileSync(path, reportText);
    const file = new AttachmentBuilder(path);

    try {
      await interaction.user.send({ content: `📎 تقرير الحضور من ${fromDate} إلى ${toDate}:`, files: [file] });
      await interaction.reply({ content: '📬 تم إرسال التقرير في الخاص.', ephemeral: true });
    } catch {
      await interaction.reply({ content: '⚠️ تعذر إرسال التقرير في الخاص.', ephemeral: true });
    }

    fs.unlinkSync(path);
  }
});

client.login(process.env.BOT_TOKEN);
