/* Release notes shown in the panel after an update ("What's new"). Newest first; every entry in English and French. */
(function (root) {
  'use strict';
  root.CHANGELOG = [
    {
      version: '0.10.0',
      en: [
        'Puppets fade when your mouse comes near them (Overlay settings: on/off, opacity %, distance).',
        'Choose what closing the window does: stay in the taskbar, hide in the tray, or quit the app.',
      ],
      fr: [
        'Les marionnettes deviennent transparentes quand ta souris approche (réglages Overlay : activé, opacité %, distance).',
        'Choisis ce que fait la fermeture de la fenêtre : rester dans la barre des tâches, se cacher dans la zone de notification, ou quitter l’app.',
      ],
    },
    {
      version: '0.9.0',
      en: [
        'First-run guide: connect Discord, create your avatar, learn the shortcuts.',
        'Shared avatars are read from the crew file by default.',
        '“Share” buttons on avatars: copy the code or save the .puppet file.',
        '“Copy diagnostics” in Settings, to send when something goes wrong.',
        'This window, after each update.',
      ],
      fr: [
        'Guide de premier lancement : connecter Discord, créer son avatar, découvrir les raccourcis.',
        'Les avatars partagés sont lus depuis le fichier de l’équipe par défaut.',
        'Boutons « Partager » sur les avatars : copier le code ou enregistrer le fichier .puppet.',
        '« Copier les diagnostics » dans Paramètres, à envoyer quand quelque chose ne va pas.',
        'Cette fenêtre, après chaque mise à jour.',
      ],
    },
    {
      version: '0.8.1',
      en: ['Lighter on CPU: the overlay sleeps when nobody is on screen.', 'Sturdier settings, Discord and Twitch connections.'],
      fr: ['Moins gourmand : l’overlay se met en veille quand personne n’est affiché.', 'Réglages et connexions Discord et Twitch plus robustes.'],
    },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
