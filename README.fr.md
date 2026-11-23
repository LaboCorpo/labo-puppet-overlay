# Puppet Overlay

> [English version](README.md)

Puppet Overlay affiche les personnes de ton **salon vocal Discord** sous forme de petites marionnettes en papier sur ton écran. Quand quelqu'un parle, la tête de sa marionnette s'ouvre et se referme comme celle d'un pantin.

Tu peux aussi mettre les marionnettes dans ton stream **OBS / Streamlabs** et afficher les viewers de ton chat **Twitch** en marionnettes avec des bulles.

Windows uniquement.

---

## 1. Installer

1. Va sur la [**page des Releases**](https://github.com/LaboCorpo/labo-puppet-overlay/releases/latest).
2. Télécharge **`PuppetOverlay-…-setup.exe`**.
3. Lance-le. Windows affiche un écran bleu « Windows a protégé votre ordinateur ». C'est normal, l'app n'est pas signée. Clique sur **Informations complémentaires → Exécuter quand même**.

L'app se met à jour toute seule quand une nouvelle version sort.

> Tu ne veux rien installer ? Télécharge plutôt `PuppetOverlay-…-portable.exe`. Il se lance tel quel, mais ne se met pas à jour tout seul.

## 2. Avant le premier lancement

L'app lit ton salon vocal via Discord, et Discord ne l'autorise que pour des personnes approuvées.
**Demande à la personne qui t'a partagé l'app de t'ajouter comme testeur**, puis accepte l'invitation que Discord t'envoie.

Ce n'est nécessaire que si *toi* tu lances l'app. Les potes qui sont juste dans le vocal avec toi n'ont rien à faire.

## 3. Premier lancement

1. Vérifie que l'**application Discord** (desktop) est ouverte. La version navigateur ne marche pas.
2. Lance Puppet Overlay.
3. Discord affiche une fenêtre qui demande l'autorisation. Clique sur **Autoriser**.
4. Rejoins un salon vocal. Les marionnettes apparaissent en bas à gauche de ton écran.

La fenêtre des réglages s'ouvre depuis l'**icône marionnette** à côté de l'horloge (zone de notification) ou depuis la barre des tâches.

## 4. Créer ton avatar

Sans avatar, tu apparais avec une marionnette faite à partir de ta photo de profil Discord. Pour créer le tien :

1. Dans la fenêtre des réglages, ouvre **Avatars → Créer / modifier mon avatar**.
2. Crée-le **de zéro** ou **à partir d'une photo**. Le bouton **🎲 Aléatoire** donne des idées.
3. Remplis ton **ID utilisateur Discord**. Pour le trouver : Paramètres Discord → Avancés, active le **Mode développeur**, puis clic droit sur ton nom → **Copier l'identifiant utilisateur**.
4. Clique sur **✔ Enregistrer dans mon overlay**.
5. **Partage-le avec tes potes** pour qu'ils le voient aussi : clique sur **Copier le code** et envoie le code, ou télécharge le **fichier .puppet**.

Pour ajouter l'avatar d'un pote : onglet **Avatars** → colle son code et clique sur **Importer**, ou dépose son fichier `.puppet` dans la fenêtre.

## 5. Raccourcis clavier

| Raccourci | Effet |
|---|---|
| `Ctrl+Shift+O` | Afficher / masquer les marionnettes |
| `Ctrl+Shift+P` | Déplacer les marionnettes : glisse-les à la souris, molette pour changer la taille, `Échap` pour terminer |
| `Ctrl+Shift+M` | Couper / remettre le son du chat Twitch |

Tu peux les changer dans **Réglages**.

## 6. Utiliser dans OBS / Streamlabs

1. Laisse Puppet Overlay ouvert.
2. Dans OBS, ajoute une source **Navigateur**.
3. Colle l'adresse affichée dans l'onglet **OBS / Streamlabs** de l'app (en général `http://localhost:47800/overlay.html`).
4. Mets la taille à **1920 × 1080**.

## 7. Twitch (optionnel)

1. Ouvre l'onglet **Twitch**, active-le et tape le nom de ta chaîne.
2. Les viewers de ton chat apparaissent en marionnettes, et leurs messages s'affichent dans des bulles.
3. Les viewers peuvent personnaliser leur marionnette depuis le chat. Ils tapent **`!puppet`** pour voir les commandes, par exemple `!jump`, `!dance` ou `!hat crown`.

Les raids, subs et bits déclenchent des effets. Les messages du chat peuvent aussi être lus à voix haute ou transformés en charabia rigolo (dans l'onglet Twitch).

## 8. Sons d'alerte, widgets de stream et hub streaming

- Onglet **Sons d'alerte** : ajoute autant de MP3 que tu veux pour les follows, subs, subs Prime, subs offerts, bits et raids. Choisis *Aléatoire*, *Dans l'ordre* ou *Tous ensemble*. Pour les bits et les raids, « À partir de » fixe un palier (ex. un son plus gros à partir de 1000 bits). Clique sur **Tester** pour écouter.
- Onglet **Widgets de stream** : followers, subs, dernier follower, dernier sub et la musique en cours sur Spotify. Chacun est sa propre source **Navigateur** dans OBS : copie son adresse, puis déplace-le et redimensionne-le comme tu veux.
- Onglet **Hub streaming** : tape les chaînes Twitch de l'équipe pour voir qui est en live. De là, tu peux lire leurs chats, envoyer des messages, les **raid** (deux clics pour confirmer) ou les inviter en **Stream Together** (ouvre d'abord Stream Together dans ton Gestionnaire de stream Twitch).
- Les compteurs, les follows, les raids, Stream Together et l'envoi de messages demandent de **te connecter avec Twitch** (dans ces onglets). Twitch affiche un code à confirmer sur son site ; tu ne tapes jamais ton mot de passe dans l'app.
- Spotify : fonctionne avec l'application Spotify pour PC, sans connexion Spotify. Le widget affiche la musique, la vraie pochette, l'album et la progression (lus dans les contrôles multimédia de Windows). Garde Spotify ouvert ou réduit. Option : n'importe quel lecteur de musique.
- Chaque widget a sa propre page dans le menu de gauche (sous **Widgets de stream**) : thèmes, apparence, image (pochette / photo de profil), couleurs, texte, tailles, icône, animations, contenu.

- Widget **Chat en direct** (le chat Twitch dans OBS, fusionné pendant une collab) et **Scènes** : plusieurs widgets dans une seule source OBS, à la taille que tu veux (glisse-les sur le canevas).
- **Hub Labo → Multi-stream** : jusqu’à 6 chaînes avec leur vidéo ; **Fusionner les chats** pendant une collab (« toi x ton pote »). Survole un message pour le supprimer, mettre un timeout ou bannir (ta chaîne ou là où tu es modo).
- **Clips** : choisis le raccourci du timestamp ; un vrai clip Twitch peut être créé en même temps et s’ouvre en un clic.

## 8b. La savane 🍌, BabaDeck, Labo test, bot Discord

- **La savane** : un salon vidéo pour l’équipe (il utilise le service gratuit VDO.Ninja). Crée un salon, envoie l’invitation, clique sur **Rejoindre**, choisis ta caméra, ton micro et la qualité, puis **Lancer** (le micro démarre coupé : 🔇 l’active). **🎨 Personnaliser** dans la fenêtre du salon : fais glisser et redimensionne les caméras, fonds prêts à l’emploi ou ton image, logo, titre, pseudos ; ce que tu vois, c’est ce qu’OBS affiche. **📺 Liens OBS** donne un lien pour tout le salon et un par caméra (avec ou sans cadre).
- **BabaDeck** : ton Stream Deck sans le boîtier. Connecte OBS (dans OBS : *Outils → Paramètres du serveur WebSocket*), puis crée des boutons : changer de scène, couper le micro, lancer le live, clip, son, message dans le chat… Chaque bouton peut avoir un raccourci qui marche en jeu, et il y a une fenêtre de deck flottante.
- **Labo test** : des choses à activer, toutes coupées par défaut.
  - *Expériences* : détecteur de hype, points de chaîne → BabaDeck, remerciement des raids, rappel de pause, alertes santé du stream, compte à rebours « ça commence ».
  - *Bot de chat* (répond avec ton compte Twitch) : tes commandes (`!discord`…), minuteurs, `!uptime`, `!so`, `!lurk`, `!commands`, un message de bienvenue pour les nouveaux, des commandes de sons que les viewers peuvent jouer (`!airhorn`…).
  - *Jeux viewers* : giveaway (les subs peuvent avoir plus de tickets), sondage du chat, compteurs (`!death+`), file d’attente (`!play`), pluie d’emotes, jauge de hype, écran de fin. Chacun a son lien OBS et un aperçu.
  - *Outils streamer* : changer le titre et la catégorie avec des préréglages, alerte pub avec report, message « je suis en live » sur Discord (webhook), résumé du live, checklist avant le live.
  - L’alerte pub et le vrai shoutout de `!so` demandent de nouvelles autorisations Twitch : reconnecte ton compte Twitch une fois.
- **Bot Discord** (onglet Puppet Overlay) : tes potes tapent `/puppet create` dans Discord pour créer leur marionnette sans rien installer. Une seule personne (l’hôte) le fait tourner.
- **Mises à jour** : *Réglages → Rechercher une mise à jour* télécharge seulement la nouvelle version (quelques Mo) et redémarre l’app ; plus besoin de retélécharger l’installeur.

## 9. Autres réglages

- Onglet **Overlay** : disposition (ligne ou colonne), taille, effets d'entrée et de sortie, noms, etc.
- Onglet **Membres** : masquer quelqu'un, lui donner un surnom, le grossir ou le rétrécir, changer l'ordre.
- Onglet **Réglages** : langue (anglais / français), performance, lancement avec Windows, mises à jour.

## Un problème ?

| Problème | Solution |
|---|---|
| « Discord not found » / Discord introuvable | Ouvre l'application Discord **desktop** (pas la version navigateur) |
| Erreur qui parle de « tester » ou d'« autorisation » | Vérifie que tu as accepté l'invitation de testeur, puis clique sur **Reconnecter / réautoriser Discord** dans l'onglet Statut |
| Je ne vois pas les marionnettes en jeu | Mets le jeu en mode **fenêtré sans bordure**. Le plein écran exclusif cache l'overlay |
| Rien ne s'affiche dans OBS | Puppet Overlay doit être lancé. Vérifie l'adresse dans l'onglet **OBS / Streamlabs** |
| « Se connecter avec Twitch » demande un Client ID | Demande le Client ID Twitch à la personne qui t'a partagé l'app et colle-le |
| Pas de son d'alerte dans OBS | Dans **Sons d'alerte**, « Joué par » doit correspondre : *Cette app* (OBS l'entend via l'Audio du bureau) ou *OBS* (ajoute la source widget *Sons d'alerte*) |
| Le widget Spotify reste vide | Ouvre l'application Spotify **pour PC** (pas le lecteur web) et garde sa fenêtre ouverte ou réduite |
| Autre chose | **Réglages → Ouvrir le dossier des logs** et envoie le fichier `main.log` à la personne qui t'a partagé l'app |

---

Détails techniques (config de l'app Discord, releases, formats du fichier de synchro, développement) : [docs/MAINTAINER.md](docs/MAINTAINER.md) (en anglais).
