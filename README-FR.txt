DIGITAL PRINT — VERSION 2 (site avec serveur)

CONTENU
- Site vitrine bleu et blanc, responsive Android/iPhone/ordinateur.
- Catalogue de téléphones avec photos, prix USD/CDF, état et stock.
- Administration protégée par connexion : ajout de téléphones et gestion des commandes.
- Comptes clients : inscription, connexion et consultation de l'historique.
- Commandes enregistrées dans une base SQLite.
- Statuts de commande : en attente, confirmée, préparation, expédiée, livrée, annulée.

PRÉREQUIS
- Node.js 20 ou plus récent.
- Connexion Internet lors de la première installation pour télécharger les dépendances.

INSTALLATION SUR UN ORDINATEUR
1. Décompresser DIGITAL_PRINT_v2.zip.
2. Ouvrir un terminal dans le dossier extrait.
3. Exécuter : npm install
4. Définir les variables d'environnement :
   ADMIN_EMAIL=ton-adresse-email
   ADMIN_PASSWORD=un-mot-de-passe-long-et-unique
   SESSION_SECRET=une-chaine-secrete-longue-et-aleatoire
5. Exécuter : npm start
6. Ouvrir http://localhost:3000

LOGO
Copier le logo original en PNG dans public/assets/logo.png.
Le nom du fichier doit être exactement : logo.png.

SÉCURITÉ AVANT MISE EN LIGNE
- Remplacer impérativement les variables ADMIN_EMAIL, ADMIN_PASSWORD et SESSION_SECRET.
- Héberger derrière HTTPS.
- Configurer une sauvegarde régulière de digital-print.sqlite et du dossier uploads.
- Vérifier les conditions de stockage et de protection des données clients.
- Ne pas utiliser le serveur de développement comme hébergement de production sans configuration adaptée.

À SAVOIR
Ce dossier contient le code du site et du serveur, mais il n'est pas encore publié sur Internet.
Il faut un hébergement compatible Node.js et un nom de domaine pour que les clients puissent y accéder.
Les paiements Airtel Money, Orange Money et autres Mobile Money ne sont pas encore intégrés : il faudra un prestataire de paiement et les accès marchands officiels.
Le formulaire de commande enregistre une demande; la confirmation et la livraison restent à gérer par l'entreprise.
