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
    .setDescription('🔴 تسجيل الخروج من الجلسة الحالية'),

  new SlashCommandBuilder()
    .setName('عرض')
    .setDescription('📋 عرض جميع المسجلين دخول حاليًا') // ✅ أضفنا هذا السطر
];
