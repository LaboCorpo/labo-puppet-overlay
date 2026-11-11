# Puppet Overlay

Overlay Discord vocal où chaque membre est une marionnette en papier découpé : le haut de la tête s'ouvre quand la personne parle. Inclut un créateur d'avatar (dessiné ou à partir d'une photo) et les spectateurs Twitch avec bulles de chat. Fonctionne sur Windows.

| Livrable | Fichier |
|---|---|
| App overlay + panneau (zone de notification) | `PuppetOverlay-x.y.z-portable.exe` (sans installation) ou `-setup.exe` |
| Créateur d'avatar | dans l'app (Avatars → Créer), ou `web/creator.html` à ouvrir dans un navigateur |
| Intégration OBS / Streamlabs | Source Navigateur `http://localhost:47800/overlay.html` |

---

## 1. Mise en place unique (la personne qui gère le projet)

L'accès au vocal Discord passe par le RPC local de Discord. Il est réservé aux **testeurs** déclarés d'une application Discord (50 max), ce qui suffit pour une bande de potes.

1. https://discord.com/developers/applications → **New Application** (nom au choix, par ex. « Puppet Overlay »).
2. **OAuth2** : ajoute la Redirect URI `http://localhost` et active **Public Client**. Aucun secret ne sera intégré à l'exe.
3. **App Testers** : invite chaque pote. Chacun doit **accepter l'invitation**, sinon Discord refuse la connexion.
4. Copie l'**Application ID**, puis :
   - dans ce dépôt GitHub : *Settings → Secrets and variables → Actions → Variables* → crée `DISCORD_CLIENT_ID` avec cette valeur. Les prochains builds l'intègrent automatiquement.
   - ou bien chaque utilisateur le colle dans *Config Discord* du panneau.

## 2. Récupérer l'exécutable

Chaque push sur `main` compile l'app sur GitHub (onglet **Actions → Build Windows → Artifacts**).
Pour une version à partager : crée un tag `v0.1.0`. L'exe apparaît alors dans **Releases**, avec un lien direct à envoyer aux potes.

> Windows SmartScreen peut afficher « Éditeur inconnu » : clique *Informations complémentaires → Exécuter quand même*. L'exe n'est pas signé.

## 3. Utilisation

- Lance l'exe : une icône apparaît dans la zone de notification. Un clic ouvre le panneau, un clic droit affiche le menu (masquer l'overlay, reconnecter, quitter).
- Au premier lancement, Discord demande d'**autoriser** l'app : clique « Autoriser ».
- Rejoins un salon vocal : les marionnettes apparaissent en bas de l'écran. L'overlay laisse passer les clics.
- Les jeux en plein écran exclusif masquent l'overlay : passe-les en **fenêtré sans bordure**.

### Avatars
- **Créer** : panneau → Avatars → *Créer / modifier mon avatar*. Choisis « De zéro » ou « À partir d'une photo » (cadrage, puis ligne de la bouche).
- **Partager** : *Fichier .puppet* (marche pour tout) ou *Copier le code* `PUP1.…` (avatars dessinés seulement, à coller dans Discord).
- **Recevoir** : glisse les `.puppet` dans le panneau Avatars, ou colle le code.
- Un membre sans avatar apparaît avec sa photo de profil Discord découpée en marionnette.
- **Synchro partagée (bêta)** : crée un Gist GitHub avec un fichier `avatars.json` (`{"avatars": [ …contenu des .puppet… ]}`) et colle son lien « Raw » dans le panneau. Chaque app le relit toutes les 2 minutes.

### Twitch
Panneau → Twitch : active l'option, saisis le nom de ta chaîne et règle le style. Le chat est lu de façon anonyme, sans connexion à un compte. Chaque spectateur garde le même personnage d'un live à l'autre, car il est calculé à partir de son pseudo.

### OBS / Streamlabs
Ajoute une **Source Navigateur** de 1920×1080 :
- `http://localhost:47800/overlay.html` : Discord et Twitch
- `…/overlay.html?scene=discord` ou `?scene=twitch` : une seule des deux scènes

---

## Développement

```bash
npm install
npm start          # lance l'app
npm run dist       # build Windows (sur Windows)
```
Aperçu sans Discord : ouvre `web/overlay.html?demo=1`.

Architecture :
- `electron/main.js` : fenêtres (overlay transparent, panneau), icône de notification, cycle de vie
- `electron/discord-rpc.js` : client RPC (pipe nommé `discord-ipc-N`, AUTHORIZE en PKCE, événements vocaux)
- `electron/server.js` : serveur local (127.0.0.1) qui sert `web/` et l'API `/api/*`, avec l'état poussé en SSE
- `web/shared/puppet.js` : moteur de rendu des marionnettes (canvas), partagé par l'overlay, OBS et le créateur
- `web/overlay.*` · `web/panel.*` · `web/creator.*`

Les réglages et avatars sont stockés dans `%APPDATA%/Puppet Overlay/config.json`.
