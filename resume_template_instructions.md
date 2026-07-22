# Modèle de CV ciblé ATS

Source de vérité : `Modele CV ATS.pdf`.
Encodage attendu : UTF-8. Conserver les accents, apostrophes et caractères français.

Le CV généré doit rester conforme au modèle PDF fourni :
- une seule page A4 ;
- texte simple compatible ATS ;
- pas de tableau, pas de colonne, pas d'icône, pas d'image ;
- sections dans l'ordre du modèle ;
- intitulé du poste centré et strictement identique à celui de l'offre ;
- titres visibles et nom du candidat en gras dans l'export final ;
- contenu concis, direct et vérifiable.

Ne jamais inventer d'employeur, de date, de diplôme, de certification, de compétence,
de résultat chiffré, de langue, de lien, d'adresse ou de coordonnées.
Si une information du modèle PDF n'existe pas dans le profil structuré, l'omettre.

Seules les sections `Objectif professionnel`, `Compétences clés` et
`Expérience professionnelle` doivent être adaptées par l'IA à partir de l'offre.
Toutes les autres sections doivent être reprises directement depuis le profil structuré
extrait du CV, sans les injecter dans le prompt IA.

Ne pas utiliser de titre de niveau 1 (`#`) ni de titre de niveau 2 (`##`) dans le CV final.
Le CV final ne doit contenir que des titres de niveau 3 (`###`) pour les sections visibles.
Supprimer toute section vide du document final.
Placer une règle horizontale sous chaque titre visible, entre le titre de section et son contenu.
Dans l'export final, les titres visibles et l'intitulé du poste doivent être en Cambria.
Dans l'export final, le corps du CV doit être en Arial.

## Ordre et contenu du modèle

Bloc d'identité sans titre visible, dans l'ordre du PDF :

**[Prénom Nom]**
[Téléphone, uniquement s'il existe dans le profil]
[Email, uniquement s'il existe dans le profil]
[Adresse postale ou ville, uniquement si elle existe dans le profil]
[Lien LinkedIn, uniquement s'il existe dans le profil]
[Portfolio / site web, uniquement s'il existe dans le profil]

<p align="center">**[INTITULÉ DU POSTE]**</p>

L'intitulé du poste doit être strictement identique à celui de l'offre.
Dans l'export final, cet intitulé doit être centré et rendu en Cambria.

### Objectif professionnel

Une ou deux phrases courtes, professionnelles et naturelles, directement liées au poste ciblé.
Relier les points forts confirmés du profil aux besoins de l'offre.
Si l'offre expose des missions ou objectifs principaux, les reprendre sous forme d'objectif professionnel,
sans inventer de fait absent du profil ou de l'offre.
Ne pas nommer cette section `Profil`.

### Compétences clés

Lister les compétences pertinentes pour l'offre sous forme de puces.
Chaque compétence doit exister dans le profil structuré.
Privilégier les compétences communes entre le profil et l'offre.
Éviter les longues listes génériques.

### Expérience professionnelle

Inclure seulement une à deux expériences les plus proches de l'offre.
Format attendu, en conservant uniquement les informations disponibles :
`Titre du poste, Nom de l'entreprise - Lieu. Dates d'emploi : Mois Année - Mois Année`

Sous chaque expérience, ajouter une à deux responsabilités ou réalisations factuelles.
Utiliser des chiffres et résultats tangibles uniquement s'ils existent dans le profil.
Écarter les expériences moins proches même si elles sont réelles.

### Formation

Reprendre les diplômes ou formations explicitement présents dans le profil.
Format du modèle : diplôme, discipline/expertise, établissement, lieu, date d'obtention.
Omettre les éléments indisponibles.

### Langues

Reprendre les langues et niveaux explicitement présents dans le profil.
Afficher toutes les langues du profil, triées du meilleur niveau au niveau le plus faible.
Utiliser la nomenclature CECRL quand elle existe : A1, A2, B1, B2, C1, C2.

### Certifications

Reprendre les certifications explicitement présentes dans le profil.
Format du modèle : certification, discipline/expertise, organisme, date.
Omettre les éléments indisponibles.

### Publications et projets

Inclure uniquement les publications, projets ou réalisations présents dans le profil
et pertinents pour l'offre.
Format du modèle : titre, bref descriptif, rôle, date, lien si disponible.

### Associations et centres d'intérêt

Inclure uniquement les associations, activités ou centres d'intérêt présents dans le profil
et utiles à la candidature.
Afficher trois éléments maximum ; si le profil en contient moins, les afficher tous.
Mentionner le rôle seulement s'il existe dans le profil.
