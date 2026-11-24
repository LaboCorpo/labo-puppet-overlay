# LaboHub

> [English version](README.md)

LaboHub (anciennement **Puppet Overlay**) affiche les personnes de ton **salon vocal Discord** sous forme de petites marionnettes en papier sur ton écran. Quand quelqu'un parle, la tête de sa marionnette s'ouvre et se referme comme celle d'un pantin. Les viewers de ton chat **Twitch** peuvent aussi devenir des marionnettes, et tout marche aussi dans **OBS / Streamlabs**.

Pour les streamers, LaboHub a aussi des outils optionnels : widgets de stream et alertes, ton stream et ceux de l'équipe, un Stream Deck à l'écran, un bot de chat. **Tu choisis ce que tu utilises** : le reste est caché et ne tourne pas.

Windows uniquement.

---

## 1. Installer

1. Va sur la [**page des Releases**](https://github.com/LaboCorpo/labo-puppet-overlay/releases/latest).
2. Télécharge **`LaboHub-…-setup.exe`**.
3. Lance-le. Windows affiche un écran bleu « Windows a protégé votre ordinateur ». C'est normal, l'app n'est pas signée. Clique sur **Informations complémentaires → Exécuter quand même**.

L'app se met à jour toute seule quand une nouvelle version sort, et affiche les nouveautés après chaque mise à jour. Si tu avais **Puppet Overlay**, il passe tout seul à LaboHub et garde tes avatars, ta connexion Discord et tes réglages.

> Tu ne veux rien installer ? Télécharge plutôt `LaboHub-…-portable.exe`. Il se lance tel quel, mais ne se met pas à jour tout seul.

## 2. Avant le premier lancement (marionnettes Discord)

L'app lit ton salon vocal via Discord, et Discord ne l'autorise que pour des personnes approuvées.
**Demande à la personne qui t'a partagé l'app de t'ajouter comme testeur**, puis accepte l'invitation que Discord t'envoie.

Ce n'est nécessaire que si *toi* tu lances l'app avec les marionnettes Discord. Les potes qui sont juste dans le vocal avec toi n'ont rien à faire.

## 3. Premier lancement : choisis ce que tu utilises

1. Choisis ta langue.
2. Coche ce que tu veux utiliser :
   - **Marionnettes Discord** : ton salon vocal sur ton écran et dans OBS ;
   - **Marionnettes des spectateurs Twitch** : les spectateurs de ton chat avec des bulles (tape le nom de ta chaîne) ;
   - **Widgets de stream et alertes**, **Mon stream et l'équipe**, **BabaDeck**, **Baba Bot** : les outils de stream (voir section 8).
3. La dernière page liste tes prochaines étapes. Avec les marionnettes Discord : garde l'**application Discord** (desktop) ouverte (la version navigateur ne marche pas) et clique sur **Autoriser** dans la fenêtre que Discord affiche.

Change ton choix quand tu veux dans **Réglages → Fonctions**. La première fois que tu ouvres un onglet, une petite visite te le présente ; **?** en haut à droite (ou **F1**) la relance.

La fenêtre des réglages s'ouvre depuis l'**icône** à côté de l'horloge (zone de notification) ou depuis la barre des tâches.

## 4. Créer ton avatar

Sans avatar, tu apparais avec une marionnette faite à partir de ta photo de profil Discord. Pour créer le tien :

1. Dans **Puppet Overlay → Avatars**, clique sur **Créer / modifier mon avatar**.
2. Crée-le **de zéro** ou **à partir d'une photo**. Le bouton **🎲 Aléatoire** donne des idées.
3. Ton **ID utilisateur Discord** est rempli tout seul quand Discord est connecté. Sinon : Paramètres Discord → Avancés, active le **Mode développeur**, puis clic droit sur ton nom → **Copier l'identifiant utilisateur**.
4. Clique sur **✔ Enregistrer dans mon overlay**.
5. **Partage-le** pour que tes potes le voient aussi : **Avatars → Partager mon avatar** copie ton code (les avatars photo sont enregistrés en fichier `.puppet` à la place). Envoie-le à la personne qui gère le fichier d'avatars partagé ; ta marionnette apparaîtra alors chez tout le monde.

Les avatars de tes potes sont téléchargés automatiquement depuis le fichier partagé. Tu peux aussi en ajouter un à la main : **Avatars** → colle son code et clique sur **Importer**, ou dépose son fichier `.puppet` dans la fenêtre.

## 5. Raccourcis clavier

| Raccourci | Effet |
|---|---|
| `Ctrl+Shift+O` | Afficher / masquer les marionnettes |
| `Ctrl+Shift+P` | Déplacer les marionnettes : glisse-les à la souris, molette pour changer la taille, `Échap` pour terminer |
| `Ctrl+Shift+M` | Couper / remettre le son du chat Twitch |

Tu peux les changer dans **Réglages**.

## 6. Utiliser dans OBS / Streamlabs

1. Laisse LaboHub ouvert.
2. Dans OBS, ajoute une source **Navigateur**.
3. Colle l'adresse affichée dans **Puppet Overlay → OBS / Streamlabs** (en général `http://localhost:47800/overlay.html`).
4. Mets la taille à **1920 × 1080**.

## 7. Marionnettes des viewers Twitch

1. Dans **Puppet Overlay → Spectateurs Twitch**, active-le et tape le nom de ta chaîne (pas besoin de compte Twitch).
2. Les viewers de ton chat apparaissent en marionnettes, et leurs messages s'affichent dans des bulles.
3. Les viewers peuvent personnaliser leur marionnette depuis le chat. Ils tapent **`!puppet`** pour voir les commandes, par exemple `!jump`, `!dance` ou `!hat crown`.

Les raids, subs et bits déclenchent des effets. Les messages du chat peuvent aussi être lus à voix haute ou transformés en charabia rigolo.

## 8. Les outils de stream (optionnels)

Chacun est un onglet, affiché seulement si tu l'as coché. Renomme un onglet d'un double-clic. Chaque onglet a une page **Guide** : coche les étapes au fur et à mesure.

- **Widget Twitch** : une source **Navigateur** OBS par widget : followers, subs, dernier follower / sub, la musique en cours (Spotify), le chat, les **compteurs de jeu** et les alertes.
  - Chaque widget a sa page : thèmes, couleurs, texte, icône, animations, **tes images** et **ton propre CSS**. *Enregistrer ce style* le garde dans **Mes modèles**.
  - **Compteurs de jeu** : morts, victoires, défaites… Donne à chacun un raccourci (ex. `Alt+1`) : il marche en jeu. Les viewers le voient avec `!commande` ; les modos le changent avec `!commande+` / `!commande-`.
  - **Cam des copains** : ajoute un pote, envoie-lui **Son lien**. Il l'ouvre, choisit sa caméra et clique sur *Démarrer* : sa caméra devient une source OBS. Service gratuit VDO.Ninja, rien à installer pour lui.
  - **Sons d'alerte** : mets tes sons et tes GIF dans le dossier **Son Twitch** (bouton 📂), puis choisis-les pour chaque événement (follow, sub, Prime, subs offerts, bits, raid).
  - **Scènes** : plusieurs widgets dans une seule source OBS.
- **Hub Labo**
  - **Mon stream** : ton live avec l'image de sa catégorie, titre et catégorie (avec préréglages), giveaway et sondage du chat (chacun avec son overlay OBS), santé du stream depuis OBS, alerte pub, « je suis en live » sur Discord, résumé, checklist.
  - **Streams des potes** : qui est en live dans l'équipe, raid, Stream Together, chat. **Multi-stream** : vidéos et chats fusionnés. **Clips** : marque les moments à clipper, même en jeu.
- **BabaDeck** : ton Stream Deck sans le boîtier. Connecte OBS (*Outils → Paramètres du serveur WebSocket* dans OBS, puis **Connexion OBS**). Clique sur une case vide pour créer un bouton, **clic droit** sur un bouton pour le modifier, glisse-le pour le déplacer. Chaque bouton peut lancer plusieurs actions et avoir un raccourci.
  - **Raccourcis** liste tous les raccourcis et les **touches conseillées** pour les claviers QWERTY et AZERTY.
  - Le **bandeau des raccourcis** affiche tes raccourcis et leur état par-dessus ton jeu, sans bloquer les clics.
- **Baba Bot** : un bot qui répond avec ton compte Twitch tant que LaboHub est ouvert : tes commandes, des messages réguliers, l'accueil des nouveaux, les remerciements de raid, les commandes son (`!airhorn`).

Les compteurs, les follows, le bot, Mon stream et le Hub demandent de te **connecter à Twitch** (Widget Twitch → Widgets de stream). Twitch affiche un code à confirmer sur son site ; tu ne tapes jamais ton mot de passe dans l'app.

## 9. Autres réglages

- **Overlay** : disposition (ligne ou colonne), taille, effets d'entrée et de sortie, noms, transparence des marionnettes quand ta souris approche.
- **Membres** : masquer quelqu'un, lui donner un surnom, le grossir ou le rétrécir, changer l'ordre.
- **Réglages** : langue (anglais / français), fonctions, performance, effet de la fermeture de la fenêtre (rester dans la barre des tâches, se cacher dans la zone de notification ou quitter), lancement avec Windows, mises à jour.

## Un problème ?

| Problème | Solution |
|---|---|
| « Discord not found » / Discord introuvable | Ouvre l'application Discord **desktop** (pas la version navigateur) |
| Erreur qui parle de « tester » ou d'« autorisation » | Vérifie que tu as accepté l'invitation de testeur, puis clique sur **Reconnecter / réautoriser Discord** dans la page Statut |
| Je ne vois pas les marionnettes en jeu | Mets le jeu en mode **fenêtré sans bordure**. Le plein écran exclusif cache l'overlay |
| Rien ne s'affiche dans OBS | LaboHub doit être lancé. Vérifie l'adresse dans **OBS / Streamlabs** |
| « Fichier partagé introuvable (404) » dans Avatars | Le fichier d'avatars partagé n'est pas encore en place. Préviens la personne qui t'a partagé l'app |
| « Se connecter avec Twitch » demande un Client ID | Demande le Client ID Twitch à la personne qui t'a partagé l'app et colle-le |
| Pas de son ou de GIF d'alerte dans OBS | Dans **Sons d'alerte**, « Joué par » doit correspondre : *Cette app* (OBS l'entend via l'Audio du bureau) ou *OBS*. Les GIF demandent la source widget *Alertes (GIF + son)* |
| La caméra d'un pote reste noire | Il doit garder ouverte la page de son lien, après avoir cliqué sur *Démarrer* |
| Le widget Spotify reste vide | Ouvre l'application Spotify **pour PC** (pas le lecteur web) |
| Autre chose | **Réglages → Copier les diagnostics** et colle le texte à la personne qui t'a partagé l'app (il ne contient ni mot de passe ni token) |

---

Détails techniques (config des apps Discord et Twitch, releases, formats du fichier de synchro, développement) : [docs/MAINTAINER.md](docs/MAINTAINER.md) (en anglais).
