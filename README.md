# Vinted Studio

Mets en ligne tes vêtements sur Vinted de A à Z :

1. **Studio photo**: tu déposes une photo moyenne (prise sur le lit, mal éclairée…) et tu obtiens des photos
   dignes d'une boutique en ligne.
2. **Annonce**: Claude analyse les photos et rédige titre, description, catégorie, marque, taille, état, couleurs et
   prix conseillé. Tu relis et tu ajustes.
3. **Publication**: une extension Chrome remplit le formulaire « Vendre » de Vinted (photos, titre, description,
   prix) et affiche le reste à sélectionner. C'est toi qui relis et qui cliques sur « Ajouter ».

## Le studio photo

| Outil | Ce qu'il fait | Coût |
| --- | --- | --- |
| **Studio IA** | 6 rendus pro : packshot fond blanc, mannequin invisible (ghost), flat lay, porté par un modèle, cintre & mur, lifestyle. Plusieurs rendus en parallèle, avec une consigne libre si besoin. | ~0,04 € par photo (Gemini Flash), plus pour Gemini Pro et OpenAI |
| **Détourage** | Détourage automatique **dans le navigateur**, puis packshot 1200×1600 sur fond studio (6 teintes) avec ombre douce. Les couleurs du vêtement ne sont pas modifiées. | Gratuit |
| **Retouche** | Exposition, balance des blancs bridée, netteté, recadrage 3:4. Idéal pour l'étiquette et les défauts. | Gratuit |

Un comparateur avant/après permet de juger chaque rendu. Tu choisis ensuite les photos de l'annonce, leur ordre et
la couverture.

Fidélité : chaque prompt IA impose de garder le vêtement **strictement identique** (couleur, motifs, logos, coutures,
usure, défauts). Vérifie quand même chaque rendu avant de publier, et garde au moins une vraie photo (étiquette, défauts) :
une photo trompeuse sur Vinted, c'est un litige assuré.

## Installation

Prérequis : Node.js 20 ou plus récent, Google Chrome.

```bash
npm install
cp .env.example .env
```

Renseigne tes clés dans `.env` :

- `ANTHROPIC_API_KEY`: rédaction des annonces ([console.anthropic.com](https://console.anthropic.com)).
- `GEMINI_API_KEY` (recommandé) **et/ou** `OPENAI_API_KEY`: Studio IA. Clé Gemini gratuite à créer sur
  [aistudio.google.com](https://aistudio.google.com/apikey). Pour la qualité maximale, mets
  `GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview`.

Sans clé, le détourage et la retouche fonctionnent quand même, et tu peux rédiger l'annonce à la main.

## Lancer l'appli

```bash
npm run build
npm start
```

Puis ouvre http://localhost:3000.

Pour développer, `npm run dev` lance l'API sur le port 3000 et l'interface avec rechargement à chaud sur http://localhost:5173.

Les annonces et les photos sont stockées en local dans `data/`.

## Installer l'extension Chrome

1. Va sur `chrome://extensions` et active le **Mode développeur**.
2. Clique sur **Charger l'extension non empaquetée** et choisis le dossier `extension/`.
3. Ouvre https://www.vinted.fr/items/new en étant connecté. Le panneau **Vinted Studio** apparaît en bas à droite.
4. Clique sur **Remplir**, complète catégorie, marque, taille et état (valeurs affichées avec un bouton « Copier »),
   vérifie, publie, puis clique sur **C'est publié ✓**.

L'extension fonctionne aussi sur vinted.be, .es, .it, .de, .nl, .pt, .lu, .co.uk et .com. Si l'appli ne tourne pas
sur `localhost:3000`, change l'adresse en cliquant sur l'icône de l'extension.

### Pourquoi pas une publication 100 % automatique ?

Vinted n'a pas d'API publique pour les vendeurs, et ses conditions d'utilisation interdisent les robots. Un compte
qui publie via un navigateur automatisé risque la suspension. L'extension remplit donc le formulaire dans **ton**
navigateur, et tu cliques toi-même sur « Ajouter ». Ça prend environ 30 secondes par annonce et ça ne présente pas de risque.

Si Vinted modifie son formulaire, un champ peut ne plus être trouvé. Le panneau l'indique alors par un ✗, et le
bouton « Copier » permet de le remplir à la main. Les sélecteurs se trouvent en haut de `extension/content.js`.

## Architecture

```
server/            API Express (TypeScript)
  index.ts         routes : annonces, photos, studio, analyse, export pour l'extension
  db.ts            stockage JSON local (data/db.json + data/listings/<id>/)
  studio/presets.ts   préréglages du Studio IA et règle de fidélité
  studio/imageGen.ts  appels Gemini / OpenAI (édition d'image)
  studio/compose.ts   packshot à partir du détourage, retouche auto (sharp)
  ai/listing.ts    rédaction de l'annonce par Claude (vision et sortie structurée)
web/               interface React (Vite)
extension/         extension Chrome (Manifest V3)
```

Le détourage local utilise `@imgly/background-removal` (licence AGPL, adaptée à un usage personnel). Le modèle,
d'environ 40 Mo, est téléchargé depuis le CDN d'IMG.LY au premier détourage, puis mis en cache par le navigateur.
