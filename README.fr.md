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

## 8. LaboHub : les onglets

LaboHub a cinq onglets. À l'installation (ou dans **Réglages → Onglets**) tu gardes seulement ceux que tu utilises, et tu peux les renommer (double-clic sur un onglet). La première fois que tu ouvres un onglet, une petite visite te le présente ; **?** en haut à droite (ou **F1**) la relance. Chaque onglet a aussi une page **Guide** : coche les étapes au fur et à mesure.

- **Puppet Overlay** : les marionnettes Discord (sections 3 à 7) et le bot Discord (`/puppet create` dans Discord).
- **Widget Twitch** : une source **Navigateur** OBS par widget : followers, subs, dernier follower / sub, la musique en cours (Spotify), le chat, les **compteurs de jeu** et les alertes.
  - Chaque widget a sa page : thèmes, couleurs, texte, icône, animations, **tes images** (fond, icône) et **ton propre CSS**. *Enregistrer ce style* le garde dans **Mes modèles** pour les autres widgets.
  - **Compteurs de jeu** : morts, victoires, défaites… Donne à chacun un raccourci (ex. `Alt+1` = une défaite de plus) : il marche en jeu. Les viewers le voient avec `!commande` ; les modos le changent avec `!commande+` / `!commande-`. Un lien OBS par compteur, ou deux côte à côte.
  - **Cam des copains** : ajoute un pote, clique sur **Son lien** et envoie-le-lui. Il l'ouvre, choisit sa caméra et clique sur *Démarrer* : sa caméra devient une source OBS (seule, ou toutes ensemble dans une scène que tu arranges à la souris). Service gratuit VDO.Ninja, rien à installer pour lui.
  - **Sons d'alerte** : mets tes sons et tes GIF dans le dossier **Son Twitch** (bouton 📂), puis choisis-les pour chaque événement (follow, sub, Prime, subs offerts, bits, raid), avec un GIF si tu veux. Ajoute le widget *Alertes (GIF + son)* dans OBS pour voir les GIF.
  - **Scènes** : plusieurs widgets dans une seule source OBS.
- **Hub Labo**
  - **Mon stream** : ton live avec l'image de sa catégorie, titre et catégorie (avec préréglages), giveaway et sondage du chat (chacun avec son overlay OBS), santé du stream depuis OBS (avec alerte quand ça galère), alerte pub, « je suis en live » sur Discord, résumé, checklist.
  - **Streams des potes** : qui est en live dans la team (affiché en haut de chaque page du Hub, avec son jeu), raid, Stream Together, chat. **Multi-stream** : vidéos et chats fusionnés. **Clips** : marque les moments à clipper, même en jeu.
- **BabaDeck** : ton Stream Deck sans le boîtier. Connecte OBS (*Outils → Paramètres du serveur WebSocket* dans OBS, puis **Connexion OBS**). Clique sur une case vide pour créer un bouton, **clic droit** sur un bouton pour le modifier, glisse-le pour le déplacer. Chaque bouton peut lancer plusieurs actions et avoir un raccourci (les combinaisons marchent).
  - **Raccourcis** liste tous les raccourcis et les **touches conseillées** pour les claviers QWERTY et AZERTY (en AZERTY évite `Ctrl+Alt+chiffre` : c'est AltGr).
  - Le **bandeau des raccourcis** affiche tes raccourcis et leur état (micro coupé, live, compteurs) par-dessus ton jeu, sans bloquer les clics. Déplace-le et redimensionne-le dans Raccourcis.
- **Baba Bot** : un bot qui répond avec ton compte Twitch tant que LaboHub est ouvert : tes commandes, des messages réguliers, l'accueil des nouveaux, les remerciements de raid, les commandes son (`!airhorn`) avec des fichiers du dossier Son Twitch.

Les compteurs, les follows, le bot, Mon stream et le Hub demandent de te **connecter à Twitch** (Widget Twitch → Widgets de stream). Twitch affiche un code à confirmer sur son site ; tu ne tapes jamais ton mot de passe dans l'app. **Mises à jour** : *Réglages → Rechercher des mises à jour* télécharge seulement la nouvelle version (quelques Mo).

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
| Pas de son ou de GIF d'alerte dans OBS | Dans **Sons d'alerte**, « Joué par » doit correspondre : *Cette app* (OBS l'entend via l'Audio du bureau) ou *OBS*. Les GIF demandent toujours la source widget *Alertes (GIF + son)* |
| La caméra d'un pote reste noire | Il doit garder ouverte la page de son lien, après avoir cliqué sur *Démarrer*. Un nouveau mot de passe (Sécurité) annule les anciens liens |
| Le widget Spotify reste vide | Ouvre l'application Spotify **pour PC** (pas le lecteur web) et garde sa fenêtre ouverte ou réduite |
| Autre chose | **Réglages → Ouvrir le dossier des logs** et envoie le fichier `main.log` à la personne qui t'a partagé l'app |

---

Détails techniques (config de l'app Discord, releases, formats du fichier de synchro, développement) : [docs/MAINTAINER.md](docs/MAINTAINER.md) (en anglais).
