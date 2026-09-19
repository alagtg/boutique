# Tresor : installer sur les deux PC Windows

Ce guide utilise Windows 10/11 **64 bits**, SQL Server local sur chaque PC, et deux
paquets compiles. Le PC de caisse peut partir de zero : pas besoin de Node,
Angular, Visual Studio, SDK .NET ou IIS. Le runtime .NET est inclus dans les paquets.

## Ce qui va sur chaque PC

| PC principal | PC caisse |
| --- | --- |
| Dossier PC-Principal | Dossier PC-Caisse |
| Votre SQL Server et votre base existante | SQL Server Express et nouvelle CommerceDB |
| Historique complet et administration | Ventes locales et references utiles |
| Site https://localhost:5443 | Site http://localhost:5000 |
| Recoit les ventes sur HTTPS 5443 | Envoie automatiquement les ventes au principal |

Exemple : principal `192.168.1.10`, caisse `192.168.1.20`.
Ce sont des exemples, pas des adresses imposees. Utiliser les vraies adresses.

## 1. Avant de commencer

1. Mettre les deux PC sur le meme reseau prive (Ethernet de preference).
2. Sur chaque PC : ouvrir Invite de commandes, taper `ipconfig`, relever IPv4.
3. Reserver l'IP du PC principal dans le routeur/DHCP pour qu'elle ne change plus.
4. Sur le PC principal, ouvrir SQL Server Management Studio. Noter le **nom du serveur** et le **nom exact de la base de boutique**. Ne pas choisir une base au hasard.
5. Garder les identifiants de connexion habituels de la boutique ; ils seront conserves.
6. Choisir une phrase secrete de synchronisation d'au moins 32 caracteres. Elle sera saisie a l'identique sur les deux PC. Ce n'est ni le mot de passe SQL ni celui du vendeur.

Le compte Windows utilise pour configurer doit etre celui qui lancera ensuite la
boutique : la configuration secrete est chiffree pour ce compte et ce PC.
Les deux paquets sont distincts : ne pas copier le dossier principal configure sur la caisse.

## 2. Sur le PC principal, en premier

1. Extraire `PC-Principal.zip` dans un dossier permanent, par exemple `C:\Tresor\PC-Principal`. Ne pas travailler dans le ZIP.
2. Fermer l'ancienne API et suspendre les ventes pendant la bascule. La base existante reste en place.
3. Si vos photos/fichiers existent sur une ancienne installation autre que celle ayant produit le paquet, copier son dossier `backend\wwwroot\uploads` dans `PC-Principal\wwwroot\uploads` en conservant les fichiers. Ne pas copier un fichier de base de donnees dans ce dossier.
4. Double-cliquer `1-CONFIGURER.cmd`.
5. Saisir le nom de votre instance SQL, puis le nom exact de la base existante.
6. Pour une connexion SQL Windows, laisser le login SQL vide. Sinon saisir le login SQL puis son mot de passe dans l'invite masquee.
7. Saisir la phrase secrete commune et l'IPv4 fixe de ce PC.
8. Pour les sauvegardes, laisser le chemin vide afin d'utiliser le dossier par defaut de SQL Server, ou indiquer un dossier accessible au compte du service SQL Server.
9. Retaper le nom de la base quand l'assistant le demande. Il cree et verifie une sauvegarde, puis adapte le schema. **Si une erreur apparait, ne pas continuer vers la caisse.**
10. Faire un clic droit sur `5-PARE-FEU-PRINCIPAL.cmd`, puis **Executer en tant qu'administrateur**. Cette regle ouvre seulement HTTPS 5443 depuis le reseau local prive, pas SQL Server.
11. Double-cliquer `2-DEMARRER.cmd`. Edge s'ouvre sur `https://localhost:5443`. Se connecter avec votre compte habituel et verifier l'historique existant.
12. Noter l'adresse affichee, par exemple `https://192.168.1.10:5443`, et l'empreinte du certificat. Copier sur une cle USB **uniquement** `CERTIFICAT-A-COPIER-SUR-CAISSE.cer`, puis le ZIP PC-Caisse.

Le certificat local est installe pour ce compte Windows. Accepter sa confirmation
d'installation seulement pour le certificat que l'assistant vient de creer.
Ne jamais transferer `serveur.pfx` ou `installation.clixml` sur la caisse.

L'assistant attend une base de boutique **existante** sur le principal. Il ne cree
pas de faux historique et ne recree pas vos comptes. S'il manque le nom du serveur
ou de la base, relever ces informations dans SSMS avant de lancer la configuration.

## 3. Sur le PC caisse vide

1. Installer **SQL Server 2022 Express** depuis Microsoft :
   https://www.microsoft.com/en-gb/download/details.aspx?id=104781
2. Choisir l'installation de base. Noter le nom d'instance affiche a la fin, habituellement `SQLEXPRESS`. Le compte Windows qui utilisera la caisse doit pouvoir acceder a cette instance et creer CommerceDB pendant l'installation.
3. Redemarrer Windows si l'installateur le demande. Edge, deja fourni avec Windows, suffit pour le navigateur.
4. Copier `PC-Caisse.zip` depuis la cle USB, puis l'extraire dans `C:\Tresor\PC-Caisse`.
5. Copier le certificat `.cer` du principal dans un emplacement connu, par exemple `C:\Tresor\certificat-principal.cer`.
6. Laisser le PC principal allume avec son nouveau serveur lance.
7. Double-cliquer `1-CONFIGURER.cmd` sur la caisse.
8. Instance SQL : saisir exactement `.\SQLEXPRESS`, ou le nom note lors de l'installation. Base : laisser `CommerceDB`.
9. Laisser le login SQL vide pour l'authentification Windows, sauf si vous avez configure un compte SQL specifique.
10. Saisir **la meme phrase secrete** que sur le principal. Laisser le nom de caisse `CAISSE-01` pour ce poste unique.
11. Saisir l'adresse du principal : par exemple `https://192.168.1.10:5443`. Ne pas saisir `localhost` ici et ne pas ajouter `/api`.
12. Indiquer le chemin du `.cer`, comparer son empreinte avec celle affichee sur le principal, puis taper `OUI`. Ce certificat doit venir du principal par votre cle USB.
13. L'assistant teste la liaison, cree CommerceDB avec ses migrations et importe les references necessaires. Il refuse d'ecraser une caisse deja peuplee.
14. Double-cliquer `2-DEMARRER.cmd`. Le site s'ouvre sur `http://localhost:5000`. Se connecter avec un compte employe **existant sur le principal au moment de l'import**.
15. Verifier les articles, clients et prix. Si les photos du principal ont ete ajoutees apres la creation du paquet, copier `PC-Principal\wwwroot\uploads\products` dans `PC-Caisse\wwwroot\uploads\products` avec la cle USB.

Sur ce PC, ne pas installer le dossier PC-Principal et ne pas saisir sa connexion SQL.
La caisse ne connait que son SQL local et l'adresse HTTPS du principal.

## 4. Verifier avant les vraies ventes

1. Principal allume : faire une petite vente de verification sur la caisse.
2. Sur le principal, verifier qu'elle apparait une seule fois dans l'historique.
3. Sur la caisse, ouvrir `3-VERIFIER.cmd` et se connecter avec un compte ADMIN de la boutique : `pending` doit revenir a 0 et `backOfficeReachable` a True.
4. Ouvrir `6-ARRETER.cmd` sur le principal ou couper temporairement son reseau. Faire une seconde vente de verification sur la caisse : elle doit etre conservee localement.
5. Relancer le principal. Attendre au moins 30 secondes puis verifier que cette vente arrive une seule fois et que `pending` revient a 0.

Ces ventes de verification sont de **vraies ecritures** en base. Choisir avec le
responsable comment les comptabiliser ; aucun bouton de suppression n'est ajoute.
Pour des essais sans ecritures metier, utiliser d'abord une restauration de test de la base.

`3-VERIFIER.cmd` permet aussi de consulter les erreurs et de demander une nouvelle
tentative. Ne pas supprimer CommerceDB pour resoudre une erreur de synchronisation.

## 5. Utilisation quotidienne

- Au demarrage de chaque PC, ouvrir `2-DEMARRER.cmd`, ou activer une fois `4-DEMARRAGE-AUTOMATIQUE.cmd`.
- Pour arreter le serveur de ce poste avant une mise a jour, fermer les ecrans de vente puis ouvrir `6-ARRETER.cmd`.
- Le demarrage automatique intervient **a la connexion de ce meme compte Windows**, pas avant l'ouverture de session. Il ne faut ensuite ni deplacer ni renommer le dossier.
- Le principal doit rester allume et hors veille pour recevoir les ventes. S'il est eteint, la caisse continue ; les ventes attendent son retour.
- Sauvegarder regulierement les **deux bases**, car les ventes encore en attente n'existent que sur la caisse.
- Garder les deux installations a la meme version. Pour une mise a jour, conserver leur configuration, certificats et fichiers locaux.

## 6. Si cela ne fonctionne pas

| Message / symptome | Action |
| --- | --- |
| Impossible de joindre SQL | Verifier le service SQL Server, l'instance et les droits du compte Windows. |
| Sauvegarde refusee | Le compte du service SQL Server doit pouvoir ecrire dans le repertoire choisi ; essayer son repertoire par defaut. |
| Certificat refuse | Verifier la date/heure des PC, l'IP et l'empreinte ; utiliser le certificat du principal et Edge avec le compte Windows configure. |
| Principal inaccessible | Tester `Test-NetConnection 192.168.1.10 -Port 5443` dans PowerShell sur la caisse ; verifier pare-feu, reseau prive et absence de veille. |
| HTTP 401 pour la synchronisation | Les phrases secretes ne correspondent pas ; ne pas recommencer un import ni effacer une base. |
| Port deja utilise | Fermer l'ancienne API qui utilise ce port ; l'assistant ne l'arrete pas automatiquement. |
| Serveur ne demarre pas | Lire `serveur.log` et `serveur-erreur.log` dans le dossier du poste. |
| Configuration deja presente | Utiliser 2-DEMARRER.cmd ; ne pas refaire l'installation initiale. |

Les certificats crees par l'assistant expirent apres deux ans. Prevoir leur
renouvellement sur le principal et l'installation du nouveau certificat public sur la caisse.
Ne pas exposer ces ports a Internet ni configurer une redirection Internet sur le routeur.

## Limite fonctionnelle a connaitre

La synchronisation automatique couvre les **ventes de caisse vers le principal**
et les **nouveaux articles, codes, prix et etats actifs vers la caisse**.
Les stocks existants de caisse ne sont pas remplaces par un instantane distant :
les ventes hors ligne sont ainsi preservees. Les reapprovisionnements existants,
nouveaux comptes, photos ulterieures, reservations et fermetures de caisse
ne font pas partie de cette replication. Le catalogue ne contient pas les mots de passe.
Ne pas recreer CommerceDB pour rafraichir le catalogue : elle contient vos ventes.

Le guide technique `docs/DEUX-BASES.md` du projet detaille les migrations et le diagnostic.
Le fichier `ETIQUETTES-DOUCHETTE.md` de chaque paquet explique l'imprimante et le scan.
Les paquets ont ete prepares localement ; leur creation n'installe rien sur le second PC.

Sources Microsoft :
- SQL Express / Windows 10 : https://www.microsoft.com/en-gb/download/details.aspx?id=104781
- Publication autonome .NET : https://learn.microsoft.com/en-us/dotnet/core/deploying/
