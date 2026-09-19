# Creer, imprimer et scanner les etiquettes

## Premiere installation

1. Brancher l'imprimante d'etiquettes au PC qui cree les articles, normalement le principal.
2. Installer le pilote Windows correspondant au modele exact. Le modele n'a pas encore ete communique ; ne pas installer un pilote choisi au hasard.
3. Dans les preferences de l'imprimante, creer le papier **50 x 30 mm**, en portrait dans le sens du rouleau. Calibrer les espaces entre etiquettes avec la fonction du fabricant.
4. Brancher la douchette USB au PC caisse et la regler en **USB HID / clavier**, avec **Code 128 active**, sans prefixe ni identifiant de symbologie, et avec le suffixe **Entree**.
5. Regler le pays/clavier de la douchette comme Windows (par exemple francais AZERTY). Les codes numeriques ne doivent pas devenir des caracteres tels que `&`, `e` accentue ou parentheses.

## Pour chaque nouvel article

1. Sur le principal, ouvrir Catalogue et saisir nom, couleur, taille, prix et stock.
2. Laisser le code-barres vide : le serveur cree un code numerique. Le bouton Code-barres auto permet aussi d'en proposer un avant l'enregistrement.
3. Cocher **Imprimer apres creation**, choisir **50 x 30 mm**, puis le nombre d'exemplaires.
4. Cliquer **Enregistrer article**. Une etiquette n'est produite qu'apres confirmation de l'enregistrement par l'API.
5. Dans la fenetre Windows, choisir votre imprimante d'etiquettes et le papier correspondant. Utiliser **100 % / taille reelle**, marges aucune, et desactiver en-tetes/pieds de page. Ne pas utiliser Ajuster a la page.
6. Cliquer **Imprimer**, verifier la premiere etiquette, puis la coller sur le vetement.
7. Une taille/couleur differente doit avoir sa propre variante et son propre code. Plusieurs exemplaires de la meme variante utilisent la meme etiquette.

Les nouveaux articles/codes arrivent automatiquement sur la caisse connectee,
habituellement au prochain passage de synchronisation (30 secondes, davantage
pendant une grosse file de ventes). Un article cree pendant que la caisse est
deconnectee doit attendre le retour du reseau avant d'etre scanne sur cette caisse.

## Scanner en caisse

1. Ouvrir la page Caisse sur le PC caisse.
2. Cliquer dans **Scanner ou saisir le code-barres**, ou sur Focus scanner.
3. Scanner l'etiquette. Le suffixe Entree declenche la recherche et l'ajout au panier.
4. Verifier nom, taille, couleur, prix et quantite. Scanner de nouveau ajoute un exemplaire, dans la limite du stock.

## Reimprimer

Cliquer **Etiquette** sur la variante voulue dans le catalogue. Le code et le prix
proviennent de cette variante enregistree, jamais d'un autre article laisse dans
le formulaire. Les anciens codes `TN...` et `TB-...` restent inchanges et peuvent
etre reimprimes en Code 128.

Les formats 60 x 40 et 80 x 40 mm sont aussi proposes. Si un ancien code est trop
long, le logiciel demande un format plus large au lieu d'ecraser les barres.
Il ne faut pas modifier un code deja imprime ; le code d'une variante est permanent.

## Verifier la premiere etiquette

1. Ouvrir Bloc-notes sur le PC caisse.
2. Scanner l'etiquette : la chaine doit etre exactement celle imprimee sous les barres, avec les zeros initiaux, puis un retour a la ligne.
3. Refaire le test dans la caisse : la bonne variante doit apparaitre une seule fois.
4. Si Bloc-notes recoit un texte different, corriger le clavier/prefixe/suffixe de la douchette.
5. Si le texte est exact mais l'article est introuvable, verifier l'arrivee du catalogue et le reseau entre PC.
6. Si la douchette ne lit rien, verifier Code 128, taille reelle, papier, calibration, contraste et marges blanches. Scanner une etiquette imprimee sans plis ni reflet.

Le dessin utilise JsBarcode avec la symbologie **Code 128**, pas un dessin decoratif
ni une police simulee. Les marges blanches de dix modules sont conservees. Le code
de controle est gere par la bibliotheque. Les codes internes generes ne sont pas
des numeros EAN/GS1 attribues pour une distribution externe.

Le navigateur ouvre le dialogue d'impression Windows ; il ne choisit pas une
imprimante silencieusement. L'impression physique et le modele de douchette n'ont
pas pu etre testes a distance. Les tests logiciels decodent les codes avec ZXing
et verifient creation, reimpression et ajout au panier dans le navigateur.

References :
- JsBarcode : https://github.com/lindell/JsBarcode
- Reglage clavier des lecteurs Zebra (consulter la notice de votre propre modele) : https://docs.zebra.com/us/en/scanners/general/ds4-series/ds4678-prg/country-codes/usb-and-keyboard-wedge-country-keyboard-types-%28country-codes%29.html
