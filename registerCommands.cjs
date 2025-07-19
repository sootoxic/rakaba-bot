const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

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
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('دخول')
    .setDescription('🟢 بدء تسجيل دخول'),

  new SlashCommandBuilder()
    .setName('خروج')
    .setDescription('🔴 تسجيل الخروج من الجلسة الحالية')
];

// تجهيز الاتصال بـ Discord API
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// إرسال الأوامر إلى Discord
(async () => {
  try {
    console.log('🚀 جاري تسجيل الأوامر...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, '1111813578438221884'),
      { body: commands }
    );
    console.log('✅ تم تسجيل جميع الأوامر بنجاح.');
  } catch (error) {
    console.error('❌ حدث خطأ أثناء التسجيل:', error);
  }
})();
