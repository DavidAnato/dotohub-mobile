# DotoHub Mobile — application professionnelle (séparée de Doto+ patient)

App Expo / React Native pour les professionnels de santé.
Se connecte à la même API Django (`doto-backend`) et au même JWT
que DotoHub web. Un scan DotoCard publie un événement SSE pour
ouvrir le dossier sur le bureau (même compte).

## Démarrage

```bash
cd dotohub-mobile
npm install
copy .env.example .env
npx expo start
```

### BlueStacks / émulateur Android

Sous BlueStacks, préférer l’IP LAN de l’hôte dans `.env` :
`EXPO_PUBLIC_API_URL=http://192.168.x.x:8000`.
Le backend doit écouter toutes les interfaces :
`python manage.py runserver 0.0.0.0:8000`.

## Comptes

Voir `seed_demo` / README racine. Login : identifiant + mot de passe (sans OTP).
Ex. `medecin` / `Medecin123!` · `ambulancier` / `Ambulancier123!`
