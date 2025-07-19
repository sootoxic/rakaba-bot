const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const Session = require('../models/session'); // سنجهز هذا لاحقًا
const PLACES = require('../places'); // ملف خارجي لقائمة الأماكن

module.exports = {
  data: new SlashCommandBuilder().setName('دخول').setDescription('🟢 بدء تسجيل دخول'),
  async execute(interaction) {
    const existing = await Session.findOne({ userId: interaction.user.id });
    const hasActive = existing && existing.sessions.some(s => !s.end);
    if (hasActive) return interaction.reply({ content: '⚠️ لا يمكنك تسجيل دخول جديد قبل تسجيل الخروج.', flags: 64 });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`select_place_${interaction.user.id}`)
      .setPlaceholder('اختر موقع الدخول')
      .addOptions(PLACES.map(p => ({ label: p, value: p })));

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ content: '📍 اختر المكان:', components: [row], flags: 64 });
  }
};
