/* Release notes shown in the panel after an update ("What's new"). Newest first; every entry in English and French. */
(function (root) {
  'use strict';
  root.CHANGELOG = [
    {
      version: '0.11.0',
      en: [
        'Alert sounds: add several MP3 files per event (follow, sub, Prime, gifted subs, bits, raid), played at random, in order or all together, with bits/raid thresholds.',
        'Stream widgets for OBS: followers, subs (with goals), latest follower, latest sub and the song playing in Spotify. One browser source each, so you can place them anywhere.',
        'Streaming hub: see which crew members are live, read their chats, send messages, raid them or invite them to Stream Together, without opening Twitch.',
        'Optional Twitch account login (a code to confirm on Twitch, no password typed in the app) for counters, follows, raids and chat.',
      ],
      fr: [
        'Sons d’alerte : ajoute plusieurs MP3 par événement (follow, sub, Prime, subs offerts, bits, raid), joués au hasard, dans l’ordre ou tous ensemble, avec des paliers pour les bits et les raids.',
        'Widgets de stream pour OBS : followers, subs (avec objectifs), dernier follower, dernier sub et la musique en cours sur Spotify. Une source navigateur chacun, à placer où tu veux.',
        'Hub streaming : vois qui de l’équipe est en live, lis leurs chats, envoie des messages, raid-les ou invite-les en Stream Together, sans ouvrir Twitch.',
        'Connexion optionnelle au compte Twitch (un code à confirmer sur Twitch, aucun mot de passe saisi dans l’app) pour les compteurs, les follows, les raids et le chat.',
      ],
    },
    {
      version: '0.10.1',
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
