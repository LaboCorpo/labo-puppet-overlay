/*
 * Puppet Overlay page "Discord bot": tokens (sent once to the app, stored encrypted, never shown again),
 * status and invitation link.
 */
(function () {
  'use strict';
  const { $, t } = Panel;
  const STATUS = { off: 'Off', connecting: 'Connecting…', connected: 'Online in Discord', error: 'Error' };
  $('#botTokenSave').onclick = async () => { if (await Panel.run('bot-token', { token: $('#botToken').value }, 'Token saved')) $('#botToken').value = ''; };
  $('#botGhSave').onclick = async () => { if (await Panel.run('bot-github-token', { token: $('#botGh').value }, 'Token saved')) $('#botGh').value = ''; };
  $('#botInvite').onclick = () => {
    const id = Panel.state.settings.discord.clientId;
    Panel.action('open-url', { url: `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(id)}&scope=bot+applications.commands&permissions=0` });
  };
  Panel.onState((s) => {
    if (!s.settings) return;
    const b = s.bot || {};
    $('#botStatus').textContent = t(STATUS[b.status] || b.status || 'Off') + (b.detail ? ' — ' + t(b.detail) : '') + (b.user && b.status === 'connected' ? ' · ' + b.user.name : '');
    $('#botTokenState').textContent = (b.hasToken ? t('A bot token is saved (encrypted).') : t('No bot token saved.')) + ' ' + (b.hasGithub ? t('A GitHub token is saved.') : '');
  });
})();
