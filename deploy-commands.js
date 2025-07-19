// deploy-commands.js
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder().setName('دخول').setDescription('🟢 بدء تسجيل دخول'),
  new SlashCommandBuilder().setName('خروج').setDescription('🔴 تسجيل الخروج من الجلسة الحالية'),
  new SlashCommandBuilder().setName('عرض').setDescription('📋 عرض جميع المسجلين دخول حاليًا'),
  new SlashCommandBuilder().setName('jard').setDescription('📊 احصل على جرد الحضور خلال فترة محددة')
    .addStringOption(option => option.setName('من').setDescription('تاريخ البداية').setRequired(true))
    .addStringOption(option => option.setName('إلى').setDescription('تاريخ النهاية').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands })
  .then(() => console.log('✅ Slash commands deployed successfully.'))
  .catch(console.error);
