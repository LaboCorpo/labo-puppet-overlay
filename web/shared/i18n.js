/*
 * Minimal i18n shared by the pages (window.I18N) and the main process (require).
 * Keys are the English strings themselves: anything missing simply stays in English.
 * - t(str, vars): translate + replace {placeholders}
 * - apply(root): translates text nodes, placeholders/titles, and [data-i18n-html] blocks (rich text)
 * To add a language: add an entry to DICT and an <option> in the language selects.
 */
(function (root) {
  'use strict';

  const FR = {
    // ----- navigation & common -----
    'Status': 'Statut', 'Overlay': 'Overlay', 'Avatars': 'Avatars', 'Twitch': 'Twitch', 'OBS / Streamlabs': 'OBS / Streamlabs',
    'Settings': 'Réglages', 'Discord setup': 'Config Discord', 'Discord': 'Discord', 'Copy': 'Copier', 'Import': 'Importer',
    'Edit': 'Modifier', 'Delete': 'Supprimer', 'Enable': 'Activer', 'Size': 'Taille', 'Position': 'Position', 'Screen': 'Écran',
    'None': 'Aucun', 'none': 'aucun', 'off': 'désactivé', 'Random': 'Aléatoire', 'Both': 'Les deux', 'Done': 'Terminé',
    'Restart now': 'Redémarrer', 'Lost contact with the app — reconnecting…': 'Connexion à l’app perdue — reconnexion…',
    'Language': 'Langue', 'Auto (system)': 'Auto (système)',

    // ----- status tab -----
    'Getting started': 'Pour commencer', 'Account': 'Compte', 'Voice channel': 'Salon vocal', 'Twitch chat': 'Chat Twitch',
    'Reconnect / re-authorize Discord': 'Reconnecter / réautoriser Discord', 'Move puppets…': 'Déplacer les marionnettes…',
    'Finish placement': 'Terminer le placement', 'In the channel': 'Dans le salon', 'Live preview': 'Aperçu en direct',
    'The preview adds fake members and fake Twitch chat when there is nothing live, so you can tune settings.': 'L’aperçu ajoute de faux membres et un faux chat Twitch quand rien n’est en direct, pour régler tranquillement.',
    'Private call': 'Appel privé', 'Call': 'Appel', 'call': 'appel', 'custom avatar': 'avatar perso', 'Discord picture': 'photo Discord',
    'muted': 'muet', 'deafened': 'sourdine', 'Nobody yet — join a voice channel in Discord.': 'Personne pour l’instant — rejoins un salon vocal sur Discord.',
    'Create the Discord application and paste its <b>Application ID</b> in <a href="#" data-goto="discord">Discord setup</a>.': 'Crée l’application Discord et colle son <b>Application ID</b> dans <a href="#" data-goto="discord">Config Discord</a>.',
    'Make sure the <b>Discord desktop app</b> is running and click <b>Authorize</b> in its popup.': 'Vérifie que l’<b>application Discord</b> (bureau) est lancée et clique sur <b>Autoriser</b> dans sa fenêtre.',
    '<a href="#" data-goto="avatars">Create your avatar</a> and share the file with your friends.': '<a href="#" data-goto="avatars">Crée ton avatar</a> et partage le fichier avec tes potes.',

    // discord / twitch statuses & details
    'connected': 'connecté', 'connecting': 'connexion…', 'disconnected': 'déconnecté', 'setup required': 'configuration requise',
    'Discord not found': 'Discord introuvable', 'authorizing': 'autorisation', 'error': 'erreur', 'refused': 'refusé', 'starting': 'démarrage',
    'reconnecting': 'reconnexion', 'Connection lost': 'Connexion perdue', 'Invalid channel name': 'Nom de chaîne invalide',
    'Enter your Discord Application ID in Setup.': 'Renseigne l’Application ID Discord dans Config Discord.',
    'Start the Discord desktop app (the browser version is not supported).': 'Lance l’application Discord pour PC (la version navigateur n’est pas prise en charge).',
    'Discord closed or connection lost — retrying…': 'Discord fermé ou connexion perdue — nouvelle tentative…',
    'Click “Authorize” in the Discord popup.': 'Clique sur « Autoriser » dans la fenêtre Discord.',
    'Authorization was declined in Discord.': 'Autorisation refusée dans Discord.',
    'make sure your account is an accepted App Tester of the Discord application.': 'vérifie que ton compte est bien testeur (invitation acceptée) de l’application Discord.',

    // ----- overlay tab -----
    'Desktop overlay': 'Overlay bureau', 'Show the overlay on my desktop': 'Afficher l’overlay sur mon bureau',
    'Move puppets with the mouse…': 'Déplacer les marionnettes à la souris…',
    'Bottom left': 'Bas gauche', 'Bottom center': 'Bas centre', 'Bottom right': 'Bas droite', 'Top left': 'Haut gauche', 'Top center': 'Haut centre', 'Top right': 'Haut droite',
    'Custom (placement mode)': 'Personnalisée (mode placement)', 'Spacing': 'Espacement', 'Edge margin': 'Marge du bord', 'Max puppets': 'Marionnettes max',
    'Behaviour': 'Comportement', 'Entrance': 'Entrée en scène', 'Walk in': 'En marchant', 'Drop from the sky': 'Chute du ciel', 'Pop': 'Apparition',
    'Mute / deafen display': 'Affichage muet / sourdine', 'Tape & earmuffs': 'Scotch et cache-oreilles', 'Red badges': 'Badges rouges',
    'Fall asleep after (minutes, 0 = never)': 'S’endort après (minutes, 0 = jamais)', 'Puppets look at whoever is speaking': 'Les marionnettes regardent celui qui parle',
    'Show names': 'Afficher les pseudos', 'Show myself': 'M’afficher moi-même', 'Only show people while they speak': 'N’afficher que ceux qui parlent',
    'Green ring while speaking': 'Halo vert quand on parle', 'Also show Twitch viewers on my desktop': 'Montrer aussi les spectateurs Twitch sur mon bureau',
    'The overlay lets clicks through and stays on top. Games in <b>exclusive fullscreen</b> hide it — switch them to <b>borderless windowed</b>.': 'L’overlay laisse passer les clics et reste au premier plan. Les jeux en <b>plein écran exclusif</b> le masquent : passe-les en <b>fenêtré sans bordure</b>.',
    'Primary': 'Principal',

    // ----- avatars tab -----
    "Your crew's avatars": 'Les avatars de la bande', 'Create / edit my avatar': 'Créer / modifier mon avatar', 'Import .puppet files': 'Importer des fichiers .puppet',
    '…or paste a PUP1.xxxx code from a friend': '…ou colle un code PUP1.xxxx reçu d’un pote', 'Drop .puppet files anywhere in this window': 'Dépose des fichiers .puppet n’importe où dans cette fenêtre',
    'Members without an imported avatar appear with their Discord profile picture cut into a puppet.': 'Les membres sans avatar importé apparaissent avec leur photo de profil Discord découpée en marionnette.',
    'Shared sync (beta)': 'Synchro partagée (bêta)', 'URL of a shared JSON (e.g. the “Raw” link of a GitHub Gist)': 'URL d’un JSON partagé (ex. le lien « Raw » d’un GitHub Gist)',
    'No avatars imported yet.': 'Aucun avatar importé pour l’instant.', '(no name)': '(sans nom)', 'Delete {name}’s avatar?': 'Supprimer l’avatar de {name} ?',
    '✔ Imported {name}’s avatar.': '✔ Avatar de {name} importé.', 'Unreadable code or file': 'Code ou fichier illisible', 'Import failed': 'Import échoué',
    'Missing or invalid Discord ID (17–20 digits)': 'ID Discord manquant ou invalide (17 à 20 chiffres)', 'Invalid avatar': 'Avatar invalide', 'Invalid photo': 'Photo invalide',

    // ----- twitch tab -----
    'Twitch viewers': 'Spectateurs Twitch', 'Twitch channel': 'Chaîne Twitch', 'your_channel': 'ta_chaine', 'Max viewers on screen': 'Spectateurs max à l’écran',
    'Bubble duration (s)': 'Durée des bulles (s)', 'Leave after inactivity (min)': 'Départ après inactivité (min)', 'Side': 'Côté',
    'Test:': 'Tester :', 'Chat message': 'Message', 'Command': 'Commande', 'Sub': 'Sub', 'Bits': 'Bits', 'Raid': 'Raid',
    'Viewer style': 'Style des spectateurs', 'Clothes palette': 'Palette des vêtements', 'Vivid': 'Vive', 'Pastel': 'Pastel', 'Monochrome': 'Monochrome', 'My colours': 'Mes couleurs',
    'My colours (comma separated)': 'Mes couleurs (séparées par des virgules)', 'Hats': 'Chapeaux', 'Beards & moustaches': 'Barbes et moustaches', 'Names': 'Pseudos',
    'Names in their chat colour': 'Pseudos dans leur couleur de chat', 'Bubble background': 'Fond des bulles', 'Bubble text': 'Texte des bulles', 'Ignored accounts (bots)': 'Comptes ignorés (bots)',
    'Chat commands': 'Commandes du chat', 'Viewers can use commands': 'Les spectateurs peuvent utiliser des commandes', "Don't show commands in bubbles": 'Ne pas afficher les commandes dans les bulles',
    'Prefix': 'Préfixe', 'Action cooldown per viewer (s)': 'Délai entre actions par spectateur (s)', 'Style cooldown per viewer (s)': 'Délai entre changements de look (s)',
    'Reset all viewer customisations': 'Réinitialiser tous les looks des spectateurs', 'Events': 'Événements', 'Raids: a crowd walks in': 'Raids : une foule entre en scène',
    'Max raiders on screen': 'Raiders max à l’écran', 'Subs: confetti & celebration': 'Subs : confettis et célébration', 'Bits: confetti': 'Bits : confettis',
    "Each viewer keeps the same character across streams (it's generated from their username) until they customise it with commands. Chat is read anonymously — no Twitch login needed.": 'Chaque spectateur garde le même personnage d’un live à l’autre (il est généré à partir de son pseudo) tant qu’il ne le personnalise pas avec des commandes. Le chat est lu anonymement, sans connexion Twitch.',
    'jump': 'sauter', 'dance': 'danser', 'wave hello': 'faire coucou', 'hat crown / cap / none…': 'chapeau crown / cap / none…', 'hair afro / long…': 'cheveux afro / long…',
    'outfit suit / dress…': 'tenue suit / dress…', 'eyes stars / hearts…': 'yeux stars / hearts…', 'color pink / #ff00aa': 'couleur pink / #ff00aa', 'hatcolor gold': 'couleur du chapeau gold',
    'new random look': 'nouveau look au hasard', 'back to default look': 'retour au look d’origine', 'list commands': 'liste des commandes',
    'Tip: the effect shows in the Status preview and in OBS': 'Astuce : l’effet s’affiche dans l’aperçu de Statut et dans OBS',
    'Reset every viewer back to their default look?': 'Remettre tous les spectateurs à leur look d’origine ?', 'Viewer customisations cleared': 'Looks des spectateurs réinitialisés',

    // ----- OBS tab -----
    'Add a <b>Browser Source</b> with one of these URLs (width 1920, height 1080). The background is transparent.': 'Ajoute une <b>Source Navigateur</b> avec une de ces URL (largeur 1920, hauteur 1080). Le fond est transparent.',
    'Discord + Twitch': 'Discord + Twitch', 'Discord only': 'Discord seul', 'Twitch only': 'Twitch seul',
    'Keep the app running while streaming. Changes you make here apply live in OBS. Positions are relative, so they match whatever canvas size you use.': 'Garde l’app lancée pendant le stream. Les réglages faits ici s’appliquent en direct dans OBS. Les positions sont relatives : elles s’adaptent à la taille de ta scène.',
    'Copied to clipboard': 'Copié dans le presse-papiers', 'Reconnecting to Discord…': 'Reconnexion à Discord…',

    // ----- settings tab -----
    'Launch with Windows (starts hidden in the tray)': 'Lancer avec Windows (démarre caché dans la zone de notification)', 'Check for updates automatically': 'Rechercher les mises à jour automatiquement',
    'Keyboard shortcuts': 'Raccourcis clavier', 'Show / hide overlay': 'Afficher / masquer l’overlay', 'Move puppets (placement mode)': 'Déplacer les marionnettes (mode placement)',
    'Click, then press keys': 'Clique, puis appuie sur les touches', 'Click a field and press your combination (e.g. Ctrl+Shift+O). Backspace clears it.': 'Clique sur un champ et tape ta combinaison (ex. Ctrl+Shift+O). Retour arrière l’efface.',
    'Use at least one modifier (Ctrl, Alt or Shift)': 'Utilise au moins une touche Ctrl, Alt ou Shift', 'Already used by another app': 'Déjà utilisé par une autre app', 'Invalid shortcut': 'Raccourci invalide',
    'Updates': 'Mises à jour', 'Version': 'Version', 'Check now': 'Vérifier maintenant', 'Troubleshooting': 'Dépannage', 'Open logs folder': 'Ouvrir le dossier des logs',
    'Back up settings & avatars…': 'Sauvegarder réglages et avatars…', '(portable)': '(portable)', '(installed)': '(installée)', 'portable': 'portable',
    'Development build (updates disabled)': 'Version de développement (mises à jour désactivées)', 'Checking…': 'Vérification…', 'Up to date': 'À jour', 'Downloading': 'Téléchargement',
    'Ready — restart to install': 'Prête — redémarre pour installer', 'New version available': 'Nouvelle version disponible', 'Error': 'Erreur',
    'Version {v} is downloaded and ready.': 'La version {v} est téléchargée et prête.',
    "Version {v} is available. The portable build can't update itself — grab the new .exe.": 'La version {v} est disponible. La version portable ne peut pas se mettre à jour seule : télécharge le nouvel .exe.',
    'Restart & update': 'Redémarrer et mettre à jour', 'Download': 'Télécharger',
    'No published update found yet (the GitHub repository must be public).': 'Aucune mise à jour publiée pour l’instant (le dépôt GitHub doit être public).',
    'Offline — will retry later.': 'Hors ligne — nouvel essai plus tard.', 'No public release found (is the GitHub repository public?)': 'Aucune release publique trouvée (le dépôt GitHub est-il public ?)',

    // ----- discord setup tab -----
    'Discord Application ID': 'Application ID Discord', 'Redirect URI': 'Redirect URI', 'Advanced: Client Secret (only if “Public Client” is off)': 'Avancé : Client Secret (seulement si « Public Client » est désactivé)',
    'leave empty when Public Client is on': 'laisser vide si Public Client est activé', 'One-time setup (done by whoever manages the app)': 'Mise en place unique (par la personne qui gère l’app)',
    'Open <a href="https://discord.com/developers/applications" target="_blank">discord.com/developers/applications</a> → <b>New Application</b>.': 'Ouvre <a href="https://discord.com/developers/applications" target="_blank">discord.com/developers/applications</a> → <b>New Application</b>.',
    '<b>OAuth2</b> tab: add the redirect <code>http://localhost</code> and turn on <b>Public Client</b>.': 'Onglet <b>OAuth2</b> : ajoute la redirection <code>http://localhost</code> et active <b>Public Client</b>.',
    "<b>App Testers</b> tab: invite everyone who will <i>run</i> the app (max 50). Each must <b>accept the invite</b>. Friends who only appear in your channel don't need anything.": 'Onglet <b>App Testers</b> : invite chaque personne qui <i>lancera</i> l’app (50 max). Chacune doit <b>accepter l’invitation</b>. Les potes qui apparaissent seulement dans ton salon n’ont rien à faire.',
    'Copy the <b>Application ID</b> above (or bake it into the build via the <code>DISCORD_CLIENT_ID</code> repo variable).': 'Copie l’<b>Application ID</b> ci-dessus (ou intègre-le au build via la variable <code>DISCORD_CLIENT_ID</code> du dépôt).',
    "On first connection Discord shows an authorization popup: click “Authorize”. It won't ask again.": 'À la première connexion, Discord affiche une fenêtre d’autorisation : clique sur « Autoriser ». Il ne le redemandera plus.',

    // ----- creator -----
    'Avatar Creator — Puppet Overlay': 'Créateur d’avatar — Puppet Overlay', 'Avatar creator': 'Créateur d’avatar', 'Avatar Creator': 'Créateur d’avatar',
    '🗣 Hold to talk': '🗣 Maintenir pour parler', 'Auto animation': 'Animation auto', 'Display name': 'Pseudo affiché', 'Discord user ID': 'ID Discord', '17–20 digits': '17 à 20 chiffres',
    'Where do I find my Discord ID?': 'Où trouver mon ID Discord ?',
    'Discord Settings → Advanced → turn on <b>Developer Mode</b>. Then right-click your name → <b>Copy User ID</b>.': 'Paramètres Discord → Avancés → active le <b>Mode développeur</b>. Ensuite, clic droit sur ton pseudo → <b>Copier l’identifiant de l’utilisateur</b>.',
    '✔ Save to my overlay': '✔ Enregistrer dans mon overlay', '⬇ .puppet file': '⬇ Fichier .puppet', 'Copy code': 'Copier le code',
    'Open an existing avatar (code or file)': 'Ouvrir un avatar existant (code ou fichier)', 'Load code': 'Charger le code', 'Load a file': 'Charger un fichier',
    '✏️ From scratch': '✏️ De zéro', '📷 From a photo': '📷 À partir d’une photo', '🎲 Random': '🎲 Aléatoire', 'Choose a photo': 'Choisir une photo',
    'Drag to position the face, use the wheel or slider to zoom.': 'Fais glisser pour placer le visage, molette ou curseur pour zoomer.', 'Zoom': 'Zoom',
    'Mouth line (where the head opens)': 'Ligne de la bouche (là où la tête s’ouvre)', 'Head shape': 'Forme de la tête',
    'Tip: frame the face inside the oval, then move the orange line to the mouth.': 'Astuce : cadre le visage dans l’ovale, puis place la ligne orange au niveau de la bouche.',
    'Eyes': 'Yeux', 'Eyebrows': 'Sourcils', 'Hair': 'Cheveux', 'Hat': 'Chapeau', 'Facial hair': 'Pilosité', 'Outfit': 'Tenue', 'Skin': 'Peau', 'Eye colour': 'Couleur des yeux',
    'Hair / beard': 'Cheveux / barbe', 'Clothes': 'Vêtements', 'Details': 'Détails', 'Custom colour': 'Couleur perso',
    'Round': 'Rond', 'Oval': 'Ovale', 'Square': 'Carré', 'Pear': 'Poire', 'Dots': 'Points', 'Sleepy': 'Endormis', 'Stars': 'Étoiles', 'Glasses': 'Lunettes', 'Angry': 'Colère',
    'Thin': 'Fins', 'Thick': 'Épais', 'Frown': 'Froncés', 'Surprised': 'Surpris', 'Short': 'Court', 'Spiky': 'Pointes', 'Bowl': 'Bol', 'Long': 'Long', 'Bun': 'Chignon',
    'Mohawk': 'Crête', 'Afro': 'Afro', 'Beanie': 'Bonnet', 'Cap': 'Casquette', 'Crown': 'Couronne', 'Headphones': 'Casque audio', 'Tophat': 'Haut-de-forme',
    'Beard': 'Barbe', 'Goatee': 'Bouc', 'Mustache': 'Moustache', 'Jacket': 'Veste', 'Sweater': 'Pull', 'Dress': 'Robe', 'Suit': 'Costume',
    'Choose a photo first.': 'Choisis d’abord une photo.',
    'Enter your Discord user ID (17–20 digits) so your friends’ apps can recognise you.': 'Renseigne ton ID Discord (17 à 20 chiffres) pour que les apps de tes potes te reconnaissent.',
    '✔ File downloaded — send it to your friends; they drop it into their Avatars tab.': '✔ Fichier téléchargé : envoie-le à tes potes, ils le déposent dans leur onglet Avatars.',
    'Photo avatars are too large for a code — use the .puppet file.': 'Un avatar photo est trop lourd pour un code : utilise le fichier .puppet.',
    'Photo avatars are too large for a code — share the .puppet file instead.': 'Un avatar photo est trop lourd pour un code : partage plutôt le fichier .puppet.',
    '✔ Code copied ({n} characters). Paste it to your friends on Discord.': '✔ Code copié ({n} caractères). Colle-le à tes potes sur Discord.',
    '✔ Saved to your overlay. Remember to share the file or code with your friends too.': '✔ Enregistré dans ton overlay. Pense aussi à partager le fichier ou le code avec tes potes.',
    '✔ Avatar loaded.': '✔ Avatar chargé.', '✖ Unreadable code.': '✖ Code illisible.', '✖ Unreadable file.': '✖ Fichier illisible.',

    // ----- overlay -----
    'Drag a group to move it  ·  Mouse wheel to resize  ·  Esc or click Done to finish': 'Fais glisser un groupe pour le déplacer  ·  Molette pour redimensionner  ·  Échap ou Terminé pour finir',
    'Discord voice': 'Vocal Discord', 'Puppet Overlay app not reachable — retrying…': 'App Puppet Overlay injoignable — nouvelle tentative…',

    // ----- v0.4: creator tabs, sliders, new parts -----
    'Head': 'Tête', 'Accessories': 'Accessoires', 'Head size': 'Taille de la tête', 'Eye size': 'Taille des yeux', 'Eye spacing': 'Écart des yeux',
    'Eye height': 'Hauteur des yeux', 'Glasses': 'Lunettes', 'Glasses colour': 'Couleur des lunettes', 'Pattern': 'Motif', 'Body width': 'Largeur du corps',
    'Body height': 'Hauteur du corps', 'Neckwear': 'Au cou', 'Neckwear colour': 'Couleur (cou)', 'In hand': 'Dans la main', 'Nose': 'Nez', 'Cheeks': 'Joues', 'Teeth': 'Dents',
    'This tab': 'Cet onglet', 'Randomize only this tab': 'Tirer au hasard uniquement cet onglet', 'Double-click to reset': 'Double-clic pour réinitialiser',
    'Rotation': 'Rotation', 'Brightness': 'Luminosité', 'Contrast': 'Contraste', 'Saturation': 'Saturation', 'Mirror': 'Miroir', 'Cartoon effect': 'Effet cartoon',
    'Black & white': 'Noir et blanc', 'Undo (Ctrl+Z)': 'Annuler (Ctrl+Z)', 'Redo (Ctrl+Y)': 'Rétablir (Ctrl+Y)',
    'Egg': 'Œuf', 'Wide': 'Large', 'Tall': 'Haute', 'Happy': 'Joyeux', 'Cute': 'Mignons', 'Wink': 'Clin d’œil', 'Dizzy': 'Étourdi', 'Hearts': 'Cœurs',
    'Worried': 'Inquiets', 'Unibrow': 'Monosourcil', 'Sunglasses': 'Lunettes de soleil', 'Monocle': 'Monocle', 'Goggles': 'Masque', 'Dot': 'Point',
    'Pointy': 'Pointu', 'Pig': 'Groin', 'Button': 'Clown', 'Blush': 'Rougissantes', 'Freckles': 'Taches de rousseur', 'Scar': 'Cicatrice', 'Mole': 'Grain de beauté',
    'Bandage': 'Pansement', 'Buck': 'Dents du bonheur', 'Fangs': 'Crocs', 'Gap': 'Une dent', 'Curly': 'Bouclés', 'Pigtails': 'Couettes', 'Ponytail': 'Queue de cheval',
    'Sidepart': 'Raie sur le côté', 'Stubble': 'Barbe de 3 jours', 'Full': 'Barbe fournie', 'Chinstrap': 'Collier', 'Handlebar': 'Moustache guidon',
    'Cowboy': 'Cowboy', 'Wizard': 'Sorcier', 'Beret': 'Béret', 'Bandana': 'Bandana', 'Horns': 'Cornes', 'Halo': 'Auréole', 'Propeller': 'Hélice',
    'Hoodie': 'Sweat à capuche', 'Tshirt': 'T-shirt', 'Overalls': 'Salopette', 'Hawaiian': 'Hawaïenne', 'Labcoat': 'Blouse', 'Cape': 'Cape',
    'Stripes': 'Rayures', 'Checks': 'Carreaux', 'Scarf': 'Écharpe', 'Bowtie': 'Nœud papillon', 'Tie': 'Cravate', 'Necklace': 'Collier', 'Medal': 'Médaille',
    'Mug': 'Tasse', 'Controller': 'Manette', 'Sword': 'Épée', 'Flower': 'Fleur', 'Phone': 'Téléphone', 'Pizza': 'Pizza', 'Balloon': 'Ballon',
    'eyes stars / hearts…': 'yeux stars / hearts…', 'glasses sunglasses…': 'lunettes sunglasses…', 'item pizza / sword…': 'objet pizza / sword…',
    'neck scarf / medal…': 'cou scarf / medal…', 'pattern stripes…': 'motif stripes…',

    // ----- v0.4: members & performance -----
    'Members': 'Membres',
    "Everyone you've shared a voice channel with. Hide someone, give them a nickname, change their size or the order they stand in. Settings are kept even when they're offline.": 'Toutes les personnes avec qui tu as partagé un salon vocal. Masque quelqu’un, donne-lui un surnom, change sa taille ou sa place dans la rangée. Les réglages sont conservés même quand la personne est hors ligne.',
    'just now': 'à l’instant', '{n} min ago': 'il y a {n} min', '{n} h ago': 'il y a {n} h', '{n} days ago': 'il y a {n} jours',
    'Nobody yet — members appear here once you have joined a voice channel with them.': 'Personne pour l’instant — les membres apparaissent ici dès que tu as été en vocal avec eux.',
    'in the channel': 'dans le salon', 'Nickname': 'Surnom', 'Hidden': 'Masqué', 'Move left': 'Vers la gauche', 'Move right': 'Vers la droite', 'Forget': 'Oublier',
    'Forget {name} and their settings?': 'Oublier {name} et ses réglages ?',
    'Performance': 'Performance', 'Performance (smoothest)': 'Performance (le plus fluide)', 'Normal': 'Normal', 'Eco (lighter on your PC)': 'Éco (plus léger pour ton PC)',
    'Performance: full frame rate and sharpness. Normal: 60 fps. Eco: 30 fps, lower resolution, fewer effects — and the overlay sleeps when nobody is on screen (all modes pause when empty).': 'Performance : fluidité et netteté maximales. Normal : 60 i/s. Éco : 30 i/s, résolution réduite, moins d’effets — et l’overlay se met en veille quand personne n’est à l’écran (tous les modes se mettent en pause quand c’est vide).',

    // ----- v0.5 -----
    'Head width': 'Largeur de la tête', 'Head height': 'Hauteur de la tête', 'Mouth line': 'Ligne de la bouche', 'Nose size': 'Taille du nez', 'Nose height': 'Hauteur du nez',
    'Cheek size': 'Taille des joues', 'Eye tilt': 'Inclinaison des yeux', 'Eyebrow size': 'Taille des sourcils', 'Eyebrow height': 'Hauteur des sourcils',
    'Eyebrow tilt': 'Inclinaison des sourcils', 'Eyebrow spacing': 'Écart des sourcils', 'Glasses size': 'Taille des lunettes', 'Hair size': 'Taille des cheveux',
    'Hair height': 'Hauteur des cheveux', 'Facial hair size': 'Taille de la pilosité', 'Hat size': 'Taille du chapeau', 'Hat height': 'Hauteur du chapeau',
    'Hat tilt': 'Inclinaison du chapeau', 'Item size': 'Taille de l’objet', 'Reset sliders': 'Réinitialiser les curseurs',
    'Exit': 'Sortie', 'Portal': 'Portail', 'Teleport beam': 'Téléportation', 'Feathers': 'Plumes', 'Puff of smoke': 'Nuage de fumée',
    '✨ Replay entrances': '✨ Rejouer les entrées', 'Replay entrances': 'Rejouer les entrées', 'Watch the preview, your overlay and OBS': 'Regarde l’aperçu, ton overlay et OBS',
    'Keep an icon in the taskbar while running': 'Garder une icône dans la barre des tâches pendant que l’app tourne',
    'It stays in your taskbar and system tray. Right-click the tray icon to quit.': 'Elle reste dans la barre des tâches et la zone de notification. Clic droit sur l’icône de notification pour quitter.',

    // ----- v0.6: chat sound, sync -----
    'Chat sound': 'Son du chat', 'Sound': 'Son', 'Gibberish (each viewer has a voice)': 'Charabia (chaque spectateur a sa voix)', 'Text-to-speech': 'Synthèse vocale',
    'Played by': 'Joué par', 'This app (desktop audio)': 'Cette app (son du bureau)', 'The OBS browser source': 'La source navigateur OBS', 'Volume': 'Volume', 'Speed': 'Vitesse', 'Pitch': 'Hauteur',
    'Voice (text-to-speech)': 'Voix (synthèse vocale)', 'A different voice/pitch per viewer': 'Une voix / hauteur différente par spectateur', "Read the viewer's name first (TTS)": 'Lire le pseudo avant le message (synthèse)',
    'Max characters per message': 'Caractères max par message', 'Max messages waiting': 'Messages max en attente', 'Muted (shortcut Ctrl+Shift+M)': 'Coupé (raccourci Ctrl+Shift+M)',
    '🔊 Test sound': '🔊 Tester le son', 'System default': 'Voix par défaut du système', 'Hello chat! This is how your viewers will sound.': 'Salut le chat ! Voilà comment vos messages vont sonner.',
    '{name} says: ': '{name} dit : ', 'Mute / unmute chat sound': 'Couper / remettre le son du chat',
    '“This app” plays through your speakers, so OBS picks it up with Desktop Audio. “OBS browser source” plays inside OBS: tick <i>Control audio via OBS</i> on the source to get it on its own mixer track. Text-to-speech uses the voices installed in Windows. Commands and links are never read.': '« Cette app » joue sur tes haut-parleurs : OBS le capte via le Son du bureau. « La source navigateur OBS » joue dans OBS : coche <i>Contrôler l’audio via OBS</i> sur la source pour l’avoir sur sa propre piste. La synthèse vocale utilise les voix installées dans Windows. Les commandes et les liens ne sont jamais lus.',
    'Accepted: a GitHub Gist link, or any raw file URL. The file can contain one <code>PUP1.…</code> code per line, or JSON exported avatars. Every app re-reads it every 2 minutes. Avatars you import by hand take priority.': 'Accepté : un lien GitHub Gist, ou l’URL brute de n’importe quel fichier. Le fichier peut contenir un code <code>PUP1.…</code> par ligne, ou des avatars exportés en JSON. Chaque app le relit toutes les 2 minutes. Les avatars importés à la main restent prioritaires.',
    '⟳ Sync now': '⟳ Synchroniser', '✔ {n} avatars synced': '✔ {n} avatars synchronisés', '✖ Sync failed: {e}': '✖ Échec de la synchro : {e}', 'Syncing…': 'Synchronisation…',

    // ----- v0.7 -----
    'Layout': 'Disposition', 'Horizontal (row)': 'Horizontale (rangée)', 'Vertical (column)': 'Verticale (colonne)', 'Screen length used': 'Longueur d’écran utilisée',
    'Glasses height': 'Hauteur des lunettes', 'Glasses spacing': 'Écart des lunettes', 'Item layer': 'Position de l’objet', 'Behind': 'Derrière la tête', 'Front': 'Devant la tête',
    'Raise the item': 'Lever l’objet', 'Item left / right': 'Objet gauche / droite',

    // ----- v0.8 -----
    'Nose left / right': 'Nez gauche / droite', 'Cheeks left / right': 'Joues gauche / droite', 'Cheeks up / down': 'Joues haut / bas', 'Teeth left / right': 'Dents gauche / droite',
    'Glasses left / right': 'Lunettes gauche / droite', 'Facial hair left / right': 'Pilosité gauche / droite', 'Facial hair up / down': 'Pilosité haut / bas',
    'Hat left / right': 'Chapeau gauche / droite', 'Neckwear size': 'Taille (cou)', 'Neckwear left / right': 'Cou gauche / droite', 'Neckwear up / down': 'Cou haut / bas',
    'Hivis': 'Gilet jaune', 'Apron': 'Tablier', 'Jersey': 'Maillot', 'Kimono': 'Kimono', 'Superhero': 'Super-héros', 'Raincoat': 'Ciré',
    'Hardhat': 'Casque de chantier', 'Party': 'Chapeau de fête', 'Pirate': 'Pirate', 'Santa': 'Bonnet de Noël', 'Chef': 'Toque', 'Microphone': 'Micro', 'Trophy': 'Trophée',
    'Popcorn': 'Pop-corn', 'Lei': 'Collier de fleurs', 'Chain': 'Chaîne en or',

    // ----- tray / notifications (main process) -----
    'Discord: {s}': 'Discord : {s}', 'Open panel': 'Ouvrir le panneau', 'Show overlay': 'Afficher l’overlay', 'Reconnect Discord': 'Reconnecter Discord',
    'Restart to update (v{v})': 'Redémarrer pour mettre à jour (v{v})', 'Download v{v}': 'Télécharger la v{v}', 'Quit': 'Quitter',
    'Puppet Overlay is still running': 'Puppet Overlay tourne toujours', 'It lives in the system tray. Right-click the icon to quit.': 'L’app reste dans la zone de notification. Clic droit sur l’icône pour quitter.',
    'Update ready': 'Mise à jour prête', 'Puppet Overlay {v} will install when you restart the app.': 'Puppet Overlay {v} s’installera au prochain redémarrage de l’app.',

    // ----- first-run guide, what's new, sharing, diagnostics -----
    'Welcome to Puppet Overlay': 'Bienvenue dans Puppet Overlay',
    'Everyone in your Discord voice channel appears on your screen as a paper puppet that talks with them. Three quick steps.': 'Chaque personne de ton salon vocal Discord apparaît à l’écran en marionnette de papier qui parle avec elle. Trois étapes rapides.',
    '1. Connect Discord': '1. Connecter Discord', '2. Your avatar': '2. Ton avatar', '3. Shortcuts': '3. Raccourcis',
    'Create my avatar': 'Créer mon avatar', 'Edit my avatar': 'Modifier mon avatar', 'Share my avatar': 'Partager mon avatar',
    "Send your code (or .puppet file) to whoever manages the crew's avatar file: your puppet then shows up on everyone's screen.": 'Envoie ton code (ou ton fichier .puppet) à la personne qui gère le fichier d’avatars de l’équipe : ta marionnette apparaîtra alors chez tout le monde.',
    'Closing this window keeps the app running in the taskbar and the system tray. Right-click the tray icon to quit.': 'Fermer cette fenêtre laisse l’app tourner dans la barre des tâches et la zone de notification. Clic droit sur l’icône pour quitter.',
    'Esc': 'Échap', 'Skip': 'Passer', 'Back': 'Retour', 'Next': 'Suivant', 'Finish': 'Terminer',
    'Connected as {name}.': 'Connecté en tant que {name}.',
    'Start the Discord desktop app (the browser version does not work).': 'Lance l’application Discord (la version navigateur ne marche pas).',
    'Check that you accepted the App Tester invite from the app owner, then click Reconnect.': 'Vérifie que tu as accepté l’invitation « App Tester » du propriétaire de l’app, puis clique sur Reconnecter.',
    'Waiting for Discord: click “Authorize” in the Discord popup.': 'En attente de Discord : clique sur « Autoriser » dans la fenêtre de Discord.',
    'Connect Discord first: the creator needs your Discord ID.': 'Connecte d’abord Discord : le créateur a besoin de ton ID Discord.',
    'Your Discord ID: {id}': 'Ton ID Discord : {id}', 'Your avatar is ready.': 'Ton avatar est prêt.',
    'Not created yet. Until then, your Discord profile picture is used.': 'Pas encore créé. En attendant, ta photo de profil Discord est utilisée.',
    "What's new": 'Quoi de neuf',
    'Share': 'Partager', 'Copy the code': 'Copier le code', 'Save the .puppet file': 'Enregistrer le fichier .puppet',
    'Create your avatar first': 'Crée d’abord ton avatar', 'Export failed': 'Échec de l’export', 'No avatar for this member yet': 'Pas encore d’avatar pour ce membre',
    'Code copied — paste it to your friends on Discord': 'Code copié — colle-le à tes potes sur Discord', 'Could not copy the code': 'Impossible de copier le code',
    'Connect Discord first, so the app knows which avatar is yours': 'Connecte d’abord Discord, pour que l’app sache quel avatar est le tien',
    'Copy diagnostics': 'Copier les diagnostics', 'Show the welcome guide': 'Revoir le guide de bienvenue',
    'Something wrong? Copy the diagnostics and paste them to whoever helps you. They contain no password or token.': 'Un souci ? Copie les diagnostics et colle-les à la personne qui t’aide. Ils ne contiennent ni mot de passe ni token.',
    'Diagnostics copied — paste them to whoever helps you': 'Diagnostics copiés — colle-les à la personne qui t’aide', 'Could not copy the diagnostics': 'Impossible de copier les diagnostics',
    'Shared file not found (404)': 'Fichier partagé introuvable (404)',
  };

  const DICT = { en: {}, fr: FR };
  let lang = 'en';

  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  function resolve(pref, systemLocale) {
    if (pref && pref !== 'auto' && DICT[pref]) return pref;
    const sys = String(systemLocale || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en').slice(0, 2).toLowerCase();
    return DICT[sys] ? sys : 'en';
  }
  function setLang(l) { const changed = l !== lang; lang = DICT[l] ? l : 'en'; return changed; }
  function t(str, vars) {
    let out = (DICT[lang] && DICT[lang][str]) || (DICT[lang] && DICT[lang][norm(str)]) || str;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return out;
  }

  // ---- DOM application (pages only). Originals are remembered so switching back works. ----
  const textSrc = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function apply(rootEl) {
    if (typeof document === 'undefined') return;
    rootEl = rootEl || document.body;
    rootEl.querySelectorAll('[data-i18n-html]').forEach((el) => {
      if (el.dataset.i18nSrc == null) el.dataset.i18nSrc = norm(el.innerHTML);
      el.innerHTML = t(el.dataset.i18nSrc);
    });
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && (n.parentElement.closest('[data-i18n-html],script,style,code,[data-no-i18n]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!textSrc.has(n)) { if (!norm(n.nodeValue)) continue; textSrc.set(n, n.nodeValue); }
      const src = textSrc.get(n);
      const key = norm(src);
      const lead = src.match(/^\s*/)[0], trail = src.match(/\s*$/)[0];
      n.nodeValue = lead + t(key) + trail;
    }
    rootEl.querySelectorAll('[placeholder],[title]').forEach((el) => {
      for (const attr of ['placeholder', 'title']) {
        if (!el.hasAttribute(attr)) continue;
        const k = 'i18n' + attr;
        if (el.dataset[k] == null) el.dataset[k] = el.getAttribute(attr);
        el.setAttribute(attr, t(el.dataset[k]));
      }
    });
    if (document.title) { if (!document.documentElement.dataset.i18nTitle) document.documentElement.dataset.i18nTitle = document.title; document.title = t(document.documentElement.dataset.i18nTitle); }
    document.documentElement.lang = lang;
  }

  const api = { t, apply, setLang, resolve, get lang() { return lang; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof window !== 'undefined' ? window : globalThis);
