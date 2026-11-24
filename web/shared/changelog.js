/* Release notes shown in the panel after an update ("What's new"). Newest first; every entry in English and French. */
(function (root) {
  'use strict';
  root.CHANGELOG = [
    {
      version: '1.8.0',
      en: [
        'Puppet Overlay is now LaboHub. Your avatars, Discord login and settings come along.',
        'Choose what you use: Discord puppets, Twitch viewer puppets, stream widgets & alerts, My stream & the crew, BabaDeck, Baba Bot. Only what you tick is shown and runs (Settings → Features).',
        'Safer: your Discord and Twitch logins are now stored encrypted, and updates only come from the official installer.',
      ],
      fr: [
        'Puppet Overlay devient LaboHub. Tes avatars, ta connexion Discord et tes réglages suivent.',
        'Choisis ce que tu utilises : marionnettes Discord, marionnettes des spectateurs Twitch, widgets de stream et alertes, Mon stream et l’équipe, BabaDeck, Baba Bot. Seul ce que tu coches s’affiche et tourne (Réglages → Fonctions).',
        'Plus sûr : tes connexions Discord et Twitch sont maintenant chiffrées, et les mises à jour viennent uniquement de l’installeur officiel.',
      ],
    },
    {
      version: '1.7.0',
      en: [
        'New layout: Puppet Overlay, Widget Twitch, Hub Labo, BabaDeck and Baba Bot. Choose your tabs and your language (installer or Settings → Tabs), rename a tab with a double-click. Each tab has a short tour the first time (replay it with ? or F1) and a Guide where you tick the steps.',
        'Widget Twitch: game counters (deaths, wins / losses) with shortcuts that work in game; Friends\' cams (send a link, their camera becomes an OBS source); your pictures, your own CSS and “My templates” in the widget editor; a GIF per alert sound; the Son Twitch folder for your sounds and GIFs; album covers that follow every song.',
        'Hub Labo → My stream: your live with the category picture, title & category, giveaway, chat poll, stream health, ad warning, Discord “I\'m live”, summary, checklist. Who is live in the crew is shown at the top, with their game.',
        'BabaDeck: a dock, right-click to edit a button, drag to move it, shortcuts with combinations and the recommended keys for QWERTY and AZERTY, a shortcut strip on top of your games (information only).',
        'Baba Bot: the chat bot gets its own tab (commands, automatic messages, sound commands). La savane and Labo test are gone; their best parts moved to the tabs above. New baboon logo.',
      ],
      fr: [
        'Nouvelle organisation : Puppet Overlay, Widget Twitch, Hub Labo, BabaDeck et Baba Bot. Choisis tes onglets et ta langue (installateur ou Réglages → Onglets), renomme un onglet d’un double-clic. Chaque onglet a une petite visite la première fois (à revoir avec ? ou F1) et un Guide où tu coches les étapes.',
        'Widget Twitch : compteurs de jeu (morts, victoires / défaites) avec des raccourcis qui marchent en jeu ; Cam des copains (envoie un lien, sa caméra devient une source OBS) ; tes images, ton propre CSS et « Mes modèles » dans l’éditeur de widgets ; un GIF par son d’alerte ; le dossier Son Twitch pour tes sons et GIF ; les pochettes suivent chaque musique.',
        'Hub Labo → Mon stream : ton live avec l’image de la catégorie, titre et catégorie, giveaway, sondage, santé du stream, alerte pub, « je suis en live » sur Discord, résumé, checklist. Qui est en live dans la team s’affiche en haut, avec son jeu.',
        'BabaDeck : un dock, clic droit pour modifier un bouton, glisser pour le déplacer, raccourcis avec combinaisons et la liste des touches conseillées pour QWERTY et AZERTY, un bandeau des raccourcis par-dessus tes jeux (info seulement).',
        'Baba Bot : le bot de chat a son propre onglet (commandes, messages automatiques, commandes son). La savane et Labo test disparaissent ; le meilleur est passé dans les onglets ci-dessus. Nouveau logo babouin.',
      ],
    },
    {
      version: '1.6.0',
      en: [
        'La savane: the room window can now be closed; pick your camera, microphone and quality before starting, mute buttons; drag and resize the cameras, background presets, logo, renaming; 📺 OBS links for the whole room and for every camera.',
        'Labo test → Chat bot: your commands, timers, !uptime, !so, !lurk, welcome for newcomers, sound commands for viewers.',
        'Labo test → Viewer games: giveaway, chat poll, counters, viewer queue, emote rain, hype meter and end screen, each with its OBS overlay.',
        'Labo test → Streamer tools: title & category presets, ad warning with snooze, “I\'m live” on Discord, stream summary, checklist. Log in to Twitch again once for the new permissions.',
      ],
      fr: [
        'La savane : la fenêtre du salon se ferme enfin ; choix de la caméra, du micro et de la qualité avant de lancer, boutons pour couper ; caméras à déplacer et redimensionner, fonds prêts à l’emploi, logo, renommage ; 📺 liens OBS pour tout le salon et pour chaque caméra.',
        'Labo test → Bot de chat : tes commandes, minuteurs, !uptime, !so, !lurk, accueil des nouveaux, commandes de sons pour les viewers.',
        'Labo test → Jeux viewers : giveaway, sondage du chat, compteurs, file d’attente, pluie d’emotes, jauge de hype et écran de fin, chacun avec son overlay OBS.',
        'Labo test → Outils streamer : préréglages titre et catégorie, alerte pub avec report, « je suis en live » sur Discord, résumé du live, checklist. Reconnecte Twitch une fois pour les nouvelles autorisations.',
      ],
    },
    {
      version: '1.5.0',
      en: [
        'New tabs: La savane 🍌 (video room for the crew, scenes for OBS), BabaDeck (Stream Deck without the hardware, OBS control, shortcuts in game) and Labo test (hype detector, channel points, raid thanks, breaks, stream health, countdown).',
        'Hub: Multi-stream with the videos and merged chats during a collab (“you x your friend”), moderation in the chat; Clips: real Twitch clips in one click and the shortcut of your choice.',
        'HUD: live chat widget, scenes (several widgets in one OBS source), album covers from iTunes/Deezer when Windows gives none (can be turned off), Spotify theme, nicer heart.',
        'Puppets: real hands and shoes, bigger items, 8 hats, face extras, things on the back, 5 items; Discord bot to make your puppet from Discord.',
        'New LaboHub logo, and updates that install in a few seconds (no new download of the app).',
      ],
      fr: [
        'Nouveaux onglets : La savane 🍌 (salon vidéo de l’équipe, scènes pour OBS), BabaDeck (Stream Deck sans le boîtier, contrôle d’OBS, raccourcis en jeu) et Labo test (détecteur de hype, points de chaîne, merci des raids, pauses, santé du stream, compte à rebours).',
        'Hub : Multi-stream avec les vidéos et les chats fusionnés pendant une collab (« toi x ton pote »), modération dans le chat ; Clips : vrais clips Twitch en un clic et le raccourci de ton choix.',
        'HUD : widget chat en direct, scènes (plusieurs widgets dans une source OBS), pochettes via iTunes/Deezer quand Windows n’en donne pas (désactivable), thème Spotify, cœur plus joli.',
        'Marionnettes : vraies mains et chaussures, objets plus grands, 8 chapeaux, extras du visage, objets dans le dos, 5 objets ; bot Discord pour créer sa marionnette depuis Discord.',
        'Nouveau logo LaboHub, et des mises à jour qui s’installent en quelques secondes (sans retélécharger l’app).',
      ],
    },
    {
      version: '1.4.0',
      en: [
        'Spotify widget: the real album cover, the album, a progress bar and the time (1:02 / 3:20), read from the Windows media controls. Option: any music player, not only Spotify.',
        'Latest follower / latest sub: their Twitch profile picture (round, rounded or square, with or without a ring).',
        'One page per widget in the left menu (Followers, Subs, Latest follower, Latest sub, Spotify), with a menu per category and a search box: no more endless list.',
      ],
      fr: [
        'Widget Spotify : la vraie pochette de l’album, l’album, une barre de progression et le temps (1:02 / 3:20), lus dans les contrôles multimédia de Windows. Option : n’importe quel lecteur de musique, pas seulement Spotify.',
        'Dernier follower / dernier sub : leur photo de profil Twitch (ronde, arrondie ou carrée, avec ou sans contour).',
        'Une page par widget dans le menu de gauche (Followers, Subs, Dernier follower, Dernier sub, Spotify), avec un menu par catégorie et une recherche : fini la liste interminable.',
      ],
    },
    {
      version: '1.3.0',
      en: [
        'Widgets: customise absolutely everything, widget by widget — layouts, frames, album cover styles (vinyl, blurred background…), colours, font, sizes, icon, animations and content, with a live preview.',
        'Ready-made themes (Neon, Glass, Paper, Terminal, Candy…), “apply to all widgets”, and style codes to share a look with friends.',
      ],
      fr: [
        'Widgets : personnalise absolument tout, widget par widget — dispositions, cadres, styles de pochette (vinyle, fond flouté…), couleurs, police, tailles, icône, animations et contenu, avec un aperçu en direct.',
        'Des thèmes prêts à l’emploi (Néon, Verre, Papier, Terminal, Bonbon…), « appliquer à tous les widgets », et des codes de style pour partager un look avec tes potes.',
      ],
    },
    {
      version: '1.2.0',
      en: [
        'Each tab has its own logo and colour (orange, violet, mint), with smooth animations everywhere.',
        'A Guide page in each tab, with the steps that turn green once done.',
        'Back and forward like File Explorer: right-click, Alt+← / Alt+→, the mouse side buttons or the ← → buttons. Ctrl+K jumps to any page.',
        'Chat sound: your own messages no longer make a sound (option in Twitch viewers).',
      ],
      fr: [
        'Chaque onglet a son logo et sa couleur (orange, violet, menthe), avec des animations fluides partout.',
        'Une page Guide dans chaque onglet, avec des étapes qui passent au vert une fois faites.',
        'Précédent / suivant comme l’Explorateur : clic droit, Alt+← / Alt+→, les boutons latéraux de la souris ou les boutons ← →. Ctrl+K pour aller à n’importe quelle page.',
        'Son du chat : tes propres messages ne font plus de son (option dans Spectateurs Twitch).',
      ],
    },
    {
      version: '1.1.1',
      en: ['The app is split into three tabs at the top, like File Explorer: Puppet Overlay, HUD Twitch and Hub Labo (friends\' streams and clips). Ctrl+1/2/3 or Ctrl+Tab to switch; settings are behind the ⚙ button.'],
      fr: ['L’app est rangée en trois onglets en haut, comme l’Explorateur Windows : Puppet Overlay, HUD Twitch et Hub Labo (streams des potes et clips). Ctrl+1/2/3 ou Ctrl+Tab pour passer de l’un à l’autre ; les réglages sont derrière le bouton ⚙.'],
    },
    {
      version: '1.1.0',
      en: [
        'Puppet Overlay is now LaboHub: Discord puppets, avatar creator and Twitch viewers, plus all the stream tools, in one app. Your avatars and settings are imported on first launch.',
        'Stream timestamps: press Ctrl+Alt+M (works in game), the button, or type !clip in chat while live. Sorted by day, each with a link to that second of the VOD to make clips quickly.',
      ],
      fr: [
        'Puppet Overlay devient LaboHub : marionnettes Discord, créateur d’avatar et viewers Twitch, plus tous les outils de stream, dans une seule app. Tes avatars et réglages sont importés au premier lancement.',
        'Timestamps de live : appuie sur Ctrl+Alt+M (marche en jeu), sur le bouton, ou tape !clip dans le chat pendant ton live. Triés par jour, chacun avec un lien vers la VOD à la bonne seconde pour faire tes clips vite.',
      ],
    },
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
