// registerCommands.js

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

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

// تجهيز الاتصال بـ Discord API
const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// إرسال الأمر إلى Discord
(async () => {
  try {
    console.log('🚀 جاري تسجيل الأمر...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ تم تسجيل الأمر /jard بنجاح.');
  } catch (error) {
    console.error('❌ حدث خطأ أثناء التسجيل:', error);
  }
})();
