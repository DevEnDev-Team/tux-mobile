# 📱 Client Mobile Tux-It (PWA)

Ce dépôt contient l'application mobile **Tux-It**, conçue comme une **Progressive Web App (PWA)** ultra-légère, autonome et esthétique. Elle adopte un design moderne et coloré (thème sombre par défaut avec du Glassmorphism violet).

Elle se synchronise de manière transparente avec notre serveur de synchronisation Go et est totalement compatible avec les notes créées par le client Desktop C++ (Qt6).

---

## ✨ Fonctionnalités

* **📱 Look App Mobile Native** : Lancement en plein écran (standalone) sans barre de navigateur, s'adaptant à la zone sécurisée (iOS notch/Dynamic Island).
* **💾 Mode hors-ligne complet (Offline-First)** : Vos notes sont enregistrées localement dans le `localStorage` du téléphone et restent éditables en mode avion grâce au Service Worker (`sw.js`).
* **☁️ Synchronisation intelligente** :
  * Synchronisation périodique avec le serveur Go (`tux-server`) via l'en-tête `Authorization: Bearer <clé_api>`.
  * Algorithme de fusion robuste (la modification la plus récente basée sur le timestamp l'emporte).
  * Statut visuel de synchronisation instantané (icône de nuage dynamique : vert = synchronisé, bleu = en cours, orange = hors ligne, rouge = erreur).
* **🎨 Palette de couleurs** : Éditeur de note avec changement de couleur de fond à la volée (styles pastel) et zone de saisie ergonomique.
* **🔍 Recherche rapide** : Filtrage en temps réel des notes par titre et contenu textuel.

---

## 🚀 Installation de l'application sur votre Téléphone

Il n'est pas nécessaire de passer par Google Play ou l'App Store !

### 🤖 Sur Android (Chrome)
1. Ouvrez l'URL de votre PWA (ex : `https://votre-serveur-tux.fr` ou `http://192.168.1.100:8282`) dans Google Chrome.
2. Une bannière ou une icône d'installation devrait apparaître. Sinon, appuyez sur les **trois points** en haut à droite du navigateur.
3. Sélectionnez **"Ajouter à l'écran d'accueil"** (ou **"Installer l'application"**).

### 🍏 Sur iOS / iPhone (Safari)
1. Ouvrez l'URL de votre PWA dans **Safari** (obligatoire sur iOS).
2. Appuyez sur le bouton **Partager** (le carré avec une flèche vers le haut en bas de l'écran).
3. Faites défiler les options et touchez **"Sur l'écran d'accueil"**.

---

## 🛠️ Comment héberger ou tester la PWA

### Option A : Hébergement combiné avec le Serveur Go (Recommandé)
Le moyen le plus simple d'héberger la PWA est de laisser votre serveur Go servir les fichiers statiques de ce dossier directement sur le port `8282` !
Pour cela, vous pouvez configurer le serveur Go pour qu'il serve un répertoire statique à sa racine.

### Option B : Serveur Web indépendant (Nginx / Caddy)
Puisque la PWA est constituée uniquement de fichiers statiques (`index.html`, `style.css`, `app.js`, `manifest.json`, `logo.png`, `sw.js`), vous pouvez l'héberger sur n'importe quel hébergeur statique gratuit (GitHub Pages, Netlify, Vercel) ou sur votre propre serveur Nginx ou Caddy.

Exemple de configuration simple pour Nginx :
```nginx
server {
    listen 80;
    server_name notes.votre-domaine.fr;

    root /chemin/vers/tux-mobile;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

## 📄 Licence
Ce projet est sous licence MIT.
