# Karttesting

En liten kartprototype som starter med et oversiktsbilde av Vestlandet, flyr inn mot Bergen og markerer Lille Lungegardsvann.

## Innhold

- `index.html`: selve siden
- `styles.css`: layout, typografi og markorstil
- `script.js`: MapLibre-oppsett, kameraflyt og markering
- `serve-local.ps1`: enkel lokal server for testing via `http://localhost`

## Kjor lokalt

Kartet kan ikke alltid lastes riktig fra `file://` i alle miljoer. Start derfor den lokale serveren:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve-local.ps1
```

Deretter kan siden apnes pa:

```text
http://localhost:4173/
```

## GitHub Pages

Repoet er klargjort for GitHub Pages som en statisk side.

Hvis Pages ikke allerede er aktivert i GitHub:

1. Gaa til repository `Settings`
2. Aapne `Pages`
3. Under `Build and deployment`, velg `Deploy from a branch`
4. Velg `main` og `/ (root)`
5. Lagre

For dette repoet blir publisert adresse normalt:

```text
https://sondreolsen.github.io/karttesting/
```

## Teknologi

- MapLibre GL JS
- offentlig OpenMapTiles-stil
- vanlig HTML, CSS og JavaScript
