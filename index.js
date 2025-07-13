const { Client, GatewayIntentBits, Routes, Partials, AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI);

// 📌 تعريف نموذج الحضور
// ✳️ sessionSchema بعد التعديل
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
    default: [] // ← مهم جدًا
  }
});

const Session = mongoose.model('Session', sessionSchema);


// إعداد البوت
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

// عند تشغيل البوت لأول مرة
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // تعريف أمر /jard
  const commands = [
    new SlashCommandBuilder()
      .setName('jard')
      .setDescription('📊 احصل على جرد الحضور خلال فترة محددة')
      .addStringOption(option =>
        option.setName('من')
          .setDescription('تاريخ البداية (YYYY-MM-DD)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('إلى')
          .setDescription('تاريخ النهاية (YYYY-MM-DD)')
          .setRequired(true))
      .toJSON()
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, '1111813578438221884'), { body: commands })
    .then(() => console.log('✅ Slash command /jard registered'))
    .catch(console.error);
});

// أمر الجرد
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'jard') {
    const requiredRoleId = '1379000098989801482'; // ✅ ID الرتبة المطلوبة
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!member.roles.cache.has(requiredRoleId)) {
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
      const userSessions = user.sessions.filter(
        s => new Date(s.start) >= from && new Date(s.end) <= to
      );
      const totalHours = userSessions.reduce((acc, s) => acc + parseFloat(s.duration), 0);
      if (totalHours > 0) {
        summary.push({ id: user.userId, hours: totalHours });
      }
    }

    if (summary.length === 0) {
      return interaction.reply({ content: '❌ لا توجد بيانات للفترة المحددة.', ephemeral: true });
    }

    summary.sort((a, b) => b.hours - a.hours);

    let reportText = summary.map((u, i) => `${i + 1}. <@${u.id}> ${u.hours.toFixed(2)} hours`).join('\n');
    reportText += '\n\n🔒 LOKA';

    const path = './report.txt';
    fs.writeFileSync(path, reportText);
    const file = new AttachmentBuilder(path);

    try {
      await interaction.user.send({
        content: `📎 ترتيب الحضور من الأعلى إلى الأقل خلال الفترة ${fromDate} إلى ${toDate}:`,
        files: [file]
      });
      await interaction.reply({ content: '📬 تم إرسال التقرير إلى الرسائل الخاصة.', ephemeral: true });
    } catch {
      await interaction.reply({ content: '⚠️ تعذر إرسال التقرير في الخاص. تأكد من تفعيل الرسائل الخاصة.', ephemeral: true });
    }

    fs.unlinkSync(path);
  }
});

// التفاعل مع رسائل الدخول والخروج
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const msg = message.content.trim();

  // أنواع الدخول والخروج المدعومة
  const loginTypes = {
    'تسجيل دخول ملكية': 'ملكية',
    'تسجيل دخول سجن': 'سجن',
    'تسجيل دخول شبمنت': 'شبمنت',
    'تسجيل دخول ملكية + سجن': 'ملكية + سجن',
  };

  const logoutTypes = {
    'تسجيل خروج ملكية': 'ملكية',
    'تسجيل خروج سجن': 'سجن',
    'تسجيل خروج شبمنت': 'شبمنت',
    'تسجيل خروج ملكية + سجن': 'ملكية + سجن',
  };

  // ✅ تسجيل الدخول
  if (loginTypes[msg]) {
    const sessionType = loginTypes[msg];
    let existing = await Session.findOne({ userId: message.author.id });
  
    if (!existing) {
      existing = new Session({
        userId: message.author.id,
        username: message.author.username,
        sessions: []
      });
    } else if (!Array.isArray(existing.sessions)) {
      existing.sessions = [];  // ← إصلاح الحالة غير المهيئة
    }
  
    const hasActive = existing.sessions.some(
      s => s.type === sessionType && !s.end
    );
  
    if (hasActive) {
      return message.reply(`⚠️ لديك جلسة نشطة من نوع "${sessionType}".`);
    }
  
    existing.sessions.push({
      start: new Date(),
      end: null,
      duration: null,
      type: sessionType
    });
  
    await existing.save();
    return message.reply('✅ تم تسجيل الدخول');
  }
  
  // ✅ تسجيل الخروج
  if (logoutTypes[msg]) {
    const sessionType = logoutTypes[msg];
    const existing = await Session.findOne({ userId: message.author.id });

    if (!existing || !existing.sessions.length) {
      return message.reply('⚠️ لا توجد جلسات لتسجيل الخروج.');
    }

    // يبحث عن آخر جلسة من نفس النوع لم يتم إغلاقها
    const last = [...existing.sessions].reverse().find(
      s => s.type === sessionType && !s.end
    );

    if (!last) {
      return message.reply(`⚠️ لا توجد جلسة نشطة من نوع "${sessionType}".`);
    }

    last.end = new Date();
    last.duration = ((last.end - new Date(last.start)) / (1000 * 60 * 60));
    await existing.save();

    return message.reply('✅ تم تسجيل الخروج');
  }
});

client.login(process.env.BOT_TOKEN);
